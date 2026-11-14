import { useParams } from 'react-router-dom'
import { useT } from '../i18n'

export function UnitPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()

  return (
    <div className="page">
      <h1 className="page-title">{t('page.unit')}</h1>
      <p className="page-description">単元のステップと到達目標を確認します。</p>
      <dl className="page-params">
        <dt>単元ID</dt>
        <dd>{id}</dd>
      </dl>
    </div>
  )
}
