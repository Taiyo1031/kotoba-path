import { describe, it, expect } from 'vitest'
import { nextStudyDay, advanceStudyDays, assignSchedule } from './schedule'
import type { ScheduleUnit } from './schedule'

// 2026-11-16 は月曜日(週6日なら日曜が休み、週5日なら土日が休み)。
describe('nextStudyDay', () => {
  it('学習日ならその日を返す', () => {
    const input = { fromIso: '2026-11-16', studyDaysPerWeek: 5 }
    const expected = '2026-11-16'
    const actual = nextStudyDay(input.fromIso, input.studyDaysPerWeek)
    expect(actual, `入力: ${JSON.stringify(input)} 期待: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('日曜(週6日)なら翌月曜を返す', () => {
    const input = { fromIso: '2026-11-22', studyDaysPerWeek: 6 }
    const expected = '2026-11-23'
    const actual = nextStudyDay(input.fromIso, input.studyDaysPerWeek)
    expect(actual, `入力: ${JSON.stringify(input)} 期待: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('土曜(週5日)なら翌月曜を返す', () => {
    const input = { fromIso: '2026-11-21', studyDaysPerWeek: 5 }
    const expected = '2026-11-23'
    const actual = nextStudyDay(input.fromIso, input.studyDaysPerWeek)
    expect(actual, `入力: ${JSON.stringify(input)} 期待: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })
})

describe('advanceStudyDays', () => {
  it('1 日目はその日', () => {
    const input = { startIso: '2026-11-16', studyDays: 1, studyDaysPerWeek: 6 }
    const expected = '2026-11-16'
    const actual = advanceStudyDays(input.startIso, input.studyDays, input.studyDaysPerWeek)
    expect(actual, `入力: ${JSON.stringify(input)} 期待: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('週6日で月曜から 6 日目は土曜', () => {
    const input = { startIso: '2026-11-16', studyDays: 6, studyDaysPerWeek: 6 }
    const expected = '2026-11-21'
    const actual = advanceStudyDays(input.startIso, input.studyDays, input.studyDaysPerWeek)
    expect(actual, `入力: ${JSON.stringify(input)} 期待: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('週6日で月曜から 7 日目は翌月曜(日曜を飛ばす)', () => {
    const input = { startIso: '2026-11-16', studyDays: 7, studyDaysPerWeek: 6 }
    const expected = '2026-11-23'
    const actual = advanceStudyDays(input.startIso, input.studyDays, input.studyDaysPerWeek)
    expect(actual, `入力: ${JSON.stringify(input)} 期待: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('0 は start を返す', () => {
    const input = { startIso: '2026-11-16', studyDays: 0, studyDaysPerWeek: 6 }
    const expected = '2026-11-16'
    const actual = advanceStudyDays(input.startIso, input.studyDays, input.studyDaysPerWeek)
    expect(actual, `入力: ${JSON.stringify(input)} 期待: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('負は start を返す', () => {
    const input = { startIso: '2026-11-16', studyDays: -3, studyDaysPerWeek: 6 }
    const expected = '2026-11-16'
    const actual = advanceStudyDays(input.startIso, input.studyDays, input.studyDaysPerWeek)
    expect(actual, `入力: ${JSON.stringify(input)} 期待: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })
})

describe('assignSchedule', () => {
  it('単元が 1 つ(項目 20・dailyNew 10 → 2 日)', () => {
    const units: ScheduleUnit[] = [{ id: 'u1', status: 'planned', itemCount: 20 }]
    const options = {
      today: '2026-11-16',
      deadline: '2026-12-31',
      studyDaysPerWeek: 6,
      dailyNew: 10,
    }
    const input = { units, options }
    const expected = [{ id: 'u1', plannedStart: '2026-11-16', plannedEnd: '2026-11-17' }]
    const actual = assignSchedule(units, options)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('複数の単元が連続して並ぶ(前の終了日の次の学習日から始まる)', () => {
    const units: ScheduleUnit[] = [
      { id: 'u1', status: 'planned', itemCount: 20 },
      { id: 'u2', status: 'ready', itemCount: 10 },
    ]
    const options = {
      today: '2026-11-16',
      deadline: '2026-12-31',
      studyDaysPerWeek: 6,
      dailyNew: 10,
    }
    const input = { units, options }
    const expected = [
      { id: 'u1', plannedStart: '2026-11-16', plannedEnd: '2026-11-17' },
      { id: 'u2', plannedStart: '2026-11-18', plannedEnd: '2026-11-18' },
    ]
    const actual = assignSchedule(units, options)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('done が除かれる', () => {
    const units: ScheduleUnit[] = [
      { id: 'u1', status: 'done', itemCount: 20 },
      { id: 'u2', status: 'planned', itemCount: 10 },
    ]
    const options = {
      today: '2026-11-16',
      deadline: '2026-12-31',
      studyDaysPerWeek: 6,
      dailyNew: 10,
    }
    const input = { units, options }
    const expected = [{ id: 'u2', plannedStart: '2026-11-16', plannedEnd: '2026-11-16' }]
    const actual = assignSchedule(units, options)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('dailyNew が 0 でも例外にならず 1 として扱う', () => {
    const units: ScheduleUnit[] = [{ id: 'u1', status: 'planned', itemCount: 2 }]
    const options = {
      today: '2026-11-16',
      deadline: '2026-12-31',
      studyDaysPerWeek: 6,
      dailyNew: 0,
    }
    const input = { units, options }
    const expected = [{ id: 'u1', plannedStart: '2026-11-16', plannedEnd: '2026-11-17' }]
    const actual = assignSchedule(units, options)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('today が休みの日(日曜)のとき開始が翌学習日', () => {
    const units: ScheduleUnit[] = [{ id: 'u1', status: 'planned', itemCount: 10 }]
    const options = {
      today: '2026-11-22',
      deadline: '2026-12-31',
      studyDaysPerWeek: 6,
      dailyNew: 10,
    }
    const input = { units, options }
    const expected = [{ id: 'u1', plannedStart: '2026-11-23', plannedEnd: '2026-11-23' }]
    const actual = assignSchedule(units, options)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('deadline を超える日付がそのまま返る', () => {
    const units: ScheduleUnit[] = [{ id: 'u1', status: 'planned', itemCount: 30 }]
    const options = {
      today: '2026-11-16',
      deadline: '2026-11-17',
      studyDaysPerWeek: 6,
      dailyNew: 10,
    }
    const input = { units, options }
    const expected = [{ id: 'u1', plannedStart: '2026-11-16', plannedEnd: '2026-11-18' }]
    const actual = assignSchedule(units, options)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('入力が変更されない', () => {
    const units: ScheduleUnit[] = [
      { id: 'u1', status: 'planned', itemCount: 20 },
      { id: 'u2', status: 'done', itemCount: 10 },
    ]
    const options = {
      today: '2026-11-16',
      deadline: '2026-12-31',
      studyDaysPerWeek: 6,
      dailyNew: 10,
    }
    const input = { units, options }
    const before = JSON.stringify({ units, options })
    assignSchedule(units, options)
    const after = JSON.stringify({ units, options })
    expect(after, `入力: ${JSON.stringify(input)} 期待: ${before} 実際: ${after}`).toBe(before)
  })
})
