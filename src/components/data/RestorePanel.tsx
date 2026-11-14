import { useState } from 'react'
import { getAppStore } from '../../db'
import { useT } from '../../i18n'
import { applyFullImport, parseFullImport } from '../../io/fullImport'
import type { FullImportResult } from '../../io/fullImport'
import { useAppState } from '../../state/appState'
export function RestorePanel() {
  const t = useT()
  const reload = useAppState((s) => s.reload)
  const [text, setText] = useState('')
  const [result, setResult] = useState<FullImportResult | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (value: string) => {
    setText(value)
    setResult(null)
    setMessage('')
  }
  const restore = async (mode: 'replace' | 'merge') => {
    if (
      !result?.ok ||
      !window.confirm(
        t(mode === 'replace' ? 'data.restore.replaceConfirm' : 'data.restore.mergeConfirm'),
      )
    )
      return
    setBusy(true)
    try {
      await applyFullImport(getAppStore(), result.data, mode)
      setResult(null)
      await reload()
      setMessage(t('data.completed'))
    } catch {
      setMessage(t('data.operationError'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-labelledby="restore-title">
      <h2 id="restore-title">{t('data.restore.title')}</h2>
      <div className="data-card" aria-busy={busy}>
        <label htmlFor="restore-file">{t('data.file')}</label>
        <input
          id="restore-file"
          type="file"
          accept=".json,.txt"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            update('')
            if (file) {
              setBusy(true)
              void file
                .text()
                .then(update)
                .catch(() => setMessage(t('data.operationError')))
                .finally(() => setBusy(false))
            }
          }}
        />
        <label htmlFor="restore-text">{t('data.paste')}</label>
        <textarea
          id="restore-text"
          rows={8}
          value={text}
          disabled={busy}
          onChange={(e) => update(e.target.value)}
        />
        <button
          disabled={!text.trim() || busy}
          onClick={() => {
            try {
              setResult(parseFullImport(text))
              setMessage('')
            } catch {
              setResult(null)
              setMessage(t('data.operationError'))
            }
          }}
        >
          {t('data.validate')}
        </button>
        <div aria-live="polite">
          {result && (
            <>
              <p>{t(result.ok ? 'data.valid' : 'data.invalid')}</p>
              {result.ok && (
                <p>
                  {t('data.count.units')}: {result.data.plan.units.length}
                </p>
              )}
              <ul>
                {(result.ok ? result.warnings : result.errors).map((issue, i) => (
                  <li className={'data-' + issue.severity} key={i}>
                    {t(issue.severity === 'error' ? 'data.error' : 'data.warning')}{' '}
                    <code>{issue.path}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p>{message}</p>
        </div>
        <div className="data-actions">
          <button
            className="data-danger"
            disabled={!result?.ok || busy}
            onClick={() => {
              void restore('replace')
            }}
          >
            {t('data.restore.replace')}
          </button>
          <button
            disabled={!result?.ok || busy}
            onClick={() => {
              void restore('merge')
            }}
          >
            {t('data.restore.merge')}
          </button>
        </div>
      </div>
    </section>
  )
}
