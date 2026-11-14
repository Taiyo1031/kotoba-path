import type { UnitContent } from '../schema'
import type { Step } from './types'

export const DEFAULT_BATCH_SIZE = 5

type Content = Pick<UnitContent, 'words' | 'phrases' | 'sentences'>
type Word = UnitContent['words'][number]
type Phrase = UnitContent['phrases'][number]

const normalizeBatchSize = (batchSize?: number): number => {
  if (typeof batchSize === 'number' && Number.isInteger(batchSize) && batchSize >= 1) {
    return batchSize
  }
  return DEFAULT_BATCH_SIZE
}

const phraseIsReady = (phrase: Phrase, cumulativeWords: Word[]): boolean => {
  const tags = Object.values(phrase.slots).map((slot) => slot.tag)
  return tags.every((tag) => cumulativeWords.some((word) => word.tags.includes(tag)))
}

export function buildSteps(unitId: string, content: Content, batchSize?: number): Step[] {
  const size = normalizeBatchSize(batchSize)
  const words = content.words

  if (words.length === 0) {
    return []
  }

  const batchCount = Math.ceil(words.length / size)
  const steps: Step[] = []
  const usedSentenceIds = new Set<string>()
  const usedPhraseIds = new Set<string>()

  for (let b = 0; b < batchCount; b += 1) {
    const batchWords = words.slice(b * size, b * size + size)
    const wordIds = batchWords.map((word) => word.id)
    const cumulativeWords = words.slice(0, (b + 1) * size)
    const cumulativeWordIds = new Set(cumulativeWords.map((word) => word.id))
    const currentWordIds = new Set(wordIds)

    const sentenceIds = content.sentences
      .filter((sentence) => {
        if (usedSentenceIds.has(sentence.id)) {
          return false
        }
        if (sentence.wordIds.length === 0) {
          return false
        }
        const allIncluded = sentence.wordIds.every((id) => cumulativeWordIds.has(id))
        const includesCurrent = sentence.wordIds.some((id) => currentWordIds.has(id))
        return allIncluded && includesCurrent
      })
      .map((sentence) => sentence.id)

    for (const id of sentenceIds) {
      usedSentenceIds.add(id)
    }

    const slotPhraseIds = content.phrases
      .filter((phrase) => {
        if (phrase.fixed) {
          return false
        }
        if (usedPhraseIds.has(phrase.id)) {
          return false
        }
        return phraseIsReady(phrase, cumulativeWords)
      })
      .map((phrase) => phrase.id)

    for (const id of slotPhraseIds) {
      usedPhraseIds.add(id)
    }

    const phraseIds = [...slotPhraseIds]
    if (b === batchCount - 1) {
      const fixedPhraseIds = content.phrases
        .filter((phrase) => phrase.fixed && !usedPhraseIds.has(phrase.id))
        .map((phrase) => phrase.id)
      phraseIds.push(...fixedPhraseIds)
      for (const id of fixedPhraseIds) {
        usedPhraseIds.add(id)
      }
    }

    const makeStep = (kind: 'intro' | 'recognize' | 'recall' | 'context'): Step => ({
      id: `${unitId}-b${b}-${kind}`,
      kind,
      batchIndex: b,
      wordIds,
      phraseIds: kind === 'context' ? phraseIds : [],
      sentenceIds: kind === 'context' ? sentenceIds : [],
    })

    steps.push(makeStep('intro'), makeStep('recognize'), makeStep('recall'), makeStep('context'))
  }

  steps.push({
    id: `${unitId}-test`,
    kind: 'unitTest',
    batchIndex: null,
    wordIds: words.map((word) => word.id),
    phraseIds: content.phrases.map((phrase) => phrase.id),
    sentenceIds: [],
  })

  return steps
}
