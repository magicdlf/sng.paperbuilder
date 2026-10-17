/** Display names only: macOS Option is represented by Alt in keyboard events. */
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

export function shortcut(key: string, modifier: 'mod' | 'alt' = 'mod'): string {
  return `${modifier === 'alt' ? (isMac ? 'Option' : 'Alt') : (isMac ? '⌘' : 'Ctrl')}+${key}`
}
