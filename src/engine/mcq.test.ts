import { describe, it, expect } from 'vitest'
import type { Word } from '../schema'
import type { McqDirection } from './types'
import { buildMcq } from './mcq'
import { createRng } from './rng'

function makeWord(id: string, lemma: string, meaning: string): Word {
  return {
    id,
    lemma,
    pos: 'noun',
    reading: '',
    meaning: [meaning],
    tags: ['common'],
    rel: [],
    uncertain: false,
    note: '',
  }
}

// 正解 + 誤答候補 3(見出し語・意味ともにすべて異なる)で、通常は 4 択になる pool
function makePool(): { word: Word; pool: Word[] } {
  const word = makeWord('w1', 'apple', 'りんご')
  const pool = [
    word,
    makeWord('w2', 'banana', 'バナナ'),
    makeWord('w3', 'cherry', 'さくらんぼ'),
    makeWord('w4', 'date', 'なつめ'),
  ]
  return { word, pool }
}

function build(word: Word, direction: McqDirection, pool: Word[], seed = 1) {
  return buildMcq(word, direction, { pool, rng: createRng(seed) })
}

describe('buildMcq', () => {
  it.each(['foreignToNative', 'nativeToForeign', 'audioToMeaning'] as const)(
    '%s で prompt と選択肢の text が仕様どおり(4択・正解1つ)',
    (direction) => {
      const { word, pool } = makePool()
      const q = build(word, direction, pool)

      const expectedPrompt = direction === 'nativeToForeign' ? word.meaning[0] : word.lemma
      expect(
        q.prompt,
        `入力: ${JSON.stringify({ word, direction })} 期待値: ${expectedPrompt}`,
      ).toBe(expectedPrompt)

      const texts = new Set(
        pool.map((w) => (direction === 'nativeToForeign' ? w.lemma : w.meaning[0])),
      )
      expect(
        q.options.map((o) => o.text).sort(),
        `入力: ${JSON.stringify({ word, direction })} 期待値: ${JSON.stringify([...texts].sort())}`,
      ).toEqual([...texts].sort())

      const correct = q.options.find((o) => o.id === q.correctId)
      expect(correct?.id, `入力: ${JSON.stringify({ word, direction })} 期待値: ${word.id}`).toBe(
        word.id,
      )
      expect(
        q.options.filter((o) => o.id === word.id).length,
        `入力: ${JSON.stringify({ word, direction })} 期待値: 1`,
      ).toBe(1)

      expect(q.itemId, `入力: ${JSON.stringify({ word, direction })} 期待値: ${word.id}`).toBe(
        word.id,
      )
      expect(q.format, `入力: ${JSON.stringify({ word, direction })} 期待値: 'mcq'`).toBe('mcq')
    },
  )

  it('選択肢の text に重複がない(誤答同士・正解と同じ表示は後から来た方を捨てる)', () => {
    const word = makeWord('w1', 'apple', 'りんご')
    // w2 と w3 は意味[0] が同じ「くだもの」→ 選択肢には 1 つだけ残る
    const pool = [
      word,
      makeWord('w2', 'banana', 'くだもの'),
      makeWord('w3', 'cherry', 'くだもの'),
      makeWord('w4', 'date', 'なつめ'),
    ]
    for (const direction of ['foreignToNative', 'audioToMeaning'] as const) {
      const q = build(word, direction, pool)
      const texts = q.options.map((o) => o.text)
      expect(
        new Set(texts).size,
        `入力: ${JSON.stringify({ word, direction })} 期待値: ${texts.length} 実際の選択肢: ${JSON.stringify(q.options)}`,
      ).toBe(texts.length)
      expect(
        texts.filter((t) => t === 'くだもの').length,
        `入力: ${JSON.stringify({ word, direction })} 期待値: 1 実際の選択肢: ${JSON.stringify(q.options)}`,
      ).toBe(1)
    }

    // 誤答の中に正解と同じ meaning[0] の語(w2)があっても捨てられる
    const poolSameAsCorrect = [
      makeWord('w1', 'apple', 'りんご'),
      makeWord('w2', 'banana', 'りんご'),
      makeWord('w3', 'cherry', 'さくらんぼ'),
      makeWord('w4', 'date', 'なつめ'),
    ]
    for (const direction of ['foreignToNative', 'audioToMeaning'] as const) {
      const q = build(poolSameAsCorrect[0] as Word, direction, poolSameAsCorrect)
      const texts = q.options.map((o) => o.text)
      expect(
        new Set(texts).size,
        `入力: ${JSON.stringify({ word: poolSameAsCorrect[0], direction })} 期待値: ${texts.length} 実際の選択肢: ${JSON.stringify(q.options)}`,
      ).toBe(texts.length)
      expect(
        texts.filter((t) => t === 'りんご').length,
        `入力: ${JSON.stringify({ word: poolSameAsCorrect[0], direction })} 期待値: 1 実際の選択肢: ${JSON.stringify(q.options)}`,
      ).toBe(1)
    }

    // nativeToForeign では見出し語が重複する誤答(w2/w3)を捨てる
    const poolN = [
      makeWord('w1', 'apple', 'りんご'),
      makeWord('w2', 'fruit', '果物A'),
      makeWord('w3', 'fruit', '果物B'),
      makeWord('w4', 'date', 'なつめ'),
    ]
    const qn = build(poolN[0] as Word, 'nativeToForeign', poolN)
    expect(
      new Set(qn.options.map((o) => o.text)).size,
      `入力: ${JSON.stringify({ word: poolN[0], direction: 'nativeToForeign' })} 期待値: ${qn.options.length} 実際の選択肢: ${JSON.stringify(qn.options)}`,
    ).toBe(qn.options.length)
  })

  it('候補が少ない pool(正解以外 1 語)では選択肢が 2 個', () => {
    const word = makeWord('w1', 'apple', 'りんご')
    const pool = [word, makeWord('w2', 'banana', 'バナナ')]
    for (const direction of ['foreignToNative', 'nativeToForeign', 'audioToMeaning'] as const) {
      const q = build(word, direction, pool)
      expect(
        q.options.length,
        `入力: ${JSON.stringify({ word, direction })} 期待値: 2 実際の選択肢: ${JSON.stringify(q.options)}`,
      ).toBe(2)
    }
  })

  it('候補なしでは選択肢が 1 個(エラーにならない)', () => {
    const word = makeWord('w1', 'apple', 'りんご')
    for (const direction of ['foreignToNative', 'nativeToForeign', 'audioToMeaning'] as const) {
      const q = build(word, direction, [word])
      expect(
        q.options.length,
        `入力: ${JSON.stringify({ word, direction })} 期待値: 1 実際の選択肢: ${JSON.stringify(q.options)}`,
      ).toBe(1)
      expect(
        q.options[0]?.id,
        `入力: ${JSON.stringify({ word, direction })} 期待値: ${word.id} 実際の選択肢: ${JSON.stringify(q.options)}`,
      ).toBe(word.id)
    }
  })

  it('同じシードで同じ結果、違うシードで並びが変わりうる', () => {
    const { word, pool } = makePool()
    const a = build(word, 'foreignToNative', pool, 7)
    const b = build(word, 'foreignToNative', pool, 7)
    expect(b, `入力: ${JSON.stringify({ word, seed: 7 })} 期待値: ${JSON.stringify(a)}`).toEqual(a)

    const sequences = new Set<string>()
    for (let i = 0; i < 64; i += 1) {
      const q = build(word, 'foreignToNative', pool, i)
      sequences.add(q.options.map((o) => o.id).join(','))
    }
    expect(
      sequences.size,
      `入力: ${JSON.stringify({ word })} 期待値: 2 以上 実際の異なる並び数: ${sequences.size}`,
    ).toBeGreaterThanOrEqual(2)
  })

  it('正解の位置に偏りがない(4000 シードで各位置が 0.20〜0.30)', () => {
    const { word, pool } = makePool()
    const counts = [0, 0, 0, 0]
    let total = 0
    for (let i = 0; i < 4000; i += 1) {
      const q = build(word, 'foreignToNative', pool, i)
      expect(
        q.options.length,
        `入力: ${JSON.stringify({ word, seed: i })} 期待値: 4 実際の選択肢数: ${q.options.length}`,
      ).toBe(4)
      const index = q.options.findIndex((o) => o.id === word.id)
      if (index >= 0 && counts[index] !== undefined) {
        counts[index] += 1
      }
      total += 1
    }

    for (let pos = 0; pos < 4; pos += 1) {
      const ratio = (counts[pos] ?? 0) / total
      expect(
        ratio,
        `入力: ${JSON.stringify({ word })} 位置: ${pos} 期待値: 0.20〜0.30 実際の割合: ${ratio}`,
      ).toBeGreaterThanOrEqual(0.2)
      expect(
        ratio,
        `入力: ${JSON.stringify({ word })} 位置: ${pos} 期待値: 0.20〜0.30 実際の割合: ${ratio}`,
      ).toBeLessThanOrEqual(0.3)
    }
  })

  it('distractorCount を 2 にすると選択肢が 3 個', () => {
    const { word, pool } = makePool()
    for (const direction of ['foreignToNative', 'nativeToForeign', 'audioToMeaning'] as const) {
      const q = buildMcq(word, direction, { pool, rng: createRng(1) }, 2)
      expect(
        q.options.length,
        `入力: ${JSON.stringify({ word, direction })} 期待値: 3 実際の選択肢: ${JSON.stringify(q.options)}`,
      ).toBe(3)
    }
  })

  it('word と pool が変更されない', () => {
    const { word, pool } = makePool()
    const beforeWord = JSON.stringify(word)
    const beforePool = JSON.stringify(pool)
    buildMcq(word, 'foreignToNative', { pool, rng: createRng(1) }, 3)
    expect(JSON.stringify(word), `入力: ${beforeWord} 期待値: ${beforeWord}`).toBe(beforeWord)
    expect(JSON.stringify(pool), `入力: ${beforePool} 期待値: ${beforePool}`).toBe(beforePool)
  })
  it.each(['foreignToNative', 'nativeToForeign', 'audioToMeaning'] as const)(
    'reading for %s',
    (direction) => {
      for (const reading of ['スラマッ', '']) {
        const word = { ...makeWord('w1', 'selamat', 'greeting'), reading }
        const question = build(word, direction, [word])
        const expected = direction === 'foreignToNative' && reading !== ''
        expect(
          Object.hasOwn(question, 'promptReading'),
          'Input: ' + JSON.stringify({ direction, reading }),
        ).toBe(expected)
        if (expected)
          expect(question.promptReading, 'Input: ' + JSON.stringify({ direction, reading })).toBe(
            reading,
          )
      }
    },
  )
})
