import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { mdToDoc } from '../parse.ts'
import { docToMd } from '../serialize.ts'

const corpusDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'corpus')
const files = readdirSync(corpusDir).filter((f) => f.endsWith('.md'))

describe('markdown round-trip', () => {
  for (const file of files) {
    const src = readFileSync(path.join(corpusDir, file), 'utf8')

    it(`${file}: 幂等（规范形再序列化不变）`, () => {
      const c1 = docToMd(mdToDoc(src))
      const c2 = docToMd(mdToDoc(c1))
      expect(c2).toBe(c1)
    })

    it(`${file}: 解析稳定（规范形与原文解析出相同文档）`, () => {
      const d1 = mdToDoc(src)
      const c1 = docToMd(d1)
      const d2 = mdToDoc(c1)
      expect(d2.toJSON()).toEqual(d1.toJSON())
    })
  }
})

describe('构件语义', () => {
  it('行内公式解析出 inlineMath 节点', () => {
    const doc = mdToDoc('One $x^2$ here.\n')
    let found = ''
    doc.descendants((n) => {
      if (n.type.name === 'inlineMath') found = n.attrs.latex
    })
    expect(found).toBe('x^2')
  })

  it('货币 $5 … $6 不是公式', () => {
    const doc = mdToDoc('Costs $5 now and $6 later.\n')
    let count = 0
    doc.descendants((n) => {
      if (n.type.name === 'inlineMath') count++
    })
    expect(count).toBe(0)
  })

  it('块公式 label 落在 blockMath.attrs.label', () => {
    const doc = mdToDoc('$$\nX=1\n$$ {#eq:x}\n')
    let label: string | null = null
    doc.descendants((n) => {
      if (n.type.name === 'blockMath') label = n.attrs.label
    })
    expect(label).toBe('eq:x')
  })

  it('figure 属性齐全', () => {
    const doc = mdToDoc('![cap](assets/a.png){#fig:a width=60%}\n')
    let attrs: Record<string, unknown> | null = null
    doc.descendants((n) => {
      if (n.type.name === 'figure') attrs = n.attrs
    })
    expect(attrs).toMatchObject({ src: 'assets/a.png', label: 'fig:a', width: 60 })
  })

  it('表格题注与对齐', () => {
    const doc = mdToDoc('| a | b |\n| :---: | --- |\n| 1 | 2 |\n\nTable: Cap {#tbl:t}\n')
    let attrs: Record<string, unknown> | null = null
    doc.descendants((n) => {
      if (n.type.name === 'table') attrs = n.attrs
    })
    expect(attrs).toMatchObject({ caption: 'Cap', label: 'tbl:t', aligns: ['center', 'left'] })
  })

  it('crossRef 与 citation 区分', () => {
    const doc = mdToDoc('See [@fig:a] and [@smith2020; @b2021].\n')
    const found: string[] = []
    doc.descendants((n) => {
      if (n.type.name === 'crossRef') found.push(`ref:${n.attrs.target}`)
      if (n.type.name === 'citation') found.push(`cite:${(n.attrs.keys as string[]).join(',')}`)
    })
    expect(found).toEqual(['ref:fig:a', 'cite:smith2020,b2021'])
  })

  it('批注 mark 带 commentId', () => {
    const doc = mdToDoc('Hi <span data-comment-id="c_1">there</span>.\n')
    let id = ''
    doc.descendants((n) => {
      const m = n.marks.find((m) => m.type.name === 'comment')
      if (m) id = m.attrs.commentId
    })
    expect(id).toBe('c_1')
  })

  it('标题 label 解析并保留层级', () => {
    const doc = mdToDoc('## Model {#sec:model}\n')
    let attrs: Record<string, unknown> | null = null
    doc.descendants((n) => {
      if (n.type.name === 'heading') attrs = n.attrs
    })
    expect(attrs).toMatchObject({ level: 2, label: 'sec:model' })
  })
})
