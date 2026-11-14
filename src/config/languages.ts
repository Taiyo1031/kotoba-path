export type UiLanguage = 'ja' | 'en'

export const UI_LANGUAGES: ReadonlyArray<{ code: UiLanguage; label: string }> = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
]

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'ja'

export interface TargetLanguageInfo {
  code: string
  names: Record<UiLanguage, string>
  ttsLocales: string[]
}

export const TARGET_LANGUAGES: ReadonlyArray<TargetLanguageInfo> = [
  {
    code: 'ms',
    names: {
      ja: 'マレー語',
      en: 'Malay',
    },
    ttsLocales: ['ms-MY', 'ms'],
  },
]

export function getTargetLanguage(code: string): TargetLanguageInfo | undefined {
  return TARGET_LANGUAGES.find((lang) => lang.code === code)
}

export interface NativeLanguageInfo {
  code: string
  names: Record<UiLanguage, string>
}

export const NATIVE_LANGUAGES: ReadonlyArray<NativeLanguageInfo> = [
  {
    code: 'ja',
    names: {
      ja: '日本語',
      en: 'Japanese',
    },
  },
]

export function getNativeLanguage(code: string): NativeLanguageInfo | undefined {
  return NATIVE_LANGUAGES.find((lang) => lang.code === code)
}
