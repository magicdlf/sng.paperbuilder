import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ProjectStore } from './projectStore.ts'

const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'paperbuilder-collaboration-'))
  roots.push(dir)
  const store = new ProjectStore(dir)
  await store.ensure(path.resolve('template'))
  const manifest = await store.loadManifest()
  const section = manifest.sections.find(s => s.role === 'body')!
  section.owner = '旧成员'
  section.status = 'review'
  manifest.members = ['旧成员']
  await store.saveManifest(manifest)
  return { store, dir, id: section.id }
}
const run = promisify(execFile)
async function git(dir: string, ...args: string[]) {
  return run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: dir })
}
describe('personal collaboration records and v1 compatibility', () => {
  it('merges real Git branches containing simultaneous claims without a conflict', async () => {
    const { store, dir, id } = await fixture()
    await git(dir, 'init', '-b', 'main')
    await git(dir, 'add', '.')
    await git(dir, 'commit', '-m', 'baseline')
    await git(dir, 'checkout', '-b', 'alice')
    await store.updateSectionMeta(id, { user: 'Alice', claimed: true, status: 'done' })
    await git(dir, 'add', 'collaboration')
    await git(dir, 'commit', '-m', 'Alice claims chapter')
    await git(dir, 'checkout', 'main')
    await store.updateSectionMeta(id, { user: 'Bob', claimed: true, status: 'review' })
    await git(dir, 'add', 'collaboration')
    await git(dir, 'commit', '-m', 'Bob claims chapter')
    await git(dir, 'merge', '--no-edit', 'alice')
    expect((await git(dir, 'status', '--porcelain')).stdout).toBe('')
    expect((await store.snapshot()).sections.find(s => s.id === id)?.owners)
      .toEqual(expect.arrayContaining(['Alice', 'Bob', '旧成员']))
  })
  it('opens old papers without migration or rewriting the manifest', async () => {
    const { store, dir, id } = await fixture()
    const before = await readFile(path.join(dir, 'paper.json'), 'utf8')
    const section = (await store.snapshot()).sections.find(s => s.id === id)!
    expect(section.owners).toEqual(['旧成员'])
    expect(section.status).toBe('review')
    await store.recordCollaboration('新成员')
    await store.updateSectionMeta(id, { user: '新成员', claimed: true, status: 'done' })
    expect(await readFile(path.join(dir, 'paper.json'), 'utf8')).toBe(before)
    expect((await store.loadManifest()).version).toBe(1)
    expect((await store.snapshot()).manifest.members).toContain('新成员')
  })

  it('combines independent clones without shared file writes and retains both claims', async () => {
    const { store, dir, id } = await fixture()
    const other = await mkdtemp(path.join(os.tmpdir(), 'paperbuilder-clone-'))
    roots.push(other)
    await cp(dir, other, { recursive: true })
    const clone = new ProjectStore(other)
    await store.updateSectionMeta(id, { user: 'Alice', claimed: true, status: 'done' })
    await clone.updateSectionMeta(id, { user: 'Bob', claimed: true, status: 'draft' })
    // Git merges independent added paths as the union of both trees.
    await cp(path.join(other, 'collaboration'), path.join(dir, 'collaboration'), { recursive: true })
    const section = (await store.snapshot()).sections.find(s => s.id === id)!
    expect(section.owners).toEqual(expect.arrayContaining(['Alice', 'Bob', '旧成员']))
    expect(section.contributions?.find(c => c.user === 'Alice')?.status).toBe('done')
    expect(section.contributions?.find(c => c.user === 'Bob')?.status).toBe('draft')
    await store.updateSectionMeta(id, { user: '旧成员', claimed: false })
    expect((await store.snapshot()).sections.find(s => s.id === id)?.status).toBe('draft')
    await store.updateSectionMeta(id, { user: 'Alice', claimed: false })
    expect((await store.snapshot()).sections.find(s => s.id === id)?.owners).toEqual(['Bob'])
  })

  it('preserves old client edits as a baseline, and own explicit withdrawal wins', async () => {
    const { store, id } = await fixture()
    await store.updateSectionMeta(id, { user: '旧成员', claimed: false })
    const manifest = await store.loadManifest()
    manifest.sections.find(s => s.id === id)!.owner = '另一旧版成员'
    await store.saveManifest(manifest)
    expect((await store.snapshot()).sections.find(s => s.id === id)?.owners).toEqual(['另一旧版成员'])
    manifest.sections.find(s => s.id === id)!.owner = '旧成员'
    await store.saveManifest(manifest)
    expect((await store.snapshot()).sections.find(s => s.id === id)?.owners).toEqual([])
  })

  it('orders sequential actions even with equal or backwards clock times; saved text retains metadata', async () => {
    const { store, id } = await fixture()
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    await store.updateSectionMeta(id, { user: 'Alice', claimed: true, status: 'review' })
    vi.spyOn(Date, 'now').mockReturnValue(500)
    await store.updateSectionMeta(id, { user: 'Alice', status: 'done' })
    const saved = await store.writeSection(id, '# Edited\n')
    expect(saved.owners).toContain('Alice')
    expect(saved.contributions?.find(c => c.user === 'Alice')?.status).toBe('done')
  })

  it('rejects anonymous writes, validates status, and safely handles usernames as data', async () => {
    const { store, dir, id } = await fixture()
    await expect(store.updateSectionMeta(id, { user: '', claimed: true })).rejects.toThrow('用户名')
    await expect(store.updateSectionMeta(id, { user: 'Alice', status: 'bad' as never })).rejects.toThrow('状态')
    await store.updateSectionMeta(id, { user: '../../你好:Windows?', claimed: true })
    const dirs = await readdir(path.join(dir, 'collaboration'))
    expect(dirs).toHaveLength(1)
    expect(dirs[0]).toMatch(/^[a-f0-9]{64}$/)
    // Incomplete atomic-write files are never read as events.
    await writeFile(path.join(dir, 'collaboration', dirs[0]!, 'partial.json.tmp'), '{')
    expect((await store.snapshot()).manifest.members).toContain('../../你好:Windows?')
  })
})
