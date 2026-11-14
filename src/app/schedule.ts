// 単元への日程の割り当て(学習日だけを数えて順番に割り当てる)。仕様 6.4。
import { addDays, isStudyDay } from '../engine/pacing'

export interface ScheduleUnit {
  id: string
  status: 'planned' | 'ready' | 'inProgress' | 'done'
  itemCount: number // 単元の項目数(中身があればその数、無ければ itemEstimate)
  optional?: boolean
}

export interface ScheduledUnit {
  id: string
  plannedStart: string
  plannedEnd: string
}

// from 以降(from を含む)で、最初の学習日。7日以内に必ず見つかる。
export function nextStudyDay(fromIso: string, studyDaysPerWeek: number): string {
  let current = fromIso
  for (let i = 0; i < 7; i++) {
    if (isStudyDay(current, studyDaysPerWeek)) {
      return current
    }
    current = addDays(current, 1)
  }
  return current
}

// start(学習日)を 1 日目として、studyDays 日目の日付を返す。studyDays が 1 以下なら start を返す。
export function advanceStudyDays(
  startIso: string,
  studyDays: number,
  studyDaysPerWeek: number,
): string {
  if (studyDays <= 1) {
    return startIso
  }
  let current = startIso
  let count = 1
  while (count < studyDays) {
    current = nextStudyDay(addDays(current, 1), studyDaysPerWeek)
    count += 1
  }
  return current
}

// done を除いて入力の順に学習日を割り当てる。deadline を超えてもそのまま返す。
export function assignSchedule(
  units: ReadonlyArray<ScheduleUnit>,
  options: { today: string; deadline: string; studyDaysPerWeek: number; dailyNew: number },
): ScheduledUnit[] {
  const { today, studyDaysPerWeek, dailyNew } = options
  const result: ScheduledUnit[] = []
  let nextStart = nextStudyDay(today, studyDaysPerWeek)
  for (const unit of units) {
    if (unit.status === 'done') {
      continue
    }
    const requiredDays = Math.max(1, Math.ceil(unit.itemCount / Math.max(dailyNew, 1)))
    const plannedEnd = advanceStudyDays(nextStart, requiredDays, studyDaysPerWeek)
    result.push({ id: unit.id, plannedStart: nextStart, plannedEnd })
    nextStart = nextStudyDay(addDays(plannedEnd, 1), studyDaysPerWeek)
  }
  return result
}
