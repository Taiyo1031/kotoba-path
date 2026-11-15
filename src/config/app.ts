// アプリ全体の設定。名前やバージョンなどは、ここ1か所で変更する。
export const APP_CONFIG = {
  /** アプリ名(仮)。画面とエクスポートのファイル名に使う */
  name: 'Kotoba Path',
  /** ファイル名用の短い名前(英数字とハイフンのみ) */
  fileSlug: 'kotoba-path',
  appVersion: '0.1.0',
  /** データ形式の識別子と版(仕様7章)。版を上げるときは migrate に関数を足す */
  dataFormat: 'lang-study-data',
  dataVersion: 1,
  /** 取り込み用の封筒(AIが出力するJSON)の識別子 */
  skeletonFormat: 'lang-study-skeleton',
  unitFormat: 'lang-study-unit',
  importEnvelopeVersion: 1,
  /** IndexedDB のデータベース名 */
  dbName: 'kotoba-path',
  /** 学習履歴(sessions)の保持件数。超えたら古い順に畳む */
  sessionsMax: 200,
  /** この日数以上バックアップがなければ、目立つ案内を出す */
  backupWarnDays: 7,
  /** プロンプトの版。文面を変えたら上げる */
  promptVersion: 2,
} as const
