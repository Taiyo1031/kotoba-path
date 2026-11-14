import type { UnitContent } from './content'
import type { ValidationIssue } from './issues'
import type { StudyData } from './studyData'

export function validateUnitContentReferences(
  content: Pick<UnitContent, 'words' | 'phrases' | 'sentences' | 'grammarNotes'>,
  options?: { knownWordIds?: ReadonlySet<string> },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const words = new Set(content.words.map((word) => word.id))
  const phrases = new Set(content.phrases.map((phrase) => phrase.id))
  const known = (id: string) => words.has(id) || !!options?.knownWordIds?.has(id)
  const missing = (id: string, path: string) => {
    issues.push({ path, message: `参照先 "${id}" が単元内に存在しません` })
  }
  for (const field of ['words', 'phrases'] as const) {
    const seen = new Set<string>()
    content[field].forEach((item, index) => {
      if (seen.has(item.id))
        issues.push({ path: `${field}[${index}].id`, message: `ID "${item.id}" が重複しています` })
      seen.add(item.id)
    })
  }
  content.words.forEach((word, i) =>
    word.rel.forEach((rel, j) => {
      if (!words.has(rel.id)) missing(rel.id, `words[${i}].rel[${j}].id`)
    }),
  )
  content.sentences.forEach((sentence, i) =>
    sentence.wordIds.forEach((id, j) => {
      if (!known(id)) missing(id, `sentences[${i}].wordIds[${j}]`)
    }),
  )
  content.grammarNotes.forEach((note, i) =>
    note.appliesTo.forEach((id, j) => {
      if (!known(id) && !phrases.has(id)) missing(id, `grammarNotes[${i}].appliesTo[${j}]`)
    }),
  )
  return issues
}

export function validateStudyDataReferences(data: StudyData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const knownWordIds = new Set(
    Object.values(data.content.units).flatMap((unit) => unit.words.map((word) => word.id)),
  )
  const previousUnits = new Set<string>()
  for (const [unitId, content] of Object.entries(data.content.units)) {
    const prefix = `content.units.${unitId}.`
    issues.push(
      ...validateUnitContentReferences(content, { knownWordIds }).map((issue) => ({
        ...issue,
        path: prefix + issue.path,
      })),
    )
    content.words.forEach((word, index) => {
      if (previousUnits.has(word.id))
        issues.push({
          path: `${prefix}words[${index}].id`,
          message: `単語ID "${word.id}" が別の単元と重複しています`,
        })
    })
    content.words.forEach((word) => previousUnits.add(word.id))
  }
  return issues
}
