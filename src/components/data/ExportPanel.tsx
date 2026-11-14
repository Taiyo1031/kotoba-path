import { useState } from 'react'
import { getAppStore } from '../../db'
import { useT } from '../../i18n'
import { recordBackup } from '../../io/backup'
import { collectWords, wordsToCsv } from '../../io/csv'
import { exportFileName, exportStudyDataJson } from '../../io/exporter'
import { useAppState } from '../../state/appState'
import { downloadTextFile } from '../../utils/download'
export function ExportPanel() {
  const t = useT()
  const { data, reload } = useAppState()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (kind: 'json' | 'csv') => {
    if (!data) return
    setBusy(true)
    try {
      const now = new Date()
      downloadTextFile(
        exportFileName(kind, now),
        kind === 'json'
          ? exportStudyDataJson({ ...data, meta: { ...data.meta, exportedAt: now.toISOString() } })
          : wordsToCsv(collectWords(data)),
        kind === 'json' ? 'application/json' : 'text/csv',
      )
      if (kind === 'json') {
        await recordBackup(getAppStore(), now)
        await reload()
      }
      setMessage(t('data.downloaded'))
    } catch {
      setMessage(t('data.operationError'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-labelledby="export-title">
      <h2 id="export-title">{t('data.export.title')}</h2>
      <div className="data-card">
        {!data && <p>{t('data.empty')}</p>}
        <div className="data-actions">
          <button
            disabled={!data || busy}
            onClick={() => {
              void run('json')
            }}
          >
            {t('data.export.json')}
          </button>
          <button
            disabled={!data || busy}
            onClick={() => {
              void run('csv')
            }}
          >
            {t('data.export.csv')}
          </button>
        </div>
        <p role="status">{message}</p>
      </div>
    </section>
  )
}
