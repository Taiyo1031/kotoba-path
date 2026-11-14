import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { UiLanguage } from '../config/languages'
import { DEFAULT_UI_LANGUAGE } from '../config/languages'
import { createTranslator } from './translate'
import type { Translator } from './translate'

interface I18nContextType {
  language: UiLanguage
  setLanguage: (lang: UiLanguage) => void
  t: Translator
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)
const STORAGE_KEY = 'kp.uiLanguage'

function isUiLanguage(value: unknown): value is UiLanguage {
  return value === 'ja' || value === 'en'
}

export function I18nProvider(props: {
  children: ReactNode
  initialLanguage?: UiLanguage
}): ReactElement {
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (isUiLanguage(props.initialLanguage)) return props.initialLanguage

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isUiLanguage(saved)) {
        return saved
      }
    } catch {
      // 保存領域が使えない場合は既定の言語を使う。
    }

    return DEFAULT_UI_LANGUAGE
  })

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguageHandler = useCallback((lang: UiLanguage) => {
    if (!isUiLanguage(lang)) return

    setLanguage(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // 保存できなくても画面の言語は切り替える。
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [])

  const t = useMemo(() => createTranslator(language), [language])
  const value = useMemo(
    () => ({ language, setLanguage: setLanguageHandler, t }),
    [language, setLanguageHandler, t],
  )

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- 仕様に従いフックを同じファイルで公開する。
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

// eslint-disable-next-line react-refresh/only-export-components -- 仕様に従いフックを同じファイルで公開する。
export function useT(): Translator {
  return useI18n().t
}
