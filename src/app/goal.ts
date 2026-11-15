import { defaultDeadline } from './survey'
import { addDays, dayNumber } from '../engine/pacing'

export const RELATIVE_MONTH_OPTIONS: readonly number[] = [1, 2, 3, 4, 6, 9, 12]

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    return 0
  }
  const DAYS_IN_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const base = DAYS_IN_MONTHS[month - 1] ?? 30
  if (month === 2 && isLeapYear(year)) {
    return 29
  }
  return base
}

function isValidDate(iso: string): boolean {
  if (!DATE_PATTERN.test(iso)) {
    return false
  }
  const [year = 0, month = 0, day = 0] = iso.split('-').map(Number)
  if (month < 1 || month > 12) {
    return false
  }
  const lastDay = daysInMonth(year, month)
  return day >= 1 && day <= lastDay
}

export function deadlineFromMonths(today: string, months: number): string {
  return defaultDeadline(today, months)
}

export function daysLeft(today: string, deadline: string): number {
  return dayNumber(deadline) - dayNumber(today)
}

export function monthsLeft(today: string, deadline: string): number {
  const left = daysLeft(today, deadline)
  return Math.max(0, Math.round(left / 30.4))
}

export type DeadlineCheck = 'ok' | 'invalid' | 'notFuture'

export function checkDeadline(deadline: string, today: string): DeadlineCheck {
  if (!isValidDate(deadline)) {
    return 'invalid'
  }
  if (dayNumber(deadline) <= dayNumber(today)) {
    return 'notFuture'
  }
  return 'ok'
}

export function nextDay(today: string): string {
  return addDays(today, 1)
}
