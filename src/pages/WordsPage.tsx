import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getNow } from '../app/clock'
import { isOnboarded } from '../app/onboarding'
import { buildWordStats, WORD_STATES } from '../app/wordStats'
import type { WordEntry, WordState } from '../app/wordStats'
import { useT } from '../i18n'
import { ROUTES } from '../routes'
import { useAppState } from '../state/appState'
import '../styles/words.css'

export function WordsPage() {
  const t = useT()
  const { status, data, reload } = useAppState()
  const [state, setState] = useState<WordState | null>(null)
  const [unitId, setUnitId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    void reload()
  }, [reload])
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 32)
    return () => window.clearTimeout(timer)
  }, [])
  if (status === 'loading') return <div className="page">{t('common.loading')}</div>
  if (status === 'error')
    return (
      <div className="page" role="alert">
        {t('common.error')}
      </div>
    )
  if (data === null) {
    if (!isOnboarded()) return <Navigate to={ROUTES.intro} replace />
    return (
      <div className="page">
        <p>{t('home.noProfile')}</p>
        <Link className="button" to={ROUTES.welcome}>
          {t('home.noProfile.action')}
        </Link>
      </div>
    )
  }
  const stats = buildWordStats(data, getNow())
  const target = data.plan.units.reduce((sum, unit) => sum + unit.itemEstimate, 0)
  const remaining = Math.max(0, target - stats.seen)
  const matches = (entry: WordEntry) =>
    (state === null || entry.state === state) && (unitId === '' || entry.unitId === unitId)
  const selected = stats.entries.find((entry) => entry.id === selectedId)
  return (
    <div className="page words-page">
      <h1 className="page-title">{t('page.words')}</h1>
      {stats.total === 0 ? (
        <>
          <p>{t('words.empty')}</p>
          <Link className="button" to={ROUTES.data}>
            {t('words.empty.action')}
          </Link>
        </>
      ) : (
        <>
          <div className="words-summary">
            <div className="words-card">
              <p>{t('words.stat.seen')}</p>
              <strong>{stats.seen}</strong>{' '}
              <span>{t('words.stat.seenOf', { total: stats.total })}</span>
            </div>
            <div className="words-card">
              <p>{t('words.stat.mature')}</p>
              <strong>{stats.mature}</strong>
            </div>
            <div className="words-card">
              <p>{t('words.stat.due')}</p>
              <strong>{stats.dueNow}</strong>
            </div>
            <div className="words-card">
              <p>{t('words.stat.target')}</p>
              <strong>{target}</strong>
              <p>
                {remaining > 0
                  ? t('words.stat.remaining', { count: remaining })
                  : t('words.stat.reached')}
              </p>
            </div>
          </div>
          <div
            className="words-bar"
            role="img"
            aria-label={
              t('words.bar.label') +
              ': ' +
              WORD_STATES.map(
                (value) => `${t(`words.state.${value}`)} ${stats.counts[value]}`,
              ).join(', ')
            }
          >
            {WORD_STATES.filter((value) => stats.counts[value] > 0).map((value) => (
              <span
                key={value}
                className={`words-seg words-seg--${value}`}
                style={{ width: `${entered ? (stats.counts[value] / stats.total) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div className="words-filters">
            <button
              type="button"
              className="button"
              aria-pressed={state === null}
              onClick={() => setState(null)}
            >
              {t('words.filter.all')} {stats.total}
            </button>
            {WORD_STATES.map((value) => (
              <button
                key={value}
                type="button"
                className="button"
                aria-pressed={state === value}
                onClick={() => setState(state === value ? null : value)}
              >
                {t(`words.state.${value}`)} {stats.counts[value]}
              </button>
            ))}
          </div>
          <div className="words-unit-filter">
            <label htmlFor="words-unit">{t('words.filter.unit')}</label>
            <select
              id="words-unit"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
            >
              <option value="">{t('words.filter.all')}</option>
              {data.plan.units
                .filter((unit) => stats.entries.some((entry) => entry.unitId === unit.id))
                .map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.id}: {unit.title}
                  </option>
                ))}
            </select>
          </div>
          <p>{t('words.filter.count', { count: stats.entries.filter(matches).length })}</p>
          <div className="words-grid">
            {stats.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`words-tile words-tile--${entry.state}${matches(entry) ? '' : ' words-tile--dim'}`}
                data-dim={matches(entry) ? undefined : 'true'}
                aria-label={`${entry.lemma} ${t(`words.state.${entry.state}`)}`}
                aria-pressed={selectedId === entry.id}
                onClick={() => setSelectedId(entry.id)}
              >
                {entry.lemma}
              </button>
            ))}
          </div>
          <div className="words-detail">
            {selected ? (
              <>
                <h2>{selected.lemma}</h2>
                {selected.reading !== '' && <p>{selected.reading}</p>}
                <p>{selected.meaning}</p>
                <span className={`words-badge words-badge--${selected.state}`}>
                  {t(`words.state.${selected.state}`)}
                </span>
                <dl>
                  <dt>{t('words.detail.stability')}</dt>
                  <dd>
                    {selected.stabilityDays === null
                      ? '-'
                      : t('words.detail.stabilityValue', {
                          days: Math.round(selected.stabilityDays),
                        })}
                  </dd>
                  <dt>{t('words.detail.nextReview')}</dt>
                  <dd>
                    {selected.dueInDays === null
                      ? '-'
                      : selected.dueInDays <= 0
                        ? t('words.detail.today')
                        : t('words.detail.inDays', { days: selected.dueInDays })}
                  </dd>
                  <dt>{t('words.detail.lapses')}</dt>
                  <dd>{t('words.detail.lapsesValue', { count: selected.lapses })}</dd>
                  <dt>{t('words.detail.unit')}</dt>
                  <dd>{selected.unitId}</dd>
                </dl>
              </>
            ) : (
              <p>{t('words.detail.hint')}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
