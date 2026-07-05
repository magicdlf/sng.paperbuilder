import { useCallback, useEffect, useState } from 'react'
import type { GitLogEntry, GitStatusResult } from '@himcm/shared'
import { api } from '../api.ts'
import { DiffView } from './DiffView.tsx'

/** git 空树哈希：根提交没有父提交时与之对比 */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

interface HistoryPanelProps {
  /** 当前章节（限定 diff / 恢复范围）；null = 全项目 */
  activeSection: { id: string; file: string; title: string } | null
  /** 当前身份：提交说明自动加 [名字] 前缀 */
  identity: string
  /** 浏览模式（detached）下隐藏提交/恢复入口 */
  readOnly: boolean
  /** 当前浏览中的提交哈希（高亮标记） */
  browsingHash: string | null
  /** 切换到某提交浏览 */
  onBrowse: (rev: string) => void
  /** 恢复前调用：丢弃该章节尚未落盘的编辑 */
  beforeRestore: (sectionId: string) => void
  onRestored: () => void
}

export function HistoryPanel({
  activeSection,
  identity,
  readOnly,
  browsingHash,
  onBrowse,
  beforeRestore,
  onRestored,
}: HistoryPanelProps) {
  const [status, setStatus] = useState<GitStatusResult | null>(null)
  const [entries, setEntries] = useState<GitLogEntry[]>([])
  const [message, setMessage] = useState('')
  const [scope, setScope] = useState<'project' | 'section'>('project')
  const [openDiff, setOpenDiff] = useState<{ key: string; diff: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const file = scope === 'section' && activeSection ? activeSection.file : undefined

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const [st, log] = await Promise.all([api.gitStatus(), api.gitLog(file)])
      setStatus(st)
      setEntries(log.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [file])

  useEffect(() => {
    void refresh()
    setOpenDiff(null)
  }, [refresh])

  const commit = async () => {
    const msg = message.trim()
    if (!msg || busy) return
    setBusy(true)
    try {
      setError(null)
      const res = await api.gitCommit(identity ? `[${identity}] ${msg}` : msg)
      if (!res.committed) setError('没有需要提交的更改')
      else setMessage('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleDiff = async (key: string, from?: string, to?: string) => {
    if (openDiff?.key === key) {
      setOpenDiff(null)
      return
    }
    try {
      setError(null)
      const res = await api.gitDiff({ from, to, file })
      setOpenDiff({ key, diff: res.diff })
    } catch {
      // 根提交没有父提交 → 与空树对比
      if (from?.endsWith('~1')) {
        try {
          const res = await api.gitDiff({ from: EMPTY_TREE, to, file })
          setOpenDiff({ key, diff: res.diff })
          return
        } catch (err2) {
          setError(err2 instanceof Error ? err2.message : String(err2))
          return
        }
      }
      setError('无法获取差异')
    }
  }

  const restore = async (entry: GitLogEntry) => {
    if (!activeSection) return
    if (
      !window.confirm(
        `将「${activeSection.title}」恢复到 ${entry.hash.slice(0, 7)}（${entry.message}）的版本？\n当前未提交的修改会被覆盖（可先提交一次以防丢失）。`
      )
    ) {
      return
    }
    try {
      setError(null)
      beforeRestore(activeSection.id)
      await api.gitRestore(entry.hash, activeSection.file)
      onRestored()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const dirtyCount = status?.changedFiles.length ?? 0

  return (
    <div className="history-panel">
      {!readOnly && (
        <div className="commit-box">
          <textarea
            rows={2}
            placeholder={dirtyCount > 0 ? `提交说明（${dirtyCount} 个文件有更改）…` : '工作区干净'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void commit()
            }}
          />
          <div className="commit-actions">
            {dirtyCount > 0 && (
              <button type="button" className="link-btn" onClick={() => void toggleDiff('worktree')}>
                {openDiff?.key === 'worktree' ? '收起未提交更改' : '查看未提交更改'}
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn primary" disabled={busy || !message.trim() || dirtyCount === 0} onClick={() => void commit()}>
              提交
            </button>
          </div>
          {openDiff?.key === 'worktree' && <DiffView diff={openDiff.diff} />}
        </div>
      )}

      {error && <div className="compile-error-box">{error}</div>}

      <div className="history-scope">
        <button
          type="button"
          className={`panel-tab${scope === 'project' ? ' active' : ''}`}
          onClick={() => setScope('project')}
        >
          全项目
        </button>
        <button
          type="button"
          className={`panel-tab${scope === 'section' ? ' active' : ''}`}
          disabled={!activeSection}
          onClick={() => setScope('section')}
        >
          当前章节{activeSection ? `：${activeSection.title}` : ''}
        </button>
      </div>

      <ul className="commit-list">
        {entries.map((entry) => {
          const isBrowsing = browsingHash === entry.hash
          return (
            <li key={entry.hash} className={isBrowsing ? 'browsing' : ''}>
              <div className="commit-row">
                <button
                  type="button"
                  className="commit-main"
                  title="查看此提交的改动"
                  onClick={() => void toggleDiff(entry.hash, `${entry.hash}~1`, entry.hash)}
                >
                  <span className="commit-msg">
                    {isBrowsing && '👁 '}
                    {entry.message}
                  </span>
                  <span className="commit-meta">
                    <code>{entry.hash.slice(0, 7)}</code> · {entry.author} ·{' '}
                    {new Date(entry.date).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="切换到此版本浏览（只读，可随时回到最新）"
                  onClick={() => onBrowse(entry.hash)}
                >
                  👁
                </button>
                {activeSection && !readOnly && (
                  <button
                    type="button"
                    className="icon-btn"
                    title={`恢复「${activeSection.title}」到此版本`}
                    onClick={() => void restore(entry)}
                  >
                    ⤺
                  </button>
                )}
              </div>
              {openDiff?.key === entry.hash && <DiffView diff={openDiff.diff} />}
            </li>
          )
        })}
        {entries.length === 0 && <li className="dim" style={{ padding: 12 }}>暂无提交</li>}
      </ul>
    </div>
  )
}
