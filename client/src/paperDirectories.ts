const KEY = 'paperbuilder.directories.v1'
const LAST = 'paperbuilder.lastDirectory.v1'

export function paperDirectories(): string[] {
  try {
    const dirs: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(dirs) ? [...new Set(dirs.filter((d): d is string => typeof d === 'string' && d.trim().length > 0))] : []
  } catch { return [] }
}

export function lastPaperDirectory(): string | null {
  try { return localStorage.getItem(LAST) } catch { return null }
}

export function rememberPaperDirectory(dir: string): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([dir, ...paperDirectories()])]))
    localStorage.setItem(LAST, dir)
    return true
  } catch { return false }
}

export function forgetPaperDirectory(dir: string): void {
  localStorage.setItem(KEY, JSON.stringify(paperDirectories().filter(d => d !== dir)))
  if (lastPaperDirectory() === dir) localStorage.removeItem(LAST)
}
