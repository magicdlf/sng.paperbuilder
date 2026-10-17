// 实时编号（与 LaTeX 计数规则一致）：
// - figure：题注前缀 "Figure N: "（widget decoration）
// - table：表下方题注行 "Table N: caption"（widget）
// - 带 label 的 blockMath：右侧 "(N)" 标签（widget）
// 起始计数来自 LabelIndex.sectionStart[当前章节]，随文档变化每事务重建。
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { SectionCounters } from '@himcm/shared'

export interface NumberingStorage {
  counters: SectionCounters | null
  /** open 批注 id；null = 尚未加载（不画高亮） */
  openCommentIds: Set<string> | null
}

declare module '@tiptap/core' {
  interface Storage {
    himcmNumbering: NumberingStorage
  }
}

const key = new PluginKey('himcmNumbering')

function widget(className: string, text: string, title?: string): HTMLElement {
  const el = document.createElement('span')
  el.className = className
  el.textContent = text
  if (title) el.title = title
  return el
}

export function buildDecorations(
  doc: PMNode,
  counters: SectionCounters | null,
  openCommentIds: Set<string> | null
): DecorationSet {
  if (!counters) return DecorationSet.empty
  const decos: Decoration[] = []
  let fig = counters.fig
  let tbl = counters.tbl
  let eq = counters.eq

  doc.descendants((node, pos) => {
    // 批注高亮只画在 open 线程的锚点上（resolved/已删除线程的锚点不显示）
    if (node.isText && openCommentIds) {
      for (const mark of node.marks) {
        if (mark.type.name === 'comment' && openCommentIds.has(String(mark.attrs.commentId))) {
          decos.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'comment-open' }))
          break
        }
      }
    }
    switch (node.type.name) {
      case 'figure': {
        fig++
        const number = fig
        // 题注开头插入 "Figure N: "
        decos.push(
          Decoration.widget(pos + 1, () => widget('num-prefix', `Figure ${number}: `), { side: -1 })
        )
        return false
      }
      case 'table': {
        tbl++
        const number = tbl
        const caption = String(node.attrs.caption ?? '')
        const label = node.attrs.label as string | null
        // 题注在表下方（用户偏好，与 PDF 输出一致）；标号只在悬停提示里显示
        decos.push(
          Decoration.widget(pos + node.nodeSize, () =>
            widget(
              'table-caption-line',
              `Table ${number}: ${caption || '（点击工具栏「表格设置」添加题注）'}`,
              label ? `标号 ${label}（交叉引用用 [@${label}]）` : undefined
            )
          )
        )
        return true
      }
      case 'blockMath': {
        if (node.attrs.label) {
          eq++
          const number = eq
          const label = String(node.attrs.label)
          decos.push(
            Decoration.widget(pos + node.nodeSize, () =>
              widget('eq-number', `(${number})`, `标号 ${label}（交叉引用用 [@${label}]）`)
            )
          )
        }
        return false
      }
      default:
        return true
    }
  })
  return DecorationSet.create(doc, decos)
}

export const NumberingExtension = Extension.create<Record<string, never>, NumberingStorage>({
  name: 'himcmNumbering',

  addStorage() {
    return { counters: null, openCommentIds: null }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin({
        key,
        state: {
          init: (_config, state) => buildDecorations(state.doc, storage.counters, storage.openCommentIds),
          apply: (tr, old, _oldState, newState) => {
            // 文档变化或外部触发（空事务）时重建；小文档全量重建成本可忽略
            if (!tr.docChanged && !tr.getMeta('himcmNumbering')) return old
            return buildDecorations(newState.doc, storage.counters, storage.openCommentIds)
          },
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
