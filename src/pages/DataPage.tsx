import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { getAppStore, requestPersistentStorage } from '../db'
import type { PersistResult } from '../db'
import { useAppState } from '../state/appState'
import { BackupStatus } from '../components/data/BackupStatus'
import { PromptPanel } from '../components/data/PromptPanel'
import { ImportPanel } from '../components/data/ImportPanel'
import { ExportPanel } from '../components/data/ExportPanel'
import { RestorePanel } from '../components/data/RestorePanel'
import '../styles/data.css'
export function DataPage() {
  const t = useT()
  const { status, reload } = useAppState()
  const [persistence, setPersistence] = useState<PersistResult | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void reload()
    let active = true
    void requestPersistentStorage().then((result) => {
      if (active) setPersistence(result)
    })
    return () => {
      active = false
    }
  }, [reload])
  return (
    <div className="page data-page">
      <h1 className="page-title">{t('page.data')}</h1>
      <p className="page-description">{t('data.description')}</p>
      <small aria-live="polite">
        {persistence
          ? t(('data.persistence.' + persistence) as 'data.persistence.granted')
          : t('data.loading')}
      </small>
      <div aria-live="polite">
        {status === 'loading' && <p>{t('data.loading')}</p>}
        {status === 'error' && (
          <>
            <p className="data-error">{t('data.operationError')}</p>
            <button
              onClick={() => {
                void reload()
              }}
            >
              {t('data.retry')}
            </button>
          </>
        )}
      </div>
      <div className="data-sections" inert={status === 'loading' || busy}>
        <BackupStatus />
        <PromptPanel />
        <ImportPanel />
        <ExportPanel />
        <RestorePanel />
        <section aria-labelledby="reset-title">
          <h2 id="reset-title">{t('data.reset')}</h2>
          <div className="data-card">
            <button
              className="data-danger"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t('data.reset.confirm'))) return
                setBusy(true)
                void (async () => {
                  try {
                    await getAppStore().resetAll()
                    await reload()
                    setMessage(t('data.completed'))
                  } catch {
                    setMessage(t('data.operationError'))
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              {t('data.reset')}
            </button>
          </div>
        </section>
      </div>
      <p role="status">{message}</p>
    </div>
  )
}
