import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { setVirtualDate } from '../app/clock'
import { deadlineFromMonths } from '../app/goal'
import { DAILY_MINUTES_OPTIONS, LEVEL_OPTIONS, createInitialStudyData } from '../app/survey'
import { I18nProvider, createTranslator } from '../i18n'
import { StudyDataSchema } from '../schema'
import { useAppState } from '../state/appState'
import { GoalSettings } from './GoalSettings'

const { saveProfile } = vi.hoisted(() => ({ saveProfile: vi.fn() }))
vi.mock('../db', () => ({ getAppStore: () => ({ saveProfile }) }))

const t = createTranslator('ja')
const today = '2026-11-15'
const data = StudyDataSchema.parse(
  createInitialStudyData(
    {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'ms',
      goal: {
        purposeTags: ['travel'],
        purposeText: 'trip',
        deadline: '2027-02-15',
        targetLevel: 'A1',
        dailyMinutes: 20,
        studyDaysPerWeek: 3,
      },
    },
    new Date('2026-11-15T00:00:00Z'),
  ),
)
const reload = vi.fn(async () => {})

function equal(actual: unknown, expected: unknown, input: unknown) {
  expect(
    actual,
    `入力: ${JSON.stringify(input)}、期待値: ${JSON.stringify(expected)}、実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function renderGoal() {
  return render(
    <I18nProvider initialLanguage="ja">
      <GoalSettings />
    </I18nProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  setVirtualDate(today)
  saveProfile.mockReset().mockResolvedValue(undefined)
  reload.mockClear()
  useAppState.setState({ status: 'ready', data, reload, lastBackupAt: null })
})

async function expectSaved(change: Partial<typeof data.profile.goal>) {
  await waitFor(() => equal(screen.queryByRole('status')?.textContent, t('goal.saved'), change))
  equal(
    saveProfile.mock.calls,
    [[{ ...data.profile, goal: { ...data.profile.goal, ...change } }]],
    change,
  )
  equal(reload.mock.calls.length, 1, change)
  equal(screen.queryAllByRole('status').length, 1, change)
}

describe('GoalSettings', () => {
  it('renders nothing without data', () => {
    useAppState.setState({ data: null })
    equal(renderGoal().container.innerHTML, '', { data: null })
  })

  it('renders the heading, deadline and current radio values', () => {
    renderGoal()
    equal(
      screen.getByRole('heading', { name: t('goal.section.title') }).id,
      'goal-title',
      data.profile,
    )
    equal(
      screen.getByLabelText<HTMLInputElement>(t('welcome.goal.deadline')).value,
      data.profile.goal.deadline,
      data.profile,
    )
    for (const option of LEVEL_OPTIONS) {
      equal(
        screen.getByRole<HTMLInputElement>('radio', { name: t(option.labelKey) }).checked,
        option.cefr === data.profile.goal.targetLevel,
        option,
      )
    }
    for (const minutes of DAILY_MINUTES_OPTIONS) {
      equal(
        screen.getByRole<HTMLInputElement>('radio', { name: t('welcome.minutes', { minutes }) })
          .checked,
        minutes === data.profile.goal.dailyMinutes,
        minutes,
      )
    }
  })

  it('saves only the deadline from date input', async () => {
    renderGoal()
    fireEvent.change(screen.getByLabelText(t('welcome.goal.deadline')), {
      target: { value: '2027-03-01' },
    })
    await expectSaved({ deadline: '2027-03-01' })
  })

  it('saves a deadline six months from the virtual today', async () => {
    const user = userEvent.setup()
    renderGoal()
    await user.click(screen.getByRole('button', { name: t('goal.deadline.modeRelative') }))
    await user.click(screen.getByRole('button', { name: t('goal.deadline.months', { months: 6 }) }))
    await expectSaved({ deadline: deadlineFromMonths(today, 6) })
  })

  it.each(['level', 'minutes'])('saves only %s', async (field) => {
    const user = userEvent.setup()
    renderGoal()
    const name =
      field === 'level' ? t('welcome.level.travel') : t('welcome.minutes', { minutes: 30 })
    await user.click(screen.getByRole('radio', { name }))
    await expectSaved(field === 'level' ? { targetLevel: 'A2' } : { dailyMinutes: 30 })
  })

  it('shows an alert on failure and clears it on another operation', async () => {
    saveProfile.mockRejectedValueOnce(new Error('save failed'))
    const user = userEvent.setup()
    renderGoal()
    await user.click(screen.getByRole('radio', { name: t('welcome.level.travel') }))
    await waitFor(() =>
      equal(screen.queryByRole('alert')?.textContent, t('goal.error'), 'rejected save'),
    )
    equal(screen.queryByRole('status'), null, 'rejected save')
    equal(reload.mock.calls.length, 0, 'rejected save')
    await user.click(screen.getByRole('button', { name: t('goal.deadline.modeRelative') }))
    equal(screen.queryByRole('alert'), null, 'change mode')
  })

  it('clears saved feedback even when the next date is invalid', async () => {
    const user = userEvent.setup()
    renderGoal()
    await user.click(screen.getByRole('radio', { name: t('welcome.level.travel') }))
    await expectSaved({ targetLevel: 'A2' })
    fireEvent.change(screen.getByLabelText(t('welcome.goal.deadline')), {
      target: { value: today },
    })
    equal(screen.queryByRole('status'), null, today)
    equal(saveProfile.mock.calls.length, 1, today)
  })
})
