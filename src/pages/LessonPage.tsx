import { useParams } from 'react-router-dom'
import { useT } from '../i18n'

export function LessonPage() {
  const t = useT()
  const { unitId, stepId } = useParams<{ unitId: string; stepId: string }>()

  return (
    <div className="page">
      <h1 className="page-title">{t('page.lesson')}</h1>
      <p className="page-description">選択したステップのレッスンに取り組みます。</p>
      <dl className="page-params">
        <dt>単元ID</dt>
        <dd>{unitId}</dd>
        <dt>ステップID</dt>
        <dd>{stepId}</dd>
      </dl>
    </div>
  )
}
