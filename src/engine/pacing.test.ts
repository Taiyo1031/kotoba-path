import { describe, expect, it } from 'vitest'
import {
  PACING_DEFAULTS,
  addDays,
  computeDailyNew,
  countStudyDays,
  dayNumber,
  isStudyDay,
  remainingNewItems,
  weekdayIndex,
  type UnitCountInfo,
} from './pacing'

describe('dayNumber', () => {
  it('エポック(1970-01-01)は 0', () => {
    const input = '1970-01-01'
    expect(dayNumber(input), `入力: ${input}`).toBe(0)
  })

  it('エポックの 1 日後は 1', () => {
    const input = '1970-01-02'
    expect(dayNumber(input), `入力: ${input}`).toBe(1)
  })
})

describe('addDays', () => {
  it('通常(同日数)', () => {
    const input = { iso: '2026-01-31', days: 1 }
    expect(addDays(input.iso, input.days), `入力: ${JSON.stringify(input)}`).toBe('2026-02-01')
  })

  it('月跨ぎ(2026-01-31 + 1 = 2026-02-01)', () => {
    const input = { iso: '2026-01-31', days: 1 }
    expect(addDays(input.iso, input.days), `入力: ${JSON.stringify(input)}`).toBe('2026-02-01')
  })

  it('うるう年(2028-02-28 + 1 = 2028-02-29)', () => {
    const input = { iso: '2028-02-28', days: 1 }
    expect(addDays(input.iso, input.days), `入力: ${JSON.stringify(input)}`).toBe('2028-02-29')
  })

  it('マイナス(2026-03-01 - 1 = 2026-02-28)', () => {
    const input = { iso: '2026-03-01', days: -1 }
    expect(addDays(input.iso, input.days), `入力: ${JSON.stringify(input)}`).toBe('2026-02-28')
  })
})

describe('weekdayIndex', () => {
  it('2026-11-16(月曜)が 0', () => {
    const input = '2026-11-16'
    expect(weekdayIndex(input), `入力: ${input}`).toBe(0)
  })

  it('2026-11-22(日曜)が 6', () => {
    const input = '2026-11-22'
    expect(weekdayIndex(input), `入力: ${input}`).toBe(6)
  })
})

describe('isStudyDay', () => {
  it('週6日で日曜(2026-11-22)が false', () => {
    const input = { iso: '2026-11-22', studyDaysPerWeek: 6 }
    expect(isStudyDay(input.iso, input.studyDaysPerWeek), `入力: ${JSON.stringify(input)}`).toBe(
      false,
    )
  })

  it('週6日で月曜(2026-11-16)が true', () => {
    const input = { iso: '2026-11-16', studyDaysPerWeek: 6 }
    expect(isStudyDay(input.iso, input.studyDaysPerWeek), `入力: ${JSON.stringify(input)}`).toBe(
      true,
    )
  })

  it('週5日で土曜(2026-11-21)が false', () => {
    const input = { iso: '2026-11-21', studyDaysPerWeek: 5 }
    expect(isStudyDay(input.iso, input.studyDaysPerWeek), `入力: ${JSON.stringify(input)}`).toBe(
      false,
    )
  })

  it('週7日はすべて true(土曜・日曜)', () => {
    const sat = { iso: '2026-11-21', studyDaysPerWeek: 7 }
    const sun = { iso: '2026-11-22', studyDaysPerWeek: 7 }
    expect(isStudyDay(sat.iso, sat.studyDaysPerWeek), `入力: ${JSON.stringify(sat)}`).toBe(true)
    expect(isStudyDay(sun.iso, sun.studyDaysPerWeek), `入力: ${JSON.stringify(sun)}`).toBe(true)
  })
})

describe('countStudyDays', () => {
  it('2026-11-16 から 2026-11-22(月〜日)を週6日で 6', () => {
    const input = { fromIso: '2026-11-16', toIso: '2026-11-22', studyDaysPerWeek: 6 }
    expect(
      countStudyDays(input.fromIso, input.toIso, input.studyDaysPerWeek),
      `入力: ${JSON.stringify(input)}`,
    ).toBe(6)
  })

  it('2026-11-16 から 2026-11-22(月〜日)を週7日で 7', () => {
    const input = { fromIso: '2026-11-16', toIso: '2026-11-22', studyDaysPerWeek: 7 }
    expect(
      countStudyDays(input.fromIso, input.toIso, input.studyDaysPerWeek),
      `入力: ${JSON.stringify(input)}`,
    ).toBe(7)
  })

  it('2026-11-16 から 2026-11-22(月〜日)を週5日で 5', () => {
    const input = { fromIso: '2026-11-16', toIso: '2026-11-22', studyDaysPerWeek: 5 }
    expect(
      countStudyDays(input.fromIso, input.toIso, input.studyDaysPerWeek),
      `入力: ${JSON.stringify(input)}`,
    ).toBe(5)
  })

  it('1日だけの範囲(週6日で月曜)が 1', () => {
    const input = { fromIso: '2026-11-16', toIso: '2026-11-16', studyDaysPerWeek: 6 }
    expect(
      countStudyDays(input.fromIso, input.toIso, input.studyDaysPerWeek),
      `入力: ${JSON.stringify(input)}`,
    ).toBe(1)
  })

  it('from > to で 0', () => {
    const input = { fromIso: '2026-11-22', toIso: '2026-11-16', studyDaysPerWeek: 6 }
    expect(
      countStudyDays(input.fromIso, input.toIso, input.studyDaysPerWeek),
      `入力: ${JSON.stringify(input)}`,
    ).toBe(0)
  })

  it('2週間(2026-11-16〜2026-11-29)を週6日で 12', () => {
    const input = { fromIso: '2026-11-16', toIso: '2026-11-29', studyDaysPerWeek: 6 }
    expect(
      countStudyDays(input.fromIso, input.toIso, input.studyDaysPerWeek),
      `入力: ${JSON.stringify(input)}`,
    ).toBe(12)
  })
})

describe('remainingNewItems', () => {
  it('planned は itemEstimate', () => {
    const units: UnitCountInfo[] = [{ id: 'u1', status: 'planned', itemEstimate: 10 }]
    expect(remainingNewItems(units), `入力: ${JSON.stringify(units)}`).toBe(10)
  })

  it('ready で contentItemCount があればそれ', () => {
    const units: UnitCountInfo[] = [
      { id: 'u1', status: 'ready', itemEstimate: 10, contentItemCount: 8 },
    ]
    expect(remainingNewItems(units), `入力: ${JSON.stringify(units)}`).toBe(8)
  })

  it('inProgress は差分(マイナスにならない)', () => {
    const units: UnitCountInfo[] = [
      { id: 'u1', status: 'inProgress', itemEstimate: 10, introducedCount: 4 },
    ]
    expect(remainingNewItems(units), `入力: ${JSON.stringify(units)}`).toBe(6)
  })

  it('inProgress で導入済みが多いと 0(マイナスにならない)', () => {
    const units: UnitCountInfo[] = [
      { id: 'u1', status: 'inProgress', itemEstimate: 10, introducedCount: 12 },
    ]
    expect(remainingNewItems(units), `入力: ${JSON.stringify(units)}`).toBe(0)
  })

  it('done は 0', () => {
    const units: UnitCountInfo[] = [
      { id: 'u1', status: 'done', itemEstimate: 10, contentItemCount: 8 },
    ]
    expect(remainingNewItems(units), `入力: ${JSON.stringify(units)}`).toBe(0)
  })

  it('複数単元の合計', () => {
    const units: UnitCountInfo[] = [
      { id: 'u1', status: 'planned', itemEstimate: 10 },
      { id: 'u2', status: 'ready', itemEstimate: 10, contentItemCount: 8 },
      { id: 'u3', status: 'inProgress', itemEstimate: 10, introducedCount: 4 },
      { id: 'u4', status: 'done', itemEstimate: 10 },
    ]
    expect(remainingNewItems(units), `入力: ${JSON.stringify(units)}`).toBe(24)
  })
})

describe('computeDailyNew', () => {
  it('needed が cap 内ならそのまま(残り 60 項目・学習日 20 日 → needed 3)', () => {
    const input = {
      remainingNewItems: 60,
      remainingStudyDays: 20,
      dailyMinutes: 60,
      dueReviewCount: 0,
    }
    const expected = { needed: 3, cap: 40, dailyNew: 3 }
    expect(computeDailyNew(input), `入力: ${JSON.stringify(input)}`).toEqual(expected)
  })

  it('needed が小さすぎるとき下限 3', () => {
    const input = {
      remainingNewItems: 10,
      remainingStudyDays: 20,
      dailyMinutes: 60,
      dueReviewCount: 0,
    }
    const expected = { needed: 1, cap: 40, dailyNew: 3 }
    expect(computeDailyNew(input), `入力: ${JSON.stringify(input)}`).toEqual(expected)
  })

  it('needed が大きすぎるとき cap(dailyMinutes 20、dueReviewCount 10 → cap 10)', () => {
    const input = {
      remainingNewItems: 100,
      remainingStudyDays: 5,
      dailyMinutes: 20,
      dueReviewCount: 10,
    }
    const expected = { needed: 20, cap: 10, dailyNew: 10 }
    expect(computeDailyNew(input), `入力: ${JSON.stringify(input)}`).toEqual(expected)
  })

  it('学習日が 0 のとき needed = 残り項目数', () => {
    const input = {
      remainingNewItems: 50,
      remainingStudyDays: 0,
      dailyMinutes: 60,
      dueReviewCount: 0,
    }
    const expected = { needed: 50, cap: 40, dailyNew: 40 }
    expect(computeDailyNew(input), `入力: ${JSON.stringify(input)}`).toEqual(expected)
  })

  it('残りが 0 なら dailyNew 0', () => {
    const input = {
      remainingNewItems: 0,
      remainingStudyDays: 20,
      dailyMinutes: 60,
      dueReviewCount: 0,
    }
    const expected = { needed: 0, cap: 40, dailyNew: 0 }
    expect(computeDailyNew(input), `入力: ${JSON.stringify(input)}`).toEqual(expected)
  })

  it('cap の下限が minDailyNew(余裕が少なくても 3)', () => {
    const input = {
      remainingNewItems: 100,
      remainingStudyDays: 5,
      dailyMinutes: 5,
      dueReviewCount: 0,
    }
    const expected = { needed: 20, cap: 3, dailyNew: 3 }
    expect(computeDailyNew(input), `入力: ${JSON.stringify(input)}`).toEqual(expected)
  })

  it('既定値を使う(minDailyNew 3・newMinutesPerItem 1.5・reviewMinutesPerItem 0.5)', () => {
    const input = {
      remainingNewItems: 60,
      remainingStudyDays: 20,
      dailyMinutes: 20,
      dueReviewCount: 10,
    }
    const expected = { needed: 3, cap: 10, dailyNew: 3 }
    expect(computeDailyNew(input), `入力: ${JSON.stringify(input)}`).toEqual(expected)
    expect(PACING_DEFAULTS, '既定値').toEqual({
      minDailyNew: 3,
      newMinutesPerItem: 1.5,
      reviewMinutesPerItem: 0.5,
    })
  })
})
