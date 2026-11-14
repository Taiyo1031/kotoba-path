import { describe, expect, it } from 'vitest'
import { checkTyping, levenshtein, normalizeAnswer } from './typing'

describe('normalizeAnswer', () => {
  it('大文字を小文字にする', () => {
    const input = 'Hello'
    const expected = 'hello'
    const actual = normalizeAnswer(input)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toBe(expected)
  })

  it('前後の空白を除く', () => {
    const input = '  hello  '
    const expected = 'hello'
    const actual = normalizeAnswer(input)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toBe(expected)
  })

  it('連続する空白を半角スペース1つにする', () => {
    const input = 'a\t\n b   c'
    const expected = 'a b c'
    const actual = normalizeAnswer(input)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toBe(expected)
  })

  it('全角空白も連続して1つにする', () => {
    const input = 'あ\u3000\u3000い'
    const expected = 'あ い'
    const actual = normalizeAnswer(input)
    expect(
      actual,
      `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toBe(expected)
  })

  it('NFC で合成形と分解形を同じにする', () => {
    const composed = '\u00e9'
    const decomposed = 'e\u0301'
    const actualComposed = normalizeAnswer(composed)
    const actualDecomposed = normalizeAnswer(decomposed)
    expect(
      [actualComposed, actualDecomposed],
      `入力: ${JSON.stringify([composed, decomposed])} 期待値: ${JSON.stringify(['é', 'é'])} 実際: ${JSON.stringify([actualComposed, actualDecomposed])}`,
    ).toEqual(['é', 'é'])
  })
})

describe('levenshtein', () => {
  it('同じ文字列は 0', () => {
    const a = 'hello'
    const b = 'hello'
    const expected = 0
    const actual = levenshtein(a, b)
    expect(actual, `入力: ${JSON.stringify([a, b])} 期待値: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('1文字の置換は 1', () => {
    const a = 'cat'
    const b = 'bat'
    const expected = 1
    const actual = levenshtein(a, b)
    expect(actual, `入力: ${JSON.stringify([a, b])} 期待値: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('1文字の挿入は 1', () => {
    const a = 'cat'
    const b = 'cart'
    const expected = 1
    const actual = levenshtein(a, b)
    expect(actual, `入力: ${JSON.stringify([a, b])} 期待値: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('1文字の削除は 1', () => {
    const a = 'cart'
    const b = 'cat'
    const expected = 1
    const actual = levenshtein(a, b)
    expect(actual, `入力: ${JSON.stringify([a, b])} 期待値: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('kitten と sitting は 3', () => {
    const a = 'kitten'
    const b = 'sitting'
    const expected = 3
    const actual = levenshtein(a, b)
    expect(actual, `入力: ${JSON.stringify([a, b])} 期待値: ${expected} 実際: ${actual}`).toBe(
      expected,
    )
  })

  it('空文字との距離は長さに等しい', () => {
    const a = ''
    const b = 'abc'
    const expected = 3
    const actual = levenshtein(a, b)
    expect(actual, `入力: ${JSON.stringify([a, b])} 期待値: ${expected} 実際: ${actual}`).toBe(
      expected,
    )

    const a2 = 'abc'
    const b2 = ''
    const expected2 = 3
    const actual2 = levenshtein(a2, b2)
    expect(actual2, `入力: ${JSON.stringify([a2, b2])} 期待値: ${expected2} 実際: ${actual2}`).toBe(
      expected2,
    )
  })
})

describe('checkTyping', () => {
  it('完全一致は correct', () => {
    const input = 'apple'
    const answer = 'apple'
    const expected = { verdict: 'correct' }
    const actual = checkTyping(input, answer)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('大文字小文字の違いは correct', () => {
    const input = 'APPLE'
    const answer = 'apple'
    const expected = { verdict: 'correct' }
    const actual = checkTyping(input, answer)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('前後の空白付きでも correct', () => {
    const input = '  apple  '
    const answer = 'apple'
    const expected = { verdict: 'correct' }
    const actual = checkTyping(input, answer)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('accepted の別解は correct', () => {
    const input = 'banana'
    const answer = 'apples'
    const accepted = ['banana']
    const expected = { verdict: 'correct' }
    const actual = checkTyping(input, answer, accepted)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer, accepted })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('置換で1文字違いなら close とヒント', () => {
    const input = 'mouze'
    const answer = 'mouse'
    const expected = { verdict: 'close', hint: '先頭「m」・全体5文字' }
    const actual = checkTyping(input, answer)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('挿入で1文字違いなら close とヒント', () => {
    const input = 'mousie'
    const answer = 'mouse'
    const expected = { verdict: 'close', hint: '先頭「m」・全体5文字' }
    const actual = checkTyping(input, answer)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('欠落で1文字違いなら close とヒント', () => {
    const input = 'mose'
    const answer = 'mouse'
    const expected = { verdict: 'close', hint: '先頭「m」・全体5文字' }
    const actual = checkTyping(input, answer)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('2文字以上違うと wrong', () => {
    const input = 'sitting'
    const answer = 'kitten'
    const expected = { verdict: 'wrong' }
    const actual = checkTyping(input, answer)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('3文字以下の語は1文字違いでも wrong', () => {
    const input = 'bat'
    const answer = 'cat'
    const expected = { verdict: 'wrong' }
    const actual = checkTyping(input, answer)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('空入力は wrong', () => {
    const input = ''
    const answer = 'apple'
    const accepted = ['apples']
    const expected = { verdict: 'wrong' }
    const actual = checkTyping(input, answer, accepted)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer, accepted })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })

  it('正解と別解の両方に1文字違いがあるとき、正解のヒントを使う', () => {
    const input = 'mouze'
    const answer = 'mouse'
    const accepted = ['houze']
    const expected = { verdict: 'close', hint: '先頭「m」・全体5文字' }
    const actual = checkTyping(input, answer, accepted)
    expect(
      actual,
      `入力: ${JSON.stringify({ input, answer, accepted })} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
    ).toEqual(expected)
  })
})
