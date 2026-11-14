import { z } from 'zod'
import { IsoDateTimeSchema } from './common'

const text = z.string().min(1)
export const WordRelTypeSchema = z.enum(['synonym', 'antonym', 'confusable', 'related'])
export const WordRelSchema = z.object({ type: WordRelTypeSchema, id: text })
export const WordSchema = z.object({
  id: text,
  lemma: text,
  pos: text,
  reading: z.string().default(''),
  meaning: z.array(text).min(1),
  tags: z.array(text).default([]),
  rel: z.array(WordRelSchema).default([]),
  uncertain: z.boolean().default(false),
  note: z.string().default(''),
})
export const PhraseSlotSchema = z.object({ tag: text })
export const PhraseSchema = z
  .object({
    id: text,
    target: text,
    meaning: text,
    slots: z.record(text, PhraseSlotSchema).default({}),
    fixed: z.boolean().default(false),
  })
  .superRefine((phrase, ctx) => {
    if (!phrase.fixed && Object.keys(phrase.slots).length === 0) {
      ctx.addIssue({ code: 'custom', path: ['slots'], message: 'スロットが1件以上必要です' })
    }
    for (const field of ['target', 'meaning'] as const) {
      for (const match of phrase[field].matchAll(/\{([^{}]+)\}/g)) {
        const name = match[1]
        if (name !== undefined && !Object.hasOwn(phrase.slots, name)) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `スロット "${name}" がありません`,
          })
        }
      }
    }
  })
export const SentenceSchema = z.object({
  id: text,
  target: text,
  meaning: text,
  wordIds: z.array(text).default([]),
})
export const GrammarNoteSchema = z.object({
  id: text,
  appliesTo: z.array(text).min(1),
  title: text,
  hint: text,
})
export const GeneratedBySchema = z.object({ tool: text, at: IsoDateTimeSchema })
export const UnitContentSchema = z.object({
  version: z.number().int().min(1).default(1),
  verified: z.boolean().default(false),
  generatedBy: GeneratedBySchema,
  words: z.array(WordSchema).default([]),
  phrases: z.array(PhraseSchema).default([]),
  sentences: z.array(SentenceSchema).default([]),
  grammarNotes: z.array(GrammarNoteSchema).default([]),
})
export type WordRelType = z.infer<typeof WordRelTypeSchema>
export type WordRel = z.infer<typeof WordRelSchema>
export type Word = z.infer<typeof WordSchema>
export type PhraseSlot = z.infer<typeof PhraseSlotSchema>
export type Phrase = z.infer<typeof PhraseSchema>
export type Sentence = z.infer<typeof SentenceSchema>
export type GrammarNote = z.infer<typeof GrammarNoteSchema>
export type GeneratedBy = z.infer<typeof GeneratedBySchema>
export type UnitContent = z.infer<typeof UnitContentSchema>
