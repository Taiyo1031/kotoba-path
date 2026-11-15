import { describe, it, expect, afterEach, vi } from 'vitest'
import { isTtsSupported, findVoice, hasVoiceFor, speak } from './tts'

function makeVoice(lang: string): SpeechSynthesisVoice {
  return {
    voiceURI: `voice-${lang}`,
    lang,
    name: `voice-${lang}`,
    localService: true,
    default: false,
  }
}

function stubTts(voices: ReadonlyArray<SpeechSynthesisVoice>) {
  const cancel = vi.fn()
  const speakFn = vi.fn()
  const speechSynthesis = {
    getVoices: () => voices,
    cancel,
    speak: speakFn,
  }
  vi.stubGlobal('speechSynthesis', speechSynthesis)
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = ''
      voice: SpeechSynthesisVoice | null = null
    },
  )
  return { cancel, speakFn }
}

describe('tts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('isTtsSupported', () => {
    it('speechSynthesis と SpeechSynthesisUtterance が無いと false', () => {
      vi.stubGlobal('speechSynthesis', undefined)
      vi.stubGlobal('SpeechSynthesisUtterance', undefined)
      const actual = isTtsSupported()
      expect(actual, `入力: 未対応, 期待: false`).toBe(false)
    })

    it('両方あると true', () => {
      stubTts([])
      const actual = isTtsSupported()
      expect(actual, `入力: 対応, 期待: true`).toBe(true)
    })
  })

  describe('findVoice', () => {
    it('ms-MY の声を返す', () => {
      const voices = [makeVoice('ms-MY')]
      const actual = findVoice('ms', voices)
      expect(actual?.lang, `入力: ms, 期待: ms-MY`).toBe('ms-MY')
    })

    it('ms の声を返す', () => {
      const voices = [makeVoice('ms')]
      const actual = findVoice('ms', voices)
      expect(actual?.lang, `入力: ms, 期待: ms`).toBe('ms')
    })

    it('言語が合わない声は null', () => {
      const voices = [makeVoice('en-US')]
      const actual = findVoice('ms', voices)
      expect(actual, `入力: ms, 期待: null`).toBeNull()
    })

    it('大文字小文字の違いを無視する', () => {
      const voices = [makeVoice('MS-MY')]
      const actual = findVoice('ms', voices)
      expect(actual?.lang, `入力: ms, 期待: MS-MY`).toBe('MS-MY')
    })

    it('ttsLocales に無ければ language で始まる声を返す', () => {
      const voices = [makeVoice('ms-BN')]
      const actual = findVoice('ms', voices)
      expect(actual?.lang, `入力: ms, 期待: ms-BN`).toBe('ms-BN')
    })
  })

  describe('hasVoiceFor', () => {
    it('未対応で false', () => {
      vi.stubGlobal('speechSynthesis', undefined)
      vi.stubGlobal('SpeechSynthesisUtterance', undefined)
      const actual = hasVoiceFor('ms')
      expect(actual, `入力: ms, 期待: false`).toBe(false)
    })

    it('声があるとき true', () => {
      stubTts([makeVoice('ms-MY')])
      const actual = hasVoiceFor('ms')
      expect(actual, `入力: ms, 期待: true`).toBe(true)
    })

    it('声が無いとき false', () => {
      stubTts([makeVoice('en-US')])
      const actual = hasVoiceFor('ms')
      expect(actual, `入力: ms, 期待: false`).toBe(false)
    })
  })

  describe('speak', () => {
    it('未対応で false', () => {
      vi.stubGlobal('speechSynthesis', undefined)
      vi.stubGlobal('SpeechSynthesisUtterance', undefined)
      const actual = speak('hello', 'ms')
      expect(actual, `入力: hello, 期待: false`).toBe(false)
    })

    it('声があるとき true で speak を呼ぶ', () => {
      const { speakFn } = stubTts([makeVoice('ms-MY')])
      const actual = speak('hello', 'ms')
      expect(actual, `入力: hello, 期待: true`).toBe(true)
      expect(speakFn, `入力: hello, 期待: 1回`).toHaveBeenCalledTimes(1)
    })

    it('声が無いとき false', () => {
      const { speakFn } = stubTts([makeVoice('en-US')])
      const actual = speak('hello', 'ms')
      expect(actual, `入力: hello, 期待: false`).toBe(false)
      expect(speakFn, `入力: hello, 期待: 0回`).toHaveBeenCalledTimes(0)
    })

    it('text が空で false', () => {
      const { speakFn } = stubTts([makeVoice('ms-MY')])
      const actual = speak('', 'ms')
      expect(actual, `入力: "", 期待: false`).toBe(false)
      expect(speakFn, `入力: "", 期待: 0回`).toHaveBeenCalledTimes(0)
    })

    it('進行中の読み上げは cancel してから始める', () => {
      const { cancel, speakFn } = stubTts([makeVoice('ms-MY')])
      speak('first', 'ms')
      expect(cancel, `入力: first, 期待: 1回`).toHaveBeenCalledTimes(1)
      speak('second', 'ms')
      expect(cancel, `入力: second, 期待: 累計2回`).toHaveBeenCalledTimes(2)
      expect(speakFn, `入力: second, 期待: 2回`).toHaveBeenCalledTimes(2)
    })
  })
})
