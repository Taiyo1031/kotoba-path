import { describe, expect, it } from 'vitest'
import type { FsrsRecord } from '../schema'
import {
  MATURE_STABILITY_DAYS,
  isDue,
  newRecord,
  outcomeFor,
  reviewRecord,
  stabilityBand,
} from './fsrsWrapper'

const DAY = 86400000

function msg(input: unknown, expected: unknown, actual: unknown): string {
  return `入力: ${JSON.stringify(input)} / 期待値: ${String(expected)} / 実際: ${String(actual)}`
}

function expectEq(
  input: unknown,
  expected: unknown,
  actual: unknown,
  compare?: (a: unknown, e: unknown) => boolean,
): void {
  const ok = compare ? compare(actual, expected) : Object.is(actual, expected)
  if (!ok) throw new Error(msg(input, expected, actual))
}

function expectGte(input: unknown, min: number, actual: number): void {
  if (!(actual >= min)) throw new Error(msg(input, `>= ${min}`, actual))
}

describe('outcomeFor', () => {
  it.each([
    [{ correct: false, usedHint: false, slow: false }, 'again'],
    [{ correct: false, usedHint: true, slow: false }, 'again'],
    [{ correct: false, usedHint: true, slow: true, selfGrade: 'easy' }, 'again'],
    [{ correct: true, usedHint: false, slow: false }, 'good'],
    [{ correct: true, usedHint: true, slow: false }, 'hard'],
    [{ correct: true, usedHint: false, slow: true }, 'hard'],
    [{ correct: true, usedHint: true, slow: true }, 'hard'],
    [{ correct: true, usedHint: false, slow: false, selfGrade: 'easy' }, 'easy'],
    [{ correct: true, usedHint: true, slow: true, selfGrade: 'easy' }, 'easy'],
  ])('outcomeFor(%j) === %s', (input, expected) => {
    const actual = outcomeFor(input as never)
    expectEq(input, expected, actual)
  })
})

describe('newRecord', () => {
  it('state が 0、reps が 0、due が now の ISO 文字列', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const record = newRecord(now)
    expectEq({ now }, 0, record.state)
    expectEq({ now }, 0, record.reps)
    expectEq({ now }, now.toISOString(), record.due)
  })
})

describe('reviewRecord', () => {
  it('undefined + good で reps が 1、lastReview が now、due が now 以降', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const record = reviewRecord(undefined, 'good', now)
    expectEq({ outcome: 'good' }, 1, record.reps)
    expectEq({ outcome: 'good' }, now.toISOString(), record.lastReview)
    expectGte({ outcome: 'good' }, Date.parse(now.toISOString()), Date.parse(record.due))
  })

  it('同じ状態に対して due は again <= hard <= good <= easy', () => {
    const base = newRecord(new Date('2024-01-01T00:00:00.000Z'))
    const now = new Date('2024-06-01T00:00:00.000Z')
    const again = reviewRecord(base, 'again', now)
    const hard = reviewRecord(base, 'hard', now)
    const good = reviewRecord(base, 'good', now)
    const easy = reviewRecord(base, 'easy', now)
    expectGte({ base }, Date.parse(again.due), Date.parse(hard.due))
    expectGte({ base }, Date.parse(hard.due), Date.parse(good.due))
    expectGte({ base }, Date.parse(good.due), Date.parse(easy.due))
  })

  it('新規から連続 good で stability が増える', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const first = reviewRecord(undefined, 'good', now)
    const second = reviewRecord(first, 'good', new Date(now.getTime() + DAY))
    expectGte({ first }, first.stability, second.stability)
  })

  it('Review 状態に again を適用すると lapses が 1 増える', () => {
    let record: FsrsRecord | undefined
    const start = new Date('2024-01-01T00:00:00.000Z')
    for (let i = 0; i < 30 && !(record && record.state === 2); i += 1) {
      record = reviewRecord(record, 'good', new Date(start.getTime() + i * DAY))
    }
    expectEq({ start }, 2, record?.state)
    const before = record as FsrsRecord
    const after = reviewRecord(before, 'again', new Date(start.getTime() + 30 * DAY))
    expectEq({ before: before.lapses }, before.lapses + 1, after.lapses)
  })

  it('入力の record を変更しない (Object.freeze でも例外にならない)', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const frozen = Object.freeze(newRecord(now))
    const before = JSON.stringify(frozen)
    const result = reviewRecord(frozen, 'good', new Date(now.getTime() + DAY))
    expectEq({ frozen }, before, JSON.stringify(result === undefined ? undefined : frozen))
  })

  it('往復: 結果を再度渡しても例外が出ず learningSteps が保たれる', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const first = reviewRecord(undefined, 'good', now)
    const second = reviewRecord(first, 'again', new Date(now.getTime() + DAY))
    const actual = typeof second.learningSteps === 'number' && Number.isFinite(second.learningSteps)
    expect(actual, msg({ first: first.learningSteps }, true, actual)).toBe(true)
  })
})

describe('isDue', () => {
  it('undefined は false、due が now と同じ・過去は true、未来は false', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    expectEq({ record: undefined }, false, isDue(undefined, now))
    expectEq(
      { due: '2023-12-31T00:00:00.000Z' },
      true,
      isDue({ ...newRecord(now), due: '2023-12-31T00:00:00.000Z' } as FsrsRecord, now),
    )
    expectEq(
      { due: now.toISOString() },
      true,
      isDue({ ...newRecord(now), due: now.toISOString() } as FsrsRecord, now),
    )
    expectEq(
      { due: '2024-01-02T00:00:00.000Z' },
      false,
      isDue({ ...newRecord(now), due: '2024-01-02T00:00:00.000Z' } as FsrsRecord, now),
    )
  })
})

describe('stabilityBand', () => {
  it('undefined と reps 0 は new、stability 5 は learning、10 以上は mature', () => {
    expectEq({ record: undefined }, 'new', stabilityBand(undefined))
    const zero = newRecord(new Date('2024-01-01T00:00:00.000Z'))
    expectEq({ reps: 0, stability: zero.stability }, 'new', stabilityBand(zero))
    expectEq(
      { reps: 3, stability: 5 },
      'learning',
      stabilityBand({ ...zero, reps: 3, stability: 5 } as FsrsRecord),
    )
    expectEq(
      { reps: 3, stability: MATURE_STABILITY_DAYS },
      'mature',
      stabilityBand({ ...zero, reps: 3, stability: MATURE_STABILITY_DAYS } as FsrsRecord),
    )
    expectEq(
      { reps: 3, stability: 15 },
      'mature',
      stabilityBand({ ...zero, reps: 3, stability: 15 } as FsrsRecord),
    )
  })
})
