import { describe, expect, it } from 'vitest'
import { createRng, hashSeed } from './rng'
import { buildTiles, checkTiles, normalizeToken, tokenize } from './tiles'

describe('tokenize', () => {
  it('句読点を除去する', () => {
    const input = 'Saya makan nasi.'
    const expected = ['Saya', 'makan', 'nasi']
    expect(
      tokenize(input),
      `入力: ${JSON.stringify(input)}, 期待値: ${JSON.stringify(expected)}`,
    ).toEqual(expected)
  })

  it('連続空白と全角空白で分ける', () => {
    const input = 'a   b　c'
    const expected = ['a', 'b', 'c']
    expect(
      tokenize(input),
      `入力: ${JSON.stringify(input)}, 期待値: ${JSON.stringify(expected)}`,
    ).toEqual(expected)
  })

  it('記号だけの語を捨てる', () => {
    const input = 'a . b'
    const expected = ['a', 'b']
    expect(
      tokenize(input),
      `入力: ${JSON.stringify(input)}, 期待値: ${JSON.stringify(expected)}`,
    ).toEqual(expected)
  })

  it('空文字で空配列を返す', () => {
    const input = ''
    const expected: string[] = []
    expect(
      tokenize(input),
      `入力: ${JSON.stringify(input)}, 期待値: ${JSON.stringify(expected)}`,
    ).toEqual(expected)
  })

  it('大文字小文字を保つ', () => {
    const input = 'Saya Makan Nasi'
    const expected = ['Saya', 'Makan', 'Nasi']
    expect(
      tokenize(input),
      `入力: ${JSON.stringify(input)}, 期待値: ${JSON.stringify(expected)}`,
    ).toEqual(expected)
  })
})

describe('normalizeToken', () => {
  it('NFC に正規化して小文字にする', () => {
    const input = 'Café'
    const expected = 'café'
    expect(normalizeToken(input), `入力: ${JSON.stringify(input)}, 期待値: ${expected}`).toBe(
      expected,
    )
  })
})

describe('buildTiles', () => {
  it('answer と prompt を設定する', () => {
    const source = { id: 'w1', target: 'Saya makan nasi', meaning: 'I eat rice' }
    const options = { rng: createRng(hashSeed('seed')) }
    const question = buildTiles(source, options)
    expect(question.answer, `入力: ${JSON.stringify(source)}`).toEqual(['Saya', 'makan', 'nasi'])
    expect(question.prompt, `入力: ${JSON.stringify(source)}`).toBe('I eat rice')
    expect(question.itemId, `入力: ${JSON.stringify(source)}`).toBe('w1')
    expect(question.format, `入力: ${JSON.stringify(source)}`).toBe('tiles')
  })

  it('ダミーの個数(3 語以下で 1)', () => {
    const source = { id: 'w1', target: 'a b c', meaning: 'x' }
    const decoyWords = ['d', 'e', 'f']
    const options = { rng: createRng(hashSeed('seed')), decoyWords }
    const question = buildTiles(source, options)
    const answerSet = new Set(question.answer)
    const decoys = question.tiles.filter((t) => !answerSet.has(t))
    expect(decoys.length, `入力: ${JSON.stringify(options)}, 期待値: 1`).toBe(1)
  })

  it('ダミーの個数(4 語以上で 2)', () => {
    const source = { id: 'w1', target: 'a b c d', meaning: 'x' }
    const decoyWords = ['e', 'f', 'g']
    const options = { rng: createRng(hashSeed('seed')), decoyWords }
    const question = buildTiles(source, options)
    const answerSet = new Set(question.answer)
    const decoys = question.tiles.filter((t) => !answerSet.has(t))
    expect(decoys.length, `入力: ${JSON.stringify(options)}, 期待値: 2`).toBe(2)
  })

  it('tiles に answer の全語とダミーが含まれる(多重集合として一致)', () => {
    const source = { id: 'w1', target: 'a b c', meaning: 'x' }
    const decoyWords = ['d', 'e']
    const options = { rng: createRng(hashSeed('seed')), decoyWords }
    const question = buildTiles(source, options)

    // 3語 → ダミー1個、tiles は全4語
    expect(question.tiles.length, `入力: ${JSON.stringify(options)}, 期待値: 4`).toBe(4)

    // answer の各語が tiles にちょうど1回含まれる
    for (const word of question.answer) {
      const count = question.tiles.filter((t) => t === word).length
      expect(count, `入力: ${JSON.stringify(options)}, 語: "${word}", 期待値: 1`).toBe(1)
    }

    // 残りの語はダミー候補から来ている
    const nonAnswer = question.tiles.filter((t) => !question.answer.includes(t))
    expect(nonAnswer.length, `入力: ${JSON.stringify(options)}, 期待値: 1`).toBe(1)
    for (const d of nonAnswer) {
      expect(
        decoyWords.includes(d),
        `入力: ${JSON.stringify(options)}, ダミー: "${d}", 候補: ${JSON.stringify(decoyWords)}`,
      ).toBe(true)
    }
  })

  it('ダミーが answer の語と重複しない', () => {
    const source = { id: 'w1', target: 'a b c', meaning: 'x' }
    // 'A' と 'B' は normalizeToken で answer に含まれるため候補から除外される
    const decoyWords = ['A', 'B', 'd']
    const options = { rng: createRng(hashSeed('seed')), decoyWords }
    const question = buildTiles(source, options)

    // 有効な候補は 'd' のみ → ダミー1個は 'd'
    const nonAnswer = question.tiles.filter((t) => !question.answer.includes(t))
    expect(nonAnswer, `入力: ${JSON.stringify(options)}, 期待値: ["d"]`).toEqual(['d'])
  })

  it('候補が少ないときの個数', () => {
    const source = { id: 'w1', target: 'a b c d', meaning: 'x' }
    // 4語 → ダミー2個が必要だが、候補は1つだけ
    const decoyWords = ['e']
    const options = { rng: createRng(hashSeed('seed')), decoyWords }
    const question = buildTiles(source, options)
    const answerSet = new Set(question.answer)
    const decoys = question.tiles.filter((t) => !answerSet.has(t))
    expect(decoys.length, `入力: ${JSON.stringify(options)}, 期待値: 1`).toBe(1)
  })

  it('ダミー候補が空のとき tiles の語の集合が answer と同じで、並びが異なる(2語以上)', () => {
    const source = { id: 'w1', target: 'a b c', meaning: 'x' }
    const options = { rng: createRng(hashSeed('seed')) }
    const question = buildTiles(source, options)

    // 多重集合として一致
    const sortedTiles = [...question.tiles].sort()
    const sortedAnswer = [...question.answer].sort()
    expect(
      sortedTiles,
      `入力: ${JSON.stringify(source)}, 期待値: ${JSON.stringify(sortedAnswer)}`,
    ).toEqual(sortedAnswer)

    // 並びが answer と異なる
    expect(
      question.tiles,
      `入力: ${JSON.stringify(source)}, 期待値: answer と異なる並び`,
    ).not.toEqual(question.answer)
  })

  it('同じシードで同じ結果', () => {
    const source = { id: 'w1', target: 'a b c', meaning: 'x' }
    const q1 = buildTiles(source, { rng: createRng(hashSeed('seed')) })
    const q2 = buildTiles(source, { rng: createRng(hashSeed('seed')) })
    expect(
      q1.tiles,
      `入力: ${JSON.stringify(source)}, 期待値: ${JSON.stringify(q2.tiles)}`,
    ).toEqual(q2.tiles)
  })

  it('accepted: 別解が入る', () => {
    const source = { id: 'w1', target: 'a b c', meaning: 'x' }
    const acceptedTargets = ['c b a']
    const options = { rng: createRng(hashSeed('seed')), acceptedTargets }
    const question = buildTiles(source, options)
    expect(
      question.accepted,
      `入力: ${JSON.stringify(options)}, 期待値: [["c","b","a"]]`,
    ).toContainEqual(['c', 'b', 'a'])
  })

  it('accepted: answer と同じ文は入らない', () => {
    const source = { id: 'w1', target: 'a b c', meaning: 'x' }
    const acceptedTargets = ['a b c']
    const options = { rng: createRng(hashSeed('seed')), acceptedTargets }
    const question = buildTiles(source, options)
    expect(question.accepted, `入力: ${JSON.stringify(options)}, 期待値: []`).toEqual([])
  })

  it('accepted: 重複は1つにまとまる', () => {
    const source = { id: 'w1', target: 'a b c', meaning: 'x' }
    const acceptedTargets = ['c b a', 'c b a']
    const options = { rng: createRng(hashSeed('seed')), acceptedTargets }
    const question = buildTiles(source, options)
    expect(question.accepted, `入力: ${JSON.stringify(options)}, 期待値: [["c","b","a"]]`).toEqual([
      ['c', 'b', 'a'],
    ])
  })
})

describe('checkTiles', () => {
  const question = {
    answer: ['Saya', 'makan', 'nasi'],
    accepted: [['makan', 'nasi', 'Saya']],
  }

  it('正解の並び', () => {
    const selected = ['Saya', 'makan', 'nasi']
    expect(checkTiles(question, selected), `入力: ${JSON.stringify(selected)}, 期待値: true`).toBe(
      true,
    )
  })

  it('別解の並び', () => {
    const selected = ['makan', 'nasi', 'Saya']
    expect(checkTiles(question, selected), `入力: ${JSON.stringify(selected)}, 期待値: true`).toBe(
      true,
    )
  })

  it('順序違い', () => {
    const selected = ['nasi', 'makan', 'Saya']
    expect(checkTiles(question, selected), `入力: ${JSON.stringify(selected)}, 期待値: false`).toBe(
      false,
    )
  })

  it('足りない語', () => {
    const selected = ['Saya', 'makan']
    expect(checkTiles(question, selected), `入力: ${JSON.stringify(selected)}, 期待値: false`).toBe(
      false,
    )
  })

  it('多い語', () => {
    const selected = ['Saya', 'makan', 'nasi', 'extra']
    expect(checkTiles(question, selected), `入力: ${JSON.stringify(selected)}, 期待値: false`).toBe(
      false,
    )
  })

  it('大文字小文字の違いを無視', () => {
    const selected = ['saya', 'MAKAN', 'Nasi']
    expect(checkTiles(question, selected), `入力: ${JSON.stringify(selected)}, 期待値: true`).toBe(
      true,
    )
  })

  it('句読点付きの選択は不要(語だけ比べる)', () => {
    // tiles は tokenize で既に句読点を除去済みなので、語だけで比較できる
    const selected = ['Saya', 'makan', 'nasi']
    expect(checkTiles(question, selected), `入力: ${JSON.stringify(selected)}, 期待値: true`).toBe(
      true,
    )
  })
})
