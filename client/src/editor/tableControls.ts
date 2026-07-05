// 表格 hover 浮动控制：↑↓ 移动 + 快捷键提示。
// 贴着表格本身出现（工具栏按钮发现性太差）。
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import { moveNodeAt } from './moveBlock.ts'

const key = new PluginKey('tableHoverControls')

function buildWidget(editor: Editor, pos: number): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'table-controls'
  wrap.contentEditable = 'false'
  const inner = document.createElement('div')
  inner.className = 'table-controls-inner'

  const mkBtn = (label: string, title: string, dir: -1 | 1) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.title = title
    b.addEventListener('mousedown', (e) => e.preventDefault())
    b.addEventListener('click', () => moveNodeAt(editor, pos, dir))
    return b
  }
  inner.append(mkBtn('↑', '上移表格（Alt+↑）', -1), mkBtn('↓', '下移表格（Alt+↓）', 1))

  const hint = document.createElement('span')
  hint.className = 'hint'
  hint.textContent = 'Alt+↑/↓ 移动 · 题注在工具栏「表⚙」'
  inner.append(hint)

  wrap.append(inner)
  return wrap
}

function buildDecorations(editor: Editor, doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true
    decos.push(Decoration.widget(pos, () => buildWidget(editor, pos), { side: -1 }))

    // 列对齐所见即所得：把 table.attrs.aligns 实时应用到各单元格
    const aligns = (node.attrs.aligns ?? null) as Array<'left' | 'center' | 'right'> | null
    if (aligns) {
      let rowPos = pos + 1
      node.forEach((row) => {
        let cellPos = rowPos + 1
        let col = 0
        row.forEach((cell) => {
          const align = aligns[col]
          if (align && align !== 'left') {
            decos.push(Decoration.node(cellPos, cellPos + cell.nodeSize, { style: `text-align:${align}` }))
          }
          cellPos += cell.nodeSize
          col++
        })
        rowPos += row.nodeSize
      })
    }
    return false
  })
  return DecorationSet.create(doc, decos)
}

export const TableHoverControls = Extension.create({
  name: 'tableHoverControls',

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key,
        state: {
          init: (_config, state) => buildDecorations(editor, state.doc),
          apply: (tr, old, _oldState, newState) =>
            tr.docChanged ? buildDecorations(editor, newState.doc) : old,
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})
