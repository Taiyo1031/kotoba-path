import { APP_CONFIG } from '../config/app'
import { commonInstructions, formatProfile, jsonExample, selfCheck } from './shared'
import type { UnitPromptInput } from './types'

export function buildUnitPrompt(input: UnitPromptInput): string {
  const { profile, unit, part, existingWordIds, allowedTags } = input
  const example = {
    format: APP_CONFIG.unitFormat,
    version: APP_CONFIG.importEnvelopeVersion,
    unitId: unit.id,
    words: [
      {
        id: `${profile.targetLanguage}:lemma`,
        lemma: 'lemma',
        pos: 'noun',
        reading: '',
        meaning: [`${profile.nativeLanguageName}での意味`],
        tags: [],
        rel: [],
        uncertain: false,
        note: '',
      },
    ],
    phrases: [
      {
        id: 'ph:fixed-example',
        target: '対象言語の固定フレーズ',
        meaning: `${profile.nativeLanguageName}での意味`,
        slots: {},
        fixed: true,
      },
    ],
    sentences: [
      {
        id: 'se:001',
        target: '対象言語の例文',
        meaning: `${profile.nativeLanguageName}での意味`,
        wordIds: [`${profile.targetLanguage}:lemma`],
      },
    ],
    grammarNotes: [
      {
        id: 'gn:example',
        appliesTo: [`${profile.targetLanguage}:lemma`],
        title: `${profile.nativeLanguageName}での題名`,
        hint: `${profile.nativeLanguageName}で、なぜそうなるかを説明する。`,
      },
    ],
  }
  return [
    '# 単元の教材を作成',
    commonInstructions(
      profile,
      `format: "${APP_CONFIG.unitFormat}"、version: ${APP_CONFIG.importEnvelopeVersion}、unitId: string (${unit.id})。
words, phrases, sentences, grammarNotes は、それぞれ以下のオブジェクトの配列。
words: id, lemma, pos, reading, note は string、meaning, tags は string[]、
rel は { type: "synonym" | "antonym" | "confusable" | "related", id: string }[]、uncertain は boolean。
phrases: id, target, meaning は string、slots は { [スロット名: string]: { tag: string } }、fixed は boolean。
target は "Saya suka {fruit}."、meaning は "私は{fruit}が好きです。" のように対応するスロットを含む。
slots は { "fruit": { "tag": "fruit" } } の形式。fixed: true は固定フレーズ(スロットなし、slots は {})。
sentences: id (例 se:001), target, meaning は string、wordIds は string[]。
grammarNotes: id (例 gn:example), title, hint は string、appliesTo は単語またはフレーズのIDの string[]。
wordIds と appliesTo の参照先も同じ単元内に存在するIDのみ。`,
    ),
    formatProfile(profile),
    `【単元情報】
- unitId: ${unit.id}
- タイトル: ${unit.title}
- 到達目標: ${unit.canDo}
- 場面: ${unit.scenario}
- キーワード: ${unit.keywords.join('、')}
- 項目数の目安: ${unit.itemEstimate}`,
    `【件数】
words は1回15〜25項目。多い単元は A と B の2回に分けて出す。
${part === 'A' ? '今回はパートAです。残りはパートBで出します。' : part === 'B' ? '今回はパートBです。パートAの続きとして出します。' : ''}
${existingWordIds ? `既存の単語ID: ${JSON.stringify(existingWordIds)}。これらと重複しない語を選ぶ。` : ''}`,
    `【スロット付きフレーズ】
同じ tag を付けた単語が同じ単元内に3つ以上あるときだけ作る。
日本語の助詞や語順がテンプレートと合う語だけをタグにする。合わない語には別のタグを付ける。
母語が日本語以外の場合も、その母語の語順と文法に合う候補だけにする。
${allowedTags ? `スロット用タグは次の候補から選ぶ: ${JSON.stringify(allowedTags)}。` : ''}`,
    `【例文と文法メモ】
例文と文法メモは各項目に短く付ける。
文法メモの hint は「なぜそうなるか」を1〜2文で説明する。`,
    jsonExample(example),
    selfCheck,
  ].join('\n\n')
}
