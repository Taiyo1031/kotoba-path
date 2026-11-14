// Markdown 内の ```json ブロックがすべて JSON として解析できるかを確認する。
// 使い方: node scripts/check-md-json.mjs docs/data-format.md
import { readFileSync, existsSync } from 'node:fs'

const file = process.argv[2]
if (!file || !existsSync(file)) {
  console.error(`ファイルが見つかりません: ${file ?? '(未指定)'}`)
  process.exit(1)
}

const text = readFileSync(file, 'utf8')
const lineCount = text.split('\n').length
if (lineCount < 40) {
  console.error(`内容が少なすぎます: ${lineCount} 行(期待: 40行以上)`)
  process.exit(1)
}

const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)]
if (blocks.length === 0) {
  console.error('```json ブロックが1つもありません')
  process.exit(1)
}

let failed = 0
blocks.forEach((match, index) => {
  try {
    JSON.parse(match[1])
  } catch (error) {
    failed += 1
    console.error(`json ブロック ${index + 1} が不正です: ${error.message}`)
    console.error(`入力(先頭200文字): ${match[1].slice(0, 200)}`)
  }
})

if (failed > 0) process.exit(1)
console.log(`OK: ${file} (${lineCount} 行, json ブロック ${blocks.length} 個)`)
