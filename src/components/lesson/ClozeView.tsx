import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { ClozeQuestion } from '../../engine/types'
import { useT } from '../../i18n'
import type { QuestionViewProps } from './types'

import '../../styles/lesson-question.css'

interface ClozeState {
  key: string
  lastOptionId: string | null
  text: string
  submitted: boolean
}

export function ClozeView(props: QuestionViewProps<ClozeQuestion>): JSX.Element {
  const { question, disabled, judgement, onSubmit } = props
  const t = useT()

  const isChoice = question.mode === 'choice'
  const options = isChoice ? (question.options ?? []) : []
  const questionKey = JSON.stringify({
    itemId: question.itemId,
    sentenceId: question.sentenceId,
    before: question.before,
    after: question.after,
    mode: question.mode,
    answer: question.answer,
    correctId: question.correctId,
    optionIds: options.map((option) => option.id),
  })

  const [state, setState] = useState<ClozeState>(() => ({
    key: questionKey,
    lastOptionId: null,
    text: '',
    submitted: false,
  }))

  if (state.key !== questionKey) {
    setState({ key: questionKey, lastOptionId: null, text: '', submitted: false })
  }

  const chooseOption = useCallback(
    (optionId: string) => {
      if (!isChoice || disabled || state.submitted) return
      const option = options.find((candidate) => candidate.id === optionId)
      if (!option) return

      setState((prev) => ({ ...prev, lastOptionId: optionId, submitted: true }))
      onSubmit({ kind: 'choice', optionId })
    },
    [isChoice, disabled, state.submitted, options, onSubmit],
  )

  useEffect(() => {
    if (!isChoice || options.length === 0) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled || state.submitted) return

      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      const index = ['1', '2', '3', '4'].indexOf(event.key)
      if (index === -1) return

      const option = options[index]
      if (!option) return

      chooseOption(option.id)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isChoice, disabled, state.submitted, options, chooseOption])

  const submitText = useCallback(() => {
    if (disabled || state.submitted) return

    const value = state.text.trim()
    if (!value) return

    setState((prev) => ({ ...prev, submitted: true }))
    onSubmit({ kind: 'text', text: value })
  }, [disabled, state.submitted, state.text, onSubmit])

  const inputId = 'cloze-typing-input'
  const lastOptionId = state.lastOptionId
  const text = state.text
  const submitted = state.submitted

  const inputClasses = ['lq-input']
  if (judgement) {
    if (judgement.correct) {
      inputClasses.push('lq-input--success', 'kp-anim-bounce')
    } else {
      inputClasses.push('lq-input--danger', 'kp-anim-shake')
    }
  }

  return (
    <div className="lq-cloze">
      {isChoice ? (
        <p className="lq-instruction">{t('lesson.fill')}</p>
      ) : (
        <label className="lq-instruction" htmlFor={inputId}>
          {t('lesson.fill')}
        </label>
      )}

      <p className="lq-sentence">
        {question.before}
        <span className="lq-blank">____</span>
        {question.after}
      </p>

      {isChoice ? (
        <div className="lq-options">
          {options.map((option, index) => {
            const isSelected = lastOptionId === option.id
            const isCorrectShown = judgement !== null && option.id === question.correctId
            const isWrongSelected = judgement !== null && !judgement.correct && isSelected

            const classes = ['button', 'lq-option']
            if (isCorrectShown) classes.push('lq-option--success')
            if (isWrongSelected) classes.push('lq-option--danger')
            if (judgement?.correct && isSelected) classes.push('kp-anim-bounce')
            if (judgement !== null && !judgement.correct && isSelected)
              classes.push('kp-anim-shake')

            return (
              <button
                key={option.id}
                type="button"
                className={classes.join(' ')}
                disabled={disabled || submitted}
                onClick={() => chooseOption(option.id)}
              >
                <span className="lq-option-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{option.text}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="lq-typing-row">
          <input
            id={inputId}
            className={inputClasses.join(' ')}
            value={text}
            placeholder={t('lesson.answer.placeholder')}
            autoFocus
            autoCapitalize="off"
            autoComplete="off"
            disabled={disabled || submitted}
            onChange={(event) => {
              const value = event.target.value
              setState((prev) => (prev.submitted ? prev : { ...prev, text: value }))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitText()
              }
            }}
          />
          <button
            type="button"
            className="button lq-check-button"
            disabled={disabled || submitted}
            onClick={() => submitText()}
          >
            {t('lesson.check')}
          </button>
        </div>
      )}

      {judgement ? (
        <div className="lq-feedback" role="status" aria-live="polite">
          <p>{judgement.correct ? t('lesson.correct') : t('lesson.incorrect')}</p>
          {judgement.close ? (
            <div className="lq-hint">
              <span>{t('lesson.close.hint')}</span>
              {judgement.hint ? <span>{judgement.hint}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
