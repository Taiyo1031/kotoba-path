import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { FlashcardQuestion, PhraseSlotQuestion } from '../../engine/types'
import type { QuestionViewProps } from './types'
import { useT } from '../../i18n'
import '../../styles/lesson-card.css'

type Grade = 'again' | 'hard' | 'good' | 'easy'

const GRADES: ReadonlyArray<Grade> = ['again', 'hard', 'good', 'easy']

export function FlashcardView(
  props: QuestionViewProps<FlashcardQuestion | PhraseSlotQuestion>,
): JSX.Element {
  const { question, disabled, judgement, onSubmit, onSpeak } = props
  const t = useT()
  const [flipped, setFlipped] = useState(false)
  const submittedRef = useRef(false)
  const flipRef = useRef<HTMLButtonElement>(null)

  const front = question.format === 'flashcard' ? question.front : question.target
  const back = question.format === 'flashcard' ? question.back : question.meaning

  const submitGrade = useCallback(
    (grade: Grade) => {
      if (disabled || submittedRef.current) {
        return
      }
      submittedRef.current = true
      onSubmit({ kind: 'selfGrade', grade })
    },
    [disabled, onSubmit],
  )

  // Space/Enter で裏返す(裏返す前に採点はできない)
  useEffect(() => {
    if (flipped) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') {
        return
      }
      // 自ボタンで Enter を押したときの click と二重にしない
      if (event.target === flipRef.current) {
        event.preventDefault()
      }
      setFlipped(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [flipped])

  // 数字キー 1〜4 で左から順に採点(裏返した後に有効)
  useEffect(() => {
    if (!flipped || disabled) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1
      if (index < 0 || index >= GRADES.length) {
        return
      }
      const grade = GRADES[index]
      if (grade !== undefined) {
        submitGrade(grade)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [flipped, disabled, submitGrade])

  return (
    <div className={`lc-flashcard${flipped ? ' kp-anim-flip' : ''}`}>
      <div className="lc-flashcard-face">
        <p className="lc-flashcard-text">{flipped ? back : front}</p>
        {onSpeak !== undefined && (
          <button
            type="button"
            className="button lc-flashcard-audio"
            onClick={() => onSpeak(front)}
          >
            {t('lesson.audio')}
          </button>
        )}
      </div>
      {!flipped && (
        <button
          ref={flipRef}
          type="button"
          className="button lc-flashcard-flip"
          onClick={() => setFlipped(true)}
        >
          {t('lesson.flip')}
        </button>
      )}
      {flipped && (
        <div className="lc-flashcard-grades">
          {GRADES.map((grade, index) => (
            <button
              key={grade}
              type="button"
              className={`button lc-flashcard-grade${
                judgement?.selfGrade === grade ? ' lc-flashcard-grade-active' : ''
              }`}
              disabled={disabled}
              onClick={() => submitGrade(grade)}
            >
              {index + 1}. {t(`lesson.selfGrade.${grade}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
