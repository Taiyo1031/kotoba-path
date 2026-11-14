import { describe, it, expect } from 'vitest'
import {
  StudyDataSchema,
  WordSchema,
  PhraseSchema,
  PlanSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  UnitContentSchema,
  UnitEnvelopeSchema,
  SkeletonEnvelopeSchema,
  formatPath,
  zodIssuesToValidationIssues,
  validateUnitContentReferences,
  validateStudyDataReferences,
  FsrsRecordSchema,
  GoalSchema,
  SessionLogSchema,
} from './index'

const at = '2026-11-14T12:00:00Z'
const unit = { id: 'u01', title: 'あいさつ', canDo: '名前を伝える' }
const word = { id: 'ms:makan', lemma: 'makan', pos: 'verb', meaning: ['食べる'] }
const generatedBy = { tool: 'AI', at }
const base = {
  format: 'lang-study-data',
  version: 1,
  meta: { exportedAt: at, appVersion: '0.1.0' },
  profile: {
    uiLanguage: 'ja',
    nativeLanguage: 'ja',
    targetLanguage: 'ms',
    goal: {
      targetLevel: 'A2',
      deadline: '2027-03-31',
      dailyMinutes: 20,
    },
  },
  plan: { units: [unit] },
  progress: {},
}
const envelope = { format: 'lang-study-unit', version: 1, unitId: 'u01' }

function valid(
  schema: { safeParse: (input: unknown) => { success: boolean } },
  input: unknown,
  expected = true,
) {
  expect(schema.safeParse(input).success, `入力: ${JSON.stringify(input)}`).toBe(expected)
}

describe('データスキーマ', () => {
  it('全体構造を受け入れて既定値を埋め、未知のキーを除く', () => {
    const data = StudyDataSchema.parse({
      ...base,
      extra: true,
      content: { units: { u01: { generatedBy, words: [word] } } },
    })
    expect(data.profile.goal).toMatchObject({
      purposeTags: [],
      purposeText: '',
      studyDaysPerWeek: 6,
    })
    expect(data.plan.units[0]).toEqual({
      ...unit,
      scenario: '',
      keywords: [],
      itemEstimate: 20,
      optional: false,
      status: 'planned',
    })
    expect(data.progress).toEqual({
      fsrs: {},
      unitProgress: {},
      xp: 0,
      streak: { days: 0, lastStudyDate: null },
      sessions: [],
    })
    expect(data.content.units.u01).toMatchObject({
      version: 1,
      verified: false,
      phrases: [],
      sentences: [],
      grammarNotes: [],
      words: [{ ...word, reading: '', tags: [], rel: [], uncertain: false, note: '' }],
    })
    expect(data).not.toHaveProperty('extra')
    expect(StudyDataSchema.parse(base).content).toEqual({ units: {} })
  })

  it('必須欠落、型違い、空の意味、形式違いを拒否する', () => {
    for (const input of [
      { ...word, lemma: undefined },
      { ...word, lemma: 1 },
      { ...word, meaning: [] },
    ])
      valid(WordSchema, input, false)
    valid(StudyDataSchema, { ...base, format: 'wrong' }, false)
    valid(StudyDataSchema, { ...base, profile: undefined }, false)
  })

  it('実在する日付とISO日時を検査する', () => {
    for (const input of ['2026-02-30', '2026-2-01', '2026-13-01', '1900-02-29'])
      valid(IsoDateSchema, input, false)
    for (const input of ['2024-02-29', '2000-02-29', '2026-11-14']) valid(IsoDateSchema, input)
    for (const input of [at, '2026-11-14T21:00:00+09:00']) valid(IsoDateTimeSchema, input)
    for (const input of ['tomorrow', 'November 14, 2026', ''])
      valid(IsoDateTimeSchema, input, false)
  })

  it('計画の重複IDを後の要素で報告する', () => {
    const result = PlanSchema.safeParse({ units: [unit, unit] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['units', 1, 'id'])
    valid(PlanSchema, { units: [{ ...unit, id: 'bad:id' }] }, false)
  })

  it('フレーズのスロットを両方のフィールドで検査する', () => {
    const phrase = { id: 'ph:1', target: 'Saya suka {fruit}', meaning: '{fruit}が好き' }
    valid(PhraseSchema, { ...phrase, target: 'hello', meaning: 'こんにちは' }, false)
    valid(PhraseSchema, { ...phrase, target: 'hello', meaning: 'こんにちは', fixed: true })
    valid(PhraseSchema, { ...phrase, slots: { fruit: { tag: 'fruit' } } })
    const result = PhraseSchema.safeParse({ ...phrase, slots: { other: { tag: 'other' } } })
    if (result.success) throw new Error('未定義スロットが受理されました')
    expect(result.error.issues.map((issue) => issue.path)).toEqual([['target'], ['meaning']])
  })

  it('固定フレーズでも未定義の穴や継承プロパティをスロットとして認めない', () => {
    const input = {
      id: 'ph:fixed',
      target: '{toString}',
      meaning: '固定フレーズ',
      fixed: true,
    }
    const result = PhraseSchema.safeParse(input)
    expect(result.success, `入力: ${JSON.stringify(input)}`).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.path)).toEqual([['target']])
  })

  it('封筒の正常値と異常値を検査する', () => {
    const skeleton = { format: 'lang-study-skeleton', version: 1, units: [unit] }
    valid(SkeletonEnvelopeSchema, skeleton)
    valid(SkeletonEnvelopeSchema, { ...skeleton, units: [] }, false)
    valid(SkeletonEnvelopeSchema, { ...skeleton, format: 'wrong' }, false)
    valid(UnitEnvelopeSchema, envelope)
    valid(UnitEnvelopeSchema, { ...envelope, format: 'wrong' }, false)
    expect(UnitEnvelopeSchema.parse(envelope).words).toEqual([])
  })

  it('数値の範囲と整数を検査する', () => {
    const fsrs = {
      due: at,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 0,
    }
    valid(FsrsRecordSchema, fsrs)
    for (const patch of [{ state: 4 }, { reps: -1 }, { elapsedDays: 0.5 }, { stability: -1 }])
      valid(FsrsRecordSchema, { ...fsrs, ...patch }, false)
    for (const patch of [{ dailyMinutes: 0 }, { dailyMinutes: 601 }, { studyDaysPerWeek: 8 }])
      valid(GoalSchema, { ...base.profile.goal, ...patch }, false)
    valid(SessionLogSchema, {
      id: 's1',
      kind: 'lesson',
      seed: -1,
      startedAt: at,
      answered: 0,
      correct: 0,
      xpGained: 0,
    })
  })
})

describe('検証エラー', () => {
  it('JSONパスを整形する', () => {
    expect(formatPath(['words', 3, 'rel', 0, 'id'])).toBe('words[3].rel[0].id')
    expect(formatPath([])).toBe('$')
    expect(formatPath(['a', 'b'])).toBe('a.b')
  })
  it('ネストしたエラーを日本語にする', () => {
    for (const [id, message] of [
      [undefined, '必須項目がありません'],
      [12, '文字列である必要があります'],
    ] as const) {
      const result = UnitEnvelopeSchema.safeParse({
        ...envelope,
        words: [word, word, word, { ...word, rel: [{ type: 'related', id }] }],
      })
      if (result.success) throw new Error('壊れた単語が受理されました')
      expect(zodIssuesToValidationIssues(result.error)).toContainEqual({
        path: 'words[3].rel[0].id',
        message,
      })
    }
    const result = WordSchema.safeParse({ ...word, rel: [{ type: 'wrong', id: 'x' }] })
    if (result.success) throw new Error('不正な列挙値が受理されました')
    expect(zodIssuesToValidationIssues(result.error)[0]?.message).toBe('許可されていない値です')
  })
})

describe('参照検査', () => {
  const phrase = { id: 'ph:1', target: 'hello', meaning: 'こんにちは', fixed: true }
  const sentence = { id: 'se:1', target: 'makan', meaning: '食べる', wordIds: [word.id] }
  const note = { id: 'gn:1', appliesTo: [word.id, phrase.id], title: '文法', hint: '説明' }
  it('正しい参照を受け入れる', () => {
    const content = UnitContentSchema.parse({
      generatedBy,
      words: [{ ...word, rel: [{ type: 'related', id: word.id }] }],
      phrases: [phrase],
      sentences: [sentence],
      grammarNotes: [note],
    })
    expect(validateUnitContentReferences(content)).toEqual([])
    expect(
      validateStudyDataReferences(
        StudyDataSchema.parse({ ...base, content: { units: { u01: content } } }),
      ),
    ).toEqual([])
  })
  it('参照切れと単元内の重複を該当パスで報告する', () => {
    const content = UnitContentSchema.parse({
      generatedBy,
      words: [{ ...word, rel: [{ type: 'related', id: 'missing' }] }, word],
      phrases: [phrase, phrase],
      sentences: [{ ...sentence, wordIds: ['missing'] }],
      grammarNotes: [{ ...note, appliesTo: ['missing'] }],
    })
    expect(validateUnitContentReferences(content).map((issue) => issue.path)).toEqual([
      'words[1].id',
      'phrases[1].id',
      'words[0].rel[0].id',
      'sentences[0].wordIds[0]',
      'grammarNotes[0].appliesTo[0]',
    ])
    expect(
      validateUnitContentReferences(content, { knownWordIds: new Set(['missing']) }).map(
        (issue) => issue.path,
      ),
    ).toEqual(['words[1].id', 'phrases[1].id', 'words[0].rel[0].id'])
  })
  it('コース全体の単語を参照でき、別単元の重複は後の側で報告する', () => {
    const data = StudyDataSchema.parse({
      ...base,
      content: {
        units: {
          u01: {
            generatedBy,
            sentences: [sentence],
            grammarNotes: [{ ...note, appliesTo: [word.id] }],
          },
          u02: { generatedBy, words: [word] },
        },
      },
    })
    expect(validateStudyDataReferences(data)).toEqual([])
    data.content.units.u01 = UnitContentSchema.parse({
      generatedBy,
      words: [{ ...word, id: 'ms:other', rel: [{ type: 'related', id: word.id }] }],
      sentences: [sentence],
      grammarNotes: [{ ...note, appliesTo: [word.id] }],
    })
    expect(validateStudyDataReferences(data).map((issue) => issue.path)).toEqual([
      'content.units.u01.words[0].rel[0].id',
    ])
    data.content.units.u01 = UnitContentSchema.parse({ generatedBy })
    data.content.units.u03 = UnitContentSchema.parse({ generatedBy, words: [word] })
    expect(validateStudyDataReferences(data).map((issue) => issue.path)).toEqual([
      'content.units.u03.words[0].id',
    ])
  })
})
