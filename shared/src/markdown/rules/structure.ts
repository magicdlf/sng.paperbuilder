import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs'

const HEADING_LABEL_RE = /\s*\{#([A-Za-z][\w:.-]*)\}\s*$/
const FIGURE_ATTRS_RE = /^\s*\{([^{}]*)\}\s*$/
const TABLE_CAPTION_RE = /^Table:\s*(.*?)(?:\s*\{#([A-Za-z][\w:.-]*)\})?\s*$/s

interface FigureMeta {
  src: string
  width: number | null
  label: string | null
}

function parseFigureAttrs(raw: string): { label: string | null; width: number | null } {
  let label: string | null = null
  let width: number | null = null
  for (const part of raw.trim().split(/\s+/)) {
    if (part.startsWith('#')) {
      label = part.slice(1)
    } else if (/^width=\d+%?$/.test(part)) {
      width = Number(part.slice('width='.length).replace('%', ''))
    }
  }
  return { label, width }
}

/** 标题尾部 {#sec:x} → heading_open.meta.label */
function transformHeadings(tokens: Token[]): void {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i]!.type !== 'heading_open') continue
    const inline = tokens[i + 1]!
    if (inline.type !== 'inline' || !inline.children?.length) continue
    const last = inline.children[inline.children.length - 1]!
    if (last.type !== 'text') continue
    const m = last.content.match(HEADING_LABEL_RE)
    if (!m) continue
    tokens[i]!.meta = { ...(tokens[i]!.meta ?? {}), label: m[1] }
    last.content = last.content.slice(0, m.index).replace(/\s+$/, '')
    inline.content = inline.content.replace(HEADING_LABEL_RE, '')
    if (!last.content) inline.children.pop()
  }
}

/**
 * markdown-it 的 text_join 只处理顶层 inline token，image 子 token 中可能残留
 * text_special（转义字符/实体）。把它们还原为普通 text 并合并相邻文本。
 */
function normalizeInlineChildren(children: Token[], state: StateCore): Token[] {
  const out: Token[] = []
  for (const tok of children) {
    const isText = tok.type === 'text' || tok.type === 'text_special'
    const prev = out[out.length - 1]
    if (isText && prev && prev.type === 'text') {
      prev.content += tok.content
      continue
    }
    if (tok.type === 'text_special') {
      const text = new state.Token('text', '', 0)
      text.content = tok.content
      out.push(text)
      continue
    }
    out.push(tok)
  }
  return out
}

/** 独占段落的 ![caption](src){#fig:x width=70%} → pfigure 块 */
function transformFigures(state: StateCore): void {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i]!.type !== 'paragraph_open') continue
    const inline = tokens[i + 1]!
    if (inline.type !== 'inline' || tokens[i + 2]!.type !== 'paragraph_close') continue
    const children = (inline.children ?? []).filter((t) => !(t.type === 'text' && !t.content))
    if (children.length === 0 || children.length > 2) continue
    const image = children[0]!
    if (image.type !== 'image') continue
    let label: string | null = null
    let width: number | null = null
    if (children.length === 2) {
      const trailing = children[1]!
      if (trailing.type !== 'text') continue
      const m = trailing.content.match(FIGURE_ATTRS_RE)
      if (!m) continue
      ;({ label, width } = parseFigureAttrs(m[1] ?? ''))
    }
    const meta: FigureMeta = { src: image.attrGet('src') ?? '', width, label }

    const open = new state.Token('pfigure_open', 'figure', 1)
    open.meta = meta
    const captionInline = new state.Token('inline', '', 0)
    captionInline.children = normalizeInlineChildren(image.children ?? [], state)
    captionInline.content = image.content
    const close = new state.Token('pfigure_close', 'figure', -1)
    tokens.splice(i, 3, open, captionInline, close)
  }
}

/**
 * 重写表格 token 流：
 * - 丢弃 thead/tbody 层级
 * - th/td 内容包一层 paragraph（符合 schema：单元格 = 单段落）
 * - 收集列对齐到 ptable_open.meta.aligns
 * - 紧随其后的 `Table: 题注 {#tbl:x}` 段落 → 表格属性
 */
function transformTables(state: StateCore): void {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.type !== 'table_open') continue
    let end = i + 1
    while (end < tokens.length && tokens[end]!.type !== 'table_close') end++
    if (end >= tokens.length) continue

    const aligns: Array<'left' | 'center' | 'right'> = []
    let sawAlign = false
    const out: Token[] = []
    const tableOpen = new state.Token('ptable_open', 'table', 1)
    out.push(tableOpen)

    for (let j = i + 1; j < end; j++) {
      const tok = tokens[j]!
      switch (tok.type) {
        case 'thead_open':
        case 'thead_close':
        case 'tbody_open':
        case 'tbody_close':
          break
        case 'tr_open':
          out.push(new state.Token('ptrow_open', 'tr', 1))
          break
        case 'tr_close':
          out.push(new state.Token('ptrow_close', 'tr', -1))
          break
        case 'th_open':
        case 'td_open': {
          const isHeader = tok.type === 'th_open'
          if (isHeader) {
            const style = tok.attrGet('style') ?? ''
            const align = style.includes('center') ? 'center' : style.includes('right') ? 'right' : 'left'
            if (style) sawAlign = true
            aligns.push(align)
          }
          out.push(new state.Token(isHeader ? 'pth_open' : 'ptd_open', tok.tag, 1))
          out.push(new state.Token('paragraph_open', 'p', 1))
          break
        }
        case 'th_close':
        case 'td_close':
          out.push(new state.Token('paragraph_close', 'p', -1))
          out.push(new state.Token(tok.type === 'th_close' ? 'pth_close' : 'ptd_close', tok.tag, -1))
          break
        default:
          out.push(tok)
      }
    }
    out.push(new state.Token('ptable_close', 'table', -1))

    // 表格后紧跟的题注段落
    let caption = ''
    let label: string | null = null
    let consumed = 0
    if (
      end + 3 < tokens.length + 1 &&
      tokens[end + 1]?.type === 'paragraph_open' &&
      tokens[end + 2]?.type === 'inline' &&
      tokens[end + 3]?.type === 'paragraph_close'
    ) {
      const m = tokens[end + 2]!.content.match(TABLE_CAPTION_RE)
      if (m) {
        caption = (m[1] ?? '').trim()
        label = m[2] ?? null
        consumed = 3
      }
    }
    tableOpen.meta = { aligns: sawAlign ? aligns : null, caption, label }

    tokens.splice(i, end - i + 1 + consumed, ...out)
    i += out.length - 1
  }
}

/** 未被识别为 figure 的行内 image 降级为字面文本 */
function neutralizeInlineImages(tokens: Token[], state: StateCore): void {
  for (const block of tokens) {
    if (block.type !== 'inline' || !block.children) continue
    for (let k = 0; k < block.children.length; k++) {
      const tok = block.children[k]!
      if (tok.type !== 'image') continue
      const text = new state.Token('text', '', 0)
      text.content = `![${tok.content}](${tok.attrGet('src') ?? ''})`
      block.children[k] = text
    }
  }
}

export function structurePlugin(md: MarkdownIt): void {
  md.core.ruler.push('himcm_structure', (state) => {
    transformHeadings(state.tokens)
    transformFigures(state)
    transformTables(state)
    neutralizeInlineImages(state.tokens, state)
  })
}
