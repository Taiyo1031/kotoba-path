import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../config/game'
import {
  effectiveStreakDays,
  qualifiesForStreak,
  updateStreak,
  xpForCorrect,
  xpForStepComplete,
  xpForUnitComplete,
} from './game'
import type { DayActivity } from './game'

// 失敗メッセージに「入力・期待値・実際」を出す。
function msg(input: unknown, expected: unknown, actual: unknown): string {
  return `入力: ${JSON.stringify(input)} / 期待値: ${JSON.stringify(expected)} / 実際: ${JSON.stringify(actual)}`
}

// テスト用の DayActivity を作る(既定は 2026-12-01・目標20)。
function activity(overrides: Partial<DayActivity> = {}): DayActivity {
  return {
    today: '2026-12-01',
    stepCompleted: false,
    reviewsDone: 0,
    dailyGoal: 20,
    ...overrides,
  }
}

describe('XP', () => {
  it('xpForCorrect は GAME_CONFIG.xp.correct を返す', () => {
    const actual = xpForCorrect()
    expect(actual, msg(null, GAME_CONFIG.xp.correct, actual)).toBe(GAME_CONFIG.xp.correct)
  })

  it('xpForStepComplete は GAME_CONFIG.xp.stepComplete を返す', () => {
    const actual = xpForStepComplete()
    expect(actual, msg(null, GAME_CONFIG.xp.stepComplete, actual)).toBe(GAME_CONFIG.xp.stepComplete)
  })

  it('xpForUnitComplete は GAME_CONFIG.xp.unitComplete を返す', () => {
    const actual = xpForUnitComplete()
    expect(actual, msg(null, GAME_CONFIG.xp.unitComplete, actual)).toBe(GAME_CONFIG.xp.unitComplete)
  })
})

describe('qualifiesForStreak', () => {
  it('ステップ完了だけで true', () => {
    const input = activity({ stepCompleted: true, reviewsDone: 0, dailyGoal: 20 })
    const actual = qualifiesForStreak(input)
    expect(actual, msg(input, true, actual)).toBe(true)
  })

  it('復習が目標ちょうどで true', () => {
    const input = activity({ stepCompleted: false, reviewsDone: 20, dailyGoal: 20 })
    const actual = qualifiesForStreak(input)
    expect(actual, msg(input, true, actual)).toBe(true)
  })

  it('復習が目標未満で false', () => {
    const input = activity({ stepCompleted: false, reviewsDone: 19, dailyGoal: 20 })
    const actual = qualifiesForStreak(input)
    expect(actual, msg(input, false, actual)).toBe(false)
  })

  it('目標 0 で復習 0・ステップなしは false', () => {
    const input = activity({ stepCompleted: false, reviewsDone: 0, dailyGoal: 0 })
    const actual = qualifiesForStreak(input)
    expect(actual, msg(input, false, actual)).toBe(false)
  })
})

describe('updateStreak', () => {
  it('初回(lastStudyDate が null)で days 1', () => {
    const streak = { days: 0, lastStudyDate: null }
    const input = activity({ today: '2026-12-01', stepCompleted: true })
    const expected = { days: 1, lastStudyDate: '2026-12-01' }
    const actual = updateStreak(streak, input)
    expect(actual, msg({ streak, input }, expected, actual)).toEqual(expected)
  })

  it('前日からの継続で +1', () => {
    const streak = { days: 5, lastStudyDate: '2026-11-30' }
    const input = activity({ today: '2026-12-01', stepCompleted: true })
    const expected = { days: 6, lastStudyDate: '2026-12-01' }
    const actual = updateStreak(streak, input)
    expect(actual, msg({ streak, input }, expected, actual)).toEqual(expected)
  })

  it('同じ日の2回目は変わらない', () => {
    const streak = { days: 5, lastStudyDate: '2026-12-01' }
    const input = activity({ today: '2026-12-01', stepCompleted: true })
    const actual = updateStreak(streak, input)
    expect(actual, msg({ streak, input }, streak, actual)).toEqual(streak)
  })

  it('2日以上空くと 1 に戻る', () => {
    const streak = { days: 5, lastStudyDate: '2026-11-28' }
    const input = activity({ today: '2026-12-01', stepCompleted: true })
    const expected = { days: 1, lastStudyDate: '2026-12-01' }
    const actual = updateStreak(streak, input)
    expect(actual, msg({ streak, input }, expected, actual)).toEqual(expected)
  })

  it('条件を満たさない日は変わらない', () => {
    const streak = { days: 5, lastStudyDate: '2026-11-30' }
    const input = activity({
      today: '2026-12-01',
      stepCompleted: false,
      reviewsDone: 5,
      dailyGoal: 20,
    })
    const actual = updateStreak(streak, input)
    expect(actual, msg({ streak, input }, streak, actual)).toEqual(streak)
  })

  it('月跨ぎ(2026-12-01 の前日は 2026-11-30)', () => {
    const streak = { days: 5, lastStudyDate: '2026-11-30' }
    const input = activity({ today: '2026-12-01', stepCompleted: true })
    const expected = { days: 6, lastStudyDate: '2026-12-01' }
    const actual = updateStreak(streak, input)
    expect(actual, msg({ streak, input }, expected, actual)).toEqual(expected)
  })

  it('入力が変更されない', () => {
    const streak = { days: 5, lastStudyDate: '2026-11-30' }
    const before = JSON.parse(JSON.stringify(streak)) as typeof streak
    const input = activity({ today: '2026-12-01', stepCompleted: true })
    updateStreak(streak, input)
    expect(streak, msg(before, before, streak)).toEqual(before)
  })
})

describe('effectiveStreakDays', () => {
  it('null で 0', () => {
    const streak = { days: 5, lastStudyDate: null }
    const today = '2026-12-01'
    const actual = effectiveStreakDays(streak, today)
    expect(actual, msg({ streak, today }, 0, actual)).toBe(0)
  })

  it('今日で days', () => {
    const streak = { days: 7, lastStudyDate: '2026-12-01' }
    const today = '2026-12-01'
    const actual = effectiveStreakDays(streak, today)
    expect(actual, msg({ streak, today }, 7, actual)).toBe(7)
  })

  it('前日で days', () => {
    const streak = { days: 7, lastStudyDate: '2026-11-30' }
    const today = '2026-12-01'
    const actual = effectiveStreakDays(streak, today)
    expect(actual, msg({ streak, today }, 7, actual)).toBe(7)
  })

  it('2日前で 0', () => {
    const streak = { days: 7, lastStudyDate: '2026-11-29' }
    const today = '2026-12-01'
    const actual = effectiveStreakDays(streak, today)
    expect(actual, msg({ streak, today }, 0, actual)).toBe(0)
  })
})
