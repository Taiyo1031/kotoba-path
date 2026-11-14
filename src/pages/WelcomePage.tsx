import { useT } from '../i18n'

export function WelcomePage() {
  const t = useT()
  return (
    <div className="page">
      <h1 className="page-title">{t('page.welcome')}</h1>
      <p className="page-description">学習する言語や目的、目標を設定します。</p>
    </div>
  )
}
