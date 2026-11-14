export type TypingVerdict = 'correct' | 'close' | 'wrong'

export interface TypingResult {
  verdict: TypingVerdict
  hint?: string
}

const WHITESPACE_PATTERN = /[\s\u3000]+/g

export function normalizeAnswer(text: string): string {
  return text.normalize('NFC').replace(WHITESPACE_PATTERN, ' ').trim().toLowerCase()
}

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev: number[] = []
  for (let j = 0; j <= n; j += 1) {
    prev.push(j)
  }

  for (let i = 1; i <= m; i += 1) {
    const curr: number[] = [i]
    const aChar = a.charAt(i - 1)
    let diag = i - 1

    for (let j = 1; j <= n; j += 1) {
      const bChar = b.charAt(j - 1)
      const cost = aChar === bChar ? 0 : 1
      const up = prev[j] ?? Number.POSITIVE_INFINITY
      const left = curr[j - 1] ?? Number.POSITIVE_INFINITY
      // 削除(up)・挿入(left)はそれぞれコスト 1、置換(diag)は cost を足す
      const value = Math.min(up + 1, left + 1, diag + cost)
      curr.push(value)
      diag = up
    }

    prev = curr
  }

  return prev[n] ?? m
}

export function checkTyping(
  input: string,
  answer: string,
  accepted?: ReadonlyArray<string>,
): TypingResult {
  const normalizedInput = normalizeAnswer(input)
  if (normalizedInput.length === 0) {
    return { verdict: 'wrong' }
  }

  const candidates = [
    normalizeAnswer(answer),
    ...(accepted ?? []).map((candidate) => normalizeAnswer(candidate)),
  ]

  for (const candidate of candidates) {
    if (candidate === normalizedInput) {
      return { verdict: 'correct' }
    }
  }

  for (const candidate of candidates) {
    if (candidate.length >= 4 && levenshtein(normalizedInput, candidate) === 1) {
      const hint = `先頭「${candidate.charAt(0)}」・全体${candidate.length}文字`
      return { verdict: 'close', hint }
    }
  }

  return { verdict: 'wrong' }
}
