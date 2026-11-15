import { useEffect, useRef } from 'react'
import type { JSX } from 'react'
import type { Sentence, Word } from '../../schema/content'
import { useT } from '../../i18n'
import '../../styles/lesson-card.css'

export function IntroCard(props: {
  word: Word
  sentences: ReadonlyArray<Sentence>
  related: ReadonlyArray<Word>
  onContinue: () => void
  onSpeak?: (text: string) => void
}): JSX.Element {
  const { word, sentences, related, onContinue, onSpeak } = props
  const t = useT()
  const continueRef = useRef<HTMLButtonElement>(null)

  // Enter はフォーカスの位置によらず document で拾う(アンマウント時に外す)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') {
        return
      }
      // 自ボタンで Enter を押したときの click と二重にしない
      if (event.target === continueRef.current) {
        event.preventDefault()
      }
      onContinue()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onContinue])

  return (
    <div className="lc-intro">
      <div className="lc-intro-head">
        <h2 className="lc-intro-lemma">{word.lemma}</h2>
        {word.reading !== '' && <span className="lc-intro-reading">{word.reading}</span>}
        <span className="lc-intro-pos">{word.pos}</span>
        {word.uncertain && <span className="lc-intro-badge">{t('home.unit.unverified')}</span>}
      </div>
      <section className="lc-intro-meaning">
        <h3 className="lc-section-title">{t('lesson.intro.meaning')}</h3>
        <p>{word.meaning.join('、')}</p>
      </section>
      {sentences.length > 0 && (
        <section>
          <h3 className="lc-section-title">{t('lesson.intro.example')}</h3>
          {sentences.map((sentence) => (
            <div key={sentence.id} className="lc-intro-sentence">
              <p className="lc-intro-sentence-target">{sentence.target}</p>
              <p className="lc-intro-sentence-meaning">{sentence.meaning}</p>
            </div>
          ))}
        </section>
      )}
      {related.length > 0 && (
        <section>
          <h3 className="lc-section-title">{t('lesson.intro.related')}</h3>
          <ul className="lc-intro-related">
            {related.map((item) => (
              <li key={item.id}>
                {item.lemma} — {item.meaning.join('、')}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="lc-intro-actions">
        {onSpeak !== undefined && (
          <button
            type="button"
            className="button lc-intro-audio"
            onClick={() => onSpeak(word.lemma)}
          >
            {t('lesson.audio')}
          </button>
        )}
        <button
          ref={continueRef}
          type="button"
          className="button lc-intro-continue"
          onClick={onContinue}
        >
          {t('lesson.intro.got')}
        </button>
      </div>
    </div>
  )
}
