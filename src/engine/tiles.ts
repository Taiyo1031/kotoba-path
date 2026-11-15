// 並べ替え(tiles)問題の生成と判定(仕様 6.7)。純粋関数のみ。
import type { TilesQuestion } from './types'
import { sample, shuffle } from './rng'

// 語の前後から取り除く句読点(仕様: 半角・全角の記号)
const PUNCTUATION = new Set([
  '.',
  ',',
  '!',
  '?',
  ';',
  ':',
  '"',
  "'",
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '。',
  '、',
  '！',
  '？',
  '「',
  '」',
])

// 語の前後の句読点を取り除く(中身の記号は残す)
function stripPunctuation(word: string): string {
  let start = 0
  let end = word.length
  while (start < end && PUNCTUATION.has(word.charAt(start))) {
    start += 1
  }
  while (end > start && PUNCTUATION.has(word.charAt(end - 1))) {
    end -= 1
  }
  return word.slice(start, end)
}

// 空白(全角含む)で分け、前後の句読点を除去し、空になった語を捨てる
export function tokenize(text: string): string[] {
  const result: string[] = []
  for (const word of text.split(/\s+/)) {
    const cleaned = stripPunctuation(word)
    if (cleaned !== '') {
      result.push(cleaned)
    }
  }
  return result
}

// NFC に正規化して小文字にする(比較用)
export function normalizeToken(token: string): string {
  return token.normalize('NFC').toLowerCase()
}

// 配列が同じ並びか(要素をそのまま比較)
function sameOrder(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if ((a[i] as string) !== (b[i] as string)) {
      return false
    }
  }
  return true
}

// 配列が normalizeToken で同じ並びか
function sameNormalizedOrder(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (normalizeToken(a[i] as string) !== normalizeToken(b[i] as string)) {
      return false
    }
  }
  return true
}

export interface TilesSource {
  id: string
  target: string
  meaning: string
}

export interface TilesOptions {
  rng: () => number
  decoyWords?: ReadonlyArray<string>
  acceptedTargets?: ReadonlyArray<string>
}

export function buildTiles(source: TilesSource, options: TilesOptions): TilesQuestion {
  const answer = tokenize(source.target)
  const prompt = source.meaning
  const itemId = source.id

  // ダミー候補: answer と(normalizeToken で)重複しない語を重複なく選ぶ
  const answerSet = new Set(answer.map(normalizeToken))
  const seen = new Set<string>()
  const candidates: string[] = []
  for (const word of options.decoyWords ?? []) {
    const normalized = normalizeToken(word)
    if (answerSet.has(normalized) || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    candidates.push(word)
  }

  // 個数: answer が 3 語以下なら 1 個、4 語以上なら 2 個
  const count = answer.length <= 3 ? 1 : 2
  const decoys = sample(candidates, count, options.rng)

  // タイルをシャッフル。ダミー 0 個で answer が 2 語以上なら、answer と同じ並びにならないようにする
  let tiles = shuffle([...answer, ...decoys], options.rng)
  if (decoys.length === 0 && answer.length >= 2) {
    let reshuffles = 0
    while (sameOrder(tiles, answer) && reshuffles < 5) {
      tiles = shuffle([...answer, ...decoys], options.rng)
      reshuffles += 1
    }
    if (sameOrder(tiles, answer)) {
      tiles = [...tiles.slice(1), tiles[0] as string]
    }
  }

  // 別解: answer と同じ並びは除き、重複(normalizeToken で)を除く
  const accepted: string[][] = []
  const seenAccepted = new Set<string>()
  for (const target of options.acceptedTargets ?? []) {
    const tokens = tokenize(target)
    if (sameNormalizedOrder(tokens, answer)) {
      continue
    }
    const key = tokens.map(normalizeToken).join('\u0000')
    if (seenAccepted.has(key)) {
      continue
    }
    seenAccepted.add(key)
    accepted.push(tokens)
  }

  return {
    format: 'tiles',
    itemId,
    prompt,
    tiles,
    answer,
    accepted,
  }
}

// selected の語の並びが answer または accepted のいずれかと一致すれば true
export function checkTiles(
  question: Pick<TilesQuestion, 'answer' | 'accepted'>,
  selected: ReadonlyArray<string>,
): boolean {
  if (sameNormalizedOrder(selected, question.answer)) {
    return true
  }
  for (const accepted of question.accepted) {
    if (sameNormalizedOrder(selected, accepted)) {
      return true
    }
  }
  return false
}
