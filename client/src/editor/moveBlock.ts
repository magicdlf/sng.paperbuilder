// 块级节点（图/表）的结构化移动：与相邻兄弟块交换位置。
// 拖放对长文档不友好，按钮/快捷键移动是确定性的。
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

const MOVABLE = new Set(['figure', 'table'])

/** 把 pos 处的块与相邻兄弟交换；成功返回 true */
export function moveNodeAt(editor: Editor, pos: number, dir: -1 | 1): boolean {
  // 浏览模式（只读）下命令仍可 dispatch，必须显式拦截
  if (!editor.isEditable) return false
  const { doc } = editor.state
  const node = doc.nodeAt(pos)
  if (!node) return false
  const $pos = doc.resolve(pos)
  const parent = $pos.parent
  const index = $pos.index()
  const targetIndex = index + dir
  if (targetIndex < 0 || targetIndex >= parent.childCount) return false
  const sibling = parent.child(targetIndex)

  const from = pos
  const to = pos + node.nodeSize
  // 上移：删除区间在兄弟之后，兄弟位置不变 → 插到兄弟原起点
  // 下移：删除后，后一个兄弟左移到 from → 插到 from + sibling.nodeSize
  const insertPos = dir === -1 ? pos - sibling.nodeSize : from + sibling.nodeSize

  const tr = editor.state.tr.delete(from, to)
  tr.insert(insertPos, node)
  tr.setSelection(NodeSelection.create(tr.doc, insertPos))
  editor.view.dispatch(tr.scrollIntoView())
  editor.commands.focus()
  return true
}

/** 基于当前选区定位可移动块（NodeSelection 的图，或光标所在的表格/图） */
export function moveBlock(editor: Editor, dir: -1 | 1): boolean {
  const { selection } = editor.state
  if (selection instanceof NodeSelection && MOVABLE.has(selection.node.type.name)) {
    return moveNodeAt(editor, selection.from, dir)
  }
  const { $from } = selection
  for (let d = $from.depth; d > 0; d--) {
    if (MOVABLE.has($from.node(d).type.name)) {
      return moveNodeAt(editor, $from.before(d), dir)
    }
  }
  return false
}
