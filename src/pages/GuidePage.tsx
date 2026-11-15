import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getToday } from '../app/clock'
import { buildGuideQuiz, isGuideQuizAvailable } from '../app/guideQuiz'
import type { GuideQuestion } from '../app/guideQuiz'
import { isOnboarded } from '../app/onboarding'
import { hasVoiceFor, speak } from '../app/tts'
import { hashSeed } from '../engine/rng'
import { useT } from '../i18n'
import { ROUTES } from '../routes'
import type { Guide } from '../schema'
import { useAppState } from '../state/appState'
import '../styles/guide.css'

function GuideQuiz({ guide }: { guide: Guide }) {
  const t = useT()
  const [round, setRound] = useState(0)
  const [questions, setQuestions] = useState<GuideQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const question = questions[index]
  const finished = questions.length > 0 && !question

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        !question ||
        selected !== null ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      )
        return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return
      const choice = ['1', '2', '3', '4'].indexOf(event.key)
      if (choice < 0) return
      event.preventDefault()
      setSelected(choice)
      if (choice === question.answerIndex) setCorrect((value) => value + 1)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [question, selected])

  function start(nextRound: number) {
    setRound(nextRound)
    setQuestions(buildGuideQuiz(guide, hashSeed(`${getToday()}:${nextRound}`), 5))
    setIndex(0)
    setSelected(null)
    setCorrect(0)
  }

  return (
    <section className="guide-quiz">
      <h2>{t('guide.quiz.title')}</h2>
      {!isGuideQuizAvailable(guide) ? (
        <p>{t('guide.quiz.tooFew')}</p>
      ) : finished ? (
        <>
          <p>{t('guide.quiz.result', { correct, total: questions.length })}</p>
          <button type="button" className="button" onClick={() => start(round + 1)}>
            {t('guide.quiz.again')}
          </button>
        </>
      ) : question ? (
        <>
          <p>{t('guide.quiz.progress', { current: index + 1, total: questions.length })}</p>
          <h3>{t(`guide.quiz.q.${question.kind}`, { value: question.value })}</h3>
          <div className="guide-options">
            {question.options.map((option, optionIndex) => (
              <button
                type="button"
                key={option}
                className={`button guide-option${selected !== null && optionIndex === question.answerIndex ? ' guide-option--success' : selected === optionIndex ? ' guide-option--danger' : ''}`}
                disabled={selected !== null}
                onClick={() => {
                  if (selected !== null) return
                  setSelected(optionIndex)
                  if (optionIndex === question.answerIndex) setCorrect((value) => value + 1)
                }}
              >
                <span aria-hidden="true">{optionIndex + 1}</span>
                <span>{option}</span>
              </button>
            ))}
          </div>
          {selected !== null && (
            <>
              <p
                role="status"
                className={`guide-feedback guide-feedback--${selected === question.answerIndex ? 'success' : 'danger'}`}
              >
                {selected === question.answerIndex
                  ? t('guide.quiz.correct')
                  : t('guide.quiz.wrong', { answer: question.options[question.answerIndex] ?? '' })}
              </p>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setIndex(index + 1)
                  setSelected(null)
                }}
              >
                {t(index === questions.length - 1 ? 'guide.quiz.finish' : 'guide.quiz.next')}
              </button>
            </>
          )}
        </>
      ) : (
        <button type="button" className="button" onClick={() => start(round)}>
          {t('guide.quiz.start')}
        </button>
      )}
    </section>
  )
}

export function GuidePage() {
  const t = useT()
  const { status, data, reload } = useAppState()
  useEffect(() => {
    void reload()
  }, [reload])
  if (status === 'loading') return <div className="page">{t('common.loading')}</div>
  if (status === 'error')
    return (
      <div className="page" role="alert">
        {t('common.error')}
      </div>
    )
  if (data === null) {
    if (!isOnboarded()) return <Navigate to={ROUTES.intro} replace />
    return (
      <div className="page">
        <p>{t('home.noProfile')}</p>
        <Link className="button" to={ROUTES.welcome}>
          {t('home.noProfile.action')}
        </Link>
      </div>
    )
  }
  const guide = data.content.guide
  const language = data.profile.targetLanguage
  const voiceAvailable = guide ? hasVoiceFor(language) : false
  return (
    <div className="page guide-page">
      <h1 className="page-title">{t('page.guide')}</h1>
      {!guide ? (
        <>
          <p>{t('guide.empty')}</p>
          <Link className="button" to={ROUTES.data}>
            {t('guide.empty.action')}
          </Link>
        </>
      ) : (
        <>
          {guide.intro !== '' && <p>{guide.intro}</p>}
          {!voiceAvailable && <p className="guide-note">{t('guide.speak.unavailable')}</p>}
          <section>
            <h2>{t('guide.sounds.title')}</h2>
            <div className="guide-sounds">
              {guide.sounds.map((sound) => {
                const names = sound.confusableWith
                  .flatMap((id) => {
                    const other = guide.sounds.find((candidate) => candidate.id === id)
                    return other ? [other.grapheme] : []
                  })
                  .join('、')
                return (
                  <article className="guide-sound" key={sound.id}>
                    <div className="guide-sound-heading">
                      <strong>{sound.grapheme}</strong>
                      <span>{sound.reading}</span>
                    </div>
                    {sound.ipa !== '' && <p>{t('guide.ipa', { ipa: sound.ipa })}</p>}
                    {sound.note !== '' && <p>{sound.note}</p>}
                    {names !== '' && <p>{t('guide.confusable', { names })}</p>}
                    {sound.examples.length > 0 && (
                      <ul>
                        {sound.examples.map((example, exampleIndex) => (
                          <li key={exampleIndex}>
                            <span>
                              {example.target}
                              {example.reading !== '' && ` (${example.reading})`}
                            </span>{' '}
                            <span>{example.meaning}</span>{' '}
                            {voiceAvailable && (
                              <button
                                type="button"
                                className="button"
                                aria-label={t('guide.speak.label', { text: example.target })}
                                onClick={() => speak(example.target, language)}
                              >
                                {t('guide.speak')}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
          {guide.rules.length > 0 && (
            <section>
              <h2>{t('guide.rules.title')}</h2>
              {guide.rules.map((rule) => (
                <article key={rule.id}>
                  <h3>{rule.title}</h3>
                  <p>{rule.body}</p>
                </article>
              ))}
            </section>
          )}
          <GuideQuiz guide={guide} />
        </>
      )}
    </div>
  )
}
