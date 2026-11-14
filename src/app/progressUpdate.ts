import { APP_CONFIG } from '../config/app'
import { updateStreak, xpForStepComplete, xpForUnitComplete } from '../engine/game'
import type { Step } from '../engine/types'
import { capSessions } from '../io/fullImport'
import type { FsrsRecord, Progress, UnitProgress } from '../schema'

export interface LessonResult {
  unitId: string
  step: Step
  kind: 'lesson' | 'review'
  fsrs: Record<string, FsrsRecord>
  xp: number
  answered: number
  correct: number
  wrongItemIds: string[]
  seed: number
  startedAt: string
  endedAt: string
  stepCompleted: boolean
  unitCompleted: boolean
}

export interface ApplyOptions {
  today: string
  dailyGoal: number
  reviewsDoneToday: number
  sessionsMax?: number
}

function uniqueAppend(existing: ReadonlyArray<string>, additions: ReadonlyArray<string>): string[] {
  const next = [...existing]
  for (const id of additions) {
    if (!next.includes(id)) {
      next.push(id)
    }
  }
  return next
}

function emptyUnitProgress(): UnitProgress {
  return {
    introducedItemIds: [],
    completedStepIds: [],
    wrongItemIds: [],
  }
}

export function applyLessonResult(
  progress: Progress,
  result: LessonResult,
  options: ApplyOptions,
): Progress {
  const stepBonus = result.stepCompleted ? xpForStepComplete() : 0
  const unitBonus = result.unitCompleted ? xpForUnitComplete() : 0
  const xpGained = result.xp + stepBonus + unitBonus

  let unitProgress = progress.unitProgress
  if (result.kind === 'lesson') {
    const existing = progress.unitProgress[result.unitId]
    const next: UnitProgress = existing
      ? {
          introducedItemIds: [...existing.introducedItemIds],
          completedStepIds: [...existing.completedStepIds],
          wrongItemIds: [...existing.wrongItemIds],
        }
      : emptyUnitProgress()

    if (result.step.kind === 'intro') {
      next.introducedItemIds = uniqueAppend(next.introducedItemIds, result.step.wordIds)
    }

    if (result.stepCompleted) {
      next.completedStepIds = uniqueAppend(next.completedStepIds, [result.step.id])
    }

    next.wrongItemIds = uniqueAppend(next.wrongItemIds, result.wrongItemIds)

    if (existing && existing.startedAt !== undefined) {
      next.startedAt = existing.startedAt
    } else {
      next.startedAt = result.startedAt
    }

    if (result.unitCompleted) {
      next.completedAt = result.endedAt
    } else if (existing && existing.completedAt !== undefined) {
      next.completedAt = existing.completedAt
    }

    unitProgress = {
      ...progress.unitProgress,
      [result.unitId]: next,
    }
  }

  const streak = updateStreak(progress.streak, {
    today: options.today,
    stepCompleted: result.stepCompleted,
    reviewsDone: options.reviewsDoneToday + (result.kind === 'review' ? result.answered : 0),
    dailyGoal: options.dailyGoal,
  })

  const sessionId = `${result.startedAt}|${result.step.id}`
  let sessions = progress.sessions
  if (!progress.sessions.some((session) => session.id === sessionId)) {
    sessions = [
      ...progress.sessions,
      {
        id: sessionId,
        kind: result.kind,
        unitId: result.unitId,
        stepId: result.step.id,
        seed: result.seed,
        startedAt: result.startedAt,
        endedAt: result.endedAt,
        answered: result.answered,
        correct: result.correct,
        xpGained,
      },
    ]
  }

  return {
    fsrs: { ...progress.fsrs, ...result.fsrs },
    unitProgress,
    xp: progress.xp + xpGained,
    streak,
    sessions: capSessions(sessions, options.sessionsMax ?? APP_CONFIG.sessionsMax),
  }
}

export function isUnitComplete(
  stepIds: ReadonlyArray<string>,
  completedStepIds: ReadonlyArray<string>,
): boolean {
  return stepIds.length > 0 && stepIds.every((id) => completedStepIds.includes(id))
}
