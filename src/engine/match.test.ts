import { describe, expect, it } from 'vitest'
import type { Word } from '../schema'
import { buildMatch, checkMatch, DEFAULT_PAIR_COUNT } from './match'
import { createRng } from './rng'

function makeWord(id: string, lemma: string, meaning: string[]): Word {
  return {
    id,
    lemma,
    pos: 'noun',
    reading: '',
    meaning,
    tags: [],
    rel: [],
    uncertain: false,
    note: '',
  }
}

function makeWords(count: number): Word[] {
  const words: Word[] = []
  for (let i = 0; i < count; i += 1) {
    words.push(makeWord(`w${i}`, `lemma${i}`, [`meaning${i}`]))
  }
  return words
}

function sortedIds(ids: string[]): string[] {
  return [...ids].sort()
}

describe('buildMatch', () => {
  it('8 words → 5 pairs, orders are permutations of pair ids', () => {
    const words = makeWords(8)
    const question = buildMatch(words, createRng(42))
    expect(question, `input: ${JSON.stringify(words)}`).not.toBeNull()
    if (question === null) {
      return
    }
    expect(question.pairs.length, `input: ${JSON.stringify(words)}`).toBe(DEFAULT_PAIR_COUNT)
    const pairIds = question.pairs.map((p) => p.id)
    expect(sortedIds(question.foreignOrder), `input: ${JSON.stringify(words)}`).toEqual(
      sortedIds(pairIds),
    )
    expect(sortedIds(question.nativeOrder), `input: ${JSON.stringify(words)}`).toEqual(
      sortedIds(pairIds),
    )
  })

  it('3 words → 3 pairs', () => {
    const words = makeWords(3)
    const question = buildMatch(words, createRng(1))
    expect(question, `input: ${JSON.stringify(words)}`).not.toBeNull()
    if (question === null) {
      return
    }
    expect(question.pairs.length, `input: ${JSON.stringify(words)}`).toBe(3)
  })

  it('1 word → null', () => {
    const words = makeWords(1)
    const question = buildMatch(words, createRng(1))
    expect(question, `input: ${JSON.stringify(words)}`).toBeNull()
  })

  it('0 words → null', () => {
    const words: Word[] = []
    const question = buildMatch(words, createRng(1))
    expect(question, `input: ${JSON.stringify(words)}`).toBeNull()
  })

  it('pairCount 3 → 3 pairs', () => {
    const words = makeWords(8)
    const question = buildMatch(words, createRng(1), 3)
    expect(question, `input: ${JSON.stringify(words)}`).not.toBeNull()
    if (question === null) {
      return
    }
    expect(question.pairs.length, `input: ${JSON.stringify(words)}`).toBe(3)
  })

  it('duplicate meaning[0] → only the first is used', () => {
    const words = [
      makeWord('w1', 'a', ['apple']),
      makeWord('w2', 'b', ['Apple']),
      makeWord('w3', 'c', ['banana']),
    ]
    const question = buildMatch(words, createRng(1))
    expect(question, `input: ${JSON.stringify(words)}`).not.toBeNull()
    if (question === null) {
      return
    }
    const ids = question.pairs.map((p) => p.id)
    expect(ids, `input: ${JSON.stringify(words)}`).toEqual(['w1', 'w3'])
  })

  it('duplicate meaning[0] → fewer than 2 after dedup → null', () => {
    const words = [makeWord('w1', 'a', ['apple']), makeWord('w2', 'b', ['Apple'])]
    const question = buildMatch(words, createRng(1))
    expect(question, `input: ${JSON.stringify(words)}`).toBeNull()
  })

  it('excludes words with empty lemma or empty meaning[0]', () => {
    const words = [
      makeWord('w1', '', ['apple']),
      makeWord('w2', 'b', ['']),
      makeWord('w3', 'c', ['banana']),
      makeWord('w4', 'd', ['cherry']),
    ]
    const question = buildMatch(words, createRng(1))
    expect(question, `input: ${JSON.stringify(words)}`).not.toBeNull()
    if (question === null) {
      return
    }
    const ids = question.pairs.map((p) => p.id)
    expect(ids, `input: ${JSON.stringify(words)}`).toEqual(['w3', 'w4'])
  })

  it('foreignOrder and nativeOrder differ for 200 seeds (2+ pairs)', () => {
    const words = makeWords(8)
    for (let seed = 0; seed < 200; seed += 1) {
      const question = buildMatch(words, createRng(seed))
      expect(question, `seed: ${seed}`).not.toBeNull()
      if (question === null) {
        continue
      }
      const same =
        question.foreignOrder.length === question.nativeOrder.length &&
        question.foreignOrder.every((id, i) => id === question.nativeOrder[i])
      expect(
        same,
        `seed: ${seed}, foreignOrder: ${JSON.stringify(question.foreignOrder)}, nativeOrder: ${JSON.stringify(question.nativeOrder)}`,
      ).toBe(false)
    }
  })

  it('same seed → same result', () => {
    const words = makeWords(8)
    const a = buildMatch(words, createRng(123))
    const b = buildMatch(words, createRng(123))
    expect(a, `words: ${JSON.stringify(words)}`).toEqual(b)
  })

  it('does not mutate input', () => {
    const words = makeWords(8)
    const snapshot = JSON.parse(JSON.stringify(words))
    buildMatch(words, createRng(7))
    expect(words, `snapshot: ${JSON.stringify(snapshot)}`).toEqual(snapshot)
  })
})

describe('checkMatch', () => {
  const question = {
    pairs: [
      { id: 'w1', foreign: 'a', native: 'apple' },
      { id: 'w2', foreign: 'b', native: 'banana' },
    ],
  }

  it('correct pair → true', () => {
    const input = { question, foreignId: 'w1', nativeId: 'w1' }
    expect(checkMatch(question, 'w1', 'w1'), `input: ${JSON.stringify(input)}`).toBe(true)
  })

  it('incorrect pair → false', () => {
    const input = { question, foreignId: 'w1', nativeId: 'w2' }
    expect(checkMatch(question, 'w1', 'w2'), `input: ${JSON.stringify(input)}`).toBe(false)
  })

  it('non-existent id → false', () => {
    const input = { question, foreignId: 'w9', nativeId: 'w9' }
    expect(checkMatch(question, 'w9', 'w9'), `input: ${JSON.stringify(input)}`).toBe(false)
  })
})
