import type { Phrase, Word } from '../schema'

export interface ExpandedPhrase {
  phraseId: string
  target: string
  meaning: string
  filled: Record<string, string>
}

export function candidatesForSlot(tag: string, learnedWords: ReadonlyArray<Word>): Word[] {
  return learnedWords.filter((word) => word.tags.includes(tag))
}

export function isPhraseAvailable(phrase: Phrase, learnedWords: ReadonlyArray<Word>): boolean {
  if (phrase.fixed) return true

  return Object.values(phrase.slots).every((slot) => {
    return candidatesForSlot(slot.tag, learnedWords).length > 0
  })
}

function placeholderNamesInOrder(text: string): string[] {
  const names: string[] = []
  let index = 0

  while (index < text.length) {
    const open = text.indexOf('{', index)
    if (open === -1) break

    const close = text.indexOf('}', open + 1)
    if (close === -1) break

    names.push(text.slice(open + 1, close))
    index = close + 1
  }

  return names
}

function orderedSlotNames(phrase: Phrase): string[] {
  const slotKeys = Object.keys(phrase.slots)
  const slotKeySet = new Set(slotKeys)
  const ordered: string[] = []
  const seen = new Set<string>()

  for (const name of placeholderNamesInOrder(phrase.target)) {
    if (slotKeySet.has(name) && !seen.has(name)) {
      ordered.push(name)
      seen.add(name)
    }
  }

  for (const name of placeholderNamesInOrder(phrase.meaning)) {
    if (slotKeySet.has(name) && !seen.has(name)) {
      ordered.push(name)
      seen.add(name)
    }
  }

  for (const name of slotKeys) {
    if (!seen.has(name)) {
      ordered.push(name)
      seen.add(name)
    }
  }

  return ordered
}

function replaceSlots(template: string, replacements: Map<string, string>): string {
  let result = ''
  let index = 0

  while (index < template.length) {
    const open = template.indexOf('{', index)
    if (open === -1) {
      result += template.slice(index)
      break
    }

    result += template.slice(index, open)
    const close = template.indexOf('}', open + 1)
    if (close === -1) {
      result += template.slice(open)
      break
    }

    const name = template.slice(open + 1, close)
    const replacement = replacements.get(name)
    if (replacement === undefined) {
      result += template.slice(open, close + 1)
    } else {
      result += replacement
    }

    index = close + 1
  }

  return result
}

export function expandPhrase(
  phrase: Phrase,
  learnedWords: ReadonlyArray<Word>,
  rng: () => number,
): ExpandedPhrase | null {
  if (phrase.fixed) {
    return {
      phraseId: phrase.id,
      target: phrase.target,
      meaning: phrase.meaning,
      filled: {},
    }
  }

  const slotNames = orderedSlotNames(phrase)
  const candidatesBySlot = new Map<string, Word[]>()

  for (const slotName of slotNames) {
    const slot = phrase.slots[slotName]
    if (slot === undefined) return null

    const candidates = candidatesForSlot(slot.tag, learnedWords)
    if (candidates.length === 0) return null

    candidatesBySlot.set(slotName, candidates)
  }

  const filled: Record<string, string> = {}
  const targetReplacements = new Map<string, string>()
  const meaningReplacements = new Map<string, string>()
  const chosenIds = new Set<string>()

  for (const slotName of slotNames) {
    const candidates = candidatesBySlot.get(slotName) ?? []
    if (candidates.length === 0) return null

    let available = candidates.filter((word) => !chosenIds.has(word.id))
    if (available.length === 0) available = candidates

    const index = Math.floor(rng() * available.length)
    const chosen = available[index]
    if (chosen === undefined) return null

    filled[slotName] = chosen.id
    chosenIds.add(chosen.id)
    targetReplacements.set(slotName, chosen.lemma)
    meaningReplacements.set(slotName, chosen.meaning[0] ?? '')
  }

  return {
    phraseId: phrase.id,
    target: replaceSlots(phrase.target, targetReplacements),
    meaning: replaceSlots(phrase.meaning, meaningReplacements),
    filled,
  }
}
