import { useState } from 'react'
import type { ProjectSnapshot, SectionRole } from '@himcm/shared'
import type { SaveState } from '../hooks/useProject.ts'

const ROLE_BADGE: Record<SectionRole, string | null> = {
  summary: '摘要',
  body: null,
  appendix: '附录',
  references: '文献',
  'ai-report': 'AI',
}

interface SectionListProps {
  snapshot: ProjectSnapshot
  activeId: string | null
  saveStates: Record<string, SaveState>
  onSelect: (id: string) => void
  onCreate: (title: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}

export function SectionList({ snapshot, activeId, saveStates, onSelect, onCreate, onDelete, onMove }: SectionListProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  const submit = () => {
    const t = title.trim()
    if (t) onCreate(t)
    setTitle('')
    setAdding(false)
  }

  return (
    <nav className="section-list">
      <div className="section-list-header">
        <span>章节</span>
        <button type="button" className="icon-btn" title="新建章节" onClick={() => setAdding(true)}>
          ＋
        </button>
      </div>
      {adding && (
        <div className="section-add">
          <input
            autoFocus
            value={title}
            placeholder="章节标题"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') setAdding(false)
            }}
          />
          <button type="button" className="icon-btn" onClick={submit}>
            ✓
          </button>
        </div>
      )}
      <ul>
        {snapshot.sections.map((s) => {
          const badge = ROLE_BADGE[s.role]
          const state = saveStates[s.id]
          const movable = s.role === 'body'
          return (
            <li key={s.id} className={s.id === activeId ? 'active' : ''}>
              <button type="button" className="section-item" onClick={() => onSelect(s.id)}>
                <span className="section-title">
                  {state === 'dirty' || state === 'saving' ? <span className="dot" title="未保存" /> : null}
                  {state === 'error' ? <span className="dot error" title="保存失败" /> : null}
                  {s.title}
                </span>
                {badge && <span className="badge">{badge}</span>}
              </button>
              {s.id === activeId && movable && (
                <span className="section-actions">
                  <button type="button" className="icon-btn" title="上移" onClick={() => onMove(s.id, -1)}>
                    ↑
                  </button>
                  <button type="button" className="icon-btn" title="下移" onClick={() => onMove(s.id, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="删除章节"
                    onClick={() => {
                      if (window.confirm(`删除章节「${s.title}」？文件将被移除（git 历史中仍可找回）。`)) onDelete(s.id)
                    }}
                  >
                    🗑
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
