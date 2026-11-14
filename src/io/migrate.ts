import { APP_CONFIG } from '../config/app'

export class MigrationError extends Error {}

export const migrations: Record<number, (data: unknown) => unknown> = {}

function versionOf(raw: unknown): number {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('format' in raw) ||
    raw.format !== APP_CONFIG.dataFormat
  ) {
    throw new MigrationError('データ形式が異なります')
  }
  if (!('version' in raw) || typeof raw.version !== 'number' || !Number.isInteger(raw.version)) {
    throw new MigrationError('版は整数で指定してください')
  }
  if (raw.version > APP_CONFIG.dataVersion) {
    throw new MigrationError('このファイルは新しい版のアプリで作られています')
  }
  return raw.version
}

export function migrateStudyData(raw: unknown): unknown {
  let data = raw
  let version = versionOf(data)
  while (version < APP_CONFIG.dataVersion) {
    const migrate = migrations[version]
    if (!migrate) throw new MigrationError(`版 ${version} の変換に対応していません`)
    data = migrate(data)
    const nextVersion = versionOf(data)
    if (nextVersion !== version + 1) throw new MigrationError('版の変換に失敗しました')
    version = nextVersion
  }
  return data
}
