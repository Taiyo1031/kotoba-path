// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { setOnboarded } from '../app/onboarding'
import { createTranslator, I18nProvider } from '../i18n'
import { StudyDataSchema } from '../schema'
import { ROUTES, unitPath } from '../routes'
import { useAppState } from '../state/appState'
import { HomePage } from './HomePage'

const t = createTranslator('ja')
const now = '2026-11-15T03:00:00.000Z'
function makeData() {
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
        { id: 'u1', title: 'First', canDo: 'Greet', status: 'inProgress' },
        { id: 'u2', title: 'Second', canDo: 'Order', optional: true },
        { id: 'u3', title: 'Third', canDo: 'Travel', status: 'done' },
      ],
    },
    content: {
      units: {
        u1: {
          generatedBy: { tool: 'test', at: now },
          words: [
            {
              id: 'w1',
              lemma: 'hello',
              pos: 'interjection',
              meaning: ['こんにちは'],
              uncertain: true,
            },
          ],
        },
      },
    },
    progress: { xp: 123, unitProgress: { u1: { completedStepIds: ['u1-b0-intro'] } } },
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
    <MemoryRouter initialEntries={['/']}>
      <I18nProvider initialLanguage="ja">
        <Routes>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.intro} element={<p>Intro page</p>} />
          <Route path={ROUTES.welcome} element={<p>{t('page.welcome')}</p>} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
  localStorage.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  )
  useAppState.setState({
    status: 'ready',
    data: makeData(),
    lastBackupAt: null,
    reload: async () => {},
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('HomePage', () => {
  it.each(['loading', 'error'] as const)('shows %s', (status) => {
    useAppState.setState({ status })
    show()
    check(
      status,
      true,
      screen.getByText(t(status === 'loading' ? 'common.loading' : 'common.error')) !== null,
    )
    if (status === 'error') check(status, 'alert', screen.getByRole('alert').getAttribute('role'))
  })
  it('shows the questionnaire link without a profile', async () => {
    useAppState.setState({ data: null })
    setOnboarded(true)
    show()
    check('null data', true, screen.getByText(t('home.noProfile')) !== null)
    const link = screen.getByRole('link', { name: t('home.noProfile.action') })
    check('null data', ROUTES.welcome, link.getAttribute('href'))
    await userEvent.setup().click(link)
  })
  it('shows three cards, loose links, badges, schedule and progress', () => {
    const data = makeData()
    data.plan.units[0]!.plannedStart = '2026-11-15'
    data.plan.units[0]!.plannedEnd = '2026-11-20'
    useAppState.setState({ data })
    show()
    check('three units', 3, screen.getAllByRole('article').length)
    check(
      'missing content',
      ROUTES.data,
      screen.getAllByRole('link', { name: t('home.unit.prepare') })[0]?.getAttribute('href'),
    )
    check(
      'one step done',
      unitPath('u1'),
      screen.getByRole('link', { name: t('home.unit.continue') }).getAttribute('href'),
    )
    check(
      'done unit',
      true,
      within(screen.getAllByRole('article')[2]!).getByText(t('home.unit.done')) !== null,
    )
    check(
      'progress',
      ['20', '0', '0'],
      screen.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-valuenow')),
    )
    check(
      'next unit',
      true,
      screen.getAllByRole('article')[0]?.classList.contains('home-unit-next'),
    )
    check('optional', true, screen.getByText(t('home.unit.optional')) !== null)
    check('uncertain', true, screen.getByText(t('home.unit.unverified')) !== null)
    check(
      'schedule',
      true,
      screen.getByText(t('unit.schedule', { start: '2026-11-15', end: '2026-11-20' })) !== null,
    )
  })
  it('allows starting content even when an earlier unit is unfinished', () => {
    const data = makeData()
    data.progress.unitProgress = {}
    data.plan.units.reverse()
    useAppState.setState({ data })
    show()
    check(
      'zero steps',
      unitPath('u1'),
      screen.getByRole('link', { name: t('home.unit.start') }).getAttribute('href'),
    )
  })
  it.each([null, now])('backup prompt for %s', (lastBackupAt) => {
    useAppState.setState({ lastBackupAt })
    show()
    check(
      { lastBackupAt },
      lastBackupAt === null,
      screen.queryByRole('link', { name: t('home.backup.action') }) !== null,
    )
    if (lastBackupAt === null)
      check(lastBackupAt, true, screen.getByText(t('data.backup.never')) !== null)
  })
  it('immediately shows final XP with reduced motion', () => {
    const { container } = show()
    check('reduced motion, XP=123', '123', container.querySelector('.home-xp')?.textContent)
    check(
      'media query',
      true,
      vi
        .mocked(window.matchMedia)
        .mock.calls.some(([query]) => query === '(prefers-reduced-motion: reduce)'),
    )
  })
  it('counts XP from zero over about 600ms', () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    const { container } = show()
    check('initial XP', '0', container.querySelector('.home-xp')?.textContent)
    act(() => vi.advanceTimersByTime(304))
    const middle = Number(container.querySelector('.home-xp')?.textContent)
    check('304ms, XP=123', true, middle > 0 && middle < 123)
    act(() => vi.advanceTimersByTime(304))
    check('608ms, XP=123', '123', container.querySelector('.home-xp')?.textContent)
  })
  it.each([0, 3])('pulses only for active streak %s', (days) => {
    const data = makeData()
    data.progress.streak = { days, lastStudyDate: '2026-11-15' }
    useAppState.setState({ data })
    show()
    check({ days }, days > 0, screen.getByText('🔥').classList.contains('kp-anim-pulse'))
  })
  it('shows an empty path action', () => {
    const data = makeData()
    data.plan.units = []
    useAppState.setState({ data })
    show()
    check('empty units', true, screen.getByText(t('home.empty')) !== null)
    check(
      'empty units',
      ROUTES.data,
      screen.getByRole('link', { name: t('home.empty.action') }).getAttribute('href'),
    )
  })

  describe('onboarding behavior', () => {
    it('navigates to intro when data is null and not onboarded', () => {
      useAppState.setState({ data: null })

      show()
      check(
        { data: null, onboarded: false, route: ROUTES.intro },
        'Intro page',
        screen.queryByText('Intro page')?.textContent,
      )
    })

    it.each([false, true])('shows home with data when onboarded=%s', (onboarded) => {
      setOnboarded(onboarded)

      show()
      check(
        { data: 'present', onboarded },
        t('page.home'),
        screen.queryByRole('heading', { name: t('page.home'), level: 1 })?.textContent,
      )
      check({ data: 'present', onboarded }, null, screen.queryByText('Intro page'))
    })
  })
})
