import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getNow, getToday } from '../app/clock'
import { buildHomeView } from '../app/home'
import type { HomeUnitRow } from '../app/home'
import { isOnboarded } from '../app/onboarding'
import { getSettings } from '../app/settings'
import { useT } from '../i18n'
import { ROUTES, unitPath } from '../routes'
import { useAppState } from '../state/appState'
import '../styles/home.css'

function XpCount({ value }: { value: number }) {
  const [reduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  const [count, setCount] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    const timer = window.setInterval(() => {
      const ratio = Math.min(1, (performance.now() - start) / 600)
      setCount(Math.round(value * ratio))
      if (ratio === 1) window.clearInterval(timer)
    }, 16)
    return () => window.clearInterval(timer)
  }, [value, reduced])
  return <strong className="home-xp">{count}</strong>
}

function UnitCard({ unit, next }: { unit: HomeUnitRow; next: boolean }) {
  const t = useT()
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 32)
    return () => window.clearTimeout(timer)
  }, [])
  const percent = Math.max(0, Math.min(100, Math.round(unit.progressRatio * 100)))
  return (
    <article className={`home-unit-card${next ? ' home-unit-next' : ''}`}>
      <h3>{unit.title}</h3>
      <p>{unit.canDo}</p>
      <div className="home-badges">
        {unit.status === 'done' && <span>{t('home.unit.done')}</span>}
        {unit.optional && <span>{t('home.unit.optional')}</span>}
        {unit.hasUncertain && <span>{t('home.unit.unverified')}</span>}
      </div>
      <p>{t('home.unit.progress', { done: unit.stepsDone, total: unit.stepsTotal })}</p>
      <div
        className="home-progress"
        role="progressbar"
        aria-label={unit.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="home-progress-fill" style={{ width: `${entered ? percent : 0}%` }} />
      </div>
      {(unit.plannedStart || unit.plannedEnd) && (
        <p>
          {t('unit.schedule', {
            start: unit.plannedStart ?? '',
            end: unit.plannedEnd ?? '',
          })}
        </p>
      )}
      <Link className="button" to={unit.hasContent ? unitPath(unit.id) : ROUTES.data}>
        {t(
          !unit.hasContent
            ? 'home.unit.prepare'
            : unit.status !== 'done' && unit.stepsDone === 0
              ? 'home.unit.start'
              : 'home.unit.continue',
        )}
      </Link>
    </article>
  )
}

export function HomePage() {
  const t = useT()
  const { status, data, lastBackupAt, reload } = useAppState()
  useEffect(() => {
    void reload()
  }, [reload])
  if (status === 'loading') return <div className="page">{t('common.loading')}</div>
  if (status === 'error')
    return (
      <div className="page" role="alert">
        {t('common.error')}
      </div>
    )
  if (data === null) {
    if (!isOnboarded()) {
      return <Navigate to={ROUTES.intro} replace />
    }
    return (
      <div className="page">
        <p>{t('home.noProfile')}</p>
        <Link className="button" to={ROUTES.welcome}>
          {t('home.noProfile.action')}
        </Link>
      </div>
    )
  }
  const view = buildHomeView(data, {
    today: getToday(),
    now: getNow(),
    dailyGoal: getSettings().dailyGoal,
    reviewsDoneToday: 0,
    lastBackupAt,
  })
  return (
    <div className="page home-page">
      <h1 className="page-title">{t('page.home')}</h1>
      <div className="home-summary">
        <div className="home-summary-card">
          <span aria-hidden="true" className={view.streakDays > 0 ? 'kp-anim-pulse' : undefined}>
            🔥
          </span>
          <p>{t('home.streak', { days: view.streakDays })}</p>
        </div>
        <div className="home-summary-card">
          <p>{t('home.xp')}</p>
          <XpCount key={view.xp} value={view.xp} />
        </div>
        <div className="home-summary-card">
          <p>{t('home.todayGoal')}</p>
          <strong>{view.dailyGoal}</strong>
        </div>
        <div className="home-summary-card">
          <p>{t(`home.pace.${view.pace.status}`)}</p>
          <p>{t('home.pace.daily', { count: view.pace.dailyNew })}</p>
          {view.pace.unrealistic && <p role="alert">{t('home.pace.unrealistic')}</p>}
        </div>
      </div>
      {view.dueReviewCount > 0 ? (
        <Link className="button" to={ROUTES.review}>
          {t('home.review.button', { count: view.dueReviewCount })}
        </Link>
      ) : (
        <p>{t('home.review.none')}</p>
      )}
      {view.backup.needsBackup && (
        <aside className="home-backup">
          <p>
            {view.backup.daysSince === null
              ? t('data.backup.never')
              : t('home.backup.warn', { days: view.backup.daysSince ?? 0 })}
          </p>
          <Link className="button" to={ROUTES.data}>
            {t('home.backup.action')}
          </Link>
        </aside>
      )}
      <section className="home-path">
        <h2>{t('home.path')}</h2>
        {view.units.length === 0 ? (
          <>
            <p>{t('home.empty')}</p>
            <Link className="button" to={ROUTES.data}>
              {t('home.empty.action')}
            </Link>
          </>
        ) : (
          view.units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} next={view.nextUnitId === unit.id} />
          ))
        )}
      </section>
    </div>
  )
}
