import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createTranslator, I18nProvider } from '../i18n'
import { isOnboarded } from '../app/onboarding'
import { StudyDataSchema } from '../schema'
import { useAppState } from '../state/appState'
import { ROUTES } from '../routes'
import { IntroPage } from './IntroPage'

const t = createTranslator('ja')

function renderIntro() {
  return render(
    <I18nProvider initialLanguage="ja">
      <MemoryRouter initialEntries={[ROUTES.intro]}>
        <Routes>
          <Route path={ROUTES.intro} element={<IntroPage />} />
          <Route path={ROUTES.welcome} element={<p>welcome-route</p>} />
          <Route path={ROUTES.data} element={<p>data-route</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

function expectValue(actual: unknown, expected: unknown, input: string) {
  expect(
    actual,
    `入力: ${input} / 期待値: ${JSON.stringify(expected)} / 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function expectCard(card: 1 | 2 | 3, input: string) {
  const progress = `${card} / 3`
  expectValue(
    {
      title: screen.queryByRole('heading', { level: 1 })?.textContent,
      cards: screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
      bodyTag: screen.queryByText(t(`intro.card${card}.body`))?.tagName,
      progress: screen.queryByText(progress)?.textContent,
      buttons: screen.getAllByRole('button').map((button) => button.textContent),
      onboarded: isOnboarded(),
    },
    {
      title: t('intro.title'),
      cards: [t(`intro.card${card}.title`)],
      bodyTag: 'P',
      progress,
      buttons: [...(card > 1 ? ['戻る'] : []), card === 3 ? '始める' : '次へ', 'スキップ'],
      onboarded: false,
    },
    input,
  )
}

function expectFinished(destination: 'welcome-route' | 'data-route', input: string) {
  expectValue(
    {
      onboarded: isOnboarded(),
      destination: screen.queryByText(destination)?.textContent,
      introTitle: screen.queryByRole('heading', { name: t('intro.title') })?.textContent ?? null,
    },
    { onboarded: true, destination, introTitle: null },
    input,
  )
}

beforeEach(() => {
  localStorage.clear()
  useAppState.setState({
    status: 'ready',
    data: null,
    lastBackupAt: null,
    reload: async () => {},
  })
})

describe('IntroPage', () => {
  it('shows only the first card, progress and forward/skip buttons initially', () => {
    renderIntro()
    expectCard(1, '初回表示')
  })

  it('advances through three cards and returns to each previous card', async () => {
    const user = userEvent.setup()
    renderIntro()

    await user.click(screen.getByRole('button', { name: '次へ' }))
    expectCard(2, '1枚目から次へ')

    await user.click(screen.getByRole('button', { name: '次へ' }))
    expectCard(3, '2枚目から次へ')

    await user.click(screen.getByRole('button', { name: '戻る' }))
    expectCard(2, '3枚目から戻る')

    await user.click(screen.getByRole('button', { name: '戻る' }))
    expectCard(1, '2枚目から戻る')
  })

  it.each([1, 2, 3] as const)(
    'can skip from card %i and marks onboarding complete before showing welcome',
    async (card) => {
      const user = userEvent.setup()
      renderIntro()

      for (let current = 1; current < card; current += 1) {
        await user.click(screen.getByRole('button', { name: '次へ' }))
      }
      expectCard(card, `${card}枚目のスキップ前`)

      await user.click(screen.getByRole('button', { name: 'スキップ' }))
      expectFinished('welcome-route', `data=null、${card}枚目でスキップ`)
    },
  )

  it.each([
    { action: '始める', hasData: false },
    { action: '始める', hasData: true },
    { action: 'スキップ', hasData: true },
  ])('completes onboarding with $action when hasData=$hasData', async ({ action, hasData }) => {
    const user = userEvent.setup()
    if (hasData) {
      useAppState.setState({
        data: StudyDataSchema.parse({
          format: 'lang-study-data',
          version: 1,
          meta: { exportedAt: '2026-11-15T00:00:00Z', appVersion: '0.1.0' },
          profile: {
            uiLanguage: 'ja',
            nativeLanguage: 'ja',
            targetLanguage: 'ms',
            goal: { targetLevel: 'A2', deadline: '2027-03-31', dailyMinutes: 20 },
          },
          plan: { units: [] },
          progress: {},
        }),
      })
    }
    renderIntro()

    if (action === '始める') {
      await user.click(screen.getByRole('button', { name: '次へ' }))
      await user.click(screen.getByRole('button', { name: '次へ' }))
    }
    await user.click(screen.getByRole('button', { name: action }))

    expectFinished(hasData ? 'data-route' : 'welcome-route', `データあり=${hasData}、${action}`)
  })

  it.each(['スキップ', '始める'])(
    'allows %s while data is still loading and navigates to welcome',
    async (action) => {
      const user = userEvent.setup()
      useAppState.setState({ status: 'loading' })
      renderIntro()
      expectCard(1, 'status=loading、data=nullの初回表示')

      if (action === '始める') {
        await user.click(screen.getByRole('button', { name: '次へ' }))
        await user.click(screen.getByRole('button', { name: '次へ' }))
      }
      await user.click(screen.getByRole('button', { name: action }))

      expectFinished('welcome-route', `status=loading、data=null、${action}`)
    },
  )
})
