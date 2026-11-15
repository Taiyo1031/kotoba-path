import { describe, it, expect } from 'vitest'
import { StudyDataSchema } from '../schema'
import { buildWordStats } from './wordStats'

const NOW = new Date('2026-01-12T12:00:00.000Z')

function check(input: unknown, expected: unknown, actual: unknown): void {
  expect(
    actual,
    `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function deepFreeze(value: unknown): void {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
}

const makeWord = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  lemma: `lemma-${id}`,
  pos: 'noun',
  meaning: [`meaning-${id}`],
  ...overrides,
})

const makeRecord = (overrides: Record<string, unknown> = {}) => ({
  due: '2026-01-15T00:00:00.000Z',
  stability: 3,
  difficulty: 3,
  elapsedDays: 0,
  scheduledDays: 1,
  reps: 1,
  lapses: 0,
  state: 2,
  ...overrides,
})

const makeData = (overrides: Record<string, unknown> = {}) =>
  StudyDataSchema.parse({
    format: 'lang-study-data',
    version: 1,
    meta: { exportedAt: NOW.toISOString(), appVersion: '0.1.0' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'en',
      goal: {
        dailyMinutes: 30,
        studyDaysPerWeek: 7,
        targetLevel: 'A1',
        deadline: '2026-01-19',
      },
    },
    plan: { units: [] },
    content: { units: {} },
    progress: { unitProgress: {}, fsrs: {}, streak: { days: 0, lastStudyDate: null }, xp: 0 },
    ...overrides,
  })

const makeSingleWordData = (overrides: Record<string, unknown> = {}) =>
  makeData({
    plan: { units: [{ id: 'u1', title: 'Unit 1', canDo: 'greet', itemEstimate: 1 }] },
    content: {
      units: {
        u1: {
          verified: true,
          generatedBy: { tool: 'test', at: NOW.toISOString() },
          words: [makeWord('w1')],
          phrases: [],
        },
      },
    },
    ...overrides,
  })

describe('buildWordStats', () => {
  it('marks a word without record and not introduced as unseen', () => {
    const data = makeSingleWordData()
    const stats = buildWordStats(data, NOW)
    check(
      { data, now: NOW },
      {
        state: 'unseen',
        stabilityDays: null,
        lapses: 0,
        due: null,
        dueInDays: null,
      },
      stats.entries[0] && {
        state: stats.entries[0].state,
        stabilityDays: stats.entries[0].stabilityDays,
        lapses: stats.entries[0].lapses,
        due: stats.entries[0].due,
        dueInDays: stats.entries[0].dueInDays,
      },
    )
  })

  it('marks an introduced word without record as learning', () => {
    const data = makeSingleWordData({
      progress: {
        unitProgress: { u1: { introducedItemIds: ['w1'], completedStepIds: [], wrongItemIds: [] } },
        fsrs: {},
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })
    const stats = buildWordStats(data, NOW)
    check({ data, now: NOW }, 'learning', stats.entries[0]?.state)
  })

  it('marks a zero-rep record without introduction as unseen', () => {
    const data = makeSingleWordData({
      progress: {
        unitProgress: {},
        fsrs: { w1: makeRecord({ reps: 0, state: 1 }) },
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })
    const stats = buildWordStats(data, NOW)
    check({ data, now: NOW }, 'unseen', stats.entries[0]?.state)
  })

  it('marks a zero-rep record with introduction as learning', () => {
    const data = makeSingleWordData({
      progress: {
        unitProgress: { u1: { introducedItemIds: ['w1'], completedStepIds: [], wrongItemIds: [] } },
        fsrs: { w1: makeRecord({ reps: 0, state: 1 }) },
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })
    const stats = buildWordStats(data, NOW)
    check({ data, now: NOW }, 'learning', stats.entries[0]?.state)
  })

  it('marks state 1 and state 3 records as learning even when due', () => {
    for (const state of [1, 3]) {
      const data = makeSingleWordData({
        progress: {
          unitProgress: {},
          fsrs: { w1: makeRecord({ reps: 3, state, due: '2026-01-11T00:00:00.000Z' }) },
          streak: { days: 0, lastStudyDate: null },
          xp: 0,
        },
      })
      const stats = buildWordStats(data, NOW)
      check({ data, now: NOW, state }, 'learning', stats.entries[0]?.state)
    }
  })

  it('marks a future-due young record as young', () => {
    const data = makeSingleWordData({
      progress: {
        unitProgress: {},
        fsrs: { w1: makeRecord({ reps: 3, state: 2, stability: 3 }) },
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })
    const stats = buildWordStats(data, NOW)
    check({ data, now: NOW }, 'young', stats.entries[0]?.state)
  })

  it('marks stability exactly at the mature threshold as mature when not due', () => {
    const data = makeSingleWordData({
      progress: {
        unitProgress: {},
        fsrs: { w1: makeRecord({ reps: 3, state: 2, stability: 10 }) },
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })
    const stats = buildWordStats(data, NOW)
    check({ data, now: NOW }, 'mature', stats.entries[0]?.state)
  })

  it('marks past-due records as fading before maturity', () => {
    for (const stability of [3, 30]) {
      const data = makeSingleWordData({
        progress: {
          unitProgress: {},
          fsrs: {
            w1: makeRecord({ reps: 3, state: 2, stability, due: '2026-01-11T00:00:00.000Z' }),
          },
          streak: { days: 0, lastStudyDate: null },
          xp: 0,
        },
      })
      const stats = buildWordStats(data, NOW)
      check({ data, now: NOW, stability }, 'fading', stats.entries[0]?.state)
    }
  })

  it('keeps counts consistent with entries and dueNow includes overdue learning words', () => {
    const data = makeData({
      plan: { units: [{ id: 'u1', title: 'Unit 1', canDo: 'greet', itemEstimate: 5 }] },
      content: {
        units: {
          u1: {
            verified: true,
            generatedBy: { tool: 'test', at: NOW.toISOString() },
            words: [
              makeWord('wUnseen'),
              makeWord('wLearningDue'),
              makeWord('wYoungFuture'),
              makeWord('wMature'),
              makeWord('wFading'),
            ],
            phrases: [],
          },
        },
      },
      progress: {
        unitProgress: {},
        fsrs: {
          wLearningDue: makeRecord({ reps: 3, state: 1, due: '2026-01-11T00:00:00.000Z' }),
          wYoungFuture: makeRecord({ reps: 3, state: 2, stability: 3 }),
          wMature: makeRecord({ reps: 3, state: 2, stability: 10 }),
          wFading: makeRecord({
            reps: 3,
            state: 2,
            stability: 30,
            due: '2026-01-11T00:00:00.000Z',
          }),
        },
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })

    const stats = buildWordStats(data, NOW)
    check(
      { data, now: NOW },
      {
        total: 5,
        counts: { unseen: 1, learning: 1, young: 1, mature: 1, fading: 1 },
        seen: 4,
        mature: 1,
        dueNow: 2,
      },
      {
        total: stats.total,
        counts: stats.counts,
        seen: stats.seen,
        mature: stats.mature,
        dueNow: stats.dueNow,
      },
    )
  })

  it('skips empty units and preserves plan and word order', () => {
    const data = makeData({
      plan: {
        units: [
          { id: 'u2', title: 'Unit 2', canDo: 'order', itemEstimate: 1 },
          { id: 'uEmpty', title: 'Empty', canDo: 'greet', itemEstimate: 1 },
          { id: 'u1', title: 'Unit 1', canDo: 'greet', itemEstimate: 2 },
        ],
      },
      content: {
        units: {
          u2: {
            verified: true,
            generatedBy: { tool: 'test', at: NOW.toISOString() },
            words: [makeWord('wB')],
            phrases: [],
          },
          uEmpty: {
            verified: true,
            generatedBy: { tool: 'test', at: NOW.toISOString() },
            words: [],
            phrases: [],
          },
          u1: {
            verified: true,
            generatedBy: { tool: 'test', at: NOW.toISOString() },
            words: [makeWord('wA2'), makeWord('wA1')],
            phrases: [{ id: 'p1', target: 'phrase', meaning: 'phrase-meaning', fixed: true }],
          },
        },
      },
    })

    const stats = buildWordStats(data, NOW)
    check(
      { data, now: NOW },
      ['wB', 'wA2', 'wA1'],
      stats.entries.map((entry) => entry.id),
    )
  })

  it('uses empty string when meaning is an empty array', () => {
    const data = makeSingleWordData()
    const word = data.content.units['u1']?.words[0]
    check({ data, now: NOW }, true, word !== undefined)
    if (word === undefined) return

    word.meaning = []
    const stats = buildWordStats(data, NOW)
    check({ data, now: NOW }, '', stats.entries[0]?.meaning)
  })

  it('ceil dueInDays for future dates and allows non-positive values for past dates', () => {
    const futureData = makeSingleWordData({
      progress: {
        unitProgress: {},
        fsrs: {
          w1: makeRecord({ reps: 3, state: 2, stability: 3, due: '2026-01-14T16:48:00.000Z' }),
        },
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })
    const futureStats = buildWordStats(futureData, NOW)
    check({ data: futureData, now: NOW }, 3, futureStats.entries[0]?.dueInDays)

    const pastData = makeSingleWordData({
      progress: {
        unitProgress: {},
        fsrs: {
          w1: makeRecord({ reps: 3, state: 2, stability: 3, due: '2026-01-11T00:00:00.000Z' }),
        },
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })
    const pastStats = buildWordStats(pastData, NOW)
    expect(
      (pastStats.entries[0]?.dueInDays ?? Number.POSITIVE_INFINITY) <= 0,
      `入力: ${JSON.stringify({ data: pastData, now: NOW })} 期待値: dueInDays <= 0 実際: ${JSON.stringify(pastStats.entries[0])}`,
    ).toBe(true)
  })

  it('does not mutate saved data and returns repeatable results', () => {
    const data = makeSingleWordData({
      progress: {
        unitProgress: { u1: { introducedItemIds: ['w1'], completedStepIds: [], wrongItemIds: [] } },
        fsrs: { w1: makeRecord({ reps: 3, state: 2, stability: 10 }) },
        streak: { days: 0, lastStudyDate: null },
        xp: 0,
      },
    })

    const before = JSON.stringify(data)
    deepFreeze(data)
    const first = buildWordStats(data, NOW)
    const second = buildWordStats(data, NOW)

    check({ data, now: NOW }, before, JSON.stringify(data))
    check({ data, now: NOW }, first, second)
  })
})
