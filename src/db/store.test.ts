import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_CONFIG } from '../config/app'
import { ProfileSchema, ProgressSchema, StudyDataSchema, UnitContentSchema } from '../schema'
import type { Plan, Profile, Progress, StudyData, UnitContent } from '../schema'
import { createAppStore, getAppStore, requestPersistentStorage } from './index'
import type { AppStore } from './index'

const now = new Date('2026-11-15T01:02:03.000Z')
const originalExportedAt = '2026-11-01T00:00:00.000Z'

function makeContent(): UnitContent {
  return UnitContentSchema.parse({
    generatedBy: { tool: 'test', at: originalExportedAt },
    words: [{ id: 'word-1', lemma: 'hello', pos: 'interjection', meaning: ['こんにちは'] }],
  })
}

function makeData(): StudyData {
  return StudyDataSchema.parse({
    format: APP_CONFIG.dataFormat,
    version: APP_CONFIG.dataVersion,
    meta: { exportedAt: originalExportedAt, appVersion: 'older-version' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: '日本語',
      targetLanguage: 'English',
      goal: { targetLevel: 'A1', deadline: '2027-01-01', dailyMinutes: 15 },
    },
    plan: {
      units: [
        { id: 'unit-1', title: 'あいさつ', canDo: 'あいさつできる' },
        { id: 'unit-2', title: '自己紹介', canDo: '自己紹介できる' },
      ],
    },
    content: { units: { 'unit-1': makeContent(), 'unit-2': makeContent() } },
    progress: {},
  })
}

function withCurrentMeta(data: StudyData): StudyData {
  return {
    ...data,
    meta: { exportedAt: now.toISOString(), appVersion: APP_CONFIG.appVersion },
  }
}

let sequence = 0
const stores: AppStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AppStore', () => {
  let dbName: string
  let store: AppStore

  beforeEach(() => {
    dbName = `app-store-test-${++sequence}`
    store = createAppStore(dbName)
    stores.push(store)
  })

  it('空のDBでは必須データ・単元・バックアップ日時がない', async () => {
    expect(await store.loadStudyData(now), '入力: 空のDB').toBeNull()
    expect(await store.getLastBackupAt(), '入力: 空のDB').toBeNull()
    expect(await store.loadProfile(), '入力: 空のDB').toBeUndefined()
    expect(await store.loadPlan(), '入力: 空のDB').toBeUndefined()
    expect(await store.loadProgress(), '入力: 空のDB').toBeUndefined()
    expect(await store.loadUnitContent('missing'), '入力: missing').toBeUndefined()
    expect(await store.listUnitContentIds(), '入力: 空のDB').toEqual([])
  })

  it('全データを保存し、指定された日時と現在のバージョンで読み込む', async () => {
    const data = makeData()
    await store.saveStudyData(data)
    expect(await store.loadStudyData(now), '入力: 全データと明示的なnow').toEqual(
      withCurrentMeta(data),
    )
  })

  it('nowを省略すると読み込み時の日時を使う', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    const data = makeData()
    await store.saveStudyData(data)
    expect(await store.loadStudyData(), '入力: nowなし').toEqual(withCurrentMeta(data))
  })

  it('DB version 1の2ストアに値を直接保存し、metaを保存しない', async () => {
    const data = makeData()
    await store.saveStudyData(data)
    const db = await openDB(dbName, 1)
    try {
      expect(db.version, '入力: 作成したDB').toBe(1)
      expect(Array.from(db.objectStoreNames), '入力: ストア名').toEqual([
        'singletons',
        'unitContent',
      ])
      expect(await db.getAllKeys('singletons'), '入力: 全データ保存後のキー').toEqual([
        'plan',
        'profile',
        'progress',
      ])
      expect(await db.get('singletons', 'profile'), '入力: profileの保存形式').toEqual(data.profile)
      expect(await db.get('unitContent', 'unit-1'), '入力: 単元の保存形式').toEqual(
        data.content.units['unit-1'],
      )
    } finally {
      db.close()
    }
  })

  it('close後に別の接続から保存済みのデータを読める', async () => {
    const data = makeData()
    await store.saveStudyData(data)
    store.close()
    const reopened = createAppStore(dbName)
    stores.push(reopened)
    expect(await reopened.loadStudyData(now), '入力: 同じDB名の新しい接続').toEqual(
      withCurrentMeta(data),
    )
  })

  it('profile・plan・progressがそろうまでnullを返す', async () => {
    const data = makeData()
    await store.saveProfile(data.profile)
    expect(await store.loadStudyData(now), '入力: profileのみ').toBeNull()
    await store.savePlan(data.plan)
    expect(await store.loadStudyData(now), '入力: profileとplan').toBeNull()
    await store.saveProgress(data.progress)
    expect(await store.loadStudyData(now), '入力: 必須データのみ、contentなし').toEqual({
      ...withCurrentMeta(data),
      content: { units: {} },
    })
  })

  it('単元ごとに保存・上書き・読み込み・一覧取得・削除できる', async () => {
    const content = makeContent()
    const updated = { ...content, verified: true }
    await store.saveUnitContent('unit-2', content)
    await store.saveUnitContent('unit-1', content)
    await store.saveUnitContent('unit-1', updated)
    expect(await store.loadUnitContent('unit-1'), '入力: unit-1上書き').toEqual(updated)
    expect(await store.listUnitContentIds(), '入力: unit-1とunit-2').toEqual(['unit-1', 'unit-2'])
    await store.deleteUnitContent('unit-1')
    await store.deleteUnitContent('missing')
    expect(await store.loadUnitContent('unit-1'), '入力: 削除後のunit-1').toBeUndefined()
    expect(await store.loadUnitContent('unit-2'), '入力: 残したunit-2').toEqual(content)
    expect(await store.listUnitContentIds(), '入力: unit-1削除後').toEqual(['unit-2'])
  })

  it('saveStudyDataを2回呼ぶと2回目に含まれない単元を削除する', async () => {
    const first = makeData()
    await store.saveStudyData(first)
    const second = makeData()
    delete second.content.units['unit-2']
    second.progress.xp = 10
    second.profile.targetLanguage = 'French'
    second.plan.units = second.plan.units.slice(0, 1)
    await store.saveStudyData(second)
    expect(await store.listUnitContentIds(), '入力: unit-1のみで全置き換え').toEqual(['unit-1'])
    expect(await store.loadUnitContent('unit-2'), '入力: 2回目にないunit-2').toBeUndefined()
    expect(await store.loadStudyData(now), '入力: 2回目の全データ').toEqual(withCurrentMeta(second))
  })

  it('全置き換えの途中で書き込みに失敗したら全ストアを元に戻す', async () => {
    const original = makeData()
    await store.saveStudyData(original)
    await store.setLastBackupAt(originalExportedAt)
    const replacement = makeData()
    replacement.profile.targetLanguage = 'French'
    replacement.progress.xp = 100
    replacement.content.units['unit-3'] = {
      ...makeContent(),
      uncloneable: () => {},
    } as UnitContent
    await expect(
      store.saveStudyData(replacement),
      '入力: 複製できない関数を含む単元',
    ).rejects.toThrow()
    expect(await store.loadStudyData(now), '入力: 途中失敗後の全データ').toEqual(
      withCurrentMeta(original),
    )
    expect(await store.getLastBackupAt(), '入力: 途中失敗後のバックアップ日時').toBe(
      originalExportedAt,
    )
  })

  it('progressのみの更新でprofile・plan・contentを変更しない', async () => {
    const data = makeData()
    await store.saveStudyData(data)
    const progress = ProgressSchema.parse({
      xp: 25,
      streak: { days: 1, lastStudyDate: '2026-11-15' },
    })
    await store.saveProgress(progress)
    expect(await store.loadStudyData(now), '入力: progressのみ更新').toEqual({
      ...withCurrentMeta(data),
      progress,
    })
  })

  it('バックアップ日時を保存・上書きできる', async () => {
    await store.setLastBackupAt(originalExportedAt)
    expect(await store.getLastBackupAt(), '入力: 最初のISO日時').toBe(originalExportedAt)
    await store.setLastBackupAt(now.toISOString())
    expect(await store.getLastBackupAt(), '入力: 更新したISO日時').toBe(now.toISOString())
  })

  it('undefinedを保存せず既存の値を維持する', async () => {
    const data = makeData()
    await store.saveStudyData(data)
    await store.setLastBackupAt(originalExportedAt)
    await store.saveProfile(undefined as unknown as Profile)
    await store.savePlan(undefined as unknown as Plan)
    await store.saveProgress(undefined as unknown as Progress)
    await store.saveUnitContent('unit-1', undefined as unknown as UnitContent)
    await store.setLastBackupAt(undefined as unknown as string)
    expect(await store.loadStudyData(now), '入力: undefinedで各値を保存').toEqual(
      withCurrentMeta(data),
    )
    expect(await store.getLastBackupAt(), '入力: undefinedで日時を保存').toBe(originalExportedAt)
  })

  it('resetAllで必須データ・全単元・バックアップ日時を削除する', async () => {
    await store.saveStudyData(makeData())
    await store.setLastBackupAt(originalExportedAt)
    await store.resetAll()
    expect(await store.loadStudyData(now), '入力: resetAll後').toBeNull()
    expect(await store.listUnitContentIds(), '入力: resetAll後').toEqual([])
    expect(await store.loadProfile(), '入力: resetAll後').toBeUndefined()
    expect(await store.loadPlan(), '入力: resetAll後').toBeUndefined()
    expect(await store.loadProgress(), '入力: resetAll後').toBeUndefined()
    expect(await store.getLastBackupAt(), '入力: resetAll後').toBeNull()
  })

  it('直接書き込まれた不正なplanを拒否し、保存キーと最初のパスを返す', async () => {
    await store.saveStudyData(makeData())
    const db = await openDB(dbName, 1)
    try {
      await db.put('singletons', { units: [{ id: 42, title: 'test', canDo: 'test' }] }, 'plan')
    } finally {
      db.close()
    }
    await expect(store.loadPlan(), '入力: units[0].idが数値').rejects.toThrow(
      "保存データ 'plan' が不正です: units[0].id",
    )
    await expect(store.loadStudyData(now), '入力: 不正なplanを含むDB').rejects.toThrow("'plan'")
  })

  it('保存前には検証せず、profile・progress・単元・日時を読み込み時に検証する', async () => {
    await store.saveProfile({ uiLanguage: 'invalid' } as unknown as Profile)
    await expect(store.loadProfile(), '入力: 不正なuiLanguage').rejects.toThrow(
      "保存データ 'profile' が不正です: uiLanguage",
    )
    await store.saveProgress({ xp: -1 } as Progress)
    await expect(store.loadProgress(), '入力: xp=-1').rejects.toThrow(
      "保存データ 'progress' が不正です: xp",
    )
    await store.saveUnitContent('broken-unit', {} as UnitContent)
    await expect(store.loadUnitContent('broken-unit'), '入力: generatedByなし').rejects.toThrow(
      "保存データ 'broken-unit' が不正です: generatedBy",
    )
    await store.setLastBackupAt('invalid')
    await expect(store.getLastBackupAt(), '入力: 不正なISO日時').rejects.toThrow("'lastBackupAt'")
  })

  it('loadStudyDataでも単元を検証する', async () => {
    await store.saveStudyData(makeData())
    await store.saveUnitContent('broken-unit', {} as UnitContent)
    await expect(store.loadStudyData(now), '入力: 不正な単元を含む全データ').rejects.toThrow(
      "保存データ 'broken-unit' が不正です: generatedBy",
    )
  })

  it('loadStudyDataは組み立て後のStudyDataSchemaでも検証する', async () => {
    await store.saveStudyData(makeData())
    await store.saveUnitContent('', makeContent())
    await expect(store.loadStudyData(now), '入力: 空の単元ID').rejects.toThrow(
      "保存データ 'studyData' が不正です: content.units",
    )
  })

  it('読み込みではsafeParseで補完された値を返す', async () => {
    await store.loadProfile()
    const profile = makeData().profile
    const { targetLevel, deadline, dailyMinutes } = profile.goal
    const goal = { targetLevel, deadline, dailyMinutes }
    const rawProfile = { ...profile, goal }
    const db = await openDB(dbName, 1)
    try {
      await db.put('singletons', rawProfile, 'profile')
    } finally {
      db.close()
    }
    expect(await store.loadProfile(), '入力: デフォルト値を省略したprofile').toEqual(
      ProfileSchema.parse(rawProfile),
    )
  })
})

describe('getAppStore', () => {
  it('同じインスタンスを返し、IndexedDBがなければ呼び出し時に説明的なErrorを投げる', () => {
    vi.stubGlobal('indexedDB', undefined)
    expect(() => getAppStore(), '入力: IndexedDBなし、初回呼び出し').toThrow(/IndexedDB/)
    vi.unstubAllGlobals()
    const singleton = getAppStore()
    stores.push(singleton)
    expect(getAppStore(), '入力: 既定ストアを2回取得').toBe(singleton)
    vi.stubGlobal('indexedDB', undefined)
    expect(() => getAppStore(), '入力: シングルトン作成後にIndexedDBなし').toThrow(/IndexedDB/)
  })
})

describe('requestPersistentStorage', () => {
  it.each([
    [true, 'granted'],
    [false, 'denied'],
  ] as const)('persistが%sなら%sを返す', async (persisted, expected) => {
    const storage = {
      persist: vi.fn(function (this: unknown) {
        expect(this, '入力: persistのレシーバー').toBe(storage)
        return Promise.resolve(persisted)
      }),
    }
    vi.stubGlobal('navigator', { storage })
    expect(await requestPersistentStorage(), `入力: persist=${persisted}`).toBe(expected)
    expect(storage.persist, '入力: 対応したpersist API').toHaveBeenCalledOnce()
  })

  it.each([undefined, {}, { storage: {} }, { storage: { persist: undefined } }])(
    'persistを利用できなければunsupportedを返す: %j',
    async (navigatorValue) => {
      vi.stubGlobal('navigator', navigatorValue)
      expect(await requestPersistentStorage(), '入力: persist APIなし').toBe('unsupported')
    },
  )

  it.each([false, true])('persistの例外をdeniedとして扱う: 同期例外=%s', async (synchronous) => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: vi.fn(() => {
          if (synchronous) throw new Error('storage unavailable')
          return Promise.reject(new Error('storage unavailable'))
        }),
      },
    })
    expect(await requestPersistentStorage(), '入力: persistの例外').toBe('denied')
  })
})
