import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SETTINGS_KEY, DEFAULT_SETTINGS, getSettings, saveSettings } from './settings'
import type { AppSettings } from './settings'

describe('settings', () => {
  beforeEach(() => {
    try {
      localStorage.clear()
    } catch {
      // 無視
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('既定値を返す', () => {
    const actual = getSettings()
    expect(actual, `入力: 未設定, 期待: ${JSON.stringify(DEFAULT_SETTINGS)}`).toEqual(
      DEFAULT_SETTINGS,
    )
  })

  it('保存した値を読み出す', () => {
    const input = { dailyGoal: 30, ttsEnabled: false }
    const expected = { showReading: true, dailyGoal: 30, ttsEnabled: false }
    const saved = saveSettings(input)
    expect(saved, `入力: ${JSON.stringify(input)}, 期待: ${JSON.stringify(expected)}`).toEqual(
      expected,
    )
    const actual = getSettings()
    expect(actual, `入力: ${JSON.stringify(input)}, 期待: ${JSON.stringify(expected)}`).toEqual(
      expected,
    )
  })

  it('部分更新で片方だけ変更する', () => {
    saveSettings({ dailyGoal: 40, ttsEnabled: true })
    const input = { ttsEnabled: false }
    const expected = { showReading: true, dailyGoal: 40, ttsEnabled: false }
    const actual = saveSettings(input)
    expect(actual, `入力: ${JSON.stringify(input)}, 期待: ${JSON.stringify(expected)}`).toEqual(
      expected,
    )
    expect(
      getSettings(),
      `入力: ${JSON.stringify(input)}, 期待: ${JSON.stringify(expected)}`,
    ).toEqual(expected)
  })

  it('不正な dailyGoal を無視する', () => {
    const bads: unknown[] = [0, 201, 1.5, '30']
    for (const bad of bads) {
      const input = { dailyGoal: bad } as unknown as Partial<AppSettings>
      const expected = {
        showReading: true,
        dailyGoal: DEFAULT_SETTINGS.dailyGoal,
        ttsEnabled: true,
      }
      const actual = saveSettings(input)
      expect(actual, `入力: ${JSON.stringify(input)}, 期待: ${JSON.stringify(expected)}`).toEqual(
        expected,
      )
    }
  })

  it('boolean でない ttsEnabled を無視する', () => {
    const bads: unknown[] = ['true', 1, null, undefined]
    for (const bad of bads) {
      const input = { ttsEnabled: bad } as unknown as Partial<AppSettings>
      const expected = {
        showReading: true,
        dailyGoal: DEFAULT_SETTINGS.dailyGoal,
        ttsEnabled: true,
      }
      const actual = saveSettings(input)
      expect(actual, `入力: ${JSON.stringify(input)}, 期待: ${JSON.stringify(expected)}`).toEqual(
        expected,
      )
    }
  })

  it('壊れた JSON でも既定値を返す', () => {
    localStorage.setItem(SETTINGS_KEY, '{oops')
    const actual = getSettings()
    expect(actual, `入力: {oops, 期待: ${JSON.stringify(DEFAULT_SETTINGS)}`).toEqual(
      DEFAULT_SETTINGS,
    )
  })

  it('保存された不正な値は読み出し時に無視する', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ dailyGoal: 0, ttsEnabled: 'x' }))
    const actual = getSettings()
    expect(
      actual,
      `入力: {dailyGoal:0,ttsEnabled:"x"}, 期待: ${JSON.stringify(DEFAULT_SETTINGS)}`,
    ).toEqual(DEFAULT_SETTINGS)
  })

  it('localStorage が例外を投げても既定値を返す', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('boom')
      },
      setItem: () => {
        throw new Error('boom')
      },
      removeItem: () => {
        throw new Error('boom')
      },
    })
    const actual = getSettings()
    expect(actual, `入力: 例外, 期待: ${JSON.stringify(DEFAULT_SETTINGS)}`).toEqual(
      DEFAULT_SETTINGS,
    )
  })

  it('localStorage が例外を投げても saveSettings は重ねた結果を返す', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('boom')
      },
      setItem: () => {
        throw new Error('boom')
      },
      removeItem: () => {
        throw new Error('boom')
      },
    })
    const input = { dailyGoal: 50 }
    const expected = { showReading: true, dailyGoal: 50, ttsEnabled: true }
    const actual = saveSettings(input)
    expect(actual, `入力: ${JSON.stringify(input)}, 期待: ${JSON.stringify(expected)}`).toEqual(
      expected,
    )
  })
  it('defaults reading to true and persists false', () => {
    expect(getSettings().showReading, 'Input: unset').toBe(true)
    expect(saveSettings({ showReading: false }).showReading, 'Input: false').toBe(false)
    expect(getSettings().showReading, 'Input: reload after false').toBe(false)
  })
  it.each(['true', 1, null, undefined, {}, []])('ignores non-boolean reading %j', (bad) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showReading: bad }))
    expect(getSettings().showReading, 'Input stored: ' + JSON.stringify(bad)).toBe(true)
    saveSettings({ showReading: false })
    const actual = saveSettings({ showReading: bad } as unknown as Partial<AppSettings>)
    expect(actual.showReading, 'Input update: ' + JSON.stringify(bad)).toBe(false)
    expect(getSettings().showReading, 'Input reload: ' + JSON.stringify(bad)).toBe(false)
  })
})
