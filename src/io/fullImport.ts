import { APP_CONFIG } from '../config/app'
import type { AppStore } from '../db'
import {
  StudyDataSchema,
  zodIssuesToValidationIssues,
  validateStudyDataReferences,
} from '../schema'
import type { StudyData } from '../schema'
import { MigrationError, migrateStudyData } from './migrate'

export interface FullImportIssue {
  path: string
  message: string
  severity: 'error' | 'warning'
}
export type FullImportResult =
  | { ok: true; data: StudyData; warnings: FullImportIssue[] }
  | { ok: false; errors: FullImportIssue[] }

export function parseFullImport(text: string): FullImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    return {
      ok: false,
      errors: [{ path: '$', message: 'JSONを解析できません', severity: 'error' }],
    }
  }
  try {
    raw = migrateStudyData(raw)
  } catch (error) {
    if (!(error instanceof MigrationError)) throw error
    return { ok: false, errors: [{ path: '$.version', message: error.message, severity: 'error' }] }
  }
  const result = StudyDataSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      errors: zodIssuesToValidationIssues(result.error).map((issue) => ({
        ...issue,
        severity: 'error',
      })),
    }
  }
  const issues = validateStudyDataReferences(result.data)
  if (issues.length) {
    return { ok: false, errors: issues.map((issue) => ({ ...issue, severity: 'error' })) }
  }
  const warnings: FullImportIssue[] =
    result.data.progress.sessions.length > APP_CONFIG.sessionsMax
      ? [
          {
            path: 'progress.sessions',
            message: '取り込み時に古い学習履歴を畳みます',
            severity: 'warning',
          },
        ]
      : []
  return { ok: true, data: result.data, warnings }
}

export function capSessions<T extends { startedAt: string }>(
  sessions: ReadonlyArray<T>,
  max: number,
): T[] {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
  return max <= 0 ? [] : sorted.slice(-max)
}

function selectDate(a: string | undefined, b: string | undefined, newest: boolean) {
  if (a === undefined) return b
  if (b === undefined) return a
  return Date.parse(a) >= Date.parse(b) === newest ? a : b
}

export function mergeStudyData(current: StudyData, incoming: StudyData): StudyData {
  const units = new Map(current.plan.units.map((unit) => [unit.id, { ...unit }]))
  for (const unit of incoming.plan.units) {
    const previous = units.get(unit.id)
    const next = { ...unit }
    if (previous && (previous.status === 'inProgress' || previous.status === 'done')) {
      next.status = previous.status
      delete next.plannedStart
      delete next.plannedEnd
      if (previous.plannedStart !== undefined) next.plannedStart = previous.plannedStart
      if (previous.plannedEnd !== undefined) next.plannedEnd = previous.plannedEnd
    }
    units.set(unit.id, next)
  }
  const fsrs = { ...current.progress.fsrs }
  for (const [id, next] of Object.entries(incoming.progress.fsrs)) {
    const previous = fsrs[id]
    if (
      !previous ||
      (previous.lastReview && next.lastReview
        ? Date.parse(next.lastReview) > Date.parse(previous.lastReview)
        : next.reps > previous.reps)
    )
      fsrs[id] = next
  }
  const unitProgress = { ...current.progress.unitProgress }
  for (const [id, next] of Object.entries(incoming.progress.unitProgress)) {
    const previous = unitProgress[id]
    if (!previous) {
      unitProgress[id] = next
      continue
    }
    const merged = { ...previous }
    for (const key of ['completedStepIds', 'introducedItemIds', 'wrongItemIds'] as const) {
      merged[key] = [...new Set([...previous[key], ...next[key]])]
    }
    const startedAt = selectDate(previous.startedAt, next.startedAt, false)
    const completedAt = selectDate(previous.completedAt, next.completedAt, true)
    if (startedAt !== undefined) merged.startedAt = startedAt
    if (completedAt !== undefined) merged.completedAt = completedAt
    unitProgress[id] = merged
  }
  const a = current.progress.streak
  const b = incoming.progress.streak
  const streak =
    (b.lastStudyDate ?? '') > (a.lastStudyDate ?? '') ||
    (b.lastStudyDate === a.lastStudyDate && b.days > a.days)
      ? b
      : a
  const sessions = new Map(current.progress.sessions.map((session) => [session.id, session]))
  for (const session of incoming.progress.sessions) sessions.set(session.id, session)
  return {
    format: APP_CONFIG.dataFormat,
    version: APP_CONFIG.dataVersion,
    meta: incoming.meta,
    profile: current.profile,
    plan: { units: [...units.values()] },
    content: { units: { ...current.content.units, ...incoming.content.units } },
    progress: {
      fsrs,
      unitProgress,
      xp: Math.max(current.progress.xp, incoming.progress.xp),
      streak,
      sessions: capSessions([...sessions.values()], APP_CONFIG.sessionsMax),
    },
  }
}

export async function applyFullImport(
  store: AppStore,
  data: StudyData,
  mode: 'replace' | 'merge',
): Promise<StudyData> {
  const current = mode === 'merge' ? await store.loadStudyData() : null
  const saved = current
    ? mergeStudyData(current, data)
    : {
        ...data,
        progress: {
          ...data.progress,
          sessions: capSessions(data.progress.sessions, APP_CONFIG.sessionsMax),
        },
      }
  await store.saveStudyData(saved)
  return saved
}
