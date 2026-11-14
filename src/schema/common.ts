import { z } from 'zod'

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  }, '実在する日付を指定してください')
export const IsoDateTimeSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value) &&
      Number.isFinite(Date.parse(value)),
    'ISO 8601形式の日時を指定してください',
  )
export const CefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
export type IsoDate = z.infer<typeof IsoDateSchema>
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>
export type CefrLevel = z.infer<typeof CefrLevelSchema>
