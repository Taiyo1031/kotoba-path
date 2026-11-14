// tsc を全体に対して1回走らせ、指定したファイルに関するエラーだけを報告する。
// 並行実行中の他タスクの「未完成のファイル」のエラーを無視して、自分のタスクの型だけを判定するため。
// 使い方: node scripts/typecheck-files.mjs src/engine/rng.ts src/engine/rng.test.ts
import { spawnSync } from 'node:child_process'

const files = process.argv.slice(2).map((f) => f.replaceAll('\\', '/'))
if (files.length === 0) {
  console.error('使い方: node scripts/typecheck-files.mjs <file>...')
  process.exit(2)
}

const result = spawnSync(
  'npx',
  ['tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'],
  {
    encoding: 'utf8',
    shell: true,
  },
)
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
const lines = output.split('\n').map((l) => l.replaceAll('\r', ''))

// 「path(行,列): error TSxxxx: ...」の行と、それに続くインデント行(詳細)を、指定ファイルのぶんだけ集める。
const mine = []
let keep = false
for (const line of lines) {
  const m = /^(.+?)\(\d+,\d+\): error TS\d+/.exec(line)
  if (m) {
    keep = files.some((f) => m[1].replaceAll('\\', '/').endsWith(f))
    if (keep) mine.push(line)
  } else if (keep && /^\s/.test(line)) {
    mine.push(line)
  }
}

if (mine.length > 0) {
  console.error(mine.join('\n'))
  console.error(`\n型エラー: 指定ファイルに ${mine.filter((l) => /error TS/.test(l)).length} 件`)
  process.exit(1)
}
console.log(`OK: 指定ファイル(${files.length}件)に型エラーはありません`)
