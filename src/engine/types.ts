// 学習エンジンの共通の型(仕様 6章)。出題の「データ」だけを表し、画面(UI)は含まない。
// 担当間の境界なので、変更するときは設計担当(Claude)が docs/DECISIONS.md に理由を書いてから行う。

/** ステップの種類(仕様 6.2): 新出 → 受容 → 産出 → 文脈、最後に単元まとめ */
export type StepKind = 'intro' | 'recognize' | 'recall' | 'context' | 'unitTest'

export interface Step {
  /** `${unitId}-b${バッチ番号}-${kind}`(単元まとめは `${unitId}-test`) */
  id: string
  kind: StepKind
  /** 0 から始まるバッチ番号。単元まとめは null */
  batchIndex: number | null
  /** 出題の対象になる単語のID(単元まとめでは、単元内のすべての単語ID) */
  wordIds: string[]
  /** このステップで使うフレーズのID(context と unitTest のみ) */
  phraseIds: string[]
  /** このステップで使う例文のID(context のみ) */
  sentenceIds: string[]
}

/** 出題形式(仕様 6.7) */
export type QuestionFormat =
  | 'intro'
  | 'flashcard'
  | 'mcq'
  | 'cloze'
  | 'typing'
  | 'tiles'
  | 'match'
  | 'listening'
  | 'phrase-slot'

export interface Option {
  id: string
  text: string
}

export type McqDirection = 'foreignToNative' | 'nativeToForeign' | 'audioToMeaning'

export interface McqQuestion {
  format: 'mcq'
  /** 正解の単語ID */
  itemId: string
  direction: McqDirection
  /** 問題文(外国語→母語なら見出し語、母語→外国語なら意味。音声→意味なら見出し語(読み上げ用)) */
  prompt: string
  /** 外国語→母語のときだけ、問題文の語の読み(空なら付けない) */
  promptReading?: string
  /** シャッフル済みの選択肢(正解を含む) */
  options: Option[]
  correctId: string
}

export interface ClozeQuestion {
  format: 'cloze'
  itemId: string
  sentenceId: string
  /** 穴の前の文字列と後ろの文字列 */
  before: string
  after: string
  /** 正解の文字列(穴に入る語形) */
  answer: string
  mode: 'choice' | 'typing'
  /** 選択式のときの選択肢と正解のID */
  options?: Option[]
  correctId?: string
  /** 入力式のときの許容する別解(answer を含まない) */
  accepted: string[]
}

export interface TilesQuestion {
  format: 'tiles'
  itemId: string
  /** 母語の文(並べ替えの手がかり) */
  prompt: string
  /** シャッフル済みのタイル(ダミーを含む) */
  tiles: string[]
  /** 正解の語の並び */
  answer: string[]
  /** 許容する別の並び(answer を含まない) */
  accepted: string[][]
}

export interface TypingQuestion {
  format: 'typing'
  itemId: string
  /** 問題文(意味) */
  prompt: string
  answer: string
  /** 許容する別解(answer を含まない) */
  accepted: string[]
}

export interface PhraseSlotQuestion {
  format: 'phrase-slot'
  /** フレーズのID */
  itemId: string
  /** 穴を埋めた外国語の文と、母語の文 */
  target: string
  meaning: string
  /** スロット名 → 差し込んだ単語ID */
  filled: Record<string, string>
}

export interface IntroQuestion {
  format: 'intro'
  /** 単語のID。見出し語・意味・例文などは、画面側が単語データから表示する */
  itemId: string
}

export interface FlashcardQuestion {
  format: 'flashcard'
  itemId: string
  /** 表(外国語)と裏(母語) */
  front: string
  back: string
}

export interface MatchPair {
  id: string
  foreign: string
  native: string
}

export interface MatchQuestion {
  format: 'match'
  pairs: MatchPair[]
  /** 左(外国語)・右(母語)の表示順(pair の id を並べたもの) */
  foreignOrder: string[]
  nativeOrder: string[]
}

/** 1つの出題(データ) */
export type Question =
  | IntroQuestion
  | FlashcardQuestion
  | McqQuestion
  | ClozeQuestion
  | TypingQuestion
  | TilesQuestion
  | MatchQuestion
  | PhraseSlotQuestion

/** 学習者の回答(画面から渡す) */
export type Response =
  | { kind: 'ack' }
  | { kind: 'choice'; optionId: string }
  | { kind: 'text'; text: string }
  | { kind: 'tiles'; tiles: string[] }
  | { kind: 'match'; pairs: { foreignId: string; nativeId: string }[] }
  | { kind: 'selfGrade'; grade: 'again' | 'hard' | 'good' | 'easy' }

/** 答え合わせの結果 */
export interface Judgement {
  correct: boolean
  /** 入力式で、1文字違い(おしい) */
  close: boolean
  /** おしいときのヒント */
  hint?: string
  /** 正解の表示用テキスト */
  correctText: string
  /** 自己採点のとき、選ばれた評価 */
  selfGrade?: 'again' | 'hard' | 'good' | 'easy'
}
