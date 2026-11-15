// レッスン画面の出題コンポーネントが共通で使う props の型(担当間の境界。変更は設計担当=Claude が行う)。
import type { Judgement, Response } from '../../engine/types'

/** 回答につける付帯情報(FSRS の評価に使う) */
export interface AnswerMeta {
  usedHint?: boolean
  slow?: boolean
}

/** 出題コンポーネントの共通の props */
export interface QuestionViewProps<Q> {
  question: Q
  /** 答え合わせの表示中は true(入力できない) */
  disabled: boolean
  /** 答え合わせの結果(まだなら null)。正誤に応じて、軽く跳ねる/揺れるクラスを付ける */
  judgement: Judgement | null
  /** 回答を確定したときに呼ぶ */
  onSubmit: (response: Response, meta?: AnswerMeta) => void
  /** 読み上げが使えるときだけ渡される。(text) を読み上げる */
  onSpeak?: (text: string) => void
}
