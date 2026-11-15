import type { Guide, GuideExample, GuideSound } from '../schema'
import { createRng, pickOne, shuffle } from '../engine/rng'
import type { Rng } from '../engine/rng'

export type GuideQuestionKind = 'graphemeToReading' | 'exampleToReading' | 'readingToGrapheme'

export interface GuideQuestion {
  kind: GuideQuestionKind
  /** 問題に出す値: graphemeToReading は grapheme、exampleToReading は example.target、readingToGrapheme は reading */
  value: string
  /** 4つ(重複なし)。正解を1つ含む */
  options: string[]
  answerIndex: number
  /** 出題元の音のID */
  soundId: string
}

// 種類は graphemeToReading → readingToGrapheme → exampleToReading の順で巡回する
const KIND_ORDER: GuideQuestionKind[] = [
  'graphemeToReading',
  'readingToGrapheme',
  'exampleToReading',
]
const DISTRACTOR_COUNT = 3

export function isGuideQuizAvailable(guide: Guide): boolean {
  const readings = new Set<string>()
  const graphemes = new Set<string>()
  for (const sound of guide.sounds) {
    readings.add(sound.reading)
    graphemes.add(sound.grapheme)
  }
  return readings.size >= 4 && graphemes.size >= 4
}

export function buildGuideQuiz(guide: Guide, seed: number, count?: number): GuideQuestion[] {
  if (!isGuideQuizAvailable(guide)) {
    return []
  }
  const total = Math.min(20, Math.max(1, count ?? 5))
  const rng = createRng(seed)

  // ガイド全体の空でない例の読み(種類判定と誤答候補に使う)
  const exampleReadings = new Set<string>()
  for (const sound of guide.sounds) {
    for (const example of sound.examples) {
      if (example.reading !== '') {
        exampleReadings.add(example.reading)
      }
    }
  }

  // シャッフル順に音を使う。使い切ったらもう一度シャッフルして続ける
  let pool = shuffle(guide.sounds, rng)
  const usedKindsBySoundId = new Map<string, Set<GuideQuestionKind>>()
  const questions: GuideQuestion[] = []
  for (let i = 0; i < total; i += 1) {
    if (pool.length === 0) {
      pool = shuffle(guide.sounds, rng)
    }
    const sound = pool.shift() as GuideSound

    // 同じ音が繰り返される場合、まだ使っていない種類を優先して割り当てる
    const usedKinds = usedKindsBySoundId.get(sound.id) ?? new Set<GuideQuestionKind>()
    const kind = pickKind(i, sound, exampleReadings.size, usedKinds)
    usedKinds.add(kind)
    usedKindsBySoundId.set(sound.id, usedKinds)

    questions.push(buildQuestion(kind, sound, guide, rng))
  }
  return questions
}

// その音で出せる種類を、問番号の順から巡回して選ぶ(使えない種類は飛ばす)
function pickKind(
  index: number,
  sound: GuideSound,
  exampleReadingCount: number,
  usedKinds: ReadonlySet<GuideQuestionKind>,
): GuideQuestionKind {
  const usable = KIND_ORDER.filter((kind) => {
    if (kind !== 'exampleToReading') {
      return true
    }
    return isExampleUsable(sound, exampleReadingCount)
  })

  // まだ使っていない種類があるなら、その音で重複した種類は飛ばす
  const hasUnused = usable.some((kind) => !usedKinds.has(kind))
  const start = index % KIND_ORDER.length
  for (let offset = 0; offset < KIND_ORDER.length; offset += 1) {
    const candidate = KIND_ORDER[(start + offset) % KIND_ORDER.length] as GuideQuestionKind
    if (!usable.includes(candidate)) {
      continue
    }
    if (hasUnused && usedKinds.has(candidate)) {
      continue
    }
    return candidate
  }

  // 利用可能なら graphemeToReading / readingToGrapheme は必ず出せるため到達しない
  return 'graphemeToReading'
}

// その音に読み付きの例があり、ガイド全体で答え以外の読みが3種類以上あるとき使える
function isExampleUsable(sound: GuideSound, exampleReadingCount: number): boolean {
  if (exampleReadingCount < DISTRACTOR_COUNT + 1) {
    return false
  }
  return sound.examples.some((e) => e.reading !== '')
}

function buildQuestion(
  kind: GuideQuestionKind,
  sound: GuideSound,
  guide: Guide,
  rng: Rng,
): GuideQuestion {
  if (kind === 'exampleToReading') {
    return buildExampleQuestion(sound, guide, rng)
  }
  const textOf =
    kind === 'graphemeToReading' ? (s: GuideSound) => s.reading : (s: GuideSound) => s.grapheme
  const correct = textOf(sound)
  const options = pickSoundOptions(sound, guide.sounds, textOf, rng)
  return {
    kind,
    value: kind === 'graphemeToReading' ? sound.grapheme : sound.reading,
    options,
    answerIndex: options.indexOf(correct),
    soundId: sound.id,
  }
}

// 他の音から誤答3つ(confusableWith 優先、正解と重複しない)を選び、シャッフルして4択にする
function pickSoundOptions(
  sound: GuideSound,
  sounds: ReadonlyArray<GuideSound>,
  textOf: (s: GuideSound) => string,
  rng: Rng,
): string[] {
  const correct = textOf(sound)
  const confusableIds = new Set(sound.confusableWith)
  const others = sounds.filter((s) => s.id !== sound.id)
  const prioritized = others.filter((s) => confusableIds.has(s.id))
  const rest = shuffle(
    others.filter((s) => !confusableIds.has(s.id)),
    rng,
  )
  const distractors: string[] = []
  const seen = new Set([correct])
  for (const s of [...prioritized, ...rest]) {
    if (distractors.length >= DISTRACTOR_COUNT) {
      break
    }
    const text = textOf(s)
    if (!seen.has(text)) {
      seen.add(text)
      distractors.push(text)
    }
  }
  return shuffle([correct, ...distractors], rng)
}

// 読み付きの例を1つ選び、誤答はガイド全体の他の例の読みから3つ取る
function buildExampleQuestion(sound: GuideSound, guide: Guide, rng: Rng): GuideQuestion {
  const candidates = sound.examples.filter((e) => e.reading !== '')
  const example = pickOne(candidates, rng) as GuideExample
  const correct = example.reading
  const pool: string[] = []
  const seen = new Set([correct])
  for (const s of guide.sounds) {
    for (const e of s.examples) {
      if (e.reading !== '' && !seen.has(e.reading)) {
        seen.add(e.reading)
        pool.push(e.reading)
      }
    }
  }
  const distractors = shuffle(pool, rng).slice(0, DISTRACTOR_COUNT)
  const options = shuffle([correct, ...distractors], rng)
  return {
    kind: 'exampleToReading',
    value: example.target,
    options,
    answerIndex: options.indexOf(correct),
    soundId: sound.id,
  }
}
