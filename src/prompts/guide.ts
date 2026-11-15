import { APP_CONFIG } from '../config/app'
import { formatProfile, jsonExample, promptVersionLine } from './shared'
import type { GuidePromptInput } from './types'

export function buildGuidePrompt(input: GuidePromptInput): string {
  const { profile, unitHints } = input

  const readingSection =
    profile.nativeLanguage === 'ja'
      ? `【読み(reading)】
- reading は空にしない(examples[].reading も、できるだけ入れる)。
- 母語が日本語(profile.nativeLanguage === 'ja')のときは、sounds[].reading と examples[].reading の両方をカナで近似する(例: ng → ング)。
- 対象言語がラテン文字以外の文字体系のときは、カナの近似に加えて、ローマ字を / でつなぐ。`
      : `【読み(reading)】
- reading は空にしない(examples[].reading も、できるだけ入れる)。
- 母語の読者が読める近似表記で書く。`

  const sections: string[] = [
    '# 文字と発音のガイドを作成',
    `【役割】
あなたは語学教材の作成者です。対象言語を初めて学ぶ人が、最初の単語を読めるようにするための、文字と発音のガイドを作ります。`,
    `【出力形式】
出力はJSONのみ。前置き・解説は書かない。JSONのコードフェンスは付けてよい。`,
    `【スキーマ】
format: "${APP_CONFIG.guideFormat}"、version: ${APP_CONFIG.importEnvelopeVersion}、intro: string(このガイドの使い方を2〜3文)、sounds: 次の配列、rules: 次の配列。
sounds の各要素: id, grapheme, reading, ipa, note は string、examples は { target: string, reading: string, meaning: string }[]、confusableWith は string[]。
rules の各要素: id, title, body は string。
スキーマは平らに保つ。指定した構造以外の深い入れ子にしない。スキーマに無い項目は出力しない。`,
    `【IDの規則】
音のIDは sd: + 英小文字のスラッグ(例: sd:ng、sd:c)。規則のIDは gr: + 英小文字のスラッグ(例: gr:final-k)。IDはガイド内で一意。confusableWith は、同じガイド内の音のIDだけを書く。`,
    readingSection,
    `【件数と選び方】
sounds は15〜30個。初心者が迷う音・文字(日本語話者が間違えやすい音、綴りと読みがずれる音)を優先する。examples は各音に1〜3個の実在する語(意味つき)。rules は3〜8個で、body は「なぜそう読むか」を1〜2文。note は発音のコツを1〜2文。ipa は確信があるときだけ書き、なければ空文字にする。`,
    `【確信がない内容】
確信がない音・語・規則は入れない。`,
    `【言語の範囲】
対象言語は標準的な表記と一般的な発音に限る。方言・俗語は指定があるときのみ。`,
    `【母語】
説明は母語の ${profile.nativeLanguageName} (${profile.nativeLanguage}) で書く。`,
    formatProfile(profile),
  ]

  if (unitHints && unitHints.length > 0) {
    const lines = unitHints.map((h) => `- ${h.title}(${h.keywords.join('、')})`)
    sections.push(`【このコースの単元】
${lines.join('\n')}
これらの単元の最初の単語を読むために必要な音・文字を優先する。`)
  }

  const example = {
    format: APP_CONFIG.guideFormat,
    version: APP_CONFIG.importEnvelopeVersion,
    intro: 'このガイドの使い方',
    sounds: [
      {
        id: 'sd:example',
        grapheme: 'つづりの例',
        reading: '読みの例',
        ipa: '',
        note: '',
        examples: [{ target: '対象言語の語', reading: '読みの例', meaning: '意味' }],
        confusableWith: [],
      },
    ],
    rules: [{ id: 'gr:example', title: '題名', body: 'なぜそう読むかの説明' }],
  }

  sections.push(jsonExample(example))
  sections.push(`【自己チェック】
出力前に確認する(チェック結果は出力しない)。
- 音のIDと規則のIDが重複していないこと。
- confusableWith の参照先が存在すること。
- すべての reading が入っていること。
- 件数を満たしていること。
- JSONとして正しいこと。`)
  sections.push(promptVersionLine())

  return sections.join('\n\n')
}
