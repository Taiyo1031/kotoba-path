import type { QuestionFormat } from './types'
import { GAME_CONFIG } from '../config/game'

export type Level = 0 | 1 | 2
export type Band = 'new' | 'learning' | 'mature'

export function levelForBand(band: Band): Level {
  if (band === 'new') return 0
  if (band === 'learning') return 1
  return 2
}

export function downgradeLevel(level: Level): Level {
  if (level === 0) return 0
  if (level === 1) return 0
  return 1
}

export interface FormatAvailability {
  hasSentence: boolean
  hasSlotPhrase: boolean
}

export interface FormatChoice {
  format: QuestionFormat
  variant?: 'foreignToNative' | 'nativeToForeign'
}

function pickFrom(candidates: FormatChoice[], rng: () => number): FormatChoice {
  const index = Math.floor(rng() * candidates.length)
  const choice = candidates[index]
  if (choice === undefined) {
    throw new Error(`候補が空です: ${JSON.stringify(candidates)}`)
  }
  return choice
}

export function pickFormat(
  level: Level,
  availability: FormatAvailability,
  rng: () => number,
): FormatChoice {
  if (level === 0) {
    return { format: 'mcq', variant: 'foreignToNative' }
  }
  if (level === 2) {
    const candidates: FormatChoice[] = []
    if (availability.hasSentence) candidates.push({ format: 'cloze' })
    if (availability.hasSlotPhrase) candidates.push({ format: 'phrase-slot' })
    if (candidates.length > 0) {
      return pickFrom(candidates, rng)
    }
  }
  // 段階 1(または段階 2 で候補がなかった場合)
  const candidates: FormatChoice[] = [
    { format: 'mcq', variant: 'nativeToForeign' },
    { format: 'typing' },
  ]
  if (availability.hasSentence) candidates.push({ format: 'tiles' })
  return pickFrom(candidates, rng)
}

export const MAX_RECALLS = GAME_CONFIG.maxRecallsPerItemPerSession

export interface ItemSessionState {
  itemId: string
  level: Level
  recalls: number
  correctCount: number
  wrongCount: number
  lastCorrect: boolean | null
  done: boolean
}

export function initItemState(itemId: string, band: Band): ItemSessionState {
  return {
    itemId,
    level: levelForBand(band),
    recalls: 0,
    correctCount: 0,
    wrongCount: 0,
    lastCorrect: null,
    done: false,
  }
}

export function applyAnswer(state: ItemSessionState, correct: boolean): ItemSessionState {
  if (state.done) {
    return state
  }
  const recalls = state.recalls + 1
  const correctCount = correct ? state.correctCount + 1 : state.correctCount
  const wrongCount = correct ? state.wrongCount : state.wrongCount + 1
  const level = correct ? state.level : downgradeLevel(state.level)
  const done = (correct && correctCount >= 2) || recalls >= MAX_RECALLS
  return {
    itemId: state.itemId,
    level,
    recalls,
    correctCount,
    wrongCount,
    lastCorrect: correct,
    done,
  }
}

export function nextItem(states: ReadonlyArray<ItemSessionState>): ItemSessionState | null {
  let best: ItemSessionState | null = null
  for (const state of states) {
    if (state.done) continue
    if (best === null || state.recalls < best.recalls) {
      best = state
    }
  }
  return best
}
