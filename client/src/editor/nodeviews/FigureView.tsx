import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

/** 图节点视图：图片 + 选中时的宽度/label 控制条 + 可编辑题注 */
export function FigureView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const width = (node.attrs.width as number | null) ?? 70
  const label = (node.attrs.label as string | null) ?? ''

  return (
    <NodeViewWrapper as="figure" className={`figure-view${selected ? ' selected' : ''}`} data-figure="">
      <img src={String(node.attrs.src)} alt="" style={{ width: `${width}%` }} draggable={false} data-drag-handle="" />
      {selected && (
        <div className="figure-controls" contentEditable={false}>
          <label>
            宽度
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={width}
              onChange={(e) => updateAttributes({ width: Number(e.target.value) })}
            />
            <span className="mono">{width}%</span>
          </label>
          <label>
            标号
            <input
              className="label-input mono"
              placeholder="fig:name"
              value={label}
              onChange={(e) => updateAttributes({ label: e.target.value.trim() || null })}
            />
          </label>
          <button type="button" className="icon-btn danger" title="删除图" onClick={() => deleteNode()}>
            🗑
          </button>
        </div>
      )}
      <NodeViewContent as={'figcaption' as 'div'} className="figure-caption" data-placeholder="在此输入题注…" />
    </NodeViewWrapper>
  )
}
