import type {
  CommentsFile,
  CompileResult,
  GitCommitResult,
  GitLogEntry,
  GitStatusResult,
  PaperListItem,
  PaperManifest,
  ProjectSnapshot,
  ReferencesFile,
  SectionContent,
} from '@himcm/shared'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* 非 JSON 错误体 */
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const api = {
  project: () => request<ProjectSnapshot>('/api/project'),
  patchProject: (patch: Record<string, unknown>) =>
    request<{ manifest: PaperManifest }>('/api/project', jsonInit('PATCH', patch)),

  saveSection: (id: string, md: string, baseHash?: string, force?: boolean) =>
    request<{ section: SectionContent }>(
      `/api/sections/${encodeURIComponent(id)}`,
      jsonInit('PUT', { md, baseHash, force })
    ),
  addMember: (user: string) => request('/members', jsonInit('POST', { user })),
  patchSectionMeta: (id: string, patch: { user: string; claimed?: boolean; status?: string }) =>
    request<{ meta: unknown }>(`/api/sections/${encodeURIComponent(id)}/meta`, jsonInit('PATCH', patch)),
  createSection: (title: string, afterId?: string) =>
    request<{ manifest: PaperManifest; section: SectionContent }>('/api/sections', jsonInit('POST', { title, afterId })),
  deleteSection: (id: string) =>
    request<{ manifest: PaperManifest }>(`/api/sections/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  uploadAsset: async (file: File): Promise<{ path: string }> => {
    const form = new FormData()
    form.append('file', file)
    return request<{ path: string }>('/api/assets', { method: 'POST', body: form })
  },

  comments: () => request<CommentsFile>('/api/comments'),
  saveComments: (file: CommentsFile) => request<{ ok: true }>('/api/comments', jsonInit('PUT', file)),

  references: () => request<ReferencesFile>('/api/references'),
  saveReferences: (file: ReferencesFile) => request<{ ok: true }>('/api/references', jsonInit('PUT', file)),

  gitStatus: () => request<GitStatusResult>('/api/git/status'),
  gitLog: (file?: string) =>
    request<{ entries: GitLogEntry[] }>(`/api/git/log${file ? `?file=${encodeURIComponent(file)}` : ''}`),
  gitDiff: (params: { from?: string; to?: string; file?: string }) => {
    const q = new URLSearchParams()
    if (params.from) q.set('from', params.from)
    if (params.to) q.set('to', params.to)
    if (params.file) q.set('file', params.file)
    return request<{ diff: string }>(`/api/git/diff?${q}`)
  },
  gitShow: (rev: string, file: string) =>
    request<{ content: string }>(`/api/git/show?rev=${encodeURIComponent(rev)}&file=${encodeURIComponent(file)}`),
  gitCommit: (message: string) => request<GitCommitResult>('/api/git/commit', jsonInit('POST', { message })),
  gitRestore: (rev: string, file: string) =>
    request<{ ok: true }>('/api/git/restore', jsonInit('POST', { rev, file })),
  gitCheckout: (rev: string) => request<{ ok: true }>('/api/git/checkout', jsonInit('POST', { rev })),
  gitCheckoutLatest: () => request<{ ok: true }>('/api/git/checkout-latest', jsonInit('POST', {})),
  gitRevertTo: (rev: string, message?: string) =>
    request<GitCommitResult>('/api/git/revert-to', jsonInit('POST', { rev, message })),

  compile: () => request<CompileResult>('/api/export', jsonInit('POST', { compile: true })),
  exportTex: () => request<{ texPath: string; warnings: string[] }>('/api/export', jsonInit('POST', { compile: false })),

  papers: () => request<{ current: string | null; papers: PaperListItem[] }>('/api/papers'),
  createPaper: (dir: string) => request<{ dir: string }>('/api/papers', jsonInit('POST', { dir })),
  openPaper: (dir: string) => request<{ dir: string }>('/api/papers/open', jsonInit('POST', { dir })),
}
