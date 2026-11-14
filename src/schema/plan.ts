import { z } from 'zod'
import { IsoDateSchema } from './common'

export const PlanUnitStatusSchema = z.enum(['planned', 'ready', 'inProgress', 'done'])
export const PlanUnitSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1),
  canDo: z.string().min(1),
  scenario: z.string().default(''),
  keywords: z.array(z.string().min(1)).default([]),
  itemEstimate: z.number().int().min(0).default(20),
  optional: z.boolean().default(false),
  plannedStart: IsoDateSchema.optional(),
  plannedEnd: IsoDateSchema.optional(),
  status: PlanUnitStatusSchema.default('planned'),
})
export const PlanSchema = z.object({ units: z.array(PlanUnitSchema) }).superRefine((plan, ctx) => {
  const seen = new Set<string>()
  plan.units.forEach((unit, index) => {
    if (seen.has(unit.id))
      ctx.addIssue({
        code: 'custom',
        path: ['units', index, 'id'],
        message: '単元IDが重複しています',
      })
    seen.add(unit.id)
  })
})
export type PlanUnitStatus = z.infer<typeof PlanUnitStatusSchema>
export type PlanUnit = z.infer<typeof PlanUnitSchema>
export type Plan = z.infer<typeof PlanSchema>
