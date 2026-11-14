import { useT } from '../i18n'

export function ReviewPage() {
  const t = useT()
  return (
    <div className="page">
      <h1 className="page-title">{t('page.review')}</h1>
      <p className="page-description">復習の時期を迎えた内容を確認します。</p>
    </div>
  )
}
