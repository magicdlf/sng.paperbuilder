import { Hono } from 'hono'
import type { CommentsFile, ReferencesFile } from '@himcm/shared'
import { HttpError, type ProjectStore } from '../services/projectStore.ts'
import type { GitService } from '../services/gitService.ts'

export interface ApiContext {
  store: ProjectStore
  git: GitService
}

export function apiRoutes(ctx: ApiContext): Hono {
  const api = new Hono()
  const { store, git } = ctx

  // ---- 项目 ----

  api.get('/project', async (c) => {
    const snapshot = await store.snapshot()
    return c.json(snapshot)
  })

  api.patch('/project', async (c) => {
    const patch = await c.req.json()
    const manifest = await store.updateProject(patch)
    return c.json({ manifest })
  })

  // ---- 章节 ----

  api.post('/sections', async (c) => {
    const body = await c.req.json<{ title?: string; afterId?: string }>()
    const title = (body.title ?? '').trim()
    if (!title) throw new HttpError(400, '标题不能为空')
    const result = await store.createSection(title, body.afterId)
    return c.json(result)
  })

  api.put('/sections/:id', async (c) => {
    const body = await c.req.json<{ md?: string }>()
    if (typeof body.md !== 'string') throw new HttpError(400, '缺少 md 字段')
    const section = await store.writeSection(c.req.param('id'), body.md)
    return c.json({ section })
  })

  api.delete('/sections/:id', async (c) => {
    const manifest = await store.deleteSection(c.req.param('id'))
    return c.json({ manifest })
  })

  // ---- 资源 ----

  api.post('/assets', async (c) => {
    const form = await c.req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new HttpError(400, '缺少文件字段 file')
    const buf = new Uint8Array(await file.arrayBuffer())
    if (buf.byteLength > 20 * 1024 * 1024) throw new HttpError(400, '文件超过 20MB')
    const rel = await store.saveAsset(file.name || 'image.png', buf)
    return c.json({ path: rel })
  })

  // ---- 批注 & 参考文献 ----

  api.get('/comments', async (c) => c.json(await store.loadComments()))
  api.put('/comments', async (c) => {
    const body = await c.req.json<CommentsFile>()
    await store.saveComments(body)
    return c.json({ ok: true })
  })

  api.get('/references', async (c) => c.json(await store.loadReferences()))
  api.put('/references', async (c) => {
    const body = await c.req.json<ReferencesFile>()
    await store.saveReferences(body)
    return c.json({ ok: true })
  })

  // ---- git ----

  api.get('/git/status', async (c) => c.json(await git.status()))

  api.get('/git/log', async (c) => {
    const file = c.req.query('file') || undefined
    return c.json({ entries: await git.log(file) })
  })

  api.get('/git/diff', async (c) => {
    const diff = await git.diff(
      c.req.query('from') || undefined,
      c.req.query('to') || undefined,
      c.req.query('file') || undefined
    )
    return c.json({ diff })
  })

  api.get('/git/show', async (c) => {
    const rev = c.req.query('rev')
    const file = c.req.query('file')
    if (!rev || !file) throw new HttpError(400, '需要 rev 与 file 参数')
    return c.json({ content: await git.showFile(rev, file) })
  })

  api.post('/git/commit', async (c) => {
    const body = await c.req.json<{ message?: string }>()
    const message = (body.message ?? '').trim()
    if (!message) throw new HttpError(400, '提交说明不能为空')
    return c.json(await git.commitAll(message))
  })

  api.post('/git/restore', async (c) => {
    const body = await c.req.json<{ rev?: string; file?: string }>()
    if (!body.rev || !body.file) throw new HttpError(400, '需要 rev 与 file')
    await git.restoreFile(body.rev, body.file)
    return c.json({ ok: true })
  })

  // ---- 导出（M3 实现） ----

  api.post('/export', (c) => c.json({ error: 'LaTeX 导出尚未实现（M3）' }, 501))

  return api
}
