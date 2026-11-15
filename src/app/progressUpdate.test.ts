import { describe, expect, it } from 'vitest'
import { applyLessonResult, isUnitComplete } from './progressUpdate'
import type { ApplyOptions, LessonResult } from './progressUpdate'
import { xpForStepComplete, xpForUnitComplete } from '../engine/game'
import type { Step } from '../engine/types'
import type { FsrsRecord, Progress, SessionLog, UnitProgress } from '../schema'

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) {
      deepFreeze(child)
    }
  }
  return value
}

function expectEqual(actual: unknown, expected: unknown, input: unknown): void {
  expect(
    actual,
    `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function makeFsrs(overrides: Partial<FsrsRecord> = {}): FsrsRecord {
  return {
    due: '2026-01-01T00:00:00.000Z',
    stability: 1,
    difficulty: 3,
    elapsedDays: 0,
    scheduledDays: 1,
    reps: 0,
    lapses: 0,
    state: 0,
    ...overrides,
  }
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 'u1-b0-intro',
    kind: 'intro',
    batchIndex: 0,
    wordIds: ['w1', 'w2'],
    phraseIds: [],
    sentenceIds: [],
    ...overrides,
  }
}

function makeResult(overrides: Partial<LessonResult> = {}): LessonResult {
  return {
    unitId: 'u1',
    step: makeStep(),
    kind: 'lesson',
    fsrs: {},
    xp: 10,
    answered: 5,
    correct: 4,
    wrongItemIds: [],
    seed: 123,
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:05:00.000Z',
    stepCompleted: false,
    unitCompleted: false,
    ...overrides,
  }
}

function makeUnitProgress(overrides: Partial<UnitProgress> = {}): UnitProgress {
  return {
    introducedItemIds: [],
    completedStepIds: [],
    wrongItemIds: [],
    ...overrides,
  }
}

function makeProgress(overrides: Partial<Progress> = {}): Progress {
  return {
    fsrs: {},
    unitProgress: {},
    xp: 0,
    streak: { days: 0, lastStudyDate: null },
    sessions: [],
    ...overrides,
  }
}

function makeSession(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 'old',
    kind: 'lesson',
    unitId: 'u1',
    stepId: 'u1-b0-intro',
    seed: 1,
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:05:00.000Z',
    answered: 1,
    correct: 1,
    xpGained: 1,
    ...overrides,
  }
}

function makeOptions(overrides: Partial<ApplyOptions> = {}): ApplyOptions {
  return {
    today: '2026-01-01',
    dailyGoal: 1,
    reviewsDoneToday: 0,
    ...overrides,
  }
}

describe('applyLessonResult XP', () => {
  it('レッスンXPだけ加算する', () => {
    const progress = makeProgress({ xp: 100 })
    const result = makeResult({ xp: 10, stepCompleted: false, unitCompleted: false })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = 100 + 10
    expectEqual(actual.xp, expected, { progress, result, options })
  })

  it('ステップ完了ボーナスを加算する', () => {
    const progress = makeProgress({ xp: 100 })
    const result = makeResult({ xp: 10, stepCompleted: true, unitCompleted: false })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = 100 + 10 + xpForStepComplete()
    expectEqual(actual.xp, expected, { progress, result, options })
  })

  it('単元完了ボーナスを加算する', () => {
    const progress = makeProgress({ xp: 100 })
    const result = makeResult({ xp: 10, stepCompleted: false, unitCompleted: true })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = 100 + 10 + xpForUnitComplete()
    expectEqual(actual.xp, expected, { progress, result, options })
  })

  it('ステップ完了と単元完了の両方を加算する', () => {
    const progress = makeProgress({ xp: 100 })
    const result = makeResult({ xp: 10, stepCompleted: true, unitCompleted: true })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = 100 + 10 + xpForStepComplete() + xpForUnitComplete()
    expectEqual(actual.xp, expected, { progress, result, options })
  })
})

describe('applyLessonResult unitProgress', () => {
  it('新規の単元を作る', () => {
    const progress = makeProgress()
    const result = makeResult({
      kind: 'lesson',
      step: makeStep({ kind: 'recognize', wordIds: ['w1'] }),
      stepCompleted: true,
      wrongItemIds: ['w1'],
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = makeUnitProgress({
      introducedItemIds: [],
      completedStepIds: [result.step.id],
      wrongItemIds: ['w1'],
      startedAt: result.startedAt,
    })
    expectEqual(actual.unitProgress[result.unitId], expected, { progress, result, options })
  })

  it('intro のとき introducedItemIds を重複なしで増やす', () => {
    const progress = makeProgress({
      unitProgress: {
        u1: makeUnitProgress({ introducedItemIds: ['w1'] }),
      },
    })
    const result = makeResult({
      kind: 'lesson',
      step: makeStep({ kind: 'intro', wordIds: ['w1', 'w2', 'w3'] }),
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = ['w1', 'w2', 'w3']
    expectEqual(actual.unitProgress['u1']?.introducedItemIds, expected, {
      progress,
      result,
      options,
    })
  })

  it('recognize では introducedItemIds を増やさない', () => {
    const progress = makeProgress({
      unitProgress: {
        u1: makeUnitProgress({ introducedItemIds: ['w1'] }),
      },
    })
    const result = makeResult({
      kind: 'lesson',
      step: makeStep({ kind: 'recognize', wordIds: ['w2'] }),
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = ['w1']
    expectEqual(actual.unitProgress['u1']?.introducedItemIds, expected, {
      progress,
      result,
      options,
    })
  })

  it('completedStepIds を重複なしで追加する', () => {
    const step = makeStep({ kind: 'recognize' })
    const progress = makeProgress({
      unitProgress: {
        u1: makeUnitProgress({ completedStepIds: [step.id] }),
      },
    })
    const result = makeResult({ kind: 'lesson', step, stepCompleted: true })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = [step.id]
    expectEqual(actual.unitProgress['u1']?.completedStepIds, expected, {
      progress,
      result,
      options,
    })
  })

  it('wrongItemIds を和集合にする', () => {
    const progress = makeProgress({
      unitProgress: {
        u1: makeUnitProgress({ wrongItemIds: ['w1', 'w2'] }),
      },
    })
    const result = makeResult({ kind: 'lesson', wrongItemIds: ['w2', 'w3'] })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = ['w1', 'w2', 'w3']
    expectEqual(actual.unitProgress['u1']?.wrongItemIds, expected, {
      progress,
      result,
      options,
    })
  })

  it('既存の startedAt を保持する', () => {
    const progress = makeProgress({
      unitProgress: {
        u1: makeUnitProgress({ startedAt: '2026-01-01T00:00:00.000Z' }),
      },
    })
    const result = makeResult({
      kind: 'lesson',
      startedAt: '2026-01-02T00:00:00.000Z',
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = '2026-01-01T00:00:00.000Z'
    expectEqual(actual.unitProgress['u1']?.startedAt, expected, {
      progress,
      result,
      options,
    })
  })

  it('単元完了で completedAt を endedAt にする', () => {
    const progress = makeProgress({
      unitProgress: {
        u1: makeUnitProgress({ completedAt: '2026-01-01T00:00:00.000Z' }),
      },
    })
    const result = makeResult({
      kind: 'lesson',
      endedAt: '2026-01-02T00:00:00.000Z',
      unitCompleted: true,
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = '2026-01-02T00:00:00.000Z'
    expectEqual(actual.unitProgress['u1']?.completedAt, expected, {
      progress,
      result,
      options,
    })
  })

  it('単元未完では既存の completedAt を保持する', () => {
    const progress = makeProgress({
      unitProgress: {
        u1: makeUnitProgress({ completedAt: '2026-01-01T00:00:00.000Z' }),
      },
    })
    const result = makeResult({
      kind: 'lesson',
      endedAt: '2026-01-02T00:00:00.000Z',
      unitCompleted: false,
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = '2026-01-01T00:00:00.000Z'
    expectEqual(actual.unitProgress['u1']?.completedAt, expected, {
      progress,
      result,
      options,
    })
  })
})

describe('applyLessonResult review', () => {
  it('kind: review では unitProgress を変更しない', () => {
    const progress = makeProgress({
      unitProgress: {
        u1: makeUnitProgress({ introducedItemIds: ['w1'] }),
      },
    })
    const result = makeResult({
      kind: 'review',
      unitId: 'review',
      step: makeStep({ id: 'review-step', kind: 'recognize', wordIds: ['w2'] }),
      stepCompleted: true,
      unitCompleted: true,
      wrongItemIds: ['w2'],
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    expectEqual(actual.unitProgress, progress.unitProgress, { progress, result, options })
    expectEqual(Object.keys(actual.unitProgress).length, 1, { progress, result, options })
  })
})

describe('applyLessonResult fsrs', () => {
  it('既存の別IDを残し、同じIDは上書きする', () => {
    const progress = makeProgress({
      fsrs: {
        a: makeFsrs({ reps: 1 }),
        b: makeFsrs({ reps: 2 }),
      },
    })
    const result = makeResult({
      fsrs: {
        a: makeFsrs({ reps: 9 }),
        c: makeFsrs({ reps: 3 }),
      },
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = {
      a: makeFsrs({ reps: 9 }),
      b: makeFsrs({ reps: 2 }),
      c: makeFsrs({ reps: 3 }),
    }
    expectEqual(actual.fsrs, expected, { progress, result, options })
  })
})

describe('applyLessonResult streak', () => {
  it('ステップ完了で初回に更新する', () => {
    const progress = makeProgress({ streak: { days: 0, lastStudyDate: null } })
    const result = makeResult({ kind: 'lesson', stepCompleted: true })
    const options = makeOptions({ today: '2026-01-01' })
    const actual = applyLessonResult(progress, result, options)
    const expected = { days: 1, lastStudyDate: '2026-01-01' }
    expectEqual(actual.streak, expected, { progress, result, options })
  })

  it('ステップ完了で前日からの継続を更新する', () => {
    const progress = makeProgress({ streak: { days: 1, lastStudyDate: '2026-01-01' } })
    const result = makeResult({ kind: 'lesson', stepCompleted: true })
    const options = makeOptions({ today: '2026-01-02' })
    const actual = applyLessonResult(progress, result, options)
    const expected = { days: 2, lastStudyDate: '2026-01-02' }
    expectEqual(actual.streak, expected, { progress, result, options })
  })

  it('ステップ完了で途切れたら1にリセットする', () => {
    const progress = makeProgress({ streak: { days: 5, lastStudyDate: '2026-01-01' } })
    const result = makeResult({ kind: 'lesson', stepCompleted: true })
    const options = makeOptions({ today: '2026-01-03' })
    const actual = applyLessonResult(progress, result, options)
    const expected = { days: 1, lastStudyDate: '2026-01-03' }
    expectEqual(actual.streak, expected, { progress, result, options })
  })

  it('完了していないレッスンでは streak を変更しない', () => {
    const progress = makeProgress({ streak: { days: 3, lastStudyDate: '2026-01-01' } })
    const result = makeResult({ kind: 'lesson', stepCompleted: false })
    const options = makeOptions({ today: '2026-01-02', dailyGoal: 1, reviewsDoneToday: 0 })
    const actual = applyLessonResult(progress, result, options)
    expectEqual(actual.streak, progress.streak, { progress, result, options })
  })

  it('復習が目標に達したとき streak を更新する', () => {
    const progress = makeProgress({ streak: { days: 0, lastStudyDate: null } })
    const result = makeResult({ kind: 'review', answered: 3, stepCompleted: false })
    const options = makeOptions({ today: '2026-01-01', dailyGoal: 5, reviewsDoneToday: 2 })
    const actual = applyLessonResult(progress, result, options)
    const expected = { days: 1, lastStudyDate: '2026-01-01' }
    expectEqual(actual.streak, expected, { progress, result, options })
  })
})

describe('applyLessonResult sessions', () => {
  it('セッションを追加する', () => {
    const progress = makeProgress()
    const result = makeResult({ xp: 10, stepCompleted: true, unitCompleted: false })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    const expected = [
      {
        id: `${result.startedAt}|${result.step.id}`,
        kind: result.kind,
        unitId: result.unitId,
        stepId: result.step.id,
        seed: result.seed,
        startedAt: result.startedAt,
        endedAt: result.endedAt,
        answered: result.answered,
        correct: result.correct,
        xpGained: result.xp + xpForStepComplete(),
      },
    ]
    expectEqual(actual.sessions, expected, { progress, result, options })
  })

  it('id が重複すると二重に追加しない', () => {
    const result = makeResult()
    const existingId = `${result.startedAt}|${result.step.id}`
    const progress = makeProgress({
      sessions: [makeSession({ id: existingId })],
    })
    const options = makeOptions()
    const actual = applyLessonResult(progress, result, options)
    expectEqual(actual.sessions.length, 1, { progress, result, options })
  })

  it('sessionsMax を超えたら古いものを落とす', () => {
    const result = makeResult({ startedAt: '2026-01-04T00:00:00.000Z' })
    const progress = makeProgress({
      sessions: [
        makeSession({ id: 'old1', startedAt: '2026-01-01T00:00:00.000Z' }),
        makeSession({ id: 'old2', startedAt: '2026-01-02T00:00:00.000Z' }),
        makeSession({ id: 'old3', startedAt: '2026-01-03T00:00:00.000Z' }),
      ],
    })
    const options = makeOptions({ sessionsMax: 2 })
    const actual = applyLessonResult(progress, result, options)
    const expectedIds = ['old3', `${result.startedAt}|${result.step.id}`]
    expectEqual(
      actual.sessions.map((session) => session.id),
      expectedIds,
      {
        progress,
        result,
        options,
      },
    )
  })
})

describe('applyLessonResult immutability', () => {
  it('入力の progress と result を変更しない', () => {
    const progress = deepFreeze(
      makeProgress({
        fsrs: { a: makeFsrs() },
        unitProgress: { u1: makeUnitProgress({ introducedItemIds: ['w1'] }) },
        sessions: [makeSession()],
      }),
    )
    const result = deepFreeze(
      makeResult({
        fsrs: { a: makeFsrs({ reps: 2 }) },
        wrongItemIds: ['w1'],
        stepCompleted: true,
      }),
    )
    const options = makeOptions()
    const beforeProgress = JSON.stringify(progress)
    const beforeResult = JSON.stringify(result)

    applyLessonResult(progress, result, options)

    expectEqual(JSON.stringify(progress), beforeProgress, { progress, result, options })
    expectEqual(JSON.stringify(result), beforeResult, { progress, result, options })
  })
})

describe('isUnitComplete', () => {
  it('空配列は false', () => {
    const stepIds: string[] = []
    const completedStepIds: string[] = []
    expectEqual(isUnitComplete(stepIds, completedStepIds), false, {
      stepIds,
      completedStepIds,
    })
  })

  it('すべて完了していれば true', () => {
    const stepIds = ['a', 'b']
    const completedStepIds = ['a', 'b', 'c']
    expectEqual(isUnitComplete(stepIds, completedStepIds), true, {
      stepIds,
      completedStepIds,
    })
  })

  it('1つ欠けていれば false', () => {
    const stepIds = ['a', 'b']
    const completedStepIds = ['a']
    expectEqual(isUnitComplete(stepIds, completedStepIds), false, {
      stepIds,
      completedStepIds,
    })
  })
})
