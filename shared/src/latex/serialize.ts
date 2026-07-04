import type { Mark, Node as PMNode } from '@tiptap/pm/model'
import { escapeLatex, escapeUrl } from './escape.ts'
import type { ColumnAlign } from '../extensions/table.ts'

export interface LatexOptions {
  /** true：标题带编号（body/appendix）；false：\section*（summary/ai-report） */
  numberedHeadings: boolean
  /** 批注导出为 todonotes 边注（草稿模式）；否则剥离 */
  draftComments?: boolean
  /** commentId → 批注首条内容（草稿模式显示用） */
  commentTexts?: Record<string, string>
}

interface LatexCtx extends LatexOptions {
  /** 已输出 todo 的批注 id（跨 text node 的批注只出一条边注） */
  emittedComments: Set<string>
}

/** ProseMirror 文档 → LaTeX 正文片段（不含 preamble） */
export function docToLatex(doc: PMNode, opts: LatexOptions): string {
  const ctx: LatexCtx = { ...opts, emittedComments: new Set() }
  return renderBlocks(doc, ctx).join('\n\n')
}

function renderBlocks(parent: PMNode, opts: LatexCtx): string[] {
  const out: string[] = []
  parent.forEach((node) => {
    const rendered = renderBlock(node, opts)
    if (rendered !== null) out.push(rendered)
  })
  return out
}

function renderBlock(node: PMNode, opts: LatexCtx): string | null {
  switch (node.type.name) {
    case 'paragraph': {
      const inline = renderInline(node, opts)
      return inline.trim() ? inline : null
    }
    case 'heading':
      return renderHeading(node, opts)
    case 'blockquote':
      return `\\begin{quote}\n${renderBlocks(node, opts).join('\n\n')}\n\\end{quote}`
    case 'codeBlock':
      return `\\begin{verbatim}\n${node.textContent}\n\\end{verbatim}`
    case 'bulletList':
      return renderList(node, 'itemize', opts)
    case 'orderedList':
      return renderList(node, 'enumerate', opts)
    case 'horizontalRule':
      return '\\medskip\\hrule\\medskip'
    case 'blockMath': {
      const latex = String(node.attrs.latex).trim()
      const label = node.attrs.label as string | null
      if (label) return `\\begin{equation}\\label{${label}}\n${latex}\n\\end{equation}`
      return `\\[\n${latex}\n\\]`
    }
    case 'figure':
      return renderFigure(node, opts)
    case 'table':
      return renderTable(node, opts)
    default:
      // 未知块级节点：尽力渲染其行内内容
      return node.isTextblock ? renderInline(node, opts) : null
  }
}

function renderHeading(node: PMNode, opts: LatexCtx): string {
  const level = node.attrs.level as number
  const star = opts.numberedHeadings ? '' : '*'
  const cmd = level === 1 ? 'section' : level === 2 ? 'subsection' : 'subsubsection'
  const label = node.attrs.label ? `\\label{${node.attrs.label}}` : ''
  return `\\${cmd}${star}{${renderInline(node, opts)}}${label}`
}

function renderList(node: PMNode, env: 'itemize' | 'enumerate', opts: LatexCtx): string {
  const lines: string[] = [`\\begin{${env}}`]
  if (env === 'enumerate') {
    const start = Number(node.attrs.start ?? 1)
    if (start !== 1) lines.push(`\\setcounter{enumi}{${start - 1}}`)
  }
  node.forEach((item) => {
    const content = renderBlocks(item, opts).join('\n\n')
    lines.push(`\\item ${content}`)
  })
  lines.push(`\\end{${env}}`)
  return lines.join('\n')
}

function renderFigure(node: PMNode, opts: LatexCtx): string {
  const width = ((node.attrs.width as number | null) ?? 70) / 100
  const src = String(node.attrs.src)
  const label = node.attrs.label ? `\\label{${node.attrs.label}}` : ''
  const caption = renderInline(node, opts)
  return [
    '\\begin{figure}[htbp]',
    '\\centering',
    `\\includegraphics[width=${width.toFixed(2)}\\linewidth]{${src}}`,
    // 始终输出 \caption：保证图始终计数，编辑器编号与 PDF 一致
    `\\caption{${caption}}${label}`,
    '\\end{figure}',
  ].join('\n')
}

function renderTable(node: PMNode, opts: LatexCtx): string {
  const aligns = (node.attrs.aligns ?? null) as ColumnAlign[] | null
  const rows: string[][] = []
  let headerRow: string[] | null = null
  node.forEach((row, _offset, rowIndex) => {
    const cells: string[] = []
    row.forEach((cell) => {
      const para = cell.firstChild
      cells.push(para ? renderInline(para, opts) : '')
    })
    if (rowIndex === 0) headerRow = cells
    else rows.push(cells)
  })
  if (!headerRow) return ''
  const colCount = Math.max((headerRow as string[]).length, ...rows.map((r) => r.length), 1)
  const colSpec = Array.from({ length: colCount }, (_, i) => {
    const a = aligns?.[i]
    return a === 'center' ? 'c' : a === 'right' ? 'r' : 'l'
  }).join('')

  const caption = escapeLatex(String(node.attrs.caption ?? ''))
  const label = node.attrs.label ? `\\label{${node.attrs.label}}` : ''
  const line = (cells: string[]) =>
    Array.from({ length: colCount }, (_, i) => cells[i] ?? '').join(' & ') + ' \\\\'

  const lines = [
    '\\begin{table}[htbp]',
    '\\centering',
    // 三线表：题注在表上方
    `\\caption{${caption}}${label}`,
    `\\begin{tabular}{${colSpec}}`,
    '\\toprule',
    line(headerRow),
    '\\midrule',
    ...(rows.length ? rows.map(line) : ['\\multicolumn{' + colCount + '}{c}{}\\\\']),
    '\\bottomrule',
    '\\end{tabular}',
    '\\end{table}',
  ]
  return lines.join('\n')
}

// ---- 行内 ----

function renderInline(parent: PMNode, opts: LatexCtx): string {
  const parts: string[] = []
  parent.forEach((node) => {
    parts.push(renderInlineNode(node, opts))
  })
  return parts.join('')
}

function renderInlineNode(node: PMNode, opts: LatexCtx): string {
  let content: string
  switch (node.type.name) {
    case 'text':
      content = escapeLatex(node.text ?? '')
      break
    case 'inlineMath':
      return applyMarks(`$${String(node.attrs.latex)}$`, node.marks, opts)
    case 'crossRef':
      return applyMarks(`\\Cref{${node.attrs.target}}`, node.marks, opts)
    case 'citation':
      return applyMarks(`\\cite{${(node.attrs.keys as string[]).join(',')}}`, node.marks, opts)
    case 'hardBreak':
      return '\\\\\n'
    default:
      content = escapeLatex(node.textContent)
  }
  return applyMarks(content, node.marks, opts)
}

function applyMarks(content: string, marks: readonly Mark[], opts: LatexCtx): string {
  let out = content
  // 从内到外包裹；code 最内层，comment 最外层
  const order = ['code', 'strike', 'underline', 'italic', 'bold', 'link', 'comment']
  const sorted = [...marks].sort((a, b) => order.indexOf(a.type.name) - order.indexOf(b.type.name))
  for (const mark of sorted) {
    switch (mark.type.name) {
      case 'bold':
        out = `\\textbf{${out}}`
        break
      case 'italic':
        out = `\\textit{${out}}`
        break
      case 'underline':
        out = `\\underline{${out}}`
        break
      case 'strike':
        out = `\\st{${out}}`
        break
      case 'code':
        out = `\\texttt{${out}}`
        break
      case 'link':
        out = `\\href{${escapeUrl(String(mark.attrs.href ?? ''))}}{${out}}`
        break
      case 'comment': {
        if (opts.draftComments) {
          const id = String(mark.attrs.commentId)
          const text = opts.commentTexts?.[id]
          if (text && !opts.emittedComments.has(id)) {
            opts.emittedComments.add(id)
            out = `${out}\\todo[fancyline]{${escapeLatex(text)}}`
          }
        }
        break
      }
    }
  }
  return out
}
