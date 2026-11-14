function utcDate(value: string): number {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function countStudyDays(today: string, deadline: string, studyDaysPerWeek: number): number {
  const days = (utcDate(deadline) - utcDate(today)) / 86_400_000
  return Math.max(0, Math.floor((days * studyDaysPerWeek) / 7))
}

export function estimateUnitCount(opts: {
  today: string
  deadline: string
  studyDaysPerWeek: number
  itemsPerUnit?: number
  newItemsPerDay?: number
}): number {
  const days = countStudyDays(opts.today, opts.deadline, opts.studyDaysPerWeek)
  const count = Math.ceil((days * (opts.newItemsPerDay ?? 10)) / (opts.itemsPerUnit ?? 20))
  return Math.min(80, Math.max(3, count))
}
