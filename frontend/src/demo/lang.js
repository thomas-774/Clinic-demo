import lines from './data/lang.json'

/**
 * Laravel's translator, enough for the fake backend: the source app's
 * backend/lang files (exported to data/lang.json), `__()` lookups, `:name`
 * replacements and `trans_choice()` plural forms.
 */
export const LOCALES = ['ar', 'en']

/** The first supported language in an Accept-Language header; Arabic by default (SetLocale). */
export function pickLocale(header) {
  const wanted = String(header ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim().toLowerCase().split('-')[0])
  return wanted.find((code) => LOCALES.includes(code)) ?? LOCALES[0]
}

function lookup(locale, key) {
  const table = lines[locale] ?? lines.ar
  if (Object.hasOwn(table.json, key)) return table.json[key]
  const [group, ...path] = key.split('.')
  if (path.length && table[group]) {
    const value = path.reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), table[group])
    if (value !== undefined) return value
  }
  return undefined
}

/** Replaces :name, :Name and :NAME, longest names first (like Laravel). */
export function replace(text, values = {}) {
  return Object.keys(values)
    .sort((a, b) => b.length - a.length)
    .reduce((out, name) => {
      const value = String(values[name] ?? '')
      const upper = name[0].toUpperCase() + name.slice(1)
      return out
        .replaceAll(`:${name.toUpperCase()}`, value.toUpperCase())
        .replaceAll(`:${upper}`, value.charAt(0).toUpperCase() + value.slice(1))
        .replaceAll(`:${name}`, value)
    }, text)
}

/** `__(key, replace)`: the translated line, or the key itself when there is none. */
export function translate(locale, key, values) {
  const line = lookup(locale, key)
  return replace(typeof line === 'string' ? line : key, values)
}

/** Whether a translation line exists for `key` (a string, not a group). */
export const hasLine = (locale, key) => typeof lookup(locale, key) === 'string'

/** The group array (for example validation.attributes), or undefined. */
export const group = (locale, key) => lookup(locale, key)

/** Laravel's MessageSelector::getPluralIndex for the two app languages. */
function pluralIndex(locale, n) {
  if (locale === 'ar') {
    if (n === 0) return 0
    if (n === 1) return 1
    if (n === 2) return 2
    if (n % 100 >= 3 && n % 100 <= 10) return 3
    if (n % 100 >= 11 && n % 100 <= 99) return 4
    return 5
  }
  return n === 1 ? 0 : 1
}

/** `trans_choice(key, count, replace)`. */
export function choice(locale, key, count, values = {}) {
  const line = lookup(locale, key)
  const segments = (typeof line === 'string' ? line : key).split('|')
  const index = pluralIndex(locale, count)
  const chosen = segments.length === 1 || segments[index] === undefined ? segments[0] : segments[index]
  return replace(chosen, { count, ...values })
}
