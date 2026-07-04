import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'

const COMMENT_OPEN_RE = /^<span data-comment-id="([^"]+)">$/
const U_OPEN_RE = /^<u>$/i
const CLOSE_SPAN_RE = /^<\/span>$/i
const CLOSE_U_RE = /^<\/u>$/i

/**
 * 将行内 HTML 中我们认识的两种标签转成 mark 开合 token：
 *   <span data-comment-id="x">…</span> → comment mark
 *   <u>…</u>                           → underline mark
 * 其它 html_inline / html_block 一律降级为字面文本（不丢数据）。
 * 未配对的开标签在行内末尾回退为字面文本，保证 token 流平衡。
 */
export function spanPlugin(md: MarkdownIt): void {
  md.core.ruler.push('himcm_spans', (state) => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue
      const out: Token[] = []
      // 记录待配对的开标签在 out 中的下标
      const stack: Array<{ kind: 'comment' | 'u'; index: number }> = []

      for (const tok of block.children) {
        if (tok.type !== 'html_inline') {
          out.push(tok)
          continue
        }
        const html = tok.content
        let m: RegExpMatchArray | null
        if ((m = html.match(COMMENT_OPEN_RE))) {
          const open = new state.Token('comment_open', 'span', 1)
          open.meta = { id: m[1] }
          stack.push({ kind: 'comment', index: out.length })
          out.push(open)
        } else if (U_OPEN_RE.test(html)) {
          const open = new state.Token('u_open', 'u', 1)
          stack.push({ kind: 'u', index: out.length })
          out.push(open)
        } else if (CLOSE_SPAN_RE.test(html) && stack.length && stack[stack.length - 1]!.kind === 'comment') {
          stack.pop()
          out.push(new state.Token('comment_close', 'span', -1))
        } else if (CLOSE_U_RE.test(html) && stack.length && stack[stack.length - 1]!.kind === 'u') {
          stack.pop()
          out.push(new state.Token('u_close', 'u', -1))
        } else {
          const text = new state.Token('text', '', 0)
          text.content = html
          out.push(text)
        }
      }

      // 未配对的开标签回退为字面文本
      for (const pending of stack.reverse()) {
        const open = out[pending.index]!
        const text = new state.Token('text', '', 0)
        text.content =
          open.type === 'comment_open' ? `<span data-comment-id="${open.meta?.id ?? ''}">` : '<u>'
        out[pending.index] = text
      }

      block.children = out
    }

    // html_block（块级 HTML）降级为纯文本段落
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!
      if (tok.type !== 'html_block') continue
      const pOpen = new state.Token('paragraph_open', 'p', 1)
      const inline = new state.Token('inline', '', 0)
      const text = new state.Token('text', '', 0)
      text.content = tok.content.replace(/\n+$/, '')
      inline.content = text.content
      inline.children = [text]
      const pClose = new state.Token('paragraph_close', 'p', -1)
      tokens.splice(i, 1, pOpen, inline, pClose)
      i += 2
    }
  })
}
