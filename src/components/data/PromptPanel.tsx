import { useState } from 'react'
import { useT } from '../../i18n'
import { useAppState } from '../../state/appState'
import { getToday } from '../../app/clock'
import { nextPromptAction } from '../../app/promptFlow'
import '../../styles/promptFlow.css'

async function copyPrompt(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function downloadPrompt(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function PromptPanel() {
  const t = useT()
  const data = useAppState((state) => state.data)
  const [mode, setMode] = useState<'' | 'skeleton' | 'unit'>('')
  const [unitId, setUnitId] = useState('')
  const [part, setPart] = useState<'' | 'A' | 'B'>('')
  const [message, setMessage] = useState('')

  const profile = data?.profile
  const units = data?.plan.units ?? []
  const action = nextPromptAction(data)
  const effectiveMode: 'skeleton' | 'unit' =
    mode !== '' ? mode : action.kind === 'unit' && units.length > 0 ? 'unit' : 'skeleton'
  const effectiveUnitId =
    unitId !== '' ? unitId : action.kind === 'unit' ? action.unitId : (units[0]?.id ?? '')
  const unit = units.find((entry) => entry.id === effectiveUnitId)

  let prompt = ''
  if (profile && data !== null) {
    const today = getToday()
    const goal = profile.goal
    const profileLines = [
      `ネイティブ言語: ${profile.nativeLanguage}`,
      `目標言語: ${profile.targetLanguage}`,
      `学習目標: 毎日${goal.dailyMinutes}分、週${goal.studyDaysPerWeek}日`,
      `レベル: ${goal.targetLevel}`,
      `期限: ${goal.deadline}`,
    ]

    if (effectiveMode === 'skeleton') {
      prompt = [
        '# 学習計画の骨組みを作るプロンプト',
        '',
        `今日の日付: ${today}`,
        ...profileLines,
        '',
        'この学習者向けの単元構成を設計してください。',
      ].join('\n')
    } else if (unit !== undefined) {
      const existingWordIds = Object.entries(data.content.units)
        .filter(([id]) => id !== unit.id)
        .flatMap(([, content]) => {
          if (!Array.isArray(content.words)) return []
          return content.words.map((word) => word.id)
        })

      prompt = [
        '# 単元の中身を作るプロンプト',
        '',
        `今日の日付: ${today}`,
        ...profileLines,
        `単元ID: ${unit.id}`,
        `単元タイトル: ${unit.title}`,
        `できること: ${unit.canDo}`,
        ...(part !== '' ? [`パート: ${part}`] : []),
        ...(existingWordIds.length > 0 ? [`既存の単語ID: ${existingWordIds.join(', ')}`] : []),
      ].join('\n')
    }
  }

  return (
    <section aria-labelledby="prompt-title">
      <h2 id="prompt-title">{t('data.prompt.title')}</h2>
      <div className="data-card">
        {!profile ? (
          <p>{t('data.profileRequired')}</p>
        ) : (
          <>
            <div className="flow-banner">
              <h3>{t('flow.title')}</h3>
              <p>
                {action.kind === 'skeleton'
                  ? t('flow.skeleton')
                  : action.kind === 'unit'
                    ? t('flow.unit', { title: action.title })
                    : t('flow.done')}
              </p>
              {(action.kind === 'unit' || action.kind === 'done') && (
                <p>{t('flow.progress', { done: action.prepared, total: action.total })}</p>
              )}
            </div>
            <div className="data-actions">
              {(['skeleton', 'unit'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={effectiveMode === value}
                  onClick={() => {
                    setMode(value)
                    setMessage('')
                  }}
                >
                  {t(`data.prompt.${value}`)}
                </button>
              ))}
            </div>
            {effectiveMode === 'unit' && (
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
                    {units.map((entry) => (
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
            <textarea id="prompt-preview" readOnly value={prompt} rows={14} />
            <div className="data-actions">
              <button
                disabled={!prompt}
                onClick={() => {
                  void copyPrompt(prompt).then((ok) =>
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
                    downloadPrompt(
                      `kotoba-path-prompt-${effectiveMode === 'skeleton' ? 'skeleton' : unit?.id}.md`,
                      prompt,
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
