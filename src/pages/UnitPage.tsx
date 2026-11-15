import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useT } from '../i18n'
import type { Translator } from '../i18n'
import { useAppState } from '../state/appState'
import { ROUTES, lessonPath } from '../routes'
import { buildSteps } from '../engine/steps'
import type { Step } from '../engine/types'
import '../styles/unit.css'

function stepLabel(t: Translator, step: Step): string {
  const kindLabel = t(`unit.step.${step.kind}`)
  if (step.batchIndex === null) {
    return kindLabel
  }
  return `${step.batchIndex + 1}. ${kindLabel}`
}

export function UnitPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { status, data, reload } = useAppState()

  useEffect(() => {
    void reload()
  }, [reload])

  if (status === 'loading') {
    return (
      <div className="page unit-page">
        <h1 className="page-title">{t('page.unit')}</h1>
        <p className="unit-status" role="status">
          {t('common.loading')}
        </p>
      </div>
    )
  }

  const unit = data?.plan.units.find((item) => item.id === id)
  if (data === null || unit === undefined || id === undefined) {
    return (
      <div className="page unit-page">
        <h1 className="page-title">{t('page.unit')}</h1>
        <p className="unit-status" role="alert">
          {t('unit.notFound')}
        </p>
        <Link className="button unit-back" to={ROUTES.home}>
          {t('unit.back')}
        </Link>
      </div>
    )
  }

  const content = data.content.units[id]
  const hasUncertain = content?.words.some((word) => word.uncertain === true) ?? false
  const schedule =
    unit.plannedStart !== undefined && unit.plannedEnd !== undefined
      ? t('unit.schedule', { start: unit.plannedStart, end: unit.plannedEnd })
      : null
  const completedStepIds = data.progress.unitProgress[id]?.completedStepIds ?? []
  const steps = content === undefined ? [] : buildSteps(id, content)

  return (
    <div className="page unit-page">
      <header className="unit-header">
        <h1 className="page-title unit-title">{unit.title}</h1>

        <div className="unit-meta">
          <section className="unit-section" aria-label={t('unit.canDo')}>
            <h2 className="unit-section-title">{t('unit.canDo')}</h2>
            <p className="unit-cando">{unit.canDo}</p>
          </section>

          {unit.scenario ? <p className="unit-scenario">{unit.scenario}</p> : null}
          {schedule ? <p className="unit-schedule">{schedule}</p> : null}
          {hasUncertain ? (
            <span className="unit-badge unit-badge-unverified">{t('home.unit.unverified')}</span>
          ) : null}
        </div>

        <Link className="button unit-back" to={ROUTES.home}>
          {t('unit.back')}
        </Link>
      </header>

      {content === undefined ? (
        <div className="unit-no-content">
          <p className="unit-status" role="status">
            {t('unit.noContent')}
          </p>
          <Link className="button" to={ROUTES.data}>
            {t('home.unit.prepare')}
          </Link>
        </div>
      ) : (
        <section className="unit-steps" aria-label={t('unit.steps')}>
          <h2 className="unit-section-title">{t('unit.steps')}</h2>
          <ol className="unit-step-list">
            {steps.map((step) => {
              const done = completedStepIds.includes(step.id)
              const classes = [
                'unit-step',
                step.kind === 'unitTest' ? 'unit-step-unit-test' : 'unit-step-normal',
              ]
              return (
                <li key={step.id} className={classes.join(' ')}>
                  <div className="unit-step-body">
                    <h3 className="unit-step-label">{stepLabel(t, step)}</h3>
                    <p className="unit-step-items">
                      {t('unit.step.items', {
                        count: step.wordIds.length + step.phraseIds.length,
                      })}
                    </p>
                    {done ? (
                      <span className="unit-badge unit-badge-done">{t('unit.step.done')}</span>
                    ) : null}
                  </div>
                  <Link className="button unit-step-start" to={lessonPath(id, step.id)}>
                    {t('unit.step.start')}
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}
