import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

/** Keep the header first, and preserve the selected cell and its text offset. */
export function moveTableRow(editor: Editor, direction: -1 | 1, dispatch = true): boolean {
  if (!editor.isEditable || !editor.state.selection.empty) return false
  const { $from } = editor.state.selection
  let depth = $from.depth
  while (depth > 0 && $from.node(depth).type.name !== 'tableRow') depth--
  if (!depth) return false
  const row = $from.node(depth)
  const table = $from.node(depth - 1)
  const index = $from.index(depth - 1)
  const target = index + direction
  if (target < 0 || target >= table.childCount) return false
  const sibling = table.child(target)
  const isHeader = (node: typeof row) => {
    let header = false
    node.forEach(cell => { if (cell.type.name === 'tableHeader') header = true })
    return header
  }
  if (isHeader(row) || isHeader(sibling)) return false
  // Merged cells require a different algorithm; never corrupt their spans.
  let merged = false
  table.descendants(node => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      if (Number(node.attrs.rowspan ?? 1) !== 1 || Number(node.attrs.colspan ?? 1) !== 1) merged = true
    }
  })
  if (merged) return false
  if (!dispatch) return true
  const pos = $from.before(depth)
  const offset = $from.pos - pos
  const insert = direction === -1 ? pos - sibling.nodeSize : pos + sibling.nodeSize
  const tr = editor.state.tr.delete(pos, pos + row.nodeSize).insert(insert, row)
  tr.setSelection(TextSelection.create(tr.doc, insert + offset))
  editor.view.dispatch(tr.scrollIntoView())
  editor.commands.focus()
  return true
}
