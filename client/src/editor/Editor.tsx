import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { docToMd, mdToDoc } from '@himcm/shared'
import { clientExtensions } from './clientExtensions.ts'
import { newCommentId } from '../comments.ts'
import { Toolbar } from './Toolbar.tsx'
import { MathPopover, type MathEditState } from './MathPopover.tsx'
import { NumberingContext, type NumberingData } from './NumberingContext.ts'
import { api } from '../api.ts'

export interface NewCommentInfo {
  id: string
  anchorText: string
  text: string
}

interface EditorProps {
  /** 每个章节独立挂载（父组件用 key=sectionId 重建） */
  sectionId: string
  initialMd: string
  editable: boolean
  numbering: NumberingData | null
  onChangeMd: (md: string) => void
  onReady?: (editor: TiptapEditor) => void
  onSelectionChange?: (hasSelection: boolean) => void
  onCreateComment?: (info: NewCommentInfo) => void
}

export type TableStyle = 'paper' | 'grid'

const TABLE_STYLE_KEY = 'himcm.tableStyle'

export function Editor({
  sectionId,
  initialMd,
  editable,
  numbering,
  onChangeMd,
  onReady,
  onSelectionChange,
  onCreateComment,
}: EditorProps) {
  const initialContent = useMemo(() => mdToDoc(initialMd).toJSON(), [initialMd])
  const [mathEdit, setMathEdit] = useState<MathEditState | null>(null)
  const [tableStyle, setTableStyle] = useState<TableStyle>(
    () => (localStorage.getItem(TABLE_STYLE_KEY) as TableStyle | null) ?? 'paper'
  )
  const toggleTableStyle = useCallback(() => {
    setTableStyle((prev) => {
      const next = prev === 'paper' ? 'grid' : 'paper'
      localStorage.setItem(TABLE_STYLE_KEY, next)
      return next
    })
  }, [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<TiptapEditor | null>(null)

  const openMathAt = useCallback((info: { pos: number; latex: string; label: string | null; kind: 'inline' | 'block' }) => {
    const editor = editorRef.current
    if (!editor) return
    const coords = editor.view.coordsAtPos(info.pos)
    setMathEdit({ ...info, anchor: { left: coords.left, bottom: coords.bottom } })
  }, [])

  const extensions = useMemo(() => clientExtensions(openMathAt), [openMathAt])

  const uploadAndInsertImage = useCallback(async (file: File, pos?: number) => {
    const editor = editorRef.current
    if (!editor) return
    try {
      const { path } = await api.uploadAsset(file)
      const src = `/${path}`
      const node = { type: 'figure', attrs: { src, width: null, label: null }, content: [] }
      const insertAt = pos ?? editor.state.selection.from
      editor.chain().focus().insertContentAt(insertAt, node).run()
      // 选中刚插入的图（工具集直接弹出），并滚动到可见——大截图的工具集可能在视口外
      let figurePos: number | null = null
      let bestDist = Infinity
      editor.state.doc.descendants((n, p) => {
        if (n.type.name === 'figure' && n.attrs.src === src) {
          const dist = Math.abs(p - insertAt)
          if (dist < bestDist) {
            bestDist = dist
            figurePos = p
          }
          return false
        }
        return true
      })
      if (figurePos !== null) {
        editor.chain().setNodeSelection(figurePos).scrollIntoView().run()
      }
    } catch (err) {
      window.alert(`图片上传失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }, [])

  const editor = useEditor(
    {
      extensions,
      content: initialContent,
      editable,
      onUpdate: ({ editor }) => {
        onChangeMd(docToMd(editor.state.doc))
      },
      onCreate: ({ editor }) => {
        onReady?.(editor)
      },
      onSelectionUpdate: ({ editor }) => {
        onSelectionChange?.(!editor.state.selection.empty)
      },
      editorProps: {
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
          if (files.length === 0) return false
          for (const file of files) void uploadAndInsertImage(file)
          return true
        },
        handleDrop: (view, event) => {
          const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
          if (files.length === 0) return false
          event.preventDefault()
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
          for (const file of files) void uploadAndInsertImage(file, coords?.pos)
          return true
        },
      },
    },
    [sectionId]
  )
  editorRef.current = editor

  // 编号数据变化 → 同步到扩展 storage 并触发装饰重建
  useEffect(() => {
    if (!editor) return
    const counters = numbering?.labelIndex.sectionStart[sectionId] ?? null
    editor.storage.himcmNumbering.counters = counters
    editor.view.dispatch(editor.state.tr.setMeta('himcmNumbering', true))
  }, [editor, numbering, sectionId])

  const insertMath = useCallback(
    (kind: 'inline' | 'block') => {
      if (!editor) return
      if (kind === 'inline') editor.chain().focus().insertInlineMath({ latex: 'x' }).run()
      else editor.chain().focus().insertBlockMath({ latex: 'x = 1' }).run()
      // 找到光标前最近的公式节点并打开编辑
      const { from } = editor.state.selection
      let found: { pos: number; latex: string; label: string | null } | null = null
      editor.state.doc.descendants((node, pos) => {
        if (pos >= from) return false
        if (node.type.name === (kind === 'inline' ? 'inlineMath' : 'blockMath')) {
          found = { pos, latex: String(node.attrs.latex), label: (node.attrs.label as string | null) ?? null }
        }
        return true
      })
      if (found !== null) openMathAt({ ...(found as { pos: number; latex: string; label: string | null }), kind })
    },
    [editor, openMathAt]
  )

  const saveMath = useCallback(
    (latex: string, label: string | null) => {
      if (!editor || !mathEdit) return
      const node = editor.state.doc.nodeAt(mathEdit.pos)
      if (node) {
        const attrs = node.type.name === 'blockMath' ? { latex, label } : { latex }
        editor.view.dispatch(editor.state.tr.setNodeMarkup(mathEdit.pos, undefined, { ...node.attrs, ...attrs }))
      }
      setMathEdit(null)
      editor.commands.focus()
    },
    [editor, mathEdit]
  )

  const deleteMath = useCallback(() => {
    if (!editor || !mathEdit) return
    const node = editor.state.doc.nodeAt(mathEdit.pos)
    if (node) editor.view.dispatch(editor.state.tr.delete(mathEdit.pos, mathEdit.pos + node.nodeSize))
    setMathEdit(null)
    editor.commands.focus()
  }, [editor, mathEdit])

  const addComment = useCallback(
    (text: string) => {
      if (!editor || !onCreateComment) return
      const { from, to, empty } = editor.state.selection
      if (empty) return
      const id = newCommentId()
      const anchorText = editor.state.doc.textBetween(from, to, ' ')
      editor.chain().focus().setComment(id).run()
      onCreateComment({ id, anchorText, text })
    },
    [editor, onCreateComment]
  )

  if (!editor) return null

  return (
    <NumberingContext.Provider value={numbering}>
      <div className={`editor-wrap table-style-${tableStyle}`}>
        <Toolbar
          editor={editor}
          onInsertMath={insertMath}
          onInsertImage={() => fileInputRef.current?.click()}
          onAddComment={addComment}
          tableStyle={tableStyle}
          onToggleTableStyle={toggleTableStyle}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void uploadAndInsertImage(file)
            e.target.value = ''
          }}
        />
        <div className="editor-scroll">
          <div className="paper-page">
            <EditorContent editor={editor} />
          </div>
        </div>
        {mathEdit && (
          <MathPopover state={mathEdit} onSave={saveMath} onDelete={deleteMath} onClose={() => setMathEdit(null)} />
        )}
      </div>
    </NumberingContext.Provider>
  )
}
