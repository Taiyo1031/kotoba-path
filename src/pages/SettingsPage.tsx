import { useEffect, useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import { Link } from 'react-router-dom'
import { getSettings, saveSettings } from '../app/settings'
import { hasVoiceFor } from '../app/tts'
import { UI_LANGUAGES, useI18n } from '../i18n'
import { ROUTES } from '../routes'
import { getAppStore } from '../db'
import { useAppState } from '../state/appState'
import '../styles/settings.css'

function parseDailyGoal(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isInteger(value)) return null
  if (value < 1 || value > 200) return null
  return value
}

function parseStudyDays(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isInteger(value)) return null
  if (value < 1 || value > 7) return null
  return value
}

export function SettingsPage() {
  const { t, language, setLanguage } = useI18n()
  const { data, reload } = useAppState()

  const [dailyGoalDraft, setDailyGoalDraft] = useState(() => String(getSettings().dailyGoal))
  const [dailyGoalBaseline, setDailyGoalBaseline] = useState(() => getSettings().dailyGoal)
  const [ttsEnabled, setTtsEnabled] = useState(() => getSettings().ttsEnabled)
  const [savedVisible, setSavedVisible] = useState(false)

  const profile = data?.profile ?? null
  const hasProfile = profile !== null
  const targetLanguage = hasProfile ? profile.targetLanguage : undefined
  const currentStudyDays = hasProfile ? profile.goal.studyDaysPerWeek : undefined

  const selectedStudyDays = Number.isInteger(currentStudyDays) ? currentStudyDays : 1

  useEffect(() => {
    void reload()
  }, [reload])

  function markSaved() {
    setSavedVisible(true)
  }

  function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const selected = UI_LANGUAGES.find((item) => item.code === event.currentTarget.value)
    if (selected !== undefined) {
      setLanguage(selected.code)
    }
  }

  function handleDailyGoalFocus() {
    setDailyGoalBaseline(getSettings().dailyGoal)
  }

  function restoreDailyGoal(baseline: number) {
    setDailyGoalDraft(String(baseline))
    saveSettings({ dailyGoal: baseline })
    markSaved()
  }

  function handleDailyGoalChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.currentTarget.value
    setDailyGoalDraft(raw)

    if (raw.trim() === '') return

    const next = parseDailyGoal(raw)
    if (next === null) {
      restoreDailyGoal(dailyGoalBaseline)
      return
    }

    saveSettings({ dailyGoal: next })
    markSaved()
  }

  function handleDailyGoalBlur(event: FocusEvent<HTMLInputElement>) {
    const raw = event.currentTarget.value
    if (raw.trim() === '') {
      restoreDailyGoal(dailyGoalBaseline)
      return
    }

    const next = parseDailyGoal(raw)
    if (next === null) {
      restoreDailyGoal(dailyGoalBaseline)
      return
    }

    setDailyGoalDraft(String(next))
  }

  function handleStudyDaysChange(event: ChangeEvent<HTMLSelectElement>) {
    if (profile === null) return
    const next = parseStudyDays(event.currentTarget.value)
    if (next === null) return

    void Promise.resolve(
      getAppStore().saveProfile({
        ...profile,
        goal: {
          ...profile.goal,
          studyDaysPerWeek: next,
        },
      }),
    )
      .then(() => {
        reload()
      })
      .catch(() => {
        // 保存失敗は画面を壊さない
      })
  }

  function handleTtsChange(event: ChangeEvent<HTMLInputElement>) {
    const checked = event.currentTarget.checked
    setTtsEnabled(checked)
    saveSettings({ ttsEnabled: checked })
    markSaved()
  }

  const ttsAvailable =
    hasProfile && typeof targetLanguage === 'string' && hasVoiceFor(targetLanguage)

  return (
    <div className="page settings-page">
      <h1 className="page-title">{t('page.settings')}</h1>

      <section className="settings-section" aria-labelledby="settings-language-heading">
        <h2 id="settings-language-heading" className="settings-heading">
          {t('settings.uiLanguage')}
        </h2>
        <div className="language-switcher settings-field">
          <label htmlFor="language-select">{t('settings.uiLanguage')}</label>
          <select id="language-select" value={language} onChange={handleLanguageChange}>
            {UI_LANGUAGES.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-daily-goal-heading">
        <h2 id="settings-daily-goal-heading" className="settings-heading">
          {t('settings.dailyGoal')}
        </h2>
        <div className="settings-field">
          <label htmlFor="daily-goal">{t('settings.dailyGoal')}</label>
          <input
            id="daily-goal"
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            step={1}
            value={dailyGoalDraft}
            onFocus={handleDailyGoalFocus}
            onChange={handleDailyGoalChange}
            onBlur={handleDailyGoalBlur}
          />
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-study-days-heading">
        <h2 id="settings-study-days-heading" className="settings-heading">
          {t('settings.studyDays')}
        </h2>
        {hasProfile ? (
          <div className="settings-field">
            <label htmlFor="study-days">{t('settings.studyDays')}</label>
            <select
              id="study-days"
              value={String(selectedStudyDays)}
              onChange={handleStudyDaysChange}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                <option key={days} value={String(days)}>
                  {t('settings.studyDays.value', { days })}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="settings-note" data-testid="settings-no-profile">
            {t('settings.noProfile')}
          </p>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-tts-heading">
        <h2 id="settings-tts-heading" className="settings-heading">
          {t('settings.tts.enabled')}
        </h2>
        <div className="settings-field settings-checkbox-field">
          <label htmlFor="tts-enabled">{t('settings.tts.enabled')}</label>
          <input
            id="tts-enabled"
            type="checkbox"
            checked={ttsEnabled}
            disabled={!ttsAvailable}
            onChange={handleTtsChange}
          />
        </div>
        {!ttsAvailable && (
          <p className="settings-note" data-testid="settings-tts-unavailable">
            {t('settings.tts.unavailable')}
          </p>
        )}
      </section>

      <section className="settings-section settings-llm" aria-labelledby="settings-llm-heading">
        <h2 id="settings-llm-heading" className="settings-heading">
          {t('settings.llm')}
        </h2>
        <div className="settings-field">
          <label htmlFor="llm-url">接続先 URL</label>
          <input id="llm-url" type="url" disabled />
        </div>
        <div className="settings-field">
          <label htmlFor="llm-model">モデル名</label>
          <input id="llm-model" type="text" disabled />
        </div>
        <p className="settings-note settings-llm-note">この機能は後で追加されます</p>
      </section>

      <p className="settings-saved" aria-live="polite" data-testid="settings-saved">
        {savedVisible ? t('settings.saved') : ''}
      </p>

      <Link className="debug-link" to={ROUTES.debug}>
        debug
      </Link>
    </div>
  )
}
