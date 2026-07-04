import { useMemo } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { docToMd, mdToDoc, paperExtensions } from '@himcm/shared'
import { Toolbar } from './Toolbar.tsx'

interface EditorProps {
  /** 每个章节独立挂载（父组件用 key=sectionId 重建） */
  sectionId: string
  initialMd: string
  editable: boolean
  onChangeMd: (md: string) => void
}

export function Editor({ sectionId, initialMd, editable, onChangeMd }: EditorProps) {
  const initialContent = useMemo(() => mdToDoc(initialMd).toJSON(), [initialMd])

  const editor = useEditor(
    {
      extensions: paperExtensions(),
      content: initialContent,
      editable,
      onUpdate: ({ editor }) => {
        onChangeMd(docToMd(editor.state.doc))
      },
    },
    [sectionId]
  )

  if (!editor) return null

  return (
    <div className="editor-wrap">
      <Toolbar editor={editor} />
      <div className="editor-scroll">
        <div className="paper-page">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
