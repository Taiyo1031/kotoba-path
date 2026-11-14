import { createEmptyCard, fsrs } from 'ts-fsrs'
import type { Card } from 'ts-fsrs'
import type { FsrsRecord } from '../schema'

export type Outcome = 'again' | 'hard' | 'good' | 'easy'

export interface AnswerInfo {
  correct: boolean
  usedHint: boolean
  slow: boolean
  /** 自己採点のフラッシュカードで「簡単」を選んだときだけ 'easy' */
  selfGrade?: 'easy'
}

const scheduler = fsrs()

const RATING_BY_OUTCOME = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
} as const

export function outcomeFor(answer: AnswerInfo): Outcome {
  if (!answer.correct) return 'again'
  if (answer.selfGrade === 'easy') return 'easy'
  if (answer.usedHint || answer.slow) return 'hard'
  return 'good'
}

function toCard(record: FsrsRecord): Card {
  return {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    scheduled_days: record.scheduledDays,
    learning_steps: record.learningSteps ?? 0,
    reps: record.reps,
    lapses: record.lapses,
    state: record.state as Card['state'],
    last_review: record.lastReview ? new Date(record.lastReview) : undefined,
  }
}

function toRecord(card: Card, now: Date): FsrsRecord {
  const lastReview = card.last_review?.toISOString()
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.last_review
      ? Math.max(0, Math.floor((now.getTime() - card.last_review.getTime()) / 86400000))
      : 0,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    ...(lastReview ? { lastReview } : {}),
    learningSteps: card.learning_steps ?? 0,
  }
}

export function newRecord(now: Date): FsrsRecord {
  return toRecord(createEmptyCard(now), now)
}

export function reviewRecord(
  record: FsrsRecord | undefined,
  outcome: Outcome,
  now: Date,
): FsrsRecord {
  const card = record ? toCard(record) : createEmptyCard(now)
  return toRecord(scheduler.next(card, now, RATING_BY_OUTCOME[outcome]).card, now)
}

export function isDue(record: FsrsRecord | undefined, now: Date): boolean {
  if (record === undefined) return false
  return Date.parse(record.due) <= now.getTime()
}

export type StabilityBand = 'new' | 'learning' | 'mature'
export const MATURE_STABILITY_DAYS = 10

export function stabilityBand(record: FsrsRecord | undefined): StabilityBand {
  if (record === undefined || record.reps === 0) return 'new'
  if (record.stability >= MATURE_STABILITY_DAYS) return 'mature'
  return 'learning'
}
