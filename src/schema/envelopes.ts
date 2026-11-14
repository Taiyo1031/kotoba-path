import { z } from 'zod'
import { APP_CONFIG } from '../config/app'
import { WordSchema, PhraseSchema, SentenceSchema, GrammarNoteSchema } from './content'
import { PlanUnitSchema } from './plan'

export const SkeletonEnvelopeSchema = z.object({
  format: z.literal(APP_CONFIG.skeletonFormat),
  version: z.number().int().min(1),
  units: z.array(PlanUnitSchema).min(1),
})
export const UnitEnvelopeSchema = z.object({
  format: z.literal(APP_CONFIG.unitFormat),
  version: z.number().int().min(1),
  unitId: z.string().min(1),
  words: z.array(WordSchema).default([]),
  phrases: z.array(PhraseSchema).default([]),
  sentences: z.array(SentenceSchema).default([]),
  grammarNotes: z.array(GrammarNoteSchema).default([]),
})
export type SkeletonEnvelope = z.infer<typeof SkeletonEnvelopeSchema>
export type UnitEnvelope = z.infer<typeof UnitEnvelopeSchema>
