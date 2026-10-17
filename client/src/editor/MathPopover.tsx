import { useEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import { shortcut } from '../shortcuts.ts'

export interface MathEditState {
  /** 公式节点在文档中的位置 */
  pos: number
  latex: string
  label: string | null
  kind: 'inline' | 'block'
  /** 屏幕坐标（editor.view.coordsAtPos） */
  anchor: { left: number; bottom: number }
}

interface MathPopoverProps {
  state: MathEditState
  onSave: (latex: string, label: string | null) => void
  onDelete: () => void
  onClose: () => void
}

export function MathPopover({ state, onSave, onDelete, onClose }: MathPopoverProps) {
  const [latex, setLatex] = useState(state.latex)
  const [label, setLabel] = useState(state.label ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  const preview = useMemo(() => {
    if (!latex.trim()) return { html: '<span class="dim">（空公式）</span>', error: null }
    try {
      const html = katex.renderToString(latex, {
        displayMode: state.kind === 'block',
        throwOnError: true,
        strict: false,
      })
      return { html, error: null }
    } catch (err) {
      return {
        html: '',
        error: err instanceof Error ? err.message.replace(/^KaTeX parse error:\s*/, '') : String(err),
      }
    }
  }, [latex, state.kind])

  const save = () => {
    onSave(latex, state.kind === 'block' ? label.trim() || null : null)
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(state.anchor.left, window.innerWidth - 480),
    top: Math.min(state.anchor.bottom + 8, window.innerHeight - 320),
  }

  return (
    <div className="math-popover" style={style}>
      <textarea
        ref={textareaRef}
        rows={state.kind === 'block' ? 4 : 2}
        value={latex}
        placeholder={state.kind === 'block' ? '多行公式用 aligned 环境（勿用 align）' : 'LaTeX 公式'}
        spellCheck={false}
        onChange={(e) => setLatex(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
          if (e.key === 'Escape') onClose()
        }}
      />
      <div className="math-preview">
        {preview.error ? (
          <div className="math-error" title={preview.error}>
            编辑器无法渲染：{preview.error}
            <span className="badge">PDF-only？请编译验证</span>
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: preview.html }} />
        )}
      </div>
      <div className="math-popover-footer">
        {state.kind === 'block' && (
          <input
            className="label-input mono"
            style={{ width: 180 }}
            placeholder="标号，如 eq:growth"
            title="设置标号后公式获得编号 (1)，正文中可用 ＠ 插入交叉引用；留空则不编号"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onDelete}>
          删除
        </button>
        <button type="button" className="btn primary" onClick={save} title={shortcut('Enter')}>
          保存
        </button>
      </div>
    </div>
  )
}
