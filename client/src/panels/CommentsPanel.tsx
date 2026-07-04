import { useState } from 'react'
import type { CommentsFile, CommentThread } from '@himcm/shared'
import type { CommentAnchor } from '../comments.ts'

interface CommentsPanelProps {
  comments: CommentsFile
  /** 实时锚点（来自文档解析）；不存在的 id 即孤儿 */
  anchors: Record<string, CommentAnchor>
  sectionTitle: (id: string) => string
  /** 当前编辑器是否有非空选区（决定「重新挂靠」可用性） */
  hasSelection: boolean
  onJump: (sectionId: string) => void
  onReply: (threadId: string, text: string) => void
  onToggleResolve: (threadId: string) => void
  onDelete: (threadId: string) => void
  onReattach: (threadId: string) => void
}

function ThreadCard({
  thread,
  anchor,
  props,
}: {
  thread: CommentThread
  anchor: CommentAnchor | undefined
  props: CommentsPanelProps
}) {
  const [reply, setReply] = useState('')
  const orphan = !anchor
  const anchorText = anchor?.text || thread.anchorText

  return (
    <li className={`comment-card${thread.status === 'resolved' ? ' resolved' : ''}${orphan ? ' orphan' : ''}`}>
      <div className="comment-anchor">
        {anchor ? (
          <button type="button" className="link-btn" onClick={() => props.onJump(anchor.sectionId)}>
            {props.sectionTitle(anchor.sectionId)}
          </button>
        ) : (
          <span className="orphan-tag">⚠ 锚点文本已被删除</span>
        )}
        <blockquote>{anchorText.slice(0, 120) || '（空）'}</blockquote>
      </div>
      <ul className="comment-thread">
        {thread.thread.map((msg) => (
          <li key={msg.id}>
            <span className="msg-time">
              {new Date(msg.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <p>{msg.text}</p>
          </li>
        ))}
      </ul>
      {thread.status === 'open' && (
        <div className="comment-reply">
          <input
            value={reply}
            placeholder="回复…"
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && reply.trim()) {
                props.onReply(thread.id, reply.trim())
                setReply('')
              }
            }}
          />
        </div>
      )}
      <div className="comment-actions">
        {orphan && (
          <button
            type="button"
            className="link-btn"
            disabled={!props.hasSelection}
            title={props.hasSelection ? '把批注挂到当前选中文本' : '先在编辑器中选中一段文本'}
            onClick={() => props.onReattach(thread.id)}
          >
            挂到所选
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="link-btn" onClick={() => props.onToggleResolve(thread.id)}>
          {thread.status === 'open' ? '解决' : '重新打开'}
        </button>
        <button
          type="button"
          className="link-btn danger"
          onClick={() => {
            if (window.confirm('删除该批注线程？')) props.onDelete(thread.id)
          }}
        >
          删除
        </button>
      </div>
    </li>
  )
}

export function CommentsPanel(props: CommentsPanelProps) {
  const { comments, anchors } = props
  const open = comments.comments.filter((c) => c.status === 'open')
  const resolved = comments.comments.filter((c) => c.status === 'resolved')
  const [showResolved, setShowResolved] = useState(false)

  return (
    <div className="comments-panel">
      {open.length === 0 && resolved.length === 0 && (
        <div className="dropdown-empty" style={{ padding: 16 }}>
          选中正文文字后点工具栏 💬 添加批注
        </div>
      )}
      <ul className="comment-list">
        {open.map((t) => (
          <ThreadCard key={t.id} thread={t} anchor={anchors[t.id]} props={props} />
        ))}
      </ul>
      {resolved.length > 0 && (
        <>
          <button type="button" className="link-btn" style={{ margin: '4px 12px' }} onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? '收起' : '展开'}已解决（{resolved.length}）
          </button>
          {showResolved && (
            <ul className="comment-list">
              {resolved.map((t) => (
                <ThreadCard key={t.id} thread={t} anchor={anchors[t.id]} props={props} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
