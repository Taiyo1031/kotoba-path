import { useEffect, useRef } from 'react'
import type { JSX } from 'react'
import type { Judgement } from '../../engine/types'
import type { GrammarNote, Sentence } from '../../schema/content'
import { useT } from '../../i18n'
import '../../styles/lesson-card.css'

export function FeedbackBar(props: {
  judgement: Judgement
  grammarNotes: ReadonlyArray<GrammarNote>
  examples: ReadonlyArray<Sentence>
  onNext: () => void
}): JSX.Element {
  const { judgement, grammarNotes, examples, onNext } = props
  const t = useT()
  const nextRef = useRef<HTMLButtonElement>(null)

  // 正解/おしい/不正解のクラス
  const statusClass = judgement.correct
    ? 'lc-feedback-correct kp-anim-bounce'
    : judgement.close
      ? 'lc-feedback-close'
      : 'lc-feedback-incorrect kp-anim-shake'

  // 「次へ」ボタンにフォーカスを自動で当てる
  useEffect(() => {
    nextRef.current?.focus()
  }, [])

  // Enter はフォーカスの位置によらず document で拾う(アンマウント時に外す)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') {
        return
      }
      // 自ボタンで Enter を押したときの click と二重にしない
      if (event.target === nextRef.current) {
        event.preventDefault()
      }
      onNext()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onNext])

  return (
    <div className="lc-feedback">
      <div role="status" aria-live="polite" className={`lc-feedback-status ${statusClass}`}>
        {judgement.correct ? (
          <p className="lc-feedback-title">{t('lesson.correct')}</p>
        ) : judgement.close ? (
          <p className="lc-feedback-title">{t('lesson.close.hint')}</p>
        ) : (
          <>
            <p className="lc-feedback-title">{t('lesson.incorrect')}</p>
            <p className="lc-feedback-answer">
              {t('lesson.correctAnswer', { text: judgement.correctText })}
            </p>
          </>
        )}
        {judgement.hint !== undefined && <p className="lc-feedback-hint">{judgement.hint}</p>}
      </div>
      {grammarNotes.length > 0 && (
        <section>
          <h3 className="lc-section-title">{t('lesson.grammar')}</h3>
          {grammarNotes.map((note) => (
            <div key={note.id} className="lc-feedback-note">
              <p className="lc-feedback-note-title">{note.title}</p>
              <p className="lc-feedback-note-hint">{note.hint}</p>
            </div>
          ))}
        </section>
      )}
      {examples.length > 0 && (
        <section>
          <h3 className="lc-section-title">{t('lesson.example')}</h3>
          {examples.map((example) => (
            <div key={example.id} className="lc-feedback-example">
              <p className="lc-feedback-example-target">{example.target}</p>
              <p className="lc-feedback-example-meaning">{example.meaning}</p>
            </div>
          ))}
        </section>
      )}
      <button ref={nextRef} type="button" className="button lc-feedback-next" onClick={onNext}>
        {t('lesson.next')}
      </button>
    </div>
  )
}
