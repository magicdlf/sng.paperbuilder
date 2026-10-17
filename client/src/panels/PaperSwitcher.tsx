import { useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'
import { paperDirectories, rememberPaperDirectory, forgetPaperDirectory } from '../paperDirectories.ts'

/** Paths belong to this browser, not to a paper's manifest or a server scan. */
export function PaperSwitcher({ currentDir }: { currentDir: string }) {
  const [open, setOpen] = useState(!currentDir)
  const [dirs, setDirs] = useState(paperDirectories)
  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentDir) {
      if (!rememberPaperDirectory(currentDir)) setError('浏览器无法保存目录，请检查 localStorage 设置')
      setDirs(paperDirectories())
    }
  }, [currentDir])

  useEffect(() => {
    if (!open) return
    setDirs(paperDirectories())
    const onDown = (e: MouseEvent) => {
      if (currentDir && ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, currentDir])

  const select = async (dir: string, create = false) => {
    if (busy || !dir.trim()) return
    setBusy(true)
    setError(null)
    try {
      const result = await (create ? api.createPaper(dir.trim()) : api.openPaper(dir.trim()))
      if (!rememberPaperDirectory(result.dir)) {
        setError('论文已打开，但浏览器未能记住路径。请允许 localStorage 后重试。')
        setBusy(false)
        return
      }
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const forget = (dir: string) => {
    try { forgetPaperDirectory(dir); setDirs(paperDirectories()) }
    catch { setError('浏览器无法更新目录列表') }
  }

  const name = (dir: string) => dir.split(/[/\\]/).filter(Boolean).pop() ?? dir
  const listed = [...new Set([...(currentDir ? [currentDir] : []), ...dirs])]

  return (
    <div className="paper-switcher" ref={ref}>
      <button type="button" className="paper-switcher-btn" title={currentDir} onClick={() => setOpen(!open)}>
        📄 {currentDir ? name(currentDir) : '选择论文目录'} <span className="caret">▾</span>
      </button>
      {open && (
        <div className="paper-switcher-menu">
          <div className="dropdown-title">已添加目录（保存在当前浏览器）</div>
          {error && <div className="dropdown-empty" role="alert" style={{ color: 'var(--danger)' }}>{error}</div>}
          {listed.map(dir => (
            <div key={dir} style={{ display: 'flex', alignItems: 'center' }}>
              <button type="button" className={'dropdown-item' + (dir === currentDir ? ' current' : '')}
                style={{ flex: 1, minWidth: 0 }} disabled={busy || dir === currentDir} title={dir} onClick={() => void select(dir)}>
                <span>{dir === currentDir ? '✓ ' : ''}{name(dir)}</span>
              </button>
              <button type="button" className="btn" disabled={busy || dir === currentDir}
                title="从列表移除，不删除磁盘文件" onClick={() => forget(dir)}>移除</button>
            </div>
          ))}
          <div className="dropdown-title">添加或新建论文目录</div>
          <div className="paper-new-row">
            <input value={path} placeholder="已克隆 Git 目录或新目录的绝对路径"
              aria-label="论文目录绝对路径" onChange={e => setPath(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void select(path) }} />
          </div>
          <div className="paper-new-row">
            <button type="button" className="btn primary" disabled={busy || !path.trim()} onClick={() => void select(path)}>打开已有目录</button>
            <button type="button" className="btn" disabled={busy || !path.trim()} onClick={() => void select(path, true)}>新建本地论文</button>
          </div>
          <div className="dropdown-empty">Git 仓库请先克隆，再填本地路径。新建会复制模板并初始化 Git，不自动上传。目录丢失时请移除或重新定位。</div>
        </div>
      )}
    </div>
  )
}
