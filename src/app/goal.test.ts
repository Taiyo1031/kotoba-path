import { describe, expect, it } from 'vitest'
import {
  RELATIVE_MONTH_OPTIONS,
  checkDeadline,
  daysLeft,
  deadlineFromMonths,
  monthsLeft,
  nextDay,
} from './goal'

function expectEqual(actual: unknown, expected: unknown, input: unknown): void {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  expect(
    actual,
    `入力: ${JSON.stringify(input)}\n期待値: ${expectedText}\n実際: ${actualText}`,
  ).toEqual(expected)
}

describe('deadlineFromMonths', () => {
  it('3 ヶ月後の日付を返す', () => {
    const input = { today: '2026-11-15', months: 3 }
    expectEqual(deadlineFromMonths(input.today, input.months), '2027-02-15', input)
  })

  it('月末は丸める', () => {
    const input = { today: '2026-11-30', months: 3 }
    expectEqual(deadlineFromMonths(input.today, input.months), '2027-02-28', input)
  })

  it('31 日から 2 月へは月末に丸める', () => {
    const input = { today: '2026-01-31', months: 1 }
    expectEqual(deadlineFromMonths(input.today, input.months), '2026-02-28', input)
  })
})

describe('daysLeft', () => {
  it('期限までの残り日数を返す', () => {
    const input = { today: '2026-11-15', deadline: '2026-11-20' }
    expectEqual(daysLeft(input.today, input.deadline), 5, input)
  })

  it('同じ日は 0 を返す', () => {
    const input = { today: '2026-11-15', deadline: '2026-11-15' }
    expectEqual(daysLeft(input.today, input.deadline), 0, input)
  })

  it('過去は負を返す', () => {
    const input = { today: '2026-11-15', deadline: '2026-11-10' }
    expectEqual(daysLeft(input.today, input.deadline), -5, input)
  })
})

describe('monthsLeft', () => {
  it('92 日は 3 ヶ月を返す', () => {
    const input = { today: '2026-11-15', deadline: '2027-02-15' }
    expectEqual(monthsLeft(input.today, input.deadline), 3, input)
  })

  it('過去の期限は 0 を返す', () => {
    const input = { today: '2026-11-15', deadline: '2026-11-10' }
    expectEqual(monthsLeft(input.today, input.deadline), 0, input)
  })

  it('5 日は 0 ヶ月を返す', () => {
    const input = { today: '2026-11-15', deadline: '2026-11-20' }
    expectEqual(monthsLeft(input.today, input.deadline), 0, input)
  })
})

describe('checkDeadline', () => {
  it('今日より後の実在する日付は ok を返す', () => {
    const input = { deadline: '2027-01-01', today: '2026-11-15' }
    expectEqual(checkDeadline(input.deadline, input.today), 'ok', input)
  })

  it('今日と同じ日は notFuture を返す', () => {
    const input = { deadline: '2026-11-15', today: '2026-11-15' }
    expectEqual(checkDeadline(input.deadline, input.today), 'notFuture', input)
  })

  it('昨日は notFuture を返す', () => {
    const input = { deadline: '2026-11-14', today: '2026-11-15' }
    expectEqual(checkDeadline(input.deadline, input.today), 'notFuture', input)
  })

  it('実在しない日付は invalid を返す', () => {
    const input = { deadline: '2026-02-30', today: '2026-11-15' }
    expectEqual(checkDeadline(input.deadline, input.today), 'invalid', input)
  })

  it('形式不正な文字列は invalid を返す', () => {
    const input = { deadline: 'abc', today: '2026-11-15' }
    expectEqual(checkDeadline(input.deadline, input.today), 'invalid', input)
  })

  it('空文字列は invalid を返す', () => {
    const input = { deadline: '', today: '2026-11-15' }
    expectEqual(checkDeadline(input.deadline, input.today), 'invalid', input)
  })

  it('月が 13 は invalid を返す', () => {
    const input = { deadline: '2026-13-01', today: '2026-11-15' }
    expectEqual(checkDeadline(input.deadline, input.today), 'invalid', input)
  })
})

describe('nextDay', () => {
  it('月末の翌日を返す', () => {
    const input = '2026-11-30'
    expectEqual(nextDay(input), '2026-12-01', input)
  })

  it('年末の翌日を返す', () => {
    const input = '2026-12-31'
    expectEqual(nextDay(input), '2027-01-01', input)
  })
})

describe('RELATIVE_MONTH_OPTIONS', () => {
  it('仕様通りの選択肢である', () => {
    expectEqual(RELATIVE_MONTH_OPTIONS, [1, 2, 3, 4, 6, 9, 12], '-')
  })
})
