import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { findParentNodeClosestToPos } from '@tiptap/core'
import { crossRefDisplay, type ColumnAlign } from '@himcm/shared'
import { useNumbering } from './NumberingContext.ts'

/** 点击外部关闭的下拉容器 */
export function Dropdown({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])
  return (
    <div ref={ref} className="dropdown">
      {children}
    </div>
  )
}

/** 交叉引用 + 文献引用选择器 */
export function RefPicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const numbering = useNumbering()
  const labels = numbering ? Object.values(numbering.labelIndex.byLabel) : []
  const refs = numbering?.references ?? []

  return (
    <Dropdown onClose={onClose}>
      <div className="dropdown-title">交叉引用</div>
      {labels.length === 0 && <div className="dropdown-empty">先给图/表/公式/标题设置标号</div>}
      {labels.map((entry) => (
        <button
          key={entry.label}
          type="button"
          className="dropdown-item"
          onClick={() => {
            editor.chain().focus().insertCrossRef(entry.label).run()
            onClose()
          }}
        >
          <span>{numbering ? crossRefDisplay(entry.label, numbering.labelIndex) : entry.label}</span>
          <code>{entry.label}</code>
        </button>
      ))}
      <div className="dropdown-title">参考文献</div>
      {refs.length === 0 && <div className="dropdown-empty">在「参考文献」章节添加条目</div>}
      {refs.map((ref, i) => (
        <button
          key={ref.key}
          type="button"
          className="dropdown-item"
          onClick={() => {
            editor.chain().focus().insertCitation([ref.key]).run()
            onClose()
          }}
        >
          <span>
            [{i + 1}] {ref.title.slice(0, 40)}
            {ref.title.length > 40 ? '…' : ''}
          </span>
          <code>{ref.key}</code>
        </button>
      ))}
    </Dropdown>
  )
}

/** 表格设置：题注 / 标号 / 列对齐 / 行列增删 */
export function TableSettings({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const table = findParentNodeClosestToPos(editor.state.selection.$from, (n) => n.type.name === 'table')
  const [caption, setCaption] = useState(table ? String(table.node.attrs.caption ?? '') : '')
  const [label, setLabel] = useState(table ? String(table.node.attrs.label ?? '') : '')

  if (!table) return null
  const colCount = table.node.firstChild?.childCount ?? 0
  const aligns = (table.node.attrs.aligns as ColumnAlign[] | null) ?? Array<ColumnAlign>(colCount).fill('left')

  const apply = (attrs: Record<string, unknown>) => {
    editor.chain().focus().updateAttributes('table', attrs).run()
  }

  return (
    <Dropdown onClose={onClose}>
      <div className="dropdown-title">表格设置</div>
      <div className="dropdown-form">
        <label>
          题注
          <input
            value={caption}
            placeholder="Model parameters"
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => apply({ caption })}
          />
        </label>
        <label>
          标号
          <input
            className="mono"
            value={label}
            placeholder="tbl:name"
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => apply({ label: label.trim() || null })}
          />
        </label>
        <div className="align-row">
          {Array.from({ length: colCount }, (_, i) => (
            <select
              key={i}
              value={aligns[i] ?? 'left'}
              title={`第 ${i + 1} 列对齐`}
              onChange={(e) => {
                const next = [...aligns]
                while (next.length < colCount) next.push('left')
                next[i] = e.target.value as ColumnAlign
                apply({ aligns: next })
              }}
            >
              <option value="left">左</option>
              <option value="center">中</option>
              <option value="right">右</option>
            </select>
          ))}
        </div>
        <div className="table-ops">
          <button type="button" className="btn" onClick={() => editor.chain().focus().addRowAfter().run()}>
            +行
          </button>
          <button type="button" className="btn" onClick={() => editor.chain().focus().deleteRow().run()}>
            −行
          </button>
          <button type="button" className="btn" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            +列
          </button>
          <button type="button" className="btn" onClick={() => editor.chain().focus().deleteColumn().run()}>
            −列
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              editor.chain().focus().deleteTable().run()
              onClose()
            }}
          >
            删表
          </button>
        </div>
      </div>
    </Dropdown>
  )
}
