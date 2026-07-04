import type MarkdownIt from 'markdown-it'
import type { RuleInline } from 'markdown-it/lib/parser_inline.mjs'
import type { RuleBlock } from 'markdown-it/lib/parser_block.mjs'

export const LABEL_RE = /^[A-Za-z][\w:.-]*$/

/**
 * 行内公式 $...$：
 * - 开启 $ 后不能紧跟空白；闭合 $ 前不能是空白（排除 "$ 5 and $ 6"）
 * - 闭合 $ 后不能紧跟数字（排除 "$5…$6" 货币误判）
 * - \$ 由 markdown-it 的 escape 规则先行处理，不会到达本规则
 */
const mathInline: RuleInline = (state, silent) => {
  const { src, pos } = state
  if (src[pos] !== '$') return false
  if (src[pos + 1] === '$') return false // $$ 只作块级公式
  const next = src[pos + 1]
  if (next === undefined || /\s/.test(next)) return false

  let scan = pos + 1
  let close = -1
  while (scan < state.posMax) {
    const ch = src[scan]
    if (ch === '\\') {
      scan += 2
      continue
    }
    if (ch === '$') {
      close = scan
      break
    }
    scan++
  }
  if (close < 0) return false

  const content = src.slice(pos + 1, close)
  if (!content.trim()) return false
  const beforeClose = src[close - 1]
  if (beforeClose === undefined || /\s/.test(beforeClose)) return false
  const after = src[close + 1]
  if (after !== undefined && /\d/.test(after)) return false

  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.markup = '$'
    token.content = content
  }
  state.pos = close + 1
  return true
}

/**
 * 块级公式：
 *   $$
 *   E = mc^2
 *   $$ {#eq:mass}     ← label 可选，写在闭合行
 * 也接受单行形式 $$E=mc^2$$（规范形输出总是多行）。
 */
const mathBlock: RuleBlock = (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine]! + state.tShift[startLine]!
  const max = state.eMarks[startLine]!
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false
  const first = state.src.slice(start, max)
  if (!first.startsWith('$$')) return false

  const closeRe = /^\$\$\s*(?:\{#([A-Za-z][\w:.-]*)\})?\s*$/
  let label: string | null = null
  let content = ''
  let nextLine = startLine + 1

  const rest = first.slice(2)
  if (rest.includes('$$')) {
    // 单行 $$...$$ [{#label}]
    const m = rest.match(/^([\s\S]*?)\$\$\s*(?:\{#([A-Za-z][\w:.-]*)\})?\s*$/)
    if (!m) return false
    content = (m[1] ?? '').trim()
    label = m[2] ?? null
    if (!content) return false
  } else {
    if (rest.trim()) content = rest.trim() + '\n'
    let found = false
    for (; nextLine < endLine; nextLine++) {
      const s = state.bMarks[nextLine]! + state.tShift[nextLine]!
      const e = state.eMarks[nextLine]!
      const line = state.src.slice(s, e)
      const m = line.match(closeRe)
      if (m) {
        label = m[1] ?? null
        found = true
        break
      }
      content += line + '\n'
    }
    if (!found) return false
    nextLine += 1
    content = content.replace(/\n$/, '')
  }

  if (silent) return true
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = content
  token.meta = { label }
  token.map = [startLine, nextLine]
  state.line = nextLine
  return true
}

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'math_inline', mathInline)
  md.block.ruler.after('fence', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
}
