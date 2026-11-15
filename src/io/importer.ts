import { GuideEnvelopeSchema } from '../schema/guide'
import type { Guide } from '../schema/guide'
import { APP_CONFIG } from '../config/app'
import type { AppStore } from '../db'
import { buildWordIdRewrites, normalizeWordId, normalizePhraseId, parseWordId } from '../ids'
import {
  SkeletonEnvelopeSchema,
  UnitEnvelopeSchema,
  PlanSchema,
  validateUnitContentReferences,
  zodIssuesToValidationIssues,
} from '../schema'
import type { Plan, PlanUnit, UnitContent } from '../schema'
import { stripCodeFence } from './fence'
import { diffIds, diffContent } from './diff'
import type { IdDiff, ContentDiff } from './diff'

export type IssueSeverity = 'error' | 'warning'
export interface ImportIssue {
  path: string
  message: string
  severity: IssueSeverity
}
export interface IdRewrite {
  path: string
  from: string
  to: string
}
export interface ImportContext {
  targetLanguage: string
  planUnitIds: ReadonlyArray<string>
  existingGuide?: Guide
  existingContent?: UnitContent
  otherWordIds?: ReadonlySet<string>
  existingPlan?: Plan
  unitIdsWithData?: ReadonlySet<string>
  now: string
}
export interface SkeletonPreview {
  kind: 'skeleton'
  ok: boolean
  issues: ImportIssue[]
  units: PlanUnit[]
  counts: { units: number }
  diff: IdDiff
}
export interface UnitPreview {
  kind: 'unit'
  ok: boolean
  issues: ImportIssue[]
  unitId: string
  content?: UnitContent
  counts: { words: number; phrases: number; sentences: number; grammarNotes: number }
  rewrites: IdRewrite[]
  diff?: ContentDiff
}
export interface GuidePreview {
  kind: 'guide'
  ok: boolean
  issues: ImportIssue[]
  guide?: Guide
  counts: { sounds: number; rules: number }
}
export interface FailedPreview {
  kind: 'invalid'
  ok: false
  issues: ImportIssue[]
}
export type ImportPreview = SkeletonPreview | UnitPreview | GuidePreview | FailedPreview

export function parseImportText(text: string, context: ImportContext): ImportPreview {
  const issues: ImportIssue[] = []
  const issue = (path: string, message: string, severity: IssueSeverity = 'error') => {
    issues.push({ path, message, severity })
  }
  const failed = (): FailedPreview => ({ kind: 'invalid', ok: false, issues })
  let input: unknown
  try {
    input = JSON.parse(stripCodeFence(text))
  } catch (error) {
    issue('$', error instanceof Error ? error.message : 'JSONを解析できません')
    return failed()
  }
  const format =
    input !== null && typeof input === 'object' && 'format' in input ? input.format : undefined
  if (
    format !== APP_CONFIG.skeletonFormat &&
    format !== APP_CONFIG.unitFormat &&
    format !== APP_CONFIG.guideFormat
  ) {
    issue(
      '$.format',
      format === APP_CONFIG.dataFormat
        ? '全体バックアップは「読み込み(復元)」から読み込んでください'
        : '取り込み形式が不明です',
    )
    return failed()
  }
  if (format === APP_CONFIG.guideFormat) {
    const parsed = GuideEnvelopeSchema.safeParse(input)
    if (!parsed.success) {
      zodIssuesToValidationIssues(parsed.error).forEach((entry) => issue(entry.path, entry.message))
      return failed()
    }
    const { intro, sounds, rules } = parsed.data
    const guide: Guide = {
      version: (context.existingGuide?.version ?? 0) + 1,
      verified: false,
      generatedBy: { tool: 'import', at: context.now },
      intro,
      sounds,
      rules,
    }
    if (sounds.length < 10 || sounds.length > 40)
      issue('sounds', '音の数が10〜40の範囲外です', 'warning')
    const ok = !issues.some((entry) => entry.severity === 'error')
    return {
      kind: 'guide',
      ok,
      issues,
      ...(ok ? { guide } : {}),
      counts: { sounds: sounds.length, rules: rules.length },
    }
  }
  if (format === APP_CONFIG.skeletonFormat) {
    // 封筒スキーマに加え、PlanSchemaで単元IDの重複も検証する。
    const parsed = SkeletonEnvelopeSchema.safeParse(input)
    if (!parsed.success) {
      zodIssuesToValidationIssues(parsed.error).forEach((entry) => issue(entry.path, entry.message))
      return failed()
    }
    const { units } = parsed.data
    const plan = PlanSchema.safeParse({ units })
    if (!plan.success)
      zodIssuesToValidationIssues(plan.error).forEach((entry) => issue(entry.path, entry.message))
    const diff = diffIds(
      context.existingPlan?.units.map((unit) => unit.id) ?? [],
      units.map((unit) => unit.id),
    )
    for (const id of diff.removed) {
      if (context.unitIdsWithData?.has(id))
        issue('units', `内容または学習履歴のある単元 "${id}" は骨組みから外せません`)
    }
    return {
      kind: 'skeleton',
      ok: !issues.some((entry) => entry.severity === 'error'),
      issues,
      units,
      counts: { units: units.length },
      diff,
    }
  }
  const parsed = UnitEnvelopeSchema.safeParse(input)
  if (!parsed.success) {
    zodIssuesToValidationIssues(parsed.error).forEach((entry) => issue(entry.path, entry.message))
    return failed()
  }
  const { unitId, words, phrases, sentences, grammarNotes } = parsed.data
  if (!context.planUnitIds.includes(unitId))
    issue('unitId', '骨組みに無い単元です。先に骨組みを取り込んでください')
  const rewrites: IdRewrite[] = []
  const rewrite = (path: string, from: string, to: string): string => {
    if (from !== to) {
      rewrites.push({ path, from, to })
      issue(path, `IDを "${from}" から "${to}" に正規化しました`, 'warning')
    }
    return to
  }
  const wordMap = new Map<string, string>()
  const normalizedMap = new Map<string, string>()
  const built = buildWordIdRewrites(words, context.targetLanguage)
  words.forEach((word, i) => {
    const to = built.ids[i] ?? word.id
    if (!wordMap.has(word.id)) wordMap.set(word.id, to)
    const normalized = normalizeWordId(word.id, {
      language: context.targetLanguage,
      lemma: word.lemma,
    })
    if (!normalizedMap.has(normalized)) normalizedMap.set(normalized, to)
    word.id = rewrite(`words[${i}].id`, word.id, to)
  })
  const phraseMap = new Map<string, string>()
  phrases.forEach((phrase, i) => {
    const to = normalizePhraseId(phrase.id)
    phraseMap.set(phrase.id, to)
    phraseMap.set(to, to)
    phrase.id = rewrite(`phrases[${i}].id`, phrase.id, to)
  })
  const resolveWord = (id: string) =>
    wordMap.get(id) ??
    normalizedMap.get(id.trim() ? normalizeWordId(id, { language: context.targetLanguage }) : id) ??
    id
  words.forEach((word, i) =>
    word.rel.forEach((rel, j) => {
      rel.id = rewrite(`words[${i}].rel[${j}].id`, rel.id, resolveWord(rel.id))
    }),
  )
  sentences.forEach((sentence, i) => {
    sentence.wordIds = sentence.wordIds.map((id, j) =>
      rewrite(`sentences[${i}].wordIds[${j}]`, id, resolveWord(id)),
    )
  })
  grammarNotes.forEach((note, i) => {
    note.appliesTo = note.appliesTo.map((id, j) =>
      rewrite(
        `grammarNotes[${i}].appliesTo[${j}]`,
        id,
        wordMap.get(id) ??
          phraseMap.get(id) ??
          normalizedMap.get(
            id.trim() ? normalizeWordId(id, { language: context.targetLanguage }) : id,
          ) ??
          phraseMap.get(normalizePhraseId(id)) ??
          id,
      ),
    )
  })
  words.forEach((word, i) => {
    if (parseWordId(word.id)?.language !== context.targetLanguage)
      issue(`words[${i}].id`, '単語IDの言語が対象言語と一致しません')
  })
  const content: UnitContent = {
    version: (context.existingContent?.version ?? 0) + 1,
    verified: false,
    generatedBy: { tool: 'import', at: context.now },
    words,
    phrases,
    sentences,
    grammarNotes,
  }
  validateUnitContentReferences(content).forEach((entry) => issue(entry.path, entry.message))
  const seen = new Map<string, Set<string>>()
  words.forEach((word, i) => {
    if (context.otherWordIds?.has(word.id))
      issue(`words[${i}].id`, '他の単元に同じIDの単語があります', 'warning')
    const positions = seen.get(word.lemma) ?? new Set<string>()
    if (positions.has(word.pos)) issue(`words[${i}].lemma`, '重複の可能性', 'warning')
    positions.add(word.pos)
    seen.set(word.lemma, positions)
  })
  if (words.length < 15 || words.length > 25)
    issue('words', '単語数が15〜25の範囲外です', 'warning')
  const uncertain = words.filter((word) => word.uncertain).length
  if (uncertain) issue('words', `要確認の単語が${uncertain}件あります (uncertain: true)`, 'warning')
  const ok = !issues.some((entry) => entry.severity === 'error')
  return {
    kind: 'unit',
    ok,
    issues,
    unitId,
    ...(ok ? { content } : {}),
    counts: {
      words: words.length,
      phrases: phrases.length,
      sentences: sentences.length,
      grammarNotes: grammarNotes.length,
    },
    rewrites,
    ...(context.existingContent ? { diff: diffContent(context.existingContent, content) } : {}),
  }
}

export async function commitImport(
  preview: ImportPreview,
  store: AppStore,
  now: string,
): Promise<void> {
  void now
  if (preview.kind === 'invalid' || !preview.ok)
    throw new Error('エラーのある取り込みは保存できません')
  if (preview.kind === 'guide') {
    if (!preview.guide) throw new Error('取り込む内容がありません')
    await store.saveGuide(preview.guide)
    return
  }
  const plan = await store.loadPlan()
  if (preview.kind === 'skeleton') {
    const existing = new Map(plan?.units.map((unit) => [unit.id, unit]))
    await store.savePlan({
      units: preview.units.map((unit) => {
        const old = existing.get(unit.id)
        const { plannedStart: _start, plannedEnd: _end, ...fields } = unit
        void _start
        void _end
        return {
          ...fields,
          status: old?.status ?? 'planned',
          ...(old?.plannedStart !== undefined ? { plannedStart: old.plannedStart } : {}),
          ...(old?.plannedEnd !== undefined ? { plannedEnd: old.plannedEnd } : {}),
        }
      }),
    })
    return
  }
  if (!plan || !plan.units.some((unit) => unit.id === preview.unitId))
    throw new Error('骨組みに無い単元です')
  if (!preview.content) throw new Error('取り込む内容がありません')
  await store.saveUnitContent(preview.unitId, preview.content)
  if (plan.units.some((unit) => unit.id === preview.unitId && unit.status === 'planned')) {
    await store.savePlan({
      ...plan,
      units: plan.units.map((unit) =>
        unit.id === preview.unitId && unit.status === 'planned'
          ? { ...unit, status: 'ready' }
          : unit,
      ),
    })
  }
}
