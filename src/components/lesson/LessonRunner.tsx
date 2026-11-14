import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { getNow, getToday } from '../../app/clock'
import { applyLessonResult, isUnitComplete } from '../../app/progressUpdate'
import { getSettings } from '../../app/settings'
import { hasVoiceFor, speak } from '../../app/tts'
import { getAppStore } from '../../db'
import { startLesson, submitAnswer, nextQuestion, isLessonDone } from '../../engine/lesson'
import { createRng, hashSeed } from '../../engine/rng'
import type { Judgement, Response, Step } from '../../engine/types'
import { useT } from '../../i18n'
import type { Word, Phrase, Sentence, GrammarNote } from '../../schema'
import { useAppState } from '../../state/appState'
import { IntroCard } from './IntroCard'
import { McqView } from './McqView'
import { ClozeView } from './ClozeView'
import { TypingView } from './TypingView'
import { TilesView } from './TilesView'
import { FlashcardView } from './FlashcardView'
import { FeedbackBar } from './FeedbackBar'
import type { AnswerMeta } from './types'
import '../../styles/lesson.css'

export interface LessonRunnerProps {
  step: Step
  unitId: string
  kind: 'lesson' | 'review'
  words: ReadonlyArray<Word>
  phrases: ReadonlyArray<Phrase>
  sentences: ReadonlyArray<Sentence>
  grammarNotes: ReadonlyArray<GrammarNote>
  pool: ReadonlyArray<Word>
  unitWordIds: ReadonlySet<string>
  learnedWordIds: ReadonlySet<string>
  stepIds: ReadonlyArray<string>
  targetLanguage: string
  seedKey: string
  backTo: string
  backLabel: string
}

export function LessonRunner(props: LessonRunnerProps): JSX.Element {
  const data = useAppState((state) => state.data)
  const t = useT()
  const [initial] = useState(() => {
    if (!data) return null
    const now = getNow()
    const context = {
      ...props,
      rng: createRng(hashSeed(props.seedKey)),
      fsrs: data.progress.fsrs,
      now,
    }
    const lesson = startLesson(props.step, context)
    return {
      context,
      lesson,
      data,
      startedAt: now.toISOString(),
      empty: !lesson.current && isLessonDone(lesson),
    }
  })
  const [lesson, setLesson] = useState(initial?.lesson ?? null)
  const [judgement, setJudgement] = useState<Judgement | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [xp, setXp] = useState<number | null>(null)
  const saved = useRef(false)
  const { step, unitId, kind, backTo, backLabel } = props
  const complete = lesson !== null && lesson.current === null && isLessonDone(lesson)
  const unitCompleted =
    kind === 'lesson' &&
    isUnitComplete(props.stepIds, [
      ...(initial?.data.progress.unitProgress[unitId]?.completedStepIds ?? []),
      step.id,
    ])
  useEffect(() => {
    if (!complete || !initial || !lesson || initial.empty || saved.current) return
    saved.current = true
    const progress = applyLessonResult(
      initial.data.progress,
      {
        unitId,
        step,
        kind,
        fsrs: lesson.fsrs,
        xp: lesson.xp,
        answered: lesson.answered,
        correct: lesson.correct,
        wrongItemIds: lesson.wrongItemIds,
        seed: hashSeed(props.seedKey),
        startedAt: initial.startedAt,
        endedAt: getNow().toISOString(),
        stepCompleted: true,
        unitCompleted,
      },
      { today: getToday(), dailyGoal: getSettings().dailyGoal, reviewsDoneToday: 0 },
    )
    const save = async () => {
      setXp(progress.xp - initial.data.progress.xp)
      try {
        const store = getAppStore()
        await store.saveProgress(progress)
        if (kind === 'lesson')
          await store.savePlan({
            ...initial.data.plan,
            units: initial.data.plan.units.map((unit) =>
              unit.id !== unitId
                ? unit
                : {
                    ...unit,
                    status: unitCompleted
                      ? 'done'
                      : unit.status === 'ready' || unit.status === 'planned'
                        ? 'inProgress'
                        : unit.status,
                  },
            ),
          })
        await useAppState.getState().reload()
      } catch {
        setSaveError(true)
      }
    }
    void save()
  }, [complete, initial, kind, lesson, props.seedKey, step, unitCompleted, unitId])
  if (lesson?.current?.question.format === 'match' && initial) {
    setLesson(nextQuestion(lesson, initial.context))
  }
  if (!data || !initial || !lesson) return <p>{t('lesson.notFound')}</p>
  const advance = () => {
    setLesson(nextQuestion(lesson, initial.context))
    setJudgement(null)
  }
  const onSubmit = (response: Response, meta?: AnswerMeta) => {
    if (judgement || complete) return
    const result = submitAnswer(lesson, initial.context, response, meta)
    if (lesson.current?.question.format === 'intro')
      setLesson(nextQuestion(result.state, initial.context))
    else {
      setLesson(result.state)
      setJudgement(result.judgement)
    }
  }
  const total = step.kind === 'intro' ? step.wordIds.length : lesson.items.length
  const done =
    step.kind === 'intro'
      ? total - lesson.introQueue.length
      : lesson.items.filter((item) => item.done).length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  const voice =
    getSettings().ttsEnabled && hasVoiceFor(props.targetLanguage)
      ? {
          onSpeak: (text: string) => {
            speak(text, props.targetLanguage)
          },
        }
      : {}
  const common = { disabled: judgement !== null, judgement, onSubmit, ...voice }
  const current = lesson.current
  const question = current?.question
  const examples = props.sentences.filter((sentence) =>
    sentence.wordIds.includes(current?.itemId ?? ''),
  )
  let view: JSX.Element | null = null
  if (question?.format === 'intro') {
    const word = props.words.find((word) => word.id === question.itemId)
    if (word)
      view = (
        <IntroCard
          word={word}
          sentences={examples}
          related={word.rel.flatMap((rel) => {
            const related = [...props.words, ...props.pool].find((word) => word.id === rel.id)
            return related ? [related] : []
          })}
          onContinue={() => onSubmit({ kind: 'ack' })}
          {...voice}
        />
      )
  } else if (question?.format === 'mcq') view = <McqView question={question} {...common} />
  else if (question?.format === 'cloze') view = <ClozeView question={question} {...common} />
  else if (question?.format === 'typing') view = <TypingView question={question} {...common} />
  else if (question?.format === 'tiles') view = <TilesView question={question} {...common} />
  else if (question?.format === 'flashcard' || question?.format === 'phrase-slot')
    view = <FlashcardView question={question} {...common} />
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className="lesson-runner">
      <header className="lesson-header">
        <Link className="button" to={backTo}>
          {t('lesson.close')}
        </Link>
        <div className="lesson-progress-section">
          <div
            className="lesson-progress"
            role="progressbar"
            aria-label={t('lesson.progress', { done, total })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="lesson-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <p>{t('lesson.progress', { done, total })}</p>
        </div>
      </header>
      <main className="lesson-body">
        {initial.empty ? (
          <>
            <p>{t('lesson.empty')}</p>
            <Link className="button" to={backTo}>
              {backLabel}
            </Link>
          </>
        ) : complete ? (
          <section className="lesson-complete" aria-live="polite">
            <h1 className="kp-anim-bounce">{t('lesson.complete.title')}</h1>
            {xp !== null && <p>{t('lesson.complete.xp', { xp })}</p>}
            {lesson.answered > 0 && (
              <p>
                {t('lesson.complete.accuracy', {
                  correct: lesson.correct,
                  answered: lesson.answered,
                })}
              </p>
            )}
            {unitCompleted && (
              <>
                <p>{t('lesson.complete.unit')}</p>
                {!reducedMotion && (
                  <div className="lesson-confetti" aria-hidden="true">
                    {Array.from({ length: 16 }, (_, index) => (
                      <span
                        key={index}
                        className="lesson-confetti-piece"
                        style={{ left: `${index * 6}%`, animationDelay: `${index * 0.07}s` }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            {saveError && <p role="alert">{t('common.error')}</p>}
            <Link className="button" to={backTo}>
              {backLabel}
            </Link>
          </section>
        ) : (
          <>
            <div key={`${lesson.answered - (judgement ? 1 : 0)}:${lesson.introQueue.length}`}>
              {view}
            </div>
            {judgement && (
              <FeedbackBar
                judgement={judgement}
                examples={examples.slice(0, 2)}
                grammarNotes={props.grammarNotes.filter((note) =>
                  note.appliesTo.includes(current?.itemId ?? ''),
                )}
                onNext={advance}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
