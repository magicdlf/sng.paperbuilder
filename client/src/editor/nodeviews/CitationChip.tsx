import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useNumbering } from '../NumberingContext.ts'

/** 文献引用 chip：按 references.json 顺序显示 [1] / [1,3]；缺失 key 红色警告 */
export function CitationChip({ node, selected }: NodeViewProps) {
  const numbering = useNumbering()
  const keys = node.attrs.keys as string[]
  const numbers = keys.map((k) => numbering?.refOrder[k] ?? null)
  const allFound = numbers.every((n) => n !== null)
  const text = allFound ? `[${numbers.join(',')}]` : `[@${keys.join('; @')}]`

  return (
    <NodeViewWrapper
      as="span"
      className={`ref-chip cite${allFound ? '' : ' missing'}${selected ? ' selected' : ''}`}
      title={keys.join(', ')}
    >
      {text}
    </NodeViewWrapper>
  )
}
