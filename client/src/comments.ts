// 批注工具函数：锚点提取、md 级 mark 清除
import { Transform } from '@tiptap/pm/transform'
import type { Node as PMNode } from '@tiptap/pm/model'
import { docToMd, getPaperSchema, mdToDoc } from '@himcm/shared'

export interface CommentAnchor {
  sectionId: string
  text: string
}

/** 从全部章节文档中提取批注锚点（id → 所在章节 + 当前文本） */
export function collectAnchors(sections: Array<{ id: string; doc: PMNode }>): Record<string, CommentAnchor> {
  const anchors: Record<string, CommentAnchor> = {}
  for (const { id, doc } of sections) {
    doc.descendants((node) => {
      if (!node.isText) return true
      for (const mark of node.marks) {
        if (mark.type.name !== 'comment') continue
        const cid = String(mark.attrs.commentId)
        const existing = anchors[cid]
        if (existing && existing.sectionId === id) existing.text += node.text ?? ''
        else if (!existing) anchors[cid] = { sectionId: id, text: node.text ?? '' }
      }
      return true
    })
  }
  return anchors
}

/** 生成批注 id */
export function newCommentId(): string {
  return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** 在 md 层面移除指定批注 mark（用于非活动章节的批注删除） */
export function removeCommentFromMd(md: string, commentId: string): string {
  const doc = mdToDoc(md)
  const markType = getPaperSchema().marks.comment!
  const tr = new Transform(doc)
  // 收集范围后统一移除（位置在只删 mark 时不变）
  const ranges: Array<{ from: number; to: number }> = []
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    if (node.marks.some((m) => m.type === markType && m.attrs.commentId === commentId)) {
      ranges.push({ from: pos, to: pos + node.nodeSize })
    }
    return true
  })
  if (ranges.length === 0) return md
  for (const { from, to } of ranges) {
    tr.removeMark(from, to, markType.create({ commentId }))
  }
  return docToMd(tr.doc)
}
