import { APP_CONFIG } from '../config/app'
import type { AppStore } from '../db'

export interface BackupStatus {
  daysSince: number | null
  needsBackup: boolean
}

export function getBackupStatus(
  lastBackupAt: string | null,
  now: Date,
  warnDays: number = APP_CONFIG.backupWarnDays,
): BackupStatus {
  if (lastBackupAt === null) return { daysSince: null, needsBackup: true }
  const daysSince = Math.floor((now.getTime() - Date.parse(lastBackupAt)) / 86_400_000)
  return { daysSince, needsBackup: daysSince >= warnDays }
}

export async function recordBackup(store: AppStore, now: Date): Promise<void> {
  await store.setLastBackupAt(now.toISOString())
}
