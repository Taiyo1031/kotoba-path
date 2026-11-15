import type { StudyData } from '../schema'

export type PromptAction =
  | { kind: 'skeleton' }
  | { kind: 'unit'; unitId: string; title: string; prepared: number; total: number }
  | { kind: 'done'; prepared: number; total: number }

export function nextPromptAction(data: StudyData | null): PromptAction {
  if (data === null) return { kind: 'skeleton' }

  const units = data.plan.units
  if (units.length === 0) return { kind: 'skeleton' }

  const total = units.length
  const prepared = units.reduce(
    (count, unit) => count + (data.content.units[unit.id] !== undefined ? 1 : 0),
    0,
  )

  const firstMissing = units.find((unit) => data.content.units[unit.id] === undefined)
  if (firstMissing === undefined) return { kind: 'done', prepared, total }

  return { kind: 'unit', unitId: firstMissing.id, title: firstMissing.title, prepared, total }
}
