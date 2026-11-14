import type { Sentence, Word } from '../schema'
import type { ClozeQuestion, Option } from './types'
import { pickDistractors } from './distractors'
import { shuffle } from './rng'

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}

function isLetterOrNumber(codePoint: string | undefined): boolean {
  if (codePoint === undefined) return false
  return /^\p{L}$/u.test(codePoint) || /^\p{N}$/u.test(codePoint)
}

function previousCodePoint(text: string, index: number): string | undefined {
  if (index <= 0) return undefined
  const slice = text.slice(Math.max(0, index - 2), index)
  const chars = Array.from(slice)
  return chars[chars.length - 1]
}

function nextCodePoint(text: string, index: number): string | undefined {
  if (index >= text.length) return undefined
  const slice = text.slice(index, Math.min(text.length, index + 2))
  const chars = Array.from(slice)
  return chars[0]
}

export function findWordInSentence(
  text: string,
  lemma: string,
): { start: number; end: number } | null {
  if (lemma.length === 0) return null

  const pattern = new RegExp(escapeRegExp(lemma), 'giu')

  for (const match of text.matchAll(pattern)) {
    const start = match.index
    const matched = match[0]
    if (start === undefined || matched === undefined) continue

    const end = start + matched.length
    const beforeOk = !isLetterOrNumber(previousCodePoint(text, start))
    const afterOk = !isLetterOrNumber(nextCodePoint(text, end))

    if (beforeOk && afterOk) {
      return { start, end }
    }
  }

  return null
}

export interface ClozeContext {
  pool: ReadonlyArray<Word>
  rng: () => number
  unitWordIds?: ReadonlySet<string>
  learnedWordIds?: ReadonlySet<string>
}

export function buildCloze(
  sentence: Sentence,
  word: Word,
  mode: 'choice' | 'typing',
  context: ClozeContext,
): ClozeQuestion | null {
  const found = findWordInSentence(sentence.target, word.lemma)
  if (found === null) return null

  const before = sentence.target.slice(0, found.start)
  const after = sentence.target.slice(found.end)
  const answer = sentence.target.slice(found.start, found.end)
  const accepted = word.lemma.toLowerCase() === answer.toLowerCase() ? [] : [word.lemma]

  if (mode === 'typing') {
    return {
      format: 'cloze',
      itemId: word.id,
      sentenceId: sentence.id,
      before,
      after,
      answer,
      mode,
      accepted,
    }
  }

  const distractorWords = pickDistractors(word, context.pool, {
    count: 3,
    rng: context.rng,
    unitWordIds: context.unitWordIds,
    learnedWordIds: context.learnedWordIds,
  })

  const correctOption: Option = { id: word.id, text: answer }
  const distractorOptions: Option[] = []
  const seenTexts = new Set<string>([answer.toLowerCase()])

  for (const candidate of distractorWords) {
    const key = candidate.lemma.toLowerCase()
    if (seenTexts.has(key)) continue
    seenTexts.add(key)
    distractorOptions.push({ id: candidate.id, text: candidate.lemma })
  }

  const options = shuffle([correctOption, ...distractorOptions], context.rng)

  return {
    format: 'cloze',
    itemId: word.id,
    sentenceId: sentence.id,
    before,
    after,
    answer,
    mode,
    accepted,
    options,
    correctId: word.id,
  }
}
