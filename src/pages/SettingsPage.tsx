import { Link } from 'react-router-dom'
import { UI_LANGUAGES, useI18n } from '../i18n'
import { ROUTES } from '../routes'

export function SettingsPage() {
  const { t, language, setLanguage } = useI18n()

  return (
    <div className="page">
      <h1 className="page-title">{t('page.settings')}</h1>
      <p className="page-description">画面の表示言語や学習の設定を変更します。</p>

      <div className="language-switcher">
        <label htmlFor="language-select">{t('settings.uiLanguage')}</label>
        <select
          id="language-select"
          value={language}
          onChange={(event) => {
            const selectedLanguage = UI_LANGUAGES.find(
              (item) => item.code === event.currentTarget.value,
            )
            if (selectedLanguage) setLanguage(selectedLanguage.code)
          }}
        >
          {UI_LANGUAGES.map(({ code, label }) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <Link className="debug-link" to={ROUTES.debug}>
        debug
      </Link>
    </div>
  )
}
