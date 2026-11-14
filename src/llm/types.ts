// ローカルLLM接続のインターフェース(仕様 付録)。実装はフェーズ7で追加する。
// 生成結果は未検証として扱い、取り込み画面と同じ検証に通すこと。
export interface LlmProvider {
  /** プロンプトを送り、モデルの出力テキストを返す */
  generate(prompt: string): Promise<string>
}
