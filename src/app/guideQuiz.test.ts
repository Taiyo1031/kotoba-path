import { describe, expect, it } from 'vitest'
import type { Guide, GuideSound } from '../schema'
import { buildGuideQuiz, isGuideQuizAvailable } from './guideQuiz'

function makeSound(overrides: Partial<GuideSound> = {}): GuideSound {
  return {
    id: overrides.id ?? 's',
    grapheme: overrides.grapheme ?? 'g',
    reading: overrides.reading ?? 'r',
    ipa: '',
    note: '',
    examples: overrides.examples ?? [],
    confusableWith: overrides.confusableWith ?? [],
  }
}

function makeGuide(sounds: GuideSound[]): Guide {
  return {
    version: 1,
    verified: false,
    generatedBy: { tool: 'test', at: '2026-01-01T00:00:00.000Z' },
    intro: '',
    rules: [],
    sounds,
  }
}

// 読みもつづりもすべて異なる8音
function makeEightSounds(): GuideSound[] {
  return [
    makeSound({ id: 'a', grapheme: 'ba', reading: 'バ' }),
    makeSound({ id: 'b', grapheme: 'pa', reading: 'パ' }),
    makeSound({ id: 'c', grapheme: 'ma', reading: 'マ' }),
    makeSound({ id: 'd', grapheme: 'na', reading: 'ナ' }),
    makeSound({ id: 'e', grapheme: 'ha', reading: 'ハ' }),
    makeSound({ id: 'f', grapheme: 'ga', reading: 'ガ' }),
    makeSound({ id: 'g', grapheme: 'da', reading: 'ダ' }),
    makeSound({ id: 'h', grapheme: 'ta', reading: 'タ' }),
  ]
}

describe('isGuideQuizAvailable', () => {
  it('音が3つ以下なら false', () => {
    const guide = makeGuide([
      makeSound({ id: 'a', grapheme: 'ba', reading: 'バ' }),
      makeSound({ id: 'b', grapheme: 'pa', reading: 'パ' }),
      makeSound({ id: 'c', grapheme: 'ma', reading: 'マ' }),
    ])
    expect(isGuideQuizAvailable(guide), `入力: ${JSON.stringify(guide)}`).toBe(false)
  })

  it('異なる読みが3つ以下なら false(音が8つでも)', () => {
    const guide = makeGuide([
      ...makeEightSounds().map((s, i) => ({ ...s, id: `x${i}`, reading: 'バ' })),
    ])
    expect(isGuideQuizAvailable(guide), `入力: ${JSON.stringify(guide)}`).toBe(false)
  })

  it('異なるつづりが3つ以下なら false(音が8つでも)', () => {
    const guide = makeGuide([
      ...makeEightSounds().map((s, i) => ({ ...s, id: `x${i}`, grapheme: 'ba' })),
    ])
    expect(isGuideQuizAvailable(guide), `入力: ${JSON.stringify(guide)}`).toBe(false)
  })

  it('読み・つづりがそれぞれ4種類以上なら true', () => {
    const guide = makeGuide(makeEightSounds())
    expect(isGuideQuizAvailable(guide), `入力: ${JSON.stringify(guide)}`).toBe(true)
  })
})

describe('buildGuideQuiz', () => {
  it('利用不可なら空配列を返す', () => {
    const guide = makeGuide([
      makeSound({ id: 'a', grapheme: 'ba', reading: 'バ' }),
      makeSound({ id: 'b', grapheme: 'pa', reading: 'パ' }),
      makeSound({ id: 'c', grapheme: 'ma', reading: 'マ' }),
    ])
    expect(buildGuideQuiz(guide, 42), `入力: ${JSON.stringify(guide)}`).toEqual([])
  })

  it('音が8つで count=5 → 5問・4択重複なし・正解が options[answerIndex]・soundId 重複なし', () => {
    const guide = makeGuide(makeEightSounds())
    const questions = buildGuideQuiz(guide, 7, 5)
    expect(questions.length, `入力: ${JSON.stringify({ seed: 7, count: 5 })}`).toBe(5)
    for (const q of questions) {
      expect(q.options.length, `問題: ${JSON.stringify(q)}`).toBe(4)
      expect(new Set(q.options).size, `問題: ${JSON.stringify(q)}`).toBe(4)
      const sound = guide.sounds.find((s) => s.id === q.soundId) as GuideSound
      if (q.kind === 'graphemeToReading') {
        expect(q.value, `問題: ${JSON.stringify(q)}`).toBe(sound.grapheme)
        expect(q.options[q.answerIndex], `問題: ${JSON.stringify(q)}`).toBe(sound.reading)
      } else if (q.kind === 'readingToGrapheme') {
        expect(q.value, `問題: ${JSON.stringify(q)}`).toBe(sound.reading)
        expect(q.options[q.answerIndex], `問題: ${JSON.stringify(q)}`).toBe(sound.grapheme)
      }
    }
    const soundIds = questions.map((q) => q.soundId)
    expect(new Set(soundIds).size, `soundIds: ${JSON.stringify(soundIds)}`).toBe(5)
  })

  it('同じ (guide, seed, count) で2回呼ぶと完全に等しい', () => {
    const guide = makeGuide(makeEightSounds())
    const first = buildGuideQuiz(guide, 1234, 6)
    const second = buildGuideQuiz(guide, 1234, 6)
    expect(second, `入力: ${JSON.stringify({ seed: 1234, count: 6 })}`).toEqual(first)
  })

  it('別の seed では結果が異なる', () => {
    const guide = makeGuide(makeEightSounds())
    const a = buildGuideQuiz(guide, 11, 8)
    const b = buildGuideQuiz(guide, 22, 8)
    expect(JSON.stringify(b), `入力: seed=11 と seed=22`).not.toBe(JSON.stringify(a))
  })

  it('confusableWith の音の reading が誤答に含まれる', () => {
    const guide = makeGuide([
      ...makeEightSounds(),
      makeSound({ id: 'z', grapheme: 'za', reading: 'ザ', confusableWith: ['a'] }),
    ])
    let found = false
    for (const q of buildGuideQuiz(guide, 99, 20)) {
      if (q.kind === 'graphemeToReading' && q.soundId === 'z') {
        expect(q.options, `問題: ${JSON.stringify(q)}`).toContain('バ')
        found = true
      }
    }
    expect(found, `入力: seed=99 count=20`).toBe(true)
  })

  it('読み付き例が答え以外に3種類以上あると、3問目(index 2)は exampleToReading', () => {
    const guide = makeGuide(
      makeEightSounds().map((s, i) => ({
        ...s,
        examples: [{ target: `word${i}`, reading: `例読み${i}`, meaning: '意味' }],
      })),
    )
    const questions = buildGuideQuiz(guide, 5, 3)
    expect(questions.length, `入力: ${JSON.stringify({ seed: 5, count: 3 })}`).toBe(3)
    const q = questions[2] as (typeof questions)[number]
    expect(q.kind, `問題: ${JSON.stringify(q)}`).toBe('exampleToReading')
    const sound = guide.sounds.find((s) => s.id === q.soundId) as GuideSound
    const example = sound.examples[0] as { target: string; reading: string }
    expect(q.value, `問題: ${JSON.stringify(q)}`).toBe(example.target)
    expect(q.options[q.answerIndex], `問題: ${JSON.stringify(q)}`).toBe(example.reading)
  })

  it('例が無いガイドでは exampleToReading は出ない', () => {
    const guide = makeGuide(makeEightSounds())
    const questions = buildGuideQuiz(guide, 3, 20)
    expect(questions.length, `入力: ${JSON.stringify({ seed: 3, count: 20 })}`).toBe(20)
    for (const q of questions) {
      expect(q.kind, `問題: ${JSON.stringify(q)}`).not.toBe('exampleToReading')
    }
  })

  it('count が 0 や 100 のとき、1〜20 に収まる', () => {
    const guide = makeGuide(makeEightSounds())
    expect(buildGuideQuiz(guide, 1, 0).length, `入力: count=0`).toBe(1)
    expect(buildGuideQuiz(guide, 1, 100).length, `入力: count=100`).toBeLessThanOrEqual(20)
  })

  it('音の数(8)より大きい count=12 でも12問作れる', () => {
    const guide = makeGuide(makeEightSounds())
    expect(
      buildGuideQuiz(guide, 4, 12).length,
      `入力: ${JSON.stringify({ seed: 4, count: 12 })}`,
    ).toBe(12)
  })

  it('入力の guide が変更されない', () => {
    const guide = makeGuide(makeEightSounds())
    const before = JSON.stringify(guide)
    buildGuideQuiz(guide, 8, 12)
    expect(JSON.stringify(guide), `入力: ${before}`).toBe(before)
  })
})
