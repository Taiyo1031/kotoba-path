import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { createTranslator, I18nProvider } from '../../i18n'
import { StudyDataSchema } from '../../schema'
import { useAppState } from '../../state/appState'
import { GAME_CONFIG } from '../../config/game'
import { LessonRunner } from './LessonRunner'
import type { LessonRunnerProps } from './LessonRunner'

const mocks = vi.hoisted(() => ({ saveProgress: vi.fn(), savePlan: vi.fn() }))
vi.mock('../../db', () => ({ getAppStore: () => mocks }))
const t = createTranslator('ja')
const reload = vi.fn(async () => {})
function makeData() {
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
    plan: { units: [{ id: 'u01', title: 'Unit', canDo: 'Learn', status: 'ready' }] },
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
  })
}
function check(input: string, expected: unknown, actual: unknown) {
  expect(
    actual,
    `入力: ${input} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}
function mount(overrides: Partial<LessonRunnerProps> = {}) {
  const data = makeData()
  const content = data.content.units.u01!
  const ids = content.words.map((word) => word.id)
  const props: LessonRunnerProps = {
    step: {
      id: 'intro',
      kind: 'intro',
      batchIndex: 0,
      wordIds: ids,
      phraseIds: [],
      sentenceIds: [],
    },
    unitId: 'u01',
    kind: 'lesson',
    ...content,
    pool: content.words,
    unitWordIds: new Set(ids),
    learnedWordIds: new Set(ids),
    stepIds: ['intro', 'recognize'],
    targetLanguage: 'ms',
    seedKey: 'fixed',
    backTo: '/unit/u01',
    backLabel: 'Back',
    ...overrides,
  }
  return render(
    <I18nProvider initialLanguage="ja">
      <MemoryRouter>
        <LessonRunner {...props} />
      </MemoryRouter>
    </I18nProvider>,
  )
}
async function finishIntro() {
  const user = userEvent.setup()
  for (let i = 0; i < 6; i++) {
    check(`intro ${i}`, `word${i}`, screen.getByRole('heading', { level: 2 }).textContent)
    check(
      `progress ${i}`,
      String(Math.round((i / 6) * 100)),
      screen.getByRole('progressbar').getAttribute('aria-valuenow'),
    )
    await user.click(screen.getByRole('button', { name: t('lesson.intro.got') }))
  }
  await screen.findByRole('heading', { name: t('lesson.complete.title') })
  await waitFor(() => check('save once', 1, mocks.saveProgress.mock.calls.length))
}
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  useAppState.setState({ status: 'ready', data: makeData(), reload, lastBackupAt: null })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  )
})
describe('LessonRunner', () => {
  it('introduces all words and saves once with the step bonus', async () => {
    mount()
    await finishIntro()
    const progress = mocks.saveProgress.mock.calls[0]?.[0]
    check(
      'introduced words',
      ['w0', 'w1', 'w2', 'w3', 'w4', 'w5'],
      progress.unitProgress.u01.introducedItemIds,
    )
    check('completed step', ['intro'], progress.unitProgress.u01.completedStepIds)
    check('intro XP', GAME_CONFIG.xp.stepComplete, progress.xp)
    check('plan status', 'inProgress', mocks.savePlan.mock.calls[0]?.[0].units[0].status)
    check('final progress', '100', screen.getByRole('progressbar').getAttribute('aria-valuenow'))
  })
  it('accepts wrong and correct MCQ answers and finishes', async () => {
    mount({
      step: {
        id: 'recognize',
        kind: 'recognize',
        batchIndex: 0,
        wordIds: ['w0'],
        phraseIds: [],
        sentenceIds: [],
      },
    })
    const user = userEvent.setup()
    check('four choices', 4, document.querySelectorAll('.lq-option').length)
    const choices = Array.from(document.querySelectorAll('.lq-option'))
    const wrong = choices.findIndex((choice) => !choice.textContent?.includes('meaning0'))
    await user.keyboard(String(wrong + 1))
    check('wrong feedback', true, document.querySelector('.lc-feedback-incorrect') !== null)
    await user.click(screen.getByRole('button', { name: t('lesson.next') }))
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: /meaning0/ }))
      check('correct feedback', true, document.querySelector('.lc-feedback-correct') !== null)
      await user.click(screen.getByRole('button', { name: t('lesson.next') }))
    }
    await screen.findByRole('heading', { name: t('lesson.complete.title') })
    check('recognize save', 1, mocks.saveProgress.mock.calls.length)
    check('wrong item', ['w0'], mocks.saveProgress.mock.calls[0]?.[0].unitProgress.u01.wrongItemIds)
  })
  it('preserves unit progress during review', async () => {
    mount({ kind: 'review' })
    await finishIntro()
    check('review unit progress', {}, mocks.saveProgress.mock.calls[0]?.[0].unitProgress)
    check('review plan save', 0, mocks.savePlan.mock.calls.length)
  })
  it.each([false, true])('respects reduced motion=%s on unit completion', async (reduced) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: reduced })),
    )
    mount({ stepIds: ['intro'] })
    await finishIntro()
    check(
      'confetti count',
      reduced ? 0 : 16,
      document.querySelectorAll('.lesson-confetti-piece').length,
    )
    check('unit status', 'done', mocks.savePlan.mock.calls[0]?.[0].units[0].status)
  })
  it('keeps completion visible when saving fails', async () => {
    mocks.saveProgress.mockRejectedValueOnce(new Error('save failed'))
    mount()
    await finishIntro()
    check('save failure', t('common.error'), (await screen.findByRole('alert')).textContent)
  })
  it('does not save an empty step', () => {
    mount({
      step: {
        id: 'empty',
        kind: 'intro',
        batchIndex: 0,
        wordIds: [],
        phraseIds: [],
        sentenceIds: [],
      },
    })
    check('empty', true, screen.queryByText(t('lesson.empty')) !== null)
    check('empty saves', 0, mocks.saveProgress.mock.calls.length)
  })
})
