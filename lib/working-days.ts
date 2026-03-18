import { createAdminClient } from '@/lib/supabase/server'

/**
 * Fetches public holiday dates for a date range.
 * Returns a Set of ISO date strings ('YYYY-MM-DD').
 */
export async function fetchHolidays(
  from: Date,
  to: Date,
  country = 'NG',
): Promise<Set<string>> {
  const supabase = createAdminClient()

  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]

  const { data } = await supabase
    .from('public_holidays')
    .select('date')
    .eq('country', country)
    .gte('date', fromStr)
    .lte('date', toStr)

  const set = new Set<string>()
  for (const row of data ?? []) {
    set.add((row as { date: string }).date)
  }
  return set
}

/**
 * Returns true if the date is a working day
 * (Monday–Friday, not a public holiday).
 */
function isWorkingDay(date: Date, holidays: Set<string>): boolean {
  const dow = date.getUTCDay() // 0 = Sun, 6 = Sat
  if (dow === 0 || dow === 6) return false
  return !holidays.has(date.toISOString().split('T')[0])
}

/**
 * Count working days strictly after `from` up to and including `to`.
 *
 * Example: proforma sent on Monday, today is Wednesday → 2 working days elapsed.
 */
export function countWorkingDays(
  from: Date,
  to: Date,
  holidays: Set<string>,
): number {
  // Normalise to midnight UTC
  const start = new Date(from)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() + 1) // Start counting from NEXT day

  const end = new Date(to)
  end.setUTCHours(0, 0, 0, 0)

  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    if (isWorkingDay(cur, holidays)) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

/**
 * Count calendar days from `from` to `to` (exclusive of from, inclusive of to).
 *
 * Example: from = Jan 1, to = Jan 8 → 7 days.
 */
export function countCalendarDays(from: Date, to: Date): number {
  const a = new Date(from); a.setUTCHours(0, 0, 0, 0)
  const b = new Date(to);   b.setUTCHours(0, 0, 0, 0)
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
