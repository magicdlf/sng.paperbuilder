// 论文文档 schema 的唯一定义处 —— 三个消费者：
//   1. client 编辑器（另行 .extend() 挂 NodeView）
//   2. markdown 解析/序列化（headless）
//   3. LaTeX 导出（headless，server 侧）
// 注意：此处只允许 headless 安全的定义（attrs/parseHTML/renderHTML/commands），
// 不得引入 NodeView 或浏览器 API。
import { getSchema, type AnyExtension } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics'

import { PaperAttributes } from './attrs.ts'
import { Figure } from './figure.ts'
import { CrossRef } from './crossref.ts'
import { Citation } from './citation.ts'
import { CommentMark } from './commentMark.ts'
import { PaperTable, PaperTableCell, PaperTableHeader, PaperTableRow } from './table.ts'

export function paperExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false },
      // 编辑器内不需要 trailing node 之外的特殊行为，其余保持默认
    }),
    InlineMath,
    BlockMath,
    PaperAttributes,
    Figure,
    PaperTable,
    PaperTableRow,
    PaperTableHeader,
    PaperTableCell,
    CrossRef,
    Citation,
    CommentMark,
  ]
}

let cachedSchema: Schema | null = null

/** headless 场景（markdown / LaTeX / 测试）使用的共享 schema 单例 */
export function getPaperSchema(): Schema {
  if (!cachedSchema) cachedSchema = getSchema(paperExtensions())
  return cachedSchema
}

export { Figure } from './figure.ts'
export { CrossRef } from './crossref.ts'
export { Citation } from './citation.ts'
export { CommentMark } from './commentMark.ts'
export { PaperAttributes } from './attrs.ts'
export { PaperTable, PaperTableCell, PaperTableHeader, PaperTableRow, type ColumnAlign } from './table.ts'
