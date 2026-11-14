import { useRef, useState } from 'react'
import { useI18n, useT } from '../../i18n'
import { getNativeLanguage, getTargetLanguage } from '../../config/languages'
import { buildSkeletonPrompt, buildUnitPrompt } from '../../prompts'
import { useAppState } from '../../state/appState'
import { copyText } from '../../utils/clipboard'
import { downloadTextFile } from '../../utils/download'

export function PromptPanel() {
  const t = useT()
  const { language } = useI18n()
  const data = useAppState((state) => state.data)
  const [mode, setMode] = useState('skeleton')
  const [unitId, setUnitId] = useState('')
  const [part, setPart] = useState<'' | 'A' | 'B'>('')
  const [message, setMessage] = useState('')
  const textarea = useRef<HTMLTextAreaElement>(null)
  const profile = data?.profile
  const unit = data?.plan.units.find((entry) => entry.id === unitId) ?? data?.plan.units[0]
  let prompt = ''
  if (profile) {
    const promptProfile = {
      ...profile.goal,
      targetLanguage: profile.targetLanguage,
      nativeLanguage: profile.nativeLanguage,
      targetLanguageName:
        getTargetLanguage(profile.targetLanguage)?.names[language] ?? profile.targetLanguage,
      nativeLanguageName:
        getNativeLanguage(profile.nativeLanguage)?.names[language] ?? profile.nativeLanguage,
    }
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    prompt =
      mode === 'skeleton'
        ? buildSkeletonPrompt({ profile: promptProfile, today })
        : unit
          ? buildUnitPrompt({
              profile: promptProfile,
              unit,
              ...(part ? { part } : {}),
              existingWordIds: Object.entries(data.content.units)
                .filter(([id]) => id !== unit.id)
                .flatMap(([, content]) => content.words.map((word) => word.id)),
            })
          : ''
  }
  return (
    <section aria-labelledby="prompt-title">
      <h2 id="prompt-title">{t('data.prompt.title')}</h2>
      <div className="data-card">
        {!profile ? (
          <p>{t('data.profileRequired')}</p>
        ) : (
          <>
            <div className="data-actions">
              {(['skeleton', 'unit'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value)
                    setMessage('')
                  }}
                >
                  {t(`data.prompt.${value}`)}
                </button>
              ))}
            </div>
            {mode === 'unit' && (
              <div className="data-actions">
                <label>
                  {t('data.prompt.selectUnit')}
                  <select
                    value={unit?.id ?? ''}
                    onChange={(event) => {
                      setUnitId(event.target.value)
                      setMessage('')
                    }}
                    disabled={!unit}
                  >
                    {!unit && <option value="">{t('data.empty')}</option>}
                    {data?.plan.units.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.id}: {entry.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('data.prompt.part')}
                  <select
                    value={part}
                    onChange={(event) => {
                      setPart(event.target.value as '' | 'A' | 'B')
                      setMessage('')
                    }}
                  >
                    <option value="">{t('data.prompt.noPart')}</option>
                    <option>A</option>
                    <option>B</option>
                  </select>
                </label>
              </div>
            )}
            <label htmlFor="prompt-preview">{t('data.preview')}</label>
            <textarea id="prompt-preview" ref={textarea} readOnly value={prompt} rows={14} />
            <div className="data-actions">
              <button
                disabled={!prompt}
                onClick={() => {
                  void copyText(prompt, textarea.current).then((ok) =>
                    setMessage(t(ok ? 'data.copied' : 'data.copyFallback')),
                  )
                }}
              >
                {t('data.copy')}
              </button>
              <button
                disabled={!prompt}
                onClick={() => {
                  try {
                    downloadTextFile(
                      `kotoba-path-prompt-${mode === 'skeleton' ? 'skeleton' : unit?.id}.md`,
                      prompt,
                      'text/markdown',
                    )
                    setMessage(t('data.downloaded'))
                  } catch {
                    setMessage(t('data.operationError'))
                  }
                }}
              >
                {t('data.download')}
              </button>
            </div>
          </>
        )}
        <p role="status">{message}</p>
      </div>
    </section>
  )
}
