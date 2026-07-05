import { createContext, useContext } from 'react'
import type { LabelIndex, Reference } from '@himcm/shared'

export interface NumberingData {
  labelIndex: LabelIndex
  /** 当前章节 id（查 sectionStart 起点） */
  sectionId: string
  /** 参考文献顺序：key → 编号（1-based） */
  refOrder: Record<string, number>
  references: Reference[]
  /** 可作为搬运目标的章节（manifest 顺序，含标题） */
  sections: Array<{ id: string; title: string }>
  /** 把 pos 处的图搬到目标章节末尾 */
  onMoveFigureToSection?: (figurePos: number, targetSectionId: string) => void
  /** open 状态的批注 id：只有这些锚点渲染高亮（resolved 收起，reopen 恢复） */
  openCommentIds: string[]
}

export const NumberingContext = createContext<NumberingData | null>(null)

export function useNumbering(): NumberingData | null {
  return useContext(NumberingContext)
}
