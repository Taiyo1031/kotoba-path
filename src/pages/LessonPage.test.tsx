import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createTranslator, I18nProvider } from '../i18n'
import { StudyDataSchema } from '../schema'
import { useAppState } from '../state/appState'
import { LessonPage } from './LessonPage'

vi.mock('../db', () => ({ getAppStore: () => ({ saveProgress: vi.fn(), savePlan: vi.fn() }) }))
const t = createTranslator('ja')
const reload = vi.fn(async () => {})
function check(input: string, expected: unknown, actual: unknown) {
  expect(
    actual,
    `入力: ${input} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useAppState.setState({
    status: 'ready',
    reload,
    lastBackupAt: null,
    data: StudyDataSchema.parse({
      format: 'lang-study-data',
      version: 1,
      meta: { exportedAt: '2026-01-01T00:00:00Z', appVersion: '1' },
      profile: {
        uiLanguage: 'ja',
        nativeLanguage: 'ja',
        targetLanguage: 'ms',
        goal: { deadline: '2027-01-01', targetLevel: 'A1', dailyMinutes: 10 },
      },
      plan: { units: [{ id: 'u01', title: 'Unit', canDo: 'Learn' }] },
      progress: {},
      content: {
        units: {
          u01: {
            generatedBy: { tool: 'test', at: '2026-01-01T00:00:00Z' },
            words: Array.from({ length: 6 }, (_, i) => ({
              id: `w${i}`,
              lemma: `word${i}`,
              pos: 'noun',
              meaning: [`meaning${i}`],
            })),
            sentences: [0, 1].map((i) => ({
              id: `s${i}`,
              target: `example${i}`,
              meaning: `例${i}`,
              wordIds: [`w${i}`],
            })),
          },
        },
      },
    }),
  })
})
function mount(stepId: string) {
  return render(
    <I18nProvider initialLanguage="ja">
      <MemoryRouter initialEntries={[`/lesson/u01/${stepId}`]}>
        <Routes>
          <Route path="/lesson/:unitId/:stepId" element={<LessonPage />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}
describe('LessonPage', () => {
  it('loads the unit step and shows its first question', () => {
    mount('u01-b0-intro')
    check('first intro', 'word0', screen.getByRole('heading', { level: 2 }).textContent)
    check('reload', 1, reload.mock.calls.length)
    check(
      'back destination',
      '/unit/u01',
      screen.getByRole('link', { name: t('lesson.close') }).getAttribute('href'),
    )
  })
  it('shows not found and links home for an unknown step', async () => {
    mount('missing')
    check('missing step', true, screen.queryByText(t('lesson.notFound')) !== null)
    await userEvent.setup().click(screen.getByRole('link'))
    check('back home', true, screen.queryByText('Home') !== null)
  })
  it('shows loading without data', () => {
    useAppState.setState({ status: 'loading', data: null })
    mount('u01-b0-intro')
    check('loading', t('common.loading'), screen.getByRole('status').textContent)
  })
  it('uses a fixed seed for repeatable choices', () => {
    localStorage.setItem('kp.fixedSeed', 'fixed')
    const first = mount('u01-b0-recognize')
    const options = Array.from(
      document.querySelectorAll('.lq-option'),
      (option) => option.textContent,
    )
    first.unmount()
    mount('u01-b0-recognize')
    check(
      'same fixed seed',
      options,
      Array.from(document.querySelectorAll('.lq-option'), (option) => option.textContent),
    )
  })
})
