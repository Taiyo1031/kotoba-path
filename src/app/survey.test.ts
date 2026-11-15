import { describe, expect, it } from 'vitest'
import { StudyDataSchema } from '../schema'
import { ja } from '../i18n/ja'
import {
  DAILY_MINUTES_OPTIONS,
  LEVEL_OPTIONS,
  PURPOSE_TAGS,
  buildProfile,
  createInitialStudyData,
  defaultDeadline,
  toPromptProfile,
  validateSurvey,
} from './survey'
import type { SurveyAnswers, SurveyField } from './survey'

interface ProfileLike {
  uiLanguage: string
  targetLanguage: string
  nativeLanguage: string
  goal: {
    purposeTags: string[]
    purposeText: string
    targetLevel: string
    deadline: string
    dailyMinutes: number
    studyDaysPerWeek: number
  }
}

function makeAnswers(overrides: Partial<SurveyAnswers> = {}): SurveyAnswers {
  return {
    targetLanguage: 'ms',
    purposeTags: ['travel'],
    purposeText: '',
    deadline: '2026-12-31',
    targetLevel: 'A2',
    dailyMinutes: 20,
    ...overrides,
  }
}

function expectTrue(condition: boolean, input: unknown): void {
  expect(condition, `入力: ${JSON.stringify(input)}\n期待値: true\n実際: ${condition}`).toBe(true)
}

function expectEqual(actual: unknown, expected: unknown, input: unknown): void {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  expect(
    actual,
    `入力: ${JSON.stringify(input)}\n期待値: ${expectedText}\n実際: ${actualText}`,
  ).toEqual(expected)
}

function expectErrorField(
  field: SurveyField,
  validation: ReturnType<typeof validateSurvey>,
  input: unknown,
): void {
  expectTrue(Boolean(validation.errors[field]), input)
}

describe('validateSurvey', () => {
  it('正常な回答で ok を返す', () => {
    const input = makeAnswers()
    expectTrue(validateSurvey(input, '2026-10-31').ok, input)
  })

  it('未知の言語コードで targetLanguage エラーを出す', () => {
    const input = makeAnswers({ targetLanguage: 'xx' })
    expectErrorField('targetLanguage', validateSurvey(input, '2026-10-31'), input)
  })

  it('目的が空(タグなし・自由記述が空白だけ)で purposeTags エラーを出す', () => {
    const input = makeAnswers({ purposeTags: [], purposeText: '   ' })
    expectErrorField('purposeTags', validateSurvey(input, '2026-10-31'), input)
  })

  it('目的が自由記述だけで ok を返す', () => {
    const input = makeAnswers({ purposeTags: [], purposeText: '  旅行の準備  ' })
    expectTrue(validateSurvey(input, '2026-10-31').ok, input)
  })

  it('期限が今日と同じで deadline エラーを出す', () => {
    const input = makeAnswers({ deadline: '2026-10-31' })
    expectErrorField('deadline', validateSurvey(input, '2026-10-31'), input)
  })

  it('期限が過去で deadline エラーを出す', () => {
    const input = makeAnswers({ deadline: '2026-10-30' })
    expectErrorField('deadline', validateSurvey(input, '2026-10-31'), input)
  })

  it('期限が不正な形式で deadline エラーを出す', () => {
    const input = makeAnswers({ deadline: '2026/10/31' })
    expectErrorField('deadline', validateSurvey(input, '2026-10-31'), input)
  })

  it('期限が実在しない日付で deadline エラーを出す', () => {
    const input = makeAnswers({ deadline: '2026-02-30' })
    expectErrorField('deadline', validateSurvey(input, '2026-10-31'), input)
  })

  it('レベルが不正で targetLevel エラーを出す', () => {
    const input = makeAnswers({ targetLevel: 'A3' as never })
    expectErrorField('targetLevel', validateSurvey(input, '2026-10-31'), input)
  })

  it.each([0, 601, 20.5])('分が %p で dailyMinutes エラーを出す', (minutes) => {
    const input = makeAnswers({ dailyMinutes: minutes })
    expectErrorField('dailyMinutes', validateSurvey(input, '2026-10-31'), input)
  })

  it('複数の error が同時に出る', () => {
    const input = makeAnswers({
      targetLanguage: 'xx',
      purposeTags: [],
      purposeText: '',
      deadline: '2026-10-31',
      targetLevel: 'A3' as never,
      dailyMinutes: 0,
    })
    const validation = validateSurvey(input, '2026-10-31')

    expectErrorField('targetLanguage', validation, input)
    expectErrorField('purposeTags', validation, input)
    expectErrorField('deadline', validation, input)
    expectErrorField('targetLevel', validation, input)
    expectErrorField('dailyMinutes', validation, input)
  })
})

describe('buildProfile', () => {
  it('既定値を使う', () => {
    const input = makeAnswers()
    const profile = buildProfile(input, { uiLanguage: 'ja' }) as unknown as ProfileLike

    expectEqual(profile.uiLanguage, 'ja', input)
    expectEqual(profile.targetLanguage, 'ms', input)
    expectEqual(profile.nativeLanguage, 'ja', input)
    expectEqual(profile.goal.studyDaysPerWeek, 6, input)
    expectEqual(profile.goal.purposeTags, ['travel'], input)
    expectEqual(profile.goal.purposeText, '', input)
    expectEqual(profile.goal.targetLevel, 'A2', input)
    expectEqual(profile.goal.deadline, '2026-12-31', input)
    expectEqual(profile.goal.dailyMinutes, 20, input)
  })

  it('重複タグを除去して順序を保つ', () => {
    const input = makeAnswers({ purposeTags: ['travel', 'work', 'travel', 'peers'] })
    const profile = buildProfile(input, { uiLanguage: 'ja' }) as unknown as ProfileLike

    expectEqual(profile.goal.purposeTags, ['travel', 'work', 'peers'], input)
  })

  it('purposeText を trim する', () => {
    const input = makeAnswers({ purposeText: '  旅行の準備  ' })
    const profile = buildProfile(input, { uiLanguage: 'ja' }) as unknown as ProfileLike

    expectEqual(profile.goal.purposeText, '旅行の準備', input)
  })

  it('options による上書きを使う', () => {
    const input = makeAnswers()
    const profile = buildProfile(input, {
      uiLanguage: 'en',
      nativeLanguage: 'en',
      studyDaysPerWeek: 3,
    }) as unknown as ProfileLike

    expectEqual(profile.uiLanguage, 'en', input)
    expectEqual(profile.nativeLanguage, 'en', input)
    expectEqual(profile.goal.studyDaysPerWeek, 3, input)
  })
})

describe('createInitialStudyData', () => {
  it('構造と meta.exportedAt を返し、StudyDataSchema.parse で通る', () => {
    const input = makeAnswers()
    const profile = buildProfile(input, { uiLanguage: 'ja' })
    const now = new Date(Date.UTC(2026, 9, 31, 12, 0, 0))

    const data = createInitialStudyData(profile, now) as unknown as Record<string, unknown>
    const parsed = StudyDataSchema.parse(data)

    expectEqual(
      (parsed as { meta: { exportedAt: string } }).meta.exportedAt,
      now.toISOString(),
      now.toISOString(),
    )

    expectEqual((parsed as { format: string }).format, 'lang-study-data', input)
    expectEqual((parsed as { version: number }).version, 1, input)

    expectEqual(JSON.stringify((parsed as { plan: unknown }).plan), '{"units":[]}', input)

    expectEqual(JSON.stringify((parsed as { content: unknown }).content), '{"units":{}}', input)

    const progress = (parsed as { progress: Record<string, unknown> }).progress
    expectEqual(
      JSON.stringify(progress),
      '{"fsrs":{},"unitProgress":{},"xp":0,"streak":{"days":0,"lastStudyDate":null},"sessions":[]}',
      input,
    )
  })
})

describe('toPromptProfile', () => {
  it('日本語名を返す', () => {
    const profile = buildProfile(makeAnswers(), { uiLanguage: 'ja' })
    const result = toPromptProfile(profile, 'ja') as unknown as Record<string, unknown>

    expectEqual(result.targetLanguageName, 'マレー語', profile)
    expectEqual(result.nativeLanguageName, '日本語', profile)
  })

  it('英語名を返す', () => {
    const profile = buildProfile(makeAnswers(), { uiLanguage: 'en' })
    const result = toPromptProfile(profile, 'en') as unknown as Record<string, unknown>

    expectEqual(result.targetLanguageName, 'Malay', profile)
    expectEqual(result.nativeLanguageName, 'Japanese', profile)
  })

  it('未知の言語コードをそのまま返す', () => {
    const profile = buildProfile(makeAnswers({ targetLanguage: 'xx' }), { uiLanguage: 'ja' })
    const result = toPromptProfile(profile, 'ja') as unknown as Record<string, unknown>

    expectEqual(result.targetLanguageName, 'xx', profile)
  })
})

describe('defaultDeadline', () => {
  it('通常の日付を返す', () => {
    const input = '2026-10-31'
    expectEqual(defaultDeadline(input, 4), '2027-02-28', input)
  })

  it('月末の調整をする', () => {
    const input = '2026-10-31'
    expectEqual(defaultDeadline(input, 4), '2027-02-28', input)
  })

  it('うるう年に対応する', () => {
    const input = '2027-10-31'
    expectEqual(defaultDeadline(input, 4), '2028-02-29', input)
  })

  it('年を跨ぐ', () => {
    const input = '2026-12-15'
    expectEqual(defaultDeadline(input, 4), '2027-04-15', input)
  })

  it('既定の months が 4 である', () => {
    const input = '2026-10-31'
    expectEqual(defaultDeadline(input), '2027-02-28', input)
  })
})

describe('LEVEL_OPTIONS', () => {
  it('labelKey がすべて src/i18n/ja.ts に存在する', () => {
    for (const option of LEVEL_OPTIONS) {
      const key = option.labelKey as keyof typeof ja
      expectTrue(key in ja, option.labelKey)
    }
  })
})

describe('constants', () => {
  it('PURPOSE_TAGS と DAILY_MINUTES_OPTIONS が仕様通りである', () => {
    expectEqual(PURPOSE_TAGS, ['travel', 'work', 'daily', 'localFriends', 'peers'], '-')

    expectEqual(DAILY_MINUTES_OPTIONS, [10, 20, 30, 45, 60], '-')
  })
})
