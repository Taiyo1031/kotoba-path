import { describe, it, expect } from 'vitest'
import { StudyDataSchema } from '../schema'
import type { StudyData } from '../schema'
import { nextPromptAction } from './promptFlow'
import type { PromptAction } from './promptFlow'

const NOW = '2026-01-12T12:00:00.000Z'

type UnitSeed = {
  id: string
  title: string
  canDo: 'greet'
  itemEstimate: number
  optional?: boolean
}

function makeData(unitCount: number, contentUnits: Record<string, unknown> = {}): StudyData {
  const units: UnitSeed[] = Array.from({ length: unitCount }, (_, index) => ({
    id: `u${index + 1}`,
    title: `Unit ${index + 1}`,
    canDo: 'greet',
    itemEstimate: 10,
    ...(index === 2 ? { optional: true } : {}),
  }))

  return StudyDataSchema.parse({
    format: 'lang-study-data',
    version: 1,
    meta: { exportedAt: NOW, appVersion: '0.1.0' },
    profile: {
      uiLanguage: 'ja',
      nativeLanguage: 'ja',
      targetLanguage: 'en',
      goal: {
        dailyMinutes: 30,
        studyDaysPerWeek: 7,
        targetLevel: 'A1',
        deadline: '2026-01-19',
      },
    },
    plan: { units },
    content: { units: contentUnits },
    progress: {
      unitProgress: {},
      fsrs: {},
      streak: { days: 0, lastStudyDate: '2026-01-11' },
      xp: 0,
    },
  })
}

function check(input: unknown, expected: PromptAction, actual: PromptAction): void {
  expect(
    actual,
    `入力: ${JSON.stringify(input)} 期待値: ${JSON.stringify(expected)} 実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

const contentUnit = () => ({ generatedBy: { tool: 'test', at: NOW } })

describe('nextPromptAction', () => {
  it('returns skeleton when data is null', () => {
    check(null, { kind: 'skeleton' }, nextPromptAction(null))
  })

  it('returns skeleton when there are no units', () => {
    const data = makeData(0)
    check(data, { kind: 'skeleton' }, nextPromptAction(data))
  })

  it('returns the first unit when none have content', () => {
    const data = makeData(3)
    check(
      data,
      { kind: 'unit', unitId: 'u1', title: 'Unit 1', prepared: 0, total: 3 },
      nextPromptAction(data),
    )
  })

  it('returns the second unit when only the first has content', () => {
    const data = makeData(3, { u1: contentUnit() })
    check(
      data,
      { kind: 'unit', unitId: 'u2', title: 'Unit 2', prepared: 1, total: 3 },
      nextPromptAction(data),
    )
  })

  it('prefers the first missing unit and counts all prepared units', () => {
    const data = makeData(3, { u1: contentUnit(), u3: contentUnit() })
    check(
      data,
      { kind: 'unit', unitId: 'u2', title: 'Unit 2', prepared: 2, total: 3 },
      nextPromptAction(data),
    )
  })

  it('returns done when every unit has content', () => {
    const data = makeData(3, { u1: contentUnit(), u2: contentUnit(), u3: contentUnit() })
    check(data, { kind: 'done', prepared: 3, total: 3 }, nextPromptAction(data))
  })

  it('handles optional units correctly', () => {
    const data = makeData(3, { u1: contentUnit(), u2: contentUnit() })
    // The third unit is optional and should be treated like any other
    check(
      data,
      { kind: 'unit', unitId: 'u3', title: 'Unit 3', prepared: 2, total: 3 },
      nextPromptAction(data),
    )
  })

  it('handles the case where all units are optional and none have content', () => {
    const data = makeData(3, {})
    check(
      data,
      { kind: 'unit', unitId: 'u1', title: 'Unit 1', prepared: 0, total: 3 },
      nextPromptAction(data),
    )
  })
})
