import type { FsrsRecord } from '../schema'
import type { Judgement, Question, Response, Step } from './types'
import type { QuestionContext } from './questions'
import { buildQuestion, judgeResponse } from './questions'
import type { ItemSessionState, Level } from './session'
import { applyAnswer, initItemState, nextItem } from './session'
import { newRecord, outcomeFor, reviewRecord, stabilityBand } from './fsrsWrapper'
import { xpForCorrect } from './game'

export interface LessonContext extends QuestionContext {
  fsrs: Readonly<Record<string, FsrsRecord>>
  now: Date
}

export interface AnswerLogEntry {
  itemId: string
  format: string
  correct: boolean
}

export interface LessonState {
  step: Step
  phase: 'main' | 'retry' | 'done'
  items: ItemSessionState[]
  introQueue: string[]
  current: { itemId: string; question: Question } | null
  fsrs: Record<string, FsrsRecord>
  xp: number
  answered: number
  correct: number
  wrongItemIds: string[]
  log: AnswerLogEntry[]
}

function targetItemIds(step: Step): string[] {
  if (step.kind === 'unitTest') {
    return [...step.wordIds, ...step.phraseIds]
  }
  return [...step.wordIds]
}

function levelForStepKind(kind: Step['kind']): Level | null {
  if (kind === 'recognize') return 0
  if (kind === 'recall') return 1
  if (kind === 'context') return 2
  return null
}

function makeIntroQuestion(itemId: string): Question {
  return { format: 'intro', itemId }
}

export function startLesson(step: Step, context: LessonContext): LessonState {
  const fsrs = { ...context.fsrs }

  if (step.kind === 'intro') {
    const introQueue = [...step.wordIds]
    const firstItemId = introQueue[0]

    if (firstItemId === undefined) {
      return {
        step,
        phase: 'done',
        items: [],
        introQueue,
        current: null,
        fsrs,
        xp: 0,
        answered: 0,
        correct: 0,
        wrongItemIds: [],
        log: [],
      }
    }

    return {
      step,
      phase: 'main',
      items: [],
      introQueue,
      current: { itemId: firstItemId, question: makeIntroQuestion(firstItemId) },
      fsrs,
      xp: 0,
      answered: 0,
      correct: 0,
      wrongItemIds: [],
      log: [],
    }
  }

  const ids = targetItemIds(step)
  const fixedLevel = levelForStepKind(step.kind)
  const items = ids.map((id) => {
    const item = initItemState(id, stabilityBand(context.fsrs[id]))
    if (fixedLevel === null) return item
    return { ...item, level: fixedLevel }
  })

  const first = nextItem(items)
  if (first === null) {
    return {
      step,
      phase: 'done',
      items,
      introQueue: [],
      current: null,
      fsrs,
      xp: 0,
      answered: 0,
      correct: 0,
      wrongItemIds: [],
      log: [],
    }
  }

  return {
    step,
    phase: 'main',
    items,
    introQueue: [],
    current: { itemId: first.itemId, question: buildQuestion(first.itemId, first.level, context) },
    fsrs,
    xp: 0,
    answered: 0,
    correct: 0,
    wrongItemIds: [],
    log: [],
  }
}

export function submitAnswer(
  state: LessonState,
  context: LessonContext,
  response: Response,
  meta?: { usedHint?: boolean; slow?: boolean },
): { state: LessonState; judgement: Judgement } {
  if (state.current === null) {
    return {
      state,
      judgement: { correct: false, close: false, correctText: '' },
    }
  }

  const current = state.current
  const judgement = judgeResponse(current.question, response)

  if (current.question.format === 'intro') {
    const existingRecord = state.fsrs[current.itemId]
    const fsrs =
      existingRecord === undefined
        ? { ...state.fsrs, [current.itemId]: newRecord(context.now) }
        : state.fsrs

    return {
      state: {
        ...state,
        introQueue: state.introQueue.slice(1),
        fsrs,
      },
      judgement,
    }
  }

  const usedHint = meta?.usedHint ?? false
  const slow = meta?.slow ?? false
  const selfGrade = judgement.selfGrade === 'easy' ? 'easy' : undefined
  const outcome = outcomeFor({ correct: judgement.correct, usedHint, slow, selfGrade })

  const items = state.items.map((item) =>
    item.itemId === current.itemId ? applyAnswer(item, judgement.correct) : item,
  )

  let wrongItemIds = state.wrongItemIds
  if (!judgement.correct && state.phase !== 'retry' && !wrongItemIds.includes(current.itemId)) {
    wrongItemIds = [...wrongItemIds, current.itemId]
  }

  const log: AnswerLogEntry[] = [
    ...state.log,
    { itemId: current.itemId, format: current.question.format, correct: judgement.correct },
  ]

  return {
    state: {
      ...state,
      items,
      fsrs: {
        ...state.fsrs,
        [current.itemId]: reviewRecord(state.fsrs[current.itemId], outcome, context.now),
      },
      xp: state.xp + (judgement.correct ? xpForCorrect() : 0),
      answered: state.answered + 1,
      correct: state.correct + (judgement.correct ? 1 : 0),
      wrongItemIds,
      log,
    },
    judgement,
  }
}

export function nextQuestion(state: LessonState, context: LessonContext): LessonState {
  if (state.step.kind === 'intro') {
    const nextItemId = state.introQueue[0]
    if (nextItemId === undefined) {
      return {
        ...state,
        phase: 'done',
        current: null,
      }
    }

    return {
      ...state,
      current: { itemId: nextItemId, question: makeIntroQuestion(nextItemId) },
    }
  }

  const next = nextItem(state.items)
  if (next !== null) {
    return {
      ...state,
      current: { itemId: next.itemId, question: buildQuestion(next.itemId, next.level, context) },
    }
  }

  if (state.step.kind === 'unitTest' && state.phase === 'main' && state.wrongItemIds.length > 0) {
    const items = state.wrongItemIds.map((id) => ({
      ...initItemState(id, 'new'),
      level: 0 as Level,
    }))
    const first = nextItem(items)

    if (first === null) {
      return {
        ...state,
        phase: 'done',
        items,
        current: null,
      }
    }

    return {
      ...state,
      phase: 'retry',
      items,
      current: {
        itemId: first.itemId,
        question: buildQuestion(first.itemId, first.level, context),
      },
    }
  }

  return {
    ...state,
    phase: 'done',
    current: null,
  }
}

export function isLessonDone(state: LessonState): boolean {
  return state.phase === 'done'
}
