import { describe, it, expect } from 'vitest'
import { evaluatePace, computeBehindOptions, isUnrealisticDeadline } from './pacingStatus'
import type { PaceInput, BehindInput, OptionalUnitInfo } from './pacingStatus'

// 失敗メッセージに「入力・期待値・実際の値」を出す
function inputMsg(input: unknown): string {
  return `入力: ${JSON.stringify(input)}`
}

describe('evaluatePace', () => {
  it('順調(±10%以内)', () => {
    const input: PaceInput = { plannedCumulative: 100, actualCumulative: 105, plannedDailyNew: 10 }
    const result = evaluatePace(input)
    expect(result.status, inputMsg(input)).toBe('onTrack')
    expect(result.diffItems, inputMsg(input)).toBe(5)
    expect(result.diffDays, inputMsg(input)).toBe(0.5)
    expect(result.ratio, inputMsg(input)).toBeCloseTo(0.05)
  })

  it('順調(比率は超えるが ±2日以内)', () => {
    const input: PaceInput = { plannedCumulative: 100, actualCumulative: 115, plannedDailyNew: 10 }
    const result = evaluatePace(input)
    expect(result.status, inputMsg(input)).toBe('onTrack')
    expect(result.diffItems, inputMsg(input)).toBe(15)
    expect(result.diffDays, inputMsg(input)).toBe(1.5)
    expect(result.ratio, inputMsg(input)).toBeCloseTo(0.15)
  })

  it('遅れ', () => {
    const input: PaceInput = { plannedCumulative: 100, actualCumulative: 70, plannedDailyNew: 10 }
    const result = evaluatePace(input)
    expect(result.status, inputMsg(input)).toBe('behind')
    expect(result.diffItems, inputMsg(input)).toBe(-30)
    expect(result.diffDays, inputMsg(input)).toBe(-3)
    expect(result.ratio, inputMsg(input)).toBeCloseTo(0.3)
  })

  it('前倒し', () => {
    const input: PaceInput = { plannedCumulative: 100, actualCumulative: 140, plannedDailyNew: 10 }
    const result = evaluatePace(input)
    expect(result.status, inputMsg(input)).toBe('ahead')
    expect(result.diffItems, inputMsg(input)).toBe(40)
    expect(result.diffDays, inputMsg(input)).toBe(4)
    expect(result.ratio, inputMsg(input)).toBeCloseTo(0.4)
  })

  it('境界(ちょうど 10%)', () => {
    const input: PaceInput = { plannedCumulative: 100, actualCumulative: 110, plannedDailyNew: 10 }
    const result = evaluatePace(input)
    expect(result.status, inputMsg(input)).toBe('onTrack')
    expect(result.ratio, inputMsg(input)).toBeCloseTo(0.1)
  })

  it('境界(ちょうど 2日)', () => {
    const input: PaceInput = { plannedCumulative: 100, actualCumulative: 120, plannedDailyNew: 10 }
    const result = evaluatePace(input)
    expect(result.status, inputMsg(input)).toBe('onTrack')
    expect(result.diffDays, inputMsg(input)).toBe(2)
    expect(result.ratio, inputMsg(input)).toBeCloseTo(0.2)
  })

  it('plannedDailyNew が 0', () => {
    const input: PaceInput = { plannedCumulative: 100, actualCumulative: 200, plannedDailyNew: 0 }
    const result = evaluatePace(input)
    expect(result.status, inputMsg(input)).toBe('onTrack')
    expect(result.diffItems, inputMsg(input)).toBe(100)
    expect(result.diffDays, inputMsg(input)).toBe(0)
    expect(result.ratio, inputMsg(input)).toBeCloseTo(1)
  })

  it('planned が 0', () => {
    const input: PaceInput = { plannedCumulative: 0, actualCumulative: 20, plannedDailyNew: 5 }
    const result = evaluatePace(input)
    expect(result.status, inputMsg(input)).toBe('ahead')
    expect(result.diffItems, inputMsg(input)).toBe(20)
    expect(result.diffDays, inputMsg(input)).toBe(4)
    expect(result.ratio, inputMsg(input)).toBe(20)
  })
})

describe('computeBehindOptions', () => {
  it('期限延長の日付と日数(例)', () => {
    const input: BehindInput = {
      today: '2026-11-16',
      deadline: '2026-11-22',
      studyDaysPerWeek: 6,
      remainingNewItems: 30,
      plannedDailyNew: 3,
      dailyMinutes: 60,
      dueReviewCount: 10,
      optionalUnits: [],
    }
    const result = computeBehindOptions(input)
    // 学習日 5 日(11/17〜11/21)で 15 項目分。10 学習日必要 → 11/27 まで
    expect(result.extendDeadline, inputMsg(input)).toEqual({
      newDeadline: '2026-11-27',
      extraDays: 5,
    })
    expect(result.raiseDaily, inputMsg(input)).toEqual({
      requiredDailyNew: 6,
      requiredDailyMinutes: 14,
    })
  })

  it('任意単元の削減(足りる場合)', () => {
    const input: BehindInput = {
      today: '2026-11-16',
      deadline: '2026-11-22',
      studyDaysPerWeek: 6,
      remainingNewItems: 30,
      plannedDailyNew: 3,
      dailyMinutes: 60,
      dueReviewCount: 0,
      optionalUnits: [
        { id: 'a', itemCount: 10 },
        { id: 'b', itemCount: 10 },
      ],
    }
    const result = computeBehindOptions(input)
    // excess = 30 - 15 = 15。a(10) + b(10) = 20 >= 15
    expect(result.dropOptional, inputMsg(input)).toEqual({
      unitIds: ['a', 'b'],
      itemsSaved: 20,
      sufficient: true,
    })
  })

  it('任意単元の削減(足りない場合)', () => {
    const input: BehindInput = {
      today: '2026-11-16',
      deadline: '2026-11-22',
      studyDaysPerWeek: 6,
      remainingNewItems: 30,
      plannedDailyNew: 3,
      dailyMinutes: 60,
      dueReviewCount: 0,
      optionalUnits: [
        { id: 'a', itemCount: 5 },
        { id: 'b', itemCount: 5 },
      ],
    }
    const result = computeBehindOptions(input)
    // excess = 15。a(5) + b(5) = 10 < 15 → 全部足しても足りない
    expect(result.dropOptional, inputMsg(input)).toEqual({
      unitIds: ['a', 'b'],
      itemsSaved: 10,
      sufficient: false,
    })
  })

  it('任意単元の削減(excess 0 の場合)', () => {
    const input: BehindInput = {
      today: '2026-11-16',
      deadline: '2026-11-22',
      studyDaysPerWeek: 6,
      remainingNewItems: 10,
      plannedDailyNew: 3,
      dailyMinutes: 60,
      dueReviewCount: 0,
      optionalUnits: [
        { id: 'a', itemCount: 10 },
        { id: 'b', itemCount: 10 },
      ],
    }
    const result = computeBehindOptions(input)
    // capacity = 15 >= 10 → excess = -5 <= 0
    expect(result.dropOptional, inputMsg(input)).toEqual({
      unitIds: [],
      itemsSaved: 0,
      sufficient: true,
    })
  })

  it('任意単元の削減(順序が大きい順)', () => {
    const input: BehindInput = {
      today: '2026-11-16',
      deadline: '2026-11-22',
      studyDaysPerWeek: 6,
      remainingNewItems: 30,
      plannedDailyNew: 3,
      dailyMinutes: 60,
      dueReviewCount: 0,
      optionalUnits: [
        { id: 'small', itemCount: 5 },
        { id: 'large', itemCount: 20 },
        { id: 'mid', itemCount: 10 },
      ],
    }
    const result = computeBehindOptions(input)
    // excess = 15。大きい順: large(20) >= 15 → 止まる
    expect(result.dropOptional, inputMsg(input)).toEqual({
      unitIds: ['large'],
      itemsSaved: 20,
      sufficient: true,
    })
  })

  it('1日の量(requiredDailyNew, requiredDailyMinutes)', () => {
    const input: BehindInput = {
      today: '2026-11-16',
      deadline: '2026-11-22',
      studyDaysPerWeek: 6,
      remainingNewItems: 30,
      plannedDailyNew: 3,
      dailyMinutes: 60,
      dueReviewCount: 10,
      optionalUnits: [],
      newMinutesPerItem: 2,
      reviewMinutesPerItem: 1,
    }
    const result = computeBehindOptions(input)
    // requiredDailyNew = ceil(30/5) = 6。requiredDailyMinutes = ceil(6*2 + 10*1) = 22
    expect(result.raiseDaily, inputMsg(input)).toEqual({
      requiredDailyNew: 6,
      requiredDailyMinutes: 22,
    })
  })

  it('学習日が 0 のとき', () => {
    const input: BehindInput = {
      today: '2026-11-22',
      deadline: '2026-11-22',
      studyDaysPerWeek: 6,
      remainingNewItems: 30,
      plannedDailyNew: 3,
      dailyMinutes: 60,
      dueReviewCount: 5,
      optionalUnits: [],
    }
    const result = computeBehindOptions(input)
    // 学習日 0。requiredDailyNew = 30。requiredDailyMinutes = ceil(30*1.5 + 5*0.5) = 48
    expect(result.raiseDaily, inputMsg(input)).toEqual({
      requiredDailyNew: 30,
      requiredDailyMinutes: 48,
    })
    // excess = 30 - 0 = 30。optionalUnits が空 → 全部足しても足りない
    expect(result.dropOptional, inputMsg(input)).toEqual({
      unitIds: [],
      itemsSaved: 0,
      sufficient: false,
    })
  })

  it('入力(optionalUnits など)を変更しない', () => {
    const optionalUnits: OptionalUnitInfo[] = [
      { id: 'b', itemCount: 5 },
      { id: 'a', itemCount: 20 },
    ]
    const input: BehindInput = {
      today: '2026-11-16',
      deadline: '2026-11-22',
      studyDaysPerWeek: 6,
      remainingNewItems: 30,
      plannedDailyNew: 3,
      dailyMinutes: 60,
      dueReviewCount: 0,
      optionalUnits,
    }
    const before = JSON.stringify(input)
    computeBehindOptions(input)
    expect(JSON.stringify(input), inputMsg(input)).toBe(before)
  })
})

describe('isUnrealisticDeadline', () => {
  it('学習日 0 で残りあり', () => {
    expect(isUnrealisticDeadline(10, 0), '入力: [10, 0]').toBe(true)
  })

  it('30 を超える', () => {
    expect(isUnrealisticDeadline(61, 2), '入力: [61, 2]').toBe(true)
  })

  it('ちょうど 30', () => {
    expect(isUnrealisticDeadline(60, 2), '入力: [60, 2]').toBe(false)
  })

  it('残り 0', () => {
    expect(isUnrealisticDeadline(0, 2), '入力: [0, 2]').toBe(false)
  })

  it('maxDailyNew の指定', () => {
    expect(isUnrealisticDeadline(61, 2, 30), '入力: [61, 2, 30]').toBe(true)
    expect(isUnrealisticDeadline(61, 2, 40), '入力: [61, 2, 40]').toBe(false)
  })
})
