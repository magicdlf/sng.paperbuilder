import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import os from 'node:os'
import path from 'node:path'
import { PaperManager } from './paperManager.ts'
import { createApp } from '../app.ts'
import { hasGitConflictMarkers } from '@himcm/shared'

const run = promisify(execFile)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))) })
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'paperbuilder-git-conflict-'))
  dirs.push(dir)
  const manager = new PaperManager(path.resolve('template'))
  await manager.open(dir, true)
  const git = (...args: string[]) => run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: dir })
  await git('init', '-b', 'main')
  const store = manager.current.store
  const section = (await store.loadManifest()).sections.find(s => s.role === 'body')!
  const file = path.join(dir, section.file!)
  const base = '# Practice\n\nModel: pending\n\nKeep one\n\nKeep two\n\nKeep three\n\nResults: pending\n'
  await writeFile(file, base)
  await git('add', '.')
  await git('commit', '-m', 'baseline')
  return { dir, manager, store, git, file, section, base, app: createApp({ manager, clientDist: null }) }
}

describe('Git case safety', () => {
  it('keeps real conflicting text readable, blocks saves/force/commit/export, then resumes after resolution', async () => {
    const { manager, store, git, file, section, base, app } = await fixture()
    await git('checkout', '-b', 'alice')
    await writeFile(file, base.replace('Model: pending', 'Model: Alice'))
    await git('commit', '-am', 'Alice')
    await git('checkout', 'main')
    await writeFile(file, base.replace('Model: pending', 'Model: Bob'))
    await git('commit', '-am', 'Bob')
    await expect(git('merge', '--no-edit', 'alice')).rejects.toThrow()
    const raw = await readFile(file, 'utf8')
    expect(hasGitConflictMarkers(raw)).toBe(true)
    const response = await app.request('/api/project')
    expect(response.status).toBe(200)
    const snap = await response.json()
    expect(snap.gitConflicts).toContain(section.file)
    expect(snap.sections.find((s: { id: string }) => s.id === section.id).gitConflict).toBe(true)
    for (const force of [false, true]) {
      const result = await app.request(`/api/sections/${section.id}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ md: 'overwrite', force }),
      })
      expect(result.status).toBe(409)
      await expect(store.writeSection(section.id, 'overwrite', undefined, force)).rejects.toThrow('Git 冲突')
    }
    const browse = await app.request('/api/git/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rev: 'HEAD' }) })
    expect(browse.status).toBe(409)
    await expect(manager.current.git.commitAll('must not stage conflict')).rejects.toThrow('合并尚未解决')
    await expect(manager.current.latex.exportTex()).rejects.toThrow('Git 冲突')
    expect(await readFile(file, 'utf8')).toBe(raw)
    await writeFile(file, base.replace('Model: pending', 'Model: Alice and Bob'))
    await git('add', section.file!)
    await git('commit', '-m', 'resolve together')
    const resolved = await store.snapshot()
    expect(resolved.gitConflicts).toEqual([])
    expect(resolved.sections.find(s => s.id === section.id)?.gitConflict).toBe(false)
    await expect(store.writeSection(section.id, base)).resolves.toBeDefined()
  })

  it('automatically merges separated edits within one Markdown file', async () => {
    const { store, git, file, section, base } = await fixture()
    await git('checkout', '-b', 'alice')
    await writeFile(file, base.replace('Model: pending', 'Model: Alice'))
    await git('commit', '-am', 'model')
    await git('checkout', 'main')
    await writeFile(file, base.replace('Results: pending', 'Results: Bob'))
    await git('commit', '-am', 'results')
    await git('merge', '--no-edit', 'alice')
    const snapshot = await store.snapshot()
    const md = snapshot.sections.find(s => s.id === section.id)!.md
    expect(md).toContain('Model: Alice')
    expect(md).toContain('Results: Bob')
    expect(snapshot.gitConflicts).toEqual([])
    expect(hasGitConflictMarkers(md)).toBe(false)
  })

  it('can still open a paper with conflicting manifest JSON using its committed structure', async () => {
    const { dir, app, git } = await fixture()
    const file = path.join(dir, 'paper.json')
    const original = await readFile(file, 'utf8')
    await git('checkout', '-b', 'alice')
    await writeFile(file, original.replace('0000000', '1111111'))
    await git('commit', '-am', 'Alice team')
    await git('checkout', 'main')
    await writeFile(file, original.replace('0000000', '2222222'))
    await git('commit', '-am', 'Bob team')
    await expect(git('merge', '--no-edit', 'alice')).rejects.toThrow()
    const response = await app.request('/api/project')
    expect(response.status).toBe(200)
    const snapshot = await response.json()
    expect(snapshot.gitConflicts).toContain('paper.json')
    expect(snapshot.manifest.teamControlNumber).toBe('2222222')
    const patch = await app.request('/api/project', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'overwrite' }) })
    expect(patch.status).toBe(409)
    expect(hasGitConflictMarkers(await readFile(file, 'utf8'))).toBe(true)
  })
})
