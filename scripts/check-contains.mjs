// ファイルが存在し、最低の行数があり、必要な文字列をすべて含むかを確認する(文書・設定ファイルの合格判定用)。
// 使い方: node scripts/check-contains.mjs <file> <最低行数> <必要な文字列>...
import { existsSync, readFileSync } from 'node:fs'

const [file, minLinesText, ...needles] = process.argv.slice(2)
if (!file || !minLinesText) {
  console.error('使い方: node scripts/check-contains.mjs <file> <最低行数> <必要な文字列>...')
  process.exit(2)
}
if (!existsSync(file)) {
  console.error(`ファイルが見つかりません: ${file}`)
  process.exit(1)
}

const text = readFileSync(file, 'utf8')
const lines = text.split('\n').length
const minLines = Number(minLinesText)
const problems = []
if (lines < minLines) problems.push(`行数が少なすぎます: ${lines} 行(期待: ${minLines} 行以上)`)
for (const needle of needles) {
  if (!text.includes(needle)) problems.push(`必要な文字列がありません: ${needle}`)
}
if (problems.length > 0) {
  console.error(`${file}:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`OK: ${file} (${lines} 行、必要な文字列 ${needles.length} 個)`)
