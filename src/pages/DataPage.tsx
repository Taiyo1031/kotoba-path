import { useT } from '../i18n'

export function DataPage() {
  const t = useT()
  return (
    <div className="page">
      <h1 className="page-title">{t('page.data')}</h1>
      <p className="page-description">学習データの取り込みや書き出し、バックアップを管理します。</p>
    </div>
  )
}
