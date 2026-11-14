import { describe, it, expect } from 'vitest'
import { stripCodeFence } from './fence'

describe('stripCodeFence', () => {
  it.each([
    ['```json\n{"a":1}\n```', '{"a":1}'],
    ['```\n{"a":1}\n```', '{"a":1}'],
    ['前置き\n```json\n{"a":1}\n```\n解説\n```\n{}\n```', '{"a":1}'],
    ['{"a":1}', '{"a":1}'],
    ['説明 {"a":1} 終了', '{"a":1}'],
    ['\uFEFF \n{"a":1}\n ', '{"a":1}'],
    ['', ''],
    [' 説明のみ ', '説明のみ'],
  ])('%j → %j', (input, expected) => {
    expect(stripCodeFence(input), `入力: ${input}`).toBe(expected)
  })
})
