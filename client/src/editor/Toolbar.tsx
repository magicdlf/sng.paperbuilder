import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { RefPicker, TableSettings, Dropdown } from './InsertMenus.tsx'

interface ToolbarProps {
  editor: Editor
  onInsertMath: (kind: 'inline' | 'block') => void
  onInsertImage: () => void
}

interface BtnProps {
  label: string
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function Btn({ label, title, active, disabled, onClick }: BtnProps) {
  return (
    <button
      type="button"
      className={`tb-btn${active ? ' active' : ''}`}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

/** 光标在标题内时的标号编辑 */
function HeadingLabelMenu({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [label, setLabel] = useState(String(editor.getAttributes('heading').label ?? ''))
  return (
    <Dropdown onClose={onClose}>
      <div className="dropdown-title">标题标号（供交叉引用）</div>
      <div className="dropdown-form">
        <label>
          标号
          <input
            className="mono"
            autoFocus
            placeholder="sec:assumptions"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                editor.chain().focus().updateAttributes('heading', { label: label.trim() || null }).run()
                onClose()
              }
            }}
            onBlur={() => {
              editor.chain().focus().updateAttributes('heading', { label: label.trim() || null }).run()
            }}
          />
        </label>
      </div>
    </Dropdown>
  )
}

export function Toolbar({ editor, onInsertMath, onInsertImage }: ToolbarProps) {
  const [menu, setMenu] = useState<'refs' | 'table' | 'headingLabel' | null>(null)

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      inTable: e.isActive('table'),
      inHeading: e.isActive('heading'),
      heading: e.isActive('heading', { level: 1 })
        ? 1
        : e.isActive('heading', { level: 2 })
          ? 2
          : e.isActive('heading', { level: 3 })
            ? 3
            : 0,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const chain = () => editor.chain().focus()

  return (
    <div className="toolbar">
      <Btn label="↺" title="撤销 (⌘Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()} />
      <Btn label="↻" title="重做 (⌘⇧Z)" disabled={!s.canRedo} onClick={() => chain().redo().run()} />
      <span className="tb-sep" />
      <select
        className="tb-select"
        value={s.heading}
        title="段落格式"
        onChange={(e) => {
          const level = Number(e.target.value)
          if (level === 0) chain().setParagraph().run()
          else chain().setHeading({ level: level as 1 | 2 | 3 }).run()
        }}
      >
        <option value={0}>正文</option>
        <option value={1}>标题 1（章）</option>
        <option value={2}>标题 2（节）</option>
        <option value={3}>标题 3</option>
      </select>
      {s.inHeading && (
        <Btn label="#⃞" title="标题标号（交叉引用用）" onClick={() => setMenu(menu === 'headingLabel' ? null : 'headingLabel')} />
      )}
      <span className="tb-sep" />
      <Btn label="B" title="加粗 (⌘B)" active={s.bold} onClick={() => chain().toggleBold().run()} />
      <Btn label="I" title="斜体 (⌘I)" active={s.italic} onClick={() => chain().toggleItalic().run()} />
      <Btn label="U" title="下划线 (⌘U)" active={s.underline} onClick={() => chain().toggleUnderline().run()} />
      <Btn label="S" title="删除线" active={s.strike} onClick={() => chain().toggleStrike().run()} />
      <Btn label="⌜⌟" title="行内代码" active={s.code} onClick={() => chain().toggleCode().run()} />
      <span className="tb-sep" />
      <Btn label="•≡" title="无序列表" active={s.bulletList} onClick={() => chain().toggleBulletList().run()} />
      <Btn label="1≡" title="有序列表" active={s.orderedList} onClick={() => chain().toggleOrderedList().run()} />
      <Btn label="❝" title="引用块" active={s.blockquote} onClick={() => chain().toggleBlockquote().run()} />
      <Btn label="⌨" title="代码块" active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()} />
      <span className="tb-sep" />
      <Btn label="ƒ" title="行内公式" onClick={() => onInsertMath('inline')} />
      <Btn label="∑" title="块级公式" onClick={() => onInsertMath('block')} />
      <Btn label="🖼" title="插入图片" onClick={onInsertImage} />
      <Btn
        label="⊞"
        title="插入表格"
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
      <Btn label="＠" title="插入交叉引用 / 文献引用" onClick={() => setMenu(menu === 'refs' ? null : 'refs')} />
      {s.inTable && (
        <>
          <span className="tb-sep" />
          <Btn label="表⚙" title="表格设置" active={menu === 'table'} onClick={() => setMenu(menu === 'table' ? null : 'table')} />
        </>
      )}

      {menu === 'refs' && <RefPicker editor={editor} onClose={() => setMenu(null)} />}
      {menu === 'table' && <TableSettings editor={editor} onClose={() => setMenu(null)} />}
      {menu === 'headingLabel' && <HeadingLabelMenu editor={editor} onClose={() => setMenu(null)} />}
    </div>
  )
}
