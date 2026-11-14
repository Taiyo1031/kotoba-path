import { useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, JSX } from 'react'
import { useT } from '../../i18n'
import type { QuestionViewProps } from './types'
import type { TypingQuestion } from '../../engine/types'
import '../../styles/lesson-input.css'

const SLOW_MS = 20_000

export function TypingView(props: QuestionViewProps<TypingQuestion>): JSX.Element {
  const { question, disabled, judgement, onSubmit } = props
  const t = useT()
  const [value, setValue] = useState('')
  const [usedHint, setUsedHint] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const startedAtRef = useRef<number | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setValue(next)
    if (next.trim() !== '' && startedAtRef.current === null) {
      startedAtRef.current = Date.now()
    }
  }

  const submit = () => {
    if (disabled) return
    const text = value.trim()
    if (text === '') return
    const startedAt = startedAtRef.current
    const slow = startedAt !== null && Date.now() - startedAt > SLOW_MS
    onSubmit({ kind: 'text', text }, { usedHint, slow })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  const revealHint = () => {
    if (disabled) return
    setHintVisible(true)
    setUsedHint(true)
  }

  const hintPreview =
    question.answer.length > 0
      ? question.answer.charAt(0) + '_'.repeat(Math.max(0, question.answer.length - 1))
      : ''

  const inputClass = [
    'li-input',
    judgement ? (judgement.correct ? 'li-input-success' : 'li-input-danger') : '',
    judgement ? (judgement.correct ? 'kp-anim-bounce' : 'kp-anim-shake') : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="li-view">
      <h2 className="li-heading">{t('lesson.translate')}</h2>
      <p className="li-prompt">{question.prompt}</p>
      <label className="li-label" htmlFor="li-typing-input">
        {t('lesson.answer.placeholder')}
      </label>
      <input
        id="li-typing-input"
        className={inputClass}
        value={value}
        placeholder={t('lesson.answer.placeholder')}
        autoFocus
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className="li-actions">
        <button type="button" className="button li-hint" onClick={revealHint} disabled={disabled}>
          {t('lesson.hint')}
        </button>
        <button
          type="button"
          className="button li-check"
          onClick={submit}
          disabled={disabled || value.trim() === ''}
        >
          {t('lesson.check')}
        </button>
      </div>
      {hintVisible && (
        <p className="li-hint-text" aria-live="polite">
          {hintPreview}
        </p>
      )}
      {judgement?.close && (
        <div className="li-close-hint" aria-live="polite">
          <span>{t('lesson.close.hint')}</span>
          {judgement.hint ? <span> {judgement.hint}</span> : null}
        </div>
      )}
    </section>
  )
}
