import { describe, it, expect } from 'vitest'
import { ja } from './ja'
import { en } from './en'
import { createTranslator, interpolate } from './translate'
import type { MessageKey, TranslateParams } from './translate'
import { TARGET_LANGUAGES, getTargetLanguage } from '../config/languages'

function placeholders(template: string): string[] {
  return [...new Set(template.match(/\{[^{}]+\}/g) ?? [])].sort()
}

describe('dictionary consistency', () => {
  it('has exactly the Japanese keys in English', () => {
    expect(Object.keys(en).sort(), '入力: 英語辞書のキー').toEqual(Object.keys(ja).sort())
  })

  for (const key of Object.keys(ja) as MessageKey[]) {
    it(`has a nonempty English translation for ${key}`, () => {
      expect(en[key]?.trim(), `入力: en[${key}]`).toEqual(expect.any(String))
      expect(en[key]?.trim(), `入力: en[${key}]`).not.toBe('')
    })

    it(`has matching placeholder sets for ${key}`, () => {
      expect(placeholders(en[key]), `入力: ${key} の英語プレースホルダ`).toEqual(
        placeholders(ja[key]),
      )
    })
  }
})

describe('interpolate', () => {
  const cases: Array<{ template: string; params?: TranslateParams; expected: string }> = [
    { template: 'Hello {name}', params: { name: 'World' }, expected: 'Hello World' },
    {
      template: '{greeting} {name}!',
      params: { greeting: 'Hi', name: 'John' },
      expected: 'Hi John!',
    },
    {
      template: '{name} loves {food} and {food}',
      params: { name: 'Alice', food: 'pizza' },
      expected: 'Alice loves pizza and pizza',
    },
    {
      template: 'Hello {name}, welcome to {place}',
      params: { name: 'John' },
      expected: 'Hello John, welcome to {place}',
    },
    { template: '{count} items', params: { count: 5 }, expected: '5 items' },
    { template: '{count} items', params: { count: 0 }, expected: '0 items' },
    { template: 'Hello {name}', expected: 'Hello {name}' },
    { template: 'Hello {name}', params: {}, expected: 'Hello {name}' },
    { template: 'Hello{name}', params: { name: '' }, expected: 'Hello' },
    { template: '{value}', params: { value: '$&' }, expected: '$&' },
    {
      template: '{first} {second}',
      params: { first: '{second}', second: 'done' },
      expected: '{second} done',
    },
    { template: '{toString}', params: {}, expected: '{toString}' },
  ]

  it.each(cases)('interpolates $template with $params', ({ template, params, expected }) => {
    expect(interpolate(template, params), `入力: ${JSON.stringify({ template, params })}`).toBe(
      expected,
    )
  })
})

describe('createTranslator', () => {
  it('translates in English', () => {
    expect(createTranslator('en')('nav.home'), '入力: en, nav.home').toBe('Home')
  })

  it('translates in Japanese with numeric parameters', () => {
    expect(
      createTranslator('ja')('home.streak', { days: 3 }),
      '入力: ja, home.streak, days=3',
    ).toBe('3日連続')
  })

  it('preserves missing translation parameters', () => {
    expect(createTranslator('en')('home.streak'), '入力: en, home.streak').toBe(
      '{days} days in a row',
    )
  })

  it('falls back to Japanese when an English key is missing at runtime', () => {
    const original = en['nav.home']
    try {
      delete (en as Partial<Record<MessageKey, string>>)['nav.home']
      expect(createTranslator('en')('nav.home'), '入力: en, nav.home が欠落').toBe(ja['nav.home'])
    } finally {
      en['nav.home'] = original
    }
  })

  it.each(['ja', 'en'] as const)('returns an unknown key in %s', (language) => {
    for (const key of ['unknown.key', 'toString', 'constructor', '__proto__']) {
      expect(createTranslator(language)(key as MessageKey), `入力: ${language}, ${key}`).toBe(key)
    }
  })
})

describe('TARGET_LANGUAGES and getTargetLanguage', () => {
  it('includes Malay in the target languages', () => {
    expect(
      TARGET_LANGUAGES.map(({ code }) => code),
      '入力: 対象言語のコード一覧',
    ).toContain('ms')
    expect(getTargetLanguage('ms')?.names.ja, '入力: ms').toBe('マレー語')
  })

  it('returns undefined for an unknown code', () => {
    expect(getTargetLanguage('unknown'), '入力: unknown').toBeUndefined()
  })
})
