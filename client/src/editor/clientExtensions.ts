import { Extension, type AnyExtension, type Node as TiptapNode } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { paperExtensions } from '@himcm/shared'

import { FigureView } from './nodeviews/FigureView.tsx'
import { CrossRefChip } from './nodeviews/CrossRefChip.tsx'
import { CitationChip } from './nodeviews/CitationChip.tsx'
import { NumberingExtension } from './numberingPlugin.ts'
import { TableHoverControls } from './tableControls.ts'
import { moveBlock } from './moveBlock.ts'

export interface MathClickHandler {
  (info: { pos: number; latex: string; label: string | null; kind: 'inline' | 'block' }): void
}

/** v1 禁用合并单元格：任何来源（粘贴等）的 colspan/rowspan>1 一律归一 */
const MergeBlocker = Extension.create({
  name: 'mergeBlocker',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _oldState, state) {
          if (!transactions.some((tr) => tr.docChanged)) return null
          let tr: ReturnType<typeof state.tr.setNodeMarkup> | null = null
          state.doc.descendants((node, pos) => {
            if (
              (node.type.name === 'tableCell' || node.type.name === 'tableHeader') &&
              (node.attrs.colspan !== 1 || node.attrs.rowspan !== 1)
            ) {
              tr = (tr ?? state.tr).setNodeMarkup(pos, undefined, {
                ...node.attrs,
                colspan: 1,
                rowspan: 1,
              })
            }
          })
          return tr
        },
      }),
    ]
  },
})

/** Alt+↑/↓ 移动图/表（选区不在可移动块内时放行默认行为） */
const MoveBlockKeys = Extension.create({
  name: 'moveBlockKeys',
  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': ({ editor }) => moveBlock(editor, -1),
      'Alt-ArrowDown': ({ editor }) => moveBlock(editor, 1),
    }
  },
})

/** 在 shared 的 schema 上挂客户端行为（NodeView / 键位 / 点击回调） */
export function clientExtensions(onMathClick: MathClickHandler): AnyExtension[] {
  return [
    ...paperExtensions().map((ext): AnyExtension => {
      switch (ext.name) {
        case 'figure':
          return (ext as TiptapNode).extend({
            addNodeView() {
              return ReactNodeViewRenderer(FigureView)
            },
            addKeyboardShortcuts() {
              return {
                // 题注中回车 → 跳出图节点，在其后新建段落
                Enter: ({ editor }) => {
                  const { $from } = editor.state.selection
                  for (let d = $from.depth; d > 0; d--) {
                    if ($from.node(d).type.name === 'figure') {
                      const after = $from.after(d)
                      return editor
                        .chain()
                        .insertContentAt(after, { type: 'paragraph' })
                        .setTextSelection(after + 1)
                        .run()
                    }
                  }
                  return false
                },
              }
            },
          })
        case 'crossRef':
          return (ext as TiptapNode).extend({
            addNodeView() {
              return ReactNodeViewRenderer(CrossRefChip)
            },
          })
        case 'citation':
          return (ext as TiptapNode).extend({
            addNodeView() {
              return ReactNodeViewRenderer(CitationChip)
            },
          })
        case 'inlineMath':
          return (ext as TiptapNode).configure({
            onClick: (node: PMNode, pos: number) =>
              onMathClick({ pos, latex: String(node.attrs.latex), label: null, kind: 'inline' }),
          })
        case 'blockMath':
          return (ext as TiptapNode).configure({
            onClick: (node: PMNode, pos: number) =>
              onMathClick({
                pos,
                latex: String(node.attrs.latex),
                label: (node.attrs.label as string | null) ?? null,
                kind: 'block',
              }),
          })
        default:
          return ext
      }
    }),
    MergeBlocker,
    NumberingExtension,
    TableHoverControls,
    MoveBlockKeys,
  ]
}
