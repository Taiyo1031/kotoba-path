import type { Phrase, Sentence, Word } from '../schema'
import type { Judgement, Question, Response } from './types'
import type { Level } from './session'
import { buildMcq } from './mcq'
import { buildCloze, findWordInSentence } from './cloze'
import { buildTiles, checkTiles } from './tiles'
import { checkMatch } from './match'
import { expandPhrase } from './slots'
import { checkTyping } from './typing'
import { pickFormat } from './session'

export interface QuestionContext {
  words: ReadonlyArray<Word>
  phrases: ReadonlyArray<Phrase>
  sentences: ReadonlyArray<Sentence>
  pool: ReadonlyArray<Word>
  unitWordIds: ReadonlySet<string>
  learnedWordIds: ReadonlySet<string>
  rng: () => number
}

function findWordById(words: ReadonlyArray<Word>, itemId: string): Word | undefined {
  return words.find((word) => word.id === itemId)
}

function findPhraseById(phrases: ReadonlyArray<Phrase>, itemId: string): Phrase | undefined {
  return phrases.find((phrase) => phrase.id === itemId)
}

function isUsableSentence(sentence: Sentence, wordId: string, lemma: string): boolean {
  if (!sentence.wordIds.includes(wordId)) {
    return false
  }
  return findWordInSentence(sentence.target, lemma) !== null
}

function firstUsableSentence(
  sentences: ReadonlyArray<Sentence>,
  wordId: string,
  lemma: string,
): Sentence | undefined {
  for (const sentence of sentences) {
    if (isUsableSentence(sentence, wordId, lemma)) {
      return sentence
    }
  }
  return undefined
}

function firstAssociatedSentence(
  sentences: ReadonlyArray<Sentence>,
  wordId: string,
): Sentence | undefined {
  for (const sentence of sentences) {
    if (sentence.wordIds.includes(wordId)) {
      return sentence
    }
  }
  return undefined
}

function normalizeMeaning(text: string): string {
  return text.trim().toLowerCase()
}

function collectAcceptedAlternatives(word: Word, context: QuestionContext): string[] {
  const target = normalizeMeaning(word.meaning[0] ?? '')

  const seenIds = new Set<string>()
  const candidates: Word[] = []
  for (const candidate of [...context.words, ...context.pool]) {
    if (!seenIds.has(candidate.id)) {
      seenIds.add(candidate.id)
      candidates.push(candidate)
    }
  }

  const answerKey = normalizeMeaning(word.lemma)
  const seenLemmas = new Set<string>()
  const accepted: string[] = []
  for (const candidate of candidates) {
    if (candidate.id === word.id) {
      continue
    }
    if (normalizeMeaning(candidate.meaning[0] ?? '') !== target) {
      continue
    }
    const lemmaKey = normalizeMeaning(candidate.lemma)
    if (lemmaKey === answerKey || seenLemmas.has(lemmaKey)) {
      continue
    }
    seenLemmas.add(lemmaKey)
    accepted.push(candidate.lemma)
  }

  return accepted
}

function buildTypingQuestion(itemId: string, word: Word, context: QuestionContext): Question {
  return {
    format: 'typing',
    itemId,
    prompt: word.meaning[0] ?? '',
    answer: word.lemma,
    accepted: collectAcceptedAlternatives(word, context),
  }
}

export function buildQuestion(itemId: string, level: Level, context: QuestionContext): Question {
  const phrase = findPhraseById(context.phrases, itemId)
  if (phrase !== undefined) {
    if (!phrase.fixed) {
      const learnedWords = context.pool.filter((word) => context.learnedWordIds.has(word.id))
      const expanded = expandPhrase(phrase, learnedWords, context.rng)
      if (expanded !== null) {
        return {
          format: 'phrase-slot',
          itemId,
          target: expanded.target,
          meaning: expanded.meaning,
          filled: expanded.filled,
        }
      }
    }

    return {
      format: 'flashcard',
      itemId,
      front: phrase.target,
      back: phrase.meaning,
    }
  }

  const word = findWordById(context.words, itemId)
  if (word === undefined) {
    throw new Error(`itemId が見つかりません: ${itemId}`)
  }

  const usableSentence = firstUsableSentence(context.sentences, itemId, word.lemma)
  const associatedSentence = firstAssociatedSentence(context.sentences, itemId)

  // 段階 2 で例文は関連しているが語が見つからず cloze を作れない場合は、typing に落とす。
  if (level === 2 && associatedSentence !== undefined && usableSentence === undefined) {
    return buildTypingQuestion(itemId, word, context)
  }

  const choice = pickFormat(
    level,
    { hasSentence: usableSentence !== undefined, hasSlotPhrase: false },
    context.rng,
  )

  if (choice.format === 'mcq') {
    return buildMcq(word, choice.variant ?? 'foreignToNative', {
      pool: context.pool,
      rng: context.rng,
      unitWordIds: context.unitWordIds,
      learnedWordIds: context.learnedWordIds,
    })
  }

  if (choice.format === 'typing') {
    return buildTypingQuestion(itemId, word, context)
  }

  if (choice.format === 'tiles' && usableSentence !== undefined) {
    const decoyWords = context.pool
      .filter((candidate) => candidate.id !== word.id)
      .map((candidate) => candidate.lemma)
    const built = buildTiles(
      { id: usableSentence.id, target: usableSentence.target, meaning: usableSentence.meaning },
      { rng: context.rng, decoyWords },
    )
    return { ...built, itemId }
  }

  if (choice.format === 'cloze') {
    const sentence = usableSentence
    if (sentence !== undefined) {
      const mode = context.rng() < 0.5 ? 'choice' : 'typing'
      const built = buildCloze(sentence, word, mode, {
        pool: context.pool,
        rng: context.rng,
        unitWordIds: context.unitWordIds,
        learnedWordIds: context.learnedWordIds,
      })
      if (built !== null) {
        return built
      }
    }

    // cloze を作れなかった場合は、段階 1 の typing に落とす。
    return buildTypingQuestion(itemId, word, context)
  }

  return buildMcq(word, 'foreignToNative', {
    pool: context.pool,
    rng: context.rng,
    unitWordIds: context.unitWordIds,
    learnedWordIds: context.learnedWordIds,
  })
}

function correctTextForMcq(question: Extract<Question, { format: 'mcq' }>): string {
  const option = question.options.find((candidate) => candidate.id === question.correctId)
  return option?.text ?? ''
}

function judgeTyping(
  input: string | undefined,
  answer: string,
  accepted: ReadonlyArray<string>,
): Judgement {
  if (input === undefined) {
    return { correct: false, close: false, correctText: answer }
  }

  const result = checkTyping(input, answer, accepted)
  if (result.verdict === 'correct') {
    return { correct: true, close: false, correctText: answer }
  }
  if (result.verdict === 'close') {
    return { correct: false, close: true, hint: result.hint, correctText: answer }
  }
  return { correct: false, close: false, correctText: answer }
}

export function judgeResponse(question: Question, response: Response): Judgement {
  switch (question.format) {
    case 'intro':
      return { correct: true, close: false, correctText: '' }

    case 'mcq': {
      const correctText = correctTextForMcq(question)
      if (response.kind === 'choice' && response.optionId === question.correctId) {
        return { correct: true, close: false, correctText }
      }
      return { correct: false, close: false, correctText }
    }

    case 'cloze': {
      if (question.mode === 'choice') {
        const isCorrect =
          response.kind === 'choice' &&
          question.correctId !== undefined &&
          response.optionId === question.correctId
        return { correct: isCorrect, close: false, correctText: question.answer }
      }

      return judgeTyping(
        response.kind === 'text' ? response.text : undefined,
        question.answer,
        question.accepted,
      )
    }

    case 'typing':
      return judgeTyping(
        response.kind === 'text' ? response.text : undefined,
        question.answer,
        question.accepted,
      )

    case 'tiles': {
      const isCorrect = response.kind === 'tiles' && checkTiles(question, response.tiles)
      return { correct: isCorrect, close: false, correctText: question.answer.join(' ') }
    }

    case 'match': {
      const correctText = question.pairs.map((pair) => `${pair.foreign}=${pair.native}`).join(' / ')
      if (response.kind !== 'match') {
        return { correct: false, close: false, correctText }
      }

      const pairs = response.pairs
      if (pairs.length !== question.pairs.length) {
        return { correct: false, close: false, correctText }
      }

      const seenForeignIds = new Set<string>()
      for (const pair of pairs) {
        if (seenForeignIds.has(pair.foreignId)) {
          return { correct: false, close: false, correctText }
        }
        seenForeignIds.add(pair.foreignId)
        if (!checkMatch(question, pair.foreignId, pair.nativeId)) {
          return { correct: false, close: false, correctText }
        }
      }

      return { correct: true, close: false, correctText }
    }

    case 'flashcard': {
      const correctText = question.back
      if (response.kind !== 'selfGrade') {
        return { correct: false, close: false, correctText }
      }
      return {
        correct: response.grade !== 'again',
        close: false,
        selfGrade: response.grade,
        correctText,
      }
    }

    case 'phrase-slot': {
      const correctText = question.meaning
      if (response.kind !== 'selfGrade') {
        return { correct: false, close: false, correctText }
      }
      return {
        correct: response.grade !== 'again',
        close: false,
        selfGrade: response.grade,
        correctText,
      }
    }
  }
}
