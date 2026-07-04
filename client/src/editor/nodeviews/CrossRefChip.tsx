import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { crossRefDisplay } from '@himcm/shared'
import { useNumbering } from '../NumberingContext.ts'

/** 交叉引用 chip：显示解析后的 "Figure 3" 等；目标缺失显示红色警告 */
export function CrossRefChip({ node, selected }: NodeViewProps) {
  const numbering = useNumbering()
  const target = String(node.attrs.target)
  const entry = numbering?.labelIndex.byLabel[target]
  const text = numbering ? crossRefDisplay(target, numbering.labelIndex) : target

  return (
    <NodeViewWrapper as="span" className={`ref-chip${entry ? '' : ' missing'}${selected ? ' selected' : ''}`}>
      {entry ? text : `?${target}`}
    </NodeViewWrapper>
  )
}
