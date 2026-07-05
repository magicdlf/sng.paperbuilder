import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GitLogEntry, GitStatusResult } from '@himcm/shared'
import { api } from '../api.ts'
import { DiffView } from './DiffView.tsx'
import { classifyCommit, layoutGraph, restoreTargetOf, type GraphRow } from './gitGraph.ts'

const LANE_W = 14
const KIND_COLOR: Record<string, string> = {
  review: '#b3730a',
  restore: '#4a6b96',
  init: '#8f8878',
  normal: '#a99ee0',
}

/** 单行轨道格：上下半区连线 + 圆点（viewBox 高 100，随行高拉伸） */
function GraphCell({ row, kind }: { row: GraphRow; kind: string }) {
  const width = row.laneCount * LANE_W + 4
  const x = (lane: number) => lane * LANE_W + LANE_W / 2 + 2
  return (
    <svg
      className="graph-cell"
      width={width}
      viewBox={`0 0 ${width} 100`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {row.top.map((e, i) => (
        <line key={`t${i}`} x1={x(e.from)} y1={0} x2={x(e.to)} y2={50} />
      ))}
      {row.bottom.map((e, i) => (
        <line key={`b${i}`} x1={x(e.from)} y1={50} x2={x(e.to)} y2={100} />
      ))}
      <circle cx={x(row.dotLane)} cy={50} r={4.5} fill={KIND_COLOR[kind] ?? KIND_COLOR.normal} />
    </svg>
  )
}

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
  // 轨道图只在全项目视图有意义（按文件过滤后父子关系断裂）
  const graphRows = useMemo(() => (scope === 'project' ? layoutGraph(entries) : null), [scope, entries])

  const jumpToCommit = (shortHash: string) => {
    const target = entries.find((e) => e.hash.startsWith(shortHash))
    if (!target) return
    const el = document.getElementById(`commit-${target.hash}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.classList.add('flash')
    setTimeout(() => el?.classList.remove('flash'), 1200)
  }

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

      {graphRows && entries.length > 0 && (
        <div className="graph-legend dim">
          <span>
            <i style={{ background: KIND_COLOR.review }} /> 送审
          </span>
          <span>
            <i style={{ background: KIND_COLOR.restore }} /> 还原
          </span>
          <span>
            <i style={{ background: KIND_COLOR.normal }} /> 提交
          </span>
        </div>
      )}
      <ul className="commit-list">
        {entries.map((entry, index) => {
          const isBrowsing = browsingHash === entry.hash
          const kind = classifyCommit(entry.message)
          const restoreTarget = kind === 'restore' ? restoreTargetOf(entry.message) : null
          const isHead = entry.refs.includes('HEAD')
          return (
            <li key={entry.hash} id={`commit-${entry.hash}`} className={isBrowsing ? 'browsing' : ''}>
              <div className="commit-row">
                {graphRows && graphRows[index] && <GraphCell row={graphRows[index]!} kind={kind} />}
                <button
                  type="button"
                  className="commit-main"
                  title="查看此提交的改动"
                  onClick={() => void toggleDiff(entry.hash, `${entry.hash}~1`, entry.hash)}
                >
                  <span className="commit-msg">
                    {isBrowsing && '👁 '}
                    {entry.message}
                    {isHead && !isBrowsing && <span className="head-tag">最新</span>}
                  </span>
                  <span className="commit-meta">
                    <code>{entry.hash.slice(0, 7)}</code> · {entry.author} ·{' '}
                    {new Date(entry.date).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {restoreTarget && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="link-btn"
                          title="跳到还原来源提交"
                          onClick={(e) => {
                            e.stopPropagation()
                            jumpToCommit(restoreTarget)
                          }}
                        >
                          ↩ {restoreTarget.slice(0, 7)}
                        </button>
                      </>
                    )}
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
