import MarkdownIt from 'markdown-it'
import { MarkdownParser, type ParseSpec } from 'prosemirror-markdown'
import type { Node as PMNode } from '@tiptap/pm/model'

import { getPaperSchema } from '../extensions/index.ts'
import { mathPlugin } from './rules/math.ts'
import { refCitePlugin } from './rules/refcite.ts'
import { structurePlugin } from './rules/structure.ts'
import { spanPlugin } from './rules/span.ts'

export function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({ html: true })
  md.use(mathPlugin)
  md.use(refCitePlugin)
  md.use(structurePlugin) // core：标题 label / figure / 表格重写（先）
  md.use(spanPlugin) // core：批注 span / <u> / 兜底 html（后）
  return md
}

/** markdown-it token 名 → PM 节点/mark 映射 */
const tokens: Record<string, ParseSpec> = {
  paragraph: { block: 'paragraph' },
  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)), label: tok.meta?.label ?? null }),
  },
  blockquote: { block: 'blockquote' },
  bullet_list: { block: 'bulletList' },
  ordered_list: {
    block: 'orderedList',
    getAttrs: (tok) => ({ start: Number(tok.attrGet('start') ?? 1) }),
  },
  list_item: { block: 'listItem' },
  code_block: { block: 'codeBlock', noCloseToken: true },
  fence: {
    block: 'codeBlock',
    getAttrs: (tok) => ({ language: tok.info ? tok.info.trim().split(/\s+/)[0] : null }),
    noCloseToken: true,
  },
  hr: { node: 'horizontalRule' },
  hardbreak: { node: 'hardBreak' },

  math_inline: { node: 'inlineMath', getAttrs: (tok) => ({ latex: tok.content }) },
  math_block: {
    node: 'blockMath',
    getAttrs: (tok) => ({ latex: tok.content, label: tok.meta?.label ?? null }),
  },
  pfigure: { block: 'figure', getAttrs: (tok) => ({ ...tok.meta }) },
  ptable: {
    block: 'table',
    getAttrs: (tok) => ({
      caption: tok.meta?.caption ?? '',
      label: tok.meta?.label ?? null,
      aligns: tok.meta?.aligns ?? null,
    }),
  },
  ptrow: { block: 'tableRow' },
  pth: { block: 'tableHeader' },
  ptd: { block: 'tableCell' },
  crossref: { node: 'crossRef', getAttrs: (tok) => ({ target: tok.meta.target }) },
  citation: { node: 'citation', getAttrs: (tok) => ({ keys: tok.meta.keys }) },

  em: { mark: 'italic' },
  strong: { mark: 'bold' },
  s: { mark: 'strike' },
  u: { mark: 'underline' },
  comment: { mark: 'comment', getAttrs: (tok) => ({ commentId: tok.meta?.id ?? '' }) },
  link: {
    mark: 'link',
    getAttrs: (tok) => ({ href: tok.attrGet('href'), title: tok.attrGet('title') || null }),
  },
  code_inline: { mark: 'code', noCloseToken: true },
}

let cachedParser: MarkdownParser | null = null

function getParser(): MarkdownParser {
  if (!cachedParser) {
    cachedParser = new MarkdownParser(getPaperSchema(), createMarkdownIt(), tokens)
  }
  return cachedParser
}

/** Markdown 源码 → ProseMirror 文档 */
export function mdToDoc(md: string): PMNode {
  return getParser().parse(md)
}

/** 从 md 提取章节标题（首个一级标题），失败返回 null */
export function titleFromMd(md: string): string | null {
  const m = md.match(/^#\s+(.+?)\s*$/m)
  if (!m) return null
  return m[1]!.replace(/\s*\{#[\w:.-]*\}\s*$/, '').trim() || null
}
