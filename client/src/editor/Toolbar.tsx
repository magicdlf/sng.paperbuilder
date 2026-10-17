import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { RefPicker, TableSettings, Dropdown } from './InsertMenus.tsx'
import { shortcut } from '../shortcuts.ts'

interface ToolbarProps {
  editor: Editor
  onInsertMath: (kind: 'inline' | 'block') => void
  onInsertImage: () => void
  onAddComment: (text: string) => void
  tableStyle: 'paper' | 'grid'
  onToggleTableStyle: () => void
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

/** 新建批注输入框 */
function CommentDialog({ onSubmit, onClose }: { onSubmit: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const submit = () => {
    if (text.trim()) onSubmit(text.trim())
    onClose()
  }
  return (
    <Dropdown onClose={onClose}>
      <div className="dropdown-title">新建批注</div>
      <div className="dropdown-form">
        <textarea
          autoFocus
          rows={3}
          placeholder={`批注内容…（${shortcut('Enter')} 保存）`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            if (e.key === 'Escape') onClose()
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn primary" onClick={submit}>
            添加批注
          </button>
        </div>
      </div>
    </Dropdown>
  )
}

export function Toolbar({
  editor,
  onInsertMath,
  onInsertImage,
  onAddComment,
  tableStyle,
  onToggleTableStyle,
}: ToolbarProps) {
  const [menu, setMenu] = useState<'refs' | 'table' | 'headingLabel' | 'comment' | null>(null)

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
      hasSelection: !e.state.selection.empty,
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
      <Btn label="↺" title={`撤销 (${shortcut('Z')})`} disabled={!s.canUndo} onClick={() => chain().undo().run()} />
      <Btn label="↻" title={`重做 (${shortcut('Shift+Z')})`} disabled={!s.canRedo} onClick={() => chain().redo().run()} />
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
      <Btn label="B" title={`加粗 (${shortcut('B')})`} active={s.bold} onClick={() => chain().toggleBold().run()} />
      <Btn label="I" title={`斜体 (${shortcut('I')})`} active={s.italic} onClick={() => chain().toggleItalic().run()} />
      <Btn label="U" title={`下划线 (${shortcut('U')})`} active={s.underline} onClick={() => chain().toggleUnderline().run()} />
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
      <Btn
        label="💬"
        title={s.hasSelection ? '为所选文本添加批注' : '先选中一段文本'}
        disabled={!s.hasSelection}
        onClick={() => setMenu(menu === 'comment' ? null : 'comment')}
      />
      {s.inTable && (
        <>
          <span className="tb-sep" />
          <Btn label="表⚙" title="表格设置（题注/标号/对齐/行列）" active={menu === 'table'} onClick={() => setMenu(menu === 'table' ? null : 'table')} />
          <Btn
            label={tableStyle === 'paper' ? '三线' : '网格'}
            title={
              tableStyle === 'paper'
                ? '当前：三线表样式（同 PDF 输出）。点击切换为网格样式（编辑时看清单元格）'
                : '当前：网格样式（编辑用）。点击切换为三线表样式（同 PDF 输出）'
            }
            onClick={onToggleTableStyle}
          />
        </>
      )}

      {menu === 'refs' && <RefPicker editor={editor} onClose={() => setMenu(null)} />}
      {menu === 'table' && <TableSettings editor={editor} onClose={() => setMenu(null)} />}
      {menu === 'headingLabel' && <HeadingLabelMenu editor={editor} onClose={() => setMenu(null)} />}
      {menu === 'comment' && <CommentDialog onSubmit={onAddComment} onClose={() => setMenu(null)} />}
    </div>
  )
}
