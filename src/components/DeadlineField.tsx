import { useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
import { useT } from '../i18n'
import {
  RELATIVE_MONTH_OPTIONS,
  checkDeadline,
  deadlineFromMonths,
  daysLeft,
  monthsLeft,
  nextDay,
} from '../app/goal'
import '../styles/deadline.css'

export interface DeadlineFieldProps {
  /** 入力欄に結びつける id の接頭辞(同じ画面に複数あっても重ならないように) */
  id: string
  /** 日付入力のラベルの文言(呼び出し側が渡す) */
  label: string
  /** 現在の期限(YYYY-MM-DD) */
  value: string
  /** 今日(YYYY-MM-DD)。呼び出し側が getToday() を渡す */
  today: string
  /** 期限が変わったとき(日付として完成したときだけ)に呼ぶ */
  onChange: (deadline: string) => void
}

export function DeadlineField(props: DeadlineFieldProps): JSX.Element {
  const { id, label, value, today, onChange } = props
  const t = useT()
  const [mode, setMode] = useState<'date' | 'relative'>('date')

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    if (newValue && checkDeadline(newValue, today) === 'ok') {
      onChange(newValue)
    }
  }

  const handleRelativeClick = (months: number) => {
    onChange(deadlineFromMonths(today, months))
  }

  const isDateMode = mode === 'date'
  const isValid = checkDeadline(value, today) === 'ok'

  return (
    <div className="deadline-field">
      <div className="deadline-options" role="group" aria-label={t('goal.deadline.mode.label')}>
        <button
          type="button"
          className="deadline-button"
          onClick={() => setMode('date')}
          aria-pressed={isDateMode}
        >
          {t('goal.deadline.modeDate')}
        </button>
        <button
          type="button"
          className="deadline-button"
          onClick={() => setMode('relative')}
          aria-pressed={!isDateMode}
        >
          {t('goal.deadline.modeRelative')}
        </button>
      </div>

      {isDateMode ? (
        <div className="deadline-date">
          <label htmlFor={`${id}-date`}>{label}</label>
          <input
            id={`${id}-date`}
            type="date"
            value={value}
            min={nextDay(today)}
            onChange={handleDateChange}
          />
        </div>
      ) : (
        <div className="deadline-options" role="group" aria-label={label}>
          {RELATIVE_MONTH_OPTIONS.map((months) => (
            <button
              key={months}
              type="button"
              className="deadline-button"
              onClick={() => handleRelativeClick(months)}
              aria-pressed={deadlineFromMonths(today, months) === value}
            >
              {t('goal.deadline.months', { months })}
            </button>
          ))}
        </div>
      )}

      {isValid ? (
        <p className="deadline-summary">
          {t('goal.deadline.preview', { date: value })}{' '}
          {t('goal.deadline.remaining', {
            days: daysLeft(today, value),
            months: monthsLeft(today, value),
          })}
        </p>
      ) : (
        <p role="alert">{t('goal.deadline.invalid')}</p>
      )}
    </div>
  )
}
