import { describe, it, expect } from 'vitest'
import { buildFixPrompt } from './index'
import type { FixPromptIssue } from './index'

const issues: FixPromptIssue[] = [
  { path: '/units/0/id', message: '必須項目がありません' },
  { path: '/units/1/title', message: '文字数が長すぎます' },
]
const originalText = '{"format":"unit","version":2,"units":[]}'

describe('buildFixPrompt', () => {
  it('各エラーのpathとmessageをそのまま含める', () => {
    const prompt = buildFixPrompt({ issues, originalText })
    for (const issue of issues) {
      expect(prompt, `入力: ${JSON.stringify(issue)}`).toContain(
        `- ${issue.path}: ${issue.message}`,
      )
    }
  })

  it('必須の見出しを含む', () => {
    const prompt = buildFixPrompt({ issues, originalText })
    for (const heading of [
      '# JSONの修正依頼',
      '【役割】',
      '【やること】',
      '【エラー一覧】',
      '【元のJSON】',
      '【自己チェック】',
    ]) {
      expect(prompt, `期待する見出し: ${heading}`).toContain(heading)
    }
  })

  it('35件のエラーは既定で先頭30件+「ほか 5 件」になる', () => {
    const manyIssues = Array.from({ length: 35 }, (_, i) => ({
      path: `/units/${i}/id`,
      message: '必須項目がありません',
    }))
    const prompt = buildFixPrompt({ issues: manyIssues, originalText })
    expect(prompt, `入力: ${JSON.stringify(manyIssues.slice(0, 2))}…`).toContain(
      '- /units/29/id: 必須項目がありません',
    )
    expect(prompt, '期待値: - ほか 5 件').toContain('- ほか 5 件')
    expect(prompt, `入力: ${JSON.stringify(manyIssues[30])}`).not.toContain('/units/30/id')
  })

  it('元のJSONが25000文字のときは先頭20000文字まで載る', () => {
    const longText = 'a'.repeat(20000) + 'B' + 'c'.repeat(4999)
    expect(longText.length, `入力: 長さ${longText.length}`).toBe(25000)
    const prompt = buildFixPrompt({ issues, originalText: longText })
    expect(prompt, `期待値: 先頭20000文字`).toContain('a'.repeat(20000))
    expect(prompt, '期待しない文言: B (20001文字目)').not.toContain('B')
    expect(prompt, '期待する注記').toContain('(長いため、先頭の20000文字のみ。残りは同じ構造です)')
  })

  it('issuesが空のときは「- (なし)」を含む', () => {
    const prompt = buildFixPrompt({ issues: [], originalText })
    expect(prompt, '入力: issues=[]').toContain('- (なし)')
  })

  it('originalTextが空のときは「(なし)」を含む', () => {
    const prompt = buildFixPrompt({ issues, originalText: '' })
    expect(prompt, '入力: originalText=""').toContain('(なし)')
  })

  it('同じ入力から同じ出力を返す(純粋関数)', () => {
    const input = { issues, originalText }
    expect(buildFixPrompt(input), `入力: ${JSON.stringify(input.issues)}`).toBe(
      buildFixPrompt(input),
    )
  })
})
