import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { titleFromMd } from '@himcm/shared'
import type {
  CommentsFile,
  PaperManifest,
  ProjectSnapshot,
  ReferencesFile,
  SectionContent,
  SectionMeta,
  SectionRole,
  SectionStatus,
} from '@himcm/shared'

const STATUSES: SectionStatus[] = ['draft', 'review', 'done']

function contentHash(md: string): string {
  return crypto.createHash('sha1').update(md, 'utf8').digest('hex').slice(0, 16)
}

const ROLES: SectionRole[] = ['summary', 'body', 'appendix', 'references', 'ai-report']

export async function writeFileAtomic(filePath: string, data: string): Promise<void> {
  const tmp = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(tmp, data, 'utf8')
  await fs.rename(tmp, filePath)
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function assertManifest(x: unknown): asserts x is PaperManifest {
  const m = x as PaperManifest
  if (!m || typeof m !== 'object') throw new HttpError(500, 'paper.json 不是对象')
  if (m.version !== 1) throw new HttpError(500, `paper.json version 不支持: ${String(m.version)}`)
  if (!Array.isArray(m.sections) || m.sections.length === 0) throw new HttpError(500, 'paper.json sections 为空')
  const ids = new Set<string>()
  for (const s of m.sections) {
    if (!s.id || ids.has(s.id)) throw new HttpError(500, `章节 id 重复或为空: ${s.id}`)
    ids.add(s.id)
    if (!ROLES.includes(s.role)) throw new HttpError(500, `未知章节角色: ${s.role}`)
    if (s.role !== 'references' && !s.file) throw new HttpError(500, `章节 ${s.id} 缺少文件路径`)
  }
}

function slugify(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || 'section'
}

export class ProjectStore {
  constructor(readonly paperDir: string) {}

  private get manifestPath(): string {
    return path.join(this.paperDir, 'paper.json')
  }

  /** 打开或创建论文目录；返回是否为新建 */
  async ensure(templateDir: string): Promise<'created' | 'opened'> {
    try {
      await fs.access(this.manifestPath)
      return 'opened'
    } catch {
      // paper.json 不存在：仅当目录为空/不存在时才脚手架，避免覆盖别的目录
      let entries: string[] = []
      try {
        entries = (await fs.readdir(this.paperDir)).filter((e) => e !== '.DS_Store' && e !== '.git')
      } catch {
        // 目录不存在 → 创建
      }
      if (entries.length > 0) {
        throw new Error(`目录 ${this.paperDir} 非空且没有 paper.json，拒绝在其中初始化论文`)
      }
      await this.scaffold(templateDir)
      return 'created'
    }
  }

  private async scaffold(templateDir: string): Promise<void> {
    await fs.mkdir(this.paperDir, { recursive: true })
    await fs.cp(templateDir, this.paperDir, { recursive: true })
    // 模板中以 gitignore 存放（避免拷贝工具忽略点文件），落地改名
    try {
      await fs.rename(path.join(this.paperDir, 'gitignore'), path.join(this.paperDir, '.gitignore'))
    } catch {
      /* 已存在则忽略 */
    }
    await fs.mkdir(path.join(this.paperDir, 'assets'), { recursive: true })
    const manifest = await this.loadManifest()
    manifest.year = new Date().getFullYear()
    await this.saveManifest(manifest)
  }

  async loadManifest(): Promise<PaperManifest> {
    const raw = await fs.readFile(this.manifestPath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    assertManifest(parsed)
    return parsed
  }

  async saveManifest(manifest: PaperManifest): Promise<void> {
    assertManifest(manifest)
    await writeFileAtomic(this.manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  }

  private sectionMeta(manifest: PaperManifest, id: string): SectionMeta {
    const meta = manifest.sections.find((s) => s.id === id)
    if (!meta) throw new HttpError(404, `章节不存在: ${id}`)
    return meta
  }

  async readSectionContent(meta: SectionMeta): Promise<SectionContent> {
    let md = ''
    if (meta.file) {
      try {
        md = await fs.readFile(path.join(this.paperDir, meta.file), 'utf8')
      } catch {
        md = ''
      }
    }
    return {
      id: meta.id,
      role: meta.role,
      file: meta.file,
      md,
      title: titleFromMd(md) ?? meta.id,
      owner: meta.owner ?? null,
      status: meta.status ?? 'draft',
      hash: contentHash(md),
    }
  }

  async snapshot(): Promise<ProjectSnapshot> {
    const manifest = await this.loadManifest()
    const sections = await Promise.all(manifest.sections.map((meta) => this.readSectionContent(meta)))
    return { paperDir: this.paperDir, manifest, sections }
  }

  /**
   * 保存章节。带 baseHash 时做乐观并发检测：磁盘内容已被他人改动（哈希
   * 不匹配）则抛 409，客户端决定“加载最新”或“强制覆盖”（force）。
   */
  async writeSection(id: string, md: string, baseHash?: string, force = false): Promise<SectionContent> {
    const manifest = await this.loadManifest()
    const meta = this.sectionMeta(manifest, id)
    if (!meta.file) throw new HttpError(400, `章节 ${id} 没有可写文件（自动生成的章节）`)
    const abs = path.join(this.paperDir, meta.file)
    if (baseHash && !force) {
      let current = ''
      try {
        current = await fs.readFile(abs, 'utf8')
      } catch {
        /* 文件尚不存在，视为可写 */
      }
      if (current && contentHash(current) !== baseHash) {
        throw new HttpError(409, '该章节已被他人修改')
      }
    }
    await writeFileAtomic(abs, md)
    return this.readSectionContent(meta)
  }

  async updateSectionMeta(
    id: string,
    patch: { owner?: string | null; status?: SectionStatus }
  ): Promise<SectionMeta> {
    const manifest = await this.loadManifest()
    const meta = this.sectionMeta(manifest, id)
    if (patch.owner !== undefined) meta.owner = patch.owner === null ? null : String(patch.owner)
    if (patch.status !== undefined) {
      if (!STATUSES.includes(patch.status)) throw new HttpError(400, `未知状态: ${patch.status}`)
      meta.status = patch.status
    }
    await this.saveManifest(manifest)
    return meta
  }

  async createSection(title: string, afterId?: string): Promise<{ manifest: PaperManifest; section: SectionContent }> {
    const manifest = await this.loadManifest()
    const base = slugify(title)
    let slug = base
    let n = 2
    while (manifest.sections.some((s) => s.id === slug) || (await this.fileExists(`sections/${slug}.md`))) {
      slug = `${base}-${n++}`
    }
    const meta: SectionMeta = { id: slug, file: `sections/${slug}.md`, role: 'body' }
    await writeFileAtomic(path.join(this.paperDir, meta.file!), `# ${title}\n`)

    let insertAt: number
    if (afterId) {
      const idx = manifest.sections.findIndex((s) => s.id === afterId)
      insertAt = idx >= 0 ? idx + 1 : manifest.sections.length
    } else {
      // 默认插入正文块末尾（appendix/references/ai-report 之前）
      const firstTail = manifest.sections.findIndex((s) => ['appendix', 'references', 'ai-report'].includes(s.role))
      insertAt = firstTail >= 0 ? firstTail : manifest.sections.length
    }
    manifest.sections.splice(insertAt, 0, meta)
    await this.saveManifest(manifest)
    return { manifest, section: await this.readSectionContent(meta) }
  }

  async deleteSection(id: string): Promise<PaperManifest> {
    const manifest = await this.loadManifest()
    const meta = this.sectionMeta(manifest, id)
    if (meta.role !== 'body' && meta.role !== 'appendix') {
      throw new HttpError(400, `${meta.role} 章节不可删除`)
    }
    manifest.sections = manifest.sections.filter((s) => s.id !== id)
    await this.saveManifest(manifest)
    if (meta.file) {
      try {
        await fs.rm(path.join(this.paperDir, meta.file))
      } catch {
        /* 文件已不存在 */
      }
    }
    return manifest
  }

  async updateProject(patch: {
    teamControlNumber?: string
    problem?: string
    year?: number
    contest?: string
    title?: string
    keywords?: string[]
    members?: string[]
    export?: Partial<PaperManifest['export']>
    order?: string[]
  }): Promise<PaperManifest> {
    const manifest = await this.loadManifest()
    if (patch.teamControlNumber !== undefined) manifest.teamControlNumber = String(patch.teamControlNumber)
    if (patch.problem !== undefined) manifest.problem = String(patch.problem)
    if (patch.contest !== undefined) manifest.contest = String(patch.contest)
    if (patch.title !== undefined) manifest.title = String(patch.title)
    if (patch.keywords !== undefined) {
      if (!Array.isArray(patch.keywords)) throw new HttpError(400, 'keywords 必须是数组')
      manifest.keywords = patch.keywords.map(String)
    }
    if (patch.members !== undefined) {
      if (!Array.isArray(patch.members)) throw new HttpError(400, 'members 必须是数组')
      manifest.members = [...new Set(patch.members.map((m) => String(m).trim()).filter(Boolean))]
    }
    if (patch.year !== undefined) {
      const y = Number(patch.year)
      if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new HttpError(400, `年份不合法: ${patch.year}`)
      manifest.year = y
    }
    if (patch.export) manifest.export = { ...manifest.export, ...patch.export }
    if (patch.order) {
      const current = new Map(manifest.sections.map((s) => [s.id, s]))
      if (patch.order.length !== manifest.sections.length || !patch.order.every((id) => current.has(id))) {
        throw new HttpError(400, '排序必须是全部章节 id 的一个排列')
      }
      const reordered = patch.order.map((id) => current.get(id)!)
      if (reordered[0]!.role !== 'summary') throw new HttpError(400, 'Summary 必须是第一节')
      if (reordered[reordered.length - 1]!.role !== 'ai-report') throw new HttpError(400, 'AI Use Report 必须是最后一节')
      manifest.sections = reordered
    }
    await this.saveManifest(manifest)
    return manifest
  }

  async saveAsset(filename: string, data: Uint8Array): Promise<string> {
    const ext = (path.extname(filename) || '.png').toLowerCase()
    // 命名 = 原名 slug + 内容短哈希：可读（git status 里认得出）、去重（同图同名幂等）、LaTeX 安全
    const base = path.basename(filename, path.extname(filename))
    const slug = base
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
    const hash = crypto.createHash('sha1').update(data).digest('hex').slice(0, 8)
    const name = slug && slug !== 'image' ? `${slug}-${hash}${ext}` : `img-${hash}${ext}`
    const rel = path.posix.join('assets', name)
    await fs.mkdir(path.join(this.paperDir, 'assets'), { recursive: true })
    await fs.writeFile(path.join(this.paperDir, rel), data)
    return rel
  }

  async loadComments(): Promise<CommentsFile> {
    try {
      const raw = await fs.readFile(path.join(this.paperDir, 'comments.json'), 'utf8')
      const parsed = JSON.parse(raw) as CommentsFile
      if (parsed.version !== 1 || !Array.isArray(parsed.comments)) throw new Error('bad shape')
      return parsed
    } catch {
      return { version: 1, comments: [] }
    }
  }

  async saveComments(file: CommentsFile): Promise<void> {
    if (file.version !== 1 || !Array.isArray(file.comments)) throw new HttpError(400, 'comments 格式不合法')
    await writeFileAtomic(path.join(this.paperDir, 'comments.json'), JSON.stringify(file, null, 2) + '\n')
  }

  async loadReferences(): Promise<ReferencesFile> {
    try {
      const raw = await fs.readFile(path.join(this.paperDir, 'references.json'), 'utf8')
      const parsed = JSON.parse(raw) as ReferencesFile
      if (parsed.version !== 1 || !Array.isArray(parsed.references)) throw new Error('bad shape')
      return parsed
    } catch {
      return { version: 1, references: [] }
    }
  }

  async saveReferences(file: ReferencesFile): Promise<void> {
    if (file.version !== 1 || !Array.isArray(file.references)) throw new HttpError(400, 'references 格式不合法')
    for (const ref of file.references) {
      if (!ref.key || !/^[A-Za-z][\w.-]*$/.test(ref.key)) throw new HttpError(400, `引用 key 不合法: ${ref.key}`)
    }
    await writeFileAtomic(path.join(this.paperDir, 'references.json'), JSON.stringify(file, null, 2) + '\n')
  }

  private async fileExists(rel: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.paperDir, rel))
      return true
    } catch {
      return false
    }
  }
}
