import { selfCheck } from './shared'

export interface FixPromptIssue {
  path: string
  message: string
}

export interface FixPromptInput {
  issues: FixPromptIssue[]
  originalText: string
  /** 一覧に載せるエラーの最大数。既定 30 */
  maxIssues?: number
  /** 元の文章を載せる最大の文字数。既定 20000 */
  maxOriginalChars?: number
}

const DEFAULT_MAX_ISSUES = 30
const DEFAULT_MAX_ORIGINAL_CHARS = 20000

function issueLines(issues: FixPromptIssue[], maxIssues: number): string {
  if (issues.length === 0) {
    return '- (なし)'
  }
  const shown = issues.slice(0, maxIssues)
  const lines = shown.map((issue) => `- ${issue.path}: ${issue.message}`)
  const restCount = issues.length - shown.length
  if (restCount > 0) {
    lines.push(`- ほか ${restCount} 件`)
  }
  return lines.join('\n')
}

function originalSection(originalText: string, maxChars: number): string {
  if (originalText === '') {
    return '(なし)'
  }
  const lines = [originalText.slice(0, maxChars)]
  if (originalText.length > maxChars) {
    lines.push(`(長いため、先頭の${maxChars}文字のみ。残りは同じ構造です)`)
  }
  return lines.join('\n')
}

export function buildFixPrompt(input: FixPromptInput): string {
  const maxIssues = input.maxIssues ?? DEFAULT_MAX_ISSUES
  const maxOriginalChars = input.maxOriginalChars ?? DEFAULT_MAX_ORIGINAL_CHARS
  return [
    '# JSONの修正依頼',
    '【役割】\nあなたは語学教材の作成者です。以前の出力に、取り込みエラーがありました。',
    `【やること】
下の「エラー一覧」の箇所を直し、**同じ種類の誤りが他にもないか確認して、まとめて直す**。
出力は、**修正した全体のJSONのみ**(前置き・解説は書かない。コードフェンスは付けてよい)。
元の内容(正しい部分)は変えない。`,
    `【エラー一覧】\n${issueLines(input.issues, maxIssues)}`,
    '【元のJSON】',
    '```json',
    originalSection(input.originalText, maxOriginalChars),
    '```',
    selfCheck,
  ].join('\n\n')
}
