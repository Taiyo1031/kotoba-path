import { useT } from '../../i18n'
import { getBackupStatus } from '../../io/backup'
import { useAppState } from '../../state/appState'

export function BackupStatus() {
  const t = useT()
  const lastBackupAt = useAppState((state) => state.lastBackupAt)
  return (
    <section aria-labelledby="backup-title">
      <h2 id="backup-title">{t('data.backup.title')}</h2>
      <div className="data-card">
        <p>
          {t('data.backup.last', {
            date: lastBackupAt ? new Date(lastBackupAt).toLocaleString() : t('data.empty'),
          })}
        </p>
        {getBackupStatus(lastBackupAt, new Date()).needsBackup && (
          <p className="data-warning">{t('data.backup.warning')}</p>
        )}
        <p>{t('data.backup.storageWarning')}</p>
      </div>
    </section>
  )
}
