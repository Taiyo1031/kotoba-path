# CLAUDE.md — Kotoba Path(仮)

少数言語の学習アプリ(個人テスト版)。サーバーなしの静的サイト。仕様の原本は [`docs/spec-prompt.md`](docs/spec-prompt.md)。
計画は [`docs/PLAN.md`](docs/PLAN.md)、判断の記録は [`docs/DECISIONS.md`](docs/DECISIONS.md)。

## コマンド

| 目的                  | コマンド                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| 開発サーバー          | `npm run dev`                                                                                        |
| ビルド                | `npm run build`(`tsc -b && vite build`)                                                              |
| ビルド確認            | `npm run preview`                                                                                    |
| Lint                  | `npm run lint`                                                                                       |
| 整形                  | `npm run format` / `npm run format:check`                                                            |
| テスト                | `npm run test`(Vitest、IndexedDB は `fake-indexeddb`)                                                |
| GitHub Pages 用ビルド | `VITE_BASE=/kotoba-path/ npm run build`(PowerShell: `$env:VITE_BASE='/kotoba-path/'; npm run build`) |

フェーズ末に `build` / `lint` / `test` がすべて通ること。

## 技術構成

Vite + React + TypeScript(strict)、HashRouter、IndexedDB(`idb`)、zod、Zustand、`ts-fsrs`、Vitest、ESLint + Prettier。外部CDN・外部フォントには依存しない。

## ディレクトリ構成

```
src/
  types/     型定義(担当間の境界。変更は設計担当=Claude のみ)
  schema/    zod スキーマ(types と対応。検証の唯一の入口)
  config/    app.ts(アプリ名・バージョン) / game.ts(XP等の定数) / languages.ts(言語リスト)
  db/        IndexedDB 層(idb)
  i18n/      ja / en の辞書とフック
  io/        取り込み・書き出し・CSV・マイグレーション
  prompts/   プロンプトのテンプレート関数
  llm/       LlmProvider インターフェース
  engine/    学習エンジン(フェーズ3以降)
  pages/     ルートごとのページ
  components/ 共通コンポーネント
  styles/    デザイントークン(CSS変数)
fixtures/    開発用ダミーデータ(内容の正確性は未検証。製品に同梱しない)
public/schema/  JSON Schema 出力
docs/        PLAN / DECISIONS / data-format / CHECKLIST
```

## 規約

- コードの識別子は英語、コメントとドキュメントは日本語。
- 型は `src/types`、検証は `src/schema`(zod)に置く。**型を変えるときは `docs/DECISIONS.md` に理由を書いてから**変更する。
- レイアウトは CSS Grid / flexbox / rem。色・余白・角丸・影・文字サイズは CSS 変数(トークン)で定義。
- `prefers-reduced-motion` を尊重する。キーボードだけで主要ページを操作できるようにする。
- 学習内容の本物のデータは作らない(作者が別のAIで生成して取り込む)。ダミーは `verified: false` と明記。
- 秘密情報(パスワード・APIキー)は書かない・求めない。`.env` はコミットしない。

## 重要な設計判断(要約。詳細は DECISIONS.md)

- データは1つの JSON(`format: "lang-study-data"`, `version`)。`meta / profile / plan / content / progress` に分ける。
- 単語IDは `${言語コード}:${lemmaを小文字化して空白を-に}`。同形異義は `~2`, `~3`。
- 取り込みは「全体を取り込む or 拒否」(部分成功なし)。再取り込みは FSRS の履歴を保持して内容だけ置き換える。
- ステップ(問題・選択肢・出題順)はアプリが自動で組み立てる。AI が作るのは素材のみ。

## 開発の進め方(dev-router)

- Claude は計画・設計・仕様書(`.tasks/NNN.md`)・最終レビューを担当。実装は重さに応じて Codex / LM Studio(LM Link 経由のローカルLLM)に振り分ける。
- `.tasks/` と `.lmstudio/` は作業ログ(コミットしない)。
- 使う PC 名はファイルに保存しない(実行時に毎回指定)。
