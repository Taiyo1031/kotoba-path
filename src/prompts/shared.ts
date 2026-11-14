import type { PromptProfile } from './types'

export function formatProfile(profile: PromptProfile): string {
  return `【プロフィール】
- 対象言語: ${profile.targetLanguageName} (${profile.targetLanguage})
- 母語: ${profile.nativeLanguageName} (${profile.nativeLanguage})
- 目的タグ: ${profile.purposeTags.join('、')}
- 目的の自由記述: ${profile.purposeText}
- 目標レベル: ${profile.targetLevel}${profile.levelLabel ? ` (${profile.levelLabel})` : ''}
- 期限: ${profile.deadline}
- 1日の学習時間: ${profile.dailyMinutes}分
- 週の学習日数: ${profile.studyDaysPerWeek}日`
}

export function commonInstructions(profile: PromptProfile, schema: string): string {
  return `【役割】
あなたは語学教材の作成者です。

【出力形式】
出力はJSONのみ。前置き・解説は書かない。JSONのコードフェンスは付けてよい。

【スキーマ】
${schema}
スキーマは平らに保つ。指定した構造以外の深い入れ子にしない。
スキーマに無い項目(日付や status など)は出力しない。

【IDの規則】
単語IDは「言語コード:lemmaを小文字にして空白を-に」の形式。
今回の言語コードは ${profile.targetLanguage}。例: ms:makan、ms:terima-kasih。
同形異義は ~2, ~3 を付ける。フレーズIDは ph: + 英小文字のスラッグ。
単語・フレーズのIDはコース全体で一意にする。
rel の参照先は同じ単元内の単語IDのみ。例文・文法メモのIDは単元内で一意にする。

【確信がない語】
確信がない語は入れない。入れる場合は uncertain: true を付ける。

【言語の範囲】
対象言語は標準的な表記と一般的な用法に限る。俗語・方言は指定があるときのみ。

【母語】
意味・説明は母語の ${profile.nativeLanguageName} (${profile.nativeLanguage}) で書く。`
}

export function jsonExample(value: unknown): string {
  return [
    '構造の例(件数は省略しているため、実際は指定件数を満たすこと):',
    '```json',
    JSON.stringify(value, null, 2),
    '```',
  ].join('\n')
}

export const selfCheck = `【自己チェック】
出力前に以下を確認する(チェック結果は出力しない)。
- IDの規則を守り、重複していないこと。
- 参照先の存在を確認し、同じ単元内のIDを参照していること。
- 指定の件数を満たしていること。
- JSONとして正しいこと。`
