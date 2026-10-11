import { nowLocal, parseToLocal, today } from './clock'
import * as db from './db'
import { invalid } from './http'
import { group, translate } from './lang'

/**
 * A small port of Laravel's validator, for the rules the source app's
 * FormRequests use. Messages come from backend/lang (validation.php), in the
 * request's language, and failures throw the same 422 as Laravel.
 *
 * Rules are Laravel strings ('required', 'max:120', 'in:male,female',
 * 'after_or_equal:today', …) or objects { name, passes(value, attribute) }
 * made by unique(), exists() and oneOf().
 */

const IMPLICIT = ['required', 'present', 'required_with', 'required_without']
const SIZE_RULES = ['max', 'min', 'between', 'size']
const DATE_RULES = { after: '>', after_or_equal: '>=', before: '<', before_or_equal: '<=' }

// ---- rule objects ----------------------------------------------------------

/** unique:table,column (ignoring the row with id `ignoreId`). Compared case-insensitively, like MySQL. */
export const unique = (table, column, ignoreId = null) => ({
  name: 'unique',
  passes: (value) => !db.all(table).some((row) => row.id !== ignoreId && String(row[column] ?? '').toLowerCase() === String(value).toLowerCase()),
})

/** exists:table,id */
export const exists = (table) => ({ name: 'exists', passes: (value) => db.find(table, value) !== null })

/** Rule::enum(...) / Rule::in(...): `name` picks the message (validation.enum or validation.in). */
export const oneOf = (values, name = 'enum') => ({ name, passes: (value) => values.includes(String(value)) })

// ---- data access -----------------------------------------------------------

const isObject = (value) => value !== null && typeof value === 'object'

function getPath(data, path) {
  return path.split('.').reduce((node, key) => (isObject(node) ? node[key] : undefined), data)
}

function hasPath(data, path) {
  let node = data
  for (const key of path.split('.')) {
    if (!isObject(node) || !Object.hasOwn(node, key)) return false
    node = node[key]
  }
  return true
}

/** "items.*.drug_name" → ["items.0.drug_name", "items.1.drug_name"] for the elements that exist. */
function expand(pattern, data) {
  const parts = pattern.split('.')
  const walk = (node, index, prefix) => {
    if (index === parts.length) return [prefix.join('.')]
    const part = parts[index]
    if (part !== '*') return walk(isObject(node) ? node[part] : undefined, index + 1, [...prefix, part])
    if (!isObject(node)) return []
    return Object.keys(node).flatMap((key) => walk(node[key], index + 1, [...prefix, key]))
  }
  return walk(data, 0, [])
}

/** Puts the indexes of `attribute` into the *s of `other` ("items.*.drug_id" for "items.2.drug_name" → "items.2.drug_id"). */
function sibling(other, pattern, attribute) {
  if (!other.includes('*')) return other
  const indexes = attribute.split('.').filter((_, i) => pattern.split('.')[i] === '*')
  let n = 0
  return other.replace(/\*/g, () => indexes[n++] ?? '*')
}

const isEmpty = (value) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)

const isNumeric = (value) =>
  (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/.test(value))

const isInteger = (value) => (typeof value === 'number' && Number.isInteger(value)) || (typeof value === 'string' && /^[+-]?\d+$/.test(value.trim()))

function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function matchesFormat(value, format) {
  if (typeof value !== 'string') return false
  if (format === 'Y-m-d') return isDateString(value)
  if (format === 'H:i') {
    const match = /^(\d{2}):(\d{2})$/.exec(value)
    return Boolean(match) && Number(match[1]) < 24 && Number(match[2]) < 60
  }
  return false
}

/** A comparable string for a date rule: in the attribute's date_format when it has one, else a full Cairo date-time. */
function comparable(value, format) {
  if (value === null || value === undefined) return null
  const text = String(value)
  if (text === 'today') return format === 'H:i' ? '00:00' : format === 'Y-m-d' ? today() : `${today()} 00:00:00`
  if (text === 'now') return format === 'H:i' ? nowLocal().slice(11, 16) : format === 'Y-m-d' ? today() : nowLocal()
  if (format) return matchesFormat(text, format) ? text : null
  return parseToLocal(text)
}

const sizeOf = (value, type) => (type === 'numeric' ? Number(value) : type === 'array' ? Object.keys(value ?? {}).length : [...String(value ?? '')].length)

// ---- the validator ---------------------------------------------------------

function parse(rule) {
  if (typeof rule !== 'string') return { name: rule.name, params: [], object: rule }
  const at = rule.indexOf(':')
  if (at === -1) return { name: rule, params: [] }
  const name = rule.slice(0, at)
  const rest = rule.slice(at + 1)
  return { name, params: name === 'regex' ? [rest] : rest.split(',') }
}

/**
 * Validates `input` (the request data) against `rules` ({ attribute: [rules] }).
 * Throws a 422 like Laravel's FormRequest; returns the validated fields.
 *
 * @param {object} ctx  the request (its locale picks the messages)
 * @param {object} options  attributes: { attribute: JSON translation key }; messages: { 'attribute.rule': translated text };
 *                          after(add): extra checks after the rules pass, add(attribute, message) reports a failure
 */
export function validate(ctx, input, rules, { attributes = {}, messages = {}, after } = {}) {
  const data = isObject(input) ? input : {}
  const errors = {}
  const add = (attribute, message) => {
    ;(errors[attribute] ??= []).push(message)
  }
  const attributeNames = group(ctx.locale, 'validation.attributes') ?? {}

  const displayName = (attribute, pattern = attribute) => {
    const custom = attributes[attribute] ?? attributes[pattern]
    if (custom) return translate(ctx.locale, custom)
    if (attributeNames[attribute] ?? attributeNames[pattern]) return attributeNames[attribute] ?? attributeNames[pattern]
    return attribute.replaceAll('_', ' ')
  }

  const message = (attribute, pattern, name, type, values) => {
    const custom = messages[`${attribute}.${name}`] ?? messages[`${pattern}.${name}`]
    const key = SIZE_RULES.includes(name) || name === 'gt' ? `validation.${name}.${type}` : `validation.${name}`
    return translate(ctx.locale, custom ?? key, { attribute: displayName(attribute, pattern), ...values })
  }

  for (const [pattern, list] of Object.entries(rules)) {
    const parsed = list.map(parse)
    const names = parsed.map((rule) => rule.name)
    const type = names.includes('numeric') || names.includes('integer') ? 'numeric' : names.includes('array') ? 'array' : 'string'
    const format = parsed.find((rule) => rule.name === 'date_format')?.params[0]
    const attributesFor = pattern.includes('*') ? expand(pattern, data) : [pattern]

    for (const attribute of attributesFor) {
      const present = hasPath(data, attribute)
      const value = getPath(data, attribute)
      if (names.includes('sometimes') && !present) continue

      for (const { name, params, object } of parsed) {
        if (['sometimes', 'nullable', 'bail'].includes(name)) continue
        const implicit = IMPLICIT.includes(name)
        // Laravel's isValidatable(): non-implicit rules skip a missing or blank
        // field, and null when the field is nullable.
        if (!implicit) {
          if (!present || (typeof value === 'string' && value.trim() === '')) continue
          if (value === null && names.includes('nullable')) continue
        }

        const fail = (values = {}) => add(attribute, message(attribute, pattern, name, type, values))
        const ok = check({ name, params, object, value, present, attribute, pattern, data, type, format, rules, displayName })
        if (ok === true) continue
        fail(ok || {})
        if (implicit) break
      }
    }
  }

  if (after) after((attribute, text) => add(attribute, text), errors)
  if (Object.keys(errors).length) invalid(ctx, errors)

  // validated(): the fields that have rules and were sent.
  const validated = {}
  for (const pattern of Object.keys(rules)) {
    const top = pattern.split('.')[0]
    if (Object.hasOwn(data, top)) validated[top] = data[top]
  }
  return validated
}

/** true when the rule passes; otherwise false or the :placeholders for its message. */
function check({ name, params, object, value, attribute, pattern, data, type, format, rules, displayName }) {
  if (object) return object.passes(value, attribute)

  switch (name) {
    case 'required':
      return !isEmpty(value)
    case 'present':
      return hasPath(data, attribute)
    case 'required_with': {
      const other = sibling(params[0], pattern, attribute)
      return isEmpty(getPath(data, other)) || !isEmpty(value) || { values: displayName(other, params[0]) }
    }
    case 'required_without': {
      const other = sibling(params[0], pattern, attribute)
      return !isEmpty(getPath(data, other)) || !isEmpty(value) || { values: displayName(other, params[0]) }
    }
    case 'string':
      return typeof value === 'string'
    case 'integer':
      return isInteger(value)
    case 'numeric':
      return isNumeric(value)
    case 'boolean':
      return [true, false, 0, 1, '0', '1'].includes(value)
    case 'array':
      return isObject(value)
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value)
    case 'regex': {
      const match = /^\/(.*)\/([a-z]*)$/s.exec(params[0])
      return typeof value === 'string' && new RegExp(match[1], match[2].replace('u', '') + 'u').test(value)
    }
    case 'in':
      return (!isObject(value) && params.includes(String(value))) || {}
    case 'max':
      return sizeOf(value, type) <= Number(params[0]) || { max: params[0] }
    case 'min':
      return sizeOf(value, type) >= Number(params[0]) || { min: params[0] }
    case 'between': {
      const size = sizeOf(value, type)
      return (size >= Number(params[0]) && size <= Number(params[1])) || { min: params[0], max: params[1] }
    }
    case 'gt':
      return Number(value) > Number(params[0]) || { value: params[0] }
    case 'decimal': {
      const match = /^[+-]?\d*\.?(\d*)$/.exec(String(value))
      const places = match ? match[1].length : -1
      const max = params[1] === undefined ? Number(params[0]) : Number(params[1])
      return (match && places >= Number(params[0]) && places <= max) || { decimal: params[1] === undefined ? params[0] : `${params[0]}-${params[1]}` }
    }
    case 'date':
      return typeof value === 'string' && parseToLocal(value) !== null
    case 'date_format':
      return matchesFormat(value, params[0]) || { format: params[0] }
    case 'after':
    case 'after_or_equal':
    case 'before':
    case 'before_or_equal': {
      const param = params[0]
      const isKeyword = param === 'today' || param === 'now'
      const otherPath = isKeyword ? null : sibling(param, pattern, attribute)
      const mine = comparable(value, format)
      const theirs = isKeyword ? comparable(param, format) : comparable(getPath(data, otherPath), format)
      const replacement = { date: isKeyword ? param : displayName(otherPath, param) }
      // With a date_format, an empty other field passes (Laravel's checkDateTimeOrder).
      if (!isKeyword && theirs === null) return format ? true : replacement
      if (mine === null) return replacement
      const op = DATE_RULES[name]
      const passes = op === '>' ? mine > theirs : op === '>=' ? mine >= theirs : op === '<' ? mine < theirs : mine <= theirs
      return passes || replacement
    }
    case 'confirmed':
      return getPath(data, `${attribute}_confirmation`) === value
    case 'distinct': {
      const others = expand(pattern, data).filter((other) => other !== attribute)
      return !others.some((other) => String(getPath(data, other)) === String(value))
    }
    default:
      throw new Error(`Unknown validation rule [${name}] on ${attribute} (rules: ${Object.keys(rules).join(', ')})`)
  }
}
