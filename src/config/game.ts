// ゲーム要素の暫定ルール(仕様5章)。数値はここだけ変えれば調整できる。
export const GAME_CONFIG = {
  xp: {
    correct: 10,
    stepComplete: 20,
    unitComplete: 50,
  },
  /** 1日の目標(新出+復習の合計数)の既定値 */
  dailyGoalDefault: 20,
  /** 連続日数: 1日休むと途切れる(猶予なし) */
  streakGraceDays: 0,
  /** ステップを組み立てるときの1バッチの項目数(仕様6.2) */
  batchSize: 5,
  /** 1項目あたり、1セッション内で想起する回数の目安(仕様6.3) */
  maxRecallsPerItemPerSession: 5,
} as const
