import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { SkeletonEnvelopeSchema, StudyDataSchema, UnitEnvelopeSchema } from '../src/schema'

const outputDirectory = new URL('../public/schema/', import.meta.url)
const schemas = [
  { name: 'study-data', title: 'StudyData', schema: StudyDataSchema },
  { name: 'skeleton', title: 'SkeletonEnvelope', schema: SkeletonEnvelopeSchema },
  { name: 'unit', title: 'UnitEnvelope', schema: UnitEnvelopeSchema },
]

mkdirSync(outputDirectory, { recursive: true })

for (const { name, title, schema } of schemas) {
  // 取り込み時の入力を表現し、既定値のある項目は省略可能にする。
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' })
  writeFileSync(
    new URL(`${name}.schema.json`, outputDirectory),
    `${JSON.stringify({ ...jsonSchema, title }, null, 2)}\n`,
    'utf8',
  )
}
