import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { ProjectStore } from './services/projectStore.ts'
import { GitService } from './services/gitService.ts'
import { LatexService } from './services/latexService.ts'
import { createApp } from './app.ts'

function argValue(name: string, fallback: string): string {
  const args = process.argv.slice(2)
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback
}

const here = path.dirname(fileURLToPath(import.meta.url))

async function main(): Promise<void> {
  const paperDir = path.resolve(argValue('--paper', process.env.HIMCM_PAPER ?? './paper'))
  const port = Number(argValue('--port', process.env.HIMCM_PORT ?? '4870'))
  const templateDir = path.resolve(here, '../../template')

  const store = new ProjectStore(paperDir)
  const created = await store.ensure(templateDir)

  const git = new GitService(paperDir)
  await git.ensureRepo()
  if (created === 'created') {
    await git.commitAll('初始化论文')
    console.log(`已创建新论文: ${paperDir}（git 已初始化并完成首次提交）`)
  } else {
    console.log(`已打开论文: ${paperDir}`)
  }

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

  const latex = new LatexService(store)
  const app = createApp({ store, git, latex, clientDist })
  serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
    console.log(`HiMCM server 运行于 http://127.0.0.1:${info.port}`)
  })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
