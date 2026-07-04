import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitCommitResult, GitLogEntry, GitStatusResult } from '@himcm/shared'

const execFileAsync = promisify(execFile)
const SEP = '\x1f'

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
    if (!(await this.isRepo())) return { isRepo: false, changedFiles: [] }
    const out = await this.git(['status', '--porcelain'])
    const changedFiles = out
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
    return { isRepo: true, changedFiles }
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
