import { useEffect, useRef, useState } from 'react'
import type { PaperListItem } from '@himcm/shared'
import { api } from '../api.ts'

/** 顶栏论文切换器：列表 / 新建 / 打开任意路径。切换后整页刷新，状态干净重来。 */
export function PaperSwitcher({ currentDir }: { currentDir: string }) {
  const [open, setOpen] = useState(false)
  const [papers, setPapers] = useState<PaperListItem[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const currentName = currentDir.split('/').filter(Boolean).pop() ?? currentDir

  useEffect(() => {
    if (!open) return
    void api
      .papers()
      .then((res) => setPapers(res.papers))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const switchTo = async (fn: () => Promise<{ dir: string }>) => {
    try {
      setError(null)
      await fn()
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="paper-switcher" ref={ref}>
      <button type="button" className="paper-switcher-btn" title={currentDir} onClick={() => setOpen(!open)}>
        📄 {currentName} <span className="caret">▾</span>
      </button>
      {open && (
        <div className="paper-switcher-menu">
          <div className="dropdown-title">论文列表</div>
          {error && <div className="dropdown-empty" style={{ color: 'var(--danger)' }}>{error}</div>}
          {papers.map((p) => (
            <button
              key={p.dir}
              type="button"
              className={`dropdown-item${p.current ? ' current' : ''}`}
              disabled={p.current}
              title={p.dir}
              onClick={() => void switchTo(() => api.openPaper(p.dir))}
            >
              <span>
                {p.current ? '✓ ' : ''}
                {p.name}
              </span>
              <code>
                {p.contest} {p.year || ''} · {p.problem}
              </code>
            </button>
          ))}
          <div className="dropdown-title">新建论文</div>
          <div className="paper-new-row">
            <input
              value={newName}
              placeholder="目录名，如 2026-problemB"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) void switchTo(() => api.createPaper(newName.trim()))
              }}
            />
            <button
              type="button"
              className="btn primary"
              disabled={!newName.trim()}
              onClick={() => void switchTo(() => api.createPaper(newName.trim()))}
            >
              创建
            </button>
          </div>
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              const dir = window.prompt('输入论文目录的绝对路径（不存在则创建）：')
              if (dir?.trim()) void switchTo(() => api.openPaper(dir.trim()))
            }}
          >
            <span>打开其它路径…</span>
          </button>
        </div>
      )}
    </div>
  )
}
