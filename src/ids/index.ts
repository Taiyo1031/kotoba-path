export function slugify(text: string): string {
  return text.normalize('NFC').trim().toLowerCase().replace(/\s+/gu, '-').replace(/[~:]/g, '')
}

export function makeWordId(language: string, lemma: string, homographIndex?: number): string {
  const suffix = homographIndex !== undefined && homographIndex >= 2 ? `~${homographIndex}` : ''
  return `${language.toLowerCase()}:${slugify(lemma)}${suffix}`
}

export function makePhraseId(slug: string): string {
  return `ph:${slugify(slug)}`
}

function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug === slug.toLowerCase() && !/[\s:~]/u.test(slug)
}

export interface ParsedWordId {
  language: string
  slug: string
  homographIndex: number
}

export function parseWordId(id: string): ParsedWordId | null {
  const prefix = /^[a-z]{2,3}:/.exec(id)?.[0]
  if (prefix === undefined) return null

  const language = prefix.slice(0, -1)
  const rest = id.slice(prefix.length)
  const suffixIndex = rest.indexOf('~')
  const slug = suffixIndex === -1 ? rest : rest.slice(0, suffixIndex)
  if (!isValidSlug(slug)) return null

  let homographIndex = 1
  if (suffixIndex !== -1) {
    const suffix = rest.slice(suffixIndex + 1)
    if (!suffix || /[^0-9]/u.test(suffix)) return null
    homographIndex = Number(suffix)
    if (!Number.isSafeInteger(homographIndex) || homographIndex < 2) return null
  }

  return { language, slug, homographIndex }
}

export function isValidWordId(id: string, language?: string): boolean {
  const parsed = parseWordId(id)
  return parsed !== null && (language === undefined || language === parsed.language)
}

export function isValidPhraseId(id: string): boolean {
  return id.startsWith('ph:') && isValidSlug(id.slice(3))
}

export function normalizeWordId(
  raw: string,
  options: { language: string; lemma?: string },
): string {
  let rest = raw.trim()
  if (!rest) {
    if (options.lemma?.trim()) return makeWordId(options.language, options.lemma)
    throw new Error('Either raw or lemma must be provided')
  }

  // 有効な同形異義の接尾辞だけを、スラッグ化の前に退避する。
  const suffixMatch = /~([0-9]+)$/.exec(rest)
  let suffix = ''
  if (suffixMatch && Number(suffixMatch[1]) >= 2) {
    suffix = suffixMatch[0]
    rest = rest.slice(0, -suffix.length)
  }

  const colonIndex = rest.indexOf(':')
  const language = colonIndex === -1 ? options.language : rest.slice(0, colonIndex)
  const slug = colonIndex === -1 ? rest : rest.slice(colonIndex + 1)
  return `${language.toLowerCase()}:${slugify(slug)}${suffix}`
}

export function normalizePhraseId(raw: string): string {
  const trimmed = raw.trim()
  return makePhraseId(trimmed.startsWith('ph:') ? trimmed.slice(3) : trimmed)
}

export interface IdChange {
  index: number
  from: string
  to: string
}

export function buildWordIdRewrites(
  entries: ReadonlyArray<{ id: string; lemma: string }>,
  language: string,
): { ids: string[]; changes: IdChange[] } {
  const usedIds = new Set<string>()
  const ids: string[] = []
  const changes: IdChange[] = []

  entries.forEach((entry, index) => {
    let id = normalizeWordId(entry.id, { language, lemma: entry.lemma })
    if (usedIds.has(id)) {
      const base = id.replace(/~[0-9]+$/, '')
      let homographIndex = 2
      while (usedIds.has(`${base}~${homographIndex}`)) homographIndex++
      id = `${base}~${homographIndex}`
    }

    ids.push(id)
    usedIds.add(id)
    if (entry.id !== id) changes.push({ index, from: entry.id, to: id })
  })

  return { ids, changes }
}
