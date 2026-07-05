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

/** 编辑器上方的章节分工条：负责人 + 状态 + 非负责人提醒 */
export function SectionBar({
  section,
  members,
  identity,
  onChangeMeta,
}: {
  section: SectionContent
  members: string[]
  identity: string
  onChangeMeta: (patch: { owner?: string | null; status?: SectionStatus }) => void
}) {
  const owner = section.owner ?? ''
  const status = section.status ?? 'draft'
  const notOwner = Boolean(owner && identity && owner !== identity)

  return (
    <div className="section-bar">
      <label>
        负责人
        <select value={owner} onChange={(e) => onChangeMeta({ owner: e.target.value || null })}>
          <option value="">（未分配）</option>
          {members.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        状态
        <select value={status} onChange={(e) => onChangeMeta({ status: e.target.value as SectionStatus })}>
          {(Object.keys(STATUS_META) as SectionStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </label>
      <span className={`status-chip ${STATUS_META[status].cls}`}>{STATUS_META[status].label}</span>
      {status === 'review' && <span className="section-bar-hint">评审中：欢迎用 💬 添加批注</span>}
      {notOwner && <span className="section-bar-warn">此章节由 {owner} 负责——修改前最好打个招呼</span>}
    </div>
  )
}
