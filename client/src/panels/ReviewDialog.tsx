import { useState } from 'react'
import { shortcut } from '../shortcuts.ts'

export interface ReviewDialogState {
  sectionId: string
  sectionTitle: string
  changedFiles: string[]
}

/** 送审确认框：描述改动 → 提交评审检查点；取消则状态不变、不产生提交 */
export function ReviewDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: ReviewDialogState
  onConfirm: (description: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-card">
        <h3>提交评审：《{state.sectionTitle}》</h3>
        <p className="dim">将创建一个评审检查点提交，队友可对照此版本 diff 与批注。</p>
        <div className="changed-files">
          <span className="dim">自上次提交以来的改动（{state.changedFiles.length} 个文件）：</span>
          <ul>
            {state.changedFiles.slice(0, 6).map((f) => (
              <li key={f}>
                <code>{f}</code>
              </li>
            ))}
            {state.changedFiles.length > 6 && <li className="dim">…以及另外 {state.changedFiles.length - 6} 个</li>}
          </ul>
        </div>
        <textarea
          autoFocus
          rows={3}
          placeholder="简述这次改了什么（会写进提交记录）…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onConfirm(text.trim())
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            取消（不送审）
          </button>
          <button type="button" className="btn primary" title={shortcut('Enter')} onClick={() => onConfirm(text.trim())}>
            提交并送审
          </button>
        </div>
      </div>
    </div>
  )
}
