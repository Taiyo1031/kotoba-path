// XP の加算と連続日数の更新(仕様5章の暫定ルール)。数値は GAME_CONFIG から読む。
import { GAME_CONFIG } from '../config/game'
import { addDays } from './pacing'
import type { Streak } from '../schema'

export function xpForCorrect(): number {
  return GAME_CONFIG.xp.correct
}

export function xpForStepComplete(): number {
  return GAME_CONFIG.xp.stepComplete
}

export function xpForUnitComplete(): number {
  return GAME_CONFIG.xp.unitComplete
}

export interface DayActivity {
  today: string // 'YYYY-MM-DD'
  stepCompleted: boolean // その日に1ステップ以上を完了した
  reviewsDone: number // その日にこなした復習の数
  dailyGoal: number // 1日の目標(新出+復習の合計数)
}

// ステップ完了、または復習が目標(>=1)に達していれば連続日数の対象。
export function qualifiesForStreak(activity: DayActivity): boolean {
  if (activity.stepCompleted) {
    return true
  }
  return activity.dailyGoal >= 1 && activity.reviewsDone >= activity.dailyGoal
}

// 新しい Streak を返す(入力は変更しない)。
export function updateStreak(streak: Streak, activity: DayActivity): Streak {
  if (!qualifiesForStreak(activity)) {
    return streak
  }
  const yesterday = addDays(activity.today, -1)
  // その日は加算済み
  if (streak.lastStudyDate === activity.today) {
    return streak
  }
  // 前日からの継続
  if (streak.lastStudyDate === yesterday) {
    return { days: streak.days + 1, lastStudyDate: activity.today }
  }
  // null、または2日以上前(途切れて今日から数え直し。猶予なし)
  return { days: 1, lastStudyDate: activity.today }
}

// 表示用の連続日数。
export function effectiveStreakDays(streak: Streak, today: string): number {
  if (streak.lastStudyDate === null) {
    return 0
  }
  const yesterday = addDays(today, -1)
  if (streak.lastStudyDate === today || streak.lastStudyDate === yesterday) {
    return streak.days
  }
  return 0
}
