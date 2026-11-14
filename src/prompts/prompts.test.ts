import { describe, it, expect } from 'vitest'
import { APP_CONFIG } from '../config/app'
import { buildSkeletonPrompt, buildUnitPrompt, countStudyDays, estimateUnitCount } from './index'
import type { PromptProfile, UnitPromptInput } from './index'

const profile: PromptProfile = {
  targetLanguage: 'ms',
  targetLanguageName: 'マレー語',
  nativeLanguage: 'ja',
  nativeLanguageName: '日本語',
  purposeTags: ['旅行', '食事'],
  purposeText: '屋台で注文したい',
  targetLevel: 'A2',
  levelLabel: '旅行で困らない',
  deadline: '2027-01-15',
  dailyMinutes: 20,
  studyDaysPerWeek: 6,
}
const skeletonInput = { profile, today: '2026-11-15' }
const unitInput: UnitPromptInput = {
  profile,
  unit: {
    id: 'u03',
    title: '屋台で注文',
    canDo: '料理を注文できる',
    scenario: '屋台',
    keywords: ['注文', '食べ物', '飲み物'],
    itemEstimate: 30,
  },
}
const headings = [
  '【役割】',
  '【出力形式】',
  '【スキーマ】',
  '【IDの規則】',
  '【確信がない語】',
  '【言語の範囲】',
  '【母語】',
  '【自己チェック】',
]

function expectIncludes(prompt: string, values: string[]): void {
  for (const value of values) {
    expect(prompt, `入力プロンプト: ${prompt}\n期待する文言: ${value}`).toContain(value)
  }
}

describe('学習量の見積もり', () => {
  it.each([
    ['2026-11-15', '2026-11-14', 6, 0],
    ['2026-11-15', '2026-11-15', 6, 0],
    ['2026-11-15', '2026-11-22', 6, 6],
    ['2026-11-15', '2026-11-16', 6, 0],
    ['2024-02-28', '2024-03-01', 7, 2],
    ['2026-03-07', '2026-03-10', 7, 3],
    ['2026-12-31', '2027-01-01', 7, 1],
  ])('%s〜%s、週%s日の学習日数は%s', (today, deadline, frequency, expected) => {
    expect(
      countStudyDays(today, deadline, frequency),
      `入力: ${JSON.stringify({ today, deadline, frequency })}`,
    ).toBe(expected)
  })

  it.each([
    [{ today: '2026-11-15', deadline: '2026-11-14', studyDaysPerWeek: 6 }, 3],
    [{ today: '2026-11-15', deadline: '2026-11-22', studyDaysPerWeek: 6 }, 3],
    [{ today: '2026-01-01', deadline: '2027-01-01', studyDaysPerWeek: 7 }, 80],
    [{ today: '2026-11-15', deadline: '2026-11-29', studyDaysPerWeek: 6, itemsPerUnit: 15 }, 8],
    [{ today: '2026-11-15', deadline: '2026-11-22', studyDaysPerWeek: 6, newItemsPerDay: 15 }, 5],
  ])('入力%jの単元数は%s', (input, expected) => {
    expect(estimateUnitCount(input), `入力: ${JSON.stringify(input)}`).toBe(expected)
  })
})

describe('骨組みプロンプト', () => {
  it('必須見出し、プロフィール、見積もり、単元の規則を含む', () => {
    const prompt = buildSkeletonPrompt(skeletonInput)
    expectIncludes(prompt, [
      ...headings,
      APP_CONFIG.skeletonFormat,
      profile.deadline,
      profile.targetLevel,
      ...profile.purposeTags,
      profile.purposeText,
      profile.levelLabel ?? '',
      profile.targetLanguageName,
      skeletonInput.today,
      '20分',
      '6日',
      `${estimateUnitCount({ ...skeletonInput, ...profile })} 個前後`,
      'u01, u02',
      '3〜5個',
      '15〜25',
      'optional: true',
      'status',
      '易しい→難しい',
    ])
  })

  it('指定した単元数を使う', () => {
    const input = { ...skeletonInput, unitCount: 12 }
    expect(buildSkeletonPrompt(input), `入力: ${JSON.stringify(input)}`).toContain('12 個前後')
  })
})

describe('単元プロンプト', () => {
  it('必須見出し、単元情報、件数と参照の制約を含む', () => {
    expectIncludes(buildUnitPrompt(unitInput), [
      ...headings,
      APP_CONFIG.unitFormat,
      'unitId',
      unitInput.unit.id,
      unitInput.unit.title,
      unitInput.unit.canDo,
      unitInput.unit.scenario,
      ...unitInput.unit.keywords,
      '30',
      '15〜25',
      '~2',
      'uncertain',
      '3つ以上',
      '1〜2文',
      'rel の参照先は同じ単元内',
      'synonym',
      'antonym',
      'confusable',
      'related',
      'fixed: true',
      '日本語の助詞や語順',
      '別のタグ',
    ])
  })

  it.each(['A', 'B'] as const)('パート%sと既存ID、タグ候補を反映する', (part) => {
    const input = {
      ...unitInput,
      part,
      existingWordIds: ['ms:makan'],
      allowedTags: ['fruit', 'place'],
    }
    expectIncludes(buildUnitPrompt(input), [
      `パート${part}`,
      'ms:makan',
      '重複しない',
      'fruit',
      'place',
    ])
    if (part === 'A') {
      expect(buildUnitPrompt(input), `入力: ${JSON.stringify(input)}`).toContain('残りはパートB')
    }
  })
})

describe.each([
  ['骨組み', () => buildSkeletonPrompt(skeletonInput), APP_CONFIG.skeletonFormat],
  ['単元', () => buildUnitPrompt(unitInput), APP_CONFIG.unitFormat],
] as const)('%sの共通品質', (_name, build, format) => {
  it('同じ入力から同じ出力を返す', () => {
    expect(build(), '入力: 同じプロフィールと単元情報').toBe(build())
  })

  it('JSON例を解析でき、設定の封筒形式と一致する', () => {
    const prompt = build()
    const blocks = [...prompt.matchAll(/```json\n([\s\S]*?)\n```/g)]
    expect(blocks.length, `入力: ${prompt}`).toBe(1)
    for (const block of blocks) {
      const parsed: unknown = JSON.parse(block[1] ?? '')
      expect(parsed, `入力: ${block[1]}`).toMatchObject({
        format,
        version: APP_CONFIG.importEnvelopeVersion,
      })
    }
    expect(prompt.trim().split('\n').at(-1), `入力: ${prompt}`).toBe('- JSONとして正しいこと。')
  })
})

it('両方の母語名をEnglishに差し替える', () => {
  const english = { ...profile, nativeLanguage: 'en', nativeLanguageName: 'English' }
  for (const prompt of [
    buildSkeletonPrompt({ ...skeletonInput, profile: english }),
    buildUnitPrompt({ ...unitInput, profile: english }),
  ]) {
    expectIncludes(prompt, ['意味・説明は母語の English (en) で書く'])
    expect(prompt, `入力: ${JSON.stringify(english)}`).not.toContain('母語の 日本語')
  }
})
