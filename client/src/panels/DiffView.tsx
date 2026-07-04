interface DiffLine {
  type: 'add' | 'del' | 'ctx' | 'meta'
  oldNo: number | null
  newNo: number | null
  text: string
}

interface DiffFile {
  path: string
  lines: DiffLine[]
}

/** 解析 unified diff（git diff 输出） */
export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = []
  let current: DiffFile | null = null
  let oldNo = 0
  let newNo = 0

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      const m = raw.match(/ b\/(.+)$/)
      current = { path: m?.[1] ?? raw.slice(11), lines: [] }
      files.push(current)
      continue
    }
    if (!current) continue
    if (raw.startsWith('index ') || raw.startsWith('--- ') || raw.startsWith('+++ ') || raw.startsWith('new file') || raw.startsWith('deleted file')) {
      continue
    }
    const hunk = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      current.lines.push({ type: 'meta', oldNo: null, newNo: null, text: `⋯${hunk[3] ?? ''}` })
      continue
    }
    if (raw.startsWith('+')) {
      current.lines.push({ type: 'add', oldNo: null, newNo: newNo++, text: raw.slice(1) })
    } else if (raw.startsWith('-')) {
      current.lines.push({ type: 'del', oldNo: oldNo++, newNo: null, text: raw.slice(1) })
    } else if (raw.startsWith(' ') || raw === '') {
      current.lines.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: raw.slice(1) })
    }
    // 其它行（\ No newline 等）忽略
  }
  return files
}

export function DiffView({ diff }: { diff: string }) {
  const files = parseUnifiedDiff(diff)
  if (files.length === 0) {
    return <div className="diff-empty">无差异</div>
  }
  return (
    <div className="diff-view">
      {files.map((file) => (
        <div key={file.path} className="diff-file">
          <div className="diff-file-header">{file.path}</div>
          <table className="diff-table">
            <tbody>
              {file.lines.map((line, i) => (
                <tr key={i} className={`diff-${line.type}`}>
                  <td className="no">{line.oldNo ?? ''}</td>
                  <td className="no">{line.newNo ?? ''}</td>
                  <td className="text">
                    <span className="sign">
                      {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
                    </span>
                    {line.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
