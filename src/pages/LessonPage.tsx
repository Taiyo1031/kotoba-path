import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getToday } from '../app/clock'
import { LessonRunner } from '../components/lesson/LessonRunner'
import { buildSteps } from '../engine/steps'
import { useT } from '../i18n'
import { ROUTES, unitPath } from '../routes'
import { useAppState } from '../state/appState'

export function LessonPage() {
  const t = useT()
  const { unitId, stepId } = useParams<{ unitId: string; stepId: string }>()
  const { data, status, reload } = useAppState()
  useEffect(() => {
    void reload()
  }, [reload])
  if (status === 'loading' && !data) return <p role="status">{t('common.loading')}</p>
  const unit = data?.plan.units.find((unit) => unit.id === unitId)
  const content = unitId ? data?.content.units[unitId] : undefined
  const steps = content && unitId ? buildSteps(unitId, content) : []
  const step = steps.find((step) => step.id === stepId)
  if (!data || !unit || !content || !step || !unitId)
    return (
      <div className="page">
        <p>{t('lesson.notFound')}</p>
        <Link className="button" to={ROUTES.home}>
          {t('lesson.complete.back')}
        </Link>
      </div>
    )
  const learnedWordIds = new Set(
    Object.values(data.progress.unitProgress).flatMap((progress) => progress.introducedItemIds),
  )
  if (step.kind !== 'intro') step.wordIds.forEach((id) => learnedWordIds.add(id))
  let seedKey = `${unitId}:${stepId}:${getToday()}`
  try {
    seedKey = localStorage.getItem('kp.fixedSeed') || seedKey
  } catch {
    /* 日付シードを使う */
  }
  return (
    <LessonRunner
      key={step.id}
      step={step}
      unitId={unitId}
      kind="lesson"
      words={content.words}
      phrases={content.phrases}
      sentences={content.sentences}
      grammarNotes={content.grammarNotes}
      pool={Object.values(data.content.units).flatMap((content) => content.words)}
      unitWordIds={new Set(content.words.map((word) => word.id))}
      learnedWordIds={learnedWordIds}
      stepIds={steps.map((step) => step.id)}
      targetLanguage={data.profile.targetLanguage}
      seedKey={seedKey}
      backTo={unitPath(unitId)}
      backLabel={t('lesson.complete.back')}
    />
  )
}
