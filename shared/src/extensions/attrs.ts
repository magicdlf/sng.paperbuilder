import { Extension } from '@tiptap/core'

/**
 * 为既有节点补充论文所需属性：
 * - heading.label   → `## Assumptions {#sec:assumptions}` → \label{sec:assumptions}
 * - blockMath.label → `$$ ... $$ {#eq:mass}` → \begin{equation}\label{eq:mass}
 */
export const PaperAttributes = Extension.create({
  name: 'paperAttributes',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          label: {
            default: null as string | null,
            parseHTML: (el) => el.dataset.label ?? null,
            renderHTML: (attrs) => (attrs.label ? { 'data-label': attrs.label } : {}),
          },
        },
      },
      {
        types: ['blockMath'],
        attributes: {
          label: {
            default: null as string | null,
            parseHTML: (el) => el.dataset.label ?? null,
            renderHTML: (attrs) => (attrs.label ? { 'data-label': attrs.label } : {}),
          },
        },
      },
    ]
  },
})
