import { describe, it, expect } from 'vitest'
import { APP_CONFIG } from '../config/app'
import { buildGuidePrompt } from './index'
import type { GuidePromptInput, PromptProfile } from './index'

const profile: PromptProfile = {
  targetLanguage: 'ms',
  targetLanguageName: 'マレー語',
  nativeLanguage: 'ja',
  nativeLanguageName: '日本語',
  purposeTags: ['旅行'],
  purposeText: '屋台で注文したい',
  targetLevel: 'A2',
  levelLabel: '旅行で困らない',
  deadline: '2027-01-15',
  dailyMinutes: 20,
  studyDaysPerWeek: 6,
}

const input: GuidePromptInput = { profile }

function expectIncludes(prompt: string, values: string[]): void {
  for (const value of values) {
    expect(prompt, `入力プロンプト: ${prompt}\n期待する文言: ${value}`).toContain(value)
  }
}

describe('文字と発音のガイドプロンプト', () => {
  it('必須見出し、スキーマ形式、版を含む', () => {
    const prompt = buildGuidePrompt(input)
    expect(
      prompt.startsWith('# 文字と発音のガイドを作成'),
      `入力: ${JSON.stringify(input)}\n実際(先頭): ${prompt.slice(0, 50)}`,
    ).toBe(true)
    expectIncludes(prompt, [
      '【役割】',
      '【スキーマ】',
      '【IDの規則】',
      '【読み(reading)】',
      '【件数と選び方】',
      '【自己チェック】',
      APP_CONFIG.guideFormat,
    ])
    const versionLine = `プロンプトの版: ${APP_CONFIG.promptVersion}`
    expect(
      prompt.slice(-versionLine.length),
      `入力: ${JSON.stringify(input)}\n実際(末尾): ${prompt}`,
    ).toBe(versionLine)
  })

  it('母語が日本語のときはカナの読み方を案内する', () => {
    const prompt = buildGuidePrompt(input)
    expectIncludes(prompt, ['【読み(reading)】', 'ング'])
  })

  it('母語が英語のときは母語の読者が読める表記を案内し、カナ例を出さない', () => {
    const enProfile: PromptProfile = {
      ...profile,
      nativeLanguage: 'en',
      nativeLanguageName: 'English',
    }
    const prompt = buildGuidePrompt({ profile: enProfile })
    expect(prompt, `入力: ${JSON.stringify(enProfile)}`).not.toContain('ング')
    expectIncludes(prompt, ['母語の読者が読める近似表記'])
  })

  it('unitHintsが2件のとき単元セクションを含む', () => {
    const hints = [
      { title: '挨拶と自己紹介', keywords: ['こんにちは', '名前'] },
      { title: '数字と価格', keywords: ['一', '円'] },
    ]
    const prompt = buildGuidePrompt({ profile, unitHints: hints })
    expectIncludes(prompt, [
      '【このコースの単元】',
      ...hints.flatMap((h) => [h.title, ...h.keywords]),
    ])
  })

  it('unitHintsが空または無いとき単元セクションを含まない', () => {
    const emptyInput: GuidePromptInput = { profile, unitHints: [] }
    expect(buildGuidePrompt(emptyInput), `入力: ${JSON.stringify(emptyInput)}`).not.toContain(
      '【このコースの単元】',
    )
    expect(buildGuidePrompt(input), `入力: ${JSON.stringify(input)}`).not.toContain(
      '【このコースの単元】',
    )
  })

  it('プロフィールの対象言語名・母語名を含む', () => {
    const prompt = buildGuidePrompt(input)
    expectIncludes(prompt, [profile.targetLanguageName, profile.nativeLanguageName])
  })

  it('JSON例を解析でき、formatが一致する', () => {
    const prompt = buildGuidePrompt(input)
    const blocks = [...prompt.matchAll(/```json\n([\s\S]*?)\n```/g)]
    expect(blocks.length, `入力: ${JSON.stringify(input)}\n実際: ${prompt}`).toBe(1)
    for (const block of blocks) {
      const parsed: unknown = JSON.parse(block[1] ?? '')
      expect(parsed, `入力: ${block[1]}`).toMatchObject({ format: APP_CONFIG.guideFormat })
    }
  })

  it('同じ入力から同じ出力を返す(純粋関数)', () => {
    const a = buildGuidePrompt(input)
    const b = buildGuidePrompt(input)
    expect(a, '入力: 同じプロフィール').toBe(b)
  })
})
