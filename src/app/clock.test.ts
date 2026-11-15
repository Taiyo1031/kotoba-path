import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toIsoDate, getVirtualDate, setVirtualDate, getNow, getToday } from './clock'

describe('clock', () => {
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

  describe('toIsoDate', () => {
    it('ゼロ埋めする', () => {
      const input = new Date(2026, 0, 5)
      const expected = '2026-01-05'
      const actual = toIsoDate(input)
      expect(actual, `入力: ${input.toISOString()}, 期待: ${expected}`).toBe(expected)
    })

    it('月末を扱う', () => {
      const input = new Date(2026, 11, 31)
      const expected = '2026-12-31'
      const actual = toIsoDate(input)
      expect(actual, `入力: ${input.toISOString()}, 期待: ${expected}`).toBe(expected)
    })
  })

  describe('仮想日付', () => {
    it('設定して取得できる', () => {
      const input = '2026-01-05'
      setVirtualDate(input)
      const actual = getVirtualDate()
      expect(actual, `入力: ${input}, 期待: ${input}`).toBe(input)
    })

    it('null で削除できる', () => {
      setVirtualDate('2026-01-05')
      setVirtualDate(null)
      const actual = getVirtualDate()
      expect(actual, `入力: null, 期待: null`).toBeNull()
    })

    it('不正な値を無視する', () => {
      for (const bad of ['2026-02-30', 'abc']) {
        setVirtualDate(bad)
        const actual = getVirtualDate()
        expect(actual, `入力: ${bad}, 期待: null`).toBeNull()
      }
    })

    it('getToday が仮想日付を返す', () => {
      setVirtualDate('2026-01-05')
      const base = new Date(2025, 5, 15, 10, 30, 0, 0)
      const expected = '2026-01-05'
      const actual = getToday(base)
      expect(actual, `入力: base=${base.toISOString()}, 期待: ${expected}`).toBe(expected)
    })

    it('仮想日付が無ければ base の日付を返す', () => {
      const base = new Date(2025, 5, 15, 10, 30, 0, 0)
      const expected = '2025-06-15'
      const actual = getToday(base)
      expect(actual, `入力: base=${base.toISOString()}, 期待: ${expected}`).toBe(expected)
    })

    it('getNow が仮想日付の年月日と base の時刻を持つ', () => {
      setVirtualDate('2026-01-05')
      const base = new Date(2025, 5, 15, 10, 30, 45, 123)
      const actual = getNow(base)
      expect(actual.getFullYear(), `入力: base=${base.toISOString()}, 期待: 2026`).toBe(2026)
      expect(actual.getMonth(), `入力: base=${base.toISOString()}, 期待: 0`).toBe(0)
      expect(actual.getDate(), `入力: base=${base.toISOString()}, 期待: 5`).toBe(5)
      expect(actual.getHours(), `入力: base=${base.toISOString()}, 期待: 10`).toBe(10)
      expect(actual.getMinutes(), `入力: base=${base.toISOString()}, 期待: 30`).toBe(30)
      expect(actual.getSeconds(), `入力: base=${base.toISOString()}, 期待: 45`).toBe(45)
      expect(actual.getMilliseconds(), `入力: base=${base.toISOString()}, 期待: 123`).toBe(123)
    })

    it('localStorage が例外を投げても落ちない', () => {
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
      const actual = getVirtualDate()
      expect(actual, `入力: 例外, 期待: null`).toBeNull()
      expect(() => setVirtualDate('2026-01-05'), `入力: 2026-01-05, 期待: 例外なし`).not.toThrow()
      expect(() => setVirtualDate(null), `入力: null, 期待: 例外なし`).not.toThrow()
    })
  })
})
