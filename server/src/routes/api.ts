import { Hono } from 'hono'
import type { CommentsFile, ReferencesFile } from '@himcm/shared'
import { HttpError } from '../services/projectStore.ts'
import type { PaperManager } from '../services/paperManager.ts'

export interface ApiContext {
  manager: PaperManager
}

export function apiRoutes(ctx: ApiContext): Hono {
  const api = new Hono()
  // 当前论文可被切换，必须每次请求时取，不可解构缓存
  const cur = () => ctx.manager.current

  // ---- 论文管理 ----

  api.get('/papers', async (c) =>
    c.json({ papersRoot: ctx.manager.papersRoot, current: cur().dir, papers: await ctx.manager.list() })
  )

  api.post('/papers', async (c) => {
    const body = await c.req.json<{ name?: string }>()
    const paper = await ctx.manager.create(body.name ?? '')
    return c.json({ dir: paper.dir })
  })

  api.post('/papers/open', async (c) => {
    const body = await c.req.json<{ dir?: string }>()
    if (!body.dir) throw new HttpError(400, '需要 dir 参数')
    const paper = await ctx.manager.open(body.dir)
    return c.json({ dir: paper.dir })
  })

  // ---- 项目 ----

  api.get('/project', async (c) => c.json(await cur().store.snapshot()))

  api.patch('/project', async (c) => {
    const patch = await c.req.json()
    const manifest = await cur().store.updateProject(patch)
    return c.json({ manifest })
  })

  // ---- 章节 ----

  api.post('/sections', async (c) => {
    const body = await c.req.json<{ title?: string; afterId?: string }>()
    const title = (body.title ?? '').trim()
    if (!title) throw new HttpError(400, '标题不能为空')
    const result = await cur().store.createSection(title, body.afterId)
    return c.json(result)
  })

  api.put('/sections/:id', async (c) => {
    const body = await c.req.json<{ md?: string; baseHash?: string; force?: boolean }>()
    if (typeof body.md !== 'string') throw new HttpError(400, '缺少 md 字段')
    const section = await cur().store.writeSection(c.req.param('id'), body.md, body.baseHash, body.force)
    return c.json({ section })
  })

  api.patch('/sections/:id/meta', async (c) => {
    const body = await c.req.json<{ owner?: string | null; status?: 'draft' | 'review' | 'done' }>()
    const meta = await cur().store.updateSectionMeta(c.req.param('id'), body)
    return c.json({ meta })
  })

  api.delete('/sections/:id', async (c) => {
    const manifest = await cur().store.deleteSection(c.req.param('id'))
    return c.json({ manifest })
  })

  // ---- 资源 ----

  api.post('/assets', async (c) => {
    const form = await c.req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new HttpError(400, '缺少文件字段 file')
    const buf = new Uint8Array(await file.arrayBuffer())
    if (buf.byteLength > 20 * 1024 * 1024) throw new HttpError(400, '文件超过 20MB')
    const rel = await cur().store.saveAsset(file.name || 'image.png', buf)
    return c.json({ path: rel })
  })

  // ---- 批注 & 参考文献 ----

  api.get('/comments', async (c) => c.json(await cur().store.loadComments()))
  api.put('/comments', async (c) => {
    const body = await c.req.json<CommentsFile>()
    await cur().store.saveComments(body)
    return c.json({ ok: true })
  })

  api.get('/references', async (c) => c.json(await cur().store.loadReferences()))
  api.put('/references', async (c) => {
    const body = await c.req.json<ReferencesFile>()
    await cur().store.saveReferences(body)
    return c.json({ ok: true })
  })

  // ---- git ----

  api.get('/git/status', async (c) => c.json(await cur().git.status()))

  api.get('/git/log', async (c) => {
    const file = c.req.query('file') || undefined
    return c.json({ entries: await cur().git.log(file) })
  })

  api.get('/git/diff', async (c) => {
    const diff = await cur().git.diff(
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
    return c.json({ content: await cur().git.showFile(rev, file) })
  })

  api.post('/git/commit', async (c) => {
    const body = await c.req.json<{ message?: string }>()
    const message = (body.message ?? '').trim()
    if (!message) throw new HttpError(400, '提交说明不能为空')
    return c.json(await cur().git.commitAll(message))
  })

  api.post('/git/restore', async (c) => {
    const body = await c.req.json<{ rev?: string; file?: string }>()
    if (!body.rev || !body.file) throw new HttpError(400, '需要 rev 与 file')
    await cur().git.restoreFile(body.rev, body.file)
    return c.json({ ok: true })
  })

  // 版本浏览与还原
  api.post('/git/checkout', async (c) => {
    const body = await c.req.json<{ rev?: string }>()
    if (!body.rev) throw new HttpError(400, '需要 rev')
    await cur().git.checkout(body.rev)
    return c.json({ ok: true })
  })

  api.post('/git/checkout-latest', async (c) => {
    await cur().git.checkoutLatest()
    return c.json({ ok: true })
  })

  api.post('/git/revert-to', async (c) => {
    const body = await c.req.json<{ rev?: string; message?: string }>()
    if (!body.rev) throw new HttpError(400, '需要 rev')
    const result = await cur().git.revertProjectTo(body.rev, body.message || `还原项目至 ${body.rev.slice(0, 7)}`)
    return c.json(result)
  })

  // ---- 导出与编译 ----

  api.post('/export', async (c) => {
    const body = await c.req.json<{ compile?: boolean }>().catch(() => ({ compile: false }))
    if (body.compile) {
      return c.json(await cur().latex.compile())
    }
    const { texPath, warnings } = await cur().latex.exportTex()
    return c.json({ texPath, warnings })
  })

  return api
}
