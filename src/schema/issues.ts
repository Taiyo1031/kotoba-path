import type { z } from 'zod'

export interface ValidationIssue {
  path: string
  message: string
}

export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return (
    path.reduce<string>((result, key) => {
      if (typeof key === 'number') return `${result}[${key}]`
      return `${result}${result ? '.' : ''}${String(key)}`
    }, '') || '$'
  )
}

export function zodIssuesToValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => {
    let message = issue.message
    if (issue.code === 'invalid_type') {
      if (issue.message.includes('received undefined')) message = '必須項目がありません'
      else {
        const types: Record<string, string> = {
          string: '文字列',
          number: '数値',
          boolean: '真偽値',
          array: '配列',
          object: 'オブジェクト',
          int: '整数',
        }
        message = `${types[issue.expected] ?? issue.expected}である必要があります`
      }
    } else if (issue.code === 'invalid_value') {
      message = '許可されていない値です'
    }
    return { path: formatPath(issue.path), message }
  })
}
