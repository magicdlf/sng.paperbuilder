import { Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    crossRef: {
      insertCrossRef: (target: string) => ReturnType
    }
  }
}

/**
 * 交叉引用（行内原子节点）：target 形如 fig:plot / tbl:results / eq:mass / sec:intro。
 * Markdown 形式：[@fig:plot]。LaTeX 导出为 \Cref{fig:plot}。
 */
export const CrossRef = Node.create({
  name: 'crossRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      target: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-crossref]',
        getAttrs: (el) => ({ target: (el as HTMLElement).getAttribute('data-crossref') ?? '' }),
      },
    ]
  },

  renderHTML({ node }) {
    return ['span', { 'data-crossref': node.attrs.target }, `[@${node.attrs.target}]`]
  },

  renderText({ node }) {
    return `[@${node.attrs.target}]`
  },

  addCommands() {
    return {
      insertCrossRef:
        (target) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { target } }),
    }
  },
})
