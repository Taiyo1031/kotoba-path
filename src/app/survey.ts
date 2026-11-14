import type { CefrLevel, Profile, StudyData } from '../schema'
import type { PromptProfile } from '../prompts/types'
import type { UiLanguage } from '../config/languages'
import { APP_CONFIG } from '../config/app'
import { getNativeLanguage, getTargetLanguage } from '../config/languages'
import { dayNumber } from '../engine/pacing'

export const PURPOSE_TAGS = ['travel', 'work', 'daily', 'localFriends', 'peers'] as const
export type PurposeTag = (typeof PURPOSE_TAGS)[number]

export const LEVEL_OPTIONS: ReadonlyArray<{
  cefr: CefrLevel
  labelKey: 'welcome.level.greeting' | 'welcome.level.travel' | 'welcome.level.daily'
}> = [
  { cefr: 'A1', labelKey: 'welcome.level.greeting' },
  { cefr: 'A2', labelKey: 'welcome.level.travel' },
  { cefr: 'B1', labelKey: 'welcome.level.daily' },
]

export const DAILY_MINUTES_OPTIONS: ReadonlyArray<number> = [10, 20, 30, 45, 60]

export interface SurveyAnswers {
  targetLanguage: string
  purposeTags: string[]
  purposeText: string
  deadline: string // YYYY-MM-DD
  targetLevel: CefrLevel
  dailyMinutes: number
}

export type SurveyField =
  'targetLanguage' | 'purposeTags' | 'deadline' | 'targetLevel' | 'dailyMinutes'

export interface SurveyValidation {
  ok: boolean
  errors: Partial<Record<SurveyField, string>>
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function parseDateParts(iso: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null
  }
  const [year = 0, month = 0, day = 0] = iso.split('-').map(Number)
  if (month < 1 || month > 12) {
    return null
  }
  const lastDay = daysInMonth(year, month)
  if (day < 1 || day > lastDay) {
    return null
  }
  return { year, month, day }
}

function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    return 0
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function validateSurvey(answers: SurveyAnswers, today: string): SurveyValidation {
  const errors: Partial<Record<SurveyField, string>> = {}

  if (!getTargetLanguage(answers.targetLanguage)) {
    errors.targetLanguage = '学習言語を選んでください'
  }

  const hasPurposeTags = answers.purposeTags.length > 0
  const hasPurposeText = answers.purposeText.trim().length > 0
  if (!hasPurposeTags && !hasPurposeText) {
    errors.purposeTags = '目的を教えてください'
  }

  const deadlineParts = parseDateParts(answers.deadline)
  if (!deadlineParts) {
    errors.deadline = '期限が不正です'
  } else {
    const todayDay = dayNumber(today)
    const deadlineDay = dayNumber(answers.deadline)
    if (deadlineDay <= todayDay) {
      errors.deadline = '期限は今日より後でください'
    }
  }

  if (!(CEFR_LEVELS as readonly string[]).includes(answers.targetLevel)) {
    errors.targetLevel = 'レベルが不正です'
  }

  const dailyMinutes = answers.dailyMinutes
  if (!Number.isInteger(dailyMinutes) || dailyMinutes < 1 || dailyMinutes > 600) {
    errors.dailyMinutes = '学習時間が不正です'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (seen.has(value)) {
      continue
    }
    seen.add(value)
    result.push(value)
  }
  return result
}

export function buildProfile(
  answers: SurveyAnswers,
  options: { uiLanguage: UiLanguage; nativeLanguage?: string; studyDaysPerWeek?: number },
): Profile {
  const profile = {
    uiLanguage: options.uiLanguage,
    targetLanguage: answers.targetLanguage,
    nativeLanguage: options.nativeLanguage ?? 'ja',
    goal: {
      purposeTags: dedupePreserveOrder(answers.purposeTags),
      purposeText: answers.purposeText.trim(),
      targetLevel: answers.targetLevel,
      deadline: answers.deadline,
      dailyMinutes: answers.dailyMinutes,
      studyDaysPerWeek: options.studyDaysPerWeek ?? 6,
    },
  }

  return profile as unknown as Profile
}

export function createInitialStudyData(profile: Profile, now: Date): StudyData {
  const data = {
    format: APP_CONFIG.dataFormat,
    version: APP_CONFIG.dataVersion,
    meta: {
      exportedAt: now.toISOString(),
      appVersion: APP_CONFIG.appVersion,
    },
    profile,
    plan: { units: [] },
    content: { units: {} },
    progress: {
      fsrs: {},
      unitProgress: {},
      xp: 0,
      streak: { days: 0, lastStudyDate: null },
      sessions: [],
    },
  }

  return data as unknown as StudyData
}

export function toPromptProfile(profile: Profile, uiLanguage: UiLanguage): PromptProfile {
  const p = profile as unknown as {
    targetLanguage?: string
    nativeLanguage?: string
    goal?: Record<string, unknown>
  }
  const goal = p.goal ?? {}

  const targetLanguage = String(p.targetLanguage ?? '')
  const nativeLanguage = String(p.nativeLanguage ?? '')

  const targetInfo = getTargetLanguage(targetLanguage)
  const nativeInfo = getNativeLanguage(nativeLanguage)

  return {
    targetLanguage,
    targetLanguageName: targetInfo?.names[uiLanguage] ?? targetLanguage,
    nativeLanguage,
    nativeLanguageName: nativeInfo?.names[uiLanguage] ?? nativeLanguage,
    purposeTags: Array.isArray(goal.purposeTags) ? (goal.purposeTags as string[]) : [],
    purposeText: String(goal.purposeText ?? ''),
    targetLevel: String(goal.targetLevel ?? ''),
    deadline: String(goal.deadline ?? ''),
    dailyMinutes: Number(goal.dailyMinutes ?? 0),
    studyDaysPerWeek: Number(goal.studyDaysPerWeek ?? 6),
  }
}

export function defaultDeadline(today: string, months = 4): string {
  const parts = parseDateParts(today)
  if (!parts) {
    return today
  }

  const totalMonths = parts.year * 12 + (parts.month - 1) + months
  const year = Math.floor(totalMonths / 12)
  const monthIndex = ((totalMonths % 12) + 12) % 12
  const month = monthIndex + 1
  const lastDay = daysInMonth(year, month)
  const day = Math.min(parts.day, lastDay)

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}
