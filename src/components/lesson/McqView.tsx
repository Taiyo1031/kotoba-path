import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { McqQuestion } from '../../engine/types'
import { useT } from '../../i18n'
import type { QuestionViewProps } from './types'

import '../../styles/lesson-question.css'

interface SelectionState {
  key: string
  lastOptionId: string | null
  submitted: boolean
}

export function McqView(
  props: QuestionViewProps<McqQuestion> & { showReading?: boolean },
): JSX.Element {
  const { question, disabled, judgement, onSubmit, onSpeak, showReading = true } = props
  const t = useT()

  const options = question.options
  const questionKey = JSON.stringify({
    itemId: question.itemId,
    direction: question.direction,
    prompt: question.prompt,
    correctId: question.correctId,
    optionIds: options.map((option) => option.id),
  })

  const [selection, setSelection] = useState<SelectionState>(() => ({
    key: questionKey,
    lastOptionId: null,
    submitted: false,
  }))

  if (selection.key !== questionKey) {
    setSelection({ key: questionKey, lastOptionId: null, submitted: false })
  }

  const chooseOption = useCallback(
    (optionId: string) => {
      if (disabled || selection.submitted) return
      const option = options.find((candidate) => candidate.id === optionId)
      if (!option) return

      setSelection((prev) => ({ ...prev, lastOptionId: optionId, submitted: true }))
      onSubmit({ kind: 'choice', optionId })
    },
    [disabled, selection.submitted, options, onSubmit],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled || selection.submitted) return

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
  }, [disabled, selection.submitted, options, chooseOption])

  const showPrompt = question.direction !== 'audioToMeaning'
  const lastOptionId = selection.lastOptionId
  const submitted = selection.submitted

  return (
    <div className="lq-mcq">
      {showPrompt ? (
        <div className="lq-prompt-row">
          <div>
            <p className="lq-prompt">{question.prompt}</p>
            {showReading && question.promptReading ? (
              <p className="lq-reading">{question.promptReading}</p>
            ) : null}
          </div>
          {onSpeak && question.direction === 'foreignToNative' ? (
            <button
              type="button"
              className="button lq-audio-button"
              onClick={() => onSpeak(question.prompt)}
            >
              {t('lesson.audio')}
            </button>
          ) : null}
        </div>
      ) : null}

      {onSpeak && question.direction === 'audioToMeaning' ? (
        <button
          type="button"
          className="button lq-audio-button lq-audio-main"
          onClick={() => onSpeak(question.prompt)}
        >
          {t('lesson.audio')}
        </button>
      ) : null}

      <div className="lq-options">
        {options.map((option, index) => {
          const isSelected = lastOptionId === option.id
          const isCorrectShown = judgement !== null && option.id === question.correctId
          const isWrongSelected = judgement !== null && !judgement.correct && isSelected

          const classes = ['button', 'lq-option']
          if (isCorrectShown) classes.push('lq-option--success')
          if (isWrongSelected) classes.push('lq-option--danger')
          if (judgement?.correct && isSelected) classes.push('kp-anim-bounce')
          if (judgement !== null && !judgement.correct && isSelected) classes.push('kp-anim-shake')

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

      {judgement ? (
        <p className="lq-feedback">
          {judgement.correct ? t('lesson.correct') : t('lesson.incorrect')}
        </p>
      ) : null}
    </div>
  )
}
