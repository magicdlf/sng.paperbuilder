import type MarkdownIt from 'markdown-it'
import type { RuleInline } from 'markdown-it/lib/parser_inline.mjs'

const KEY_RE = /^@[A-Za-z][\w:.-]*$/
const REF_PREFIX_RE = /^(fig|tbl|eq|sec):/

/**
 * [@fig:plot] → 交叉引用（单个、带已知前缀）
 * [@smith2020] / [@a; @b] → 参考文献引用
 * 必须注册在 link 规则之前，否则 [..] 可能被链接语法吃掉。
 */
const refcite: RuleInline = (state, silent) => {
  const { src, pos } = state
  if (src[pos] !== '[' || src[pos + 1] !== '@') return false
  const close = src.indexOf(']', pos)
  if (close < 0 || close > state.posMax) return false
  const inner = src.slice(pos + 1, close)
  if (inner.includes('[')) return false

  const parts = inner.split(';').map((s) => s.trim())
  if (parts.length === 0 || !parts.every((p) => KEY_RE.test(p))) return false
  const keys = parts.map((p) => p.slice(1))

  const isCrossRef = keys.length === 1 && REF_PREFIX_RE.test(keys[0]!)
  if (!silent) {
    if (isCrossRef) {
      const token = state.push('crossref', '', 0)
      token.meta = { target: keys[0] }
      token.content = inner
    } else {
      const token = state.push('citation', '', 0)
      token.meta = { keys }
      token.content = inner
    }
  }
  state.pos = close + 1
  return true
}

export function refCitePlugin(md: MarkdownIt): void {
  md.inline.ruler.before('link', 'refcite', refcite)
}
