import { describe, expect, it } from 'vitest'
import type { Word } from '../schema'
import { pickDistractors } from './distractors'

function w(
  id: string,
  lemma: string,
  pos: Word['pos'],
  tags: Word['tags'],
  meaning: Word['meaning'],
  rel: Word['rel'] = [],
): Word {
  return {
    id,
    lemma,
    pos,
    reading: '',
    tags,
    meaning,
    rel,
    uncertain: false,
    note: '',
  }
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function message(input: unknown, expected: unknown, actual: unknown): string {
  return `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`
}

describe('pickDistractors', () => {
  it('既定の count は 3 個で、正解を含まず重複がない', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'])
    const pool = [
      w('b', 'b', 'noun', ['x'], ['B']),
      w('c', 'c', 'noun', ['x'], ['C']),
      w('d', 'd', 'noun', ['x'], ['D']),
      w('e', 'e', 'noun', ['x'], ['E']),
      w('f', 'f', 'noun', ['x'], ['F']),
    ]
    const input = { correct, pool, options: { rng: makeRng(1) } }
    const actual = pickDistractors(correct, pool, input.options)
    const ids = actual.map((word) => word.id)

    expect(actual.length, message(input, 3, actual.length)).toBe(3)
    expect(ids.includes('a'), message(input, false, ids.includes('a'))).toBe(false)
    expect(new Set(ids).size, message(input, ids.length, new Set(ids).size)).toBe(ids.length)
  })

  it('count を指定するとその個数を選ぶ', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'])
    const pool = [
      w('b', 'b', 'noun', ['x'], ['B']),
      w('c', 'c', 'noun', ['x'], ['C']),
      w('d', 'd', 'noun', ['x'], ['D']),
    ]
    const input = { correct, pool, options: { count: 2, rng: makeRng(1) } }
    const actual = pickDistractors(correct, pool, input.options)

    expect(actual.length, message(input, 2, actual.length)).toBe(2)
  })

  it('候補が不足してもエラーにせず、あるだけ返す', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'])
    const pool = [w('b', 'b', 'noun', ['x'], ['B'])]
    const input = { correct, pool, options: { rng: makeRng(1) } }
    const actual = pickDistractors(correct, pool, input.options)

    expect(
      actual.map((word) => word.id),
      message(
        input,
        ['b'],
        actual.map((word) => word.id),
      ),
    ).toEqual(['b'])
  })

  it('候補が 0 件なら空配列を返す', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'])
    const pool: Word[] = []
    const input = { correct, pool, options: { rng: makeRng(1) } }
    const actual = pickDistractors(correct, pool, input.options)

    expect(actual, message(input, [], actual)).toEqual([])
  })

  it('層1が最優先で、confusable が related より先に選ばれる', () => {
    const correct = w(
      'a',
      'a',
      'noun',
      ['x'],
      ['A'],
      [
        { type: 'related', id: 'related' },
        { type: 'confusable', id: 'confusable' },
      ],
    )
    const pool = [
      w('confusable', 'confusable', 'noun', ['y'], ['Confusable']),
      w('related', 'related', 'noun', ['y'], ['Related']),
    ]
    const input = { correct, pool, options: { count: 1, rng: makeRng(1) } }
    const actual = pickDistractors(correct, pool, input.options)

    expect(
      actual.map((word) => word.id),
      message(
        input,
        ['confusable'],
        actual.map((word) => word.id),
      ),
    ).toEqual(['confusable'])
  })

  it('層1の type 順は confusable → antonym → synonym → related', () => {
    const correct = w(
      'a',
      'a',
      'noun',
      ['x'],
      ['A'],
      [
        { type: 'related', id: 'related' },
        { type: 'synonym', id: 'synonym' },
        { type: 'antonym', id: 'antonym' },
        { type: 'confusable', id: 'confusable' },
      ],
    )
    const pool = [
      w('related', 'related', 'noun', ['y'], ['Related']),
      w('synonym', 'synonym', 'noun', ['y'], ['Synonym']),
      w('antonym', 'antonym', 'noun', ['y'], ['Antonym']),
      w('confusable', 'confusable', 'noun', ['y'], ['Confusable']),
    ]
    const input = { correct, pool, options: { count: 4, rng: makeRng(1) } }
    const actual = pickDistractors(correct, pool, input.options)

    expect(
      actual.map((word) => word.id),
      message(
        input,
        ['confusable', 'antonym', 'synonym', 'related'],
        actual.map((word) => word.id),
      ),
    ).toEqual(['confusable', 'antonym', 'synonym', 'related'])
  })

  it('rel の参照先が pool に無ければ飛ばす', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'], [{ type: 'confusable', id: 'missing' }])
    const pool = [w('b', 'b', 'noun', ['x'], ['B'])]
    const input = { correct, pool, options: { count: 1, rng: makeRng(1) } }
    const actual = pickDistractors(correct, pool, input.options)

    expect(
      actual.map((word) => word.id),
      message(
        input,
        ['b'],
        actual.map((word) => word.id),
      ),
    ).toEqual(['b'])
  })

  it('層2は rel が無く、同じ pos・共通タグの語が層3より先に選ばれる', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'])
    const pool = [
      w('layer2', 'layer2', 'noun', ['x'], ['Layer2']),
      w('unit', 'unit', 'verb', ['y'], ['Unit']),
    ]
    const input = {
      correct,
      pool,
      options: { count: 1, rng: makeRng(1), unitWordIds: new Set(['unit']) },
    }
    const actual = pickDistractors(correct, pool, input.options)

    expect(
      actual.map((word) => word.id),
      message(
        input,
        ['layer2'],
        actual.map((word) => word.id),
      ),
    ).toEqual(['layer2'])
  })

  it('層3の語は層4のみの語より先に選ばれる', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'])
    const pool = [
      w('unit', 'unit', 'verb', ['y'], ['Unit']),
      w('learned', 'learned', 'adjective', ['z'], ['Learned']),
    ]
    const input = {
      correct,
      pool,
      options: {
        count: 2,
        rng: makeRng(1),
        unitWordIds: new Set(['unit']),
        learnedWordIds: new Set(['learned']),
      },
    }
    const actual = pickDistractors(correct, pool, input.options)

    expect(
      actual.map((word) => word.id),
      message(
        input,
        ['unit', 'learned'],
        actual.map((word) => word.id),
      ),
    ).toEqual(['unit', 'learned'])
  })

  it('同じ lemma または同じ meaning[0] の語は選ばれない', () => {
    const correct = w('a', 'same', 'noun', ['x'], ['M'])
    const pool = [
      w('same-lemma', 'same', 'noun', ['x'], ['Other']),
      w('same-meaning', 'other', 'noun', ['x'], ['M']),
      w('good', 'good', 'noun', ['x'], ['Good']),
    ]
    const input = { correct, pool, options: { count: 3, rng: makeRng(1) } }
    const actual = pickDistractors(correct, pool, input.options)

    expect(
      actual.map((word) => word.id),
      message(
        input,
        ['good'],
        actual.map((word) => word.id),
      ),
    ).toEqual(['good'])
  })

  it('同じ rng シードで同じ結果になる', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'])
    const pool = [
      w('b', 'b', 'noun', ['x'], ['B']),
      w('c', 'c', 'noun', ['x'], ['C']),
      w('d', 'd', 'noun', ['x'], ['D']),
      w('e', 'e', 'noun', ['x'], ['E']),
    ]
    const input = { correct, pool, seed: 42 }
    const actual1 = pickDistractors(correct, pool, { rng: makeRng(42) })
    const actual2 = pickDistractors(correct, pool, { rng: makeRng(42) })

    expect(actual2, message(input, actual1, actual2)).toEqual(actual1)
  })

  it('pool の入力配列を変更しない', () => {
    const correct = w('a', 'a', 'noun', ['x'], ['A'])
    const pool = [
      w('b', 'b', 'noun', ['x'], ['B']),
      w('c', 'c', 'noun', ['x'], ['C']),
      w('d', 'd', 'noun', ['x'], ['D']),
    ]
    const before = JSON.stringify(pool)
    const input = { correct, pool, options: { rng: makeRng(1) } }

    pickDistractors(correct, pool, input.options)

    expect(JSON.stringify(pool), message(input, before, JSON.stringify(pool))).toBe(before)
  })
})
