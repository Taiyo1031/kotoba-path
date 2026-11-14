# データ形式の仕様書

## 1. 概要

保存データは1つのJSONファイルで、拡張子は `.json`。  
`format` と `version` を持つ。セクション構成は以下の通り:

- `meta`: エクスポート日時やアプリバージョン
- `profile`: ユーザー設定情報
- `plan`: 学習計画(単元の骨組み)
- `content`: 実際の学習内容(単語・フレーズなど)
- `progress`: 学習進捗と履歴

## 2. 全体構造

```json
{
  "format": "lang-study-data",
  "version": 1,
  "meta": { "exportedAt": "ISO8601", "appVersion": "0.1.0" },
  "profile": {
    "uiLanguage": "ja",
    "nativeLanguage": "ja",
    "targetLanguage": "ms",
    "goal": {
      "purposeTags": ["travel"],
      "purposeText": "",
      "targetLevel": "A2",
      "deadline": "2027-03-31",
      "dailyMinutes": 20,
      "studyDaysPerWeek": 6
    }
  },
  "plan": {
    "units": [
      {
        "id": "u01",
        "title": "あいさつと自己紹介",
        "canDo": "名前と出身を伝えられる",
        "scenario": "初対面のあいさつ",
        "keywords": ["あいさつ", "名前", "出身"],
        "itemEstimate": 20,
        "optional": false,
        "plannedStart": "2026-11-15",
        "plannedEnd": "2026-11-20",
        "status": "planned"
      }
    ]
  },
  "content": {
    "units": {
      "u01": {
        "version": 1,
        "verified": false,
        "generatedBy": { "tool": "string", "at": "ISO8601" },
        "words": [],
        "phrases": [],
        "sentences": [],
        "grammarNotes": []
      }
    }
  },
  "progress": {
    "fsrs": {},
    "unitProgress": {},
    "xp": 0,
    "streak": { "days": 0, "lastStudyDate": null },
    "sessions": []
  }
}
```

## 3. 各セクションのフィールド表

### profile

| 名前           | 型     | 必須 | 既定値 | 説明                          |
| -------------- | ------ | ---- | ------ | ----------------------------- |
| uiLanguage     | string | ✅   | -      | UI言語コード (例: `ja`)       |
| nativeLanguage | string | ✅   | -      | 母語コード (例: `ja`)         |
| targetLanguage | string | ✅   | -      | 学習対象言語コード (例: `ms`) |
| goal           | Goal   | ✅   | -      | 学習目標                      |

### goal

| 名前             | 型           | 必須 | 既定値 | 説明                        |
| ---------------- | ------------ | ---- | ------ | --------------------------- |
| purposeTags      | string[]     | ✅   | -      | 目的タグ (例: `["travel"]`) |
| purposeText      | string       | ❌   | ""     | 自由入力の目的文            |
| targetLevel      | string       | ✅   | -      | 目標レベル (例: `"A2"`)     |
| deadline         | string(date) | ✅   | -      | 学習期限日付 (`YYYY-MM-DD`) |
| dailyMinutes     | number       | ✅   | -      | 1日の学習時間(分)           |
| studyDaysPerWeek | number       | ✅   | -      | 週間の学習日数              |

### plan.units

| 名前         | 型                                             | 必須 | 既定値 | 説明                       |
| ------------ | ---------------------------------------------- | ---- | ------ | -------------------------- |
| id           | string                                         | ✅   | -      | 単元ID (例: `u01`)         |
| title        | string                                         | ✅   | -      | 単元タイトル               |
| canDo        | string                                         | ✅   | -      | その単元でできることの説明 |
| scenario     | string                                         | ✅   | -      | 場面説明                   |
| keywords     | string[]                                       | ✅   | -      | キーワードリスト           |
| itemEstimate | number                                         | ✅   | -      | 項目数推定値               |
| optional     | boolean                                        | ✅   | false  | 任意単元か否か             |
| plannedStart | string(date)                                   | ❌   | null   | 計画開始日 (`YYYY-MM-DD`)  |
| plannedEnd   | string(date)                                   | ❌   | null   | 計画終了日 (`YYYY-MM-DD`)  |
| status       | "planned" \| "ready" \| "inProgress" \| "done" | ✅   | -      | 単元状態                   |

### content.units[unitId]

| 名前         | 型            | 必須 | 既定値 | 説明                       |
| ------------ | ------------- | ---- | ------ | -------------------------- |
| version      | number        | ✅   | -      | バージョン番号             |
| verified     | boolean       | ✅   | false  | 取り込み時に確認済みか否か |
| generatedBy  | GeneratedBy   | ✅   | -      | 生成元情報                 |
| words        | Word[]        | ❌   | []     | 単語リスト                 |
| phrases      | Phrase[]      | ❌   | []     | フレーズリスト             |
| sentences    | Sentence[]    | ❍    | []     | 例文リスト                 |
| grammarNotes | GrammarNote[] | ❌   | []     | 文法メモリスト             |

### GeneratedBy

| 名前 | 型               | 必須 | 既定値 | 説明                 |
| ---- | ---------------- | ---- | ------ | -------------------- |
| tool | string           | ✅   | -      | 使用ツール名         |
| at   | string(datetime) | ✅   | -      | 生成日時 (`ISO8601`) |

### words

| 名前      | 型         | 必須 | 既定値 | 説明                               |
| --------- | ---------- | ---- | ------ | ---------------------------------- |
| id        | string     | ✅   | -      | ID (例: `ms:makan`)                |
| lemma     | string     | ✅   | -      | 表記（小文字、スペースはハイフン） |
| pos       | string     | ✅   | -      | 品詞 (例: `"verb"`)                |
| reading   | string     | ❌   | ""     | 読み（例: `"マカン"`）             |
| meaning   | string[]   | ✅   | -      | 意味リスト（日本語）               |
| tags      | string[]   | ❌   | []     | タグリスト                         |
| rel       | Relation[] | ❌   | []     | 関係項目リスト                     |
| uncertain | boolean    | ❌   | false  | 確信がないか否か                   |
| note      | string     | ❌   | ""     | 備考                               |

### phrases

| 名前    | 型                   | 必須 | 既定値 | 説明                           |
| ------- | -------------------- | ---- | ------ | ------------------------------ |
| id      | string               | ✅   | -      | ID (例: `ph:suka-fruit`)       |
| target  | string               | ✅   | -      | テンプレート文（スロットあり） |
| meaning | string               | ✅   | -      | 意味（日本語）                 |
| slots   | { [slotName]: Slot } | ❌   | {}     | スロット定義                   |
| fixed   | boolean              | ❌   | false  | 固定フレーズか否か             |

### Slot

| 名前 | 型     | 必須 | 既定値 | 説明             |
| ---- | ------ | ---- | ------ | ---------------- |
| tag  | string | ✅   | -      | 対応する単語タグ |

### sentences

| 名前    | 型       | 必須 | 既定値 | 説明              |
| ------- | -------- | ---- | ------ | ----------------- |
| id      | string   | ✅   | -      | ID (例: `se:001`) |
| target  | string   | ✅   | -      | 外国語文          |
| meaning | string   | ✅   | -      | 意味（日本語）    |
| wordIds | string[] | ❌   | []     | 関連単語IDリスト  |

### grammarNotes

| 名前      | 型       | 必須 | 既定値 | 説明                    |
| --------- | -------- | ---- | ------ | ----------------------- |
| id        | string   | ✅   | -      | ID (例: `gn:me-prefix`) |
| appliesTo | string[] | ✅   | -      | 適用対象単語IDリスト    |
| title     | string   | ✅   | -      | メモタイトル            |
| hint      | string   | ✅   | -      | ヒント内容              |

### progress

| 名前         | 型        | 必須 | 既定値                               | 説明                           |
| ------------ | --------- | ---- | ------------------------------------ | ------------------------------ |
| fsrs         | object    | ✅   | {}                                   | FSRS状態（単語・フレーズごと） |
| unitProgress | object    | ✅   | {}                                   | 単元進捗状況                   |
| xp           | number    | ✅   | 0                                    | 総XP                           |
| streak       | Streak    | ✅   | { "days": 0, "lastStudyDate": null } | 連続日数情報                   |
| sessions     | Session[] | ✅   | []                                   | 学習セッション履歴             |

### Streak

| 名前          | 型                   | 必須 | 既定値 | 説明         |
| ------------- | -------------------- | ---- | ------ | ------------ |
| days          | number               | ✅   | -      | 連続日数     |
| lastStudyDate | string(date) \| null | ✅   | -      | 最終学習日付 |

### Session

| 名前      | 型               | 必須 | 既定値 | 説明           |
| --------- | ---------------- | ---- | ------ | -------------- |
| id        | string           | ✅   | -      | セッションID   |
| unitId    | string           | ✅   | -      | 単元ID         |
| stepId    | string           | ✅   | -      | ステップID     |
| startedAt | string(datetime) | ✅   | -      | 開始日時       |
| endedAt   | string(datetime) | ✅   | -      | 終了日時       |
| items     | object[]         | ✅   | []     | 出題項目リスト |

## 4. ID の規則

- 単語・フレーズ: `言語コード:lemmaを小文字にしてスペースを-に`。同形異義は `~2`, `~3` を付ける。
- 例文・文法メモ: 単元内で一意であればよい。
- 取り込み時に自動正規化される。

## 5. スロット付きフレーズ

- `{name}` 形式のスロットを持つ。
- `slots` でタグを定義し、そのタグにマッチする単語が候補となる。
- 差し込みは、対応する単語の `lemma` と `meaning[0]` を使用。

## 6. 取り込み用の封筒

### lang-study-skeleton

```json
{
  "format": "lang-study-skeleton",
  "version": 1,
  "units": [
    {
      "id": "u01",
      "title": "あいさつと自己紹介",
      "canDo": "名前と出身を伝えられる",
      "scenario": "初対面のあいさつ",
      "keywords": ["あいさつ", "名前", "出身"],
      "itemEstimate": 20,
      "optional": false
    }
  ]
}
```

### lang-study-unit

```json
{
  "format": "lang-study-unit",
  "version": 1,
  "unitId": "u01",
  "words": [],
  "phrases": [],
  "sentences": [],
  "grammarNotes": []
}
```

取り込み時に `UnitContent` へ包まれ、`verified:false`、`generatedBy` が付与される。

## 7. 取り込みの流れとエラー表示

1. コードフェンス除去 → JSON解析 → zod検証
2. ID正規化 → 参照確認 → 重複検出
3. プレビュー → 確定

- エラーはJSONパス(`words[3].rel[0].id`)と理由で表示。
- 部分成功なし。再取り込みでFSRSの履歴を保持。

## 8. 書き出し

### JSON

ファイル名: `kotoba-path-YYYY-MM-DD.json`

### CSV

列: `id,lemma,pos,reading,meaning,tags,rel`  
UTF-8 BOM付き、CRLF区切り。  
`meaning`/`tags` は `;` 連結、`rel` は `type:id` を `;` 連結。

ファイル名: `kotoba-path-words-YYYY-MM-DD.csv`

## 9. 読み込み(復元)

- 置き換えと統合のルール:
  - plan・content: 取り込み側を優先
  - FSRS: 新しい復習を優先
  - unitProgress: 和集合
  - xp: 大きいほう
  - sessions: 重複除去して上限200件

## 10. バージョンとマイグレーション

- `version` を確認し、古ければ順に変換。
- 新しすぎれば拒否。

## 11. JSON Schema の場所

`public/schema/study-data.schema.json`

`npm run gen:schema` で再生成可能。

## 12. 仕様(7章)からの変更点

- `plannedStart`/`plannedEnd` が省略可
- 封筒形式の追加 (`lang-study-skeleton`, `lang-study-unit`)
- `pos` は文字列（仕様書の列挙にしない）
