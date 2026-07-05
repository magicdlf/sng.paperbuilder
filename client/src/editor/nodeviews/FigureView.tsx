import { useRef } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { moveNodeAt } from '../moveBlock.ts'
import { api } from '../../api.ts'

/** 图节点视图：图片 + 选中时的工具集（移动/替换/删除 + 宽度/标号）+ 可编辑题注 */
export function FigureView({ node, selected, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const width = (node.attrs.width as number | null) ?? 70
  const label = (node.attrs.label as string | null) ?? ''
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const move = (dir: -1 | 1) => {
    const pos = getPos()
    if (pos !== undefined) moveNodeAt(editor, pos, dir)
  }

  // figure 有可编辑题注（contentDOM），PM 默认把点击解析成"光标进题注"，
  // 永远不会产生 NodeSelection → 工具集不出现。这里显式选中整个节点。
  const selectSelf = () => {
    const pos = getPos()
    if (pos !== undefined) editor.commands.setNodeSelection(pos)
  }

  const replaceImage = async (file: File) => {
    try {
      const { path } = await api.uploadAsset(file)
      updateAttributes({ src: `/${path}` })
    } catch (err) {
      window.alert(`替换失败：${err instanceof Error ? err.message : String(err)}`)
    }
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
          点击图片打开工具集
        </div>
      )}
      {selected && (
        <div className="figure-controls" contentEditable={false}>
          <div className="figure-controls-row buttons">
            <button type="button" className="fig-btn" title="Alt+↑" onClick={() => move(-1)}>
              ↑ 上移
            </button>
            <button type="button" className="fig-btn" title="Alt+↓" onClick={() => move(1)}>
              ↓ 下移
            </button>
            <button
              type="button"
              className="fig-btn"
              title="换一张图（保留题注/标号/宽度）"
              onClick={() => replaceInputRef.current?.click()}
            >
              ⇄ 替换
            </button>
            <button
              type="button"
              className="fig-btn danger"
              title="删除整个图（选中后按 Backspace 也可）"
              onClick={() => deleteNode()}
            >
              🗑 删除
            </button>
          </div>
          <div className="figure-controls-row">
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
          </div>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void replaceImage(file)
              e.target.value = ''
            }}
          />
        </div>
      )}
      <NodeViewContent as={'figcaption' as 'div'} className="figure-caption" data-placeholder="在此输入题注…" />
    </NodeViewWrapper>
  )
}
