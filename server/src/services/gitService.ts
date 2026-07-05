import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitCommitResult, GitLogEntry, GitStatusResult } from '@himcm/shared'

const execFileAsync = promisify(execFile)
const SEP = '\x1f'
/** 浏览历史版本前自动暂存未提交更改的标记 */
const BROWSE_STASH = 'himcm-browse-autostash'

/** 对论文目录的 git 操作。全部经 execFile 直调（无 shell，参数即字面量）。 */
export class GitService {
  constructor(readonly dir: string) {}

  private async git(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: this.dir,
        maxBuffer: 32 * 1024 * 1024,
      })
      return stdout
    } catch (err) {
      const e = err as { stderr?: string; message?: string }
      throw new Error(`git ${args[0]} 失败: ${(e.stderr || e.message || '').trim()}`)
    }
  }

  async isRepo(): Promise<boolean> {
    try {
      await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: this.dir })
      return true
    } catch {
      return false
    }
  }

  /** 确保仓库存在且能提交（无全局身份时写入仓库级身份） */
  async ensureRepo(): Promise<void> {
    if (!(await this.isRepo())) {
      await this.git(['init'])
    }
    try {
      const email = (await this.git(['config', 'user.email'])).trim()
      if (!email) throw new Error('empty')
    } catch {
      await this.git(['config', 'user.email', 'himcm@local'])
      await this.git(['config', 'user.name', 'HiMCM Editor'])
    }
  }

  async status(): Promise<GitStatusResult> {
    if (!(await this.isRepo())) {
      return { isRepo: false, changedFiles: [], detached: false, headHash: null, branch: null, browseStashed: false }
    }
    const out = await this.git(['status', '--porcelain'])
    const changedFiles = out
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim())

    let branch: string | null = null
    try {
      branch = (await this.git(['symbolic-ref', '-q', '--short', 'HEAD'])).trim() || null
    } catch {
      branch = null // detached HEAD
    }
    let headHash: string | null = null
    try {
      headHash = (await this.git(['rev-parse', 'HEAD'])).trim()
    } catch {
      headHash = null // 空仓库
    }
    let browseStashed = false
    try {
      const stashes = await this.git(['stash', 'list', '--format=%gs'])
      browseStashed = stashes.split('\n')[0]?.includes(BROWSE_STASH) ?? false
    } catch {
      /* 无 stash */
    }
    return {
      isRepo: true,
      changedFiles,
      detached: branch === null && headHash !== null,
      headHash,
      branch,
      browseStashed,
    }
  }

  /**
   * 浏览历史版本（detached HEAD）。
   * 未提交的更改（批注、草稿等）自动暂存，回到最新时自动恢复——
   * 浏览期间界面只读且 server 拒绝写入，保证恢复时永不冲突。
   */
  async checkout(rev: string): Promise<{ stashed: boolean }> {
    const st = await this.status()
    let stashed = false
    if (st.changedFiles.length > 0) {
      await this.git(['stash', 'push', '--include-untracked', '-m', BROWSE_STASH])
      stashed = true
    }
    await this.git(['checkout', rev])
    return { stashed }
  }

  /** 回到最新（唯一分支的顶端），并恢复浏览前暂存的未提交更改 */
  async checkoutLatest(): Promise<void> {
    const branches = (await this.git(['branch', '--format=%(refname:short)']))
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const branch = branches.includes('main') ? 'main' : branches.includes('master') ? 'master' : branches[0]
    if (!branch) throw new Error('仓库没有分支')
    await this.git(['checkout', branch])
    try {
      const stashes = await this.git(['stash', 'list', '--format=%gs'])
      if (stashes.split('\n')[0]?.includes(BROWSE_STASH)) {
        await this.git(['stash', 'pop'])
      }
    } catch {
      /* 无 stash 可恢复 */
    }
  }

  /**
   * 把整个项目还原到某版本并作为新提交（历史继续向前）。
   * 注意：rev 之后新增且 rev 中不存在的文件会保留（不做删除，安全优先）。
   */
  async revertProjectTo(rev: string, message: string): Promise<GitCommitResult> {
    const st = await this.status()
    if (st.detached) await this.checkoutLatest()
    await this.git(['restore', '--source', rev, '--', '.'])
    return this.commitAll(message)
  }

  async commitAll(message: string): Promise<GitCommitResult> {
    const status = await this.status()
    if (!status.isRepo) throw new Error('论文目录不是 git 仓库')
    if (status.changedFiles.length === 0) return { committed: false, hash: null }
    await this.git(['add', '-A'])
    await this.git(['commit', '-m', message])
    const hash = (await this.git(['rev-parse', 'HEAD'])).trim()
    return { committed: true, hash }
  }

  async log(file?: string, limit = 200): Promise<GitLogEntry[]> {
    if (!(await this.isRepo())) return []
    const args = ['log', `-n${limit}`, `--pretty=format:%H${SEP}%aI${SEP}%an${SEP}%s`]
    if (file) args.push('--', file)
    let out = ''
    try {
      out = await this.git(args)
    } catch {
      return [] // 空仓库（无提交）
    }
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash = '', date = '', author = '', message = ''] = line.split(SEP)
        return { hash, date, author, message }
      })
  }

  /**
   * 统一 diff：
   * - from+to：两个提交之间
   * - 仅 from：该提交与工作区之间
   * - 都不传：HEAD 与工作区之间
   */
  async diff(from?: string, to?: string, file?: string): Promise<string> {
    const args = ['diff']
    if (from && to) args.push(from, to)
    else if (from) args.push(from)
    else args.push('HEAD')
    if (file) args.push('--', file)
    return this.git(args)
  }

  async showFile(rev: string, file: string): Promise<string> {
    return this.git(['show', `${rev}:${file}`])
  }

  async restoreFile(rev: string, file: string): Promise<void> {
    await this.git(['restore', '--source', rev, '--', file])
  }
}
