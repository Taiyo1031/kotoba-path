import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranslator, I18nProvider } from '../i18n'
import { ReviewPage } from './ReviewPage'
import { useAppState } from '../state/appState'
import { StudyDataSchema } from '../schema'
import type { StudyData } from '../schema'
import { saveSettings } from '../app/settings'
import { setVirtualDate } from '../app/clock'
import { newRecord } from '../engine/fsrsWrapper'
import { ROUTES } from '../routes'

const store = vi.hoisted(() => ({ saveProgress: vi.fn() }))
vi.mock('../db', () => ({ getAppStore: () => store }))
const t = createTranslator('ja')
const reload = vi.fn(async () => {})

function check(input: string, expected: unknown, actual: unknown) {
  expect(
    actual,
    `入力: ${input} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function makeData(dueCount = 3): StudyData {
  const words = Array.from({ length: 5 }, (_, index) => ({
    id: `w${index}`,
    lemma: `word${index}`,
    pos: 'noun',
    meaning: [`meaning${index}`],
  }))
  return StudyDataSchema.parse({
    format: 'lang-study-data',
    version: 1,
    meta: { exportedAt: '2026-01-01T00:00:00Z', appVersion: '1' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'ms',
      goal: { deadline: '2027-01-01', targetLevel: 'A1', dailyMinutes: 10 },
    },
    plan: { units: [{ id: 'u01', title: 'Unit', canDo: 'Learn', status: 'done' }] },
    progress: {
      fsrs: Object.fromEntries(
        words.map((word, index) => [
          word.id,
          newRecord(
            new Date(index < dueCount ? `2026-01-${14 - index}T00:00:00Z` : '2026-01-16T00:00:00Z'),
          ),
        ]),
      ),
    },
    content: {
      units: {
        u01: {
          generatedBy: { tool: 'test', at: '2026-01-01T00:00:00Z' },
          words,
        },
      },
    },
  })
}

function mount(data: StudyData | null = makeData(), status: 'ready' | 'loading' = 'ready') {
  useAppState.setState({ status, data, lastBackupAt: null, reload })
  return render(
    <I18nProvider initialLanguage="ja">
      <MemoryRouter initialEntries={[ROUTES.review]}>
        <ReviewPage />
      </MemoryRouter>
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  setVirtualDate('2026-01-15')
  saveSettings({ ttsEnabled: false })
})

describe('ReviewPage', () => {
  it('shows three due items and starts a question', async () => {
    const user = userEvent.setup()
    mount()
    check('due=3', true, screen.queryByText(t('review.due', { count: 3 })) !== null)
    check('mount', 1, reload.mock.calls.length)
    const start = screen.queryByRole('button', { name: t('review.start') })
    check('due=3: start button', true, start !== null)
    await user.click(start!)
    check('start: four choices', 4, document.querySelectorAll('.lq-option').length)
    check('earliest due item first', true, screen.queryByText('word2') !== null)
  })

  it('shows none and a home link when no items are due', () => {
    mount(makeData(0))
    check('due=0', true, screen.queryByText(t('review.none')) !== null)
    check('due=0: start', null, screen.queryByRole('button', { name: t('review.start') }))
    check(
      'due=0: back',
      ROUTES.home,
      screen.queryByRole('link', { name: t('unit.back') })?.getAttribute('href'),
    )
  })

  it('limits the summary to the daily goal', () => {
    saveSettings({ dailyGoal: 2 })
    mount()
    check('due=3, dailyGoal=2', true, screen.queryByText(t('review.due', { count: 2 })) !== null)
  })

  it('shows no profile and links to welcome', () => {
    mount(null)
    check('data=null', true, screen.queryByText(t('home.noProfile')) !== null)
    check('data=null: welcome', ROUTES.welcome, screen.queryByRole('link')?.getAttribute('href'))
  })

  it('shows the loading message', () => {
    mount(null, 'loading')
    check('status=loading', t('common.loading'), screen.queryByRole('status')?.textContent)
  })

  it('finishes the pseudo step and retains completion after reloading progress', async () => {
    const user = userEvent.setup()
    saveSettings({ dailyGoal: 1 })
    const data = makeData()
    mount(data)
    reload.mockImplementation(async () => {
      useAppState.setState({ status: 'ready', data: makeData(0) })
    })
    await user.click(screen.getByRole('button', { name: t('review.start') }))
    for (let index = 0; index < 10; index += 1) {
      if (screen.queryByRole('heading', { name: t('lesson.complete.title') })) break
      const input = screen.queryByRole('textbox')
      if (input) {
        await user.type(input, 'word2')
        await user.click(screen.getByRole('button', { name: t('lesson.check') }))
      } else {
        await user.click(screen.getByRole('button', { name: /meaning2|word2/ }))
      }
      await user.click(screen.getByRole('button', { name: t('lesson.next') }))
    }
    check(
      'dailyGoal=1: lesson.complete.title',
      true,
      screen.queryByRole('heading', { name: t('lesson.complete.title') }) !== null,
    )
    await waitFor(() =>
      check('review completion: save progress', 1, store.saveProgress.mock.calls.length),
    )
    check(
      'review completion: no due items after reload',
      true,
      screen.queryByRole('heading', { name: t('lesson.complete.title') }) !== null,
    )
  })
})
