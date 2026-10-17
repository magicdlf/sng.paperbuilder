import type { SectionContent, SectionStatus } from '@himcm/shared'

export const STATUS_META: Record<SectionStatus, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'st-draft' },
  review: { label: '待评审', cls: 'st-review' },
  done: { label: '已完成', cls: 'st-done' },
}

/** 顶栏身份选择：我是谁（localStorage，仅署名用，无鉴权） */
export function IdentityPicker({
  members,
  identity,
  onIdentityChange,
  onAddMember,
}: {
  members: string[]
  identity: string
  onIdentityChange: (name: string) => void
  onAddMember: (name: string) => void
}) {
  return (
    <select
      className="identity-picker"
      value={identity && members.includes(identity) ? identity : ''}
      title="我是谁：批注署名 / 提交记录前缀"
      onChange={(e) => {
        if (e.target.value === '__add__') {
          const name = window.prompt('添加成员（名字）：')?.trim()
          if (name) {
            onAddMember(name)
            onIdentityChange(name)
          }
          e.target.value = identity
          return
        }
        onIdentityChange(e.target.value)
      }}
    >
      <option value="">我是…</option>
      {members.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
      <option value="__add__">＋ 添加成员…</option>
    </select>
  )
}

/** 个人认领与进度；允许多人认领同一章节。 */
export function SectionBar({
  section,
  identity,
  onChangeMeta,
}: {
  section: SectionContent
  members: string[]
  identity: string
  onChangeMeta: (patch: { claimed?: boolean; status?: SectionStatus }) => void
}) {
  const owners = section.owners ?? (section.owner ? [section.owner] : [])
  const mine = section.contributions?.find(c => c.user === identity)
  const status = mine?.status ?? 'draft'
  const claimed = mine?.claimed ?? owners.includes(identity)

  return (
    <div className="section-bar">
      <span>认领：{owners.join('、') || '暂无'}</span>
      <button type="button" disabled={!identity} onClick={() => onChangeMeta({ claimed: !claimed })}>
        {claimed ? '取消我的认领' : '我来认领'}
      </button>
      <label>
        我的进度
        <select disabled={!identity} value={status} onChange={(e) => onChangeMeta({ status: e.target.value as SectionStatus })}>
          {(Object.keys(STATUS_META) as SectionStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </label>
      <span className={`status-chip ${STATUS_META[status].cls}`}>{STATUS_META[status].label}</span>
      {status === 'review' && <span className="section-bar-hint">评审中：欢迎用 💬 添加批注</span>}
      {!identity && <span className="section-bar-hint">先在顶栏选择“我是谁”</span>}
      {section.contributions?.filter(c => c.claimed && c.user !== identity).map(c => (
        <span key={c.user} className="section-bar-hint">{c.user}：{STATUS_META[c.status ?? 'draft'].label}</span>
      ))}
    </div>
  )
}
