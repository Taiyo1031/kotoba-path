import { GuideSchema } from '../schema/guide'
import { describe, it, expect } from 'vitest'
import { APP_CONFIG } from '../config/app'
import { createAppStore } from '../db'
import { StudyDataSchema, FsrsRecordSchema, UnitProgressSchema, UnitContentSchema } from '../schema'
import type { SessionLog, StudyData } from '../schema'
import { exportFileName, exportStudyDataJson } from './exporter'
import { CSV_BOM, collectWords, escapeCsvField, wordsToCsv } from './csv'
import { MigrationError, migrations, migrateStudyData } from './migrate'
import { applyFullImport, capSessions, mergeStudyData, parseFullImport } from './fullImport'
import { getBackupStatus, recordBackup } from './backup'

const at = '2026-01-05T00:00:00.000Z'
function makeData(): StudyData {
  return StudyDataSchema.parse({
    format: APP_CONFIG.dataFormat,
    version: APP_CONFIG.dataVersion,
    meta: { exportedAt: at, appVersion: 'test' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'ms',
      goal: { targetLevel: 'A1', deadline: '2027-01-01', dailyMinutes: 20 },
    },
    plan: { units: [{ id: 'u1', title: 'One', canDo: 'One' }] },
    content: {
      units: {
        u1: UnitContentSchema.parse({
          generatedBy: { tool: 'test', at },
          words: [{ id: 'ms:one', lemma: 'one', pos: 'noun', meaning: ['一'] }],
        }),
      },
    },
    progress: {},
  })
}
function sessions(count: number): SessionLog[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    kind: 'review',
    seed: i,
    startedAt: new Date(Date.parse(at) + i * 1000).toISOString(),
    answered: 1,
    correct: 1,
    xpGained: 1,
  }))
}

describe('JSON / CSV', () => {
  it('JSON が改行付きで往復し、ローカル日付のファイル名を作る', () => {
    const data = makeData()
    expect(exportStudyDataJson(data), '入力: 学習データ').toBe(JSON.stringify(data, null, 2) + '\n')
    expect(parseFullImport(exportStudyDataJson(data)), '入力: 書き出したJSON').toEqual({
      ok: true,
      data,
      warnings: [],
    })
    const now = new Date(2026, 0, 5, 0, 1)
    expect(exportFileName('json', now), '入力: ローカル2026-01-05').toBe(
      'kotoba-path-2026-01-05.json',
    )
    expect(exportFileName('csv', now), '入力: ローカル2026-01-05').toBe(
      'kotoba-path-words-2026-01-05.csv',
    )
  })
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['a"b', '"a""b"'],
    ['a\nb', '"a\nb"'],
    ['a\rb', '"a\rb"'],
  ])('CSVの %j をエスケープ', (input, expected) => {
    expect(escapeCsvField(input), `入力: ${JSON.stringify(input)}`).toBe(expected)
  })
  it('BOM、ヘッダ、CRLF、連結形式を出力する', () => {
    const word = collectWords(makeData())[0]!
    const csv = wordsToCsv([
      {
        ...word,
        lemma: 'a,"b\nc',
        meaning: ['一', '二'],
        tags: ['x', 'y'],
        rel: [
          { type: 'related', id: 'ms:minum' },
          { type: 'antonym', id: 'ms:lapar' },
        ],
      },
    ])
    expect(csv, '入力: 特殊文字と複数要素').toBe(
      CSV_BOM +
        'id,lemma,pos,reading,meaning,tags,rel\r\nms:one,"a,""b\nc",noun,,一;二,x;y,related:ms:minum;antonym:ms:lapar\r\n',
    )
    expect(wordsToCsv([]), '入力: 空配列').toBe(
      CSV_BOM + 'id,lemma,pos,reading,meaning,tags,rel\r\n',
    )
  })
  it('planの順、その後は未掲載単元IDの昇順で集める', () => {
    const data = makeData()
    const unit = data.content.units.u1!
    for (const id of ['z', 'a', 'u2'])
      data.content.units[id] = {
        ...unit,
        words: [{ ...unit.words[0]!, id }],
      }
    data.plan.units.unshift({ ...data.plan.units[0]!, id: 'u2' })
    expect(
      collectWords(data).map((w) => w.id),
      '入力: u2,u1 / z,a,u2',
    ).toEqual(['u2', 'ms:one', 'a', 'z'])
  })
})

describe('migration / validation', () => {
  it('現行版は同じオブジェクトを返し、旧版はレジストリを適用する', () => {
    const data = makeData()
    expect(migrateStudyData(data), '入力: 現行版').toBe(data)
    migrations[0] = (raw) => ({ ...(raw as Record<string, unknown>), version: 1 })
    try {
      expect(migrateStudyData({ ...data, version: 0 }), '入力: 旧版0').toEqual(data)
    } finally {
      delete migrations[0]
    }
  })
  it.each([
    null,
    {},
    { format: 'other', version: 1 },
    { format: APP_CONFIG.dataFormat, version: '1' },
    { format: APP_CONFIG.dataFormat, version: 1.5 },
    { format: APP_CONFIG.dataFormat, version: 2 },
    { format: APP_CONFIG.dataFormat, version: 0 },
  ])('不正形式 %j を拒否', (raw) => {
    expect(() => migrateStudyData(raw), `入力: ${JSON.stringify(raw)}`).toThrow(MigrationError)
  })
  it('JSON、版、スキーマ、参照エラーのパスを返す', () => {
    expect(parseFullImport('{'), '入力: 壊れたJSON').toMatchObject({
      ok: false,
      errors: [{ path: '$' }],
    })
    const data = makeData()
    expect(parseFullImport(JSON.stringify({ ...data, version: 2 })), '入力: 未来版').toMatchObject({
      ok: false,
      errors: [{ path: '$.version', message: 'このファイルは新しい版のアプリで作られています' }],
    })
    data.plan.units[0]!.id = '!'
    expect(parseFullImport(JSON.stringify(data)), '入力: 不正な単元ID').toMatchObject({
      ok: false,
      errors: [{ path: 'plan.units[0].id', severity: 'error' }],
    })
    data.plan.units[0]!.id = 'u1'
    data.content.units.u1!.words[0]!.rel = [{ type: 'related', id: 'missing' }]
    expect(parseFullImport(JSON.stringify(data)), '入力: 参照切れ').toMatchObject({
      ok: false,
      errors: [{ path: 'content.units.u1.words[0].rel[0].id' }],
    })
  })
  it('履歴超過は警告し、解析時には削除しない', () => {
    const data = makeData()
    data.progress.sessions = sessions(APP_CONFIG.sessionsMax + 1)
    const result = parseFullImport(JSON.stringify(data))
    expect(result, '入力: 上限+1件').toMatchObject({
      ok: true,
      warnings: [{ path: 'progress.sessions', severity: 'warning' }],
    })
    if (result.ok) expect(result.data, '入力: 上限+1件').toEqual(data)
  })
})

describe('merge / storage', () => {
  it('最新の履歴を残して古い順に返す', () => {
    const input = sessions(5).reverse()
    expect(capSessions(input, 2), '入力: 逆順の5件').toEqual(sessions(5).slice(3))
    expect(capSessions(input, 0), '入力: 上限0').toEqual([])
    expect(input, '入力配列の不変性').toEqual(sessions(5).reverse())
  })
  it.each(['inProgress', 'done'] as const)('%sの予定と進捗を保護して統合する', (status) => {
    const current = makeData(),
      incoming = makeData()
    current.plan.units[0] = { ...current.plan.units[0]!, status, plannedStart: '2026-01-01' }
    current.plan.units.push({ ...current.plan.units[0]!, id: 'old' })
    incoming.plan.units[0] = {
      ...incoming.plan.units[0]!,
      title: 'New',
      plannedStart: '2026-02-01',
      plannedEnd: '2026-02-02',
    }
    incoming.plan.units.push({ ...incoming.plan.units[0]!, id: 'new' })
    incoming.profile.nativeLanguage = 'en'
    incoming.meta.appVersion = 'new'
    incoming.content.units.u1!.version = 2
    current.content.units.old = current.content.units.u1!
    const record = FsrsRecordSchema.parse({
      due: at,
      stability: 1,
      difficulty: 1,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 1,
      lapses: 0,
      state: 1,
      lastReview: at,
    })
    current.progress.fsrs = {
      reviewed: record,
      reps: { ...record, lastReview: undefined },
      only: record,
    }
    incoming.progress.fsrs = {
      reviewed: { ...record, lastReview: '2026-02-01T00:00:00Z' },
      reps: { ...record, lastReview: undefined, reps: 2 },
      new: record,
    }
    current.progress.unitProgress.u1 = UnitProgressSchema.parse({
      completedStepIds: ['a'],
      introducedItemIds: ['x'],
      wrongItemIds: ['x'],
      startedAt: at,
      completedAt: at,
    })
    incoming.progress.unitProgress.u1 = UnitProgressSchema.parse({
      completedStepIds: ['a', 'b'],
      introducedItemIds: ['y'],
      wrongItemIds: ['y'],
      startedAt: '2026-02-01T00:00:00Z',
      completedAt: '2026-02-01T00:00:00Z',
    })
    incoming.progress.unitProgress.new = UnitProgressSchema.parse({})
    current.progress.xp = 10
    incoming.progress.xp = 20
    current.progress.streak = { days: 9, lastStudyDate: '2026-01-01' }
    incoming.progress.streak = { days: 1, lastStudyDate: '2026-01-02' }
    current.progress.sessions = sessions(10)
    incoming.progress.sessions = sessions(APP_CONFIG.sessionsMax + 5)
    const before = structuredClone({ current, incoming })
    const merged = mergeStudyData(current, incoming)
    expect({ current, incoming }, '入力の不変性').toEqual(before)
    expect(merged.profile, '入力: 異なるprofile').toEqual(current.profile)
    expect(merged.meta, '入力: incoming meta').toEqual(incoming.meta)
    expect(
      merged.plan.units.map((u) => u.id),
      '入力: 既存、新規単元',
    ).toEqual(['u1', 'old', 'new'])
    expect(merged.plan.units[0], '入力: 学習開始済み単元').toEqual({
      ...incoming.plan.units[0],
      status,
      plannedStart: '2026-01-01',
      plannedEnd: undefined,
    })
    expect(merged.content.units, '入力: コンテンツ更新').toEqual({
      ...current.content.units,
      ...incoming.content.units,
    })
    expect(merged.progress.fsrs, '入力: 日時とrepsによる選択').toEqual({
      ...incoming.progress.fsrs,
      only: record,
    })
    expect(merged.progress.unitProgress.u1, '入力: 進捗の集合と日時').toEqual({
      completedStepIds: ['a', 'b'],
      introducedItemIds: ['x', 'y'],
      wrongItemIds: ['x', 'y'],
      startedAt: at,
      completedAt: '2026-02-01T00:00:00Z',
    })
    expect(merged.progress.xp, '入力: xp 10/20').toBe(20)
    expect(merged.progress.streak, '入力: 新しい学習日').toEqual(incoming.progress.streak)
    expect(merged.progress.sessions, '入力: 重複と上限超過').toEqual(
      incoming.progress.sessions.slice(5),
    )
    incoming.progress.streak = { days: 10, lastStudyDate: current.progress.streak.lastStudyDate }
    expect(mergeStudyData(current, incoming).progress.streak, '入力: 同日の日数').toEqual(
      incoming.progress.streak,
    )
    expect(mergeStudyData(incoming, current).progress.streak, '入力: 同日の日数逆順').toEqual(
      incoming.progress.streak,
    )
  })
  it.each(['replace', 'merge', 'empty-merge'] as const)('DBへ%sを適用する', async (mode) => {
    const store = createAppStore(`test-full-import-${mode}`)
    try {
      const current = makeData(),
        incoming = makeData()
      current.progress.xp = 100
      current.content.units.old = current.content.units.u1!
      incoming.progress.sessions = sessions(APP_CONFIG.sessionsMax + 1)
      if (mode !== 'empty-merge') await store.saveStudyData(current)
      const before = structuredClone(incoming)
      const saved = await applyFullImport(store, incoming, mode === 'replace' ? 'replace' : 'merge')
      expect(incoming, '入力の不変性').toEqual(before)
      expect(saved.progress.xp, `入力: ${mode}`).toBe(mode === 'merge' ? 100 : 0)
      expect(saved.progress.sessions, '入力: 上限+1件').toEqual(incoming.progress.sessions.slice(1))
      expect(await store.listUnitContentIds(), `入力: ${mode}`).toEqual(
        mode === 'merge' ? ['old', 'u1'] : ['u1'],
      )
      const loaded = await store.loadStudyData(new Date(at))
      expect(loaded, '入力: 保存データ').toEqual({
        ...saved,
        meta: { exportedAt: at, appVersion: APP_CONFIG.appVersion },
      })
      await recordBackup(store, new Date(at))
      expect(await store.getLastBackupAt(), '入力: バックアップ記録').toBe(at)
    } finally {
      await store.resetAll()
      store.close()
    }
  })
})

describe('backup status', () => {
  it('未記録はバックアップが必要', () => {
    expect(getBackupStatus(null, new Date(at)), '入力: null').toEqual({
      daysSince: null,
      needsBackup: true,
    })
  })
  it.each([
    [6, 7, false],
    [7, 7, true],
    [8, 7, true],
    [6, 5, true],
  ])('%i日経過、閾値%i', (days, warnDays, needsBackup) => {
    const now = new Date(Date.parse(at) + days * 86_400_000 + 1000)
    expect(getBackupStatus(at, now, warnDays), `入力: ${days}日+1秒、閾値${warnDays}`).toEqual({
      daysSince: days,
      needsBackup,
    })
    if (warnDays === 7)
      expect(getBackupStatus(at, now), '入力: 既定の閾値').toEqual({ daysSince: days, needsBackup })
  })
})

function makeGuide() {
  return GuideSchema.parse({
    generatedBy: { tool: 'test', at: '2026-11-15T00:00:00.000Z' },
    intro: 'Guide',
    sounds: Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      grapheme: String(i),
      reading: String(i),
    })),
    rules: [{ id: 'r1', title: 'Rule', body: 'Read aloud' }],
  })
}

describe('guide backup', () => {
  it('exports and parses the guide in JSON', () => {
    const data = makeData()
    data.content.guide = makeGuide()
    const json = exportStudyDataJson(data)
    expect(JSON.parse(json).content.guide, json).toEqual(data.content.guide)
    expect(parseFullImport(json), json).toEqual({ ok: true, data, warnings: [] })
  })
  it.each(['current', 'incoming', 'neither'] as const)('merges guide from %s', async (source) => {
    const current = makeData()
    const incoming = makeData()
    if (source !== 'neither') current.content.guide = makeGuide()
    if (source === 'incoming') incoming.content.guide = { ...makeGuide(), version: 2 }
    const input = JSON.stringify({ current, incoming })
    const expected = incoming.content.guide ?? current.content.guide
    const merged = mergeStudyData(current, incoming)
    expect(merged.content.guide, input).toEqual(expected)
    if (!expected) expect(merged.content, input).not.toHaveProperty('guide')
    const store = createAppStore('test-guide-merge-' + source)
    try {
      await store.saveStudyData(current)
      await applyFullImport(store, incoming, 'merge')
      expect(await store.loadGuide(), input).toEqual(expected)
    } finally {
      store.close()
    }
  })
  it('restores guide with replacement', async () => {
    const store = createAppStore('test-guide-replace-1002')
    const data = makeData()
    data.content.guide = makeGuide()
    const input = exportStudyDataJson(data)
    try {
      const parsed = parseFullImport(input)
      expect(parsed.ok, input).toBe(true)
      if (!parsed.ok) throw new Error(JSON.stringify(parsed))
      await applyFullImport(store, parsed.data, 'replace')
      expect((await store.loadStudyData(new Date(at)))?.content.guide, input).toEqual(
        data.content.guide,
      )
    } finally {
      store.close()
    }
  })
})
