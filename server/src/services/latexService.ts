import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  assemblePaper,
  lintSections,
  mdToDoc,
  type CompileResult,
} from '@himcm/shared'
import type { ProjectStore } from './projectStore.ts'
import { aiReportPageFromAux, mapErrorsToSections, parseTexLog } from './logParser.ts'

const execFileAsync = promisify(execFile)
const TEXBIN = '/Library/TeX/texbin'
const PAGE_LIMIT = 25

export class LatexService {
  constructor(readonly store: ProjectStore) {}

  private get buildDir(): string {
    return path.join(this.store.paperDir, 'build')
  }

  /** 组装 build/paper.tex（+ 复制 assets 使 build 目录自包含，可直接上传 Overleaf） */
  async exportTex(): Promise<{ texPath: string; lineMap: Array<{ line: number; sectionId: string }>; warnings: string[]; engine: 'pdflatex' | 'xelatex' }> {
    const snapshot = await this.store.snapshot()
    const refs = await this.store.loadReferences()

    let warnings: string[] = []

    let commentTexts: Record<string, string> | undefined
    if (snapshot.manifest.export.draftComments) {
      const comments = await this.store.loadComments()
      commentTexts = Object.fromEntries(
        comments.comments
          .filter((c) => c.status === 'open' && c.thread.length > 0)
          .map((c) => [c.id, c.thread[0]!.text])
      )
    }

    const sections = snapshot.manifest.sections.map((meta) => {
      const content = snapshot.sections.find((s) => s.id === meta.id)
      return { meta, doc: meta.file && content ? mdToDoc(content.md) : null }
    })

    const { tex, lineMap, engine } = assemblePaper({
      manifest: snapshot.manifest,
      sections,
      references: refs.references,
      commentTexts,
    })
    if (engine === 'xelatex' && snapshot.manifest.export.engine === 'pdflatex') {
      warnings.push('检测到中文，已自动使用 XeLaTeX 和 TeX Live 内置 Fandol 字体编译。')
    } else if (engine === 'pdflatex') {
      warnings = lintSections(snapshot.sections.filter((s) => s.md))
    }

    await fs.mkdir(this.buildDir, { recursive: true })
    const texPath = path.join(this.buildDir, 'paper.tex')
    await fs.writeFile(texPath, tex, 'utf8')

    // 复制图片资源（build 自包含）
    const assetsSrc = path.join(this.store.paperDir, 'assets')
    const assetsDst = path.join(this.buildDir, 'assets')
    try {
      await fs.rm(assetsDst, { recursive: true, force: true })
      await fs.cp(assetsSrc, assetsDst, { recursive: true })
    } catch {
      /* 无 assets 目录 */
    }

    return { texPath, lineMap, warnings, engine }
  }

  async compile(): Promise<CompileResult> {
    const started = Date.now()
    const { lineMap, warnings: lintWarnings, engine } = await this.exportTex()
    const engineFlag = engine === 'xelatex' ? '-pdfxe' : '-pdf'

    let latexmkFailed = false
    try {
      await execFileAsync(
        'latexmk',
        [engineFlag, '-interaction=nonstopmode', '-file-line-error', '-f', 'paper.tex'],
        {
          cwd: this.buildDir,
          env: {
            ...process.env,
            PATH: [TEXBIN, process.env.PATH ?? ''].join(path.delimiter),
            // 禁止 TeX 日志 79 列硬折行，否则错误行会被截断导致解析失败
            max_print_line: '10000',
          },
          timeout: 180_000,
          maxBuffer: 64 * 1024 * 1024,
        }
      )
    } catch {
      latexmkFailed = true
    }

    // 以日志为准判定结果（latexmk 退出码噪声多）
    let log = ''
    try {
      log = await fs.readFile(path.join(this.buildDir, 'paper.log'), 'utf8')
    } catch {
      return {
        ok: false,
        pdfAvailable: false,
        pagesTotal: null,
        pagesCounted: null,
        pagesVerified: false,
        overLimit: null,
        errors: [{ sectionId: null, line: null, message: 'latexmk 未产生日志（LaTeX 是否安装？）' }],
        warnings: lintWarnings,
        durationMs: Date.now() - started,
      }
    }

    const parsed = parseTexLog(log)
    const errors = mapErrorsToSections(parsed.errors, lineMap)

    let pdfAvailable = false
    try {
      await fs.access(path.join(this.buildDir, 'paper.pdf'))
      pdfAvailable = true
    } catch {
      /* 无 PDF */
    }

    // 页数：log 总页数 + aux 中 AI 报告起始页
    const pdfinfoPages = pdfAvailable ? await this.pdfinfoPages() : null
    // XeLaTeX may report XDV rather than PDF page totals in the TeX log.
    let pagesTotal = parsed.pagesTotal ?? pdfinfoPages
    let pagesCounted: number | null = null
    let pagesVerified = false

    if (pagesTotal !== null) {
      let aiPage: number | null = null
      try {
        const aux = await fs.readFile(path.join(this.buildDir, 'paper.aux'), 'utf8')
        aiPage = aiReportPageFromAux(aux)
      } catch {
        /* 无 aux */
      }
      pagesCounted = aiPage !== null ? aiPage - 1 : pagesTotal
      // pdfinfo 交叉验证
      pagesVerified = parsed.pagesTotal !== null && pdfinfoPages !== null && pdfinfoPages === pagesTotal
      if (pdfinfoPages !== null && pdfinfoPages !== pagesTotal) {
        pagesTotal = pdfinfoPages
        pagesCounted = aiPage !== null ? aiPage - 1 : pdfinfoPages
      }
    }

    // 以最终日志与产物为准：latexmk 的退出码在多 pass 自愈时会残留非零
    const ok = errors.length === 0 && pdfAvailable
    const finalWarnings = [...lintWarnings, ...parsed.warnings]
    if (ok && latexmkFailed) {
      finalWarnings.push('latexmk 退出码非零但最终日志无错误（多为中间 pass 噪声）')
    }
    return {
      ok,
      pdfAvailable,
      pagesTotal,
      pagesCounted,
      pagesVerified,
      overLimit: pagesCounted === null ? null : pagesCounted > PAGE_LIMIT,
      errors,
      warnings: finalWarnings,
      durationMs: Date.now() - started,
    }
  }

  private async pdfinfoPages(): Promise<number | null> {
    for (const bin of ['/opt/homebrew/bin/pdfinfo', '/usr/local/bin/pdfinfo', 'pdfinfo']) {
      try {
        const { stdout } = await execFileAsync(bin, [path.join(this.buildDir, 'paper.pdf')], { timeout: 10_000 })
        const m = stdout.match(/^Pages:\s+(\d+)/m)
        if (m) return Number(m[1])
      } catch {
        continue
      }
    }
    return null
  }
}
