import { describe, expect, it } from 'vitest'
import { mdToDoc } from '../../markdown/parse.ts'
import { docToLatex } from '../serialize.ts'
import { assemblePaper, lintSections } from '../template.ts'
import type { PaperManifest } from '../../types.ts'

const opts = { numberedHeadings: true }

function latexOf(md: string): string {
  return docToLatex(mdToDoc(md), opts)
}

describe('docToLatex 构件映射', () => {
  it('标题层级与 label', () => {
    expect(latexOf('# One\n')).toBe('\\section{One}')
    expect(latexOf('## Two {#sec:two}\n')).toBe('\\subsection{Two}\\label{sec:two}')
    expect(docToLatex(mdToDoc('# S\n'), { numberedHeadings: false })).toBe('\\section*{S}')
  })

  it('行内格式与转义', () => {
    const tex = latexOf('**b** *i* <u>u</u> ~~s~~ `c_ode` 和 100% & #5 snake_case\n')
    expect(tex).toContain('\\textbf{b}')
    expect(tex).toContain('\\textit{i}')
    expect(tex).toContain('\\underline{u}')
    expect(tex).toContain('\\st{s}')
    expect(tex).toContain('\\texttt{c\\_ode}')
    expect(tex).toContain('100\\%')
    expect(tex).toContain('\\&')
    expect(tex).toContain('\\#5')
    expect(tex).toContain('snake\\_case') // 词内下划线按字面
  })

  it('数学原样直通', () => {
    expect(latexOf('Inline $\\alpha_1^2$ stays.\n')).toContain('$\\alpha_1^2$')
    expect(latexOf('$$\nX = 1\n$$ {#eq:x}\n')).toBe('\\begin{equation}\\label{eq:x}\nX = 1\n\\end{equation}')
    expect(latexOf('$$\nY = 2\n$$\n')).toBe('\\[\nY = 2\n\\]')
  })

  it('figure：htbp + 宽度 + 恒有 caption', () => {
    const tex = latexOf('![Growth $x$](assets/g.png){#fig:g width=55%}\n')
    expect(tex).toBe(
      [
        '\\begin{figure}[htbp]',
        '\\centering',
        '\\includegraphics[width=0.55\\linewidth]{assets/g.png}',
        '\\caption{Growth $x$}\\label{fig:g}',
        '\\end{figure}',
      ].join('\n')
    )
    // 无题注无 label 也输出空 caption（保证编号连续一致）
    expect(latexOf('![](assets/p.png)\n')).toContain('\\caption{}')
  })

  it('table：三线表 + 列对齐 + 题注在上', () => {
    const tex = latexOf(
      '| Sym | Val |\n| :---: | ---: |\n| $\\beta$ | 0.3 |\n\nTable: Params {#tbl:p}\n'
    )
    expect(tex).toBe(
      [
        '\\begin{table}[htbp]',
        '\\centering',
        '\\begin{tabular}{cr}',
        '\\toprule',
        'Sym & Val \\\\',
        '\\midrule',
        '$\\beta$ & 0.3 \\\\',
        '\\bottomrule',
        '\\end{tabular}',
        '\\caption{Params}\\label{tbl:p}',
        '\\end{table}',
      ].join('\n')
    )
  })

  it('crossRef 与 citation', () => {
    const tex = latexOf('See [@fig:g] and [@a; @b].\n')
    expect(tex).toContain('\\Cref{fig:g}')
    expect(tex).toContain('\\cite{a,b}')
  })

  it('批注默认剥离', () => {
    const tex = latexOf('Hi <span data-comment-id="c_1">there</span>.\n')
    expect(tex).toBe('Hi there.')
  })

  it('列表与引用块', () => {
    expect(latexOf('- a\n- b\n')).toBe('\\begin{itemize}\n\\item a\n\\item b\n\\end{itemize}')
    expect(latexOf('3. x\n4. y\n')).toContain('\\setcounter{enumi}{2}')
    expect(latexOf('> q\n')).toBe('\\begin{quote}\nq\n\\end{quote}')
  })

  it('代码块用 listings（长行自动换行）', () => {
    expect(latexOf('```python\nprint(1)\n```\n')).toBe('\\begin{lstlisting}\nprint(1)\n\\end{lstlisting}')
  })

  it('超长列自动切换 tabularx X 列', () => {
    const long = 'a very long description that clearly exceeds the wrap threshold for sure'
    const tex = latexOf(`| Sym | Definition |\n| --- | --- |\n| $x$ | ${long} |\n`)
    expect(tex).toContain('\\begin{tabularx}{\\textwidth}{l>{\\raggedright\\arraybackslash}X}')
    expect(tex).toContain('\\end{tabularx}')
    // 短表保持普通 tabular
    expect(latexOf('| a | b |\n| --- | --- |\n| 1 | 2 |\n')).toContain('\\begin{tabular}{ll}')
  })

  it('floatPlacement=H 时图表用 [H]', () => {
    const tex = docToLatex(mdToDoc('![c](a.png)\n'), { numberedHeadings: true, floatPlacement: 'H' })
    expect(tex).toContain('\\begin{figure}[H]')
  })
})

describe('assemblePaper', () => {
  const manifest: PaperManifest = {
    version: 1,
    contest: 'HiMCM',
    year: 2026,
    problem: 'B',
    teamControlNumber: '1234567',
    title: 'Optimal Evacuation Sweeps',
    keywords: ['Cellular Automation', 'Path-finding'],
    sections: [
      { id: 'summary', file: 'sections/00-summary.md', role: 'summary' },
      { id: 'intro', file: 'sections/01-intro.md', role: 'body' },
      { id: 'appx', file: 'sections/80-appendix.md', role: 'appendix' },
      { id: 'refs', file: null, role: 'references' },
      { id: 'ai', file: 'sections/90-ai.md', role: 'ai-report' },
    ],
    bibliography: 'references.json',
    export: { engine: 'pdflatex', draftComments: false, toc: true },
  }

  const input = {
    manifest,
    sections: [
      { meta: manifest.sections[0]!, doc: mdToDoc('# Summary\n\nWe solve it.\n') },
      { meta: manifest.sections[1]!, doc: mdToDoc('# Introduction\n\nBody text.\n') },
      { meta: manifest.sections[2]!, doc: mdToDoc('# Extra\n\nAppendix text.\n') },
      { meta: manifest.sections[3]!, doc: null },
      { meta: manifest.sections[4]!, doc: mdToDoc('# AI Use Report\n\nNo AI used.\n') },
    ],
    references: [
      { key: 'a2024', authors: 'A. Author', title: 'A title', container: 'J. Ex.', year: '2024', url: 'https://x.com', accessed: '2026-07-01' },
    ],
  }

  it('结构完整：preamble/summary sheet/目录/appendix/文献/AI 报告', () => {
    const { tex, lineMap } = assemblePaper(input)
    expect(tex).toContain('\\documentclass[12pt,letterpaper]{article}')
    expect(tex).toContain('\\usepackage{newtxtext,newtxmath}')
    expect(tex).toContain('Team \\#~1234567')
    expect(tex).toContain('Page \\thepage\\ of \\pageref{LastPage}')
    expect(tex).toContain('Problem Chosen')
    expect(tex).toContain('{\\Huge\\bfseries\\color{red} B}')
    expect(tex).toContain('2026 HiMCM')
    expect(tex).toContain('\\thispagestyle{empty}')
    expect(tex).toContain('{\\large\\bfseries Optimal Evacuation Sweeps}')
    expect(tex).toContain('\\textbf{Keywords: } Cellular Automation, Path-finding')
    expect(tex).toContain('\\tableofcontents')
    expect(tex).toContain('\\appendix')
    expect(tex).toContain('\\begin{thebibliography}')
    expect(tex).toContain("``A title,''")
    expect(tex).toContain('\\section*{AI Use Report}\\label{sec:aireport}')
    // summary 的 H1 被丢弃（页眉三栏已表明身份），正文 H1 保留
    expect(tex).not.toContain('\\section*{Summary}')
    expect(tex).toContain('\\section{Introduction}')
    // 行映射按 tex 行号可回溯到章节
    expect(lineMap.length).toBeGreaterThanOrEqual(4)
    const introEntry = lineMap.find((e) => e.sectionId === 'intro')!
    const texLines = tex.split('\n')
    expect(texLines[introEntry.line - 1]).toContain('\\section{Introduction}')
  })

  it('lint 检测 CJK', () => {
    const warnings = lintSections([{ id: 'x', title: '模型', md: '中文内容' }])
    expect(warnings.length).toBe(1)
  })

  it('中文标题自动使用 XeLaTeX 和随 TeX Live 分发的字体', () => {
    const result = assemblePaper({ ...input, manifest: { ...manifest, title: '使用指南' } })
    expect(result.engine).toBe('xelatex')
    expect(result.tex).toContain('fontset=fandol')
    expect(result.tex).toContain('\\let\\st\\CJKsout')
    expect(result.tex).not.toContain('\\usepackage[utf8]{inputenc}')
  })

  it('中文参考文献也触发切换，英文默认仍使用 pdflatex', () => {
    expect(assemblePaper(input).engine).toBe('pdflatex')
    expect(assemblePaper({ ...input, references: [{ key: 'zh', title: '中文参考文献' }] }).engine).toBe('xelatex')
  })
})
