// git 提交图谱的 lane 布局：输入 topo 序提交（新→旧），输出每行的轨道信息。
// 线性历史 = 单轨竖线；外部创建的分支/合并也能正确铺轨。
import type { GitLogEntry } from '@himcm/shared'

export interface GraphEdge {
  from: number
  to: number
}

export interface GraphRow {
  /** 本提交圆点所在轨道 */
  dotLane: number
  /** 行上半部（上一行底 → 本行圆点/穿过）的连线 */
  top: GraphEdge[]
  /** 行下半部（本行圆点/穿过 → 下一行顶）的连线 */
  bottom: GraphEdge[]
  /** 本行涉及的最大轨道数（算 svg 宽度） */
  laneCount: number
}

export type CommitKind = 'review' | 'restore' | 'init' | 'normal'

export function classifyCommit(message: string): CommitKind {
  if (/送审|提交评审/.test(message)) return 'review'
  if (/^(\[[^\]]+\] )?还原项目至/.test(message)) return 'restore'
  if (/初始化论文/.test(message)) return 'init'
  return 'normal'
}

/** 还原提交消息里的目标短哈希（可点击跳转） */
export function restoreTargetOf(message: string): string | null {
  const m = message.match(/还原项目至 ([0-9a-f]{7,})/)
  return m?.[1] ?? null
}

export function layoutGraph(entries: GitLogEntry[]): GraphRow[] {
  // lanes[i] = 该轨道正在等待的提交哈希（null = 空闲）
  const lanes: Array<string | null> = []
  const rows: GraphRow[] = []

  for (const entry of entries) {
    const top: GraphEdge[] = []
    const bottom: GraphEdge[] = []

    // 等待本提交的所有轨道在上半部汇入圆点；其它轨道直穿
    let dotLane = lanes.indexOf(entry.hash)
    const isNewTip = dotLane < 0 // 分支顶端：上方没有连线
    if (isNewTip) {
      dotLane = lanes.indexOf(null)
      if (dotLane < 0) {
        dotLane = lanes.length
        lanes.push(entry.hash)
      } else {
        lanes[dotLane] = entry.hash
      }
    }
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === null) continue
      if (lanes[i] === entry.hash) {
        if (!(isNewTip && i === dotLane)) top.push({ from: i, to: dotLane })
        if (i !== dotLane) lanes[i] = null
      } else {
        top.push({ from: i, to: i })
      }
    }

    // 圆点向下延伸到各父提交的轨道
    const [firstParent, ...extraParents] = entry.parents
    lanes[dotLane] = firstParent ?? null
    if (firstParent) bottom.push({ from: dotLane, to: dotLane })
    for (const parent of extraParents) {
      let target = lanes.indexOf(parent)
      if (target < 0) {
        target = lanes.indexOf(null)
        if (target < 0) {
          target = lanes.length
          lanes.push(parent)
        } else {
          lanes[target] = parent
        }
      }
      bottom.push({ from: dotLane, to: target })
    }
    // 其它非空轨道直穿下半部
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] !== null && i !== dotLane) bottom.push({ from: i, to: i })
    }
    // 回收尾部空轨道
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()

    const laneCount = Math.max(
      dotLane + 1,
      lanes.length,
      ...top.map((e) => Math.max(e.from, e.to) + 1),
      ...bottom.map((e) => Math.max(e.from, e.to) + 1)
    )
    rows.push({ dotLane, top, bottom, laneCount })
  }
  return rows
}
