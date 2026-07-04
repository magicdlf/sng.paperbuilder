import { Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (keys: string[]) => ReturnType
    }
  }
}

/**
 * 参考文献引用（行内原子节点）：keys 为 references.json 中的键。
 * Markdown 形式：[@smith2020] 或 [@a; @b]。LaTeX 导出为 \cite{a,b}。
 */
export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      keys: { default: [] as string[] },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-cite]',
        getAttrs: (el) => ({
          keys: ((el as HTMLElement).getAttribute('data-cite') ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      },
    ]
  },

  renderHTML({ node }) {
    const keys = node.attrs.keys as string[]
    return ['span', { 'data-cite': keys.join(',') }, `[@${keys.join('; @')}]`]
  },

  renderText({ node }) {
    const keys = node.attrs.keys as string[]
    return `[@${keys.join('; @')}]`
  },

  addCommands() {
    return {
      insertCitation:
        (keys) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { keys } }),
    }
  },
})
