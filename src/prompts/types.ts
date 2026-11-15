export interface PromptProfile {
  targetLanguage: string
  targetLanguageName: string
  nativeLanguage: string
  nativeLanguageName: string
  purposeTags: string[]
  purposeText: string
  targetLevel: string
  levelLabel?: string
  deadline: string
  dailyMinutes: number
  studyDaysPerWeek: number
}

export interface SkeletonPromptInput {
  profile: PromptProfile
  today: string
  unitCount?: number
}

export interface PromptUnitInfo {
  id: string
  title: string
  canDo: string
  scenario: string
  keywords: string[]
  itemEstimate: number
}

export interface UnitPromptInput {
  profile: PromptProfile
  unit: PromptUnitInfo
  part?: 'A' | 'B'
  existingWordIds?: string[]
  allowedTags?: string[]
}

export interface GuidePromptUnitHint {
  title: string
  keywords: string[]
}
export interface GuidePromptInput {
  profile: PromptProfile
  /** コースの単元の題名とキーワード。最初の単語を読むために必要な音を、優先して選ばせる */
  unitHints?: GuidePromptUnitHint[]
}
