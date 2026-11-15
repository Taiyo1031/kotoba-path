import { useState } from 'react'
import { getToday } from '../app/clock'
import { DAILY_MINUTES_OPTIONS, LEVEL_OPTIONS } from '../app/survey'
import { getAppStore } from '../db'
import { useT } from '../i18n'
import type { Goal } from '../schema'
import { useAppState } from '../state/appState'
import { DeadlineField } from './DeadlineField'

export function GoalSettings() {
  const { data, reload } = useAppState()
  const t = useT()
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null)

  if (data === null) return null
  const { profile } = data

  async function saveGoal(change: Partial<Goal>) {
    setFeedback(null)
    try {
      await getAppStore().saveProfile({ ...profile, goal: { ...profile.goal, ...change } })
      await reload()
      setFeedback('saved')
    } catch {
      setFeedback('error')
    }
  }

  return (
    <section
      className="settings-section goal-settings"
      aria-labelledby="goal-title"
      onChangeCapture={() => setFeedback(null)}
      onClickCapture={() => setFeedback(null)}
    >
      <h2 id="goal-title">{t('goal.section.title')}</h2>
      <DeadlineField
        id="goal-deadline"
        label={t('welcome.goal.deadline')}
        value={profile.goal.deadline}
        today={getToday()}
        onChange={(deadline) => void saveGoal({ deadline })}
      />
      <fieldset>
        <legend>{t('welcome.goal.level')}</legend>
        <div className="goal-options">
          {LEVEL_OPTIONS.map((option) => (
            <label key={option.cefr} className="welcome-option">
              <input
                type="radio"
                name="goal-targetLevel"
                value={option.cefr}
                checked={profile.goal.targetLevel === option.cefr}
                onChange={() => void saveGoal({ targetLevel: option.cefr })}
              />
              {t(option.labelKey)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('welcome.goal.dailyMinutes')}</legend>
        <div className="goal-options">
          {DAILY_MINUTES_OPTIONS.map((minutes) => (
            <label key={minutes} className="welcome-option">
              <input
                type="radio"
                name="goal-dailyMinutes"
                value={String(minutes)}
                checked={profile.goal.dailyMinutes === minutes}
                onChange={() => void saveGoal({ dailyMinutes: minutes })}
              />
              {t('welcome.minutes', { minutes })}
            </label>
          ))}
        </div>
      </fieldset>
      {feedback === 'saved' && (
        <p className="goal-feedback" role="status">
          {t('goal.saved')}
        </p>
      )}
      {feedback === 'error' && <p role="alert">{t('goal.error')}</p>}
    </section>
  )
}
