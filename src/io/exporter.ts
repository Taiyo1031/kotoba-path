import { APP_CONFIG } from '../config/app'
import type { StudyData } from '../schema'

export function exportStudyDataJson(data: StudyData): string {
  return JSON.stringify(data, null, 2) + '\n'
}

export function exportFileName(kind: 'json' | 'csv', now: Date): string {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return `${APP_CONFIG.fileSlug}${kind === 'csv' ? '-words' : ''}-${date}.${kind}`
}
