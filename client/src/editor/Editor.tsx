import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { docToMd, mdToDoc } from '@himcm/shared'
import { clientExtensions } from './clientExtensions.ts'
import { Toolbar } from './Toolbar.tsx'
import { MathPopover, type MathEditState } from './MathPopover.tsx'
import { NumberingContext, type NumberingData } from './NumberingContext.ts'
import { api } from '../api.ts'

interface EditorProps {
  /** 每个章节独立挂载（父组件用 key=sectionId 重建） */
  sectionId: string
  initialMd: string
  editable: boolean
  numbering: NumberingData | null
  onChangeMd: (md: string) => void
}

export function Editor({ sectionId, initialMd, editable, numbering, onChangeMd }: EditorProps) {
  const initialContent = useMemo(() => mdToDoc(initialMd).toJSON(), [initialMd])
  const [mathEdit, setMathEdit] = useState<MathEditState | null>(null)
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
      const node = { type: 'figure', attrs: { src: `/${path}`, width: null, label: null }, content: [] }
      if (pos !== undefined) editor.chain().focus().insertContentAt(pos, node).run()
      else editor.chain().focus().insertContent(node).run()
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

  if (!editor) return null

  return (
    <NumberingContext.Provider value={numbering}>
      <div className="editor-wrap">
        <Toolbar
          editor={editor}
          onInsertMath={insertMath}
          onInsertImage={() => fileInputRef.current?.click()}
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
