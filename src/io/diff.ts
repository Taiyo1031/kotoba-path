import type { UnitContent } from '../schema'

export interface IdDiff {
  added: string[]
  removed: string[]
  kept: string[]
}
export interface ContentDiff {
  words: IdDiff
  phrases: IdDiff
  sentences: IdDiff
  grammarNotes: IdDiff
}

export function diffIds(before: ReadonlyArray<string>, after: ReadonlyArray<string>): IdDiff {
  const oldIds = new Set(before)
  const newIds = new Set(after)
  return {
    added: [...newIds].filter((id) => !oldIds.has(id)),
    removed: [...oldIds].filter((id) => !newIds.has(id)),
    kept: [...newIds].filter((id) => oldIds.has(id)),
  }
}

export function diffContent(before: UnitContent, after: UnitContent): ContentDiff {
  const field = (key: keyof ContentDiff) =>
    diffIds(
      before[key].map((item) => item.id),
      after[key].map((item) => item.id),
    )
  return {
    words: field('words'),
    phrases: field('phrases'),
    sentences: field('sentences'),
    grammarNotes: field('grammarNotes'),
  }
}
