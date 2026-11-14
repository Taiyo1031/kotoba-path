import { APP_CONFIG } from '../config/app'
import { estimateUnitCount } from './estimate'
import { commonInstructions, formatProfile, jsonExample, selfCheck } from './shared'
import type { SkeletonPromptInput } from './types'

export function buildSkeletonPrompt(input: SkeletonPromptInput): string {
  const { profile, today } = input
  const count = input.unitCount ?? estimateUnitCount({ today, ...profile })
  const example = {
    format: APP_CONFIG.skeletonFormat,
    version: APP_CONFIG.importEnvelopeVersion,
    units: [
      {
        id: 'u01',
        title: '基本のあいさつ',
        canDo: '基本のあいさつができる',
        scenario: '初対面',
        keywords: ['あいさつ', '名前', '自己紹介'],
        itemEstimate: 20,
        optional: false,
      },
    ],
  }
  return [
    '# コースの骨組みを作成',
    commonInstructions(
      profile,
      `format: "${APP_CONFIG.skeletonFormat}"、version: ${APP_CONFIG.importEnvelopeVersion}。
units: 単元オブジェクトの配列。
各単元: id, title, canDo, scenario は string、keywords は string[]、
itemEstimate は number、optional は boolean。`,
    ),
    formatProfile(profile),
    `今日の日付: ${today}`,
    `【件数】
単元数は ${count} 個前後。学習の順序は易しい→難しい。
単元IDは u01, u02, … の連番。
canDo は「〜できる」の形で到達目標を1文。scenario は場面。
keywords は3〜5個、itemEstimate は15〜25。
optional: true は、省いても目標に届く単元だけ。`,
    jsonExample(example),
    selfCheck,
  ].join('\n\n')
}
