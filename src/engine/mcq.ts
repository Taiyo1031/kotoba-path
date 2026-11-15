import type { Word } from '../schema'
import type { McqDirection, McqQuestion, Option } from './types'
import { pickDistractors } from './distractors'
import { shuffle } from './rng'

export interface McqContext {
  pool: ReadonlyArray<Word> // 誤答の候補を含む単語の集まり
  rng: () => number
  unitWordIds?: ReadonlySet<string>
  learnedWordIds?: ReadonlySet<string>
}

// 方向ごとの選択肢表示(外国語→母語・音声→意味は意味、母語→外国語は見出し語)
function optionText(word: Word, direction: McqDirection): string {
  if (direction === 'nativeToForeign') {
    return word.lemma
  }
  return word.meaning[0] ?? ''
}

// 方向ごとの問題文(外国語→母語・音声→意味は見出し語、母語→外国語は意味)
function promptText(word: Word, direction: McqDirection): string {
  if (direction === 'nativeToForeign') {
    return word.meaning[0] ?? ''
  }
  return word.lemma
}

export function buildMcq(
  word: Word,
  direction: McqDirection,
  context: McqContext,
  distractorCount?: number,
): McqQuestion {
  const count = distractorCount ?? 3
  const distractors = pickDistractors(word, context.pool, {
    count,
    rng: context.rng,
    unitWordIds: context.unitWordIds,
    learnedWordIds: context.learnedWordIds,
  })

  // 表示テキストの重複を除去する(正解は必ず残す。後から来た誤答を捨てる)
  const keptDistractors: Word[] = []
  const seenTexts = new Set<string>([optionText(word, direction)])
  for (const distractor of distractors) {
    const text = optionText(distractor, direction)
    if (seenTexts.has(text)) continue
    seenTexts.add(text)
    keptDistractors.push(distractor)
  }

  const options: Option[] = [
    { id: word.id, text: optionText(word, direction) },
    ...keptDistractors.map((d) => ({ id: d.id, text: optionText(d, direction) })),
  ]

  return {
    format: 'mcq',
    itemId: word.id,
    direction,
    prompt: promptText(word, direction),
    ...(direction === 'foreignToNative' && word.reading !== ''
      ? { promptReading: word.reading }
      : {}),
    options: shuffle(options, context.rng),
    correctId: word.id,
  }
}
