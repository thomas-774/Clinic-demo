import dayjs from 'dayjs'

/**
 * Calendar maths on "YYYY-MM-DD" strings. These are plain dates (no time or
 * time zone), so adding days never shifts across midnight.
 */
const FORMAT = 'YYYY-MM-DD'

export function addDays(date, days) {
  return dayjs(date).add(days, 'day').format(FORMAT)
}

/** 0 = Sunday … 6 = Saturday, like working_hours.day_of_week. */
export function dayOfWeek(date) {
  return dayjs(date).day()
}

/** The Saturday on or before `date` (the clinic week starts on Saturday). */
export function weekStart(date) {
  return addDays(date, -((dayOfWeek(date) + 1) % 7))
}

/** First and last date of the month that contains `date`. */
export function monthRange(date) {
  const day = dayjs(date)
  return { from: day.startOf('month').format(FORMAT), to: day.endOf('month').format(FORMAT) }
}

/** `count` consecutive dates starting at `date`. */
export function dateRange(date, count) {
  return Array.from({ length: count }, (_, i) => addDays(date, i))
}

/** Whole years from `birthDate` to `onDate` (both "YYYY-MM-DD"); null without a birth date. */
export function ageOn(birthDate, onDate) {
  if (!birthDate) return null
  return dayjs(onDate).diff(dayjs(birthDate), 'year')
}
