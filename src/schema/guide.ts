import { z } from 'zod'
import { APP_CONFIG } from '../config/app'
import { GeneratedBySchema } from './content'

const text = z.string().min(1)

/** 音(つづり)ごとの例。読みは、母語の読者向けの近似表記 */
export const GuideExampleSchema = z.object({
  target: text,
  reading: z.string().default(''),
  meaning: text,
})
/** 音・文字の説明。例: つづり "ng" の読み、発音のコツ、例 */
export const GuideSoundSchema = z.object({
  id: text,
  grapheme: text,
  reading: text,
  ipa: z.string().default(''),
  note: z.string().default(''),
  examples: z.array(GuideExampleSchema).default([]),
  /** 聞き間違えやすい、同じガイド内の音のID */
  confusableWith: z.array(text).default([]),
})
/** 読み方の規則。例: 語末の k の読み方 */
export const GuideRuleSchema = z.object({ id: text, title: text, body: text })

const guideFields = {
  intro: z.string().default(''),
  sounds: z.array(GuideSoundSchema).default([]),
  rules: z.array(GuideRuleSchema).default([]),
}

// 音のIDと規則のIDは重複せず、confusableWith は同じガイド内の音を指す。
function checkGuide(
  guide: { sounds: z.infer<typeof GuideSoundSchema>[]; rules: z.infer<typeof GuideRuleSchema>[] },
  ctx: z.RefinementCtx,
): void {
  const soundIds = new Set<string>()
  guide.sounds.forEach((sound, i) => {
    if (soundIds.has(sound.id)) {
      ctx.addIssue({ code: 'custom', path: ['sounds', i, 'id'], message: 'IDが重複しています' })
    }
    soundIds.add(sound.id)
  })
  guide.sounds.forEach((sound, i) => {
    sound.confusableWith.forEach((id, j) => {
      if (!soundIds.has(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sounds', i, 'confusableWith', j],
          message: `参照先の音 "${id}" がありません`,
        })
      }
    })
  })
  const ruleIds = new Set<string>()
  guide.rules.forEach((rule, i) => {
    if (ruleIds.has(rule.id)) {
      ctx.addIssue({ code: 'custom', path: ['rules', i, 'id'], message: 'IDが重複しています' })
    }
    ruleIds.add(rule.id)
  })
}

/** 保存する形。対象言語ごとに1つ(`content.guide`) */
export const GuideSchema = z
  .object({
    version: z.number().int().min(1).default(1),
    verified: z.boolean().default(false),
    generatedBy: GeneratedBySchema,
    ...guideFields,
  })
  .superRefine(checkGuide)

/** AI が出力する取り込み用の封筒 */
export const GuideEnvelopeSchema = z
  .object({
    format: z.literal(APP_CONFIG.guideFormat),
    version: z.number().int().min(1),
    ...guideFields,
  })
  .superRefine(checkGuide)

export type GuideExample = z.infer<typeof GuideExampleSchema>
export type GuideSound = z.infer<typeof GuideSoundSchema>
export type GuideRule = z.infer<typeof GuideRuleSchema>
export type Guide = z.infer<typeof GuideSchema>
export type GuideEnvelope = z.infer<typeof GuideEnvelopeSchema>
