import type { StudyData } from '../schema'
import { isDue, MATURE_STABILITY_DAYS } from '../engine/fsrsWrapper'

export type WordState = 'unseen' | 'learning' | 'young' | 'mature' | 'fading'
export const WORD_STATES: readonly WordState[] = ['unseen', 'learning', 'young', 'mature', 'fading']

export interface WordEntry {
  id: string
  lemma: string
  reading: string
  /** meaning の先頭。無ければ空文字 */
  meaning: string
  unitId: string
  state: WordState
  /** FSRS の安定度(日)。記録が無いときは null */
  stabilityDays: number | null
  lapses: number
  /** 次の復習の日時(ISO)。記録が無いときは null */
  due: string | null
  /** 現在から次の復習までの日数(切り上げ)。0 以下は「今日(期限が来ている)」。記録が無いときは null */
  dueInDays: number | null
}

export interface WordStats {
  entries: WordEntry[]
  counts: Record<WordState, number>
  total: number
  /** 未学習以外の語数 */
  seen: number
  /** state が mature の語数 */
  mature: number
  /** FSRS の期限が来ている語数(状態に関係なく、記録があり isDue が true のもの) */
  dueNow: number
}

export function buildWordStats(data: StudyData, now: Date): WordStats {
  const entries: WordEntry[] = []
  const counts: Record<WordState, number> = {
    unseen: 0,
    learning: 0,
    young: 0,
    mature: 0,
    fading: 0,
  }
  let dueNow = 0

  for (const unit of data.plan.units) {
    const unitContent = data.content.units[unit.id]
    if (!unitContent || unitContent.words.length === 0) continue

    for (const word of unitContent.words) {
      const record = data.progress.fsrs[word.id]
      const introduced =
        data.progress.unitProgress[unit.id]?.introducedItemIds.includes(word.id) ?? false

      let state: WordState
      if ((record === undefined || record.reps === 0) && !introduced) {
        state = 'unseen'
      } else if (
        record === undefined ||
        record.reps === 0 ||
        record.state === 1 ||
        record.state === 3
      ) {
        state = 'learning'
      } else if (isDue(record, now)) {
        state = 'fading'
      } else if (record.stability >= MATURE_STABILITY_DAYS) {
        state = 'mature'
      } else {
        state = 'young'
      }

      const due = record?.due ?? null
      const dueInDays =
        due === null ? null : Math.ceil((Date.parse(due) - now.getTime()) / 86400000)

      entries.push({
        id: word.id,
        lemma: word.lemma,
        reading: word.reading ?? '',
        meaning: word.meaning?.[0] ?? '',
        unitId: unit.id,
        state,
        stabilityDays: record?.stability ?? null,
        lapses: record?.lapses ?? 0,
        due,
        dueInDays,
      })

      counts[state] += 1
      if (record !== undefined && isDue(record, now)) {
        dueNow += 1
      }
    }
  }

  const total = entries.length
  return {
    entries,
    counts,
    total,
    seen: total - counts.unseen,
    mature: counts.mature,
    dueNow,
  }
}
