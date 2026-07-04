import { Mark } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType
      unsetComment: (commentId: string) => ReturnType
    }
  }
}

/**
 * 批注标记：随文本移动/分裂/合并；线程内容存于 comments.json。
 * Markdown 形式：<span data-comment-id="c_xxx">被批注文本</span>
 * LaTeX 导出默认剥离（draft 模式输出 todonotes）。
 */
export const CommentMark = Mark.create({
  name: 'comment',
  // 光标在批注边缘输入时不延展批注范围
  inclusive: false,
  keepOnSplit: true,

  addAttributes() {
    return {
      commentId: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
        getAttrs: (el) => ({ commentId: (el as HTMLElement).getAttribute('data-comment-id') ?? '' }),
      },
    ]
  },

  renderHTML({ mark }) {
    return ['span', { 'data-comment-id': mark.attrs.commentId }, 0]
  },

  addCommands() {
    return {
      setComment:
        (commentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      unsetComment:
        (commentId) =>
        ({ tr, state, dispatch }) => {
          // 只移除指定 id 的批注标记（同类型不同 id 的保留）
          const markType = state.schema.marks[this.name]
          if (!markType) return false
          let changed = false
          state.doc.descendants((node, pos) => {
            if (!node.isText) return
            for (const m of node.marks) {
              if (m.type === markType && m.attrs.commentId === commentId) {
                tr.removeMark(pos, pos + node.nodeSize, m)
                changed = true
              }
            }
          })
          if (changed && dispatch) dispatch(tr)
          return changed
        },
    }
  },
})
