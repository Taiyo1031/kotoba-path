import { describe, it, expect } from 'vitest'
import { createAppStore } from '../db'
import { PlanUnitSchema, ProgressSchema, ProfileSchema, UnitEnvelopeSchema } from '../schema'
import { parseImportText, commitImport } from './importer'
import type { ImportContext, UnitPreview } from './importer'
import { diffIds } from './diff'

const now = '2026-11-15T00:00:00.000Z'
const context: ImportContext = { targetLanguage: 'ms', planUnitIds: ['u01'], now }
const planUnit = (id = 'u01') => PlanUnitSchema.parse({ id, title: id, canDo: '挨拶できる' })
function envelope(count = 15) {
  return UnitEnvelopeSchema.parse({
    format: 'lang-study-unit',
    version: 1,
    unitId: 'u01',
    words: Array.from({ length: count }, (_, i) => ({
      id: `ms:word${i}`,
      lemma: `word${i}`,
      pos: 'noun',
      meaning: ['意味'],
    })),
  })
}
const parse = (input: unknown, ctx = context) => parseImportText(JSON.stringify(input), ctx)
function unit(input = envelope(), ctx = context): UnitPreview {
  const result = parse(input, ctx)
  expect(result.kind).toBe('unit')
  if (result.kind !== 'unit') throw new Error('単元プレビューが必要です')
  return result
}
const skeleton = (ids = ['u01']) => ({
  format: 'lang-study-skeleton',
  version: 1,
  units: ids.map((id) => planUnit(id)),
})

describe('import preview', () => {
  it('正常な骨組みと単元の件数、生成情報', () => {
    expect(parse(skeleton())).toMatchObject({
      kind: 'skeleton',
      ok: true,
      counts: { units: 1 },
      diff: { added: ['u01'] },
    })
    expect(unit()).toMatchObject({
      ok: true,
      counts: { words: 15, phrases: 0, sentences: 0, grammarNotes: 0 },
      content: { version: 1, verified: false, generatedBy: { tool: 'import', at: now } },
    })
  })
  it('壊れたJSONと不明な形式', () => {
    expect(parseImportText('{broken}', context)).toMatchObject({
      kind: 'invalid',
      ok: false,
      issues: [{ path: '$', severity: 'error' }],
    })
    for (const format of [undefined, 'unknown', 'lang-study-data']) {
      const result = parse({ format })
      expect(result).toMatchObject({ ok: false, issues: [{ path: '$.format', severity: 'error' }] })
      if (format === 'lang-study-data') expect(result.issues[0]?.message).toContain('復元')
    }
  })
  it('スキーマと参照エラーのパス、部分成功なし', () => {
    const input = envelope()
    input.words[3]!.rel = [{ type: 'related', id: 'ms:missing' }]
    const result = unit(input)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'words[3].rel[0].id', severity: 'error' }),
    )
    expect(result.ok).toBe(false)
    expect(result.content).toBeUndefined()
    input.words[1]!.meaning = []
    expect(parse(input).issues).toContainEqual(
      expect.objectContaining({ path: 'words[1].meaning', severity: 'error' }),
    )
  })
  it('単語、フレーズと全参照を正規化し同形異義を採番する', () => {
    const input = envelope()
    input.words[0]!.id = 'MS:Makan'
    input.words[1]!.id = ' ms:makan '
    input.words[2]!.id = 'ms:buah besar'
    input.words[3]!.rel = [
      { type: 'related', id: 'MS:Makan' },
      { type: 'related', id: 'ms:buah besar' },
    ]
    input.phrases = [
      { id: 'ph:Hello World', target: 'hello', meaning: '挨拶', fixed: true, slots: {} },
    ]
    input.sentences = [
      {
        id: 's1',
        target: 'makan',
        meaning: '食べる',
        wordIds: ['MS:Makan', ' ms:makan ', ' MS:Buah Besar '],
      },
    ]
    input.grammarNotes = [
      {
        id: 'g1',
        title: '文法',
        hint: '説明',
        appliesTo: ['MS:Makan', 'ph:Hello World', ' ph:HELLO WORLD '],
      },
    ]
    const result = unit(input)
    expect(result.ok, JSON.stringify(result.issues)).toBe(true)
    expect(result.content?.words.slice(0, 3).map((word) => word.id)).toEqual([
      'ms:makan',
      'ms:makan~2',
      'ms:buah-besar',
    ])
    expect(result.content?.words[3]?.rel.map((rel) => rel.id)).toEqual([
      'ms:makan',
      'ms:buah-besar',
    ])
    expect(result.content?.sentences[0]?.wordIds).toEqual([
      'ms:makan',
      'ms:makan~2',
      'ms:buah-besar',
    ])
    expect(result.content?.grammarNotes[0]?.appliesTo).toEqual([
      'ms:makan',
      'ph:hello-world',
      'ph:hello-world',
    ])
    expect(result.rewrites.length).toBeGreaterThan(5)
    for (const rewrite of result.rewrites)
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: rewrite.path, severity: 'warning' }),
      )
  })
  it('警告は取り込み可能、未知の単元と異なる言語はエラー', () => {
    const input = envelope(2)
    input.words[0]!.uncertain = true
    input.words[1]!.lemma = input.words[0]!.lemma
    const result = unit(input, { ...context, otherWordIds: new Set(['ms:word0']) })
    expect(result.ok).toBe(true)
    expect(result.issues).toHaveLength(4)
    expect(result.issues.every((issue) => issue.severity === 'warning')).toBe(true)
    expect(unit(input, { ...context, planUnitIds: [] }).content).toBeUndefined()
    input.words[0]!.id = 'en:word0'
    expect(unit(input).issues).toContainEqual(
      expect.objectContaining({ path: 'words[0].id', severity: 'error' }),
    )
  })
  it('他単元だけにある参照を許可しない', () => {
    const input = envelope()
    input.sentences = [{ id: 's1', target: 'text', meaning: '意味', wordIds: ['ms:other'] }]
    expect(unit(input, { ...context, otherWordIds: new Set(['ms:other']) }).ok).toBe(false)
  })
  it('骨組みの削除保護と重複ID', () => {
    const result = parse(skeleton(['u02']), {
      ...context,
      existingPlan: { units: [planUnit()] },
      unitIdsWithData: new Set(['u01']),
    })
    expect(result.issues).toContainEqual({
      path: 'units',
      message: '内容または学習履歴のある単元 "u01" は骨組みから外せません',
      severity: 'error',
    })
    expect(result.ok).toBe(false)
    expect(parse(skeleton(['u01', 'u01'])).ok).toBe(false)
  })
  it('差分の順序', () => {
    expect(diffIds(['b', 'a', 'c'], ['c', 'd', 'b', 'e'])).toEqual({
      added: ['d', 'e'],
      removed: ['a'],
      kept: ['c', 'b'],
    })
  })
})

describe('commitImport', () => {
  it('再取り込みで履歴を保ち内容を置き換える', async () => {
    const store = createAppStore('test-import-history-201')
    try {
      await store.saveProfile(
        ProfileSchema.parse({
          uiLanguage: 'ja',
          nativeLanguage: 'ja',
          targetLanguage: 'ms',
          goal: { targetLevel: 'A1', deadline: '2027-01-01', dailyMinutes: 20 },
        }),
      )
      await store.savePlan({ units: [planUnit()] })
      const record = {
        due: now,
        stability: 1,
        difficulty: 2,
        elapsedDays: 1,
        scheduledDays: 2,
        reps: 3,
        lapses: 0,
        state: 2,
      }
      const progress = ProgressSchema.parse({
        fsrs: { 'ms:word0': record, 'ms:word1': record },
        unitProgress: { u01: { introducedItemIds: ['ms:word0'] } },
        xp: 10,
      })
      await store.saveProgress(progress)
      await commitImport(unit(), store, now)
      const existingContent = await store.loadUnitContent('u01')
      const input = envelope()
      input.words[0]!.id = 'ms:new'
      const preview = unit(input, { ...context, existingContent })
      expect(preview.diff?.words).toMatchObject({ added: ['ms:new'], removed: ['ms:word0'] })
      await commitImport(preview, store, now)
      expect(await store.loadProgress()).toEqual(progress)
      expect(await store.loadUnitContent('u01')).toEqual(preview.content)
      expect(preview.content).toMatchObject({ verified: false, version: 2 })
      expect((await store.loadPlan())?.units[0]?.status).toBe('ready')
      for (const status of ['inProgress', 'done'] as const) {
        await store.savePlan({ units: [{ ...planUnit(), status }] })
        await commitImport(preview, store, now)
        expect((await store.loadPlan())?.units[0]?.status).toBe(status)
      }
    } finally {
      store.close()
    }
  })
  it('骨組みの順序と既存の状態、日付を保持する', async () => {
    const store = createAppStore('test-import-plan-201')
    try {
      await commitImport(parse(skeleton()), store, now)
      await store.savePlan({
        units: [
          { ...planUnit(), status: 'done', plannedStart: '2026-11-01', plannedEnd: '2026-11-02' },
        ],
      })
      const input = skeleton(['u02', 'u01'])
      input.units.forEach((entry) => {
        entry.status = 'inProgress'
        entry.plannedStart = '2027-01-01'
        entry.title = '更新'
      })
      await commitImport(parse(input), store, now)
      const plan = await store.loadPlan()
      expect(plan?.units.map((entry) => entry.id)).toEqual(['u02', 'u01'])
      expect(plan?.units[0]).toMatchObject({ status: 'planned' })
      expect(plan?.units[0]?.plannedStart).toBeUndefined()
      expect(plan?.units[1]).toMatchObject({
        title: '更新',
        status: 'done',
        plannedStart: '2026-11-01',
        plannedEnd: '2026-11-02',
      })
    } finally {
      store.close()
    }
  })
  it('不正なプレビューと骨組みなしでは保存しない', async () => {
    const store = createAppStore('test-import-reject-201')
    try {
      await expect(commitImport(parse({}), store, now)).rejects.toThrow()
      await expect(
        commitImport(unit(envelope(), { ...context, planUnitIds: [] }), store, now),
      ).rejects.toThrow()
      await expect(commitImport(unit(), store, now)).rejects.toThrow()
      expect(await store.listUnitContentIds()).toEqual([])
      expect(await store.loadPlan()).toBeUndefined()
    } finally {
      store.close()
    }
  })
})
