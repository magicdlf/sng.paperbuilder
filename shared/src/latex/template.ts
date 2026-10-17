import type { Node as PMNode } from '@tiptap/pm/model'
import type { PaperManifest, Reference, SectionMeta } from '../types.ts'
import { escapeLatex } from './escape.ts'
import { docToLatex } from './serialize.ts'

export interface AssembleSection {
  meta: SectionMeta
  /** references 角色为 null（由 references 列表生成） */
  doc: PMNode | null
}

export interface AssembleInput {
  manifest: PaperManifest
  sections: AssembleSection[]
  references: Reference[]
  /** commentId → 批注首条文本（draftComments 模式用） */
  commentTexts?: Record<string, string>
}

export interface AssembledLatex {
  tex: string
  engine: 'pdflatex' | 'xelatex'
  /** 有序：每章内容在 .tex 中的起始行（1-based），用于编译错误回溯 */
  lineMap: Array<{ line: number; sectionId: string }>
}

/** 基于 COMAP 官方 2025 模板的 preamble（pdflatex 原生路径） */
function preamble(manifest: PaperManifest, draftComments: boolean, engine: 'pdflatex' | 'xelatex'): string {
  const compact = manifest.export.layout === 'compact'
  const geometry = compact
    ? 'left=2cm,right=2cm,top=2.5cm,bottom=2cm'
    : 'left=1in,top=1in,bottom=1in,right=0.75in'
  const useFloat = manifest.export.floatPlacement === 'here' ? '\\usepackage{float}\n' : ''
  return `\\documentclass[12pt,letterpaper]{article}
${engine === 'pdflatex' ? '\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}' : '\\usepackage{fontspec}'}
\\usepackage{newtxtext,newtxmath}
${engine === 'xelatex' ? '\\usepackage[UTF8,scheme=plain,fontset=fandol]{ctex}\n\\setmainfont{texgyretermes}[Extension=.otf,UprightFont=*-regular,BoldFont=*-bold,ItalicFont=*-italic,BoldItalicFont=*-bolditalic]' : ''}
\\usepackage[letterpaper,${geometry}]{geometry}
% 注意：不加载 amssymb —— newtxmath 已提供 AMS 符号，重复加载会因 \\Bbbk 冲突报错
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{xcolor}
\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{caption}
\\usepackage{listings}
\\usepackage{soul}
${engine === 'xelatex' ? '\\usepackage{xeCJKfntef}\n\\let\\st\\CJKsout\n\\usepackage{newunicodechar}\n\\newunicodechar{⌘}{\\texttt{Cmd}}\n\\newunicodechar{↑}{\\ensuremath{\\uparrow}}\n\\newunicodechar{↓}{\\ensuremath{\\downarrow}}\n\\newunicodechar{∑}{\\ensuremath{\\sum}}\n\\newunicodechar{ƒ}{\\ensuremath{f}}\n\\newunicodechar{⚙}{设置}' : ''}
\\usepackage{fancyhdr}
\\usepackage{lastpage}
${useFloat}${draftComments ? '\\usepackage[colorinlistoftodos,textsize=footnotesize]{todonotes}\n' : ''}\\usepackage[hidelinks]{hyperref}
\\usepackage[nameinlink]{cleveref}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{Team \\#~${escapeLatex(manifest.teamControlNumber)}}
\\fancyhead[R]{Page \\thepage\\ of \\pageref{LastPage}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\setlength{\\headheight}{15pt}

\\captionsetup{font=small,labelfont=bf}
\\captionsetup[table]{position=below,skip=8pt}
\\renewcommand{\\arraystretch}{1.15}
\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,breakatwhitespace=true,columns=fullflexible,keepspaces=true}
`
}

function summarySheetHeader(manifest: PaperManifest): string {
  const problem = escapeLatex(manifest.problem)
  const team = escapeLatex(manifest.teamControlNumber)
  const contest = escapeLatex(`${manifest.year} ${manifest.contest}`)
  const title = (manifest.title ?? '').trim()
  // summary 页不显示页眉（官方模板原样）；问题号/队号为红色大字
  return `\\thispagestyle{empty}
\\noindent
\\begin{minipage}[t]{0.3\\textwidth}\\centering
\\textbf{Problem Chosen}\\\\[2pt]
{\\Huge\\bfseries\\color{red} ${problem}}
\\end{minipage}%
\\begin{minipage}[t]{0.4\\textwidth}\\centering
\\textbf{${contest}}\\\\
\\textbf{Summary Sheet}
\\end{minipage}%
\\begin{minipage}[t]{0.3\\textwidth}\\centering
\\textbf{Team Control Number}\\\\[2pt]
{\\Huge\\bfseries\\color{red} ${team}}
\\end{minipage}
\\par\\vspace{6pt}\\hrule\\vspace{14pt}${
    title ? `\n\\begin{center}\n{\\large\\bfseries ${escapeLatex(title)}}\n\\end{center}` : ''
  }`
}

function keywordsLine(manifest: PaperManifest): string | null {
  const keywords = (manifest.keywords ?? []).map((k) => k.trim()).filter(Boolean)
  if (keywords.length === 0) return null
  return `\\vspace{0.4cm}\n\\noindent\\textbf{Keywords: } ${keywords.map(escapeLatex).join(', ')}`
}

function formatReference(ref: Reference): string {
  const parts: string[] = []
  if (ref.authors) parts.push(escapeLatex(ref.authors) + ',')
  parts.push("``" + escapeLatex(ref.title) + ",''")
  if (ref.container) parts.push(`\\textit{${escapeLatex(ref.container)}},`)
  if (ref.year) parts.push(`${escapeLatex(ref.year)}.`)
  let entry = `\\bibitem{${ref.key}} ${parts.join(' ')}`
  if (ref.url) {
    entry += ` \\url{${ref.url}}`
    if (ref.accessed) entry += ` (accessed ${escapeLatex(ref.accessed)})`
    entry += '.'
  }
  if (ref.note) entry += ` ${escapeLatex(ref.note)}`
  return entry
}

/**
 * 组装整篇论文：
 *   Summary Sheet（第 1 页）→ 目录（可选）→ 正文 → \appendix 附录
 *   → thebibliography → AI Use Report（\label{sec:aireport} 供页数统计）
 */
export function assemblePaper(input: AssembleInput): AssembledLatex {
  const { manifest, sections, references } = input
  const draft = manifest.export.draftComments
  // Cover titles, captions, citations and draft comments as well as body text.
  const content = JSON.stringify({
    manifest, references, comments: input.commentTexts,
    docs: sections.map(s => s.doc?.toJSON()),
  })
  const engine = /[\u3400-\u9fff]/u.test(content) ? 'xelatex' : manifest.export.engine
  const chunks: Array<{ text: string; sectionId?: string }> = []

  chunks.push({ text: preamble(manifest, draft, engine) })
  chunks.push({ text: '\\begin{document}\n' })

  const latexOpts = (numbered: boolean) => ({
    numberedHeadings: numbered,
    draftComments: draft,
    commentTexts: input.commentTexts,
    floatPlacement: manifest.export.floatPlacement === 'here' ? 'H' : 'htbp',
  })

  /** summary/ai-report 的首个 H1 是文件标题，正文中不重复输出 */
  const dropLeadingH1 = (doc: PMNode): PMNode => {
    if (doc.childCount > 0 && doc.child(0).type.name === 'heading' && doc.child(0).attrs.level === 1) {
      return doc.type.create(doc.attrs, doc.content.cut(doc.child(0).nodeSize))
    }
    return doc
  }

  let appendixEmitted = false
  for (const { meta, doc } of sections) {
    switch (meta.role) {
      case 'summary': {
        chunks.push({ text: summarySheetHeader(manifest) })
        if (doc) chunks.push({ text: docToLatex(dropLeadingH1(doc), latexOpts(false)), sectionId: meta.id })
        const keywords = keywordsLine(manifest)
        if (keywords) chunks.push({ text: keywords })
        chunks.push({ text: '\\newpage\n' })
        if (manifest.export.toc) {
          // 紧凑模式目录用小字号省空间
          const toc =
            manifest.export.layout === 'compact'
              ? '\\begingroup\\small\n\\tableofcontents\n\\endgroup\n\\newpage\n'
              : '\\tableofcontents\n\\newpage\n'
          chunks.push({ text: toc })
        }
        break
      }
      case 'body': {
        if (doc) chunks.push({ text: docToLatex(doc, latexOpts(true)), sectionId: meta.id })
        break
      }
      case 'appendix': {
        if (!appendixEmitted) {
          chunks.push({ text: '\\appendix' })
          appendixEmitted = true
        }
        if (doc) chunks.push({ text: docToLatex(doc, latexOpts(true)), sectionId: meta.id })
        break
      }
      case 'references': {
        if (references.length > 0) {
          const items = references.map(formatReference).join('\n\n')
          chunks.push({
            text: `\\begin{thebibliography}{${references.length >= 10 ? '99' : '9'}}\n${items}\n\\end{thebibliography}`,
            sectionId: meta.id,
          })
        }
        break
      }
      case 'ai-report': {
        chunks.push({ text: '\\newpage\n\\section*{AI Use Report}\\label{sec:aireport}' })
        if (doc) chunks.push({ text: docToLatex(dropLeadingH1(doc), latexOpts(false)), sectionId: meta.id })
        break
      }
    }
  }

  chunks.push({ text: '\\end{document}' })

  // 拼接并生成行号映射
  const lineMap: AssembledLatex['lineMap'] = []
  const parts: string[] = []
  let line = 1
  for (const chunk of chunks) {
    if (chunk.sectionId) lineMap.push({ line, sectionId: chunk.sectionId })
    parts.push(chunk.text)
    line += chunk.text.split('\n').length + 1 // +1 是块间空行
  }
  return { tex: parts.join('\n\n') + '\n', lineMap, engine }
}

/** 导出前置检查：CJK 字符在 pdflatex 下无法编译 */
export function lintSections(sections: Array<{ id: string; title: string; md: string }>): string[] {
  const warnings: string[] = []
  for (const s of sections) {
    if (/[一-鿿぀-ヿ가-힯]/.test(s.md)) {
      warnings.push(`章节「${s.title}」包含中日韩字符，pdflatex 无法编译（论文需用英文撰写）`)
    }
  }
  return warnings
}
