import { describe, expect, it } from 'vitest'
import type { Phrase, Sentence, Word } from '../schema'
import type { Question, Response, Step } from './types'
import type { LessonContext } from './lesson'
import { isLessonDone, nextQuestion, startLesson, submitAnswer } from './lesson'
import { createRng } from './rng'
import { xpForCorrect } from './game'
import { MAX_RECALLS } from './session'

function word(id: string, lemma: string, meaning: string): Word {
  return {
    id,
    lemma,
    target: lemma,
    meaning: [meaning],
    meanings: [meaning],
    translations: [meaning],
    pos: 'noun',
    tags: ['common'],
  } as unknown as Word
}

function phrase(id: string, target: string, meaning: string): Phrase {
  return {
    id,
    target,
    meaning,
    fixed: true,
    slots: [],
  } as unknown as Phrase
}

function sentence(id: string, target: string, meaning: string, wordIds: string[]): Sentence {
  return {
    id,
    target,
    meaning,
    wordIds,
  } as unknown as Sentence
}

interface Course {
  words: Word[]
  phrases: Phrase[]
  sentences: Sentence[]
  allWordIds: string[]
}

function makeCourse(): Course {
  const words = [
    word('w1', 'apple', 'りんご'),
    word('w2', 'red', '赤い'),
    word('w3', 'eat', '食べる'),
    word('w4', 'day', '日'),
    word('w5', 'every', '毎'),
    word('w6', 'I', '私'),
  ]

  const phrases = [phrase('p1', 'eat an apple', 'りんごを食べる')]

  const sentences = [
    sentence('s1', 'I eat an apple every day.', '私は毎日りんごを食べます。', [
      'w1',
      'w3',
      'w4',
      'w5',
      'w6',
    ]),
    sentence('s2', 'The apple is red.', 'りんごは赤い。', ['w1', 'w2']),
  ]

  return {
    words,
    phrases,
    sentences,
    allWordIds: words.map((w) => w.id),
  }
}

function makeContext(seed: number, course?: Course): LessonContext {
  const c = course ?? makeCourse()
  return {
    words: c.words,
    phrases: c.phrases,
    sentences: c.sentences,
    pool: c.words,
    unitWordIds: new Set(c.allWordIds),
    learnedWordIds: new Set(c.allWordIds),
    rng: createRng(seed),
    fsrs: {},
    now: new Date('2026-01-01T00:00:00.000Z'),
  }
}

function makeStep(kind: Step['kind'], wordIds: string[], phraseIds: string[] = []): Step {
  return {
    id: `unit-batch-${kind}`,
    kind,
    batchIndex: kind === 'unitTest' ? null : 0,
    wordIds,
    phraseIds,
    sentenceIds: [],
  }
}

function correctResponse(question: Question): Response {
  switch (question.format) {
    case 'intro':
      return { kind: 'ack' }
    case 'flashcard':
    case 'phrase-slot':
      return { kind: 'selfGrade', grade: 'good' }
    case 'mcq':
      return { kind: 'choice', optionId: question.correctId }
    case 'cloze':
      if (question.mode === 'choice') {
        if (question.correctId !== undefined) {
          return { kind: 'choice', optionId: question.correctId }
        }
        return { kind: 'text', text: question.answer }
      }
      return { kind: 'text', text: question.answer }
    case 'typing':
      return { kind: 'text', text: question.answer }
    case 'tiles':
      return { kind: 'tiles', tiles: [...question.answer] }
    default:
      throw new Error(`未対応の形式です: ${JSON.stringify(question)}`)
  }
}

function wrongResponse(question: Question): Response {
  switch (question.format) {
    case 'intro':
      return { kind: 'ack' }
    case 'flashcard':
    case 'phrase-slot':
      return { kind: 'selfGrade', grade: 'again' }
    case 'mcq': {
      const wrongOption = question.options.find((option) => option.id !== question.correctId)
      if (wrongOption === undefined) {
        return { kind: 'choice', optionId: `not-${question.correctId}` }
      }
      return { kind: 'choice', optionId: wrongOption.id }
    }
    case 'cloze': {
      if (question.mode === 'choice') {
        const wrongOption = question.options?.find((option) => option.id !== question.correctId)
        if (wrongOption !== undefined) {
          return { kind: 'choice', optionId: wrongOption.id }
        }
        return { kind: 'text', text: `not-${question.answer}` }
      }
      return { kind: 'text', text: `not-${question.answer}` }
    }
    case 'typing':
      return { kind: 'text', text: `not-${question.answer}` }
    case 'tiles':
      return { kind: 'tiles', tiles: [] }
    default:
      throw new Error(`未対応の形式です: ${JSON.stringify(question)}`)
  }
}

function assertEqual<T>(actual: T, expected: T, input: unknown): void {
  expect(
    actual,
    `入力: ${JSON.stringify(input)}\n期待値: ${JSON.stringify(expected)}\n実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function assertNumberClose(actual: number, expected: number, input: unknown): void {
  expect(
    actual,
    `入力: ${JSON.stringify(input)}\n期待値: ${expected}\n実際: ${actual}`,
  ).toBeCloseTo(expected)
}

describe('lesson state machine', () => {
  it('intro step advances in order and creates new FSRS records without XP', () => {
    const course = makeCourse()
    const wordIds = ['w1', 'w2', 'w3']
    const step = makeStep('intro', wordIds)
    const context = makeContext(42, course)

    let state = startLesson(step, context)
    assertEqual(state.phase, 'main', { step })
    assertEqual(state.introQueue, wordIds, { step })
    assertEqual(state.current?.itemId, 'w1', { step })
    assertEqual(state.xp, 0, { step })

    for (let i = 0; i < wordIds.length; i += 1) {
      const itemId = wordIds[i]
      expect(
        state.current !== null && state.current.itemId === itemId,
        `入力: ${JSON.stringify({ step, index: i })}\n期待値: current が ${itemId} である\n実際: ${JSON.stringify(state.current)}`,
      ).toBe(true)

      expect(state.current).not.toBeNull()
      if (!state.current) throw new Error('current is null')
      const result = submitAnswer(state, context, correctResponse(state.current.question))
      state = nextQuestion(result.state, context)

      const expectedRemaining = wordIds.length - (i + 1)
      assertEqual(state.introQueue.length, expectedRemaining, { step, itemId })
    }

    assertEqual(isLessonDone(state), true, { step })
    assertEqual(state.current, null, { step })
    assertEqual(state.xp, 0, { step })
    assertEqual(state.answered, 0, { step })
    assertEqual(state.correct, 0, { step })

    for (const itemId of wordIds) {
      const record = state.fsrs[itemId]
      expect(
        record !== undefined && record.reps >= 0,
        `入力: ${JSON.stringify({ step, itemId })}\n期待値: fsrs に新規カードが入る\n実際: ${JSON.stringify(record)}`,
      ).toBe(true)
    }
  })

  it('recognize step completes with two correct answers per item and awards XP', () => {
    const course = makeCourse()
    const wordIds = ['w1', 'w2', 'w3']
    const step = makeStep('recognize', wordIds)
    const context = makeContext(7, course)

    let state = startLesson(step, context)
    assertEqual(state.phase, 'main', { step })

    while (!isLessonDone(state)) {
      expect(
        state.current !== null,
        `入力: ${JSON.stringify(step)}\n期待値: current が存在する\n実際: null`,
      ).toBe(true)
      expect(state.current).not.toBeNull()
      if (!state.current) throw new Error('current is null')
      const result = submitAnswer(state, context, correctResponse(state.current.question))
      assertEqual(result.judgement.correct, true, { step, question: state.current?.question })
      state = nextQuestion(result.state, context)
    }

    assertEqual(isLessonDone(state), true, { step })
    const expectedXp = 6 * xpForCorrect()
    assertNumberClose(state.xp, expectedXp, { step })
    assertEqual(state.answered, 6, { step })
    assertEqual(state.correct, 6, { step })

    for (const itemId of wordIds) {
      const record = state.fsrs[itemId]
      expect(
        record !== undefined && record.reps > 0,
        `入力: ${JSON.stringify({ step, itemId })}\n期待値: fsrs の reps が增える\n実際: ${JSON.stringify(record)}`,
      ).toBe(true)
    }
  })

  it('wrong answers are recorded and can cut off at MAX_RECALLS', () => {
    const course = makeCourse()
    const step = makeStep('recall', ['w1'])
    const context = makeContext(99, course)

    let state = startLesson(step, context)
    assertEqual(state.phase, 'main', { step })

    let guard = 0
    while (!isLessonDone(state) && guard < MAX_RECALLS + 2) {
      expect(
        state.current !== null,
        `入力: ${JSON.stringify(step)}\n期待値: current が存在する\n実際: null`,
      ).toBe(true)
      expect(state.current).not.toBeNull()
      if (!state.current) throw new Error('current is null')
      const result = submitAnswer(state, context, wrongResponse(state.current.question))
      state = nextQuestion(result.state, context)
      guard += 1
    }

    assertEqual(isLessonDone(state), true, { step })
    expect(
      state.wrongItemIds.includes('w1'),
      `入力: ${JSON.stringify(step)}\n期待値: wrongItemIds に w1 が含まれる\n実際: ${JSON.stringify(state.wrongItemIds)}`,
    ).toBe(true)

    const item = state.items.find((candidate) => candidate.itemId === 'w1')
    expect(
      item !== undefined && (item.done || item.recalls >= MAX_RECALLS),
      `入力: ${JSON.stringify(step)}\n期待値: 項目が打ち切られる\n実際: ${JSON.stringify(item)}`,
    ).toBe(true)

    assertEqual(item?.level, 0, { step })
  })

  it('usedHint makes the next due earlier or equal', () => {
    const course = makeCourse()
    const step = makeStep('recognize', ['w1'])

    const hintedContext = makeContext(5, course)
    const hintedState = startLesson(step, hintedContext)
    expect(
      hintedState.current !== null,
      `入力: ${JSON.stringify(step)}\n期待値: current が存在する\n実際: null`,
    ).toBe(true)
    expect(hintedState.current).not.toBeNull()
    if (!hintedState.current) throw new Error('current is null')
    const hintedResult = submitAnswer(
      hintedState,
      hintedContext,
      correctResponse(hintedState.current.question),
      {
        usedHint: true,
      },
    )
    const hintedDue = Date.parse(hintedResult.state.fsrs['w1']?.due ?? '')

    const normalContext = makeContext(5, course)
    const normalState = startLesson(step, normalContext)
    expect(
      normalState.current !== null,
      `入力: ${JSON.stringify(step)}\n期待値: current が存在する\n実際: null`,
    ).toBe(true)
    expect(normalState.current).not.toBeNull()
    if (!normalState.current) throw new Error('current is null')
    const normalResult = submitAnswer(
      normalState,
      normalContext,
      correctResponse(normalState.current.question),
    )
    const normalDue = Date.parse(normalResult.state.fsrs['w1']?.due ?? '')

    expect(
      Number.isFinite(hintedDue) && Number.isFinite(normalDue) && hintedDue <= normalDue,
      `入力: ${JSON.stringify(step)}\n期待値: ヒント使用の due が早いまたは同じ\n実際: hinted=${hintedDue}, normal=${normalDue}`,
    ).toBe(true)
  })

  it('unitTest retries only wrong items and does not grow wrongItemIds during retry', () => {
    const course = makeCourse()
    const step = makeStep('unitTest', ['w1'], ['p1'])
    const context = makeContext(3, course)

    let state = startLesson(step, context)
    assertEqual(state.phase, 'main', { step })

    while (!isLessonDone(state)) {
      expect(
        state.current !== null,
        `入力: ${JSON.stringify(step)}\n期待値: current が存在する\n実際: null`,
      ).toBe(true)
      expect(state.current).not.toBeNull()
      if (!state.current) throw new Error('current is null')
      const question = state.current.question
      if (question.format === 'match') throw new Error('Unexpected match question')
      const response =
        question.itemId === 'w1'
          ? wrongResponse(state.current.question)
          : correctResponse(state.current.question)
      const result = submitAnswer(state, context, response)
      state = nextQuestion(result.state, context)
    }

    assertEqual(isLessonDone(state), true, { step })
    expect(
      state.wrongItemIds.includes('w1'),
      `入力: ${JSON.stringify(step)}\n期待値: wrongItemIds に w1 が含まれる\n実際: ${JSON.stringify(state.wrongItemIds)}`,
    ).toBe(true)

    const retryWrongLogs = state.log.filter(
      (entry) => entry.itemId === 'w1' && !entry.correct,
    ).length
    expect(
      retryWrongLogs >= 2,
      `入力: ${JSON.stringify(step)}\n期待値: 再出題中の誤答も log に残る\n実際: ${JSON.stringify(state.log)}`,
    ).toBe(true)

    const wrongCount = state.wrongItemIds.filter((id) => id === 'w1').length
    assertEqual(wrongCount, 1, { step })
  })

  it('keeps input state immutable and handles null current safely', () => {
    const course = makeCourse()
    const step = makeStep('recognize', ['w1'])
    const context = makeContext(11, course)

    const state = startLesson(step, context)
    const frozenState = deepFreeze({ ...state })
    expect(() => {
      submitAnswer(
        frozenState,
        context,
        correctResponse(state.current?.question ?? { format: 'intro', itemId: 'w1' }),
      )
      nextQuestion(frozenState, context)
    }).not.toThrow()

    assertEqual(state.phase, 'main', { step })
    expect(
      state.current !== null,
      `入力: ${JSON.stringify(step)}\n期待値: current が存在する\n実際: null`,
    ).toBe(true)

    const nullCurrent = deepFreeze({ ...state, current: null })
    const result = submitAnswer(nullCurrent, context, { kind: 'ack' })
    assertEqual(result.state, nullCurrent, { step })
    assertEqual(result.judgement, { correct: false, close: false, correctText: '' }, { step })
  })

  it('produces the same question order for the same seed', () => {
    const course = makeCourse()
    const step = makeStep('recognize', ['w1', 'w2'])

    function run(seed: number): string[] {
      const context = makeContext(seed, course)
      let state = startLesson(step, context)
      const order: string[] = []

      while (!isLessonDone(state)) {
        if (state.current === null) break
        order.push(`${state.current.itemId}:${state.current.question.format}`)
        expect(state.current).not.toBeNull()
        if (!state.current) throw new Error('current is null')
        const result = submitAnswer(state, context, correctResponse(state.current.question))
        state = nextQuestion(result.state, context)
      }

      return order
    }

    assertEqual(run(1234), run(1234), { step })
  })
})

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value
  }

  Object.freeze(value)
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key]
    deepFreeze(child)
  }
  return value
}
