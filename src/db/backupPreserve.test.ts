import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { StudyDataSchema } from '../schema'
import { createAppStore } from './store'

// 全置き換え(復元)で、最終バックアップ日が消えないことを確かめる。
describe('saveStudyData と最終バックアップ日', () => {
  it('全置き換えしても lastBackupAt を保つ', async () => {
    const data = StudyDataSchema.parse(JSON.parse(readFileSync('fixtures/dummy-full.json', 'utf8')))
    const store = createAppStore('test-backup-preserve')
    try {
      await store.saveStudyData(data)
      await store.setLastBackupAt('2026-11-14T00:00:00.000Z')
      await store.saveStudyData(data)
      expect(await store.getLastBackupAt(), '入力: saveStudyData を2回(間に setLastBackupAt)').toBe(
        '2026-11-14T00:00:00.000Z',
      )
    } finally {
      store.close()
    }
  })

  it('resetAll では最終バックアップ日も消える(完全なリセット)', async () => {
    const store = createAppStore('test-backup-reset')
    try {
      await store.setLastBackupAt('2026-11-14T00:00:00.000Z')
      await store.resetAll()
      expect(await store.getLastBackupAt(), '入力: setLastBackupAt → resetAll').toBeNull()
    } finally {
      store.close()
    }
  })
})
