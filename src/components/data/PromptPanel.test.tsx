// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, createTranslator } from '../../i18n'
import { StudyDataSchema } from '../../schema'
import type { StudyData } from '../../schema'
import { setVirtualDate } from '../../app/clock'
import { useAppState } from '../../state/appState'
import { PromptPanel } from './PromptPanel'

const t = createTranslator('ja')
const NOW = '2026-01-12T12:00:00.000Z'

function makeData(unitIds: string[], contentUnitIds: string[]): StudyData {
  const units = unitIds.map((id, index) => ({
    id,
    title: `Unit ${index + 1}`,
    canDo: 'greet',
    itemEstimate: 10,
  }))

  const contentUnits: Record<string, unknown> = {}
  for (const id of contentUnitIds) {
    contentUnits[id] = { generatedBy: { tool: 'test', at: NOW } }
  }

  return StudyDataSchema.parse({
    format: 'lang-study-data',
    version: 1,
    meta: { exportedAt: NOW, appVersion: '0.1.0' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'en',
      goal: { dailyMinutes: 30, studyDaysPerWeek: 7, targetLevel: 'A1', deadline: '2026-01-19' },
    },
    plan: { units },
    content: { units: contentUnits },
    progress: {
      unitProgress: {},
      fsrs: {},
      streak: { days: 0, lastStudyDate: '2026-01-11' },
      xp: 0,
    },
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
    <I18nProvider initialLanguage="ja">
      <PromptPanel />
    </I18nProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
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

describe('PromptPanel', () => {
  it('shows the skeleton banner and default skeleton mode when there are no units', () => {
    const data = makeData([], [])
    useAppState.setState({ status: 'ready', data, lastBackupAt: null, reload: async () => {} })
    const { container } = show()

    const banner = container.querySelector<HTMLElement>('.flow-banner')
    check('no units', true, banner !== null)
    if (banner === null) return

    check('skeleton body', true, within(banner).queryByText(t('flow.skeleton')) !== null)

    const skeletonButton = screen.queryByRole('button', { name: t('data.prompt.skeleton') })
    check('skeleton mode button exists', true, skeletonButton !== null)
    if (skeletonButton === null) return
    check('skeleton mode pressed', 'true', skeletonButton.getAttribute('aria-pressed'))
  })

  it('shows the next unprepared unit and progress when only the first unit has content', () => {
    const data = makeData(['u1', 'u2', 'u3'], ['u1'])
    useAppState.setState({ status: 'ready', data, lastBackupAt: null, reload: async () => {} })
    const { container } = show()

    const banner = container.querySelector<HTMLElement>('.flow-banner')
    check('one prepared unit', true, banner !== null)
    if (banner === null) return

    check(
      'unit body contains second title',
      true,
      within(banner).queryByText(t('flow.unit', { title: 'Unit 2' })) !== null,
    )
    check(
      'progress text',
      true,
      within(banner).queryByText(t('flow.progress', { done: 1, total: 3 })) !== null,
    )

    const unitButton = screen.queryByRole('button', { name: t('data.prompt.unit') })
    check('unit mode button exists', true, unitButton !== null)
    if (unitButton === null) return
    check('unit mode pressed', 'true', unitButton.getAttribute('aria-pressed'))

    const select = screen.queryByLabelText(t('data.prompt.selectUnit')) as HTMLSelectElement | null
    check('unit select exists', true, select !== null)
    if (select === null) return
    check('default unit selection is second unit', 'u2', select.value)
  })

  it('shows the done banner when every unit has content', () => {
    const data = makeData(['u1', 'u2', 'u3'], ['u1', 'u2', 'u3'])
    useAppState.setState({ status: 'ready', data, lastBackupAt: null, reload: async () => {} })
    const { container } = show()

    const banner = container.querySelector<HTMLElement>('.flow-banner')
    check('all prepared units', true, banner !== null)
    if (banner === null) return

    check('done body', true, within(banner).queryByText(t('flow.done')) !== null)
  })

  it('uses the virtual date in the skeleton prompt', () => {
    const data = makeData([], [])
    useAppState.setState({ status: 'ready', data, lastBackupAt: null, reload: async () => {} })
    setVirtualDate('2030-01-02')

    try {
      show()
      const textarea = screen.queryByRole('textbox') as HTMLTextAreaElement | null
      check('skeleton prompt textbox exists', true, textarea !== null)
      if (textarea === null) return
      check({ virtualDate: '2030-01-02' }, true, textarea.value.includes('今日の日付: 2030-01-02'))
    } finally {
      setVirtualDate(null)
    }
  })

  it('does not add a live region inside the banner', () => {
    const data = makeData(['u1', 'u2', 'u3'], ['u1'])
    useAppState.setState({ status: 'ready', data, lastBackupAt: null, reload: async () => {} })
    const { container } = show()

    check(
      'banner live region absent',
      null,
      container.querySelector('.flow-banner [role="status"]'),
    )
  })

  it('keeps manual mode and unit switching behavior', async () => {
    const user = userEvent.setup()
    const data = makeData(['u1', 'u2', 'u3'], ['u1'])
    useAppState.setState({ status: 'ready', data, lastBackupAt: null, reload: async () => {} })
    show()

    let unitButton = screen.queryByRole('button', { name: t('data.prompt.unit') })
    check('default unit mode button exists', true, unitButton !== null)
    if (unitButton === null) return
    check('default unit mode', 'true', unitButton.getAttribute('aria-pressed'))

    const skeletonButton = screen.queryByRole('button', { name: t('data.prompt.skeleton') })
    check('skeleton mode button exists', true, skeletonButton !== null)
    if (skeletonButton === null) return
    await user.click(skeletonButton)

    const pressedSkeletonButton = screen.queryByRole('button', { name: t('data.prompt.skeleton') })
    check('manual skeleton mode button exists', true, pressedSkeletonButton !== null)
    if (pressedSkeletonButton === null) return
    check('manual skeleton mode', 'true', pressedSkeletonButton.getAttribute('aria-pressed'))

    unitButton = screen.queryByRole('button', { name: t('data.prompt.unit') })
    check('unit mode button exists after switching back', true, unitButton !== null)
    if (unitButton === null) return
    await user.click(unitButton)

    const pressedUnitButton = screen.queryByRole('button', { name: t('data.prompt.unit') })
    check('manual unit mode button exists', true, pressedUnitButton !== null)
    if (pressedUnitButton === null) return
    check('manual unit mode', 'true', pressedUnitButton.getAttribute('aria-pressed'))

    const select = screen.queryByLabelText(t('data.prompt.selectUnit')) as HTMLSelectElement | null
    check('unit select exists after manual unit mode', true, select !== null)
    if (select === null) return
    await user.selectOptions(select, 'u3')
    check('manual unit selection', 'u3', select.value)
  })
})
