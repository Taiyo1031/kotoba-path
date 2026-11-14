import type { StudyData, Word } from '../schema'

export const CSV_BOM = '\uFEFF'

export function escapeCsvField(value: string): string {
  return /[,"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function wordsToCsv(words: ReadonlyArray<Word>): string {
  const rows = words.map((word) =>
    [
      word.id,
      word.lemma,
      word.pos,
      word.reading,
      word.meaning.join(';'),
      word.tags.join(';'),
      word.rel.map(({ type, id }) => `${type}:${id}`).join(';'),
    ]
      .map(escapeCsvField)
      .join(','),
  )
  return CSV_BOM + ['id,lemma,pos,reading,meaning,tags,rel', ...rows].join('\r\n') + '\r\n'
}

export function collectWords(data: StudyData): Word[] {
  const planned = new Set(data.plan.units.map(({ id }) => id))
  const ids = [
    ...planned,
    ...Object.keys(data.content.units)
      .filter((id) => !planned.has(id))
      .sort(),
  ]
  return ids.flatMap((id) => data.content.units[id]?.words ?? [])
}
