// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { setOnboarded } from '../app/onboarding'
import { buildWordStats, WORD_STATES } from '../app/wordStats'
import { createTranslator, I18nProvider } from '../i18n'
import { StudyDataSchema } from '../schema'
import { ROUTES } from '../routes'
import { useAppState } from '../state/appState'
import { WordsPage } from './WordsPage'

const t = createTranslator('ja')
const now = '2026-11-15T03:00:00.000Z'
function makeData() {
  const word = (id: string) => ({
    id,
    lemma: id,
    reading: `read-${id}`,
    pos: 'noun',
    meaning: [`meaning-${id}`],
  })
  const record = (due: string) => ({
    due,
    stability: 12.4,
    difficulty: 3,
    elapsedDays: 0,
    scheduledDays: 2,
    reps: 3,
    lapses: 2,
    state: 2,
  })
  return StudyDataSchema.parse({
    format: 'lang-study-data',
    version: 1,
    meta: { exportedAt: now, appVersion: '0.1.0' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'en',
      goal: { dailyMinutes: 30, studyDaysPerWeek: 7, targetLevel: 'A1', deadline: '2026-12-15' },
    },
    plan: {
      units: [
        { id: 'u1', title: 'First', canDo: 'Greet', itemEstimate: 4 },
        { id: 'u2', title: 'Second', canDo: 'Order', itemEstimate: 3 },
        { id: 'empty', title: 'Empty', canDo: 'Wait', itemEstimate: 0 },
      ],
    },
    content: {
      units: {
        u1: { generatedBy: { tool: 'test', at: now }, words: [word('unseen'), word('mature')] },
        u2: { generatedBy: { tool: 'test', at: now }, words: [word('due')] },
      },
    },
    progress: { fsrs: { mature: record('2026-11-17T03:00:00.000Z'), due: record(now) } },
  })
}
function check(input: unknown, expected: unknown, actual: unknown) {
  expect(
    actual,
    `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}
function show() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.words]}>
      <I18nProvider initialLanguage="ja">
        <Routes>
          <Route path={ROUTES.words} element={<WordsPage />} />
          <Route path={ROUTES.intro} element={<p>Intro</p>} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
  localStorage.clear()
  useAppState.setState({
    status: 'ready',
    data: makeData(),
    reload: vi.fn(async () => {}),
    lastBackupAt: null,
  })
})
afterEach(() => vi.useRealTimers())

describe('WordsPage', () => {
  it.each(['loading', 'error'] as const)('shows %s and reloads', (status) => {
    useAppState.setState({ status })
    show()
    check(
      status,
      true,
      screen.queryByText(t(status === 'loading' ? 'common.loading' : 'common.error')) !== null,
    )
    check('mount', 1, vi.mocked(useAppState.getState().reload).mock.calls.length)
  })
  it.each([false, true])('follows the home flow for null data, onboarded=%s', (onboarded) => {
    useAppState.setState({ data: null })
    setOnboarded(onboarded)
    show()
    if (onboarded)
      check(
        { onboarded, data: null },
        ROUTES.welcome,
        screen.getByRole('link').getAttribute('href'),
      )
    else check({ onboarded, data: null }, 'Intro', screen.getByText('Intro').textContent)
  })
  it('shows only the empty message and data link for zero words', () => {
    const data = makeData()
    data.content.units = {}
    useAppState.setState({ data })
    show()
    check('zero words', true, screen.queryByText(t('words.empty')) !== null)
    check('zero words', ROUTES.data, screen.getByRole('link').getAttribute('href'))
    check('zero words', 0, screen.queryAllByRole('button').length)
  })
  it('shows four accurate cards and a labelled bar without status', () => {
    const data = makeData()
    const stats = buildWordStats(data, new Date(now))
    const { container } = show()
    check(
      { data, now },
      [String(stats.seen), String(stats.mature), String(stats.dueNow), '7'],
      Array.from(container.querySelectorAll('.words-card strong'), (node) => node.textContent),
    )
    check(
      'target=7, seen=2',
      true,
      screen.queryByText(t('words.stat.remaining', { count: 5 })) !== null,
    )
    check(
      'total=3',
      true,
      screen.queryByText(t('words.stat.seenOf', { total: stats.total })) !== null,
    )
    const bar = screen.getByRole('img')
    check(
      stats.counts,
      t('words.bar.label') +
        ': ' +
        WORD_STATES.map((state) => `${t(`words.state.${state}`)} ${stats.counts[state]}`).join(
          ', ',
        ),
      bar.getAttribute('aria-label'),
    )
    check('three nonzero states', 3, bar.children.length)
    check('bar and detail', 0, container.querySelectorAll('[role="status"], [aria-live]').length)
    check('unselected', true, screen.queryByText(t('words.detail.hint')) !== null)
  })
  it('shows reached when target is no greater than seen', () => {
    const data = makeData()
    data.plan.units.forEach((unit) => {
      unit.itemEstimate = 0
    })
    useAppState.setState({ data })
    show()
    check('target=0, seen=2', true, screen.queryByText(t('words.stat.reached')) !== null)
  })
  it('toggles state filters, resets with all, and combines unit filters', async () => {
    const user = userEvent.setup()
    const { container } = show()
    const mature = screen.getByRole('button', { name: '定着 1' })
    await user.click(mature)
    check('mature filter', 'true', mature.getAttribute('aria-pressed'))
    check(
      'mature filter',
      ['unseen', 'due'],
      Array.from(container.querySelectorAll('[data-dim="true"]'), (node) => node.textContent),
    )
    check('mature filter', true, screen.queryByText(t('words.filter.count', { count: 1 })) !== null)
    await user.click(mature)
    check('toggle off', 0, container.querySelectorAll('[data-dim]').length)
    await user.click(mature)
    await user.selectOptions(screen.getByLabelText(t('words.filter.unit')), 'u2')
    check('mature + u2', true, screen.queryByText(t('words.filter.count', { count: 0 })) !== null)
    await user.click(screen.getByRole('button', { name: 'すべて 3' }))
    check(
      'u2 only',
      ['unseen', 'mature'],
      Array.from(container.querySelectorAll('[data-dim="true"]'), (node) => node.textContent),
    )
    check(
      'nonempty units',
      ['すべて', 'u1: First', 'u2: Second'],
      screen.getAllByRole('option').map((node) => node.textContent),
    )
  })
  it('selects tiles with keyboard and shows details, dates and missing values', async () => {
    const user = userEvent.setup()
    const { container } = show()
    const tile = screen.getByRole('button', { name: 'mature 定着' })
    tile.focus()
    await user.keyboard('{Enter}')
    check('keyboard selection', 'true', tile.getAttribute('aria-pressed'))
    const detail = container.querySelector('.words-detail')!
    check(
      'selected mature',
      true,
      within(detail as HTMLElement).queryByRole('heading', { name: 'mature' }) !== null,
    )
    for (const text of ['meaning-mature', 'read-mature', '定着', '12日', '2日後', '2回', 'u1'])
      check('selected mature', true, within(detail as HTMLElement).queryByText(text) !== null)
    await user.click(screen.getByRole('button', { name: 'due 忘れかけ' }))
    check('due now', true, within(detail as HTMLElement).queryByText('今日') !== null)
    await user.click(screen.getByRole('button', { name: 'unseen 未学習' }))
    check('no record', 2, within(detail as HTMLElement).getAllByText('-').length)
    check(
      'selected detail and bar',
      0,
      container.querySelectorAll('[role="status"], [aria-live]').length,
    )
  })
})
