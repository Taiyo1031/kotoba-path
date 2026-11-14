import { ja } from './ja'
import { en } from './en'
import type { UiLanguage } from '../config/languages'

export type MessageKey = keyof typeof ja
export type TranslateParams = Record<string, string | number>
export type Translator = (key: MessageKey, params?: TranslateParams) => string

export function createTranslator(language: UiLanguage): Translator {
  const dict = language === 'en' ? en : ja
  return (key, params) => {
    const translated = Object.hasOwn(dict, key) ? dict[key] : undefined
    const fallback = Object.hasOwn(ja, key) ? ja[key] : undefined
    const template = translated ?? fallback ?? key
    return interpolate(template, params)
  }
}

export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template

  return template.replace(/\{([^{}]+)\}/g, (placeholder: string, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  )
}
