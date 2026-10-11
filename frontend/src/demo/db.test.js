import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, addMinutes, dayOfWeek, fromLocal, parseToLocal, subMonths, toIso, toLocal } from './clock'
import * as db from './db'
import { DEMO_ACCOUNTS, SEED_VERSION, TABLES, buildSeed } from './seed'

// Monday 12 Oct 2026, 10:00 in Cairo (EEST, +03:00).
const MONDAY_MORNING = Date.parse('2026-10-12T10:00:00+03:00')

describe('clock', () => {
  it('converts between Cairo wall-clock time and instants, in summer and winter time', () => {
    expect(toLocal(Date.parse('2026-10-12T07:00:00Z'))).toBe('2026-10-12 10:00:00')
    expect(toIso('2026-10-12 17:00:00')).toBe('2026-10-12T17:00:00+03:00')
    expect(toIso('2026-12-01 17:00:00')).toBe('2026-12-01T17:00:00+02:00')
    expect(fromLocal('2026-12-01 17:00:00')).toBe(Date.parse('2026-12-01T15:00:00Z'))
    expect(parseToLocal('2026-12-01T15:00:00Z')).toBe('2026-12-01 17:00:00')
    expect(parseToLocal('2026-12-01T17:00')).toBe('2026-12-01 17:00:00')
    expect(parseToLocal('nonsense')).toBeNull()
  })

  it('does day maths on date strings', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(subMonths('2026-03-31', 1)).toBe('2026-02-28')
    expect(dayOfWeek('2026-10-16')).toBe(5) // a Friday
    expect(addMinutes('2026-10-12 20:30:00', 45)).toBe('2026-10-12 21:15:00')
  })
})

describe('seed', () => {
  it('is the same every time for the same moment', () => {
    expect(JSON.stringify(buildSeed(MONDAY_MORNING))).toBe(JSON.stringify(buildSeed(MONDAY_MORNING)))
  })

  it('has every table, the three demo accounts and 30 patients', () => {
    const seed = buildSeed(MONDAY_MORNING)
    for (const table of TABLES) expect(Array.isArray(seed[table])).toBe(true)
    for (const [role, phone] of Object.entries(DEMO_ACCOUNTS)) {
      expect(seed.users.find((u) => u.phone === phone)?.role).toBe(role)
    }
    expect(seed.patients).toHaveLength(30)
    expect(seed.drugs.length).toBeGreaterThan(100)
    expect(seed.meta.ids.users).toBe(seed.users.length)
  })

  it('fills the past month and the coming week around today, never on a Friday', () => {
    const seed = buildSeed(MONDAY_MORNING)
    const dates = seed.appointments.map((a) => a.start_at.slice(0, 10))
    expect(dates.some((d) => d < '2026-10-01')).toBe(true)
    expect(dates.some((d) => d > '2026-10-12')).toBe(true)
    expect(dates.every((d) => d >= '2026-09-12' && d <= '2026-10-19')).toBe(true)
    expect(dates.every((d) => dayOfWeek(d) !== 5)).toBe(true)
    expect(new Set(seed.appointments.map((a) => a.status))).toEqual(new Set(['completed', 'cancelled', 'no_show', 'booked']))
    // Today's evening is still ahead at 10:00, so it holds bookings only.
    expect(seed.appointments.filter((a) => a.start_at.startsWith('2026-10-12')).every((a) => a.status === 'booked')).toBe(true)
  })

  it('keeps one active booking per patient, and none for the demo patient', () => {
    const seed = buildSeed(MONDAY_MORNING)
    const booked = seed.appointments.filter((a) => a.status === 'booked').map((a) => a.patient_id)
    expect(new Set(booked).size).toBe(booked.length)
    expect(booked).not.toContain(1)
  })

  it('has paid, part-paid and later-installment visits, never overpaid', () => {
    const seed = buildSeed(MONDAY_MORNING)
    const piastres = (amount) => Math.round(Number(amount) * 100)
    let paid = 0
    let partial = 0
    for (const visit of seed.visits) {
      const payments = seed.payments.filter((p) => p.visit_id === visit.id)
      const sum = payments.reduce((total, p) => total + piastres(p.amount), 0)
      expect(sum).toBeLessThanOrEqual(piastres(visit.total_amount))
      if (sum === piastres(visit.total_amount)) paid++
      else partial++
      // Installments are in the past.
      for (const p of payments) expect(p.paid_at < '2026-10-12 10:00:00').toBe(true)
    }
    expect(paid).toBeGreaterThan(0)
    expect(partial).toBeGreaterThan(0)
    expect(seed.visits.some((v) => seed.payments.filter((p) => p.visit_id === v.id).length > 1)).toBe(true)
    expect(seed.visits.some((v) => v.appointment_id === null)).toBe(true) // walk-ins
  })

  it('gives prescriptions with catalogue and free-text lines', () => {
    const seed = buildSeed(MONDAY_MORNING)
    const first = seed.prescription_items.filter((i) => i.prescription_id === 1)
    expect(first.map((i) => i.drug_name)).toEqual(['Augmentin 1 g', 'Brufen 400 mg', 'Panadol Extra'])
    expect(first[2].drug_id).toBeNull()
  })
})

describe('db', () => {
  beforeEach(() => {
    localStorage.clear()
    db.unload()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.unload()
  })

  it('seeds on first load and keeps the data in localStorage', () => {
    const data = db.load()
    expect(data.users.length).toBeGreaterThan(30)
    expect(localStorage.getItem(db.VERSION_KEY)).toBe(String(SEED_VERSION))
    db.unload()
    expect(db.load().meta.seeded_at).toBe(data.meta.seeded_at)
  })

  it('inserts, finds, updates and removes rows', () => {
    db.load()
    const row = db.insert('blocked_times', { doctor_id: 1, date: '2026-10-20', start_time: null, end_time: null, reason: 'Trip' })
    expect(row.id).toBe(1)
    expect(db.insert('blocked_times', { doctor_id: 1, date: '2026-10-21' }).id).toBe(2)
    expect(db.find('blocked_times', '1')).toBe(row)
    expect(db.where('blocked_times', { date: '2026-10-21' })).toHaveLength(1)
    expect(db.update('blocked_times', 1, { reason: 'Conference' }).reason).toBe('Conference')
    expect(db.update('blocked_times', 99, {})).toBeNull()
    expect(db.remove('blocked_times', 1)).toBe(1)
    expect(db.find('blocked_times', 1)).toBeNull()
    // Ids are never reused.
    expect(db.insert('blocked_times', { doctor_id: 1, date: '2026-10-22' }).id).toBe(3)
  })

  it('saves changes and reset() brings back the seed', () => {
    db.load()
    db.update('users', 1, { name: 'Changed' })
    db.save()
    db.unload()
    expect(db.find('users', 1).name).toBe('Changed')
    db.reset()
    expect(db.find('users', 1).name).toBe('Dr. Doctor')
    db.unload()
    expect(db.find('users', 1).name).toBe('Dr. Doctor')
  })

  it('re-seeds when the stored version is older or the data is broken', () => {
    db.load()
    db.update('users', 1, { name: 'Changed' })
    db.save()
    localStorage.setItem(db.VERSION_KEY, String(SEED_VERSION - 1))
    db.unload()
    expect(db.find('users', 1).name).toBe('Dr. Doctor')

    localStorage.setItem(db.STORAGE_KEY, '{not json')
    db.unload()
    expect(db.load().users.length).toBeGreaterThan(30)
  })

  it('keeps working in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => db.load()).not.toThrow()
    db.update('users', 1, { name: 'In memory' })
    expect(() => db.save()).not.toThrow()
    expect(db.find('users', 1).name).toBe('In memory')
  })
})
