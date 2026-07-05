import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import {
  buildLabelIndex,
  docToMd,
  getPaperSchema,
  mdToDoc,
  type CommentsFile,
  type LabelIndex,
  type ReferencesFile,
} from '@himcm/shared'
import { api } from './api.ts'
import { useProject } from './hooks/useProject.ts'
import { collectAnchors, removeCommentFromMd, type CommentAnchor } from './comments.ts'
import { Editor, type NewCommentInfo } from './editor/Editor.tsx'
import type { NumberingData } from './editor/NumberingContext.ts'
import { SectionList } from './panels/SectionList.tsx'
import { RightPanel, type PanelTab } from './panels/RightPanel.tsx'
import { CompilePanel } from './panels/CompilePanel.tsx'
import { ReferencesPanel } from './panels/ReferencesPanel.tsx'
import { HistoryPanel } from './panels/HistoryPanel.tsx'
import { CommentsPanel } from './panels/CommentsPanel.tsx'
import { PaperSwitcher } from './panels/PaperSwitcher.tsx'
import { IdentityPicker, SectionBar } from './panels/TeamBar.tsx'

export function App() {
  const {
    snapshot,
    loadError,
    reload,
    updateSection,
    flushSection,
    discardPending,
    resolveConflict,
    getMd,
    getAllMd,
    saveStates,
  } = useProject()
  const [identity, setIdentity] = useState(() => localStorage.getItem('himcm.identity') ?? '')
  const changeIdentity = useCallback((name: string) => {
    localStorage.setItem('himcm.identity', name)
    setIdentity(name)
  }, [])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelTab | null>(null)
  const [compileRequestId, setCompileRequestId] = useState(0)
  const [labelIndex, setLabelIndex] = useState<LabelIndex | null>(null)
  const [references, setReferences] = useState<ReferencesFile>({ version: 1, references: [] })
  const numberingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 从 git 恢复章节后 +1，强制编辑器以磁盘内容重建 */
  const [restoreVersion, setRestoreVersion] = useState(0)
  const [comments, setComments] = useState<CommentsFile>({ version: 1, comments: [] })
  const [anchors, setAnchors] = useState<Record<string, CommentAnchor>>({})
  const [hasSelection, setHasSelection] = useState(false)
  const editorRef = useRef<TiptapEditor | null>(null)

  // ---- 实时编号 + 批注锚点：从全部章节（含未保存编辑）重建 ----
  const recomputeNumbering = useCallback(() => {
    if (!snapshot) return
    try {
      const all = getAllMd()
      const sections = snapshot.manifest.sections
        .filter((s) => s.file)
        .map((s) => ({ id: s.id, role: s.role, doc: mdToDoc(all.get(s.id) ?? '') }))
      setLabelIndex(buildLabelIndex(sections))
      setAnchors(collectAnchors(sections))
    } catch {
      /* 解析异常时保留旧索引 */
    }
  }, [snapshot, getAllMd])

  useEffect(() => {
    recomputeNumbering()
  }, [recomputeNumbering])

  useEffect(() => {
    void api.references().then(setReferences).catch(() => undefined)
    void api.comments().then(setComments).catch(() => undefined)
  }, [])

  // ---- 批注 CRUD（每次操作整文件落盘，简单可靠） ----
  const persistComments = useCallback((next: CommentsFile) => {
    setComments(next)
    void api.saveComments(next).catch(() => undefined)
  }, [])

  const handleCreateComment = useCallback(
    (info: NewCommentInfo) => {
      if (!activeId) return
      const now = new Date().toISOString()
      persistComments({
        version: 1,
        comments: [
          {
            id: info.id,
            sectionId: activeId,
            status: 'open',
            createdAt: now,
            anchorText: info.anchorText,
            thread: [{ id: `m_${Date.now().toString(36)}`, at: now, text: info.text, author: identity || undefined }],
          },
          ...comments.comments,
        ],
      })
      setPanel('comments')
    },
    [activeId, comments, persistComments, identity]
  )

  const handleReply = useCallback(
    (threadId: string, text: string) => {
      persistComments({
        version: 1,
        comments: comments.comments.map((c) =>
          c.id === threadId
            ? {
                ...c,
                thread: [
                  ...c.thread,
                  { id: `m_${Date.now().toString(36)}`, at: new Date().toISOString(), text, author: identity || undefined },
                ],
              }
            : c
        ),
      })
    },
    [comments, persistComments, identity]
  )

  const handleToggleResolve = useCallback(
    (threadId: string) => {
      persistComments({
        version: 1,
        comments: comments.comments.map((c) =>
          c.id === threadId ? { ...c, status: c.status === 'open' ? 'resolved' : 'open' } : c
        ),
      })
    },
    [comments, persistComments]
  )

  const handleDeleteComment = useCallback(
    (threadId: string) => {
      const anchor = anchors[threadId]
      // 同时移除文档中的高亮 mark：活动章节走编辑器命令，其余章节走 md 变换
      if (anchor) {
        if (anchor.sectionId === activeId && editorRef.current) {
          editorRef.current.commands.unsetComment(threadId)
        } else {
          const md = getMd(anchor.sectionId)
          const next = removeCommentFromMd(md, threadId)
          if (next !== md) updateSection(anchor.sectionId, next)
        }
      }
      persistComments({ version: 1, comments: comments.comments.filter((c) => c.id !== threadId) })
      setTimeout(recomputeNumbering, 0)
    },
    [anchors, activeId, comments, getMd, updateSection, persistComments, recomputeNumbering]
  )

  const handleReattach = useCallback(
    (threadId: string) => {
      const editor = editorRef.current
      if (!editor || editor.state.selection.empty || !activeId) return
      const { from, to } = editor.state.selection
      const anchorText = editor.state.doc.textBetween(from, to, ' ')
      editor.chain().focus().setComment(threadId).run()
      persistComments({
        version: 1,
        comments: comments.comments.map((c) => (c.id === threadId ? { ...c, sectionId: activeId, anchorText } : c)),
      })
      setTimeout(recomputeNumbering, 450)
    },
    [activeId, comments, persistComments, recomputeNumbering]
  )

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

  /** 把当前编辑器中 pos 处的图搬到目标章节末尾（文件在论文级 assets/，无需移动） */
  const handleMoveFigureToSection = useCallback(
    (figurePos: number, targetSectionId: string) => {
      const editor = editorRef.current
      if (!editor || !activeId || targetSectionId === activeId) return
      const node = editor.state.doc.nodeAt(figurePos)
      if (!node || node.type.name !== 'figure') return
      // 序列化为独立 md 块，追加到目标章节
      const figMd = docToMd(getPaperSchema().topNodeType.create(null, node))
      const targetMd = getMd(targetSectionId)
      updateSection(targetSectionId, targetMd.replace(/\n*$/, '\n\n') + figMd)
      // 从当前文档删除（触发 onUpdate → 自动保存 + 编号重算）
      editor.view.dispatch(editor.state.tr.delete(figurePos, figurePos + node.nodeSize))
    },
    [activeId, getMd, updateSection]
  )

  const numbering = useMemo((): NumberingData | null => {
    if (!labelIndex || !activeId || !snapshot) return null
    return {
      labelIndex,
      sectionId: activeId,
      refOrder: Object.fromEntries(references.references.map((r, i) => [r.key, i + 1])),
      references: references.references,
      sections: snapshot.sections.filter((s) => s.file).map((s) => ({ id: s.id, title: s.title })),
      onMoveFigureToSection: handleMoveFigureToSection,
    }
  }, [labelIndex, activeId, references, snapshot, handleMoveFigureToSection])

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
          <PaperSwitcher currentDir={snapshot.paperDir} />
          <strong>
            {m.contest} {m.year}
          </strong>
          <span className="meta">Problem {m.problem} · Team {m.teamControlNumber}</span>
          <IdentityPicker
            members={m.members ?? []}
            identity={identity}
            onIdentityChange={changeIdentity}
            onAddMember={(name) =>
              guard(async () => {
                await api.patchProject({ members: [...(m.members ?? []), name] })
                await reload()
              })
            }
          />
        </div>
        <div className="header-right">
          {actionError && <span className="action-error">{actionError}</span>}
          <span className={`save-state ${globalSaveState.cls}`}>{globalSaveState.text}</span>
          <button
            type="button"
            className="btn"
            onClick={() => setPanel(panel === 'history' ? null : 'history')}
          >
            历史
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setPanel(panel === 'comments' ? null : 'comments')}
          >
            批注{comments.comments.filter((c) => c.status === 'open').length > 0 && ` (${comments.comments.filter((c) => c.status === 'open').length})`}
          </button>
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
            <>
              <SectionBar
                section={active}
                members={m.members ?? []}
                identity={identity}
                onChangeMeta={(patch) =>
                  guard(async () => {
                    await api.patchSectionMeta(active.id, patch)
                    await reload()
                  })
                }
              />
              {saveStates[active.id] === 'conflict' && (
                <div className="conflict-banner">
                  <span>⚠ 该章节已被他人修改，你的保存被拦下。</span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      guard(async () => {
                        await resolveConflict(active.id, 'reload')
                        setRestoreVersion((n) => n + 1)
                        recomputeNumbering()
                      })
                    }
                  >
                    加载最新（丢弃我的修改）
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => guard(() => resolveConflict(active.id, 'overwrite'))}
                  >
                    强制覆盖
                  </button>
                </div>
              )}
              <Editor
                key={`${active.id}:${restoreVersion}`}
                sectionId={active.id}
                initialMd={getMd(active.id)}
                editable
                numbering={numbering}
                onChangeMd={(md) => handleSectionChange(active.id, md)}
                onReady={(editor) => {
                  editorRef.current = editor
                  setHasSelection(false)
                }}
                onSelectionChange={setHasSelection}
                onCreateComment={handleCreateComment}
              />
            </>
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
                identity={identity}
                beforeRestore={discardPending}
                onRestored={() => {
                  void reload().then(() => {
                    setRestoreVersion((n) => n + 1)
                    recomputeNumbering()
                  })
                }}
              />
            )}
            {panel === 'comments' && (
              <CommentsPanel
                comments={comments}
                anchors={anchors}
                hasSelection={hasSelection}
                sectionTitle={(id) => snapshot.sections.find((s) => s.id === id)?.title ?? id}
                onJump={setActiveId}
                onReply={handleReply}
                onToggleResolve={handleToggleResolve}
                onDelete={handleDeleteComment}
                onReattach={handleReattach}
              />
            )}
          </RightPanel>
        )}
      </div>
    </div>
  )
}
