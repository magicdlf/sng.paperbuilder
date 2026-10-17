import { afterEach, describe, expect, it, vi } from 'vitest'
import { mdToDoc, type SectionCounters } from '@himcm/shared'
import { buildDecorations } from './numberingPlugin.ts'

const counters: SectionCounters = {
  fig: 0, tbl: 0, eq: 0, heading: [0, 0, 0], appendix: false, numbered: true,
}
const md = `| A | B |
| --- | --- |
| 1 | 2 |

Table: First {#tbl:first}

| C | D |
| --- | --- |
| 3 | 4 |

Table: Second {#tbl:second}

![One](assets/one.png){#fig:one}

![Two](assets/two.png){#fig:two}

$$
x=1
$$ {#eq:one}

$$
y=2
$$ {#eq:two}
`

afterEach(() => vi.unstubAllGlobals())

function rendered(start = counters) {
  vi.stubGlobal('document', { createElement: () => ({ className: '', textContent: '', title: '' }) })
  const decorations = buildDecorations(mdToDoc(md), start, null).find()
  // ProseMirror invokes these callbacks after traversal, not at construction time.
  return decorations.map(decoration => {
    const { type } = decoration as unknown as { type: { toDOM: () => { textContent: string } } }
    return type.toDOM().textContent
  })
}

describe('deferred numbering widgets', () => {
  it('keeps each table, figure and equation number instead of the final count', () => {
    expect(rendered()).toEqual(expect.arrayContaining(['Table 1: First', 'Table 2: Second', 'Figure 1: ', 'Figure 2: ', '(1)', '(2)']))
  })

  it('preserves the preceding chapter offsets on rebuild', () => {
    expect(rendered({ ...counters, tbl: 5, fig: 3, eq: 8 })).toEqual(expect.arrayContaining([
      'Table 6: First', 'Table 7: Second', 'Figure 4: ', 'Figure 5: ', '(9)', '(10)',
    ]))
  })
})
