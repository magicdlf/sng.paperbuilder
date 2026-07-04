import { createContext, useContext } from 'react'
import type { LabelIndex, Reference } from '@himcm/shared'

export interface NumberingData {
  labelIndex: LabelIndex
  /** 当前章节 id（查 sectionStart 起点） */
  sectionId: string
  /** 参考文献顺序：key → 编号（1-based） */
  refOrder: Record<string, number>
  references: Reference[]
}

export const NumberingContext = createContext<NumberingData | null>(null)

export function useNumbering(): NumberingData | null {
  return useContext(NumberingContext)
}
