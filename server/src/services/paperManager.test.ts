import { describe, it, expect } from 'vitest'
import { mkdtemp, access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PaperManager } from './paperManager.ts'
import { createApp } from '../app.ts'

describe('explicit paper directories', () => {
  it('starts idle without creating a paper, and the picker API works', async () => {
    const manager = new PaperManager(path.resolve('template'))
    await manager.initial(null)
    expect(manager.currentDir).toBeNull()
    expect(await manager.list()).toEqual([])
    const app = createApp({ manager, clientDist: null })
    expect(await (await app.request('/api/papers')).json()).toEqual({ current: null, papers: [] })
    expect((await app.request('/api/project')).status).toBe(404)
  })

  it('opening a missing directory does not silently recreate it', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'paperbuilder-path-'))
    const missing = path.join(tmp, 'missing')
    const manager = new PaperManager(path.resolve('template'))
    await expect(manager.open(missing)).rejects.toThrow('没有 paper.json')
    await expect(access(missing)).rejects.toThrow()
    await expect(manager.open('relative-path')).rejects.toThrow('绝对路径')
  })
})
