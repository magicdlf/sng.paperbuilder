import { useRef, useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { moveNodeAt } from '../moveBlock.ts'
import { useNumbering } from '../NumberingContext.ts'
import { api } from '../../api.ts'

/** 图节点视图：图片 + 选中时的工具集（移动/替换/删除 + 宽度/标号）+ 可编辑题注 */
export function FigureView({ node, selected, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const numbering = useNumbering()
  const attrWidth = (node.attrs.width as number | null) ?? 70
  // 拖动滑块期间只改本地值（图片实时预览），松手才提交事务——
  // 否则每格一个事务会重建 NodeView，拖拽断裂且 undo 被灌满
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const width = dragWidth ?? attrWidth
  const label = (node.attrs.label as string | null) ?? ''
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const commitWidth = () => {
    if (dragWidth !== null && dragWidth !== attrWidth) updateAttributes({ width: dragWidth })
    setDragWidth(null)
  }

  const move = (dir: -1 | 1) => {
    const pos = getPos()
    if (pos !== undefined) moveNodeAt(editor, pos, dir)
  }

  // figure 有可编辑题注（contentDOM），PM 默认把点击解析成"光标进题注"，
  // 永远不会产生 NodeSelection → 工具集不出现。这里显式选中整个节点。
  // focus 必须显式带上：img 的 mousedown 被 preventDefault，浏览器不会自动聚焦编辑器，
  // 否则选中后 ⌘X/⌘C/Backspace 都不生效。
  const selectSelf = () => {
    const pos = getPos()
    if (pos !== undefined) editor.chain().setNodeSelection(pos).focus().run()
  }

  const replaceImage = async (file: File) => {
    try {
      const { path } = await api.uploadAsset(file)
      updateAttributes({ src: `/${path}` })
    } catch (err) {
      window.alert(`替换失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const readOnly = !editor.isEditable

  return (
    <NodeViewWrapper as="figure" className={`figure-view${selected ? ' selected' : ''}`} data-figure="">
      <img
        src={String(node.attrs.src)}
        alt=""
        style={{ width: `${width}%` }}
        draggable={false}
        data-drag-handle=""
        onMouseDown={
          readOnly
            ? undefined
            : (e) => {
                // 抢在 PM 把光标放进题注之前选中整个节点
                e.preventDefault()
                selectSelf()
              }
        }
        onClick={readOnly ? undefined : selectSelf}
      />
      {!selected && !readOnly && (
        <div className="figure-hover-hint" contentEditable={false}>
          点击图片打开工具集
        </div>
      )}
      {selected && !readOnly && (
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
            {numbering && numbering.onMoveFigureToSection && (
              <select
                className="fig-btn fig-select"
                value=""
                title="把图搬到其它章节末尾（也可 ⌘X 剪切后到目标位置 ⌘V 粘贴）"
                onChange={(e) => {
                  const target = e.target.value
                  const pos = getPos()
                  if (target && pos !== undefined) numbering.onMoveFigureToSection!(pos, target)
                }}
              >
                <option value="" disabled>
                  移至章节…
                </option>
                {numbering.sections
                  .filter((s) => s.id !== numbering.sectionId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </select>
            )}
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
                onChange={(e) => setDragWidth(Number(e.target.value))}
                onPointerUp={commitWidth}
                onKeyUp={commitWidth}
                onBlur={commitWidth}
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
