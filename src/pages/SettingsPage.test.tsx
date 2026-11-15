import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSettings } from '../app/settings'
import { createTranslator, I18nProvider } from '../i18n'
import { ROUTES } from '../routes'
import type { StudyData } from '../schema'
import { useAppState } from '../state/appState'
import { SettingsPage } from './SettingsPage'

const { mockSaveProfile } = vi.hoisted(() => ({
  mockSaveProfile: vi.fn(),
}))

vi.mock('../db', () => ({
  getAppStore: () => ({
    saveProfile: (...args: unknown[]) => mockSaveProfile(...args),
  }),
}))

function makeData(profile?: Record<string, unknown>): StudyData {
  return {
    profile: profile ?? {
      targetLanguage: 'ms',
      goal: { studyDaysPerWeek: 3 },
    },
  } as unknown as StudyData
}

function setTtsVoices(voices: Array<{ lang: string }>) {
  const speechSynthesis = {
    getVoices: () =>
      voices.map((voice) => ({
        default: false,
        localService: true,
        name: voice.lang,
        voiceURI: `${voice.lang}.voice`,
        ...voice,
      })),
  }

  ;(window as unknown as Record<string, unknown>).speechSynthesis = speechSynthesis
  ;(globalThis as unknown as Record<string, unknown>).SpeechSynthesisUtterance = class {}
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <I18nProvider>
        <SettingsPage />
      </I18nProvider>
    </MemoryRouter>,
  )
}

function getSelect(id: string): HTMLSelectElement {
  const el = document.getElementById(id)
  expect(el, `入力: ${id}、期待値: 存在する、実際: 未検出`).not.toBeNull()
  if (el === null) {
    throw new Error(`入力: ${id}、期待値: 存在する、実際: 未検出`)
  }
  return el as HTMLSelectElement
}

function getInput(id: string): HTMLInputElement {
  const el = document.getElementById(id)
  expect(el, `入力: ${id}、期待値: 存在する、実際: 未検出`).not.toBeNull()
  if (el === null) {
    throw new Error(`入力: ${id}、期待値: 存在する、実際: 未検出`)
  }
  return el as HTMLInputElement
}

function getPageText(): string {
  return document.querySelector('.settings-page')?.textContent ?? ''
}

function expectSingleVisibleText(text: string) {
  const matches = screen.queryAllByText(text)
  expect(matches.length, `入力: ${text}、期待値: 1個だけ、実際: ${matches.length}個`).toBe(1)
}

function expectInputByLabelText(labelText: string, expectedTag?: string) {
  const el = screen.queryByLabelText(labelText)
  expect(el, `入力: ${labelText}、期待値: ラベルで到達できる入力、実際: 未検出`).not.toBeNull()

  if (el === null) {
    throw new Error(`入力: ${labelText}、期待値: ラベルで到達できる入力、実際: 未検出`)
  }

  if (expectedTag !== undefined) {
    const actualTag = el.tagName.toLowerCase()
    expect(actualTag, `入力: ${labelText}、期待値: <${expectedTag}>、実際: <${actualTag}>`).toBe(
      expectedTag,
    )
  }
}

beforeEach(() => {
  localStorage.clear()
  mockSaveProfile.mockClear()
  useAppState.setState({
    status: 'ready',
    data: null,
    lastBackupAt: null,
    reload: async () => {},
  })
})

describe('SettingsPage', () => {
  it.each([true, false])('shows learning goals only with data: %s', (hasData) => {
    useAppState.setState({ data: hasData ? makeData() : null })
    renderPage()
    const heading = screen.queryByRole('heading', {
      name: createTranslator('ja')('goal.section.title'),
    })
    expect(
      heading !== null,
      `入力: data=${hasData}、期待値: ${hasData}、実際: ${heading !== null}`,
    ).toBe(hasData)
  })

  it('見出しとラベルの重複をなくし、各入力をラベルから到達できる', () => {
    setTtsVoices([])
    useAppState.setState({
      status: 'ready',
      data: makeData(),
      lastBackupAt: null,
      reload: async () => {},
    })

    renderPage()

    expectSingleVisibleText('UI言語')
    expectSingleVisibleText('1日の目標')
    expectSingleVisibleText('学習日数/週')
    expectSingleVisibleText('読み上げを使う')

    expectInputByLabelText('UI言語', 'select')
    expectInputByLabelText('1日の目標', 'input')
    expectInputByLabelText('学習日数/週', 'select')
    expectInputByLabelText('読み上げを使う', 'input')
  })

  it('UI 言語を切り替えると画面の文言が変わる', async () => {
    const user = userEvent.setup()
    renderPage()

    const beforeText = getPageText()
    const select = getSelect('language-select')

    await user.selectOptions(select, 'en')

    const afterText = getPageText()
    expect(afterText, `入力: en、期待値: ${beforeText} と異なる文言、実際: ${afterText}`).not.toBe(
      beforeText,
    )
  })

  it('隠しリンクが /debug を指す', () => {
    renderPage()

    const link = document.querySelector<HTMLAnchorElement>('.debug-link')
    expect(link, '入力: .debug-link、期待値: 存在する、実際: 未検出').not.toBeNull()
    expect(
      link?.getAttribute('href'),
      `入力: .debug-link、期待値: /debug、実際: ${link?.getAttribute('href')}`,
    ).toBe('/debug')
  })

  it('1日の目標を変えると保存される', async () => {
    const user = userEvent.setup()
    renderPage()

    const input = getInput('daily-goal')

    await user.clear(input)
    await user.type(input, '50')

    expect(getSettings().dailyGoal, `入力: 50、期待値: 50、実際: ${getSettings().dailyGoal}`).toBe(
      50,
    )
  })

  it('1日の目標が範囲外なら保存されず直前の値に戻る', async () => {
    const user = userEvent.setup()
    renderPage()

    const before = getSettings().dailyGoal
    const input = getInput('daily-goal')

    await user.clear(input)
    await user.type(input, '0')

    expect(
      getSettings().dailyGoal,
      `入力: 0、期待値: ${before}、実際: ${getSettings().dailyGoal}`,
    ).toBe(before)
    expect(input.value, `入力: 0、期待値: ${String(before)}、実際: ${input.value}`).toBe(
      String(before),
    )

    await user.clear(input)
    await user.type(input, '201')

    expect(
      getSettings().dailyGoal,
      `入力: 201、期待値: ${before}、実際: ${getSettings().dailyGoal}`,
    ).toBe(before)
    expect(input.value, `入力: 201、期待値: ${String(before)}、実際: ${input.value}`).toBe(
      String(before),
    )
  })

  it('data があれば学習日数/週を変えて saveProfile を呼ぶ', async () => {
    const user = userEvent.setup()
    useAppState.setState({
      status: 'ready',
      data: makeData(),
      lastBackupAt: null,
      reload: async () => {},
    })

    renderPage()

    const select = getSelect('study-days')

    await user.selectOptions(select, '5')

    expect(mockSaveProfile).toHaveBeenCalledTimes(1)
    const expected = {
      targetLanguage: 'ms',
      goal: { studyDaysPerWeek: 5 },
    }
    const actual = mockSaveProfile.mock.calls[0]?.[0]
    expect(
      actual,
      `入力: 5、期待値: ${JSON.stringify(expected)}、実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('data がなければ学習日数/週が無効で noProfile を出す', () => {
    useAppState.setState({
      status: 'ready',
      data: null,
      lastBackupAt: null,
      reload: async () => {},
    })

    renderPage()

    const select = document.getElementById('study-days') as HTMLSelectElement | null
    expect(select, '入力: study-days、期待値: 無効または非存在、実際: 有効').toBeNull()

    const note = screen.getByTestId('settings-no-profile')
    expect(
      note.textContent ?? '',
      `入力: data なし、期待値: settings.noProfile が表示される、実際: ${note.textContent}`,
    ).not.toBe('')
  })

  it('声があれば読み上げチェックボックスが有効で切り替えられる', async () => {
    const user = userEvent.setup()
    setTtsVoices([{ lang: 'ms-MY' }])
    useAppState.setState({
      status: 'ready',
      data: makeData(),
      lastBackupAt: null,
      reload: async () => {},
    })

    renderPage()

    const checkbox = getInput('tts-enabled')
    expect(
      checkbox.disabled,
      `入力: voices=[ms-MY]、期待値: false、実際: ${checkbox.disabled}`,
    ).toBe(false)

    const before = getSettings().ttsEnabled
    await user.click(checkbox)

    expect(
      getSettings().ttsEnabled,
      `入力: click、期待値: ${String(!before)}、実際: ${getSettings().ttsEnabled}`,
    ).toBe(!before)
  })

  it('声がなければ読み上げチェックボックスが無効で unavailable を出す', () => {
    setTtsVoices([])
    useAppState.setState({
      status: 'ready',
      data: makeData(),
      lastBackupAt: null,
      reload: async () => {},
    })

    renderPage()

    const checkbox = getInput('tts-enabled')
    expect(checkbox.disabled, `入力: voices=[]、期待値: true、実際: ${checkbox.disabled}`).toBe(
      true,
    )

    const note = screen.getByTestId('settings-tts-unavailable')
    expect(
      note.textContent ?? '',
      `入力: voices=[]、期待値: settings.tts.unavailable が表示される、実際: ${note.textContent}`,
    ).not.toBe('')
  })

  describe('intro link', () => {
    it('shows the intro link before the LLM connection section', () => {
      renderPage()

      const text = createTranslator('ja')('settings.intro.link')
      const link = screen.queryByRole('link', { name: text })
      const href = link?.getAttribute('href')
      expect(href, `入力: ${text}、期待値: ${ROUTES.intro}、実際: ${href}`).toBe(ROUTES.intro)
      const hasClass = link?.classList.contains('intro-link')
      expect(hasClass, `入力: ${text}、期待値: intro-link クラスあり、実際: ${hasClass}`).toBe(true)

      const heading = document.getElementById('settings-llm-heading')
      const beforeHeading =
        link !== null &&
        heading !== null &&
        Boolean(link.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(
        beforeHeading,
        `入力: ${text}、期待値: LLM 接続の見出しより前、実際: ${beforeHeading}`,
      ).toBe(true)
    })
  })
  it('toggles reading through its accessible label and persists it', async () => {
    const user = userEvent.setup()
    setTtsVoices([])
    renderPage()
    const checkbox = screen.getByLabelText('読み(カナ・ローマ字)を表示') as HTMLInputElement
    expect(checkbox.checked, 'Input: unset').toBe(true)
    await user.click(checkbox)
    expect(getSettings().showReading, 'Input: uncheck reading').toBe(false)
    expect(checkbox.checked, 'Input: uncheck reading').toBe(false)
    await user.click(checkbox)
    expect(getSettings().showReading, 'Input: recheck reading').toBe(true)
  })
})
