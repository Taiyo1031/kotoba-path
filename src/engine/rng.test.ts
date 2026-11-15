import { describe, expect, it } from 'vitest'
import { createRng, hashSeed, pickOne, sample, shuffle } from './rng'

function firstValues(seed: number, count: number): number[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => rng())
}

function expectUnitInterval(value: number, input: string): void {
  expect(value >= 0 && value < 1, `入力: ${input}\n期待値: [0, 1)\n実際の値: ${value}`).toBe(true)
}

function expectRatio(ratio: number, position: number, element: number): void {
  const input = `位置: ${position}, 要素: ${element}`
  expect(ratio >= 0.2 && ratio <= 0.3, `${input}\n期待値: [0.2, 0.3]\n実際の値: ${ratio}`).toBe(
    true,
  )
}

describe('createRng', () => {
  it('同じシードで最初の5個が毎回一致する', () => {
    const seed = 42
    const expected = firstValues(seed, 5)
    const actual = firstValues(seed, 5)
    expect(
      actual,
      `入力: シード ${seed}\n期待値: ${JSON.stringify(expected)}\n実際の値: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('シードが違えば数列が違う', () => {
    const seqA = firstValues(1, 3)
    const seqB = firstValues(2, 3)
    expect(
      seqB,
      `入力: シード 1 と 2\n期待値: ${JSON.stringify(seqA)} と異なる\n実際の値: ${JSON.stringify(seqB)}`,
    ).not.toEqual(seqA)
  })

  it('すべての値が 0 以上 1 未満', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i += 1) {
      expectUnitInterval(rng(), `シード 7 の ${i} 番目`)
    }
  })

  it('createRng(12345) の最初の値が作り直しても一致する', () => {
    const first = createRng(12345)()
    const second = createRng(12345)()
    expect(second, `入力: シード 12345\n期待値: ${first}\n実際の値: ${second}`).toBe(first)
  })

  it('シードが負でも 0 以上 1 未満の数列を返す', () => {
    const rng = createRng(-987654321)
    for (let i = 0; i < 100; i += 1) {
      expectUnitInterval(rng(), `シード -987654321 の ${i} 番目`)
    }
  })
})

describe('hashSeed', () => {
  it("同じ入力で同じ値を返す('abc')", () => {
    const a = hashSeed('abc')
    const b = hashSeed('abc')
    expect(b, `入力: 'abc'\n期待値: ${a}\n実際の値: ${b}`).toBe(a)
  })

  it("'abc' と 'abd' で違う値を返す", () => {
    const a = hashSeed('abc')
    const b = hashSeed('abd')
    expect(b, `入力: 'abc'=${a}, 'abd'\n期待値: ${a} と異なる\n実際の値: ${b}`).not.toBe(a)
  })

  it('結果が 0 以上 4294967295 以下の整数', () => {
    for (const text of ['', 'abc', 'hello world', '日本語']) {
      const h = hashSeed(text)
      expect(
        h >= 0 && h <= 4294967295 && Number.isInteger(h),
        `入力: ${JSON.stringify(text)}\n期待値: [0, 4294967295] の整数\n実際の値: ${h}`,
      ).toBe(true)
    }
  })
})

describe('shuffle', () => {
  it('要素の集合が変わらない(並べ替えのみ)', () => {
    const items = [1, 2, 3, 4, 5]
    const result = shuffle(items, createRng(99))
    expect(
      [...result].sort((a, b) => a - b),
      `入力: ${JSON.stringify(items)}\n期待値: [1,2,3,4,5]\n実際の値: ${JSON.stringify(result)}`,
    ).toEqual([1, 2, 3, 4, 5])
  })

  it('元の配列が変更されない', () => {
    const items = ['a', 'b', 'c']
    const before = [...items]
    shuffle(items, createRng(7))
    expect(
      items,
      `入力: ${JSON.stringify(before)}\n期待値: ${JSON.stringify(before)}\n実際の値: ${JSON.stringify(items)}`,
    ).toEqual(before)
  })

  it('同じシードで同じ順になる', () => {
    const items = [10, 20, 30, 40]
    const a = shuffle(items, createRng(5))
    const b = shuffle(items, createRng(5))
    expect(
      b,
      `入力: シード 5\n期待値: ${JSON.stringify(a)}\n実際の値: ${JSON.stringify(b)}`,
    ).toEqual(a)
  })

  it('空配列で壊れない', () => {
    const result = shuffle([], createRng(1))
    expect(result, `入力: []\n期待値: []\n実際の値: ${JSON.stringify(result)}`).toEqual([])
  })

  it('1要素で壊れない', () => {
    const result = shuffle([42], createRng(1))
    expect(result, `入力: [42]\n期待値: [42]\n実際の値: ${JSON.stringify(result)}`).toEqual([42])
  })

  it('偏りがない: 各位置に各要素が来る割合が 0.20〜0.30', () => {
    const items = [0, 1, 2, 3]
    const n = 4000
    const counts: number[][] = Array.from({ length: items.length }, () => [0, 0, 0, 0])

    for (let i = 0; i < n; i += 1) {
      const result = shuffle(items, createRng(i))
      for (let p = 0; p < result.length; p += 1) {
        const element = result[p] as number
        const row = counts[p]
        if (row === undefined) continue
        row[element] = (row[element] ?? 0) + 1
      }
    }

    for (let p = 0; p < items.length; p += 1) {
      const row = counts[p]
      expect(row !== undefined, `位置: ${p}\n期待値: 定義済み\n実際の値: undefined`).toBe(true)
      if (row === undefined) continue

      for (const e of items) {
        const ratio = (row[e] ?? 0) / n
        expectRatio(ratio, p, e)
      }
    }
  })
})

describe('pickOne', () => {
  it('空なら undefined', () => {
    const result = pickOne([], createRng(1))
    expect(
      result,
      `入力: []\n期待値: undefined\n実際の値: ${JSON.stringify(result)}`,
    ).toBeUndefined()
  })

  it('同じシードで同じ結果', () => {
    const items = ['x', 'y', 'z']
    const a = pickOne(items, createRng(3))
    const b = pickOne(items, createRng(3))
    expect(b, `入力: シード 3\n期待値: ${JSON.stringify(a)}\n実際の値: ${JSON.stringify(b)}`).toBe(
      a,
    )
  })

  it('要素の範囲から選ぶ', () => {
    const items = [10, 20, 30]
    for (let i = 0; i < 50; i += 1) {
      const result = pickOne(items, createRng(i))
      const ok = result !== undefined && items.includes(result)
      expect(
        ok,
        `入力: シード ${i}\n期待値: true\n実際の値: false (result=${JSON.stringify(result)})`,
      ).toBe(true)
    }
  })
})

describe('sample', () => {
  it('重複がない・個数が正しい', () => {
    const items = [1, 2, 3, 4, 5]
    const result = sample(items, 3, createRng(8))
    expect(result.length, `入力: count=3\n期待値: 3\n実際の値: ${result.length}`).toBe(3)
    expect(
      new Set(result).size,
      `入力: count=3\n期待値: 3\n実際の値: ${new Set(result).size}`,
    ).toBe(3)
  })

  it('count が多すぎても全部', () => {
    const items = [1, 2, 3]
    const result = sample(items, 10, createRng(8))
    expect(
      [...result].sort((a, b) => a - b),
      `入力: count=10\n期待値: [1,2,3]\n実際の値: ${JSON.stringify(result)}`,
    ).toEqual([1, 2, 3])
  })

  it('count が 0 以下で空', () => {
    const items = [1, 2, 3]
    const zero = sample(items, 0, createRng(8))
    expect(zero, `入力: count=0\n期待値: []\n実際の値: ${JSON.stringify(zero)}`).toEqual([])

    const negative = sample(items, -5, createRng(8))
    expect(negative, `入力: count=-5\n期待値: []\n実際の値: ${JSON.stringify(negative)}`).toEqual(
      [],
    )
  })

  it('同じシードで同じ結果', () => {
    const items = [1, 2, 3, 4, 5]
    const a = sample(items, 2, createRng(6))
    const b = sample(items, 2, createRng(6))
    expect(
      b,
      `入力: シード 6\n期待値: ${JSON.stringify(a)}\n実際の値: ${JSON.stringify(b)}`,
    ).toEqual(a)
  })
})
