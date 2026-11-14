export function stripCodeFence(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  const block = /```(?:json)?[ \t]*\r?\n([\s\S]*?)```/i.exec(trimmed)
  if (block) return (block[1] ?? '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed
}
