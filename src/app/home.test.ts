import { describe, it, expect } from 'vitest'
import { StudyDataSchema } from '../schema'
import { buildHomeView } from './home'

type HomeInput = Parameters<typeof buildHomeView>[1]

const TODAY = '2026-01-12'
const NOW = new Date('2026-01-12T12:00:00.000Z')
const RECORD = {
  due: '2026-01-12T00:00:00.000Z',
  stability: 1,
  difficulty: 3,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: 0,
  lapses: 0,
  state: 1,
}

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
    plan: {
      units: [
        { id: 'u2', title: 'Unit 2', canDo: 'order', itemEstimate: 20 },
        {
          id: 'u1',
          title: 'Unit 1',
          canDo: 'greet',
          status: 'inProgress',
          itemEstimate: 10,
          plannedStart: '2026-01-12',
          plannedEnd: '2026-01-14',
        },
        { id: 'u3', title: 'Unit 3', canDo: 'travel', itemEstimate: 30, optional: true },
      ],
    },
    content: {
      units: {
        u1: {
          verified: true,
          generatedBy: { tool: 'test', at: NOW.toISOString() },
          words: [
            {
              id: 'w1',
              lemma: 'hello',
              pos: 'interjection',
              meaning: ['こんにちは'],
              uncertain: true,
            },
            { id: 'w2', lemma: 'goodbye', pos: 'interjection', meaning: ['さようなら'] },
          ],
          phrases: [{ id: 'p1', target: 'hello world', meaning: 'こんにちは世界', fixed: true }],
        },
      },
    },
    progress: {
      unitProgress: {
        u1: {
          startedAt: '2026-01-12T00:00:00.000Z',
          completedStepIds: [
            'u1-b0-intro',
            'u1-b0-recognize',
            'u1-b0-intro',
            'missing-step',
            'u2-b0-intro',
          ],
          introducedItemIds: ['w1', 'w2'],
        },
      },
      fsrs: {
        past: RECORD,
        now: { ...RECORD, due: NOW.toISOString() },
        future: { ...RECORD, due: '2026-01-12T12:00:00.001Z' },
      },
      streak: { days: 4, lastStudyDate: '2026-01-11' },
      xp: 123,
    },
    ...overrides,
  })

const makeInput = (overrides: Partial<HomeInput> = {}): HomeInput => ({
  today: TODAY,
  now: new Date(NOW),
  dailyGoal: 10,
  reviewsDoneToday: 3,
  lastBackupAt: null,
  ...overrides,
})

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

describe('buildHomeView', () => {
  it.each([
    { deadline: '2026-11-20', expectedDays: 5 },
    { deadline: '2026-11-15', expectedDays: 0 },
    { deadline: '2026-11-14', expectedDays: -1 },
  ])('reports goal values for $deadline', ({ deadline, expectedDays }) => {
    const data = makeData()
    data.profile.goal.deadline = deadline
    const input = makeInput({ today: '2026-11-15' })
    check(
      { data, input },
      { deadline, daysLeft: expectedDays, introduced: 2, total: 53, ratio: 2 / 53 },
      buildHomeView(data, input).goal,
    )
  })

  it.each([
    { introduced: 0, total: 53, ratio: 0 },
    { introduced: 53, total: 53, ratio: 1 },
    { introduced: 54, total: 53, ratio: 1 },
    { introduced: 0, total: 0, ratio: 0 },
  ])('bounds goal ratio for $introduced/$total', ({ introduced, total, ratio }) => {
    const data = makeData()
    if (total === 0) data.plan.units = []
    data.progress.unitProgress.u1!.introducedItemIds = Array.from(
      { length: introduced },
      (_, index) => `item-${index}`,
    )
    const input = makeInput()
    check(
      { data, input },
      {
        deadline: data.profile.goal.deadline,
        daysLeft: 7,
        introduced,
        total,
        ratio,
      },
      buildHomeView(data, input).goal,
    )
  })

  it('preserves plan order and counts content and distinct existing completed steps', () => {
    const data = makeData()
    const input = makeInput()
    const view = buildHomeView(data, input)

    check(
      { data, input },
      [
        {
          id: 'u2',
          title: 'Unit 2',
          canDo: 'order',
          status: 'planned',
          hasContent: false,
          itemCount: 20,
          stepsTotal: 0,
          stepsDone: 0,
          progressRatio: 0,
          verified: false,
          hasUncertain: false,
          optional: false,
        },
        {
          id: 'u1',
          title: 'Unit 1',
          canDo: 'greet',
          status: 'inProgress',
          plannedStart: '2026-01-12',
          plannedEnd: '2026-01-14',
          hasContent: true,
          itemCount: 3,
          stepsTotal: 5,
          stepsDone: 2,
          progressRatio: 2 / 5,
          verified: true,
          hasUncertain: true,
          optional: false,
        },
        {
          id: 'u3',
          title: 'Unit 3',
          canDo: 'travel',
          status: 'planned',
          hasContent: false,
          itemCount: 30,
          stepsTotal: 0,
          stepsDone: 0,
          progressRatio: 0,
          verified: false,
          hasUncertain: false,
          optional: true,
        },
      ],
      view.units,
    )
  })

  it('counts an empty content object as content with zero items and steps', () => {
    const data = makeData({
      content: { units: { u1: { generatedBy: { tool: 'test', at: NOW.toISOString() } } } },
    })
    const input = makeInput()
    const row = buildHomeView(data, input).units.find((unit) => unit.id === 'u1')
    check(
      { data, input },
      {
        hasContent: true,
        itemCount: 0,
        stepsTotal: 0,
        stepsDone: 0,
        progressRatio: 0,
        verified: false,
        hasUncertain: false,
      },
      row && {
        hasContent: row.hasContent,
        itemCount: row.itemCount,
        stepsTotal: row.stepsTotal,
        stepsDone: row.stepsDone,
        progressRatio: row.progressRatio,
        verified: row.verified,
        hasUncertain: row.hasUncertain,
      },
    )
  })

  it.each([
    { mode: 'content first', expected: 'u1' },
    { mode: 'no content', expected: 'u2' },
    { mode: 'content done', expected: 'u2' },
    { mode: 'all done', expected: null },
  ])('selects the next unit: $mode', ({ mode, expected }) => {
    const data = makeData()
    if (mode === 'no content') data.content.units = {}
    data.plan.units.forEach((unit) => {
      if (mode === 'all done' || (mode === 'content done' && unit.id === 'u1')) {
        unit.status = 'done'
      }
    })
    const input = makeInput()
    check({ data, input }, expected, buildHomeView(data, input).nextUnitId)
  })

  it('reflects today, xp, due reviews at the exact time boundary, and daily counts', () => {
    const data = makeData()
    const input = makeInput({ dailyGoal: 12, reviewsDoneToday: 5 })
    const { today, xp, dueReviewCount, dailyGoal, reviewsDoneToday } = buildHomeView(data, input)
    check(
      { data, input },
      {
        today: TODAY,
        xp: 123,
        dueReviewCount: 2,
        dailyGoal: 12,
        reviewsDoneToday: 5,
      },
      { today, xp, dueReviewCount, dailyGoal, reviewsDoneToday },
    )
  })

  it.each([
    { lastStudyDate: TODAY, expected: 4 },
    { lastStudyDate: '2026-01-11', expected: 4 },
    { lastStudyDate: '2026-01-10', expected: 0 },
    { lastStudyDate: null, expected: 0 },
  ])('displays the effective streak for $lastStudyDate', ({ lastStudyDate, expected }) => {
    const data = makeData()
    data.progress.streak.lastStudyDate = lastStudyDate
    const input = makeInput()
    check({ data, input }, expected, buildHomeView(data, input).streakDays)
  })

  it('computes remaining items and study days starting tomorrow', () => {
    const data = makeData()
    const input = makeInput()
    check(
      { data, input },
      {
        status: 'onTrack',
        remainingNewItems: 51,
        remainingStudyDays: 7,
        dailyNew: 8,
        unrealistic: false,
      },
      buildHomeView(data, input).pace,
    )
  })

  it('uses the configured study week and includes the deadline', () => {
    const data = makeData()
    data.profile.goal.studyDaysPerWeek = 5
    const input = makeInput({ today: '2026-01-16' })
    const { remainingStudyDays, dailyNew, unrealistic } = buildHomeView(data, input).pace
    check(
      { data, input },
      {
        remainingStudyDays: 1,
        dailyNew: 19,
        unrealistic: true,
      },
      { remainingStudyDays, dailyNew, unrealistic },
    )
  })

  it.each([
    { introduced: 0, expected: 'behind' },
    { introduced: 33, expected: 'onTrack' },
    { introduced: 48, expected: 'ahead' },
  ])('evaluates pace with $introduced introduced items', ({ introduced, expected }) => {
    const data = makeData()
    data.profile.goal.dailyMinutes = 6
    let remaining = introduced
    data.plan.units.forEach((unit) => {
      unit.status = 'inProgress'
      const count = Math.min(remaining, unit.id === 'u1' ? 3 : unit.itemEstimate)
      remaining -= count
      data.progress.unitProgress[unit.id] = {
        introducedItemIds: Array.from({ length: count }, (_, index) => `${unit.id}-${index}`),
        completedStepIds: [],
        wrongItemIds: [],
        startedAt: unit.id === 'u3' ? '2026-01-01T23:00:00Z' : '2026-01-05T00:00:00Z',
      }
    })
    // 全53項目 × 12日 / 19日を丸めた計画累積は33。最も早い開始日は最後の単元にある。
    const input = makeInput()
    check({ data, input }, expected, buildHomeView(data, input).pace.status)
  })

  it('excludes done units from remaining items while including them in cumulative pace', () => {
    const data = makeData()
    data.profile.goal.dailyMinutes = 6
    data.plan.units.forEach((unit) => {
      if (unit.id !== 'u1') unit.status = 'done'
    })
    data.progress.unitProgress = {
      u1: { introducedItemIds: [], completedStepIds: [], wrongItemIds: [] },
      u2: {
        introducedItemIds: [],
        completedStepIds: [],
        wrongItemIds: [],
        startedAt: '2026-01-01T00:00:00Z',
      },
      u3: {
        introducedItemIds: Array.from({ length: 30 }, (_, index) => `u3-${index}`),
        completedStepIds: [],
        wrongItemIds: [],
      },
    }
    const input = makeInput()
    check(
      { data, input },
      {
        status: 'onTrack',
        remainingNewItems: 3,
        remainingStudyDays: 7,
        dailyNew: 3,
        unrealistic: false,
      },
      buildHomeView(data, input).pace,
    )
  })

  it('uses today as the start date when no unit has started', () => {
    const data = makeData({ progress: {} })
    data.profile.goal.dailyMinutes = 1
    const input = makeInput()
    // 開始日と今日を含めるので計画累積は round(53 / 8) = 7。日量3では遅れ判定。
    check({ data, input }, 'behind', buildHomeView(data, input).pace.status)
  })

  it('limits daily new items by time remaining after due reviews', () => {
    const data = makeData()
    data.profile.goal.dailyMinutes = 6
    const input = makeInput()
    // (6分 - 2件 × 0.5分) / 1.5分の切り捨てで3件。
    check({ data, input }, 3, buildHomeView(data, input).pace.dailyNew)
    data.progress.fsrs = {}
    check({ data, input }, 4, buildHomeView(data, input).pace.dailyNew)
  })

  it('marks a large remainder with a deadline tomorrow as unrealistic', () => {
    const data = makeData()
    data.profile.goal.deadline = '2026-01-13'
    const input = makeInput()
    const { remainingNewItems, remainingStudyDays, dailyNew, unrealistic } = buildHomeView(
      data,
      input,
    ).pace
    check(
      { data, input },
      {
        remainingNewItems: 51,
        remainingStudyDays: 1,
        dailyNew: 19,
        unrealistic: true,
      },
      { remainingNewItems, remainingStudyDays, dailyNew, unrealistic },
    )
  })

  it('caps planned cumulative at the total after the deadline', () => {
    const data = makeData({ progress: {} })
    data.profile.goal.dailyMinutes = 1
    data.progress.unitProgress.u1 = {
      startedAt: '2026-01-01T00:00:00Z',
      introducedItemIds: Array.from({ length: 53 }, (_, index) => `item-${index}`),
      completedStepIds: [],
      wrongItemIds: [],
    }
    const input = makeInput({ today: '2026-02-01' })
    check(
      { data, input },
      {
        status: 'onTrack',
        remainingNewItems: 50,
        remainingStudyDays: 0,
        dailyNew: 3,
        unrealistic: true,
      },
      buildHomeView(data, input).pace,
    )
  })

  it('handles an empty plan and zero study-day span', () => {
    const data = makeData({ plan: { units: [] }, progress: {} })
    data.profile.goal.studyDaysPerWeek = 5
    data.profile.goal.deadline = '2026-01-18'
    const input = makeInput({ today: '2026-01-18' })
    const { units, nextUnitId, dueReviewCount, pace } = buildHomeView(data, input)
    check(
      { data, input },
      {
        units: [],
        nextUnitId: null,
        dueReviewCount: 0,
        pace: {
          status: 'onTrack',
          remainingNewItems: 0,
          remainingStudyDays: 0,
          dailyNew: 0,
          unrealistic: false,
        },
      },
      { units, nextUnitId, dueReviewCount, pace },
    )
  })

  it.each([
    { lastBackupAt: null, expected: { daysSince: null, needsBackup: true } },
    { lastBackupAt: NOW.toISOString(), expected: { daysSince: 0, needsBackup: false } },
    { lastBackupAt: '2026-01-05T12:00:00Z', expected: { daysSince: 7, needsBackup: true } },
  ])('reports backup status for $lastBackupAt', ({ lastBackupAt, expected }) => {
    const data = makeData()
    const input = makeInput({ lastBackupAt })
    check({ data, input }, expected, buildHomeView(data, input).backup)
  })

  it('does not mutate saved data or input and returns repeatable results', () => {
    const data = makeData()
    const input = makeInput()
    const before = JSON.stringify({ data, input })
    deepFreeze(data)
    deepFreeze(input)
    const first = buildHomeView(data, input)
    const second = buildHomeView(data, input)
    check({ data, input }, before, JSON.stringify({ data, input }))
    check({ data, input }, first, second)
  })
})
