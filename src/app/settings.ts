import { GAME_CONFIG } from '../config/game'

export const SETTINGS_KEY = 'kp.settings'

export interface AppSettings {
  dailyGoal: number
  ttsEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  dailyGoal: GAME_CONFIG.dailyGoalDefault,
  ttsEnabled: true,
}

// dailyGoal は 1 以上 200 以下の整数のみ採用
function isDailyGoal(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 200
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(SETTINGS_KEY)
  } catch {
    return null
  }
}

export function getSettings(): AppSettings {
  const raw = readRaw()
  if (raw === null) {
    return DEFAULT_SETTINGS
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_SETTINGS
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_SETTINGS
  }
  const record = parsed as Record<string, unknown>
  const settings: AppSettings = { ...DEFAULT_SETTINGS }
  if (isDailyGoal(record.dailyGoal)) {
    settings.dailyGoal = record.dailyGoal
  }
  if (isBoolean(record.ttsEnabled)) {
    settings.ttsEnabled = record.ttsEnabled
  }
  return settings
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const next: AppSettings = { ...getSettings() }
  if (isDailyGoal(partial.dailyGoal)) {
    next.dailyGoal = partial.dailyGoal
  }
  if (isBoolean(partial.ttsEnabled)) {
    next.ttsEnabled = partial.ttsEnabled
  }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // 書き込みの失敗は無視して重ねた結果を返す
  }
  return next
}
