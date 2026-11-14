import { describe, it, expect } from 'vitest'
import {
  levelForBand,
  downgradeLevel,
  pickFormat,
  initItemState,
  applyAnswer,
  nextItem,
  MAX_RECALLS,
} from './session'
import type { Band, Level, FormatAvailability, FormatChoice, ItemSessionState } from './session'

// 候補数 count の中から index 番目を必ず選ぶ rng
function rngSelecting(index: number, count: number): () => number {
  return () => (index + 0.5) / count
}

describe('levelForBand', () => {
  it('new → 0', () => {
    const band: Band = 'new'
    expect(levelForBand(band), `入力: ${band} / 期待: 0`).toBe(0)
  })
  it('learning → 1', () => {
    const band: Band = 'learning'
    expect(levelForBand(band), `入力: ${band} / 期待: 1`).toBe(1)
  })
  it('mature → 2', () => {
    const band: Band = 'mature'
    expect(levelForBand(band), `入力: ${band} / 期待: 2`).toBe(2)
  })
})

describe('downgradeLevel', () => {
  it('2 → 1', () => {
    const level: Level = 2
    expect(downgradeLevel(level), `入力: ${level} / 期待: 1`).toBe(1)
  })
  it('1 → 0', () => {
    const level: Level = 1
    expect(downgradeLevel(level), `入力: ${level} / 期待: 0`).toBe(0)
  })
  it('0 → 0', () => {
    const level: Level = 0
    expect(downgradeLevel(level), `入力: ${level} / 期待: 0`).toBe(0)
  })
  it('2 → 1 → 0 → 0 の連鎖', () => {
    let level: Level = 2
    const steps: Level[] = []
    for (let i = 0; i < 3; i++) {
      level = downgradeLevel(level)
      steps.push(level)
    }
    expect(steps, `入力: 2 / 期待: [1, 0, 0]`).toEqual([1, 0, 0])
  })
})

describe('pickFormat', () => {
  it('段階 0 は常に mcq の foreignToNative', () => {
    const availability: FormatAvailability = { hasSentence: true, hasSlotPhrase: true }
    const actual = pickFormat(0, availability, () => 0.5)
    expect(actual, `入力: level=0, availability=${JSON.stringify(availability)}`).toEqual({
      format: 'mcq',
      variant: 'foreignToNative',
    })
  })

  it('段階 1: hasSentence=true で全候補(mcq, typing, tiles)が選べる', () => {
    const availability: FormatAvailability = { hasSentence: true, hasSlotPhrase: false }
    const cases: Array<[number, FormatChoice]> = [
      [0, { format: 'mcq', variant: 'nativeToForeign' }],
      [1, { format: 'typing' }],
      [2, { format: 'tiles' }],
    ]
    for (const [index, expectedChoice] of cases) {
      const actual = pickFormat(1, availability, rngSelecting(index, cases.length))
      expect(
        actual,
        `入力: level=1, availability=${JSON.stringify(availability)}, 候補index=${index} / 期待: ${JSON.stringify(expectedChoice)}`,
      ).toEqual(expectedChoice)
    }
  })

  it('段階 1: hasSentence=false で tiles は候補に入らない(mcq, typing のみ)', () => {
    const availability: FormatAvailability = { hasSentence: false, hasSlotPhrase: false }
    const cases: Array<[number, FormatChoice]> = [
      [0, { format: 'mcq', variant: 'nativeToForeign' }],
      [1, { format: 'typing' }],
    ]
    for (const [index, expectedChoice] of cases) {
      const actual = pickFormat(1, availability, rngSelecting(index, cases.length))
      expect(
        actual,
        `入力: level=1, availability=${JSON.stringify(availability)}, 候補index=${index} / 期待: ${JSON.stringify(expectedChoice)}`,
      ).toEqual(expectedChoice)
    }
  })

  it('段階 2: hasSentence=true, hasSlotPhrase=true で cloze と phrase-slot が選べる', () => {
    const availability: FormatAvailability = { hasSentence: true, hasSlotPhrase: true }
    const cases: Array<[number, FormatChoice]> = [
      [0, { format: 'cloze' }],
      [1, { format: 'phrase-slot' }],
    ]
    for (const [index, expectedChoice] of cases) {
      const actual = pickFormat(2, availability, rngSelecting(index, cases.length))
      expect(
        actual,
        `入力: level=2, availability=${JSON.stringify(availability)}, 候補index=${index} / 期待: ${JSON.stringify(expectedChoice)}`,
      ).toEqual(expectedChoice)
    }
  })

  it('段階 2: hasSentence=true, hasSlotPhrase=false で cloze のみ', () => {
    const availability: FormatAvailability = { hasSentence: true, hasSlotPhrase: false }
    const actual = pickFormat(2, availability, () => 0.5)
    expect(actual, `入力: level=2, availability=${JSON.stringify(availability)}`).toEqual({
      format: 'cloze',
    })
  })

  it('段階 2: hasSentence=false, hasSlotPhrase=true で phrase-slot のみ', () => {
    const availability: FormatAvailability = { hasSentence: false, hasSlotPhrase: true }
    const actual = pickFormat(2, availability, () => 0.5)
    expect(actual, `入力: level=2, availability=${JSON.stringify(availability)}`).toEqual({
      format: 'phrase-slot',
    })
  })

  it('段階 2: 両方なしは段階 1 の規則(mcq, typing)', () => {
    const availability: FormatAvailability = { hasSentence: false, hasSlotPhrase: false }
    const cases: Array<[number, FormatChoice]> = [
      [0, { format: 'mcq', variant: 'nativeToForeign' }],
      [1, { format: 'typing' }],
    ]
    for (const [index, expectedChoice] of cases) {
      const actual = pickFormat(2, availability, rngSelecting(index, cases.length))
      expect(
        actual,
        `入力: level=2, availability=${JSON.stringify(availability)}, 候補index=${index} / 期待: ${JSON.stringify(expectedChoice)}`,
      ).toEqual(expectedChoice)
    }
  })

  it('同じ rng で同じ結果', () => {
    const availability: FormatAvailability = { hasSentence: true, hasSlotPhrase: true }
    const rng = () => 0.3
    const a = pickFormat(2, availability, rng)
    const b = pickFormat(2, availability, rng)
    expect(a, `入力: level=2, availability=${JSON.stringify(availability)}, rng=0.3`).toEqual(b)
  })
})

describe('initItemState', () => {
  it('band ごとに level を設定し、他は初期値', () => {
    const state = initItemState('w1', 'learning')
    expect(state, `入力: itemId=w1, band=learning`).toEqual({
      itemId: 'w1',
      level: 1,
      recalls: 0,
      correctCount: 0,
      wrongCount: 0,
      lastCorrect: null,
      done: false,
    })
  })
})

describe('applyAnswer', () => {
  it('正解で correctCount が加算され、level は維持される', () => {
    const input = initItemState('w1', 'learning')
    const actual = applyAnswer(input, true)
    expect(actual, `入力: ${JSON.stringify(input)}, correct=true`).toEqual({
      itemId: 'w1',
      level: 1,
      recalls: 1,
      correctCount: 1,
      wrongCount: 0,
      lastCorrect: true,
      done: false,
    })
  })

  it('誤答で wrongCount が加算され、level が 1 段階下がる', () => {
    const input = initItemState('w1', 'mature')
    const actual = applyAnswer(input, false)
    expect(actual, `入力: ${JSON.stringify(input)}, correct=false`).toEqual({
      itemId: 'w1',
      level: 1,
      recalls: 1,
      correctCount: 0,
      wrongCount: 1,
      lastCorrect: false,
      done: false,
    })
  })

  it('level 0 は誤答しても 0 のまま', () => {
    const input = initItemState('w1', 'new')
    const actual = applyAnswer(input, false)
    expect(actual, `入力: ${JSON.stringify(input)}, correct=false`).toEqual({
      itemId: 'w1',
      level: 0,
      recalls: 1,
      correctCount: 0,
      wrongCount: 1,
      lastCorrect: false,
      done: false,
    })
  })

  it('recalls が加算され、lastCorrect が更新される', () => {
    const input = initItemState('w1', 'learning')
    const first = applyAnswer(input, true)
    const second = applyAnswer(first, false)
    expect(second, `入力: ${JSON.stringify(first)}, correct=false`).toEqual({
      itemId: 'w1',
      level: 0,
      recalls: 2,
      correctCount: 1,
      wrongCount: 1,
      lastCorrect: false,
      done: false,
    })
  })

  it('入力が変更されない(Object.freeze した入力で例外にならない)', () => {
    const input = Object.freeze(initItemState('w1', 'learning'))
    const snapshot = JSON.stringify(input)
    const actual = applyAnswer(input, true)
    expect(actual, `入力: ${snapshot}, correct=true`).toEqual({
      itemId: 'w1',
      level: 1,
      recalls: 1,
      correctCount: 1,
      wrongCount: 0,
      lastCorrect: true,
      done: false,
    })
    expect(JSON.stringify(input), `入力: ${snapshot}`).toBe(snapshot)
  })

  it('2回正解で done(1回だけでは false)', () => {
    const s0 = initItemState('w1', 'learning')
    const s1 = applyAnswer(s0, true)
    expect(s1, `入力: ${JSON.stringify(s0)}, correct=true`).toEqual({
      itemId: 'w1',
      level: 1,
      recalls: 1,
      correctCount: 1,
      wrongCount: 0,
      lastCorrect: true,
      done: false,
    })
    const s2 = applyAnswer(s1, true)
    expect(s2, `入力: ${JSON.stringify(s1)}, correct=true`).toEqual({
      itemId: 'w1',
      level: 1,
      recalls: 2,
      correctCount: 2,
      wrongCount: 0,
      lastCorrect: true,
      done: true,
    })
  })

  it('誤答を挟んでも合計 2 回正解で done', () => {
    const s0 = initItemState('w1', 'learning')
    const s1 = applyAnswer(s0, true)
    const s2 = applyAnswer(s1, false)
    const s3 = applyAnswer(s2, true)
    expect(s3, `入力: ${JSON.stringify(s2)}, correct=true`).toEqual({
      itemId: 'w1',
      level: 0,
      recalls: 3,
      correctCount: 2,
      wrongCount: 1,
      lastCorrect: true,
      done: true,
    })
  })

  it('誤答を続けて recalls が 5 になると done(打ち切り)', () => {
    let state = initItemState('w1', 'learning')
    for (let i = 0; i < MAX_RECALLS; i++) {
      state = applyAnswer(state, false)
    }
    expect(state, `入力: 誤答を ${MAX_RECALLS} 回連続`).toEqual({
      itemId: 'w1',
      level: 0,
      recalls: MAX_RECALLS,
      correctCount: 0,
      wrongCount: MAX_RECALLS,
      lastCorrect: false,
      done: true,
    })
  })

  it('done の状態に applyAnswer を呼んでも状態をそのまま返す', () => {
    const s0 = initItemState('w1', 'learning')
    const s1 = applyAnswer(s0, true)
    const s2 = applyAnswer(s1, true)
    const s3 = applyAnswer(s2, true)
    expect(s3, `入力: ${JSON.stringify(s2)}, correct=true`).toBe(s2)
  })
})

describe('nextItem', () => {
  it('recalls が最も少ない項目を返す', () => {
    const a = initItemState('a', 'new') // recalls=0
    const b = applyAnswer(initItemState('b', 'new'), false) // recalls=1
    const c = applyAnswer(applyAnswer(initItemState('c', 'new'), false), false) // recalls=2
    const states = [a, b, c]
    const actual = nextItem(states)
    expect(actual, `入力: ${JSON.stringify(states)}`).toBe(a)
  })

  it('同数なら配列の先の項目を返す', () => {
    const a = initItemState('a', 'new')
    const b = initItemState('b', 'new')
    const states = [a, b]
    const actual = nextItem(states)
    expect(actual, `入力: ${JSON.stringify(states)}`).toBe(a)
  })

  it('すべて done なら null', () => {
    const a = initItemState('a', 'new')
    const b = initItemState('b', 'new')
    let sa = a
    let sb = b
    for (let i = 0; i < MAX_RECALLS; i++) {
      sa = applyAnswer(sa, false)
      sb = applyAnswer(sb, false)
    }
    const states = [sa, sb]
    const actual = nextItem(states)
    expect(actual, `入力: ${JSON.stringify(states)}`).toBeNull()
  })

  it('done の項目は飛ばす', () => {
    const a = initItemState('a', 'new')
    const b = initItemState('b', 'new')
    let sa = a
    for (let i = 0; i < MAX_RECALLS; i++) {
      sa = applyAnswer(sa, false)
    }
    const states = [sa, b]
    const actual = nextItem(states)
    expect(actual, `入力: ${JSON.stringify(states)}`).toBe(b)
  })

  it('空の配列なら null', () => {
    const states: ItemSessionState[] = []
    const actual = nextItem(states)
    expect(actual, `入力: ${JSON.stringify(states)}`).toBeNull()
  })
})
