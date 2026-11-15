import { useEffect, useMemo, useState } from 'react'
import { getToday, getVirtualDate, setVirtualDate } from '../app/clock'
import { getAppStore } from '../db'
import { addDays, computeDailyNew, countStudyDays, remainingNewItems } from '../engine/pacing'
import type { UnitCountInfo } from '../engine/pacing'
import { StudyDataSchema } from '../schema'
import type { StudyData } from '../schema'
import { useAppState } from '../state/appState'
import '../styles/debug.css'

const FIXED_SEED_KEY = 'kp.fixedSeed'

function readFixedSeed(): string | null {
  try {
    return localStorage.getItem(FIXED_SEED_KEY)
  } catch {
    return null
  }
}

function writeFixedSeed(value: string): void {
  try {
    localStorage.setItem(FIXED_SEED_KEY, value)
  } catch {
    // 書き込み失敗は無視
  }
}

function removeFixedSeed(): void {
  try {
    localStorage.removeItem(FIXED_SEED_KEY)
  } catch {
    // 削除失敗は無視
  }
}

function buildUnitCountInfos(data: StudyData): UnitCountInfo[] {
  return data.plan.units.map((unit) => {
    const content = data.content.units[unit.id]
    return {
      id: unit.id,
      status: unit.status,
      itemEstimate: unit.itemEstimate,
      contentItemCount:
        content === undefined ? undefined : content.words.length + content.phrases.length,
      introducedCount: data.progress.unitProgress[unit.id]?.introducedItemIds.length ?? 0,
    }
  })
}

function getProgressWithoutFsrsAndSessions(data: StudyData): unknown {
  return Object.fromEntries(
    Object.entries(data.progress).filter(([key]) => key !== 'fsrs' && key !== 'sessions'),
  )
}

function getFirstEntries(record: Record<string, unknown>, count: number): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).slice(0, count))
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function DebugPage() {
  const { data, reload } = useAppState()
  const [virtualDate, setVirtualDateState] = useState<string | null>(() => getVirtualDate())
  const [today, setToday] = useState<string>(() => getToday())
  const [virtualDateInput, setVirtualDateInput] = useState<string>(() => getVirtualDate() ?? '')
  const [fixedSeed, setFixedSeedState] = useState<string | null>(() => readFixedSeed())
  const [fixedSeedInput, setFixedSeedInput] = useState<string>(() => readFixedSeed() ?? '')
  const [dummyStatus, setDummyStatus] = useState<string>('')
  const [resetStatus, setResetStatus] = useState<string>('')

  useEffect(() => {
    void reload()
  }, [reload])

  const schedule = useMemo(() => {
    if (data === null) {
      return null
    }

    const { deadline, studyDaysPerWeek, dailyMinutes } = data.profile.goal
    const todayValue = today
    const remainingStudyDays = countStudyDays(addDays(todayValue, 1), deadline, studyDaysPerWeek)
    const remainingNewItemsValue = remainingNewItems(buildUnitCountInfos(data))
    const dueReviewCount = Object.values(data.progress.fsrs).filter(
      (record) => record.due.slice(0, 10) <= today,
    ).length
    const dailyNew = computeDailyNew({
      remainingNewItems: remainingNewItemsValue,
      remainingStudyDays,
      dailyMinutes,
      dueReviewCount,
    })

    return {
      today: todayValue,
      deadline,
      studyDaysPerWeek,
      remainingStudyDays,
      remainingNewItems: remainingNewItemsValue,
      dailyNew,
    }
  }, [data, today])

  function handleSetVirtualDate() {
    setVirtualDate(virtualDateInput)
    setVirtualDateState(getVirtualDate())
    setToday(getToday())
  }

  function handleClearVirtualDate() {
    setVirtualDate(null)
    setVirtualDateInput('')
    setVirtualDateState(getVirtualDate())
    setToday(getToday())
  }

  function handleFixSeed() {
    writeFixedSeed(fixedSeedInput)
    setFixedSeedState(readFixedSeed())
  }

  function handleClearSeed() {
    removeFixedSeed()
    setFixedSeedInput('')
    setFixedSeedState(readFixedSeed())
  }

  async function handleLoadDummy() {
    if (
      window.confirm(
        'ダミーデータを読み込みます。現在のデータは置き換えられます。よろしいですか？',
      ) === false
    ) {
      setDummyStatus('キャンセルしました')
      return
    }

    try {
      const mod = await import('../../fixtures/dummy-full.json?raw')
      const raw = mod.default
      const parsed = JSON.parse(raw)
      const studyData = StudyDataSchema.parse(parsed)
      await getAppStore().saveStudyData(studyData)
      await useAppState.getState().reload()
      setDummyStatus('ダミーデータを読み込みました')
    } catch (error) {
      const reason = error instanceof Error ? error.message : '不明なエラー'
      setDummyStatus(`読み込みに失敗しました: ${reason}`)
    }
  }

  async function handleResetAll() {
    if (window.confirm('全データをリセットします。よろしいですか？') === false) {
      setResetStatus('キャンセルしました')
      return
    }

    try {
      await getAppStore().resetAll()
      await useAppState.getState().reload()
      setResetStatus('全データをリセットしました')
    } catch (error) {
      const reason = error instanceof Error ? error.message : '不明なエラー'
      setResetStatus(`リセットに失敗しました: ${reason}`)
    }
  }

  const profile = data?.profile
  const plan = data?.plan
  const fsrs = data?.progress.fsrs ?? {}
  const sessions = data?.progress.sessions ?? []

  return (
    <div className="page debug-page">
      <h1 className="page-title">デバッグ画面</h1>
      <p className="page-description">開発用の画面です。通常のナビゲーションには出ません。</p>

      <section className="debug-section" aria-labelledby="debug-virtual-date-heading">
        <h2 id="debug-virtual-date-heading" className="debug-heading">
          仮想日付
        </h2>
        <p className="debug-note">
          日程計算、FSRS、連続日数の検証に使うための仮想日付を設定します。
        </p>
        <p className="debug-current" aria-live="polite">
          現在の仮想日付: {virtualDate === null ? `なし(実際の今日: ${today})` : virtualDate}
        </p>
        <div className="debug-row">
          <label className="debug-field" htmlFor="debug-virtual-date-input">
            仮想日付
          </label>
          <input
            id="debug-virtual-date-input"
            className="debug-input"
            type="date"
            value={virtualDateInput}
            onChange={(event) => setVirtualDateInput(event.target.value)}
          />
          <button type="button" className="button" onClick={handleSetVirtualDate}>
            設定
          </button>
          <button type="button" className="button" onClick={handleClearVirtualDate}>
            解除
          </button>
        </div>
        <p className="debug-current" aria-live="polite">
          今日の表示: {today}
        </p>
      </section>

      <section className="debug-section" aria-labelledby="debug-fixed-seed-heading">
        <h2 id="debug-fixed-seed-heading" className="debug-heading">
          乱数シードの固定
        </h2>
        <p className="debug-current" aria-live="polite">
          現在の値: {fixedSeed === null ? '未設定' : fixedSeed}
        </p>
        <div className="debug-row">
          <label className="debug-field" htmlFor="debug-fixed-seed-input">
            乱数シード
          </label>
          <input
            id="debug-fixed-seed-input"
            className="debug-input"
            type="text"
            value={fixedSeedInput}
            onChange={(event) => setFixedSeedInput(event.target.value)}
          />
          <button type="button" className="button" onClick={handleFixSeed}>
            固定
          </button>
          <button type="button" className="button" onClick={handleClearSeed}>
            解除
          </button>
        </div>
      </section>

      <section className="debug-section" aria-labelledby="debug-dummy-heading">
        <h2 id="debug-dummy-heading" className="debug-heading">
          ダミーデータ
        </h2>
        <p className="debug-warning">内容の正確性は未検証の開発用ダミーです</p>
        <button type="button" className="button" onClick={() => void handleLoadDummy()}>
          ダミーデータを読み込む(置き換え)
        </button>
        <p className="debug-status" role="status">
          {dummyStatus}
        </p>
      </section>

      <section className="debug-section" aria-labelledby="debug-reset-heading">
        <h2 id="debug-reset-heading" className="debug-heading">
          全データのリセット
        </h2>
        <button
          type="button"
          className="button debug-button-danger"
          onClick={() => void handleResetAll()}
        >
          全データをリセット
        </button>
        <p className="debug-status" role="status">
          {resetStatus}
        </p>
      </section>

      <section className="debug-section" aria-labelledby="debug-inspector-heading">
        <h2 id="debug-inspector-heading" className="debug-heading">
          状態のインスペクタ
        </h2>
        {data === null ? (
          <p className="debug-empty">データがありません</p>
        ) : (
          <div className="debug-inspector">
            <details className="debug-details" open>
              <summary>profile</summary>
              <pre className="debug-pre" data-testid="debug-profile-json">
                {stableJson(profile)}
              </pre>
            </details>
            <details className="debug-details" open>
              <summary>plan</summary>
              <pre className="debug-pre">{stableJson(plan)}</pre>
            </details>
            <details className="debug-details" open>
              <summary>progress.fsrs(件数: {Object.keys(fsrs).length})</summary>
              <pre className="debug-pre">{stableJson(getFirstEntries(fsrs, 20))}</pre>
            </details>
            <details className="debug-details" open>
              <summary>progress.sessions(直近 10 件)</summary>
              <pre className="debug-pre">{stableJson(sessions.slice(-10))}</pre>
            </details>
            <details className="debug-details" open>
              <summary>progress(fsrs と sessions 以外)</summary>
              <pre className="debug-pre">{stableJson(getProgressWithoutFsrsAndSessions(data))}</pre>
            </details>
          </div>
        )}
      </section>

      <section className="debug-section" aria-labelledby="debug-schedule-heading">
        <h2 id="debug-schedule-heading" className="debug-heading">
          日程計算の入力と出力
        </h2>
        {schedule === null ? (
          <p className="debug-empty">データがありません</p>
        ) : (
          <table className="debug-table">
            <tbody>
              <tr>
                <th scope="row">今日</th>
                <td>{schedule.today}</td>
              </tr>
              <tr>
                <th scope="row">期限</th>
                <td>{schedule.deadline}</td>
              </tr>
              <tr>
                <th scope="row">週の学習日数</th>
                <td>{schedule.studyDaysPerWeek}</td>
              </tr>
              <tr>
                <th scope="row">残りの学習日数</th>
                <td>{schedule.remainingStudyDays}</td>
              </tr>
              <tr>
                <th scope="row">残りの新出項目数</th>
                <td>{schedule.remainingNewItems}</td>
              </tr>
              <tr>
                <th scope="row">needed</th>
                <td>{schedule.dailyNew.needed}</td>
              </tr>
              <tr>
                <th scope="row">cap</th>
                <td>{schedule.dailyNew.cap}</td>
              </tr>
              <tr>
                <th scope="row">dailyNew</th>
                <td>{schedule.dailyNew.dailyNew}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
