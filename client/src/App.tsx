import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildLabelIndex, mdToDoc, type LabelIndex, type ReferencesFile } from '@himcm/shared'
import { api } from './api.ts'
import { useProject } from './hooks/useProject.ts'
import { Editor } from './editor/Editor.tsx'
import type { NumberingData } from './editor/NumberingContext.ts'
import { SectionList } from './panels/SectionList.tsx'
import { RightPanel, type PanelTab } from './panels/RightPanel.tsx'
import { CompilePanel } from './panels/CompilePanel.tsx'
import { ReferencesPanel } from './panels/ReferencesPanel.tsx'
import { HistoryPanel } from './panels/HistoryPanel.tsx'

export function App() {
  const { snapshot, loadError, reload, updateSection, flushSection, discardPending, getMd, getAllMd, saveStates } =
    useProject()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelTab | null>(null)
  const [compileRequestId, setCompileRequestId] = useState(0)
  const [labelIndex, setLabelIndex] = useState<LabelIndex | null>(null)
  const [references, setReferences] = useState<ReferencesFile>({ version: 1, references: [] })
  const numberingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 从 git 恢复章节后 +1，强制编辑器以磁盘内容重建 */
  const [restoreVersion, setRestoreVersion] = useState(0)

  // ---- 实时编号：从全部章节（含未保存编辑）重建 LabelIndex ----
  const recomputeNumbering = useCallback(() => {
    if (!snapshot) return
    try {
      const all = getAllMd()
      const sections = snapshot.manifest.sections
        .filter((s) => s.file)
        .map((s) => ({ id: s.id, role: s.role, doc: mdToDoc(all.get(s.id) ?? '') }))
      setLabelIndex(buildLabelIndex(sections))
    } catch {
      /* 解析异常时保留旧索引 */
    }
  }, [snapshot, getAllMd])

  useEffect(() => {
    recomputeNumbering()
  }, [recomputeNumbering])

  useEffect(() => {
    void api.references().then(setReferences).catch(() => undefined)
  }, [])

  const handleSectionChange = useCallback(
    (id: string, md: string) => {
      updateSection(id, md)
      if (numberingTimer.current) clearTimeout(numberingTimer.current)
      numberingTimer.current = setTimeout(recomputeNumbering, 400)
    },
    [updateSection, recomputeNumbering]
  )

  // 首次加载后选中第一个可编辑章节
  useEffect(() => {
    if (snapshot && !activeId) {
      const first = snapshot.sections.find((s) => s.file)
      if (first) setActiveId(first.id)
    }
  }, [snapshot, activeId])

  const active = useMemo(
    () => snapshot?.sections.find((s) => s.id === activeId) ?? null,
    [snapshot, activeId]
  )

  const guard = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        setActionError(null)
        await fn()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err))
      }
    },
    []
  )

  const handleCreate = useCallback(
    (title: string) =>
      guard(async () => {
        const { section } = await api.createSection(title, activeId ?? undefined)
        await reload()
        setActiveId(section.id)
      }),
    [guard, activeId, reload]
  )

  const handleDelete = useCallback(
    (id: string) =>
      guard(async () => {
        await api.deleteSection(id)
        if (activeId === id) setActiveId(null)
        await reload()
      }),
    [guard, activeId, reload]
  )

  const handleMove = useCallback(
    (id: string, dir: -1 | 1) =>
      guard(async () => {
        if (!snapshot) return
        const order = snapshot.manifest.sections.map((s) => s.id)
        const i = order.indexOf(id)
        const j = i + dir
        if (i < 0 || j < 1 || j >= order.length - 1) return
        ;[order[i], order[j]] = [order[j]!, order[i]!]
        await api.patchProject({ order })
        await reload()
      }),
    [guard, snapshot, reload]
  )

  const numbering = useMemo((): NumberingData | null => {
    if (!labelIndex || !activeId) return null
    return {
      labelIndex,
      sectionId: activeId,
      refOrder: Object.fromEntries(references.references.map((r, i) => [r.key, i + 1])),
      references: references.references,
    }
  }, [labelIndex, activeId, references])

  const globalSaveState = useMemo(() => {
    const states = Object.values(saveStates)
    if (states.includes('error')) return { text: '保存失败', cls: 'error' }
    if (states.includes('saving')) return { text: '保存中…', cls: 'saving' }
    if (states.includes('dirty')) return { text: '未保存更改', cls: 'dirty' }
    return { text: '已保存', cls: 'saved' }
  }, [saveStates])

  if (loadError) {
    return (
      <div className="app-error">
        <h2>无法加载论文</h2>
        <p>{loadError}</p>
        <button type="button" onClick={() => void reload()}>
          重试
        </button>
      </div>
    )
  }

  if (!snapshot) return <div className="app-loading">加载中…</div>

  const m = snapshot.manifest

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <strong>
            {m.contest} {m.year}
          </strong>
          <span className="meta">Problem {m.problem} · Team {m.teamControlNumber}</span>
        </div>
        <div className="header-right">
          {actionError && <span className="action-error">{actionError}</span>}
          <span className={`save-state ${globalSaveState.cls}`}>{globalSaveState.text}</span>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              // 编译前把未保存的章节全部落盘
              for (const s of snapshot.sections) {
                if (saveStates[s.id] === 'dirty' || saveStates[s.id] === 'saving') void flushSection(s.id)
              }
              setPanel('compile')
              setCompileRequestId((n) => n + 1)
            }}
          >
            编译 PDF
          </button>
        </div>
      </header>
      <div className="app-body">
        <SectionList
          snapshot={snapshot}
          activeId={activeId}
          saveStates={saveStates}
          onSelect={setActiveId}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onMove={handleMove}
        />
        <main className="app-main">
          {active && active.file ? (
            <Editor
              key={`${active.id}:${restoreVersion}`}
              sectionId={active.id}
              initialMd={getMd(active.id)}
              editable
              numbering={numbering}
              onChangeMd={(md) => handleSectionChange(active.id, md)}
            />
          ) : active?.role === 'references' ? (
            <ReferencesPanel references={references} onChanged={setReferences} />
          ) : (
            <div className="empty-state">选择左侧章节开始编辑</div>
          )}
        </main>
        {panel && (
          <RightPanel tab={panel} onTabChange={setPanel} onClose={() => setPanel(null)}>
            {panel === 'compile' && (
              <CompilePanel
                snapshot={snapshot}
                compileRequestId={compileRequestId}
                onManifestChanged={() => void reload()}
                onJumpToSection={(id) => setActiveId(id)}
              />
            )}
            {panel === 'history' && (
              <HistoryPanel
                activeSection={
                  active && active.file ? { id: active.id, file: active.file, title: active.title } : null
                }
                beforeRestore={discardPending}
                onRestored={() => {
                  void reload().then(() => {
                    setRestoreVersion((n) => n + 1)
                    recomputeNumbering()
                  })
                }}
              />
            )}
            {panel === 'comments' && <div className="empty-state">批注（M6）</div>}
          </RightPanel>
        )}
      </div>
    </div>
  )
}
