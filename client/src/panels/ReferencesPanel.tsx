import { useEffect, useState } from 'react'
import type { Reference, ReferencesFile } from '@himcm/shared'
import { api } from '../api.ts'

interface ReferencesPanelProps {
  references: ReferencesFile
  onChanged: (file: ReferencesFile) => void
}

const EMPTY: Reference = { key: '', title: '' }

const FIELDS: Array<{ name: keyof Reference; label: string; placeholder: string; mono?: boolean }> = [
  { name: 'key', label: '引用键 *', placeholder: 'smith2020', mono: true },
  { name: 'authors', label: '作者', placeholder: 'J. Smith and A. Lee' },
  { name: 'title', label: '标题 *', placeholder: 'A Mathematical Model of …' },
  { name: 'container', label: '期刊 / 网站 / 出版方', placeholder: 'Journal of Modeling' },
  { name: 'year', label: '年份', placeholder: '2020' },
  { name: 'url', label: 'URL', placeholder: 'https://…', mono: true },
  { name: 'accessed', label: '访问日期', placeholder: '2026-11-01', mono: true },
  { name: 'note', label: '备注', placeholder: '' },
]

export function ReferencesPanel({ references, onChanged }: ReferencesPanelProps) {
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Reference>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEditing(null)
    setDraft(EMPTY)
  }, [references])

  const save = async (list: Reference[]) => {
    try {
      setError(null)
      const file: ReferencesFile = { version: 1, references: list }
      await api.saveReferences(file)
      onChanged(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const submitDraft = () => {
    if (!draft.key.trim() || !draft.title.trim()) {
      setError('引用键与标题必填')
      return
    }
    const list = [...references.references]
    const cleaned = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    ) as unknown as Reference
    if (editing !== null && editing < list.length) list[editing] = cleaned
    else list.push(cleaned)
    void save(list)
  }

  return (
    <div className="references-panel">
      <div className="references-header">
        <h2>参考文献</h2>
        <p className="dim">
          按此处顺序编号；正文中用 ＠ 按钮插入引用。导出时自动生成 References 一节（无需 BibTeX）。
        </p>
      </div>
      {error && <div className="compile-error-box">{error}</div>}
      <ul className="reference-list">
        {references.references.map((ref, i) => (
          <li key={ref.key}>
            <span className="ref-number">[{i + 1}]</span>
            <div className="ref-body">
              <div className="ref-title">{ref.title}</div>
              <div className="ref-meta dim">
                <code>{ref.key}</code>
                {ref.authors && ` · ${ref.authors}`}
                {ref.year && ` · ${ref.year}`}
              </div>
            </div>
            <span className="ref-actions">
              <button
                type="button"
                className="icon-btn"
                title="编辑"
                onClick={() => {
                  setEditing(i)
                  setDraft(references.references[i]!)
                }}
              >
                ✎
              </button>
              <button
                type="button"
                className="icon-btn"
                title="上移"
                disabled={i === 0}
                onClick={() => {
                  const list = [...references.references]
                  ;[list[i - 1], list[i]] = [list[i]!, list[i - 1]!]
                  void save(list)
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title="删除"
                onClick={() => {
                  if (window.confirm(`删除引用 [${ref.key}]？正文中的引用将显示为缺失。`)) {
                    void save(references.references.filter((_, j) => j !== i))
                  }
                }}
              >
                🗑
              </button>
            </span>
          </li>
        ))}
        {references.references.length === 0 && <li className="dim">尚无条目</li>}
      </ul>

      <div className="reference-form">
        <h3>{editing !== null ? `编辑 [${references.references[editing]?.key}]` : '新增条目'}</h3>
        {FIELDS.map((f) => (
          <label key={f.name}>
            <span>{f.label}</span>
            <input
              className={f.mono ? 'mono' : ''}
              value={String(draft[f.name] ?? '')}
              placeholder={f.placeholder}
              onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
            />
          </label>
        ))}
        <div className="reference-form-actions">
          {editing !== null && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing(null)
                setDraft(EMPTY)
              }}
            >
              取消
            </button>
          )}
          <button type="button" className="btn primary" onClick={submitDraft}>
            {editing !== null ? '保存修改' : '添加'}
          </button>
        </div>
      </div>
    </div>
  )
}
