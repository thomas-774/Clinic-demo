import { previewSlots } from './previewSlots'

const evening = [{ start_time: '17:00', end_time: '21:00' }]

describe('previewSlots (§4.1 worked examples)', () => {
  it('makes five 45-minute slots and drops 20:45', () => {
    expect(previewSlots(evening, 45)).toEqual(['17:00', '17:45', '18:30', '19:15', '20:00'])
  })

  it('makes four 60-minute slots', () => {
    expect(previewSlots(evening, 60)).toEqual(['17:00', '18:00', '19:00', '20:00'])
  })

  it('makes eight 30-minute slots from 17:00 to 20:30', () => {
    const slots = previewSlots(evening, 30)
    expect(slots).toHaveLength(8)
    expect(slots[0]).toBe('17:00')
    expect(slots.at(-1)).toBe('20:30')
  })

  it('restarts after a break and never crosses it', () => {
    const day = [
      { start_time: '17:00', end_time: '21:00' },
      { start_time: '10:00', end_time: '13:00' },
    ]
    expect(previewSlots(day, 60)).toEqual(['10:00', '11:00', '12:00', '17:00', '18:00', '19:00', '20:00'])
  })

  it('drops the slot that would run into the break at 45 minutes', () => {
    const day = [
      { start_time: '10:00', end_time: '12:30' },
      { start_time: '17:00', end_time: '21:00' },
    ]
    expect(previewSlots(day, 45)).toEqual(['10:00', '10:45', '11:30', '17:00', '17:45', '18:30', '19:15', '20:00'])
  })

  it('accepts the API "HH:MM:SS" format and duration as a string', () => {
    expect(previewSlots([{ start_time: '17:00:00', end_time: '19:00:00' }], '60')).toEqual(['17:00', '18:00'])
  })

  it('returns nothing for a day off, a bad duration or an unfinished range', () => {
    expect(previewSlots([], 45)).toEqual([])
    expect(previewSlots(evening, 0)).toEqual([])
    expect(previewSlots(evening, '')).toEqual([])
    expect(previewSlots(evening, 12.5)).toEqual([])
    expect(previewSlots([{ start_time: '', end_time: '21:00' }], 45)).toEqual([])
    expect(previewSlots([{ start_time: '21:00', end_time: '17:00' }], 45)).toEqual([])
  })
})
