import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT, useI18n } from '../i18n'
import { TARGET_LANGUAGES, DEFAULT_UI_LANGUAGE } from '../config/languages'
import { getToday } from '../app/clock'
import {
  PURPOSE_TAGS,
  LEVEL_OPTIONS,
  DAILY_MINUTES_OPTIONS,
  validateSurvey,
  buildProfile,
  createInitialStudyData,
  defaultDeadline,
} from '../app/survey'
import type { SurveyAnswers, SurveyField, PurposeTag } from '../app/survey'
import { getAppStore } from '../db'
import { useAppState } from '../state/appState'
import { ROUTES } from '../routes'
import '../styles/welcome.css'

const FIELDS_BY_STEP: Record<0 | 1 | 2, readonly SurveyField[]> = {
  0: ['targetLanguage'],
  1: ['purposeTags'],
  2: ['deadline', 'targetLevel', 'dailyMinutes'],
}

type PurposeTagLabelKey =
  | 'welcome.purpose.tag.travel'
  | 'welcome.purpose.tag.work'
  | 'welcome.purpose.tag.daily'
  | 'welcome.purpose.tag.localFriends'
  | 'welcome.purpose.tag.peers'

const PURPOSE_TAG_KEYS: Record<PurposeTag, PurposeTagLabelKey> = {
  travel: 'welcome.purpose.tag.travel',
  work: 'welcome.purpose.tag.work',
  daily: 'welcome.purpose.tag.daily',
  localFriends: 'welcome.purpose.tag.localFriends',
  peers: 'welcome.purpose.tag.peers',
}

export interface SurveyFormProps {
  answers: SurveyAnswers
  onChange: (next: SurveyAnswers) => void
  step: 0 | 1 | 2
  errors: Partial<Record<SurveyField, string>>
}

function stepErrorMessages(errors: Partial<Record<SurveyField, string>>): string[] {
  return Object.values(errors).filter(
    (message): message is string => typeof message === 'string' && message.length > 0,
  )
}

function StepErrorAlert({ errors }: { errors: Partial<Record<SurveyField, string>> }) {
  const messages = stepErrorMessages(errors)
  if (messages.length === 0) {
    return null
  }
  return (
    <div className="welcome-error" role="alert">
      {messages.join(' ')}
    </div>
  )
}

export function SurveyForm({ answers, onChange, step, errors }: SurveyFormProps) {
  const t = useT()
  const uiLanguage = useI18n().language ?? DEFAULT_UI_LANGUAGE

  if (step === 0) {
    return (
      <section className="welcome-step" aria-label={t('welcome.step.language')}>
        <h2 className="welcome-step-title">{t('welcome.step.language')}</h2>
        <fieldset className="welcome-fieldset">
          <legend className="welcome-legend">{t('welcome.language.label')}</legend>
          <div className="welcome-options">
            {TARGET_LANGUAGES.map((language) => (
              <label key={language.code} className="welcome-option">
                <input
                  type="radio"
                  name="targetLanguage"
                  value={language.code}
                  checked={answers.targetLanguage === language.code}
                  onChange={() => onChange({ ...answers, targetLanguage: language.code })}
                />
                {language.names[uiLanguage]}
              </label>
            ))}
          </div>
        </fieldset>
        <StepErrorAlert errors={errors} />
      </section>
    )
  }

  if (step === 1) {
    return (
      <section className="welcome-step" aria-label={t('welcome.step.purpose')}>
        <h2 className="welcome-step-title">{t('welcome.step.purpose')}</h2>
        <fieldset className="welcome-fieldset">
          <legend className="welcome-legend">{t('welcome.purpose.label')}</legend>
          <div className="welcome-options">
            {PURPOSE_TAGS.map((tag) => (
              <label key={tag} className="welcome-option">
                <input
                  type="checkbox"
                  name="purposeTags"
                  value={tag}
                  checked={answers.purposeTags.includes(tag)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...answers.purposeTags, tag]
                      : answers.purposeTags.filter((value) => value !== tag)
                    onChange({ ...answers, purposeTags: next })
                  }}
                />
                {t(PURPOSE_TAG_KEYS[tag])}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="welcome-field">
          <span>{t('welcome.purpose.free')}</span>
          <input
            type="text"
            value={answers.purposeText}
            placeholder={t('welcome.purpose.placeholder')}
            onChange={(event) => onChange({ ...answers, purposeText: event.target.value })}
          />
        </label>
        <StepErrorAlert errors={errors} />
      </section>
    )
  }

  return (
    <section className="welcome-step" aria-label={t('welcome.step.goal')}>
      <h2 className="welcome-step-title">{t('welcome.step.goal')}</h2>
      <label className="welcome-field">
        <span>{t('welcome.goal.deadline')}</span>
        <input
          type="date"
          value={answers.deadline}
          onChange={(event) => onChange({ ...answers, deadline: event.target.value })}
        />
      </label>
      <fieldset className="welcome-fieldset">
        <legend className="welcome-legend">{t('welcome.goal.level')}</legend>
        <div className="welcome-options">
          {LEVEL_OPTIONS.map((option) => (
            <label key={option.cefr} className="welcome-option">
              <input
                type="radio"
                name="targetLevel"
                value={option.cefr}
                checked={answers.targetLevel === option.cefr}
                onChange={() => onChange({ ...answers, targetLevel: option.cefr })}
              />
              {t(option.labelKey)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="welcome-fieldset">
        <legend className="welcome-legend">{t('welcome.goal.dailyMinutes')}</legend>
        <div className="welcome-options">
          {DAILY_MINUTES_OPTIONS.map((minutes) => (
            <label key={minutes} className="welcome-option">
              <input
                type="radio"
                name="dailyMinutes"
                value={String(minutes)}
                checked={answers.dailyMinutes === minutes}
                onChange={() => onChange({ ...answers, dailyMinutes: minutes })}
              />
              {t('welcome.minutes', { minutes })}
            </label>
          ))}
        </div>
      </fieldset>
      <StepErrorAlert errors={errors} />
    </section>
  )
}

export function WelcomePage() {
  const t = useT()
  const uiLanguage = useI18n().language ?? DEFAULT_UI_LANGUAGE
  const navigate = useNavigate()

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [answers, setAnswers] = useState<SurveyAnswers>(() => {
    const firstTarget = TARGET_LANGUAGES[0]
    return {
      targetLanguage: firstTarget?.code ?? 'ms',
      purposeTags: [],
      purposeText: '',
      deadline: defaultDeadline(getToday()),
      targetLevel: 'A2',
      dailyMinutes: 20,
    }
  })
  const [errors, setErrors] = useState<Partial<Record<SurveyField, string>>>({})
  const [saveError, setSaveError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void useAppState.getState().reload()
  }, [])

  function stepErrorsFromValidation(
    validation: ReturnType<typeof validateSurvey>,
    currentStep: 0 | 1 | 2,
  ): Partial<Record<SurveyField, string>> {
    const nextErrors: Partial<Record<SurveyField, string>> = {}
    for (const field of FIELDS_BY_STEP[currentStep]) {
      const message = validation.errors[field]
      if (message !== undefined) {
        nextErrors[field] = message
      }
    }
    return nextErrors
  }

  async function finish() {
    setSubmitting(true)
    setSaveError(false)
    try {
      const profile = buildProfile(answers, { uiLanguage })
      const data = createInitialStudyData(profile, new Date())
      await getAppStore().saveStudyData(data)
      await useAppState.getState().reload()
      navigate(ROUTES.data)
    } catch {
      setSaveError(true)
    } finally {
      setSubmitting(false)
    }
  }

  function handleNext() {
    if (submitting) {
      return
    }

    setSaveError(false)

    const validation = validateSurvey(answers, getToday())
    const stepErrors = stepErrorsFromValidation(validation, step)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }

    setErrors({})

    if (step === 0) {
      setStep(1)
      return
    }

    if (step === 1) {
      setStep(2)
      return
    }

    void finish()
  }

  function handleBack() {
    if (submitting || step === 0) {
      return
    }
    setErrors({})
    setSaveError(false)
    setStep((current) => (current === 2 ? 1 : 0))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter') {
      return
    }

    const target = event.target as HTMLElement | null
    if (!target) {
      return
    }

    if (target instanceof HTMLButtonElement) {
      return
    }

    if (target instanceof HTMLInputElement && target.type === 'text') {
      return
    }

    if (target instanceof HTMLTextAreaElement) {
      return
    }

    event.preventDefault()
    handleNext()
  }

  const isLastStep = step === 2

  return (
    <div className="page welcome-page" onKeyDown={handleKeyDown}>
      <h1 className="page-title">{t('welcome.title')}</h1>
      <p className="page-description">{t('welcome.intro')}</p>
      <p className="welcome-progress">{t('welcome.step.count', { current: step + 1, total: 3 })}</p>

      <SurveyForm answers={answers} onChange={setAnswers} step={step} errors={errors} />

      {saveError && (
        <div className="welcome-save-error" role="alert">
          {t('common.error')}
        </div>
      )}

      <div className="welcome-actions">
        {step > 0 && (
          <button
            type="button"
            className="button welcome-back"
            onClick={handleBack}
            disabled={submitting}
          >
            {t('common.back')}
          </button>
        )}
        <button
          type="button"
          className="button welcome-next"
          onClick={handleNext}
          disabled={submitting}
        >
          {isLastStep ? t('welcome.finish') : t('common.next')}
        </button>
      </div>
    </div>
  )
}
