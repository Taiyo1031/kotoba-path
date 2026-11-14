import { useState } from 'react'
import { getAppStore } from '../../db'
import { useT } from '../../i18n'
import { commitImport, parseImportText } from '../../io/importer'
import type { ImportPreview } from '../../io/importer'
import type { StudyData } from '../../schema'
import { useAppState } from '../../state/appState'

export function ImportPanel() {
  const t = useT()
  const { data, reload } = useAppState()
  const [text, setText] = useState('')
  const [savedPreview, setPreview] = useState<ImportPreview | null>(null)
  const [validatedData, setValidatedData] = useState<StudyData | null>(null)
  const preview = validatedData === data ? savedPreview : null
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (value: string) => {
    setText(value)
    setPreview(null)
    setMessage('')
  }
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      setMessage(t('data.completed'))
    } catch {
      setMessage(t('data.operationError'))
    } finally {
      setBusy(false)
    }
  }
  const validate = () => {
    setValidatedData(data)
    const context = {
      targetLanguage: data?.profile.targetLanguage ?? '',
      planUnitIds: data?.profile && data.plan ? data.plan.units.map((u) => u.id) : [],
      existingPlan: data?.plan,
      unitIdsWithData: new Set([
        ...Object.keys(data?.content.units ?? {}),
        ...Object.keys(data?.progress.unitProgress ?? {}),
      ]),
      now: new Date().toISOString(),
    }
    try {
      const first = parseImportText(text, context)
      const id = first.kind === 'unit' ? first.unitId : ''
      setPreview(
        parseImportText(text, {
          ...context,
          existingContent: data?.content.units[id],
          otherWordIds: new Set(
            Object.entries(data?.content.units ?? {})
              .filter(([key]) => key !== id)
              .flatMap(([, c]) => c.words.map((w) => w.id)),
          ),
        }),
      )
      setMessage('')
    } catch {
      setPreview(null)
      setMessage(t('data.operationError'))
    }
  }
  const diffs =
    preview?.kind === 'skeleton'
      ? { units: preview.diff }
      : preview?.kind === 'unit'
        ? preview.diff
        : undefined
  return (
    <section aria-labelledby="import-title">
      <h2 id="import-title">{t('data.import')}</h2>
      <div className="data-card" aria-busy={busy}>
        <label htmlFor="import-file">{t('data.file')}</label>
        <input
          id="import-file"
          type="file"
          accept=".json,.txt"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            update('')
            if (file) void run(async () => update(await file.text()))
          }}
        />
        <label htmlFor="import-text">{t('data.paste')}</label>
        <textarea
          id="import-text"
          rows={8}
          value={text}
          disabled={busy}
          onChange={(e) => update(e.target.value)}
        />
        <button disabled={!text.trim() || busy} onClick={validate}>
          {t('data.validate')}
        </button>
        <div aria-live="polite">
          {preview && (
            <>
              <h3>
                {t(
                  preview.kind === 'skeleton'
                    ? 'data.prompt.skeleton'
                    : preview.kind === 'unit'
                      ? 'data.prompt.unit'
                      : 'data.invalid',
                )}
              </h3>
              {preview.kind !== 'invalid' && (
                <ul>
                  {Object.entries(preview.counts).map(([key, count]) => (
                    <li key={key}>
                      {t(('data.count.' + key) as 'data.count.units')}: {count}
                    </li>
                  ))}
                </ul>
              )}
              <ul>
                {preview.issues.map((issue, i) => (
                  <li className={'data-' + issue.severity} key={i}>
                    {t(issue.severity === 'error' ? 'data.error' : 'data.warning')}{' '}
                    <code>{issue.path}</code>: {issue.message}
                  </li>
                ))}
              </ul>
              {preview.ok && <p>{t('data.valid')}</p>}
              {diffs &&
                Object.entries(diffs).map(([key, diff]) => (
                  <details key={key}>
                    <summary>
                      {t('data.diff')} ({t(('data.count.' + key) as 'data.count.units')}):{' '}
                      {t('data.added')} {diff.added.length} / {t('data.removed')}{' '}
                      {diff.removed.length}
                    </summary>
                    <p>
                      {t('data.added')}: {diff.added.join(', ') || t('data.empty')}
                    </p>
                    <p>
                      {t('data.removed')}: {diff.removed.join(', ') || t('data.empty')}
                    </p>
                  </details>
                ))}
              {preview.kind === 'unit' && preview.rewrites.length > 0 && (
                <details>
                  <summary>
                    {t('data.rewrites')} ({preview.rewrites.length})
                  </summary>
                  <ul>
                    {preview.rewrites.map((r, i) => (
                      <li key={i}>
                        <code>{r.path}</code>: {r.from} → {r.to}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          <p>{message}</p>
        </div>
        {!data?.profile && <p>{t('data.profileRequired')}</p>}
        <button
          disabled={!preview?.ok || !data?.profile || busy}
          onClick={() => {
            if (preview?.ok)
              void run(async () => {
                await commitImport(preview, getAppStore(), new Date().toISOString())
                setPreview(null)
                await reload()
              })
          }}
        >
          {t('data.import.commit')}
        </button>
        <h3>{t('data.units')}</h3>
        {!Object.keys(data?.content.units ?? {}).length && <p>{t('data.empty')}</p>}
        <ul className="data-unit-list">
          {Object.entries(data?.content.units ?? {}).map(([id, content]) => (
            <li key={id}>
              <span>
                {id} {data?.plan.units.find((u) => u.id === id)?.title}
              </span>
              {content.words.some((w) => w.uncertain) && (
                <span className="data-warning">{t('data.uncertain')}</span>
              )}
              <button
                disabled={content.verified || busy}
                onClick={() => {
                  void run(async () => {
                    await getAppStore().saveUnitContent(id, { ...content, verified: true })
                    setPreview(null)
                    await reload()
                  })
                }}
              >
                {t(content.verified ? 'data.verified' : 'data.verify')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
