import { z } from 'zod'
import { APP_CONFIG } from '../config/app'
import { IsoDateTimeSchema } from './common'
import { UnitContentSchema } from './content'
import { GuideSchema } from './guide'
import { PlanSchema } from './plan'
import { ProfileSchema } from './profile'
import { ProgressSchema } from './progress'

export const MetaSchema = z.object({ exportedAt: IsoDateTimeSchema, appVersion: z.string().min(1) })
export const StudyDataSchema = z.object({
  format: z.literal(APP_CONFIG.dataFormat),
  version: z.number().int().min(1),
  meta: MetaSchema,
  profile: ProfileSchema,
  plan: PlanSchema,
  content: z
    .object({
      units: z.record(z.string().min(1), UnitContentSchema),
      /** 文字と発音のガイド(任意。対象言語ごとに1つ) */
      guide: GuideSchema.optional(),
    })
    .default({ units: {} }),
  progress: ProgressSchema,
})
export type Meta = z.infer<typeof MetaSchema>
export type StudyData = z.infer<typeof StudyDataSchema>
