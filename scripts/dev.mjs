// 开发/生产启动器：同时拉起 server(tsx) 与 client(vite)，Ctrl+C 一起退出。
// 用法：npm run dev [-- --paper <论文目录>] [--port 4870]
//       npm start  （生产：只起 server，托管 client/dist）
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const prod = args.includes('--prod')

function argValue(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

// --paper 不给时由 server 决定（上次打开的论文，或 ~/HiMCMPapers/demo）
const paperDir = argValue('--paper', process.env.HIMCM_PAPER || '')
const port = argValue('--port', process.env.HIMCM_PORT || '4870')

// Invoke JS entrypoints with this Node runtime, avoiding Unix-only .bin shims.
const tool = (name) => path.join(root, 'node_modules', ...(
  name === 'tsx' ? ['tsx', 'dist', 'cli.mjs'] : ['vite', 'bin', 'vite.js']
))
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
  child.on('error', (err) => {
    console.error(prefix(err.message))
    shutdown()
  })
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

const serverArgs = ['src/index.ts', '--port', port]
if (paperDir) serverArgs.push('--paper', path.resolve(paperDir))
run(
  'server',
  process.execPath,
  [tool('tsx'), ...(prod ? serverArgs : ['watch', ...serverArgs])],
  path.join(root, 'server'),
  prod ? { NODE_ENV: 'production' } : {}
)
if (!prod) {
  run('client', process.execPath, [tool('vite'), '--strictPort'], path.join(root, 'client'), { HIMCM_PORT: port })
} else {
  console.log(`生产模式：打开 http://localhost:${port}`)
}
