// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider, createTranslator } from '../../i18n'
import { parseImportText } from '../../io/importer'
import { buildFixPrompt } from '../../prompts'
import { StudyDataSchema, UnitEnvelopeSchema } from '../../schema'
import { useAppState } from '../../state/appState'
import { copyText } from '../../utils/clipboard'
import { ImportPanel } from './ImportPanel'

vi.mock('../../utils/clipboard', () => ({ copyText: vi.fn() }))

const t = createTranslator('ja')
const now = '2026-11-15T00:00:00.000Z'
const context = { targetLanguage: 'ms', planUnitIds: ['u01'], now }

function check(input: unknown, expected: unknown, actual: unknown) {
  expect(
    actual,
    `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function unitText(count = 15, uncertain = false) {
  return JSON.stringify(
    UnitEnvelopeSchema.parse({
      format: 'lang-study-unit',
      version: 1,
      unitId: 'u01',
      words: Array.from({ length: count }, (_, i) => ({
        id: `ms:word${i}`,
        lemma: `word${i}`,
        pos: 'noun',
        reading: i === 1 || i === 4 ? `よみ${i}` : '',
        meaning: [`意味${i}`, `別の意味${i}`],
        uncertain: uncertain && i === 2,
      })),
    }),
  )
}

async function validateText(input: string) {
  const user = userEvent.setup()
  const { container } = render(
    <MemoryRouter>
      <I18nProvider initialLanguage="ja">
        <ImportPanel />
      </I18nProvider>
    </MemoryRouter>,
  )
  const textarea = screen.getByRole('textbox', { name: t('data.paste') })
  await user.click(textarea)
  await user.paste(input)
  await user.click(screen.getByRole('button', { name: t('data.validate') }))
  return { user, container, textarea }
}

beforeEach(() => {
  vi.mocked(copyText).mockReset().mockResolvedValue(false)
  useAppState.setState({
    status: 'ready',
    data: StudyDataSchema.parse({
      format: 'lang-study-data',
      version: 1,
      meta: { exportedAt: now, appVersion: '0.1.0' },
      profile: {
        uiLanguage: 'ja',
        nativeLanguage: 'ja',
        targetLanguage: 'ms',
        goal: { targetLevel: 'A1', deadline: '2027-01-01', dailyMinutes: 20 },
      },
      plan: { units: [{ id: 'u01', title: '単元1', canDo: '挨拶できる' }] },
      progress: {},
    }),
    lastBackupAt: null,
    reload: async () => {},
  })
})

describe('ImportPanel', () => {
  it.each(['{"format":"lang-study-unit"}', 'JSONではない文字列'])(
    '壊れた入力から修正依頼をコピーし、失敗しても手動選択用の欄を残す: %s',
    async (input) => {
      const { user, container } = await validateText(input)
      const button = screen.queryByRole('button', { name: t('data.fix.button') })
      check(input, true, button !== null)
      await user.click(screen.getByRole('button', { name: t('data.fix.button') }))

      const prompt = container.querySelector<HTMLTextAreaElement>('textarea#fix-prompt')
      check(input, true, prompt !== null)
      check(input, true, prompt?.readOnly)
      check(input, 8, prompt?.rows)
      expect(prompt?.value, `入力: ${input}`).toContain('# JSONの修正依頼')
      expect(prompt?.value, `入力: ${input}`).toContain(input)
      const errors = parseImportText(input, context).issues
      for (const { path } of errors) {
        expect(prompt?.value, `入力: ${input}`).toContain(path)
      }
      check(input, buildFixPrompt({ issues: errors, originalText: input }), prompt?.value)
      check(input, [[prompt?.value, null]], vi.mocked(copyText).mock.calls)
      check(input, true, screen.queryByText(t('data.fix.title')) !== null)
      check(input, true, screen.queryByText(t('data.fix.hint')) !== null)
      check(input, 1, container.querySelectorAll('[aria-live="polite"]').length)

      await user.click(screen.getByRole('button', { name: t('data.fix.button') }))
      const secondCall = vi.mocked(copyText).mock.calls[1]
      check(input, prompt?.value, secondCall?.[0])
      check(input, true, secondCall?.[1] === prompt)
    },
  )

  it('エラーも警告もない入力では修正依頼ボタンを出さない', async () => {
    const input = unitText()
    check(
      input,
      { ok: true, issues: [] },
      {
        ok: parseImportText(input, context).ok,
        issues: parseImportText(input, context).issues,
      },
    )
    await validateText(input)
    check(input, null, screen.queryByRole('button', { name: t('data.fix.button') }))
    check(input, true, screen.queryByText(t('data.valid')) !== null)
  })

  it('警告だけの単元も先頭5語を表示し、読みと最初の意味と要確認を付ける', async () => {
    const input = unitText(6, true)
    const preview = parseImportText(input, context)
    check(input, true, preview.ok)
    check(input, true, preview.issues.length > 0)
    check(
      input,
      true,
      preview.issues.every((issue) => issue.severity === 'warning'),
    )
    const { container } = await validateText(input)
    check(input, null, screen.queryByRole('button', { name: t('data.fix.button') }))

    const summary = screen.queryByText(t('data.sample.title'))
    check(input, 'SUMMARY', summary?.tagName)
    const details = summary?.closest('details')
    check(input, true, details?.open)
    check(input, 1, details?.querySelectorAll('ul').length)
    const rows = Array.from(details?.querySelectorAll('li') ?? [])
    check(
      input,
      [
        'word0: 意味0',
        'word1 (よみ1): 意味1',
        `word2: 意味2${t('data.sample.uncertain')}`,
        'word3: 意味3',
        'word4 (よみ4): 意味4',
      ],
      rows.map((row) => row.textContent),
    )
    check(input, false, details?.textContent?.includes('word5'))
    const warning = rows[2]?.querySelector('span.data-warning')
    check(input, t('data.sample.uncertain'), warning?.textContent)
    check(input, 1, details?.querySelectorAll('span.data-warning').length)
    check(input, 1, container.querySelectorAll('[aria-live="polite"]').length)
  })

  it('語がない正常な単元にも開いたサンプル欄を表示する', async () => {
    const input = unitText(0)
    check(input, true, parseImportText(input, context).ok)
    await validateText(input)
    const details = screen.queryByText(t('data.sample.title'))?.closest('details')
    check(input, true, details?.open)
    check(input, 0, details?.querySelectorAll('li').length)
  })

  it('エラーと警告が混在すると修正依頼にはエラーだけを含め、サンプルを出さない', async () => {
    const input = unitText(6).replace('ms:word0', 'en:word0')
    const preview = parseImportText(input, context)
    check(input, false, preview.ok)
    check(
      input,
      true,
      preview.issues.some((issue) => issue.severity === 'warning'),
    )
    const { user, container } = await validateText(input)
    check(input, null, screen.queryByText(t('data.sample.title')))
    await user.click(screen.getByRole('button', { name: t('data.fix.button') }))
    const expected = buildFixPrompt({
      issues: preview.issues
        .filter((issue) => issue.severity === 'error')
        .map(({ path, message }) => ({ path, message })),
      originalText: input,
    })
    check(input, expected, container.querySelector<HTMLTextAreaElement>('#fix-prompt')?.value)
  })

  it('正常な骨組みには修正依頼ボタンと単元サンプルを出さない', async () => {
    const input = JSON.stringify({
      format: 'lang-study-skeleton',
      version: 1,
      units: [{ id: 'u01', title: '単元1', canDo: '挨拶できる' }],
    })
    await validateText(input)
    check(input, true, screen.queryByText(t('data.valid')) !== null)
    check(input, null, screen.queryByRole('button', { name: t('data.fix.button') }))
    check(input, null, screen.queryByText(t('data.sample.title')))
  })

  it.each(['再入力', '再検証'] as const)('%sで修正依頼プロンプトを消す', async (action) => {
    const input = '{"format":"lang-study-unit"}'
    const { user, container, textarea } = await validateText(input)
    await user.click(screen.getByRole('button', { name: t('data.fix.button') }))
    check({ input, action }, true, container.querySelector('#fix-prompt') !== null)
    if (action === '再入力') {
      await user.type(textarea, ' ')
    } else {
      await user.click(screen.getByRole('button', { name: t('data.validate') }))
    }
    check({ input, action }, null, container.querySelector('#fix-prompt'))
    check({ input, action }, null, screen.queryByText(t('data.fix.title')))
  })
})
