# 開発用ダミーデータ

**開発用ダミー・内容の正確性は未検証**

マレー語の単語・例文・訳・語の関係・文法説明は未検証です。
開発・動作確認専用であり、製品の既定コンテンツとして同梱しません。
すべての JSON の先頭に `_notice` を付け、未検証であることを明記しています。
保存データの単元は `verified: false` とし、封筒の取り込み時も未検証として扱います。

- `dummy-skeleton.json`: 3単元の骨組みを取り込むための `lang-study-skeleton` 封筒。
  u03「道をたずねる」だけが任意単元です。
- `dummy-unit-u01.json`: u01「あいさつと自己紹介」を取り込むための
  `lang-study-unit` 封筒。単語16個、フレーズ3個（スロット付き2個・固定1個）、
  例文4個、文法メモ2個を含みます。国名タグ、4種類の語の関係、要確認の語も試せます。
- `dummy-full.json`: 保存・復元を試すための `StudyData` 全体。
  同じ u01 の内容、3単元の計画、FSRS記録3件、学習履歴2件を含みます。
  u01 は `ready`、u02・u03 は `planned` です。

`npm run gen:schema` で zod から `public/schema/` に JSON Schema を再生成します。
JSON Schema だけでは表現できない参照整合性などは zod と参照検証関数で確認します。
検証コマンド: `npm run gen:schema && npx vitest run src/schema/fixtures.test.ts`
