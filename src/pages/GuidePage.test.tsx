// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { setOnboarded } from '../app/onboarding'
import { setVirtualDate } from '../app/clock'
import { buildGuideQuiz } from '../app/guideQuiz'
import { hasVoiceFor, speak } from '../app/tts'
import { hashSeed } from '../engine/rng'
import { createTranslator, I18nProvider } from '../i18n'
import { StudyDataSchema } from '../schema'
import { ROUTES } from '../routes'
import { useAppState } from '../state/appState'
import { GuidePage } from './GuidePage'

vi.mock('../app/tts', () => ({ hasVoiceFor: vi.fn(), speak: vi.fn() }))
const t = createTranslator('ja')
function makeData() {
  return StudyDataSchema.parse({
    format: 'lang-study-data',
    version: 1,
    meta: { exportedAt: '2026-11-15T03:00:00.000Z', appVersion: '0.1.0' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'en',
      goal: { dailyMinutes: 30, studyDaysPerWeek: 7, targetLevel: 'A1', deadline: '2026-12-15' },
    },
    plan: { units: [] },
    content: {
      units: {},
      guide: {
        generatedBy: { tool: 'test', at: '2026-11-15T03:00:00.000Z' },
        intro: 'Guide introduction',
        sounds: Array.from({ length: 8 }, (_, i) => ({
          id: `s${i}`,
          grapheme: `letter-${i}`,
          reading: `reading-${i}`,
          ipa: i < 2 ? `ipa-${i}` : '',
          note: i < 2 ? `note-${i}` : '',
          confusableWith: i === 0 ? ['s1', 's2'] : [],
          examples:
            i < 4
              ? [
                  {
                    target: `example-${i}`,
                    reading: `example-reading-${i}`,
                    meaning: `meaning-${i}`,
                  },
                ]
              : [],
        })),
        rules: [0, 1].map((i) => ({ id: `r${i}`, title: `Rule ${i}`, body: `Body ${i}` })),
      },
    },
    progress: {},
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
    <MemoryRouter initialEntries={[ROUTES.guide]}>
      <I18nProvider initialLanguage="ja">
        <Routes>
          <Route path={ROUTES.guide} element={<GuidePage />} />
          <Route path={ROUTES.intro} element={<p>Intro</p>} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  localStorage.clear()
  setVirtualDate('2026-11-15')
  vi.clearAllMocks()
  vi.mocked(hasVoiceFor).mockReturnValue(false)
  useAppState.setState({
    status: 'ready',
    data: makeData(),
    reload: vi.fn(async () => {}),
    lastBackupAt: null,
  })
})
describe('GuidePage', () => {
  it.each(['loading', 'error'] as const)('shows %s and reloads', (status) => {
    useAppState.setState({ status })
    show()
    check(
      status,
      true,
      screen.queryByText(t(status === 'loading' ? 'common.loading' : 'common.error')) !== null,
    )
    check('mount', 1, vi.mocked(useAppState.getState().reload).mock.calls.length)
    check(status, 0, screen.queryAllByRole('status').length)
  })
  it.each([false, true])('handles null data, onboarded=%s', (onboarded) => {
    setOnboarded(onboarded)
    useAppState.setState({ data: null })
    show()
    if (onboarded) {
      check('null data', true, screen.queryByText(t('home.noProfile')) !== null)
      check('null data', ROUTES.welcome, screen.getByRole('link').getAttribute('href'))
    } else check('null data', 'Intro', screen.getByText('Intro').textContent)
  })
  it('shows the empty guide and data link', () => {
    const data = makeData()
    delete data.content.guide
    useAppState.setState({ data })
    show()
    check('no guide', true, screen.queryByText(t('guide.empty')) !== null)
    check(
      'no guide',
      ROUTES.data,
      screen.getByRole('link', { name: t('guide.empty.action') }).getAttribute('href'),
    )
    check('no guide', 0, screen.queryAllByRole('button').length)
  })
  it('renders sounds, examples, confusables and rules', () => {
    const guide = makeData().content.guide!
    const { container } = show()
    check(
      'heading',
      true,
      screen.queryByRole('heading', { level: 1, name: t('page.guide') }) !== null,
    )
    check('intro', true, screen.queryByText(guide.intro) !== null)
    for (const sound of guide.sounds) {
      for (const text of [sound.grapheme, sound.reading, sound.note].filter(Boolean))
        check(sound.id, true, screen.queryByText(text) !== null)
      if (sound.ipa)
        check(sound.id, true, screen.queryByText(t('guide.ipa', { ipa: sound.ipa })) !== null)
      for (const example of sound.examples) {
        check(example, true, screen.queryByText(`${example.target} (${example.reading})`) !== null)
        check(example, true, screen.queryByText(example.meaning) !== null)
      }
    }
    for (const rule of guide.rules)
      for (const text of [rule.title, rule.body])
        check(rule.id, true, screen.queryByText(text) !== null)
    check(
      'confusable ids',
      true,
      screen.queryByText(t('guide.confusable', { names: 'letter-1、letter-2' })) !== null,
    )
    check('cards', 8, container.querySelectorAll('article.guide-sound').length)
    check('idle', 0, screen.queryAllByRole('status').length)
  })
  it.each([false, true])('handles voice availability=%s', async (available) => {
    vi.mocked(hasVoiceFor).mockReturnValue(available)
    show()
    const buttons = screen.queryAllByRole('button', { name: /の音声を聞く/ })
    check({ available }, available ? 4 : 0, buttons.length)
    check(
      { available },
      available ? 0 : 1,
      screen.queryAllByText(t('guide.speak.unavailable')).length,
    )
    check(
      'language',
      true,
      vi.mocked(hasVoiceFor).mock.calls.every(([language]) => language === 'en'),
    )
    if (available) {
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: t('guide.speak.label', { text: 'example-0' }) }))
      check('example-0', [['example-0', 'en']], vi.mocked(speak).mock.calls)
    }
  })
  it('answers five questions, locks choices, shows one feedback and restarts with the next seed', async () => {
    const user = userEvent.setup()
    const guide = makeData().content.guide!
    const questions = buildGuideQuiz(guide, hashSeed('2026-11-15:0'), 5)
    const { container } = show()
    const start = screen.getByRole('button', { name: t('guide.quiz.start') })
    start.focus()
    await user.keyboard('{Enter}')
    for (const [i, question] of questions.entries()) {
      check({ i }, true, screen.queryByText(`${i + 1} / 5`) !== null)
      check(
        question,
        true,
        screen.queryByRole('heading', {
          name: t(`guide.quiz.q.${question.kind}`, { value: question.value }),
        }) !== null,
      )
      const options = within(container.querySelector('.guide-options') as HTMLElement).getAllByRole(
        'button',
      )
      check(
        question,
        question.options,
        options.map((button) => button.lastChild?.textContent),
      )
      check('before answer', 0, screen.queryAllByRole('status').length)
      const choice = i === 1 ? (question.answerIndex + 1) % 4 : question.answerIndex
      await user.click(options[choice]!)
      check({ i, choice }, 1, screen.queryAllByRole('status').length)
      check(
        { i, choice },
        i === 1
          ? t('guide.quiz.wrong', { answer: question.options[question.answerIndex]! })
          : t('guide.quiz.correct'),
        screen.getByRole('status').textContent,
      )
      check(
        'locked',
        [true, true, true, true],
        options.map((button) => (button as HTMLButtonElement).disabled),
      )
      check(
        'correct style',
        true,
        options[question.answerIndex]!.classList.contains('guide-option--success'),
      )
      if (i === 1)
        check('wrong style', true, options[choice]!.classList.contains('guide-option--danger'))
      await user.keyboard('1')
      await user.click(
        screen.getByRole('button', { name: t(i === 4 ? 'guide.quiz.finish' : 'guide.quiz.next') }),
      )
    }
    check(
      'four correct answers',
      true,
      screen.queryByText(t('guide.quiz.result', { correct: 4, total: 5 })) !== null,
    )
    check('result', 0, screen.queryAllByRole('status').length)
    await user.click(screen.getByRole('button', { name: t('guide.quiz.again') }))
    check('restart', true, screen.queryByText('1 / 5') !== null)
    const next = buildGuideQuiz(guide, hashSeed('2026-11-15:1'), 5)[0]!
    check(
      'round 1',
      next.options,
      Array.from(
        container.querySelectorAll('.guide-option'),
        (button) => button.lastChild?.textContent,
      ),
    )
    await user.keyboard('1')
    check('numeric selection', 1, screen.queryAllByRole('status').length)
    check(
      'numeric selection',
      next.answerIndex === 0
        ? t('guide.quiz.correct')
        : t('guide.quiz.wrong', { answer: next.options[next.answerIndex]! }),
      screen.getByRole('status').textContent,
    )
  })
  it('omits empty optional content and skips unknown confusable ids', () => {
    const data = makeData()
    const guide = data.content.guide!
    guide.intro = ''
    guide.rules = []
    guide.sounds[0]!.confusableWith.push('missing')
    guide.sounds[0]!.examples[0]!.reading = ''
    useAppState.setState({ data })
    show()
    check('empty intro', false, screen.queryByText('Guide introduction') !== null)
    check('empty rules', null, screen.queryByRole('heading', { name: t('guide.rules.title') }))
    check(
      'missing id',
      true,
      screen.queryByText(t('guide.confusable', { names: 'letter-1、letter-2' })) !== null,
    )
    check('empty reading', true, screen.queryByText('example-0') !== null)
  })
  it.each([0, 1, 2, 3])('shows too few for %s sounds', (count) => {
    const data = makeData()
    data.content.guide!.sounds = data.content.guide!.sounds.slice(0, count)
    useAppState.setState({ data })
    show()
    check({ count }, true, screen.queryByText(t('guide.quiz.tooFew')) !== null)
    check({ count }, null, screen.queryByRole('button', { name: t('guide.quiz.start') }))
    check({ count }, 0, screen.queryAllByRole('status').length)
  })
})
