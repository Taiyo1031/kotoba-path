// 日程計算の基礎(学習日数・残りの新出数・1日の新出数)。仕様 6.4。
// 日付は YYYY-MM-DD を UTC の日付として扱う(Date.UTC を使い、タイムゾーンの影響を受けない)。

const MS_PER_DAY = 86400000

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

// 日付文字列を (年, 月, 日) に分解する。欠けた部分は 0 として扱う。
function parseParts(iso: string): { year: number; month: number; day: number } {
  const [year = 0, month = 0, day = 0] = iso.split('-').map(Number)
  return { year, month, day }
}

// 日番号(エポックからの日数)を YYYY-MM-DD に戻す。
function dayNumberToIso(dayNumber: number): string {
  const date = new Date(dayNumber * MS_PER_DAY)
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`
}

// Date.UTC(年, 月-1, 日) / 86400000(整数)
export function dayNumber(iso: string): number {
  const { year, month, day } = parseParts(iso)
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY)
}

// 'YYYY-MM-DD' を返す(月跨ぎ・うるう年に対応)
export function addDays(iso: string, days: number): string {
  return dayNumberToIso(dayNumber(iso) + days)
}

// 月曜=0, 火=1, … 日曜=6
export function weekdayIndex(iso: string): number {
  const { year, month, day } = parseParts(iso)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return (jsDay + 6) % 7
}

// weekdayIndex(iso) < studyDaysPerWeek。(週の前から数える)
export function isStudyDay(iso: string, studyDaysPerWeek: number): boolean {
  return weekdayIndex(iso) < studyDaysPerWeek
}

// from と to の両方を含む範囲で学習日の数。from が to より後なら 0。
export function countStudyDays(fromIso: string, toIso: string, studyDaysPerWeek: number): number {
  const from = dayNumber(fromIso)
  const to = dayNumber(toIso)
  if (from > to) {
    return 0
  }
  let count = 0
  for (let d = from; d <= to; d++) {
    if (isStudyDay(dayNumberToIso(d), studyDaysPerWeek)) {
      count += 1
    }
  }
  return count
}

export const PACING_DEFAULTS = {
  minDailyNew: 3,
  newMinutesPerItem: 1.5,
  reviewMinutesPerItem: 0.5,
} as const

export interface UnitCountInfo {
  id: string
  status: 'planned' | 'ready' | 'inProgress' | 'done'
  itemEstimate: number
  contentItemCount?: number // 中身があるときの項目数(単語+フレーズ)
  introducedCount?: number // 導入済みの項目数
}

// 単元ごとの合計。done は 0。inProgress は差分(マイナスにならない)。planned/ready は項目数。
export function remainingNewItems(units: ReadonlyArray<UnitCountInfo>): number {
  let sum = 0
  for (const unit of units) {
    if (unit.status === 'done') {
      continue
    }
    const itemCount = unit.contentItemCount ?? unit.itemEstimate
    if (unit.status === 'inProgress') {
      const introduced = unit.introducedCount ?? 0
      sum += Math.max(0, itemCount - introduced)
    } else {
      sum += itemCount
    }
  }
  return sum
}

export interface DailyNewInput {
  remainingNewItems: number
  remainingStudyDays: number
  dailyMinutes: number
  dueReviewCount: number
  minDailyNew?: number // 既定 PACING_DEFAULTS.minDailyNew
  newMinutesPerItem?: number // 既定 PACING_DEFAULTS.newMinutesPerItem
  reviewMinutesPerItem?: number // 既定 PACING_DEFAULTS.reviewMinutesPerItem
}

export interface DailyNewResult {
  needed: number
  cap: number
  dailyNew: number
}

// 下限と上限の間に収める。
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function computeDailyNew(input: DailyNewInput): DailyNewResult {
  const minDailyNew = input.minDailyNew ?? PACING_DEFAULTS.minDailyNew
  const newMinutesPerItem = input.newMinutesPerItem ?? PACING_DEFAULTS.newMinutesPerItem
  const reviewMinutesPerItem = input.reviewMinutesPerItem ?? PACING_DEFAULTS.reviewMinutesPerItem

  const needed =
    input.remainingStudyDays > 0
      ? Math.ceil(input.remainingNewItems / input.remainingStudyDays)
      : input.remainingNewItems

  const cap = Math.max(
    minDailyNew,
    Math.floor(
      (input.dailyMinutes - input.dueReviewCount * reviewMinutesPerItem) / newMinutesPerItem,
    ),
  )

  const dailyNew = input.remainingNewItems <= 0 ? 0 : clamp(needed, minDailyNew, cap)

  return { needed, cap, dailyNew }
}
