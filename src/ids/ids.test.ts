import { describe, it, expect } from 'vitest'
import {
  slugify,
  makeWordId,
  makePhraseId,
  parseWordId,
  isValidWordId,
  isValidPhraseId,
  normalizeWordId,
  normalizePhraseId,
  buildWordIdRewrites,
} from './index'

function check(input: unknown, actual: unknown, expected: unknown): void {
  expect(
    actual,
    `入力: ${JSON.stringify(input)}, 期待値: ${JSON.stringify(expected)}, 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

describe('slugify', () => {
  it.each([
    ['Terima Kasih', 'terima-kasih'],
    ['  Terima Kasih  ', 'terima-kasih'],
    ['Terima   Kasih', 'terima-kasih'],
    ['　Terima　　Kasih　', 'terima-kasih'],
    ['Terima\t\nKasih', 'terima-kasih'],
    ['Terima~ Kasih:', 'terima-kasih'],
    ['こんにちは 世界', 'こんにちは-世界'],
    ['café résumé', 'café-résumé'],
    ['CAFE\u0301', 'café'],
    ["D'Artagnan", "d'artagnan"],
    ['', ''],
    ['　 \t', ''],
  ])('%j → %j', (input, expected) => {
    check(input, slugify(input), expected)
  })
})

describe('makeWordId', () => {
  it.each([
    { language: 'ms', lemma: 'Makan', index: undefined, expected: 'ms:makan' },
    { language: 'ms', lemma: 'Terima Kasih', index: undefined, expected: 'ms:terima-kasih' },
    { language: 'ms', lemma: 'bisa', index: 2, expected: 'ms:bisa~2' },
    { language: 'ms', lemma: 'bisa', index: 3, expected: 'ms:bisa~3' },
    { language: 'ms', lemma: 'bisa', index: 1, expected: 'ms:bisa' },
    { language: 'MS', lemma: 'Makan', index: undefined, expected: 'ms:makan' },
  ])('$language / $lemma / $index → $expected', (input) => {
    check(input, makeWordId(input.language, input.lemma, input.index), input.expected)
  })
})

describe('parseWordId / isValidWordId', () => {
  it.each([
    ['ms:makan', 'ms', 'makan', 1],
    ['ms:terima-kasih', 'ms', 'terima-kasih', 1],
    ['ms:bisa~2', 'ms', 'bisa', 2],
    ['ms:bisa~3', 'ms', 'bisa', 3],
    ['ms:bisa~10', 'ms', 'bisa', 10],
    ['ceb:maayo', 'ceb', 'maayo', 1],
    ['ja:こんにちは', 'ja', 'こんにちは', 1],
    ['fr:café', 'fr', 'café', 1],
    ["fr:aujourd'hui", 'fr', "aujourd'hui", 1],
    ['ms:a_b-2!', 'ms', 'a_b-2!', 1],
  ] as const)('accepts %j', (input, language, slug, homographIndex) => {
    check(input, parseWordId(input), { language, slug, homographIndex })
    check(input, isValidWordId(input), true)
  })

  it.each([
    'ms:bisa~1',
    'ms:bisa~0',
    'ms:bisa~-2',
    'ms:bisa~2.5',
    'ms:bisa~',
    'ms:bi~sa',
    'ms:bisa~2~3',
    'MS:makan',
    'ms:Makan',
    'fr:CAFÉ',
    'ms:makan nasi',
    'ms:makan　nasi',
    'ms:makan\n',
    'ms:bisa~2\n',
    ' ms:makan',
    'ms:',
    'ms:~2',
    'ms:makan:nasi',
    'm:makan',
    'msaa:makan',
    'm1:makan',
    'makan',
    '',
  ])('rejects %j', (input) => {
    check(input, parseWordId(input), null)
    check(input, isValidWordId(input), false)
  })

  it.each([
    ['ms', true],
    ['ja', false],
    ['MS', false],
    ['', false],
  ] as const)('checks language %j → %j', (language, expected) => {
    const input = { id: 'ms:makan', language }
    check(input, isValidWordId(input.id, language), expected)
  })
})

describe('normalizeWordId', () => {
  it.each([
    ['MS:Makan', 'ms:makan'],
    ['Makan Nasi', 'ms:makan-nasi'],
    ['ms:makan', 'ms:makan'],
    ['ms:bisa~2', 'ms:bisa~2'],
    [' MS:Bisa~2 ', 'ms:bisa~2'],
    [' Bisa~3 ', 'ms:bisa~3'],
    ['MS:Terima　 Kasih~10', 'ms:terima-kasih~10'],
    ['JA:こんにちは', 'ja:こんにちは'],
    ['MS:Ma:kan', 'ms:makan'],
  ])('%j → %j', (raw, expected) => {
    const options = { language: 'ms' }
    check({ raw, options }, normalizeWordId(raw, options), expected)
  })

  it.each(['', '　 \t'])('uses lemma for empty raw %j', (raw) => {
    const options = { language: 'MS', lemma: 'Terima Kasih' }
    check({ raw, options }, normalizeWordId(raw, options), 'ms:terima-kasih')
  })

  it.each([
    { raw: '', options: { language: 'ms' } },
    { raw: '', options: { language: 'ms', lemma: '' } },
    { raw: '　 ', options: { language: 'ms' } },
  ])('throws when both raw and lemma are missing: %j', (input) => {
    let actual: unknown
    try {
      normalizeWordId(input.raw, input.options)
    } catch (error) {
      actual = error
    }
    check(input, actual instanceof Error, true)
  })
})

describe('phrase IDs', () => {
  it.each([
    ['Suka Fruit', 'ph:suka-fruit'],
    ['  Café　世界:~ ', 'ph:café-世界'],
  ])('makePhraseId(%j) → %j', (input, expected) => {
    check(input, makePhraseId(input), expected)
  })

  it.each([
    ['Suka Fruit', 'ph:suka-fruit'],
    ['ph:suka-fruit', 'ph:suka-fruit'],
    ['ph:Suka　 Fruit', 'ph:suka-fruit'],
    ['  ph:Suka Fruit  ', 'ph:suka-fruit'],
    ['ph:café:世界~', 'ph:café世界'],
  ])('normalizePhraseId(%j) → %j', (input, expected) => {
    check(input, normalizePhraseId(input), expected)
  })

  it.each([
    ['ph:suka-fruit', true],
    ['ph:こんにちは', true],
    ['ph:café', true],
    ["ph:d'accord!", true],
    ['suka-fruit', false],
    ['PH:suka-fruit', false],
    ['ph:Suka-fruit', false],
    ['ph:CAFÉ', false],
    ['ph:suka fruit', false],
    ['ph:suka　fruit', false],
    ['ph:suka-fruit\n', false],
    ['ph:suka:fruit', false],
    ['ph:suka~2', false],
    ['ph:', false],
    ['', false],
  ] as const)('isValidPhraseId(%j) → %j', (input, expected) => {
    check(input, isValidPhraseId(input), expected)
  })
})

describe('buildWordIdRewrites', () => {
  it('records normalization, collisions, lemma fallback, and original indexes', () => {
    const entries = [
      { id: 'ms:minum', lemma: 'minum' },
      { id: 'MS:Bisa', lemma: 'Bisa' },
      { id: 'ms:bisa', lemma: 'bisa' },
      { id: 'MS:Bisa~2', lemma: 'Bisa' },
      { id: '', lemma: 'Terima Kasih' },
    ]
    check({ entries, language: 'ms' }, buildWordIdRewrites(entries, 'ms'), {
      ids: ['ms:minum', 'ms:bisa', 'ms:bisa~2', 'ms:bisa~3', 'ms:terima-kasih'],
      changes: [
        { index: 1, from: 'MS:Bisa', to: 'ms:bisa' },
        { index: 2, from: 'ms:bisa', to: 'ms:bisa~2' },
        { index: 3, from: 'MS:Bisa~2', to: 'ms:bisa~3' },
        { index: 4, from: '', to: 'ms:terima-kasih' },
      ],
    })
  })

  it('preserves unused suffixes and assigns the first free number on collisions', () => {
    const entries = [
      { id: 'ms:bisa~2', lemma: 'bisa' },
      { id: 'ms:bisa', lemma: 'bisa' },
      { id: 'ms:bisa~4', lemma: 'bisa' },
      { id: 'ms:bisa~4', lemma: 'bisa' },
      { id: 'ms:bisa', lemma: 'bisa' },
    ]
    check({ entries, language: 'ms' }, buildWordIdRewrites(entries, 'ms'), {
      ids: ['ms:bisa~2', 'ms:bisa', 'ms:bisa~4', 'ms:bisa~3', 'ms:bisa~5'],
      changes: [
        { index: 3, from: 'ms:bisa~4', to: 'ms:bisa~3' },
        { index: 4, from: 'ms:bisa', to: 'ms:bisa~5' },
      ],
    })
  })

  it('returns no changes for distinct valid IDs and leaves inputs untouched', () => {
    const entries = Object.freeze([
      Object.freeze({ id: 'ms:makan', lemma: 'makan' }),
      Object.freeze({ id: 'ms:bisa', lemma: 'bisa' }),
      Object.freeze({ id: 'ms:bisa~2', lemma: 'bisa' }),
    ])
    check({ entries, language: 'ms' }, buildWordIdRewrites(entries, 'ms'), {
      ids: ['ms:makan', 'ms:bisa', 'ms:bisa~2'],
      changes: [],
    })
  })

  it('handles an empty collection', () => {
    check({ entries: [], language: 'ms' }, buildWordIdRewrites([], 'ms'), {
      ids: [],
      changes: [],
    })
  })
})
