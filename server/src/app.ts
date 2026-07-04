import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import { HttpError, type ProjectStore } from './services/projectStore.ts'
import type { GitService } from './services/gitService.ts'
import type { LatexService } from './services/latexService.ts'
import { apiRoutes } from './routes/api.ts'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

async function serveFile(absPath: string, extraHeaders: Record<string, string> = {}): Promise<Response | null> {
  try {
    const data = await fs.readFile(absPath)
    const type = MIME[path.extname(absPath).toLowerCase()] ?? 'application/octet-stream'
    return new Response(new Uint8Array(data), { headers: { 'content-type': type, ...extraHeaders } })
  } catch {
    return null
  }
}

export interface AppContext {
  store: ProjectStore
  git: GitService
  latex: LatexService
  /** 生产模式下 client/dist 的路径；dev 模式为 null（由 vite 托管前端） */
  clientDist: string | null
}

export function createApp(ctx: AppContext): Hono {
  const app = new Hono()

  app.onError((err, c) => {
    const status = err instanceof HttpError ? err.status : 500
    return c.json({ error: err.message || '服务器内部错误' }, status as 400)
  })

  app.route('/api', apiRoutes(ctx))

  // 论文图片资源（防目录穿越）
  app.get('/assets/*', async (c) => {
    const rel = decodeURIComponent(c.req.path.replace(/^\/assets\//, ''))
    const root = path.join(ctx.store.paperDir, 'assets')
    const abs = path.resolve(root, rel)
    if (!abs.startsWith(root + path.sep)) return c.json({ error: '路径不合法' }, 400)
    const res = await serveFile(abs)
    return res ?? c.json({ error: '资源不存在' }, 404)
  })

  // 编译出的 PDF（M3 起可用）
  app.get('/pdf', async (c) => {
    const abs = path.join(ctx.store.paperDir, 'build', 'paper.pdf')
    const res = await serveFile(abs, { 'cache-control': 'no-store' })
    return res ?? c.json({ error: 'PDF 尚未编译' }, 404)
  })

  // 生产模式：托管 client/dist（SPA fallback 到 index.html）
  if (ctx.clientDist) {
    const dist = ctx.clientDist
    app.get('*', async (c) => {
      const rel = decodeURIComponent(c.req.path).replace(/^\/+/, '')
      if (rel && !rel.includes('..')) {
        const res = await serveFile(path.join(dist, rel))
        if (res) return res
      }
      const index = await serveFile(path.join(dist, 'index.html'))
      return index ?? c.text('client 尚未构建，请先运行 npm run build', 404)
    })
  }

  return app
}
