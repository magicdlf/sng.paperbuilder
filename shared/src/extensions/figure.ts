import { Node, mergeAttributes } from '@tiptap/core'

export interface InsertFigureOptions {
  src: string
  caption?: string
  label?: string | null
  width?: number | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      insertFigure: (options: InsertFigureOptions) => ReturnType
    }
  }
}

/**
 * 图节点：src/width/label 为属性，节点内容即题注（inline*）。
 * Markdown 形式：![题注](assets/x.png){#fig:label width=70%}
 */
export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'inline*',
  isolating: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      /** 宽度百分比（相对 \linewidth），null 表示默认 70 */
      width: { default: null as number | null },
      label: { default: null as string | null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        contentElement: 'figcaption',
        getAttrs: (el) => {
          const img = (el as HTMLElement).querySelector('img')
          if (!img) return false
          return {
            src: img.getAttribute('src') ?? '',
            width: el instanceof HTMLElement && el.dataset.width ? Number(el.dataset.width) : null,
            label: el instanceof HTMLElement ? (el.dataset.label ?? null) : null,
          }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = node.attrs.width as number | null
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-label': node.attrs.label ?? undefined,
        'data-width': width ?? undefined,
      }),
      ['img', { src: node.attrs.src, alt: '', style: width ? `width:${width}%` : undefined }],
      ['figcaption', {}, 0],
    ]
  },

  addCommands() {
    return {
      insertFigure:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src: options.src, width: options.width ?? null, label: options.label ?? null },
            content: options.caption ? [{ type: 'text', text: options.caption }] : [],
          })
        },
    }
  },
})
