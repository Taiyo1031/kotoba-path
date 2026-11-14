import { z } from 'zod'
import { IsoDateSchema, IsoDateTimeSchema } from './common'

const count = z.number().int().min(0)
const ids = z.array(z.string().min(1))
export const FsrsRecordSchema = z.object({
  due: IsoDateTimeSchema,
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  elapsedDays: count,
  scheduledDays: count,
  reps: count,
  lapses: count,
  state: z.number().int().min(0).max(3),
  lastReview: IsoDateTimeSchema.optional(),
})
export const UnitProgressSchema = z.object({
  introducedItemIds: ids.default([]),
  completedStepIds: ids.default([]),
  wrongItemIds: ids.default([]),
  startedAt: IsoDateTimeSchema.optional(),
  completedAt: IsoDateTimeSchema.optional(),
})
export const StreakSchema = z.object({
  days: count.default(0),
  lastStudyDate: IsoDateSchema.nullable().default(null),
})
export const SessionLogSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['lesson', 'review']),
  unitId: z.string().min(1).optional(),
  stepId: z.string().min(1).optional(),
  seed: z.number().int(),
  startedAt: IsoDateTimeSchema,
  endedAt: IsoDateTimeSchema.optional(),
  answered: count,
  correct: count,
  xpGained: count,
})
export const ProgressSchema = z.object({
  fsrs: z.record(z.string().min(1), FsrsRecordSchema).default({}),
  unitProgress: z.record(z.string().min(1), UnitProgressSchema).default({}),
  xp: count.default(0),
  streak: StreakSchema.default({ days: 0, lastStudyDate: null }),
  sessions: z.array(SessionLogSchema).default([]),
})
export type FsrsRecord = z.infer<typeof FsrsRecordSchema>
export type UnitProgress = z.infer<typeof UnitProgressSchema>
export type Streak = z.infer<typeof StreakSchema>
export type SessionLog = z.infer<typeof SessionLogSchema>
export type Progress = z.infer<typeof ProgressSchema>
