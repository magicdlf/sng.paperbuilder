/** Git merge markers must never be normalized by the rich-text editor. */
export function hasGitConflictMarkers(text: string): boolean {
  return /^(?:<{7,}|>{7,}|\|{7,})(?: .*)?\r?$/m.test(text)
}
