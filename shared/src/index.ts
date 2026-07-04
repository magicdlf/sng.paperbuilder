export * from './types.ts'
export { paperExtensions, getPaperSchema } from './extensions/index.ts'
export {
  Figure,
  CrossRef,
  Citation,
  CommentMark,
  PaperAttributes,
  PaperTable,
  PaperTableCell,
  PaperTableHeader,
  PaperTableRow,
  type ColumnAlign,
} from './extensions/index.ts'
export { mdToDoc, docToMd, titleFromMd, createMarkdownIt, paperMarkdownSerializer } from './markdown/index.ts'
export { buildLabelIndex, walkSectionCounters, crossRefDisplay, type SectionDoc } from './numbering.ts'
