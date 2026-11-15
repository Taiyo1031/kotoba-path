// 進み具合の判定と、遅れたときの3案(期限延長・任意単元削減・1日の量増加)。仕様 6.4。
// 日付は YYYY-MM-DD を UTC の日付として扱う(pacing.ts と同じ)。

import { addDays, countStudyDays, PACING_DEFAULTS } from './pacing'

export type PaceStatus = 'onTrack' | 'behind' | 'ahead'

export interface PaceInput {
  plannedCumulative: number
  actualCumulative: number
  plannedDailyNew: number
  thresholdRatio?: number
  thresholdDays?: number
}

export interface PaceResult {
  status: PaceStatus
  diffItems: number
  diffDays: number
  ratio: number
}

const DEFAULT_THRESHOLD_RATIO = 0.1
const DEFAULT_THRESHOLD_DAYS = 2
const MAX_EXTRA_DAYS = 3650

export function evaluatePace(input: PaceInput): PaceResult {
  const thresholdRatio = input.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO
  const thresholdDays = input.thresholdDays ?? DEFAULT_THRESHOLD_DAYS

  const diffItems = input.actualCumulative - input.plannedCumulative
  const diffDays = input.plannedDailyNew > 0 ? diffItems / input.plannedDailyNew : 0
  const ratio = Math.abs(diffItems) / Math.max(input.plannedCumulative, 1)

  let status: PaceStatus
  if (ratio <= thresholdRatio || Math.abs(diffDays) <= thresholdDays) {
    status = 'onTrack'
  } else if (diffItems < 0) {
    status = 'behind'
  } else {
    status = 'ahead'
  }

  return { status, diffItems, diffDays, ratio }
}

export interface OptionalUnitInfo {
  id: string
  itemCount: number
}

export interface BehindInput {
  today: string
  deadline: string
  studyDaysPerWeek: number
  remainingNewItems: number
  plannedDailyNew: number
  dailyMinutes: number
  dueReviewCount: number
  optionalUnits: ReadonlyArray<OptionalUnitInfo>
  newMinutesPerItem?: number
  reviewMinutesPerItem?: number
}

export interface BehindOptions {
  extendDeadline: { newDeadline: string; extraDays: number }
  dropOptional: { unitIds: string[]; itemsSaved: number; sufficient: boolean }
  raiseDaily: { requiredDailyNew: number; requiredDailyMinutes: number }
}

// itemCount の大きい順、同じなら id の昇順。
function sortOptional(units: ReadonlyArray<OptionalUnitInfo>): OptionalUnitInfo[] {
  return [...units].sort((a, b) => {
    if (a.itemCount !== b.itemCount) {
      return b.itemCount - a.itemCount
    }
    if (a.id < b.id) {
      return -1
    }
    if (a.id > b.id) {
      return 1
    }
    return 0
  })
}

export function computeBehindOptions(input: BehindInput): BehindOptions {
  const newMinutesPerItem = input.newMinutesPerItem ?? PACING_DEFAULTS.newMinutesPerItem
  const reviewMinutesPerItem = input.reviewMinutesPerItem ?? PACING_DEFAULTS.reviewMinutesPerItem

  // 今日は含めない
  const remainingStudyDays = countStudyDays(
    addDays(input.today, 1),
    input.deadline,
    input.studyDaysPerWeek,
  )

  // 期限を延ばす: 条件を満たす最小の extraDays を探す(最大 3650 日)
  const perDay = input.plannedDailyNew > 0 ? input.plannedDailyNew : PACING_DEFAULTS.minDailyNew
  let extraDays = MAX_EXTRA_DAYS
  for (let d = 0; d <= MAX_EXTRA_DAYS; d += 1) {
    const days = countStudyDays(
      addDays(input.today, 1),
      addDays(input.deadline, d),
      input.studyDaysPerWeek,
    )
    if (days * perDay >= input.remainingNewItems) {
      extraDays = d
      break
    }
  }
  const newDeadline = addDays(input.deadline, extraDays)

  // 任意単元を減らす
  const capacity = remainingStudyDays * input.plannedDailyNew
  const excess = input.remainingNewItems - capacity
  let dropOptional: BehindOptions['dropOptional']
  if (excess <= 0) {
    dropOptional = { unitIds: [], itemsSaved: 0, sufficient: true }
  } else {
    const unitIds: string[] = []
    let itemsSaved = 0
    for (const unit of sortOptional(input.optionalUnits)) {
      unitIds.push(unit.id)
      itemsSaved += unit.itemCount
      if (itemsSaved >= excess) {
        break
      }
    }
    dropOptional = { unitIds, itemsSaved, sufficient: itemsSaved >= excess }
  }

  // 1日の量を増やす
  const requiredDailyNew =
    remainingStudyDays > 0
      ? Math.ceil(input.remainingNewItems / remainingStudyDays)
      : input.remainingNewItems
  const requiredDailyMinutes = Math.ceil(
    requiredDailyNew * newMinutesPerItem + input.dueReviewCount * reviewMinutesPerItem,
  )

  return {
    extendDeadline: { newDeadline, extraDays },
    dropOptional,
    raiseDaily: { requiredDailyNew, requiredDailyMinutes },
  }
}

export function isUnrealisticDeadline(
  remainingNewItems: number,
  remainingStudyDays: number,
  maxDailyNew = 30,
): boolean {
  if (remainingNewItems <= 0) {
    return false
  }
  if (remainingStudyDays <= 0) {
    return true
  }
  return Math.ceil(remainingNewItems / remainingStudyDays) > maxDailyNew
}
