import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

export type ColumnAlign = 'left' | 'center' | 'right'

/**
 * 论文表格：
 * - 单元格限制为单个段落（管道表语法约束，也是三线表的排版约束）
 * - 禁用合并单元格（v1；由客户端 transaction filter 兜底强制）
 * - caption/label/aligns 存为 table 节点属性
 * Markdown 形式：GFM 管道表 + 下一行 `Table: 题注 {#tbl:label}`
 */
export const PaperTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: '' },
      label: { default: null as string | null },
      /** 每列对齐；null = 全部默认（左） */
      aligns: { default: null as ColumnAlign[] | null },
    }
  },
}).configure({
  resizable: false,
  allowTableNodeSelection: true,
})

export const PaperTableRow = TableRow

export const PaperTableCell = TableCell.extend({
  content: 'paragraph',
})

export const PaperTableHeader = TableHeader.extend({
  content: 'paragraph',
})
