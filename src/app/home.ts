import type { StudyData } from '../schema'
import type { PaceStatus } from '../engine/pacingStatus'
import type { BackupStatus } from '../io/backup'
import { buildSteps } from '../engine/steps'
import { addDays, computeDailyNew, countStudyDays, remainingNewItems } from '../engine/pacing'
import type { UnitCountInfo } from '../engine/pacing'
import { evaluatePace, isUnrealisticDeadline } from '../engine/pacingStatus'
import { isDue } from '../engine/fsrsWrapper'
import { effectiveStreakDays } from '../engine/game'
import { getBackupStatus } from '../io/backup'

export interface HomeUnitRow {
  id: string
  title: string
  canDo: string
  status: 'planned' | 'ready' | 'inProgress' | 'done'
  plannedStart?: string
  plannedEnd?: string
  hasContent: boolean
  itemCount: number
  stepsTotal: number
  stepsDone: number
  progressRatio: number
  verified: boolean
  hasUncertain: boolean
  optional: boolean
}

export interface HomeView {
  today: string
  units: HomeUnitRow[]
  nextUnitId: string | null
  streakDays: number
  xp: number
  dueReviewCount: number
  dailyGoal: number
  reviewsDoneToday: number
  pace: {
    status: PaceStatus
    remainingNewItems: number
    remainingStudyDays: number
    dailyNew: number
    unrealistic: boolean
  }
  backup: BackupStatus
}

export function buildHomeView(
  data: StudyData,
  input: {
    today: string
    now: Date
    dailyGoal: number
    reviewsDoneToday: number
    lastBackupAt: string | null
  },
): HomeView {
  const { today, now, dailyGoal, reviewsDoneToday, lastBackupAt } = input

  const units = data.plan.units
  const contentUnits = data.content.units
  const { unitProgress, fsrs, streak, xp } = data.progress
  const { deadline, studyDaysPerWeek, dailyMinutes } = data.profile.goal

  const rows: HomeUnitRow[] = units.map((unit) => {
    const unitContent = contentUnits[unit.id]
    const progressEntry = unitProgress[unit.id]
    const hasContent = unitContent !== undefined

    const itemCount = hasContent
      ? unitContent.words.length + unitContent.phrases.length
      : unit.itemEstimate

    const steps = hasContent ? buildSteps(unit.id, unitContent) : []
    const stepsTotal = steps.length
    const completedStepIds = new Set(progressEntry?.completedStepIds ?? [])
    const stepsDone = steps.filter((step) => completedStepIds.has(step.id)).length
    const progressRatio = stepsTotal === 0 ? 0 : stepsDone / stepsTotal

    const row: HomeUnitRow = {
      id: unit.id,
      title: unit.title,
      canDo: unit.canDo,
      status: unit.status,
      hasContent,
      itemCount,
      stepsTotal,
      stepsDone,
      progressRatio,
      verified: unitContent?.verified ?? false,
      hasUncertain: unitContent?.words.some((word) => word.uncertain) ?? false,
      optional: unit.optional,
    }

    if (unit.plannedStart !== undefined) {
      row.plannedStart = unit.plannedStart
    }
    if (unit.plannedEnd !== undefined) {
      row.plannedEnd = unit.plannedEnd
    }

    return row
  })

  const incomplete = rows.filter((row) => row.status !== 'done')
  const nextUnitId = incomplete.find((row) => row.hasContent)?.id ?? incomplete[0]?.id ?? null

  const dueReviewCount = Object.values(fsrs).filter((record) => isDue(record, now)).length

  const countInfos: UnitCountInfo[] = units.map((unit) => {
    const content = contentUnits[unit.id]
    return {
      id: unit.id,
      status: unit.status,
      itemEstimate: unit.itemEstimate,
      ...(content === undefined
        ? {}
        : { contentItemCount: content.words.length + content.phrases.length }),
      introducedCount: unitProgress[unit.id]?.introducedItemIds.length ?? 0,
    }
  })

  const paceRemainingNewItems = remainingNewItems(countInfos)
  const remainingStudyDays = countStudyDays(addDays(today, 1), deadline, studyDaysPerWeek)
  const dailyNew = computeDailyNew({
    remainingNewItems: paceRemainingNewItems,
    remainingStudyDays,
    dailyMinutes,
    dueReviewCount,
  }).dailyNew

  const total = rows.reduce((sum, row) => sum + row.itemCount, 0)
  const actualCumulative = units.reduce(
    (sum, unit) => sum + (unitProgress[unit.id]?.introducedItemIds.length ?? 0),
    0,
  )

  const startedDates = Object.values(unitProgress).flatMap((progress) =>
    progress.startedAt === undefined ? [] : [progress.startedAt.slice(0, 10)],
  )
  const startDate = startedDates.reduce(
    (earliest, date) => (date < earliest ? date : earliest),
    startedDates[0] ?? today,
  )
  const elapsed = countStudyDays(startDate, today, studyDaysPerWeek)
  const span = countStudyDays(startDate, deadline, studyDaysPerWeek)
  const plannedCumulative =
    total === 0 ? 0 : Math.round((total * Math.min(elapsed, span)) / Math.max(span, 1))

  const paceStatus = evaluatePace({
    plannedCumulative,
    actualCumulative,
    plannedDailyNew: dailyNew,
  }).status

  return {
    today,
    units: rows,
    nextUnitId,
    streakDays: effectiveStreakDays(streak, today),
    xp,
    dueReviewCount,
    dailyGoal,
    reviewsDoneToday,
    pace: {
      status: paceStatus,
      remainingNewItems: paceRemainingNewItems,
      remainingStudyDays,
      dailyNew,
      unrealistic: isUnrealisticDeadline(paceRemainingNewItems, remainingStudyDays),
    },
    backup: getBackupStatus(lastBackupAt, now),
  }
}
