// M2 验收脚本：模拟“编辑器打开章节→立即保存”的生产路径。
// 对论文目录中每个章节：读 md → mdToDoc → docToMd → 写回。
// 若 round-trip 幂等，git diff 应为零变化。
// 用法：npx tsx scripts/simulate-editor-save.ts <论文目录>
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { mdToDoc, docToMd } from '@himcm/shared'

const paperDir = process.argv[2]
if (!paperDir) {
  console.error('用法: npx tsx scripts/simulate-editor-save.ts <论文目录>')
  process.exit(1)
}

const all = process.argv.includes('--all')

let files: string[]
if (all) {
  const { readdirSync } = await import('node:fs')
  files = readdirSync(path.join(paperDir, 'sections'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join('sections', f))
} else {
  const manifest = JSON.parse(readFileSync(path.join(paperDir, 'paper.json'), 'utf8')) as {
    sections: Array<{ id: string; file: string | null }>
  }
  files = manifest.sections.flatMap((s) => (s.file ? [s.file] : []))
}

for (const file of files) {
  const abs = path.join(paperDir, file)
  const md = readFileSync(abs, 'utf8')
  const roundTripped = docToMd(mdToDoc(md))
  writeFileSync(abs, roundTripped)
  console.log(`${file}: ${md === roundTripped ? '不变' : '已改写'}`)
}
