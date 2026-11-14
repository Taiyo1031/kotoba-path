import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  SkeletonEnvelopeSchema,
  StudyDataSchema,
  UnitEnvelopeSchema,
  validateStudyDataReferences,
  validateUnitContentReferences,
} from './index'

const fixturesDirectory = resolve('fixtures')
const notice = '開発用ダミー・内容の正確性は未検証'

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixturesDirectory, name), 'utf8')) as unknown
}

describe('開発用ダミーデータ', () => {
  it.each(readdirSync(fixturesDirectory).filter((name) => name.endsWith('.json')))(
    '%s に未検証の注意書きがある',
    (name) => {
      const input = readFixture(name)
      expect(input, `入力: ${name}`).toHaveProperty('_notice', notice)
      expect(input, `入力: ${name}`).toHaveProperty(
        '_notice',
        expect.stringContaining('開発用ダミー'),
      )
    },
  )

  it('骨組みがスキーマを満たし、u03 だけを任意単元とする', () => {
    const input = readFixture('dummy-skeleton.json')
    const skeleton = SkeletonEnvelopeSchema.parse(input)
    expect(
      skeleton.units.map(({ id, title, optional, status }) => ({ id, title, optional, status })),
      `入力: ${JSON.stringify(input)}`,
    ).toEqual([
      { id: 'u01', title: 'あいさつと自己紹介', optional: false, status: 'planned' },
      { id: 'u02', title: '食べ物を注文する', optional: false, status: 'planned' },
      { id: 'u03', title: '道をたずねる', optional: true, status: 'planned' },
    ])
  })

  it('単元がスキーマを満たし、すべての参照が単元内で解決する', () => {
    const unit = UnitEnvelopeSchema.parse(readFixture('dummy-unit-u01.json'))
    expect(unit.unitId, '入力: dummy-unit-u01.json').toBe('u01')
    expect(validateUnitContentReferences(unit), '入力: dummy-unit-u01.json').toEqual([])
    expect(unit.words, '入力: dummy-unit-u01.json').toHaveLength(16)
    for (const word of unit.words) {
      expect(word.id, `入力: ${JSON.stringify(word)}`).toBe(
        `ms:${word.lemma.toLowerCase().replaceAll(' ', '-')}`,
      )
    }
    const relations = unit.words.flatMap((word) => word.rel)
    expect(relations.length, `入力: ${JSON.stringify(relations)}`).toBeGreaterThanOrEqual(4)
    expect(new Set(relations.map((relation) => relation.type))).toEqual(
      new Set(['related', 'antonym', 'confusable', 'synonym']),
    )
    expect(
      unit.words.filter((word) => word.uncertain),
      '入力: u01 の単語',
    ).toHaveLength(1)
    expect(unit.words.filter((word) => word.tags.length > 0).length).toBeGreaterThanOrEqual(3)
    expect(unit.words.filter((word) => word.tags.includes('country'))).toHaveLength(3)
    expect(unit.phrases).toHaveLength(3)
    expect(unit.phrases.filter((phrase) => !phrase.fixed)).toHaveLength(2)
    expect(unit.phrases.filter((phrase) => phrase.fixed)).toHaveLength(1)
    expect(unit.sentences).toHaveLength(4)
    expect(unit.grammarNotes).toHaveLength(2)
    for (const field of ['sentences', 'grammarNotes'] as const) {
      const ids = unit[field].map((item) => item.id)
      expect(new Set(ids).size, `入力: ${field}: ${JSON.stringify(ids)}`).toBe(ids.length)
    }
    for (const phrase of unit.phrases) {
      for (const [name, slot] of Object.entries(phrase.slots)) {
        expect(phrase.target, `入力: ${phrase.id}, スロット: ${name}`).toContain(`{${name}}`)
        expect(phrase.meaning, `入力: ${phrase.id}, スロット: ${name}`).toContain(`{${name}}`)
        expect(
          unit.words.some((word) => word.tags.includes(slot.tag)),
          `入力: ${phrase.id}, タグ: ${slot.tag}`,
        ).toBe(true)
      }
    }
  })

  it('保存データがスキーマを満たし、単元の内容が封筒と一致し、全単元が未検証である', () => {
    const full = StudyDataSchema.parse(readFixture('dummy-full.json'))
    const unit = UnitEnvelopeSchema.parse(readFixture('dummy-unit-u01.json'))
    const skeleton = SkeletonEnvelopeSchema.parse(readFixture('dummy-skeleton.json'))
    expect(validateStudyDataReferences(full), '入力: dummy-full.json').toEqual([])
    expect(full.format).toBe('lang-study-data')
    expect(full.version).toBe(1)
    expect(full.profile).toMatchObject({
      nativeLanguage: 'ja',
      targetLanguage: 'ms',
      uiLanguage: 'ja',
      goal: { deadline: '2027-03-31', targetLevel: 'A2', dailyMinutes: 20 },
    })
    expect(full.meta).toEqual({ exportedAt: '2026-11-14T00:00:00.000Z', appVersion: '0.1.0' })
    expect(full.plan.units).toEqual(
      skeleton.units.map((plannedUnit) => ({
        ...plannedUnit,
        status: plannedUnit.id === 'u01' ? 'ready' : 'planned',
      })),
    )
    expect(Object.keys(full.content.units)).toEqual(['u01'])
    expect(full.content.units.u01).toEqual({
      version: 1,
      verified: false,
      generatedBy: { tool: 'dummy-fixture', at: '2026-11-14T00:00:00.000Z' },
      words: unit.words,
      phrases: unit.phrases,
      sentences: unit.sentences,
      grammarNotes: unit.grammarNotes,
    })
    for (const [id, content] of Object.entries(full.content.units)) {
      expect(content.verified, `入力: dummy-full.json の ${id}`).toBe(false)
      expect(validateUnitContentReferences(content), `入力: dummy-full.json の ${id}`).toEqual([])
    }
    expect(full.progress.xp).toBe(30)
    expect(full.progress.streak).toEqual({ days: 2, lastStudyDate: '2026-11-13' })
    expect(Object.keys(full.progress.fsrs)).toHaveLength(3)
    expect(full.progress.sessions).toHaveLength(2)
    const wordIds = new Set(unit.words.map((word) => word.id))
    for (const id of Object.keys(full.progress.fsrs)) {
      expect(wordIds.has(id), `入力: FSRS の ${id}`).toBe(true)
    }
    const unitIds = new Set(full.plan.units.map((plannedUnit) => plannedUnit.id))
    for (const [id, progress] of Object.entries(full.progress.unitProgress)) {
      expect(unitIds.has(id), `入力: unitProgress の ${id}`).toBe(true)
      for (const itemId of [...progress.introducedItemIds, ...progress.wrongItemIds]) {
        expect(wordIds.has(itemId), `入力: unitProgress の ${itemId}`).toBe(true)
      }
    }
    for (const session of full.progress.sessions) {
      expect(unitIds.has(session.unitId ?? ''), `入力: ${JSON.stringify(session)}`).toBe(true)
    }
  })
})

describe('生成済み JSON Schema', () => {
  it.each([
    ['study-data.schema.json', 'StudyData'],
    ['skeleton.schema.json', 'SkeletonEnvelope'],
    ['unit.schema.json', 'UnitEnvelope'],
  ])('%s が存在し、JSON として解析できる', (name, title) => {
    const input: unknown = JSON.parse(readFileSync(resolve('public/schema', name), 'utf8'))
    expect(input, `入力: ${name}`).toHaveProperty('properties')
    expect(input, `入力: ${name}`).toHaveProperty(
      '$schema',
      'https://json-schema.org/draft/2020-12/schema',
    )
    expect(input, `入力: ${name}`).toHaveProperty('title', title)
  })
})
