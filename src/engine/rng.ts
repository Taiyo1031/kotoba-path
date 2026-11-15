// シード付き乱数(mulberry32)と、それを使うシャッフル・抽出。純粋関数のみ。

export type Rng = () => number // 0 以上 1 未満の数を返す

const FNV_OFFSET_BASIS = 2166136261
const FNV_PRIME = 16777619

// 文字列を 32bit 符号なし整数にする(FNV-1a)
export function hashSeed(text: string): number {
  let h = FNV_OFFSET_BASIS
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    h ^= code
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0
}

// mulberry32。同じシードなら同じ数列を返す乱数生成器を作る
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Fisher–Yates。元の配列は変更せず、新しい配列を返す
export function shuffle<T>(items: ReadonlyArray<T>, rng: Rng): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i >= 1; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = result[i] as T
    result[i] = result[j] as T
    result[j] = tmp
  }
  return result
}

// 空なら undefined。そうでなければ乱数で 1 つ選ぶ
export function pickOne<T>(items: ReadonlyArray<T>, rng: Rng): T | undefined {
  if (items.length === 0) {
    return undefined
  }
  const index = Math.floor(rng() * items.length)
  return items[index]
}

// 重複なしで count 個(items.length を超えるなら全部)。count が 0 以下なら空配列
export function sample<T>(items: ReadonlyArray<T>, count: number, rng: Rng): T[] {
  if (count <= 0) {
    return []
  }
  const limit = Math.min(count, items.length)
  return shuffle(items, rng).slice(0, limit)
}
