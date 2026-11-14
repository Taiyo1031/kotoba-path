import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Word } from '../schema'
import type { Judgement, Question, Response } from './types'
import type { Level } from './session'
import type { QuestionContext } from './questions'
import { buildQuestion, judgeResponse } from './questions'
import { createRng } from './rng'
import * as cloze from './cloze'
import * as session from './session'

function makeCourse(): Omit<QuestionContext, 'rng'> {
  const word = (id: string, lemma: string, meaning: string, tags: string[] = []): Word => ({
    id,
    lemma,
    meaning: [meaning],
    pos: 'noun',
    reading: '',
    tags,
    rel: [],
    uncertain: false,
    note: '',
  })
  const words = [
    word('w-apple', 'apple', 'りんご'),
    word('w-banana', 'banana', 'バナナ'),
    word('w-cat', 'cat', 'ねこ', ['animal']),
    word('w-dog', 'dog', 'いぬ', ['animal']),
    word('w-eat', 'eat', '食べる'),
    word('w-red', 'red', '赤い', ['color']),
    word('w-sun', 'sun', '太陽'),
    word('w-water', 'water', '水'),
  ]
  return {
    words,
    pool: words,
    unitWordIds: new Set(words.map((entry) => entry.id)),
    learnedWordIds: new Set(['w-apple', 'w-banana', 'w-cat', 'w-dog']),
    phrases: [
      {
        id: 'p-slot',
        target: '{animal} eats apple.',
        meaning: '{animal}はりんごを食べます。',
        slots: { animal: { tag: 'animal' } },
        fixed: false,
      },
      { id: 'p-fixed', target: 'Hello!', meaning: 'こんにちは！', slots: {}, fixed: true },
    ],
    sentences: [
      {
        id: 's-apple',
        target: 'I eat an apple.',
        meaning: '私はりんごを食べます。',
        wordIds: ['w-eat', 'w-apple'],
      },
      {
        id: 's-cat-dog',
        target: 'The cat chases the dog.',
        meaning: 'ねこがいぬを追いかけます。',
        wordIds: ['w-cat', 'w-dog'],
      },
      {
        id: 's-apple-second',
        target: 'An apple is red.',
        meaning: 'りんごは赤いです。',
        wordIds: ['w-apple', 'w-red'],
      },
    ],
  }
}

function makeContext(overrides: Partial<QuestionContext> = {}): QuestionContext {
  return { ...makeCourse(), rng: createRng(1), ...overrides }
}

function equal(actual: unknown, expected: unknown, input: unknown): void {
  const message =
    `入力: ${JSON.stringify(input)}\n期待値: ${JSON.stringify(expected)}` +
    `\n実際: ${JSON.stringify(actual)}`
  expect(actual, message).toEqual(expected)
}

function assertQuestion<F extends Question['format']>(
  question: Question,
  format: F,
  itemId: string,
): asserts question is Extract<Question, { format: F }> {
  equal(question.format, format, { itemId, question })
  equal('itemId' in question ? question.itemId : undefined, itemId, { question })
}

function judge(question: Question, response: Response, expected: Judgement): void {
  equal(judgeResponse(question, response), expected, { question, response })
}

afterEach(() => vi.restoreAllMocks())

describe('buildQuestion', () => {
  it('段階 0 は foreignToNative の mcq', () => {
    const question = buildQuestion('w-apple', 0, makeContext())
    assertQuestion(question, 'mcq', 'w-apple')
    equal(question.direction, 'foreignToNative', { level: 0, question })
    equal(question.prompt, 'apple', { question })
    equal(question.options.length, 4, { question })
    equal(question.options.find((option) => option.id === question.correctId)?.text, 'りんご', {
      question,
    })
  })

  it.each([
    [0, 'mcq'],
    [0.5, 'typing'],
    [0.9, 'tiles'],
  ] as const)('段階 1: rng=%s で %s', (random, format) => {
    const question = buildQuestion('w-apple', 1, makeContext({ rng: () => random }))
    assertQuestion(question, format, 'w-apple')
    if (question.format === 'mcq') {
      equal(question.direction, 'nativeToForeign', { random, question })
      equal(question.prompt, 'りんご', { question })
      equal(question.options.find((option) => option.id === question.correctId)?.text, 'apple', {
        question,
      })
    } else if (question.format === 'typing') {
      equal(
        question,
        {
          format: 'typing',
          itemId: 'w-apple',
          prompt: 'りんご',
          answer: 'apple',
          accepted: [],
        },
        { random },
      )
    } else if (question.format === 'tiles') {
      equal(question.answer, ['I', 'eat', 'an', 'apple'], { random, question })
      equal(question.prompt, '私はりんごを食べます。', { question })
      equal(question.tiles.length, 6, { question })
      equal(question.tiles.filter((tile) => tile === 'apple').length, 1, { question })
    }
  })

  it.each([1, 2] as const)('例文がない単語は段階 %s でも mcq / typing のみ', (level) => {
    const formats = new Set<string>()
    for (const random of [0, 0.4, 0.6, 0.99]) {
      const question = buildQuestion('w-sun', level, makeContext({ rng: () => random }))
      const format = random < 0.5 ? 'mcq' : 'typing'
      assertQuestion(question, format, 'w-sun')
      formats.add(question.format)
      if (question.format === 'mcq') {
        equal(question.direction, 'nativeToForeign', { level, random, question })
      }
    }
    equal([...formats].sort(), ['mcq', 'typing'], { level })
  })

  it.each([
    [0.49, 'choice'],
    [0.5, 'typing'],
  ] as const)('段階 2 は最初の例文で cloze: rng=%s, mode=%s', (random, mode) => {
    const question = buildQuestion('w-apple', 2, makeContext({ rng: () => random }))
    assertQuestion(question, 'cloze', 'w-apple')
    equal(
      {
        mode: question.mode,
        sentenceId: question.sentenceId,
        before: question.before,
        after: question.after,
        answer: question.answer,
      },
      { mode, sentenceId: 's-apple', before: 'I eat an ', after: '.', answer: 'apple' },
      { random, question },
    )
  })

  it('例文は wordIds と実際の語の両方で判定し、最初の有効な例文を使う', () => {
    const context = makeContext({ rng: () => 0.9 })
    context.sentences = [
      { id: 'unlinked', target: 'apple', meaning: 'りんご', wordIds: [] },
      { id: 'substring', target: 'pineapple', meaning: 'パイナップル', wordIds: ['w-apple'] },
      ...context.sentences,
    ]
    const tiles = buildQuestion('w-apple', 1, context)
    assertQuestion(tiles, 'tiles', 'w-apple')
    equal(tiles.answer, ['I', 'eat', 'an', 'apple'], context.sentences)
    const question = buildQuestion('w-apple', 2, context)
    assertQuestion(question, 'cloze', 'w-apple')
    equal(question.sentenceId, 's-apple', context.sentences)

    const unlinked = buildQuestion(
      'w-water',
      2,
      makeContext({
        rng: () => 0,
        sentences: [{ id: 'unlinked', target: 'water', meaning: '水', wordIds: [] }],
      }),
    )
    assertQuestion(unlinked, 'mcq', 'w-water')
    equal(unlinked.direction, 'nativeToForeign', { unlinked })
  })

  it('段階 2 で関連する例文に語がなければ typing に落とす', () => {
    const context = makeContext({
      rng: () => 0,
      sentences: [
        {
          id: 'broken',
          target: 'The sun shines.',
          meaning: '太陽が輝く。',
          wordIds: ['w-water'],
        },
      ],
    })
    const question = buildQuestion('w-water', 2, context)
    assertQuestion(question, 'typing', 'w-water')
    equal(question.answer, 'water', context.sentences)
  })

  it('buildCloze が null を返した場合も typing に落とす', () => {
    vi.spyOn(cloze, 'buildCloze').mockReturnValueOnce(null)
    const question = buildQuestion('w-apple', 2, makeContext())
    assertQuestion(question, 'typing', 'w-apple')
    equal(question.answer, 'apple', { level: 2, buildCloze: null })
  })

  it('作れない形式なら最後の手段として foreignToNative の mcq', () => {
    vi.spyOn(session, 'pickFormat').mockReturnValueOnce({ format: 'match' })
    const question = buildQuestion('w-apple', 1, makeContext())
    assertQuestion(question, 'mcq', 'w-apple')
    equal(question.direction, 'foreignToNative', { selectedFormat: 'match' })
  })

  it('単語の出題ではスロット付きフレーズを使わない', () => {
    const pickFormat = vi.spyOn(session, 'pickFormat')
    const context = makeContext()
    const question = buildQuestion('w-cat', 2, context)
    assertQuestion(question, 'cloze', 'w-cat')
    equal(pickFormat.mock.calls, [[2, { hasSentence: true, hasSlotPhrase: false }, context.rng]], {
      itemId: 'w-cat',
      level: 2,
    })
  })

  it.each([0, 1, 2] as const)('フレーズは段階 %s でも pool 内の既習語で埋める', (level) => {
    const course = makeCourse()
    const context = makeContext({
      ...course,
      words: course.words.filter((word) => word.id !== 'w-dog'),
      learnedWordIds: new Set(['w-dog', 'w-red']),
      rng: () => 0,
    })
    const question = buildQuestion('p-slot', level, context)
    assertQuestion(question, 'phrase-slot', 'p-slot')
    equal(
      question,
      {
        format: 'phrase-slot',
        itemId: 'p-slot',
        target: 'dog eats apple.',
        meaning: 'いぬはりんごを食べます。',
        filled: { animal: 'w-dog' },
      },
      { level },
    )
  })

  it.each(['unlearned', 'missing-from-pool'] as const)(
    'フレーズの候補がない場合は flashcard: %s',
    (reason) => {
      const course = makeCourse()
      const context = makeContext(
        reason === 'unlearned'
          ? { learnedWordIds: new Set(['w-red']) }
          : { pool: course.pool.filter((word) => !word.tags.includes('animal')) },
      )
      const question = buildQuestion('p-slot', 2, context)
      assertQuestion(question, 'flashcard', 'p-slot')
      equal(
        question,
        {
          format: 'flashcard',
          itemId: 'p-slot',
          front: '{animal} eats apple.',
          back: '{animal}はりんごを食べます。',
        },
        { reason },
      )
    },
  )

  it('固定フレーズは flashcard', () => {
    const question = buildQuestion('p-fixed', 2, makeContext())
    assertQuestion(question, 'flashcard', 'p-fixed')
    equal(
      question,
      { format: 'flashcard', itemId: 'p-fixed', front: 'Hello!', back: 'こんにちは！' },
      { itemId: 'p-fixed' },
    )
  })

  it('同じシードなら同じ結果になり、入力を変更しない', () => {
    const course = makeCourse()
    const snapshot = structuredClone(course)
    for (const level of [0, 1, 2] satisfies Level[]) {
      for (const seed of [1, 42, 100]) {
        for (const itemId of ['w-apple', 'w-sun', 'p-slot', 'p-fixed']) {
          const first = buildQuestion(itemId, level, { ...course, rng: createRng(seed) })
          const second = buildQuestion(itemId, level, { ...course, rng: createRng(seed) })
          equal(second, first, { itemId, level, seed })
        }
      }
    }
    equal(course, snapshot, { operation: 'buildQuestion', course: snapshot })
  })
})

interface JudgeCase {
  name: string
  question: Question
  correctResponse: Response
  wrongResponse: Response
  correctText: string
}

const cases: JudgeCase[] = [
  {
    name: 'mcq',
    question: {
      format: 'mcq',
      itemId: 'w-apple',
      direction: 'foreignToNative',
      prompt: 'apple',
      options: [
        { id: 'w-banana', text: 'バナナ' },
        { id: 'w-apple', text: 'りんご' },
      ],
      correctId: 'w-apple',
    },
    correctResponse: { kind: 'choice', optionId: 'w-apple' },
    wrongResponse: { kind: 'choice', optionId: 'w-banana' },
    correctText: 'りんご',
  },
  {
    name: 'cloze-choice',
    question: {
      format: 'cloze',
      itemId: 'w-apple',
      sentenceId: 's-apple',
      before: 'I eat an ',
      after: '.',
      answer: 'apple',
      mode: 'choice',
      accepted: [],
      correctId: 'w-apple',
      options: [
        { id: 'w-banana', text: 'banana' },
        { id: 'w-apple', text: 'APPLE' },
      ],
    },
    correctResponse: { kind: 'choice', optionId: 'w-apple' },
    wrongResponse: { kind: 'choice', optionId: 'w-banana' },
    correctText: 'apple',
  },
  {
    name: 'cloze-typing',
    question: {
      format: 'cloze',
      itemId: 'w-apple',
      sentenceId: 's-apple',
      before: 'I eat an ',
      after: '.',
      answer: 'apple',
      mode: 'typing',
      accepted: ['pomme'],
    },
    correctResponse: { kind: 'text', text: ' APPLE ' },
    wrongResponse: { kind: 'text', text: 'banana' },
    correctText: 'apple',
  },
  {
    name: 'typing',
    question: {
      format: 'typing',
      itemId: 'w-apple',
      prompt: 'りんご',
      answer: 'apple',
      accepted: ['pomme'],
    },
    correctResponse: { kind: 'text', text: ' APPLE ' },
    wrongResponse: { kind: 'text', text: 'banana' },
    correctText: 'apple',
  },
  {
    name: 'tiles',
    question: {
      format: 'tiles',
      itemId: 'w-apple',
      prompt: '私はりんごを食べます。',
      tiles: ['apple', 'I', 'eat', 'an', 'banana'],
      answer: ['I', 'eat', 'an', 'apple'],
      accepted: [['An', 'apple', 'I', 'eat']],
    },
    correctResponse: { kind: 'tiles', tiles: ['i', 'EAT', 'an', 'APPLE'] },
    wrongResponse: { kind: 'tiles', tiles: ['apple', 'an', 'eat', 'I'] },
    correctText: 'I eat an apple',
  },
  {
    name: 'match',
    question: {
      format: 'match',
      pairs: [
        { id: 'w-apple', foreign: 'apple', native: 'りんご' },
        { id: 'w-banana', foreign: 'banana', native: 'バナナ' },
      ],
      foreignOrder: ['w-apple', 'w-banana'],
      nativeOrder: ['w-banana', 'w-apple'],
    },
    correctResponse: {
      kind: 'match',
      pairs: [
        { foreignId: 'w-banana', nativeId: 'w-banana' },
        { foreignId: 'w-apple', nativeId: 'w-apple' },
      ],
    },
    wrongResponse: {
      kind: 'match',
      pairs: [
        { foreignId: 'w-apple', nativeId: 'w-banana' },
        { foreignId: 'w-banana', nativeId: 'w-apple' },
      ],
    },
    correctText: 'apple=りんご / banana=バナナ',
  },
  {
    name: 'flashcard',
    question: { format: 'flashcard', itemId: 'p-fixed', front: 'Hello!', back: 'こんにちは！' },
    correctResponse: { kind: 'selfGrade', grade: 'good' },
    wrongResponse: { kind: 'selfGrade', grade: 'again' },
    correctText: 'こんにちは！',
  },
  {
    name: 'phrase-slot',
    question: {
      format: 'phrase-slot',
      itemId: 'p-slot',
      target: 'cat eats apple.',
      meaning: 'ねこはりんごを食べます。',
      filled: { animal: 'w-cat' },
    },
    correctResponse: { kind: 'selfGrade', grade: 'easy' },
    wrongResponse: { kind: 'selfGrade', grade: 'again' },
    correctText: 'ねこはりんごを食べます。',
  },
]

const responseKinds: Response[] = [
  { kind: 'ack' },
  { kind: 'choice', optionId: 'w-apple' },
  { kind: 'text', text: 'apple' },
  { kind: 'tiles', tiles: ['I', 'eat', 'an', 'apple'] },
  { kind: 'match', pairs: [] },
  { kind: 'selfGrade', grade: 'good' },
]

describe('judgeResponse', () => {
  it.each(cases)('$name の正解・不正解と種類違いを判定する', (entry) => {
    const { question, correctResponse, wrongResponse, correctText } = entry
    for (const [response, correct] of [
      [correctResponse, true],
      [wrongResponse, false],
    ] as const) {
      judge(question, response, {
        correct,
        close: false,
        correctText,
        ...(response.kind === 'selfGrade' ? { selfGrade: response.grade } : {}),
      })
    }
    for (const response of responseKinds) {
      if (response.kind !== correctResponse.kind) {
        judge(question, response, { correct: false, close: false, correctText })
      }
    }
  })

  it.each(responseKinds)('intro は $kind でも常に正解', (response) => {
    judge({ format: 'intro', itemId: 'w-apple' }, response, {
      correct: true,
      close: false,
      correctText: '',
    })
  })

  it.each(cases.filter((entry) => entry.correctResponse.kind === 'text'))(
    '$name は許容別解・1文字違い・hint・空入力を判定する',
    ({ question }) => {
      judge(
        question,
        { kind: 'text', text: ' POMME ' },
        { correct: true, close: false, correctText: 'apple' },
      )
      judge(
        question,
        { kind: 'text', text: 'aple' },
        { correct: false, close: true, correctText: 'apple', hint: '先頭「a」・全体5文字' },
      )
      judge(
        question,
        { kind: 'text', text: 'pomne' },
        { correct: false, close: true, correctText: 'apple', hint: '先頭「p」・全体5文字' },
      )
      judge(
        question,
        { kind: 'text', text: '　 ' },
        { correct: false, close: false, correctText: 'apple' },
      )
    },
  )

  it('tiles は許容する別の並びも正解', () => {
    const entry = cases.find((entry) => entry.name === 'tiles')!
    judge(
      entry.question,
      { kind: 'tiles', tiles: ['an', 'APPLE', 'i', 'eat'] },
      { correct: true, close: false, correctText: entry.correctText },
    )
  })

  it('match は重複 foreignId・不足・余分・未知の ID を不正解にする', () => {
    const entry = cases.find((entry) => entry.name === 'match')!
    const apple = { foreignId: 'w-apple', nativeId: 'w-apple' }
    const banana = { foreignId: 'w-banana', nativeId: 'w-banana' }
    const unknown = { foreignId: 'unknown', nativeId: 'unknown' }
    for (const pairs of [[apple, apple], [apple], [apple, banana, unknown], [apple, unknown], []]) {
      judge(
        entry.question,
        { kind: 'match', pairs },
        { correct: false, close: false, correctText: entry.correctText },
      )
    }
  })

  it.each(cases.filter((entry) => entry.correctResponse.kind === 'selfGrade'))(
    '$name はすべての自己評価を保持する',
    ({ question, correctText }) => {
      for (const grade of ['again', 'hard', 'good', 'easy'] as const) {
        judge(
          question,
          { kind: 'selfGrade', grade },
          { correct: grade !== 'again', close: false, correctText, selfGrade: grade },
        )
      }
    },
  )
})
