import { openDB } from 'idb'
import { GuideSchema } from '../schema/guide'
import type { Guide } from '../schema/guide'
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb'
import type { z } from 'zod'
import { APP_CONFIG } from '../config/app'
import type { StudyData, Profile, Plan, Progress, UnitContent } from '../schema'
import {
  IsoDateTimeSchema,
  ProfileSchema,
  PlanSchema,
  ProgressSchema,
  UnitContentSchema,
  StudyDataSchema,
} from '../schema'

interface AppDB extends DBSchema {
  singletons: { key: string; value: unknown }
  unitContent: { key: string; value: UnitContent }
}

export interface AppStore {
  /** 必須データがなければ null。meta は読み込み時に組み立てる。 */
  loadStudyData(now?: Date): Promise<StudyData | null>
  /** 1つのトランザクションで全置き換えする。 */
  saveStudyData(data: StudyData): Promise<void>
  loadGuide(): Promise<Guide | undefined>
  saveGuide(guide: Guide): Promise<void>
  loadProfile(): Promise<Profile | undefined>
  saveProfile(profile: Profile): Promise<void>
  loadPlan(): Promise<Plan | undefined>
  savePlan(plan: Plan): Promise<void>
  loadProgress(): Promise<Progress | undefined>
  saveProgress(progress: Progress): Promise<void>
  loadUnitContent(unitId: string): Promise<UnitContent | undefined>
  saveUnitContent(unitId: string, content: UnitContent): Promise<void>
  deleteUnitContent(unitId: string): Promise<void>
  listUnitContentIds(): Promise<string[]>
  getLastBackupAt(): Promise<string | null>
  setLastBackupAt(iso: string): Promise<void>
  /** 全データを削除する。 */
  resetAll(): Promise<void>
  close(): void
}

function parseSaved<T>(key: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const path = (result.error.issues[0]?.path ?? []).reduce<string>(
      (path, part) =>
        typeof part === 'number' ? `${path}[${part}]` : `${path}${path ? '.' : ''}${String(part)}`,
      '',
    )
    throw new Error(`保存データ '${key}' が不正です: ${path || '(root)'}`)
  }
  return result.data
}

async function writeAll(
  db: IDBPDatabase<AppDB>,
  write: (tx: IDBPTransaction<AppDB, ['singletons', 'unitContent'], 'readwrite'>) => Promise<void>,
): Promise<void> {
  const tx = db.transaction(['singletons', 'unitContent'], 'readwrite')
  // リクエスト失敗と同時に発生するトランザクションの拒否も処理する。
  const completion = tx.done.catch(() => {})
  try {
    await write(tx)
    await tx.done
  } catch (error) {
    try {
      tx.abort()
    } catch {
      // すでに中止・完了している場合は元のエラーを返す。
    }
    await completion
    throw error
  }
}

class AppStoreImpl implements AppStore {
  private readonly dbName: string
  private connection: Promise<IDBPDatabase<AppDB>> | undefined
  private closed = false

  constructor(dbName: string) {
    this.dbName = dbName
  }

  private db(): Promise<IDBPDatabase<AppDB>> {
    if (this.closed) return Promise.reject(new Error('IndexedDB store は閉じられています。'))
    this.connection ??= openDB<AppDB>(this.dbName, 1, {
      upgrade(db) {
        db.createObjectStore('singletons')
        db.createObjectStore('unitContent')
      },
    })
    return this.connection
  }

  private async loadSingleton<T>(key: string, schema: z.ZodType<T>): Promise<T | undefined> {
    const value = await (await this.db()).get('singletons', key)
    return value === undefined ? undefined : parseSaved(key, schema, value)
  }

  private async saveSingleton(key: string, value: unknown): Promise<void> {
    if (value === undefined) return
    await (await this.db()).put('singletons', value, key)
  }

  async loadStudyData(now: Date = new Date()): Promise<StudyData | null> {
    const db = await this.db()
    const tx = db.transaction(['singletons', 'unitContent'], 'readonly')
    const singletons = tx.objectStore('singletons')
    const contents = tx.objectStore('unitContent')
    const [profile, plan, progress, ids, values, guide] = await Promise.all([
      singletons.get('profile'),
      singletons.get('plan'),
      singletons.get('progress'),
      contents.getAllKeys(),
      contents.getAll(),
      singletons.get('guide'),
      tx.done,
    ])
    if (profile === undefined || plan === undefined || progress === undefined) {
      return null
    }
    const parsedProfile = parseSaved('profile', ProfileSchema, profile)
    const parsedPlan = parseSaved('plan', PlanSchema, plan)
    const parsedProgress = parseSaved('progress', ProgressSchema, progress)
    const units = Object.fromEntries(
      ids.map((id, index) => [id, parseSaved(id, UnitContentSchema, values[index])]),
    )
    return parseSaved('studyData', StudyDataSchema, {
      format: APP_CONFIG.dataFormat,
      version: APP_CONFIG.dataVersion,
      meta: { exportedAt: now.toISOString(), appVersion: APP_CONFIG.appVersion },
      profile: parsedProfile,
      plan: parsedPlan,
      content: {
        units,
        ...(guide !== undefined ? { guide: parseSaved('guide', GuideSchema, guide) } : {}),
      },
      progress: parsedProgress,
    })
  }

  async saveStudyData(data: StudyData): Promise<void> {
    await writeAll(await this.db(), async (tx) => {
      const singletons = tx.objectStore('singletons')
      const contents = tx.objectStore('unitContent')
      // 最終バックアップ日は学習データではないので、全置き換えでも消さない
      const lastBackupAt = await singletons.get('lastBackupAt')
      await singletons.clear()
      await contents.clear()
      for (const key of ['profile', 'plan', 'progress'] as const) {
        if (data[key] !== undefined) await singletons.put(data[key], key)
      }
      if (data.content.guide !== undefined) await singletons.put(data.content.guide, 'guide')
      if (lastBackupAt !== undefined) await singletons.put(lastBackupAt, 'lastBackupAt')
      for (const [id, content] of Object.entries(data.content.units)) {
        if (content !== undefined) await contents.put(content, id)
      }
    })
  }

  loadGuide(): Promise<Guide | undefined> {
    return this.loadSingleton('guide', GuideSchema)
  }

  saveGuide(guide: Guide): Promise<void> {
    return this.saveSingleton('guide', guide)
  }

  loadProfile(): Promise<Profile | undefined> {
    return this.loadSingleton('profile', ProfileSchema)
  }

  saveProfile(profile: Profile): Promise<void> {
    return this.saveSingleton('profile', profile)
  }

  loadPlan(): Promise<Plan | undefined> {
    return this.loadSingleton('plan', PlanSchema)
  }

  savePlan(plan: Plan): Promise<void> {
    return this.saveSingleton('plan', plan)
  }

  loadProgress(): Promise<Progress | undefined> {
    return this.loadSingleton('progress', ProgressSchema)
  }

  saveProgress(progress: Progress): Promise<void> {
    return this.saveSingleton('progress', progress)
  }

  async loadUnitContent(unitId: string): Promise<UnitContent | undefined> {
    const value = await (await this.db()).get('unitContent', unitId)
    return value === undefined ? undefined : parseSaved(unitId, UnitContentSchema, value)
  }

  async saveUnitContent(unitId: string, content: UnitContent): Promise<void> {
    if (content === undefined) return
    await (await this.db()).put('unitContent', content, unitId)
  }

  async deleteUnitContent(unitId: string): Promise<void> {
    await (await this.db()).delete('unitContent', unitId)
  }

  async listUnitContentIds(): Promise<string[]> {
    return (await this.db()).getAllKeys('unitContent')
  }

  async getLastBackupAt(): Promise<string | null> {
    return (await this.loadSingleton('lastBackupAt', IsoDateTimeSchema)) ?? null
  }

  setLastBackupAt(iso: string): Promise<void> {
    return this.saveSingleton('lastBackupAt', iso)
  }

  async resetAll(): Promise<void> {
    await writeAll(await this.db(), async (tx) => {
      await tx.objectStore('singletons').clear()
      await tx.objectStore('unitContent').clear()
    })
  }

  close(): void {
    this.closed = true
    void this.connection?.then(
      (db) => db.close(),
      () => {},
    )
  }
}

export function createAppStore(dbName: string = APP_CONFIG.dbName): AppStore {
  if (typeof indexedDB === 'undefined') {
    throw new Error('この環境では IndexedDB を利用できません。')
  }
  return new AppStoreImpl(dbName)
}

let appStore: AppStore | undefined

export function getAppStore(): AppStore {
  if (typeof indexedDB === 'undefined') {
    throw new Error('この環境では IndexedDB を利用できません。')
  }
  return (appStore ??= createAppStore())
}
