import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { LessonRunner } from '../components/lesson/LessonRunner'
import type { LessonRunnerProps } from '../components/lesson/LessonRunner'
import { getNow, getToday } from '../app/clock'
import { getSettings } from '../app/settings'
import { isDue } from '../engine/fsrsWrapper'
import type { Step } from '../engine/types'
import { useT } from '../i18n'
import { ROUTES } from '../routes'
import { useAppState } from '../state/appState'
import '../styles/review.css'

const FIXED_SEED_KEY = 'kp.fixedSeed'

function readFixedSeed(): string | null {
  try {
    const value = localStorage.getItem(FIXED_SEED_KEY)
    return value === '' ? null : value
  } catch {
    return null
  }
}

export function ReviewPage(): JSX.Element {
  const t = useT()
  const { status, data, reload } = useAppState()
  const [started, setStarted] = useState(false)
  const [session, setSession] = useState<LessonRunnerProps | null>(null)

  useEffect(() => {
    void reload()
  }, [reload])

  const review = useMemo(() => {
    if (data === null) return null

    const now = getNow()
    const goal = getSettings().dailyGoal
    const units = Object.values(data.content.units)
    const words = units.flatMap((unit) => unit.words)
    const phrases = units.flatMap((unit) => unit.phrases)
    const wordIdSet = new Set(words.map((word) => word.id))
    const phraseIdSet = new Set(phrases.map((phrase) => phrase.id))
    const dueIds = Object.entries(data.progress.fsrs)
      .filter(([, record]) => isDue(record, now))
      .sort(([, a], [, b]) => Date.parse(a.due) - Date.parse(b.due))
      .map(([id]) => id)
    const wordIds = dueIds.filter((id) => wordIdSet.has(id)).slice(0, goal)
    const phraseIds = dueIds
      .filter((id) => !wordIdSet.has(id) && phraseIdSet.has(id))
      .slice(0, goal - wordIds.length)
    const step: Step = {
      id: 'review',
      kind: 'unitTest',
      batchIndex: null,
      wordIds,
      phraseIds,
      sentenceIds: [],
    }
    return {
      step,
      unitId: 'review',
      kind: 'review',
      words,
      phrases,
      sentences: units.flatMap((unit) => unit.sentences),
      grammarNotes: units.flatMap((unit) => unit.grammarNotes),
      pool: words,
      unitWordIds: new Set<string>(),
      learnedWordIds: wordIdSet,
      stepIds: [],
      targetLanguage: data.profile.targetLanguage,
      seedKey: readFixedSeed() ?? `review:${getToday()}`,
      backTo: ROUTES.home,
      backLabel: t('unit.back'),
    } satisfies LessonRunnerProps
  }, [data, t])

  // 保存後の再読み込みでも、開始時の対象と完了画面を保つ。
  if (started && session) {
    return (
      <div className="page review-page">
        <LessonRunner {...session} />
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="page review-page">
        <p role="status">{t('common.loading')}</p>
      </div>
    )
  }

  if (review === null) {
    return (
      <div className="page review-page">
        <p>{t('home.noProfile')}</p>
        <Link className="button" to={ROUTES.welcome}>
          {t('unit.back')}
        </Link>
      </div>
    )
  }

  const count = review.step.wordIds.length + review.step.phraseIds.length

  if (count === 0) {
    return (
      <div className="page review-page">
        <p aria-live="polite">{t('review.none')}</p>
        <Link className="button" to={ROUTES.home}>
          {t('unit.back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="page review-page">
      <p aria-live="polite">{t('review.due', { count })}</p>
      <button
        type="button"
        className="button review-start-button"
        onClick={() => {
          setSession(review)
          setStarted(true)
        }}
      >
        {t('review.start')}
      </button>
    </div>
  )
}
