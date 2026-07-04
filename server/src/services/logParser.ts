import type { CompileError } from '@himcm/shared'

export interface ParsedLog {
  errors: Array<{ line: number | null; message: string }>
  warnings: string[]
  /** 来自 "Output written on paper.pdf (N pages, ...)" */
  pagesTotal: number | null
}

/** 解析 TeX 日志（依赖 -file-line-error 输出格式） */
export function parseTexLog(log: string): ParsedLog {
  const errors: ParsedLog['errors'] = []
  const warnings: string[] = []
  let pagesTotal: number | null = null

  const lines = log.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // ./paper.tex:123: Undefined control sequence.
    const fileLine = line.match(/^(?:\.\/)?paper\.tex:(\d+):\s*(.*)$/)
    if (fileLine) {
      let message = fileLine[2] ?? ''
      // 附加下一行上下文（TeX 常把出错片段放在后续行）
      const next = lines[i + 1]
      if (next && !next.startsWith('!') && next.trim() && !/^(?:\.\/)?paper\.tex:\d+:/.test(next)) {
        message += ` ${next.trim()}`
      }
      errors.push({ line: Number(fileLine[1]), message: message.slice(0, 300) })
      continue
    }

    // 其它文件（宏包等）的 file:line 错误 —— 无法映射章节，但必须暴露
    const otherFile = line.match(/^(\/[^:]+\.(?:sty|cls|tex)):(\d+):\s*(.*)$/)
    if (otherFile) {
      const base = otherFile[1]!.split('/').pop()
      errors.push({ line: null, message: `${base}: ${(otherFile[3] ?? '').slice(0, 260)}` })
      continue
    }

    // ! LaTeX Error: File `foo' not found. 等无行号错误
    if (line.startsWith('! ')) {
      errors.push({ line: null, message: line.slice(2, 302) })
      continue
    }

    // LaTeX Warning: Reference `fig:x' on page 3 undefined
    const refWarn = line.match(/LaTeX Warning: (Reference|Citation) `([^']+)' .*undefined/)
    if (refWarn) {
      warnings.push(refWarn[1] === 'Reference' ? `交叉引用未定义: ${refWarn[2]}` : `文献引用未定义: ${refWarn[2]}`)
      continue
    }

    const out = line.match(/Output written on .*paper\.pdf \((\d+) pages?/)
    if (out) pagesTotal = Number(out[1])
  }

  return { errors, warnings: [...new Set(warnings)], pagesTotal }
}

/**
 * 从 .aux 提取 AI Use Report 的起始页。
 * hyperref 下：\newlabel{sec:aireport}{{}{PAGE}{...}...}
 * 非 hyperref：\newlabel{sec:aireport}{{}{PAGE}}
 */
export function aiReportPageFromAux(aux: string): number | null {
  const m = aux.match(/\\newlabel\{sec:aireport\}\{\{[^{}]*\}\{(\d+)\}/)
  return m ? Number(m[1]) : null
}

/** 把带行号的错误映射回章节 */
export function mapErrorsToSections(
  errors: Array<{ line: number | null; message: string }>,
  lineMap: Array<{ line: number; sectionId: string }>
): CompileError[] {
  return errors.map(({ line, message }) => {
    let sectionId: string | null = null
    if (line !== null) {
      for (const entry of lineMap) {
        if (entry.line <= line) sectionId = entry.sectionId
        else break
      }
    }
    return { sectionId, line, message }
  })
}
