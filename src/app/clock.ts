export const VIRTUAL_DATE_KEY = 'kp.virtualDate'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

// YYYY-MM-DD の実在する日付なら年月日を返す(ローカル基準)
function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (match === null) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return { year, month, day }
}

export function getVirtualDate(): string | null {
  try {
    const raw = localStorage.getItem(VIRTUAL_DATE_KEY)
    if (raw === null) {
      return null
    }
    return parseIsoDate(raw) !== null ? raw : null
  } catch {
    return null
  }
}

export function setVirtualDate(iso: string | null): void {
  try {
    if (iso === null) {
      localStorage.removeItem(VIRTUAL_DATE_KEY)
      return
    }
    if (parseIsoDate(iso) === null) {
      return
    }
    localStorage.setItem(VIRTUAL_DATE_KEY, iso)
  } catch {
    // 書き込みの失敗は無視
  }
}

export function getNow(base?: Date): Date {
  const now = base ?? new Date()
  const virtual = getVirtualDate()
  if (virtual === null) {
    return now
  }
  const parts = parseIsoDate(virtual)
  if (parts === null) {
    return now
  }
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  )
}

export function getToday(base?: Date): string {
  return toIsoDate(getNow(base))
}
