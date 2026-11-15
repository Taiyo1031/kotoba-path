import { getTargetLanguage } from '../config/languages'

export function isTtsSupported(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  // speechSynthesis が存在し、SpeechSynthesisUtterance コンストラクタが使えること
  const ctor = (globalThis as Record<string, unknown>).SpeechSynthesisUtterance
  return 'speechSynthesis' in window && typeof ctor === 'function'
}

export function findVoice(
  language: string,
  voices: ReadonlyArray<SpeechSynthesisVoice>,
): SpeechSynthesisVoice | null {
  const target = getTargetLanguage(language)
  const locales = (target?.ttsLocales ?? []).map((locale) => locale.toLowerCase())
  const lowerLanguage = language.toLowerCase()
  if (lowerLanguage === '') {
    return null
  }
  // ttsLocales と(大文字小文字を無視して)一致する声を優先
  const exact = voices.find((voice) => locales.includes(voice.lang.toLowerCase()))
  if (exact !== undefined) {
    return exact
  }
  // なければ language で始まる声(ms または ms-…)
  const prefix = voices.find((voice) => voice.lang.toLowerCase().startsWith(lowerLanguage))
  return prefix ?? null
}

export function hasVoiceFor(language: string): boolean {
  if (!isTtsSupported()) {
    return false
  }
  const voices = window.speechSynthesis.getVoices()
  return findVoice(language, voices) !== null
}

export function speak(text: string, language: string): boolean {
  if (text === '' || !isTtsSupported()) {
    return false
  }
  const synthesis = window.speechSynthesis
  const voice = findVoice(language, synthesis.getVoices())
  if (voice === null) {
    return false
  }
  try {
    // 進行中の読み上げは cancel してから始める
    synthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voice.lang
    utterance.voice = voice
    synthesis.speak(utterance)
    return true
  } catch {
    // 例外にしない
    return false
  }
}
