import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ONBOARDED_KEY, isOnboarded, setOnboarded } from './onboarding'

describe('onboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態は false', () => {
    const actual = isOnboarded()
    expect(actual, `入力: 初期状態, 期待: false`).toBe(false)
  })

  it('setOnboarded(true) のあと true', () => {
    setOnboarded(true)
    const actual = isOnboarded()
    expect(actual, `入力: setOnboarded(true), 期待: true`).toBe(true)
  })

  it('setOnboarded(false) のあと false', () => {
    setOnboarded(true)
    setOnboarded(false)
    const actual = isOnboarded()
    expect(actual, `入力: setOnboarded(true) -> setOnboarded(false), 期待: false`).toBe(false)
  })

  it('保存される値は "1"', () => {
    setOnboarded(true)
    const actual = localStorage.getItem(ONBOARDED_KEY)
    expect(actual, `入力: setOnboarded(true), 期待: "1"`).toBe('1')
  })

  it('localStorage が例外を投げる環境でも isOnboarded() は false を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x')
    })
    const actual = isOnboarded()
    expect(actual, `入力: localStorage.getItem が例外を投げる, 期待: false`).toBe(false)
  })

  it('localStorage が例外を投げる環境でも setOnboarded(true) は例外を投げない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('x')
    })
    expect(() => {
      setOnboarded(true)
    }, `入力: localStorage.setItem が例外を投げる, 期待: 例外を投げない`).not.toThrow()
  })

  it('localStorage が例外を投げる環境でも setOnboarded(false) は例外を投げない', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('x')
    })
    expect(() => {
      setOnboarded(false)
    }, `入力: localStorage.removeItem が例外を投げる, 期待: 例外を投げない`).not.toThrow()
  })
})
