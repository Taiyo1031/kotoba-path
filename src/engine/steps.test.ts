import { describe, it, expect } from 'vitest'
import { buildSteps, DEFAULT_BATCH_SIZE } from './steps'
import type { UnitContent } from '../schema'

type Content = Pick<UnitContent, 'words' | 'phrases' | 'sentences'>
type Word = UnitContent['words'][number]
type Phrase = UnitContent['phrases'][number]
type Sentence = UnitContent['sentences'][number]

const makeWord = (id: string, tags: string[] = []): Word => ({
  id,
  lemma: id,
  pos: 'n',
  reading: '',
  meaning: [id],
  tags,
  rel: [],
  uncertain: false,
  note: '',
})

const makePhrase = (id: string, options: { fixed?: boolean; tags?: string[] } = {}): Phrase => {
  const slots: Record<string, { tag: string }> = {}
  options.tags?.forEach((tag, index) => {
    slots[`slot${index}`] = { tag }
  })
  return {
    id,
    target: id,
    meaning: id,
    slots,
    fixed: options.fixed ?? false,
  }
}

const makeSentence = (id: string, wordIds: string[]): Sentence => ({
  id,
  target: id,
  meaning: id,
  wordIds,
})

const expectEqual = (actual: unknown, expected: unknown, input: unknown): void => {
  expect(
    actual,
    `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

describe('buildSteps', () => {
  it('12個の単語を既定の5個ずつ3バッチに分け、13ステップを作る', () => {
    const wordIds = Array.from({ length: 12 }, (_, i) => `w${i}`)
    const content: Content = {
      words: wordIds.map((id) => makeWord(id)),
      phrases: [],
      sentences: [],
    }

    const steps = buildSteps('u', content)

    expectEqual(steps.length, 13, content)

    const expectedIds = [
      'u-b0-intro',
      'u-b0-recognize',
      'u-b0-recall',
      'u-b0-context',
      'u-b1-intro',
      'u-b1-recognize',
      'u-b1-recall',
      'u-b1-context',
      'u-b2-intro',
      'u-b2-recognize',
      'u-b2-recall',
      'u-b2-context',
      'u-test',
    ]
    expectEqual(
      steps.map((step) => step.id),
      expectedIds,
      content,
    )

    expectEqual(
      steps.map((step) => step.batchIndex),
      [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, null],
      content,
    )

    expectEqual(
      steps.map((step) => step.wordIds.length),
      [5, 5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 12],
      content,
    )

    const last = steps[steps.length - 1]
    expect(
      last,
      `入力: ${JSON.stringify(content)} 期待: unitTest 実際: ${JSON.stringify(last)}`,
    ).toBeDefined()
    expectEqual(last?.kind, 'unitTest', content)
  })

  it('単語が0個なら空配列を返す', () => {
    const content: Content = {
      words: [],
      phrases: [makePhrase('p0')],
      sentences: [makeSentence('s0', [])],
    }

    expectEqual(buildSteps('u', content), [], content)
  })

  it('単語が5個ちょうどなら1バッチになる', () => {
    const wordIds = ['w0', 'w1', 'w2', 'w3', 'w4']
    const content: Content = {
      words: wordIds.map((id) => makeWord(id)),
      phrases: [],
      sentences: [],
    }

    const steps = buildSteps('u', content)

    expectEqual(steps.length, 5, content)
    expectEqual(
      steps.map((step) => step.id),
      ['u-b0-intro', 'u-b0-recognize', 'u-b0-recall', 'u-b0-context', 'u-test'],
      content,
    )
    expectEqual(
      steps.map((step) => step.wordIds.length),
      [5, 5, 5, 5, 5],
      content,
    )
  })

  it('batchSizeが不正なら既定の5を使う', () => {
    const wordIds = Array.from({ length: 12 }, (_, i) => `w${i}`)
    const content: Content = {
      words: wordIds.map((id) => makeWord(id)),
      phrases: [],
      sentences: [],
    }

    for (const batchSize of [0, -1, 2.5]) {
      const steps = buildSteps('u', content, batchSize)
      expectEqual(steps.length, 13, { content, batchSize })
      expectEqual(
        steps.map((step) => step.id),
        [
          'u-b0-intro',
          'u-b0-recognize',
          'u-b0-recall',
          'u-b0-context',
          'u-b1-intro',
          'u-b1-recognize',
          'u-b1-recall',
          'u-b1-context',
          'u-b2-intro',
          'u-b2-recognize',
          'u-b2-recall',
          'u-b2-context',
          'u-test',
        ],
        { content, batchSize },
      )
    }
  })

  it('batchSizeが3なら3個ずつバッチを作る', () => {
    const wordIds = Array.from({ length: 12 }, (_, i) => `w${i}`)
    const content: Content = {
      words: wordIds.map((id) => makeWord(id)),
      phrases: [],
      sentences: [],
    }

    const steps = buildSteps('u', content, 3)

    expectEqual(steps.length, 17, content)
    expectEqual(
      steps.map((step) => step.wordIds.length),
      [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 12],
      content,
    )
  })

  it('例文は必要な単語が揃った最初のバッチに1回だけ入る', () => {
    const content: Content = {
      words: ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'].map((id) => makeWord(id)),
      phrases: [],
      sentences: [
        makeSentence('s0', ['w0', 'w1']),
        makeSentence('s1', ['w0', 'w5']),
        makeSentence('s2', ['w5']),
        makeSentence('s3', []),
        makeSentence('s4', ['w0', 'w1', 'w5']),
        makeSentence('s5', ['w6']),
        makeSentence('s6', ['w0', 'w6']),
      ],
    }

    const steps = buildSteps('u', content)
    const contextSteps = steps.filter((step) => step.kind === 'context')

    expectEqual(contextSteps.length, 2, content)
    expectEqual(contextSteps[0]?.sentenceIds, ['s0'], content)
    expectEqual(contextSteps[1]?.sentenceIds, ['s1', 's2', 's4', 's5', 's6'], content)

    const allSentenceIds = contextSteps.flatMap((step) => step.sentenceIds)
    expectEqual(new Set(allSentenceIds).size, allSentenceIds.length, content)
  })

  it('スロット付きフレーズはタグが揃ったバッチに1回だけ入り、固定フレーズは最後のバッチに入る', () => {
    const content: Content = {
      words: [
        makeWord('w0', ['a']),
        makeWord('w1', ['b']),
        makeWord('w2', ['c']),
        makeWord('w3', []),
        makeWord('w4', []),
      ],
      phrases: [makePhrase('p0', { tags: ['a', 'b', 'c'] }), makePhrase('p1', { fixed: true })],
      sentences: [],
    }

    const steps = buildSteps('u', content)
    const contextSteps = steps.filter((step) => step.kind === 'context')

    expectEqual(contextSteps.length, 1, content)
    expectEqual(contextSteps[0]?.phraseIds, ['p0', 'p1'], content)
  })

  it('スロットが揃う前のバッチにはスロット付きフレーズを入れない', () => {
    const content: Content = {
      words: [
        makeWord('w0', ['a']),
        makeWord('w1', ['b']),
        makeWord('w2', []),
        makeWord('w3', []),
        makeWord('w4', ['c']),
      ],
      phrases: [makePhrase('p0', { tags: ['a', 'b', 'c'] })],
      sentences: [],
    }

    const steps = buildSteps('u', content, 3)
    const contextSteps = steps.filter((step) => step.kind === 'context')

    expectEqual(contextSteps.length, 2, content)
    expectEqual(contextSteps[0]?.phraseIds, [], content)
    expectEqual(contextSteps[1]?.phraseIds, ['p0'], content)
  })

  it('固定フレーズは最後のバッチだけに入る', () => {
    const content: Content = {
      words: ['w0', 'w1', 'w2', 'w3', 'w4', 'w5'].map((id) => makeWord(id)),
      phrases: [makePhrase('p0', { fixed: true })],
      sentences: [],
    }

    const steps = buildSteps('u', content)
    const contextSteps = steps.filter((step) => step.kind === 'context')

    expectEqual(contextSteps.length, 2, content)
    expectEqual(contextSteps[0]?.phraseIds, [], content)
    expectEqual(contextSteps[1]?.phraseIds, ['p0'], content)
  })

  it('unitTestにすべての単語IDとフレーズIDを元の順で入れる', () => {
    const content: Content = {
      words: ['w0', 'w1', 'w2'].map((id) => makeWord(id)),
      phrases: [makePhrase('p0', { tags: ['a'] }), makePhrase('p1', { fixed: true })],
      sentences: [makeSentence('s0', ['w0'])],
    }

    const steps = buildSteps('u', content)
    const unitTest = steps[steps.length - 1]

    expect(
      unitTest,
      `入力: ${JSON.stringify(content)} 期待: unitTest 実際: ${JSON.stringify(unitTest)}`,
    ).toBeDefined()
    expectEqual(unitTest?.id, 'u-test', content)
    expectEqual(unitTest?.batchIndex, null, content)
    expectEqual(unitTest?.wordIds, ['w0', 'w1', 'w2'], content)
    expectEqual(unitTest?.phraseIds, ['p0', 'p1'], content)
    expectEqual(unitTest?.sentenceIds, [], content)
  })

  it('入力を変更せず、同じ入力で同じ結果を返す', () => {
    const content: Content = {
      words: ['w0', 'w1'].map((id) => makeWord(id)),
      phrases: [makePhrase('p0', { tags: ['a'] })],
      sentences: [makeSentence('s0', ['w0'])],
    }
    const frozen = Object.freeze({
      ...content,
      words: Object.freeze(content.words.map((word) => Object.freeze(word))),
      phrases: Object.freeze(content.phrases.map((phrase) => Object.freeze(phrase))),
      sentences: Object.freeze(content.sentences.map((sentence) => Object.freeze(sentence))),
    }) as Content

    const first = buildSteps('u', frozen)
    const second = buildSteps('u', frozen)

    expectEqual(first, second, frozen)
    expectEqual(frozen.words, content.words, content)
    expectEqual(frozen.phrases, content.phrases, content)
    expectEqual(frozen.sentences, content.sentences, content)
  })

  it('既定のバッチサイズは5である', () => {
    expectEqual(DEFAULT_BATCH_SIZE, 5, undefined)
  })
})
