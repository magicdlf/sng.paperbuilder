const TEXT_MAP: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '#': '\\#',
  $: '\\$',
  '%': '\\%',
  '&': '\\&',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
}

/** 文本模式转义（数学与 verbatim 内容不经过此函数） */
export function escapeLatex(text: string): string {
  return text.replace(/[\\#$%&_{}~^]/g, (ch) => TEXT_MAP[ch]!)
}

/** \href 第一参数中的 URL 转义 */
export function escapeUrl(url: string): string {
  return url.replace(/[%#{}\\]/g, (ch) => (ch === '\\' ? '\\textbackslash{}' : '\\' + ch))
}
