// 全项目共享的数据契约：论文清单、批注、git、编译结果、编号索引。
// server 与 client 的 API 均以此为准。

export type SectionRole = 'summary' | 'body' | 'appendix' | 'references' | 'ai-report'

/** 章节写作状态：沟通信号而非权限锁 */
export type SectionStatus = 'draft' | 'review' | 'done'

export interface SectionMeta {
  id: string
  /** 相对论文目录的 md 文件路径；references 角色为 null（由 references.json 生成） */
  file: string | null
  role: SectionRole
  /** 负责人（members 中的名字） */
  owner?: string | null
  status?: SectionStatus
}

export interface PaperExportConfig {
  engine: 'pdflatex' | 'xelatex'
  /** true 时批注导出为 todonotes 边注（草稿模式） */
  draftComments: boolean
  toc: boolean
  /** official：COMAP 模板 1in 边距；compact：2cm 边距 + 小字号目录（临近 25 页上限时压页数） */
  layout?: 'official' | 'compact'
  /** float：[htbp] 浮动（规范）；here：[H] 强制原地（图表死跟文字） */
  floatPlacement?: 'float' | 'here'
}

export interface PaperManifest {
  version: 1
  contest: string
  year: number
  problem: string
  teamControlNumber: string
  /** 论文标题（summary 页居中显示） */
  title?: string
  /** 关键词（summary 内容之后的 Keywords 行） */
  keywords?: string[]
  /** 团队成员名单（分工/评论署名用，无鉴权） */
  members?: string[]
  sections: SectionMeta[]
  bibliography: string
  export: PaperExportConfig
}

export interface SectionContent {
  id: string
  role: SectionRole
  file: string | null
  md: string
  /** 从 md 首个一级标题推导 */
  title: string
  owner?: string | null
  status?: SectionStatus
  /** 磁盘内容哈希（并发保存冲突检测的基准） */
  hash: string
}

export interface ProjectSnapshot {
  paperDir: string
  manifest: PaperManifest
  sections: SectionContent[]
}

export interface PaperListItem {
  dir: string
  name: string
  contest: string
  year: number
  problem: string
  current: boolean
}

// ---- git ----

export interface GitLogEntry {
  hash: string
  date: string
  author: string
  message: string
  /** 父提交哈希（合并提交有多个）；图谱布局用 */
  parents: string[]
  /** 引用装饰，如 "HEAD -> main, tag: v1"；空串表示无 */
  refs: string
}

export interface GitStatusResult {
  isRepo: boolean
  changedFiles: string[]
  /** true = 处于历史版本浏览模式（detached HEAD，界面只读） */
  detached: boolean
  headHash: string | null
  branch: string | null
  /** true = 浏览前有未提交更改被自动暂存，回到最新时自动恢复 */
  browseStashed: boolean
}

export interface GitCommitResult {
  committed: boolean
  hash: string | null
}

// ---- 编译 ----

export interface CompileError {
  sectionId: string | null
  line: number | null
  message: string
}

export interface CompileResult {
  ok: boolean
  pdfAvailable: boolean
  /** PDF 总页数（含 AI Use Report） */
  pagesTotal: number | null
  /** 计入 25 页限制的页数（不含 AI Use Report） */
  pagesCounted: number | null
  /** 页数来源是否可信（log/aux 与 pdfinfo 一致） */
  pagesVerified: boolean
  overLimit: boolean | null
  errors: CompileError[]
  warnings: string[]
  durationMs: number
}

// ---- 批注 ----

export interface CommentMessage {
  id: string
  at: string
  text: string
  author?: string
}

export interface CommentThread {
  id: string
  sectionId: string
  status: 'open' | 'resolved'
  createdAt: string
  /** 锚定文本快照，用于孤儿恢复 */
  anchorText: string
  thread: CommentMessage[]
}

export interface CommentsFile {
  version: 1
  comments: CommentThread[]
}

// ---- 参考文献 ----

export interface Reference {
  key: string
  authors?: string
  title: string
  /** 期刊/网站/出版方 */
  container?: string
  year?: string
  url?: string
  /** 访问日期（网页类引用） */
  accessed?: string
  note?: string
}

export interface ReferencesFile {
  version: 1
  references: Reference[]
}

// ---- 编号 ----

export type LabelKind = 'fig' | 'tbl' | 'eq' | 'sec'

export interface LabelEntry {
  kind: LabelKind
  label: string
  /** 显示编号，如 "3"、"2.1"、"A" */
  number: string
  sectionId: string
}

/** 某章节开始前的计数器状态（用于编辑器内实时编号） */
export interface SectionCounters {
  fig: number
  tbl: number
  eq: number
  /** 分级标题计数 [h1, h2, h3]；appendix 中 h1 计数代表字母序号 */
  heading: [number, number, number]
  /** 该章节是否处于附录（h1 编号用字母） */
  appendix: boolean
  /** 该章节标题是否参与编号（summary/ai-report 不编号） */
  numbered: boolean
}

export interface LabelIndex {
  byLabel: Record<string, LabelEntry>
  sectionStart: Record<string, SectionCounters>
}
