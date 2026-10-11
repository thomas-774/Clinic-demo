import { nowLocal } from './clock'
import { SEED_VERSION, TABLES, buildSeed } from './seed'

/**
 * The demo's database: one JSON object in localStorage, with one array of
 * rows per table (same columns as the source app's MySQL tables). When
 * storage is blocked or full, the data lives in memory only.
 */
export const STORAGE_KEY = 'clinic-demo.db'
export const VERSION_KEY = 'clinic-demo.version'

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Blocked or full: keep going in memory.
    }
  },
}

let state = null

function readStored() {
  if (storage.get(VERSION_KEY) !== String(SEED_VERSION)) return null
  try {
    const parsed = JSON.parse(storage.get(STORAGE_KEY))
    return parsed && TABLES.every((table) => Array.isArray(parsed[table])) ? parsed : null
  } catch {
    return null
  }
}

/** The database: from memory, else from storage, else a fresh seed (also when the stored seed is older). */
export function load() {
  if (state) return state
  state = readStored()
  if (!state) reset()
  return state
}

/** Writes the database to storage (a no-op when storage is blocked). */
export function save() {
  if (!state) return
  storage.set(STORAGE_KEY, JSON.stringify(state))
  storage.set(VERSION_KEY, String(SEED_VERSION))
}

/** Replaces all data with a fresh seed. */
export function reset() {
  state = buildSeed()
  save()
  return state
}

/**
 * Runs `fn` like DB::transaction(): when it throws, every change it made is
 * undone; when it returns, the database is saved.
 */
export function transaction(fn) {
  const before = JSON.stringify(load())
  try {
    const result = fn()
    save()
    return result
  } catch (error) {
    state = JSON.parse(before)
    throw error
  }
}

/** Drops the in-memory copy, so the next load() reads storage again (tests). */
export function unload() {
  state = null
}

export function nextId(table) {
  const db = load()
  db.meta.ids[table] = (db.meta.ids[table] ?? 0) + 1
  return db.meta.ids[table]
}

export const all = (table) => load()[table]

const matches = (filter) => (typeof filter === 'function' ? filter : (row) => Object.entries(filter).every(([key, value]) => row[key] === value))

/** Rows that match a { column: value } object or a predicate. */
export const where = (table, filter) => all(table).filter(matches(filter))

export const first = (table, filter) => all(table).find(matches(filter)) ?? null

/** The row with this id ("5" and 5 both work, like a route parameter), or null. */
export function find(table, id) {
  const key = Number(id)
  return Number.isInteger(key) ? (all(table).find((row) => row.id === key) ?? null) : null
}

/** Adds a row with a new id and timestamps; returns it. */
export function insert(table, row) {
  const now = nowLocal()
  const record = { id: nextId(table), ...row, created_at: now, updated_at: now }
  all(table).push(record)
  return record
}

/** Changes a row in place; returns it, or null when there is no such row. */
export function update(table, id, changes) {
  const row = find(table, id)
  if (!row) return null
  Object.assign(row, changes, { updated_at: nowLocal() })
  return row
}

/** Deletes the rows that match (an id, or a filter); returns how many. */
export function remove(table, idOrFilter) {
  const db = load()
  const test = typeof idOrFilter === 'object' || typeof idOrFilter === 'function' ? matches(idOrFilter) : (row) => row.id === Number(idOrFilter)
  const before = db[table].length
  db[table] = db[table].filter((row) => !test(row))
  return before - db[table].length
}
