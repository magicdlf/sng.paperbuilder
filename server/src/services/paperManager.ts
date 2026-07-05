import { promises as fs } from 'node:fs'
import path from 'node:path'
import { HttpError, ProjectStore } from './projectStore.ts'
import { GitService } from './gitService.ts'
import { LatexService } from './latexService.ts'
import type { PaperListItem } from '@himcm/shared'

export interface CurrentPaper {
  dir: string
  store: ProjectStore
  git: GitService
  latex: LatexService
}

/**
 * 多论文管理：papersRoot 下每个含 paper.json 的子目录是一篇论文。
 * server 持有可切换的“当前论文”，重启时回到上次打开的一篇。
 */
export class PaperManager {
  current!: CurrentPaper

  constructor(
    readonly papersRoot: string,
    readonly templateDir: string
  ) {}

  private get lastFile(): string {
    return path.join(this.papersRoot, '.last-paper')
  }

  /** 启动时定位初始论文：--paper 显式指定 > 上次打开 > papersRoot/demo */
  async initial(explicitDir: string | null): Promise<void> {
    await fs.mkdir(this.papersRoot, { recursive: true })
    let dir = explicitDir
    if (!dir) {
      try {
        const last = (await fs.readFile(this.lastFile, 'utf8')).trim()
        if (last) {
          await fs.access(path.join(last, 'paper.json'))
          dir = last
        }
      } catch {
        /* 无记录或已删除 */
      }
    }
    await this.open(dir ?? path.join(this.papersRoot, 'demo'))
  }

  /** 打开（目录缺失/为空则脚手架）并切换为当前论文 */
  async open(dir: string): Promise<CurrentPaper> {
    const abs = path.resolve(dir)
    const store = new ProjectStore(abs)
    const created = await store.ensure(this.templateDir)
    const git = new GitService(abs)
    await git.ensureRepo()
    if (created === 'created') await git.commitAll('初始化论文')
    this.current = { dir: abs, store, git, latex: new LatexService(store) }
    try {
      await fs.writeFile(this.lastFile, abs + '\n', 'utf8')
    } catch {
      /* 记录失败不影响使用 */
    }
    console.log(`${created === 'created' ? '已创建' : '已打开'}论文: ${abs}`)
    return this.current
  }

  /** 在 papersRoot 下新建论文目录 */
  async create(name: string): Promise<CurrentPaper> {
    const clean = name.trim()
    if (!clean || /[/\\]/.test(clean) || clean.startsWith('.')) {
      throw new HttpError(400, `目录名不合法: ${name}`)
    }
    const dir = path.join(this.papersRoot, clean)
    let exists = true
    try {
      await fs.access(dir)
    } catch {
      exists = false
    }
    if (exists) throw new HttpError(400, `目录已存在: ${clean}（用“打开”切换过去）`)
    return this.open(dir)
  }

  async list(): Promise<PaperListItem[]> {
    const items: PaperListItem[] = []
    const seen = new Set<string>()
    let entries: string[] = []
    try {
      entries = (await fs.readdir(this.papersRoot, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => path.join(this.papersRoot, e.name))
    } catch {
      /* root 不存在 */
    }
    // 当前论文可能在 root 之外（--paper 指定），也列出来
    for (const dir of [...entries, this.current.dir]) {
      const abs = path.resolve(dir)
      if (seen.has(abs)) continue
      seen.add(abs)
      try {
        const raw = await fs.readFile(path.join(abs, 'paper.json'), 'utf8')
        const m = JSON.parse(raw) as { contest?: string; year?: number; problem?: string }
        items.push({
          dir: abs,
          name: path.basename(abs),
          contest: m.contest ?? 'HiMCM',
          year: m.year ?? 0,
          problem: m.problem ?? '?',
          current: abs === this.current.dir,
        })
      } catch {
        /* 非论文目录，跳过 */
      }
    }
    return items.sort((a, b) => a.name.localeCompare(b.name))
  }
}
