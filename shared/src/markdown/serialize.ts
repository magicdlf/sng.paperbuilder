import {
  MarkdownSerializer,
  type MarkdownSerializerState,
} from 'prosemirror-markdown'
import type { Node as PMNode, Mark } from '@tiptap/pm/model'

import { getPaperSchema } from '../extensions/index.ts'
import type { ColumnAlign } from '../extensions/table.ts'

// ---- 工具 ----

function backticksFor(node: PMNode, side: -1 | 1): string {
  const ticks = /`+/g
  let len = 0
  if (node.isText) {
    let m: RegExpExecArray | null
    while ((m = ticks.exec(node.text ?? ''))) len = Math.max(len, m[0].length)
  }
  let result = len > 0 && side > 0 ? ' `' : '`'
  for (let i = 0; i < len; i++) result += '`'
  if (len > 0 && side < 0) result += ' '
  return result
}

function escapeLinkDest(dest: string): string {
  return /[\s()]/.test(dest) ? `<${dest}>` : dest
}

function attrSuffix(label: string | null | undefined, width?: number | null): string {
  const parts: string[] = []
  if (label) parts.push(`#${label}`)
  if (width != null) parts.push(`width=${width}%`)
  return parts.length ? `{${parts.join(' ')}}` : ''
}

/** 块级公式内容防护：行首的 $$ 前加空格，避免被误当作闭合围栏 */
function guardMathContent(latex: string): string {
  return latex
    .split('\n')
    .map((line) => (line.trimStart().startsWith('$$') ? ' ' + line : line))
    .join('\n')
}

// ---- 节点 ----

const nodes: Record<string, (state: MarkdownSerializerState, node: PMNode, parent: PMNode, index: number) => void> = {
  paragraph(state, node) {
    state.renderInline(node)
    state.closeBlock(node)
  },

  heading(state, node) {
    state.write(state.repeat('#', node.attrs.level) + ' ')
    state.renderInline(node, false)
    const suffix = attrSuffix(node.attrs.label)
    if (suffix) state.write(' ' + suffix)
    state.closeBlock(node)
  },

  blockquote(state, node) {
    state.wrapBlock('> ', null, node, () => state.renderContent(node))
  },

  codeBlock(state, node) {
    const backticks = node.textContent.match(/`{3,}/gm)
    const fence = backticks ? backticks.sort().slice(-1)[0] + '`' : '```'
    state.write(fence + (node.attrs.language || '') + '\n')
    state.text(node.textContent, false)
    state.write('\n')
    state.write(fence)
    state.closeBlock(node)
  },

  bulletList(state, node) {
    state.renderList(node, '  ', () => '- ')
  },

  orderedList(state, node) {
    const start = node.attrs.start || 1
    const maxW = String(start + node.childCount - 1).length
    const space = state.repeat(' ', maxW + 2)
    state.renderList(node, space, (i) => {
      const nStr = String(start + i)
      return state.repeat(' ', maxW - nStr.length) + nStr + '. '
    })
  },

  listItem(state, node) {
    state.renderContent(node)
  },

  horizontalRule(state, node) {
    state.write('---')
    state.closeBlock(node)
  },

  hardBreak(state, node, parent, index) {
    for (let i = index + 1; i < parent.childCount; i++) {
      if (parent.child(i).type !== node.type) {
        state.write('\\\n')
        return
      }
    }
  },

  text(state, node) {
    state.text(node.text ?? '')
  },

  inlineMath(state, node) {
    state.write('$' + String(node.attrs.latex) + '$')
  },

  blockMath(state, node) {
    state.write('$$\n')
    state.write(guardMathContent(String(node.attrs.latex)))
    state.ensureNewLine()
    const suffix = attrSuffix(node.attrs.label)
    state.write('$$' + (suffix ? ' ' + suffix : ''))
    state.closeBlock(node)
  },

  figure(state, node) {
    state.write('![')
    state.renderInline(node, false)
    state.write('](' + escapeLinkDest(String(node.attrs.src)) + ')')
    const suffix = attrSuffix(node.attrs.label, node.attrs.width)
    if (suffix) state.write(suffix)
    state.closeBlock(node)
  },

  table(state, node) {
    serializeTable(state, node)
  },

  crossRef(state, node) {
    state.write(`[@${node.attrs.target}]`)
  },

  citation(state, node) {
    const keys = node.attrs.keys as string[]
    state.write(`[@${keys.join('; @')}]`)
  },
}

// ---- 表格 ----

function cellToMd(cell: PMNode): string {
  const schema = getPaperSchema()
  const para = cell.firstChild
  if (!para || para.content.size === 0) return ''
  // 包一层 doc 走完整序列化（保留 mark 与转义），再压平为单行并转义管道符
  const doc = schema.topNodeType.create(null, para)
  const md = paperMarkdownSerializer.serialize(doc, { tightLists: true })
  return md.replace(/\n+$/, '').replace(/\\\n|\n/g, ' ').replace(/\|/g, '\\|')
}

function alignMarker(align: ColumnAlign | undefined): string {
  switch (align) {
    case 'center':
      return ':---:'
    case 'right':
      return '---:'
    case 'left':
      return ':---'
    default:
      return '---'
  }
}

function serializeTable(state: MarkdownSerializerState, node: PMNode): void {
  const aligns = (node.attrs.aligns ?? null) as ColumnAlign[] | null
  const rows: string[][] = []
  node.forEach((row) => {
    const cells: string[] = []
    row.forEach((cell) => cells.push(cellToMd(cell)))
    rows.push(cells)
  })
  if (rows.length === 0) return
  const colCount = Math.max(...rows.map((r) => r.length))

  const line = (cells: string[]): string =>
    '| ' + Array.from({ length: colCount }, (_, i) => cells[i] ?? '').join(' | ') + ' |'

  const lines: string[] = [
    line(rows[0]!),
    '| ' + Array.from({ length: colCount }, (_, i) => alignMarker(aligns?.[i] ?? undefined)).join(' | ') + ' |',
    ...rows.slice(1).map(line),
  ]

  const caption = String(node.attrs.caption ?? '')
  const label = (node.attrs.label ?? null) as string | null
  if (caption || label) {
    // 空行隔开，否则题注行会被表格解析吞为数据行
    lines.push('', `Table: ${caption}${label ? ` {#${label}}` : ''}`)
  }

  state.text(lines.join('\n'), false)
  state.closeBlock(node)
}

// ---- Marks ----

const marks = {
  bold: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
  italic: { open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true },
  strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
  underline: { open: '<u>', close: '</u>', mixable: true },
  comment: {
    open(_state: MarkdownSerializerState, mark: Mark) {
      return `<span data-comment-id="${mark.attrs.commentId}">`
    },
    close: '</span>',
    mixable: true,
  },
  link: {
    open: '[',
    close(_state: MarkdownSerializerState, mark: Mark) {
      const href = escapeLinkDest(String(mark.attrs.href ?? ''))
      const title = mark.attrs.title ? ` "${String(mark.attrs.title).replace(/"/g, '\\"')}"` : ''
      return `](${href}${title})`
    },
    mixable: false,
  },
  code: {
    open(_state: MarkdownSerializerState, _mark: Mark, parent: PMNode, index: number) {
      return backticksFor(parent.child(index), -1)
    },
    close(_state: MarkdownSerializerState, _mark: Mark, parent: PMNode, index: number) {
      return backticksFor(parent.child(index - 1), 1)
    },
    escape: false,
  },
}

// $ { } < 在正文中转义，避免与公式定界符 / 属性块 / 行内 HTML 冲突
export const paperMarkdownSerializer = new MarkdownSerializer(nodes, marks, {
  escapeExtraCharacters: /[$<{}]/g,
})

/** ProseMirror 文档 → 规范形 Markdown（以换行结尾） */
export function docToMd(doc: PMNode): string {
  const md = paperMarkdownSerializer.serialize(doc, { tightLists: true })
  return md.endsWith('\n') ? md : md + '\n'
}
