import { describe, it, expect } from 'vitest'
import { candidatesForSlot, isPhraseAvailable, expandPhrase } from './slots'
import type { Phrase, Word } from '../schema'

const apple: Word = {
  id: 'apple',
  lemma: 'apel',
  pos: 'noun',
  reading: 'apel',
  meaning: ['りんご'],
  tags: ['fruit'],
  rel: [],
  uncertain: false,
  note: '',
}

const banana: Word = {
  id: 'banana',
  lemma: 'pisang',
  pos: 'noun',
  reading: 'pisang',
  meaning: ['バナナ'],
  tags: ['fruit'],
  rel: [],
  uncertain: false,
  note: '',
}

const carrot: Word = {
  id: 'carrot',
  lemma: 'wortel',
  pos: 'noun',
  reading: 'wortel',
  meaning: ['にんじん'],
  tags: ['vegetable'],
  rel: [],
  uncertain: false,
  note: '',
}

function makeRng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 1) % 10
    return state / 10
  }
}

function failureMessage(input: unknown, expected: unknown, actual: unknown): string {
  return `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`
}

describe('candidatesForSlot', () => {
  it('タグを含む既習単語を元の順序で返す', () => {
    const input = { tag: 'fruit', learnedWords: [carrot, apple, banana] }
    const expected = [apple, banana]
    const actual = candidatesForSlot(input.tag, input.learnedWords)

    expect(actual, failureMessage(input, expected, actual)).toEqual(expected)
  })
})

describe('isPhraseAvailable', () => {
  it('候補がすべてある場合は true を返す', () => {
    const phrase: Phrase = {
      id: 'available',
      target: 'Saya suka {fruit}.',
      meaning: '私は{fruit}が好きです。',
      slots: { fruit: { tag: 'fruit' } },
      fixed: false,
    }
    const input = { phrase, learnedWords: [apple] }
    const expected = true
    const actual = isPhraseAvailable(input.phrase, input.learnedWords)

    expect(actual, failureMessage(input, expected, actual)).toBe(expected)
  })

  it('候補が1つでも無い場合は false を返す', () => {
    const phrase: Phrase = {
      id: 'unavailable',
      target: 'Saya suka {color}.',
      meaning: '私は{color}が好きです。',
      slots: { color: { tag: 'color' } },
      fixed: false,
    }
    const input = { phrase, learnedWords: [apple] }
    const expected = false
    const actual = isPhraseAvailable(input.phrase, input.learnedWords)

    expect(actual, failureMessage(input, expected, actual)).toBe(expected)
  })

  it('固定フレーズは常に true を返す', () => {
    const phrase: Phrase = {
      id: 'fixed',
      target: 'Fixed {color}.',
      meaning: '固定{color}。',
      slots: { color: { tag: 'color' } },
      fixed: true,
    }
    const input = { phrase, learnedWords: [] }
    const expected = true
    const actual = isPhraseAvailable(input.phrase, input.learnedWords)

    expect(actual, failureMessage(input, expected, actual)).toBe(expected)
  })
})

describe('expandPhrase', () => {
  it('基本の展開で lemma と meaning[0] を差し込む', () => {
    const phrase: Phrase = {
      id: 'basic',
      target: 'Saya suka {fruit}.',
      meaning: '私は{fruit}が好きです。',
      slots: { fruit: { tag: 'fruit' } },
      fixed: false,
    }
    const learnedWords = [apple]
    const input = { phrase, learnedWords, seed: 0 }
    const expected = {
      phraseId: 'basic',
      target: 'Saya suka apel.',
      meaning: '私はりんごが好きです。',
      filled: { fruit: 'apple' },
    }
    const actual = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(actual, failureMessage(input, expected, actual)).toEqual(expected)
  })

  it('候補が無い場合は null を返す', () => {
    const phrase: Phrase = {
      id: 'no-candidate',
      target: 'Saya suka {color}.',
      meaning: '私は{color}が好きです。',
      slots: { color: { tag: 'color' } },
      fixed: false,
    }
    const learnedWords = [apple]
    const input = { phrase, learnedWords, seed: 0 }
    const expected = null
    const actual = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(actual, failureMessage(input, expected, actual)).toBeNull()
  })

  it('一部のスロットだけ候補が無い場合も null を返す', () => {
    const phrase: Phrase = {
      id: 'partial-candidate',
      target: '{fruit} and {color}',
      meaning: '{fruit}と{color}',
      slots: {
        fruit: { tag: 'fruit' },
        color: { tag: 'color' },
      },
      fixed: false,
    }
    const learnedWords = [apple]
    const input = { phrase, learnedWords, seed: 0 }
    const expected = null
    const actual = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(actual, failureMessage(input, expected, actual)).toBeNull()
  })

  it('固定フレーズは変更されずに返る', () => {
    const phrase: Phrase = {
      id: 'fixed',
      target: 'Fixed {fruit}.',
      meaning: '固定{fruit}。',
      slots: { fruit: { tag: 'fruit' } },
      fixed: true,
    }
    const learnedWords: Word[] = []
    const input = { phrase, learnedWords, seed: 0 }
    const expected = {
      phraseId: 'fixed',
      target: 'Fixed {fruit}.',
      meaning: '固定{fruit}。',
      filled: {},
    }
    const actual = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(actual, failureMessage(input, expected, actual)).toEqual(expected)
  })

  it('同じスロット名が複数回出てもすべて同じ単語で置換される', () => {
    const phrase: Phrase = {
      id: 'multi-slot',
      target: 'I like {fruit} and {fruit}.',
      meaning: '私は{fruit}と{fruit}が好きです。',
      slots: { fruit: { tag: 'fruit' } },
      fixed: false,
    }
    const learnedWords = [apple]
    const input = { phrase, learnedWords, seed: 0 }
    const expected = {
      phraseId: 'multi-slot',
      target: 'I like apel and apel.',
      meaning: '私はりんごとりんごが好きです。',
      filled: { fruit: 'apple' },
    }
    const actual = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(actual, failureMessage(input, expected, actual)).toEqual(expected)
  })

  it('候補が2つ以上ある場合は別々の単語になる', () => {
    const phrase: Phrase = {
      id: 'two-slots',
      target: '{a} and {b}',
      meaning: '{a}と{b}',
      slots: {
        a: { tag: 'fruit' },
        b: { tag: 'fruit' },
      },
      fixed: false,
    }
    const learnedWords = [apple, banana]
    const input = { phrase, learnedWords, seed: 0 }
    const expected = {
      phraseId: 'two-slots',
      target: 'apel and pisang',
      meaning: 'りんごとバナナ',
      filled: { a: 'apple', b: 'banana' },
    }
    const actual = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(actual, failureMessage(input, expected, actual)).toEqual(expected)
  })

  it('候補が1つだけなら重複を許す', () => {
    const phrase: Phrase = {
      id: 'duplicate-allowed',
      target: '{a} and {b}',
      meaning: '{a}と{b}',
      slots: {
        a: { tag: 'fruit' },
        b: { tag: 'fruit' },
      },
      fixed: false,
    }
    const learnedWords = [apple]
    const input = { phrase, learnedWords, seed: 0 }
    const expected = {
      phraseId: 'duplicate-allowed',
      target: 'apel and apel',
      meaning: 'りんごとりんご',
      filled: { a: 'apple', b: 'apple' },
    }
    const actual = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(actual, failureMessage(input, expected, actual)).toEqual(expected)
  })

  it('同じ rng シードで同じ結果になる', () => {
    const phrase: Phrase = {
      id: 'reproducible',
      target: '{a} and {b}',
      meaning: '{a}と{b}',
      slots: {
        a: { tag: 'fruit' },
        b: { tag: 'fruit' },
      },
      fixed: false,
    }
    const learnedWords = [apple, banana]
    const seed = 42
    const input = { phrase, learnedWords, seed }
    const first = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))
    const second = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(second, failureMessage(input, first, second)).toEqual(first)
  })

  it('タグが違う単語は選ばれない', () => {
    const phrase: Phrase = {
      id: 'tag-filter',
      target: 'Saya suka {fruit}.',
      meaning: '私は{fruit}が好きです。',
      slots: { fruit: { tag: 'fruit' } },
      fixed: false,
    }
    const learnedWords = [carrot, apple]
    const input = { phrase, learnedWords, seed: 0 }
    const expected = {
      phraseId: 'tag-filter',
      target: 'Saya suka apel.',
      meaning: '私はりんごが好きです。',
      filled: { fruit: 'apple' },
    }
    const actual = expandPhrase(input.phrase, input.learnedWords, makeRng(input.seed))

    expect(actual, failureMessage(input, expected, actual)).toEqual(expected)
  })
})
