// 编辑器内实时编号：按 manifest 顺序遍历所有章节文档，产出
//  - byLabel: label → 显示编号（交叉引用 chip 用）
//  - sectionStart: 每章开始前的计数器状态（活动编辑器从此起点继续数）
// 计数规则与 LaTeX 一致：figure/table/labeled equation 按源码顺序全局递增；
// 标题编号只在 body（1, 1.1…）与 appendix（A, A.1…）中进行。
import type { Node as PMNode } from '@tiptap/pm/model'
import type { LabelIndex, LabelEntry, SectionCounters, SectionRole } from './types.ts'

export interface SectionDoc {
  id: string
  role: SectionRole
  doc: PMNode
}

function formatHeadingNumber(counters: [number, number, number], level: number, appendix: boolean): string {
  const h1 = appendix ? String.fromCharCode(64 + counters[0]) : String(counters[0])
  if (level === 1) return h1
  if (level === 2) return `${h1}.${counters[1]}`
  return `${h1}.${counters[1]}.${counters[2]}`
}

/** 单章节内推进计数器；onLabel 收集带 label 的实体 */
export function walkSectionCounters(
  doc: PMNode,
  counters: SectionCounters,
  onLabel?: (entry: Omit<LabelEntry, 'sectionId'>) => void
): void {
  doc.descendants((node) => {
    switch (node.type.name) {
      case 'figure': {
        counters.fig++
        if (node.attrs.label) onLabel?.({ kind: 'fig', label: node.attrs.label, number: String(counters.fig) })
        return false
      }
      case 'table': {
        counters.tbl++
        if (node.attrs.label) onLabel?.({ kind: 'tbl', label: node.attrs.label, number: String(counters.tbl) })
        return true
      }
      case 'blockMath': {
        // 只有带 label 的公式进入 equation 环境获得编号
        if (node.attrs.label) {
          counters.eq++
          onLabel?.({ kind: 'eq', label: node.attrs.label, number: String(counters.eq) })
        }
        return false
      }
      case 'heading': {
        if (!counters.numbered) return false
        const level = node.attrs.level as number
        if (level === 1) {
          counters.heading[0]++
          counters.heading[1] = 0
          counters.heading[2] = 0
        } else if (level === 2) {
          counters.heading[1]++
          counters.heading[2] = 0
        } else {
          counters.heading[2]++
        }
        if (node.attrs.label) {
          onLabel?.({
            kind: 'sec',
            label: node.attrs.label,
            number: formatHeadingNumber(counters.heading, level, counters.appendix),
          })
        }
        return false
      }
      default:
        return true
    }
  })
}

export function buildLabelIndex(sections: SectionDoc[]): LabelIndex {
  const byLabel: Record<string, LabelEntry> = {}
  const sectionStart: Record<string, SectionCounters> = {}

  const counters: SectionCounters = {
    fig: 0,
    tbl: 0,
    eq: 0,
    heading: [0, 0, 0],
    appendix: false,
    numbered: false,
  }

  let enteredAppendix = false
  for (const section of sections) {
    if (section.role === 'appendix' && !enteredAppendix) {
      // 进入附录：标题计数重置为字母序
      enteredAppendix = true
      counters.heading = [0, 0, 0]
    }
    counters.appendix = section.role === 'appendix'
    counters.numbered = section.role === 'body' || section.role === 'appendix'

    sectionStart[section.id] = {
      ...counters,
      heading: [...counters.heading] as [number, number, number],
    }

    walkSectionCounters(section.doc, counters, (entry) => {
      byLabel[entry.label] = { ...entry, sectionId: section.id }
    })
  }

  return { byLabel, sectionStart }
}

/** 交叉引用 chip 的显示文本，如 "Figure 3" / "Table 2" / "Eq. (4)" / "Section 2.1" */
export function crossRefDisplay(target: string, index: LabelIndex): string {
  const entry = index.byLabel[target]
  if (!entry) return `?${target}?`
  switch (entry.kind) {
    case 'fig':
      return `Figure ${entry.number}`
    case 'tbl':
      return `Table ${entry.number}`
    case 'eq':
      return `Eq. (${entry.number})`
    case 'sec':
      return /^[A-Z]/.test(entry.number) ? `Appendix ${entry.number}` : `Section ${entry.number}`
  }
}
