import type { ReactNode } from 'react'

export type PanelTab = 'compile' | 'history' | 'comments'

interface RightPanelProps {
  tab: PanelTab
  onTabChange: (tab: PanelTab) => void
  onClose: () => void
  children: ReactNode
}

const TABS: Array<{ id: PanelTab; label: string }> = [
  { id: 'compile', label: '编译' },
  { id: 'history', label: '历史' },
  { id: 'comments', label: '批注' },
]

export function RightPanel({ tab, onTabChange, onClose, children }: RightPanelProps) {
  return (
    <aside className="right-panel">
      <div className="right-panel-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`panel-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="spacer" />
        <button type="button" className="icon-btn" title="关闭面板" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="right-panel-body">{children}</div>
    </aside>
  )
}
