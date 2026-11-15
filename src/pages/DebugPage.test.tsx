import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getToday, getVirtualDate, setVirtualDate } from '../app/clock'
import { StudyDataSchema } from '../schema'
import type { StudyData } from '../schema'
import { useAppState } from '../state/appState'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { DebugPage } from './DebugPage'

const { saveStudyData, resetAll } = vi.hoisted(() => ({
  saveStudyData: vi.fn<(_data: StudyData) => Promise<void>>(async () => undefined),
  resetAll: vi.fn(async () => undefined),
}))

vi.mock('../db', () => ({
  getAppStore: () => ({
    saveStudyData,
    resetAll,
  }),
}))

function makeStudyData(): StudyData {
  const base = {
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'en',
      goal: {
        deadline: '2026-12-31',
        dailyMinutes: 60,
        studyDaysPerWeek: 7,
        targetLevel: 'A1',
      },
    },
    plan: {
      units: [
        {
          id: 'unit-1',
          title: 'Unit 1',
          canDo: 'Can do',
          status: 'planned',
          itemEstimate: 10,
        },
      ],
    },
    progress: {
      fsrs: {},
      sessions: [],
      unitProgress: {},
    },
  }

  return StudyDataSchema.parse({
    format: 'lang-study-data',
    version: 1,
    meta: { exportedAt: '2024-01-01T00:00:00.000Z', appVersion: '0.1.0' },
    ...base,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  useAppState.setState({
    status: 'ready',
    data: makeStudyData(),
    lastBackupAt: null,
    reload: async () => undefined,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('DebugPage', () => {
  it('仮想日付を設定すると getVirtualDate が変わり、今日の表示が更新される', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const virtualSection = screen.getByRole('region', { name: '仮想日付' })
    const input = within(virtualSection).getByLabelText('仮想日付')
    await user.clear(input)
    await user.type(input, '2024-01-15')
    await user.click(within(virtualSection).getByRole('button', { name: '設定' }))

    expect(getVirtualDate(), '入力: 2024-01-15').toBe('2024-01-15')
    await waitFor(() => {
      expect(screen.getByText('今日の表示: 2024-01-15'), '入力: 2024-01-15').toBeDefined()
    })
  })

  it('仮想日付を解除すると null になる', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const virtualSection = screen.getByRole('region', { name: '仮想日付' })
    const input = within(virtualSection).getByLabelText('仮想日付')
    await user.clear(input)
    await user.type(input, '2024-01-15')
    await user.click(within(virtualSection).getByRole('button', { name: '設定' }))
    await user.click(within(virtualSection).getByRole('button', { name: '解除' }))

    expect(getVirtualDate(), '入力: 解除').toBeNull()
  })

  it('乱数シードを固定すると localStorage に保存される', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const seedSection = screen.getByRole('region', { name: '乱数シードの固定' })
    const input = within(seedSection).getByLabelText('乱数シード')
    await user.clear(input)
    await user.type(input, 'seed-123')
    await user.click(within(seedSection).getByRole('button', { name: '固定' }))

    expect(localStorage.getItem('kp.fixedSeed'), '入力: seed-123').toBe('seed-123')
  })

  it('乱数シードを解除すると localStorage から削除される', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const seedSection = screen.getByRole('region', { name: '乱数シードの固定' })
    const input = within(seedSection).getByLabelText('乱数シード')
    await user.clear(input)
    await user.type(input, 'seed-123')
    await user.click(within(seedSection).getByRole('button', { name: '固定' }))
    await user.click(within(seedSection).getByRole('button', { name: '解除' }))

    expect(localStorage.getItem('kp.fixedSeed'), '入力: 解除').toBeNull()
  })

  it('ダミーデータを読み込むと saveStudyData が 1 回呼ばれる', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'ダミーデータを読み込む(置き換え)' }))

    await waitFor(() => {
      expect(saveStudyData, '入力: ダミーデータ読み込み').toHaveBeenCalledTimes(1)
    })

    const saved = saveStudyData.mock.calls[0]?.[0]
    expect(saved, '入力: ダミーデータ').toBeDefined()
    expect(() => StudyDataSchema.parse(saved), '入力: ダミーデータ').not.toThrow()
  })

  it('ダミーデータ読み込みで confirm が false なら saveStudyData は呼ばれない', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'ダミーデータを読み込む(置き換え)' }))

    expect(saveStudyData, '入力: confirm=false').not.toHaveBeenCalled()
  })

  it('全データのリセットで resetAll が呼ばれる', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '全データをリセット' }))

    await waitFor(() => {
      expect(resetAll, '入力: 全データのリセット').toHaveBeenCalledTimes(1)
    })
  })

  it('インスペクタに profile の JSON が表示される', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const profile = useAppState.getState().data?.profile
    expect(profile, '入力: data.profile').toBeDefined()

    const expected = JSON.stringify(profile, null, 2)
    const actual = screen.getByTestId('debug-profile-json').textContent
    expect(actual, `入力: ${expected}`).toBe(expected)
  })

  it('data が null なら「データがありません」が表示される', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    useAppState.setState({
      status: 'ready',
      data: null,
      lastBackupAt: null,
      reload: async () => undefined,
    })
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(screen.getAllByText('データがありません').length, '入力: data=null').toBeGreaterThan(0)
  })

  it('日程計算の表に残りの学習日数と dailyNew が表示される', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    setVirtualDate('2026-12-29')
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(
      within(screen.getByRole('row', { name: '残りの学習日数 2' })).getByRole('cell').textContent,
      'Input: today=2026-12-29, deadline=2026-12-31, spw=7',
    ).toBe('2')
    expect(
      within(screen.getByRole('row', { name: 'dailyNew 5' })).getByRole('cell').textContent,
      'Input: remaining=10, days=2, minutes=60',
    ).toBe('5')
    const data = useAppState.getState().data
    expect(data, '入力: data').toBeDefined()
    expect(screen.getByText('残りの学習日数'), '入力: data').toBeDefined()
    expect(screen.getByText('dailyNew'), '入力: data').toBeDefined()
    expect(screen.getByText('今日の表示: ' + getToday()), '入力: data').toBeDefined()
  })

  it('uses content counts and introduced items for pacing', () => {
    const data = makeStudyData()
    const unit = data.plan.units[0]!
    unit.status = 'inProgress'
    data.content.units[unit.id] = {
      version: 1,
      verified: false,
      generatedBy: { tool: 'test', at: '2026-01-01T00:00:00.000Z' },
      words: [],
      phrases: Array.from({ length: 15 }, (_, i) => ({
        id: 'p' + i,
        target: 'hello',
        meaning: 'hello',
        slots: {},
        fixed: true,
      })),
      sentences: [],
      grammarNotes: [],
    }
    data.progress.unitProgress[unit.id] = {
      introducedItemIds: ['p0', 'p1', 'p2'],
      completedStepIds: [],
      wrongItemIds: [],
    }
    useAppState.setState({ data: StudyDataSchema.parse(data) })
    setVirtualDate('2026-12-29')
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
      'Input: 15 phrases, 3 introduced, 2 days; expected remaining=12 and dailyNew=6',
    ).toEqual(['2026-12-29', '2026-12-31', '7', '2', '12', '6', '40', '6'])
  })

  it('reports save failures and does not reload after failure', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    saveStudyData.mockRejectedValueOnce(new Error('save failed'))
    const reload = vi.fn(async () => undefined)
    useAppState.setState({ reload })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DebugPage />
        </I18nProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getAllByRole('button')[4]!)
    await waitFor(() => {
      expect(
        screen
          .getAllByRole('status')
          .map((node) => node.textContent)
          .join(' '),
        'Input: save rejects with save failed; expected reason in status',
      ).toContain('save failed')
    })
    expect(reload, 'Input: failed save; expected only initial reload').toHaveBeenCalledTimes(1)
  })
})
