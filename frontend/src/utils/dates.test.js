import { addDays, ageOn, dateRange, dayOfWeek, weekStart } from './dates'

describe('date helpers', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-10-05', -1)).toBe('2026-10-04')
  })

  it('gives the weekday like working_hours (0 = Sunday)', () => {
    expect(dayOfWeek('2026-10-04')).toBe(0)
    expect(dayOfWeek('2026-10-10')).toBe(6)
  })

  it('starts the week on Saturday', () => {
    expect(weekStart('2026-10-10')).toBe('2026-10-10') // Saturday
    expect(weekStart('2026-10-05')).toBe('2026-10-03') // Monday
    expect(weekStart('2026-10-09')).toBe('2026-10-03') // Friday
  })

  it('lists consecutive dates', () => {
    expect(dateRange('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('counts whole years of age on a date', () => {
    expect(ageOn('1990-10-06', '2026-10-05')).toBe(35)
    expect(ageOn('1990-10-06', '2026-10-06')).toBe(36)
    expect(ageOn(null, '2026-10-06')).toBeNull()
  })
})
