// 开发/生产启动器：同时拉起 server(tsx) 与 client(vite)，Ctrl+C 一起退出。
// 用法：npm run dev [-- --paper <论文目录>] [--port 4870]
//       npm start  （生产：只起 server，托管 client/dist）
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const prod = args.includes('--prod')

function argValue(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const paperDir = path.resolve(
  argValue('--paper', process.env.HIMCM_PAPER || path.join(os.homedir(), 'HiMCMPapers', 'demo'))
)
const port = argValue('--port', process.env.HIMCM_PORT || '4870')

const bin = (name) => path.join(root, 'node_modules', '.bin', name)
const children = []

function run(label, command, cmdArgs, cwd, env = {}) {
  const child = spawn(command, cmdArgs, {
    cwd,
    env: { ...process.env, ...env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const prefix = (line) => `[${label}] ${line}`
  for (const stream of ['stdout', 'stderr']) {
    let buf = ''
    child[stream].on('data', (d) => {
      buf += d.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) console.log(prefix(line))
    })
  }
  child.on('exit', (code) => {
    if (code !== null && code !== 0) console.log(prefix(`exited with code ${code}`))
    shutdown()
  })
  children.push(child)
}

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) c.kill('SIGTERM')
  setTimeout(() => process.exit(0), 300)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log(`论文目录: ${paperDir}`)
run(
  'server',
  bin('tsx'),
  prod ? ['src/index.ts', '--paper', paperDir, '--port', port] : ['watch', 'src/index.ts', '--paper', paperDir, '--port', port],
  path.join(root, 'server'),
  prod ? { NODE_ENV: 'production' } : {}
)
if (!prod) {
  run('client', bin('vite'), ['--strictPort'], path.join(root, 'client'), { HIMCM_PORT: port })
} else {
  console.log(`生产模式：打开 http://localhost:${port}`)
}
