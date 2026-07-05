import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { PaperManager } from './services/paperManager.ts'
import { createApp } from './app.ts'

function argValue(name: string, fallback: string): string {
  const args = process.argv.slice(2)
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback
}

const here = path.dirname(fileURLToPath(import.meta.url))

async function main(): Promise<void> {
  const explicitPaper = argValue('--paper', process.env.HIMCM_PAPER ?? '') || null
  const papersRoot = path.resolve(
    argValue('--papers-root', process.env.HIMCM_PAPERS_ROOT ?? path.join(os.homedir(), 'HiMCMPapers'))
  )
  const port = Number(argValue('--port', process.env.HIMCM_PORT ?? '4870'))
  // --host 0.0.0.0 开放局域网访问（队友浏览器直连；生产模式 npm start 下前端同端口）
  const host = argValue('--host', process.env.HIMCM_HOST ?? '127.0.0.1')
  const templateDir = path.resolve(here, '../../template')

  const manager = new PaperManager(papersRoot, templateDir)
  await manager.initial(explicitPaper ? path.resolve(explicitPaper) : null)
  console.log(`论文根目录: ${papersRoot}`)

  let clientDist: string | null = null
  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve(here, '../../client/dist')
    try {
      await fs.access(path.join(dist, 'index.html'))
      clientDist = dist
    } catch {
      console.warn('client/dist 不存在，生产模式下请先 npm run build')
    }
  }

  const app = createApp({ manager, clientDist })
  serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    console.log(`HiMCM server 运行于 http://${host === '0.0.0.0' ? '<本机局域网IP>' : host}:${info.port}`)
    if (host === '0.0.0.0') console.log('已开放局域网访问：队友可用你的局域网 IP 直接打开')
  })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
