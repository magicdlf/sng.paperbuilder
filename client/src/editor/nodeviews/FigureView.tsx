import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { moveNodeAt } from '../moveBlock.ts'

/** 图节点视图：图片 + 选中时的宽度/label/移动控制条 + 可编辑题注 */
export function FigureView({ node, selected, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const width = (node.attrs.width as number | null) ?? 70
  const label = (node.attrs.label as string | null) ?? ''

  const move = (dir: -1 | 1) => {
    const pos = getPos()
    if (pos !== undefined) moveNodeAt(editor, pos, dir)
  }

  // figure 有可编辑题注（contentDOM），PM 默认把点击解析成"光标进题注"，
  // 永远不会产生 NodeSelection → 控制条不出现。这里显式选中整个节点。
  const selectSelf = () => {
    const pos = getPos()
    if (pos !== undefined) editor.commands.setNodeSelection(pos)
  }

  return (
    <NodeViewWrapper as="figure" className={`figure-view${selected ? ' selected' : ''}`} data-figure="">
      <img
        src={String(node.attrs.src)}
        alt=""
        style={{ width: `${width}%` }}
        draggable={false}
        data-drag-handle=""
        onClick={selectSelf}
      />
      {!selected && (
        <div className="figure-hover-hint" contentEditable={false}>
          点击图片：宽度 / 标号 / 移动（Alt+↑/↓）
        </div>
      )}
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
          <button type="button" className="icon-btn" title="上移（Alt+↑）" onClick={() => move(-1)}>
            ↑
          </button>
          <button type="button" className="icon-btn" title="下移（Alt+↓）" onClick={() => move(1)}>
            ↓
          </button>
          <button type="button" className="icon-btn danger" title="删除图" onClick={() => deleteNode()}>
            🗑
          </button>
        </div>
      )}
      <NodeViewContent as={'figcaption' as 'div'} className="figure-caption" data-placeholder="在此输入题注…" />
    </NodeViewWrapper>
  )
}
