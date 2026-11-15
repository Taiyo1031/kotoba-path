import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { useAppState } from '../state/appState'
import { StudyDataSchema } from '../schema'
import { ROUTES } from '../routes'
import { getToday, setVirtualDate } from '../app/clock'
import { defaultDeadline } from '../app/survey'
import { deadlineFromMonths } from '../app/goal'

const dbMock = vi.hoisted(() => {
  const saveStudyData = vi.fn()
  const loadStudyData = vi.fn(async () => null)
  const getLastBackupAt = vi.fn(async () => null)
  return {
    saveStudyData,
    store: { saveStudyData, loadStudyData, getLastBackupAt },
  }
})

vi.mock('../db', () => ({
  getAppStore: () => dbMock.store,
}))

import { WelcomePage, SurveyForm } from './WelcomePage'
import type { SurveyAnswers } from '../app/survey'

function renderWithProviders(ui: ReactNode) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[ROUTES.welcome]}>
        <Routes>
          <Route path={ROUTES.welcome} element={ui} />
          <Route path={ROUTES.data} element={<div data-testid="data-route">data-route</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

beforeEach(() => {
  setVirtualDate('2026-11-15')
  dbMock.saveStudyData.mockClear()
  useAppState.setState({
    status: 'ready',
    data: null,
    lastBackupAt: null,
    reload: async () => {},
  })
})

afterEach(() => {
  setVirtualDate(null)
})

describe('WelcomePage', () => {
  it('shows step 0 first and advances to step 1 with back button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WelcomePage />)

    expect(
      screen.queryByRole('heading', { name: '学習言語を選んでください' }),
      '入力: initial render / 期待値: step0 heading exists / 実際: null',
    ).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: '戻る' }),
      '入力: initial render / 期待値: no back button / 実際: found',
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: '次へ' }))

    expect(
      screen.queryByRole('heading', { name: '学習の目的を教えてください' }),
      '入力: after next / 期待値: step1 heading exists / 実際: null',
    ).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: '戻る' }),
      '入力: after next / 期待値: back button exists / 実際: null',
    ).not.toBeNull()
  })

  it('blocks step 1 without purpose and advances when a tag is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WelcomePage />)

    await user.click(screen.getByRole('button', { name: '次へ' }))

    expect(
      screen.queryByRole('alert'),
      '入力: step1 empty next / 期待値: no alert yet / 実際: found',
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: '次へ' }))

    const alert = screen.queryByRole('alert')
    expect(alert, '入力: step1 empty next / 期待値: alert exists / 実際: null').not.toBeNull()
    expect(
      alert?.textContent,
      '入力: step1 empty next / 期待値: purpose error text / 実際: missing',
    ).toContain('目的を教えてください')

    await user.click(screen.getByRole('checkbox', { name: '旅行' }))
    await user.click(screen.getByRole('button', { name: '次へ' }))

    expect(
      screen.queryByRole('heading', { name: '目標と期限を設定してください' }),
      '入力: after selecting tag / 期待値: step2 heading exists / 実際: null',
    ).not.toBeNull()
  })

  it('clears step 1 error when a purpose tag is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WelcomePage />)

    await user.click(screen.getByRole('button', { name: '次へ' }))
    await user.click(screen.getByRole('button', { name: '次へ' }))

    const initialError = screen.queryByRole('alert')?.textContent ?? null
    expect(
      initialError,
      `入力: 目的未回答で次へ / 期待値: 目的を教えてください / 実際: ${JSON.stringify(initialError)}`,
    ).toBe('目的を教えてください')

    await user.click(screen.getByRole('checkbox', { name: '旅行' }))

    const errorAfterTag = screen.queryByRole('alert')?.textContent ?? null
    expect(
      errorAfterTag,
      `入力: 旅行タグを選択 / 期待値: null（エラー消去） / 実際: ${JSON.stringify(errorAfterTag)}`,
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: '次へ' }))

    expect(
      screen.queryByRole('heading', { name: '目標と期限を設定してください' }),
      '入力: after tag selected and next / 期待値: step2 heading exists / 実際: null',
    ).not.toBeNull()
  })

  it('clears step 1 error when free text is entered', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WelcomePage />)

    await user.click(screen.getByRole('button', { name: '次へ' }))
    await user.click(screen.getByRole('button', { name: '次へ' }))

    const initialError = screen.queryByRole('alert')?.textContent ?? null
    expect(
      initialError,
      `入力: 目的未回答で次へ / 期待値: 目的を教えてください / 実際: ${JSON.stringify(initialError)}`,
    ).toBe('目的を教えてください')

    const freeText = screen.getByLabelText(/自由入力/)
    await user.type(freeText, '旅行')

    const errorAfterText = screen.queryByRole('alert')?.textContent ?? null
    expect(
      errorAfterText,
      `入力: 自由入力に「旅行」 / 期待値: null（エラー消去） / 実際: ${JSON.stringify(errorAfterText)}`,
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: '次へ' }))

    expect(
      screen.queryByRole('heading', { name: '目標と期限を設定してください' }),
      '入力: after free text and next / 期待値: step2 heading exists / 実際: null',
    ).not.toBeNull()
  })

  it.each(['2027-03-15', '2027-03-16'])(
    'blocks expired deadline when today is %s',
    async (today) => {
      const user = userEvent.setup()
      renderWithProviders(<WelcomePage />)

      await user.click(screen.getByRole('button', { name: '次へ' }))
      await user.click(screen.getByRole('checkbox', { name: '旅行' }))
      await user.click(screen.getByRole('button', { name: '次へ' }))

      const deadline = screen.getByLabelText(/目標達成期限/)
      fireEvent.change(deadline, { target: { value: '2027-03-15' } })
      setVirtualDate(today)

      await user.click(screen.getByRole('button', { name: '骨組みのプロンプトを作る' }))

      expect(
        screen
          .queryAllByRole('alert')
          .map((alert) => alert.textContent)
          .join(' '),
        `入力: deadline=2027-03-15, today=${today} / 期待値: 期限エラー`,
      ).toContain('期限は今日より後でください')
      expect(
        dbMock.saveStudyData,
        '入力: past deadline finish / 期待値: not called',
      ).not.toHaveBeenCalled()

      fireEvent.change(deadline, { target: { value: '2027-04-01' } })
      expect(
        screen.queryAllByRole('alert').map((alert) => alert.textContent),
        '入力: 期限を2027-04-01に変更 / 期待値: エラーなし',
      ).toEqual([])
    },
  )

  it.each(['date', 'relative'] as const)('saves valid answers with %s deadline', async (mode) => {
    const user = userEvent.setup()
    renderWithProviders(<WelcomePage />)

    await user.click(screen.getByRole('button', { name: '次へ' }))
    await user.click(screen.getByRole('checkbox', { name: '旅行' }))
    await user.click(screen.getByRole('button', { name: '次へ' }))

    const deadline = screen.getByLabelText('目標達成期限') as HTMLInputElement
    const expectedDefault = defaultDeadline(getToday())
    expect(
      { type: deadline.type, value: deadline.value },
      `入力: 目標ステップ初期表示 / 期待値: date, ${expectedDefault}`,
    ).toEqual({ type: 'date', value: expectedDefault })

    const expectedDeadline = mode === 'date' ? '2099-12-31' : deadlineFromMonths(getToday(), 6)
    if (mode === 'date') {
      fireEvent.change(deadline, { target: { value: expectedDeadline } })
    } else {
      await user.click(screen.getByRole('button', { name: '○ヶ月後で指定' }))
      await user.click(screen.getByRole('button', { name: '6ヶ月後' }))
    }

    await user.click(screen.getByRole('button', { name: '骨組みのプロンプトを作る' }))

    await waitFor(() => {
      expect(
        dbMock.saveStudyData.mock.calls.length,
        `入力: valid finish / 期待値: save called once / 実際: ${dbMock.saveStudyData.mock.calls.length}`,
      ).toBe(1)
    })

    const saved = dbMock.saveStudyData.mock.calls[0]?.[0] as unknown
    expect(saved, '入力: valid finish / 期待値: saved data exists / 実際: undefined').toBeDefined()

    let parsed: unknown
    try {
      parsed = StudyDataSchema.parse(saved)
    } catch (error) {
      throw new Error(
        `入力: ${JSON.stringify(saved)} / 期待値: StudyDataSchema.parse succeeds / 実際: ${String(error)}`,
        { cause: error },
      )
    }

    const profile = (parsed as { profile?: unknown }).profile as
      | {
          targetLanguage?: string
          goal?: { purposeTags?: string[]; deadline?: string }
        }
      | undefined
    expect(
      profile?.targetLanguage,
      `入力: saved profile / 期待値: ms / 実際: ${String(profile?.targetLanguage)}`,
    ).toBe('ms')
    expect(
      profile?.goal?.purposeTags,
      `入力: saved purposeTags / 期待値: travel included / 実際: ${JSON.stringify(profile?.goal?.purposeTags)}`,
    ).toContain('travel')
    expect(
      profile?.goal?.deadline,
      `入力: ${mode} / 期待値: ${expectedDeadline} / 実際: ${profile?.goal?.deadline}`,
    ).toBe(expectedDeadline)

    await waitFor(() => {
      expect(
        screen.queryByTestId('data-route'),
        '入力: valid finish / 期待値: data route visible / 実際: null',
      ).not.toBeNull()
    })
  })
})

describe('SurveyForm', () => {
  it('renders standalone and calls onChange when a purpose tag is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const answers: SurveyAnswers = {
      targetLanguage: 'ms',
      purposeTags: [],
      purposeText: '',
      deadline: '2099-12-31',
      targetLevel: 'A2',
      dailyMinutes: 20,
    }

    render(
      <I18nProvider>
        <SurveyForm answers={answers} onChange={onChange} step={1} errors={{}} />
      </I18nProvider>,
    )

    expect(
      screen.queryByRole('checkbox', { name: '旅行' }),
      '入力: SurveyForm step1 / 期待値: checkbox exists / 実際: null',
    ).not.toBeNull()

    await user.click(screen.getByRole('checkbox', { name: '旅行' }))

    expect(onChange, '入力: tag click / 期待値: onChange called once').toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0] as SurveyAnswers | undefined
    expect(
      next?.purposeTags,
      `入力: tag click / 期待値: ['travel'] / 実際: ${JSON.stringify(next?.purposeTags)}`,
    ).toEqual(['travel'])
  })
})
