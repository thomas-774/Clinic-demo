const toMinutes = (time) => {
  const [h, m] = String(time).split(':').map(Number)
  return h * 60 + m
}

const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * Slot start times ("HH:MM") that the given ranges and duration would produce —
 * the same loop as the server (§4.1 step 3), run for each range separately so
 * a slot never crosses a break. Bookings and blocks are not considered.
 *
 * previewSlots([{ start_time: '17:00', end_time: '21:00' }], 45)
 *   → ['17:00', '17:45', '18:30', '19:15', '20:00']
 */
export function previewSlots(ranges, duration) {
  const length = Number(duration)
  if (!Number.isInteger(length) || length < 1) return []

  return [...ranges]
    .filter((range) => /^\d{2}:\d{2}/.test(range.start_time ?? '') && /^\d{2}:\d{2}/.test(range.end_time ?? ''))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
    .flatMap((range) => {
      const starts = []
      const end = toMinutes(range.end_time)
      for (let cursor = toMinutes(range.start_time); cursor + length <= end; cursor += length) {
        starts.push(toTime(cursor))
      }
      return starts
    })
}
