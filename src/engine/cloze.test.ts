import { describe, expect, it } from 'vitest'
import type { Sentence, Word } from '../schema'
import { buildCloze, findWordInSentence } from './cloze'
import type { ClozeContext } from './cloze'
import { createRng } from './rng'

function makeMessage(input: unknown, expected: unknown, actual: unknown): string {
  return `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`
}

function makeWord(id: string, lemma: string): Word {
  return {
    id,
    lemma,
    pos: 'verb',
    reading: '',
    meaning: [id],
    tags: ['common'],
    rel: [],
    uncertain: false,
    note: '',
  }
}

function makeSentence(id: string, target: string): Sentence {
  return { id, target, meaning: 'meaning', wordIds: [] }
}

describe('findWordInSentence', () => {
  it('例の2つを満たす', () => {
    const input1 = { text: 'Saya makan nasi.', lemma: 'makan' }
    const actual1 = findWordInSentence(input1.text, input1.lemma)
    expect(actual1, makeMessage(input1, { start: 5, end: 10 }, actual1)).toEqual({
      start: 5,
      end: 10,
    })

    const input2 = { text: 'Saya makanan', lemma: 'makan' }
    const actual2 = findWordInSentence(input2.text, input2.lemma)
    expect(actual2, makeMessage(input2, null, actual2)).toBeNull()
  })

  it('大文字小文字を区別しない', () => {
    const input = { text: 'Makan nasi', lemma: 'makan' }
    const actual = findWordInSentence(input.text, input.lemma)
    expect(actual, makeMessage(input, { start: 0, end: 5 }, actual)).toEqual({
      start: 0,
      end: 5,
    })
  })

  it('文頭・文末・句読点の隣を見つける', () => {
    const input1 = { text: 'nasi.', lemma: 'nasi' }
    const actual1 = findWordInSentence(input1.text, input1.lemma)
    expect(actual1, makeMessage(input1, { start: 0, end: 4 }, actual1)).toEqual({
      start: 0,
      end: 4,
    })

    const input2 = { text: 'I eat nasi', lemma: 'nasi' }
    const actual2 = findWordInSentence(input2.text, input2.lemma)
    expect(actual2, makeMessage(input2, { start: 6, end: 10 }, actual2)).toEqual({
      start: 6,
      end: 10,
    })

    const input3 = { text: 'nasi, makan', lemma: 'makan' }
    const actual3 = findWordInSentence(input3.text, input3.lemma)
    expect(actual3, makeMessage(input3, { start: 6, end: 11 }, actual3)).toEqual({
      start: 6,
      end: 11,
    })
  })

  it('見つからない場合は null を返す', () => {
    const input = { text: 'Saya minum air.', lemma: 'makan' }
    const actual = findWordInSentence(input.text, input.lemma)
    expect(actual, makeMessage(input, null, actual)).toBeNull()
  })

  it('複数ある場合は最初を返す', () => {
    const input = { text: 'makan nasi makan sayur', lemma: 'makan' }
    const actual = findWordInSentence(input.text, input.lemma)
    expect(actual, makeMessage(input, { start: 0, end: 5 }, actual)).toEqual({
      start: 0,
      end: 5,
    })
  })

  it('日本語や記号を含む例文でも語境界を扱う', () => {
    const input1 = { text: '私は nasi を食べます', lemma: 'nasi' }
    const actual1 = findWordInSentence(input1.text, input1.lemma)
    expect(actual1, makeMessage(input1, { start: 3, end: 7 }, actual1)).toEqual({
      start: 3,
      end: 7,
    })

    const input2 = { text: '（makan）', lemma: 'makan' }
    const actual2 = findWordInSentence(input2.text, input2.lemma)
    expect(actual2, makeMessage(input2, { start: 1, end: 6 }, actual2)).toEqual({
      start: 1,
      end: 6,
    })

    const input3 = { text: 'makanan', lemma: 'makan' }
    const actual3 = findWordInSentence(input3.text, input3.lemma)
    expect(actual3, makeMessage(input3, null, actual3)).toBeNull()
  })
})

describe('buildCloze typing', () => {
  it('before / after / answer を正しく作る', () => {
    const sentence = makeSentence('s1', 'Saya makan nasi.')
    const word = makeWord('w1', 'makan')
    const context: ClozeContext = { pool: [word], rng: createRng(1) }
    const input = { sentence, word, mode: 'typing' }

    const actual = buildCloze(sentence, word, 'typing', context)
    expect(actual, makeMessage(input, null, actual)).not.toBeNull()
    if (actual === null) return

    expect(actual.before, makeMessage(input, 'Saya ', actual.before)).toBe('Saya ')
    expect(actual.after, makeMessage(input, ' nasi.', actual.after)).toBe(' nasi.')
    expect(actual.answer, makeMessage(input, 'makan', actual.answer)).toBe('makan')
  })

  it('表記が lemma と(小文字化して)同じとき accepted は空にする', () => {
    const sentence = makeSentence('s3', 'Saya Makan nasi.')
    const word = makeWord('w1', 'makan')
    const context: ClozeContext = { pool: [word], rng: createRng(1) }
    const input = { sentence, word, mode: 'typing' }

    const actual = buildCloze(sentence, word, 'typing', context)
    expect(actual, makeMessage(input, null, actual)).not.toBeNull()
    if (actual === null) return

    expect(actual.accepted, makeMessage(input, [], actual.accepted)).toEqual([])
  })

  it('options と correctId を付けない', () => {
    const sentence = makeSentence('s4', 'Saya makan nasi.')
    const word = makeWord('w1', 'makan')
    const context: ClozeContext = { pool: [word], rng: createRng(1) }
    const input = { sentence, word, mode: 'typing' }

    const actual = buildCloze(sentence, word, 'typing', context)
    expect(actual, makeMessage(input, null, actual)).not.toBeNull()
    if (actual === null) return

    expect('options' in actual, makeMessage(input, false, 'options' in actual)).toBe(false)
    expect('correctId' in actual, makeMessage(input, false, 'correctId' in actual)).toBe(false)
  })
})

describe('buildCloze choice', () => {
  it('選択肢が最大4個で、正解が1つだけあり correctId が正しい', () => {
    const sentence = makeSentence('s5', 'Saya makan nasi.')
    const word = makeWord('w1', 'makan')
    const pool: Word[] = [
      word,
      makeWord('w2', 'minum'),
      makeWord('w3', 'tidur'),
      makeWord('w4', 'jalan'),
    ]
    const context: ClozeContext = { pool, rng: createRng(7) }
    const input = { sentence, word, mode: 'choice', poolIds: pool.map((p) => p.id) }

    const actual = buildCloze(sentence, word, 'choice', context)
    expect(actual, makeMessage(input, null, actual)).not.toBeNull()
    if (actual === null || actual.options === undefined) return

    expect(actual.options.length, makeMessage(input, 4, actual.options.length)).toBe(4)
    expect(actual.correctId, makeMessage(input, 'w1', actual.correctId)).toBe('w1')

    const correctOptions = actual.options.filter((option) => option.id === word.id)
    expect(correctOptions.length, makeMessage(input, 1, correctOptions.length)).toBe(1)

    const correctOption = correctOptions[0]
    expect(correctOption, makeMessage(input, { id: 'w1', text: 'makan' }, correctOption)).toEqual({
      id: 'w1',
      text: 'makan',
    })
  })

  it('text の小文字化重複を捨てる', () => {
    const sentence = makeSentence('s6', 'Saya makan nasi.')
    const word = makeWord('w1', 'makan')
    const pool: Word[] = [
      word,
      makeWord('w2', 'MAKAN'),
      makeWord('w3', 'minum'),
      makeWord('w4', 'tidur'),
    ]
    const context: ClozeContext = { pool, rng: createRng(7) }
    const input = { sentence, word, mode: 'choice', poolIds: pool.map((p) => p.id) }

    const actual = buildCloze(sentence, word, 'choice', context)
    expect(actual, makeMessage(input, null, actual)).not.toBeNull()
    if (actual === null || actual.options === undefined) return

    const lowerTexts = actual.options.map((option) => option.text.toLowerCase())
    const uniqueLowerTexts = new Set(lowerTexts)
    expect(
      uniqueLowerTexts.size,
      makeMessage(input, lowerTexts.length, uniqueLowerTexts.size),
    ).toBe(lowerTexts.length)

    expect(
      actual.options.some((option) => option.id === 'w2'),
      makeMessage(input, false, true),
    ).toBe(false)
  })

  it('候補が少ないときは個数が減ってもエラーにしない', () => {
    const sentence = makeSentence('s7', 'Saya makan nasi.')
    const word = makeWord('w1', 'makan')
    const pool: Word[] = [word, makeWord('w2', 'minum')]
    const context: ClozeContext = { pool, rng: createRng(9) }
    const input = { sentence, word, mode: 'choice', poolIds: pool.map((p) => p.id) }

    const actual = buildCloze(sentence, word, 'choice', context)
    expect(actual, makeMessage(input, null, actual)).not.toBeNull()
    if (actual === null || actual.options === undefined) return

    expect(actual.options.length, makeMessage(input, 2, actual.options.length)).toBe(2)
    expect(actual.correctId, makeMessage(input, 'w1', actual.correctId)).toBe('w1')
  })

  it('候補が0個でも正解だけになる', () => {
    const sentence = makeSentence('s8', 'Saya makan nasi.')
    const word = makeWord('w1', 'makan')
    const pool: Word[] = [word]
    const context: ClozeContext = { pool, rng: createRng(9) }
    const input = { sentence, word, mode: 'choice', poolIds: pool.map((p) => p.id) }

    const actual = buildCloze(sentence, word, 'choice', context)
    expect(actual, makeMessage(input, null, actual)).not.toBeNull()
    if (actual === null || actual.options === undefined) return

    expect(actual.options.length, makeMessage(input, 1, actual.options.length)).toBe(1)
    expect(actual.correctId, makeMessage(input, 'w1', actual.correctId)).toBe('w1')
  })
})

describe('buildCloze edge cases', () => {
  it('語が例文に無いと null を返す', () => {
    const sentence = makeSentence('s9', 'Saya minum air.')
    const word = makeWord('w1', 'makan')
    const context: ClozeContext = { pool: [word], rng: createRng(3) }
    const input = { sentence, word, mode: 'typing' }

    const actual = buildCloze(sentence, word, 'typing', context)
    expect(actual, makeMessage(input, null, actual)).toBeNull()
  })

  it('同じシードで同じ結果になる', () => {
    const sentence = makeSentence('s10', 'Saya makan nasi.')
    const word = makeWord('w1', 'makan')
    const pool: Word[] = [
      word,
      makeWord('w2', 'minum'),
      makeWord('w3', 'tidur'),
      makeWord('w4', 'jalan'),
    ]

    const first = buildCloze(sentence, word, 'choice', { pool, rng: createRng(123) })
    const second = buildCloze(sentence, word, 'choice', { pool, rng: createRng(123) })
    const input = { sentence, word, mode: 'choice', seed: 123 }

    expect(second, makeMessage(input, first, second)).toEqual(first)
  })

  it('入力が変更されない', () => {
    const sentence = makeSentence('s11', 'Saya makan nasi.')
    const word = makeWord('w1', 'makan')
    const pool: Word[] = [
      word,
      makeWord('w2', 'minum'),
      makeWord('w3', 'tidur'),
      makeWord('w4', 'jalan'),
    ]

    const sentenceBefore = JSON.parse(JSON.stringify(sentence)) as Sentence
    const wordBefore = JSON.parse(JSON.stringify(word)) as Word
    const poolBefore = JSON.parse(JSON.stringify(pool)) as Word[]
    const context: ClozeContext = { pool, rng: createRng(5) }
    const input = { sentence, word, mode: 'choice', poolIds: pool.map((p) => p.id) }

    buildCloze(sentence, word, 'choice', context)

    expect(sentence, makeMessage(input, sentenceBefore, sentence)).toEqual(sentenceBefore)
    expect(word, makeMessage(input, wordBefore, word)).toEqual(wordBefore)
    expect(pool, makeMessage(input, poolBefore, pool)).toEqual(poolBefore)
  })
})
