import type { Word } from '../schema'

export interface DistractorOptions {
  count?: number
  rng: () => number
  unitWordIds?: ReadonlySet<string>
  learnedWordIds?: ReadonlySet<string>
}

const REL_TYPE_ORDER = ['confusable', 'antonym', 'synonym', 'related'] as const

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const a = result[i]
    const b = result[j]
    if (a !== undefined && b !== undefined) {
      result[i] = b
      result[j] = a
    }
  }
  return result
}

function isEligible(candidate: Word, correct: Word, selectedIds: ReadonlySet<string>): boolean {
  if (candidate.id === correct.id) return false
  if (selectedIds.has(candidate.id)) return false
  if (candidate.lemma === correct.lemma) return false

  const correctMeaning = correct.meaning[0]
  if (correctMeaning !== undefined && candidate.meaning[0] === correctMeaning) {
    return false
  }
  return true
}

function buildPoolById(pool: ReadonlyArray<Word>): Map<string, Word> {
  const map = new Map<string, Word>()
  for (const word of pool) {
    if (!map.has(word.id)) map.set(word.id, word)
  }
  return map
}

function buildLayer1(
  correct: Word,
  poolById: Map<string, Word>,
  rng: () => number,
  selectedIds: ReadonlySet<string>,
): Word[] {
  const rels = correct.rel ?? []
  const entries: Array<{ type: string; word: Word }> = []

  for (const rel of rels) {
    const word = poolById.get(rel.id)
    if (!word) continue
    if (!isEligible(word, correct, selectedIds)) continue
    entries.push({ type: rel.type, word })
  }

  const result: Word[] = []
  const seen = new Set<string>()

  for (const type of REL_TYPE_ORDER) {
    const group = entries.filter((entry) => entry.type === type)
    const unique: Word[] = []
    const groupSeen = new Set<string>()

    for (const entry of group) {
      if (groupSeen.has(entry.word.id)) continue
      groupSeen.add(entry.word.id)
      unique.push(entry.word)
    }

    for (const word of shuffle(unique, rng)) {
      if (seen.has(word.id)) continue
      seen.add(word.id)
      result.push(word)
    }
  }

  return result
}

export function pickDistractors(
  correct: Word,
  pool: ReadonlyArray<Word>,
  options: DistractorOptions,
): Word[] {
  const count = Math.max(0, options.count ?? 3)
  if (count === 0) return []

  const selected: Word[] = []
  const selectedIds = new Set<string>()
  const poolById = buildPoolById(pool)

  const add = (word: Word): void => {
    if (selected.length >= count) return
    if (!isEligible(word, correct, selectedIds)) return
    selected.push(word)
    selectedIds.add(word.id)
  }

  for (const word of buildLayer1(correct, poolById, options.rng, selectedIds)) {
    add(word)
    if (selected.length >= count) return selected
  }

  const layer2 = pool.filter(
    (word) =>
      isEligible(word, correct, selectedIds) &&
      word.pos === correct.pos &&
      word.tags.some((tag) => correct.tags.includes(tag)),
  )
  for (const word of shuffle(layer2, options.rng)) {
    add(word)
    if (selected.length >= count) return selected
  }

  const unitWordIds = options.unitWordIds
  const layer3 = unitWordIds
    ? pool.filter((word) => isEligible(word, correct, selectedIds) && unitWordIds.has(word.id))
    : []
  for (const word of shuffle(layer3, options.rng)) {
    add(word)
    if (selected.length >= count) return selected
  }

  const learnedWordIds = options.learnedWordIds
  const layer4 = learnedWordIds
    ? pool.filter((word) => isEligible(word, correct, selectedIds) && learnedWordIds.has(word.id))
    : []
  for (const word of shuffle(layer4, options.rng)) {
    add(word)
    if (selected.length >= count) return selected
  }

  return selected
}
