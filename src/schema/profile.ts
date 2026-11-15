import { z } from 'zod'
import { CefrLevelSchema, IsoDateSchema } from './common'

export const UiLanguageSchema = z.enum(['ja', 'en'])
/** 自己申告の現在の習熟度(省略時は beginner として扱う) */
export const StartLevelSchema = z.enum(['beginner', 'basic', 'intermediate'])
export const GoalSchema = z.object({
  purposeTags: z.array(z.string().min(1)).default([]),
  purposeText: z.string().default(''),
  targetLevel: CefrLevelSchema,
  deadline: IsoDateSchema,
  dailyMinutes: z.number().int().min(1).max(600),
  studyDaysPerWeek: z.number().int().min(1).max(7).default(6),
  startLevel: StartLevelSchema.optional(),
})
export const ProfileSchema = z.object({
  uiLanguage: UiLanguageSchema,
  nativeLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  goal: GoalSchema,
})
export type UiLanguage = z.infer<typeof UiLanguageSchema>
export type StartLevel = z.infer<typeof StartLevelSchema>
export type Goal = z.infer<typeof GoalSchema>
export type Profile = z.infer<typeof ProfileSchema>
