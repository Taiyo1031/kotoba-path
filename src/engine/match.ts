import type { Word } from '../schema'
import type { MatchPair, MatchQuestion } from './types'
import { sample, shuffle } from './rng'

export const DEFAULT_PAIR_COUNT = 5

// nativeOrder を最大何回シャッフルし直すか
const MAX_NATIVE_RESHUFFLE = 5

// 候補を抽出: lemma と meaning[0] が空でなく、meaning[0] が(小文字化して)未出現。元の順を保つ
function selectCandidates(words: ReadonlyArray<Word>): Word[] {
  const seen = new Set<string>()
  const candidates: Word[] = []
  for (const word of words) {
    const firstMeaning = word.meaning[0]
    if (word.lemma === '' || firstMeaning === undefined || firstMeaning === '') {
      continue
    }
    const key = firstMeaning.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    candidates.push(word)
  }
  return candidates
}

// 2つの配列が同じ並びかどうか
function sameOrder(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

export function buildMatch(
  words: ReadonlyArray<Word>,
  rng: () => number,
  pairCount?: number,
): MatchQuestion | null {
  const count = pairCount ?? DEFAULT_PAIR_COUNT
  const candidates = selectCandidates(words)
  if (candidates.length < 2) {
    return null
  }
  const chosen = candidates.length <= count ? candidates : sample(candidates, count, rng)
  const pairs: MatchPair[] = chosen.map((word) => {
    const firstMeaning = word.meaning[0]
    return { id: word.id, foreign: word.lemma, native: firstMeaning ?? '' }
  })
  const ids = pairs.map((pair) => pair.id)
  const foreignOrder = shuffle(ids, rng)
  let nativeOrder = shuffle(ids, rng)
  if (pairs.length >= 2) {
    let attempts = 0
    while (sameOrder(foreignOrder, nativeOrder) && attempts < MAX_NATIVE_RESHUFFLE) {
      nativeOrder = shuffle(ids, rng)
      attempts += 1
    }
    if (sameOrder(foreignOrder, nativeOrder)) {
      const first = nativeOrder[0]
      if (first !== undefined) {
        nativeOrder = [...nativeOrder.slice(1), first]
      }
    }
  }
  return { format: 'match', pairs, foreignOrder, nativeOrder }
}

export function checkMatch(
  question: Pick<MatchQuestion, 'pairs'>,
  foreignId: string,
  nativeId: string,
): boolean {
  if (foreignId !== nativeId) {
    return false
  }
  return question.pairs.some((pair) => pair.id === foreignId)
}
