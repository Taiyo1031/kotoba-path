import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { setOnboarded } from '../app/onboarding'
import { useAppState } from '../state/appState'
import { ROUTES } from '../routes'
import '../styles/intro.css'

export function IntroPage() {
  const t = useT()
  const navigate = useNavigate()
  const data = useAppState((state) => state.data)
  const [currentCard, setCurrentCard] = useState<1 | 2 | 3>(1)

  useEffect(() => {
    void useAppState.getState().reload()
  }, [])

  function finish() {
    setOnboarded(true)
    navigate(data === null ? ROUTES.welcome : ROUTES.data)
  }

  return (
    <div className="page intro-page">
      <h1 className="page-title">{t('intro.title')}</h1>
      <p className="intro-progress" aria-live="polite">
        {t('intro.progress', { current: currentCard, total: 3 })}
      </p>

      <section className="intro-card" aria-labelledby="intro-card-title">
        <h2 id="intro-card-title">{t(`intro.card${currentCard}.title`)}</h2>
        <p>{t(`intro.card${currentCard}.body`)}</p>
      </section>

      <div className="intro-actions">
        {currentCard > 1 && (
          <button
            type="button"
            className="button intro-back"
            onClick={() => setCurrentCard((current) => (current === 3 ? 2 : 1))}
          >
            {t('intro.back')}
          </button>
        )}
        {currentCard < 3 ? (
          <button
            type="button"
            className="button intro-next"
            onClick={() => setCurrentCard((current) => (current === 1 ? 2 : 3))}
          >
            {t('intro.next')}
          </button>
        ) : (
          <button type="button" className="button intro-start" onClick={finish}>
            {t('intro.start')}
          </button>
        )}
        <button type="button" className="button intro-skip" onClick={finish}>
          {t('intro.skip')}
        </button>
      </div>
    </div>
  )
}
