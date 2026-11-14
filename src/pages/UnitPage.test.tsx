import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createTranslator, I18nProvider } from '../i18n'
import { useAppState } from '../state/appState'
import { StudyDataSchema } from '../schema'
import { buildSteps } from '../engine/steps'
import { ROUTES, lessonPath } from '../routes'
import { UnitPage } from './UnitPage'

const t = createTranslator('ja')
const reload = vi.fn(async () => {})

function makeData() {
  return StudyDataSchema.parse({
    format: 'lang-study-data',
    version: 1,
    meta: { exportedAt: '2026-01-01T00:00:00.000Z', appVersion: '0.1.0' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'en',
      goal: { deadline: '2026-12-31', targetLevel: 'A1', dailyMinutes: 10 },
    },
    plan: {
      units: [
        {
          id: 'u01',
          title: 'Unit One',
          canDo: 'Can do one',
          scenario: 'Travel',
          plannedStart: '2026-01-01',
          plannedEnd: '2026-01-31',
        },
        { id: 'u02', title: 'Unit Two', canDo: 'Can do two' },
      ],
    },
    content: {
      units: {
        u01: {
          generatedBy: { tool: 'test-tool', at: '2026-01-01T00:00:00.000Z' },
          words: Array.from({ length: 7 }, (_, index) => ({
            id: `w${index + 1}`,
            lemma: `word${index + 1}`,
            meaning: [`meaning${index + 1}`],
            pos: 'noun',
            uncertain: index === 6,
          })),
          phrases: [{ id: 'p01', target: 'Hello!', meaning: 'こんにちは！', fixed: true }],
        },
      },
    },
    progress: { unitProgress: { u01: { completedStepIds: ['u01-b0-intro'] } } },
  })
}

function check(input: unknown, expected: unknown, actual: unknown) {
  expect(
    actual,
    `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function renderAt(path = '/unit/u01') {
  return render(
    <I18nProvider initialLanguage="ja">
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={ROUTES.unit} element={<UnitPage />} />
          <Route path={ROUTES.lesson} element={<div>lesson-page</div>} />
          <Route path={ROUTES.data} element={<div>data-page</div>} />
          <Route path={ROUTES.home} element={<div>home-page</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

beforeEach(() => {
  reload.mockClear()
  useAppState.setState({ status: 'ready', data: makeData(), lastBackupAt: null, reload })
})

describe('UnitPage', () => {
  it('shows the title, goal, scenario, schedule, uncertainty badge and home link', () => {
    renderAt()

    check('/unit/u01 title', 'Unit One', screen.queryByRole('heading', { level: 1 })?.textContent)
    check(
      '/unit/u01 goal heading',
      true,
      screen.queryByRole('heading', { name: t('unit.canDo') }) !== null,
    )
    check('/unit/u01 goal', true, screen.queryByText('Can do one') !== null)
    check('/unit/u01 scenario', true, screen.queryByText('Travel') !== null)
    const schedule = t('unit.schedule', { start: '2026-01-01', end: '2026-01-31' })
    check('/unit/u01 schedule', true, screen.queryByText(schedule) !== null)
    check('word w7 uncertain=true', true, screen.queryByText(t('home.unit.unverified')) !== null)
    check(
      '/unit/u01 home link',
      ROUTES.home,
      screen.queryByRole('link', { name: t('unit.back') })?.getAttribute('href'),
    )
    check('page mounted', 1, reload.mock.calls.length)
  })

  it('shows nine ordered steps with labels, item counts, loose links and scoped completion', () => {
    const content = makeData().content.units.u01!
    const steps = buildSteps('u01', content)
    renderAt()

    const cards = screen.queryAllByRole('listitem')
    const links = screen.queryAllByRole('link', { name: t('unit.step.start') })
    check('7 words: 2 batches × 4 + unit test', 9, cards.length)
    check('/unit/u01 start links', 9, links.length)
    check(
      '/unit/u01 steps heading',
      true,
      screen.queryByRole('heading', { name: t('unit.steps') }) !== null,
    )
    steps.forEach((step, index) => {
      const card = cards[index]
      check({ step: step.id, index }, true, card !== undefined)
      if (card === undefined) return
      const label = t(`unit.step.${step.kind}`)
      const expectedLabel = step.batchIndex === null ? label : `${step.batchIndex + 1}. ${label}`
      check(step.id, expectedLabel, within(card).queryByRole('heading')?.textContent)
      const count = step.wordIds.length + step.phraseIds.length
      check(
        { step: step.id, count },
        true,
        within(card).queryByText(t('unit.step.items', { count })) !== null,
      )
      check(step.id, lessonPath('u01', step.id), links[index]?.getAttribute('href'))
      check(
        { step: step.id, completedStepIds: ['u01-b0-intro'] },
        step.id === 'u01-b0-intro',
        within(card).queryByText(t('unit.step.done')) !== null,
      )
      check(step.id, step.kind === 'unitTest', card.classList.contains('unit-step-unit-test'))
    })
    check('all completion badges', 1, screen.queryAllByText(t('unit.step.done')).length)
  })

  it('allows opening the unit test before earlier steps are complete', async () => {
    renderAt()
    const links = screen.queryAllByRole('link', { name: t('unit.step.start') })
    const lastLink = links.at(-1)
    check(
      'last step with only first step complete',
      lessonPath('u01', 'u01-test'),
      lastLink?.getAttribute('href'),
    )
    if (lastLink === undefined) return
    await userEvent.setup().click(lastLink)
    check('click unit test start', true, screen.queryByText('lesson-page') !== null)
  })

  it('shows the preparation link and no steps for u02 without content', async () => {
    renderAt('/unit/u02')

    check('/unit/u02 no content', true, screen.queryByText(t('unit.noContent')) !== null)
    const link = screen.queryByRole('link', { name: t('home.unit.prepare') })
    check('/unit/u02 prepare link', ROUTES.data, link?.getAttribute('href'))
    check('/unit/u02 steps', 0, screen.queryAllByRole('listitem').length)
    check(
      '/unit/u02 start links',
      0,
      screen.queryAllByRole('link', { name: t('unit.step.start') }).length,
    )
    check(
      '/unit/u02 steps heading',
      true,
      screen.queryByRole('heading', { name: t('unit.steps') }) === null,
    )
    if (link === null) return
    await userEvent.setup().click(link)
    check('click prepare', true, screen.queryByText('data-page') !== null)
  })

  it.each(['missing ID', 'null data'])(
    'shows not found and the home link for %s',
    async (input) => {
      if (input === 'null data') useAppState.setState({ data: null })
      renderAt(input === 'missing ID' ? '/unit/missing' : '/unit/u01')

      check(input, true, screen.queryByText(t('unit.notFound')) !== null)
      const link = screen.queryByRole('link', { name: t('unit.back') })
      check(input, ROUTES.home, link?.getAttribute('href'))
      check(input, 0, screen.queryAllByRole('listitem').length)
      if (link === null) return
      await userEvent.setup().click(link)
      check({ input, action: 'click back' }, true, screen.queryByText('home-page') !== null)
    },
  )

  it('shows loading before rendering cached data or not found', () => {
    useAppState.setState({ status: 'loading', data: null })
    renderAt()

    check(
      'status=loading, data=null',
      t('common.loading'),
      screen.queryByRole('status')?.textContent,
    )
    check('status=loading', true, screen.queryByText(t('unit.notFound')) === null)
    check('status=loading', 0, screen.queryAllByRole('link').length)
  })

  it.each(['plannedStart', 'plannedEnd'] as const)(
    'omits a partial schedule without %s',
    (field) => {
      const data = makeData()
      delete data.plan.units[0]![field]
      useAppState.setState({ data })
      const { container } = renderAt()

      check({ missing: field }, true, container.querySelector('.unit-schedule') === null)
    },
  )

  it('omits an empty scenario and uncertainty badge for verified words', () => {
    const data = makeData()
    data.plan.units[0]!.scenario = ''
    data.content.units.u01!.words.forEach((word) => {
      word.uncertain = false
    })
    data.progress.unitProgress = {}
    useAppState.setState({ data })
    const { container } = renderAt()

    check('scenario=""', true, container.querySelector('.unit-scenario') === null)
    check('all words uncertain=false', true, screen.queryByText(t('home.unit.unverified')) === null)
    check('missing unit progress', 0, screen.queryAllByText(t('unit.step.done')).length)
    check(
      'missing unit progress',
      9,
      screen.queryAllByRole('link', { name: t('unit.step.start') }).length,
    )
  })
})
