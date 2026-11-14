import { useT } from '../i18n'

export function HomePage() {
  const t = useT()
  return (
    <div className="page">
      <h1 className="page-title">{t('page.home')}</h1>
      <p className="page-description">学習パスと今日の目標を確認します。</p>
    </div>
  )
}
