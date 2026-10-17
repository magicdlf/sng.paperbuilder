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

/** Browser localStorage owns the directory list. No implicit paper directory. */
export class PaperManager {
  private active: CurrentPaper | null = null
  constructor(readonly templateDir: string) {}

  get currentDir(): string | null { return this.active?.dir ?? null }
  get current(): CurrentPaper {
    if (!this.active) throw new HttpError(404, '请先打开或新建论文目录')
    return this.active
  }

  async initial(explicitDir: string | null): Promise<void> {
    if (explicitDir) await this.open(explicitDir, true)
  }

  async open(dir: string, initialize = false): Promise<CurrentPaper> {
    if (!path.isAbsolute(dir)) throw new HttpError(400, '请输入目录的绝对路径')
    const abs = path.resolve(dir)
    if (!initialize) {
      try { await fs.access(path.join(abs, 'paper.json')) }
      catch { throw new HttpError(404, '该目录没有 paper.json；请检查路径，或选择新建论文') }
    }
    const store = new ProjectStore(abs)
    const created = await store.ensure(this.templateDir)
    const git = new GitService(abs)
    await git.ensureRepo()
    if (created === 'created') await git.commitAll('初始化论文')
    this.active = { dir: abs, store, git, latex: new LatexService(store) }
    console.log('已打开论文: ' + abs)
    return this.active
  }

  async create(dir: string): Promise<CurrentPaper> {
    if (!dir.trim()) throw new HttpError(400, '请输入新论文目录的绝对路径')
    try {
      await fs.access(path.join(dir, 'paper.json'))
      throw new HttpError(400, '论文已存在，请选择打开已有目录')
    } catch (err) { if (err instanceof HttpError) throw err }
    return this.open(dir, true)
  }

  async list(): Promise<PaperListItem[]> {
    if (!this.active) return []
    const manifest = await this.active.store.loadManifest()
    return [{ dir: this.active.dir, name: path.basename(this.active.dir),
      contest: manifest.contest, year: manifest.year, problem: manifest.problem, current: true }]
  }
}
