import * as db from '../../db'
import { paginate, resource } from '../../http'
import * as resources from '../../resources'
import { oneOf, validate } from '../../validate'
import { __, bind, boolean, only } from '../shared'

/** Doctor → the drug catalogue (DrugController, FR-J.1–J.3, FR-J.6). */

const MIN_QUERY_LENGTH = 2
const MAX_SUGGESTIONS = 15
const PER_PAGE = 20

export const CATEGORIES = [
  'mouth_cleaning',
  'sensitive_toothpaste',
  'vitamin_c',
  'anti_inflammatory',
  'antibiotic',
  'analgesic_sedative',
  'antifungal',
  'calcium',
  'cod_liver_oil',
  'local_anesthetic',
  'other',
]

const nameOrder = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
const byTradeName = (a, b) => nameOrder.compare(a.trade_name, b.trade_name) || a.id - b.id

/** Drug::scopeMatching(): the trade name or an active ingredient contains `search`, case-insensitive. */
function matches(drug, search) {
  const needle = search.toLowerCase()
  return drug.trade_name.toLowerCase().includes(needle) || (drug.active_ingredients ?? []).some((ingredient) => String(ingredient.name).toLowerCase().includes(needle))
}

/** Drug::scopeRankedFor(): name starts with it, then name contains it, then only an ingredient matches. */
function rank(drug, search) {
  const name = drug.trade_name.toLowerCase()
  const needle = search.toLowerCase()
  return name.startsWith(needle) ? 0 : name.includes(needle) ? 1 : 2
}

/** GET /doctor/drugs/search?q=: typeahead over shown drugs (FR-J.2, RX-3). */
export function search(ctx) {
  const q = String(ctx.query.q ?? '').trim()
  if ([...q].length < MIN_QUERY_LENGTH) return resource([])
  const rows = db
    .where('drugs', (drug) => drug.is_active && matches(drug, q))
    .sort((a, b) => rank(a, q) - rank(b, q) || byTradeName(a, b))
    .slice(0, MAX_SUGGESTIONS)
  return resource(rows.map(resources.drugSuggestion))
}

/** GET /doctor/drugs?search=&category=&include_hidden=: Settings → Drugs (FR-J.6). */
export function index(ctx) {
  validate(ctx, ctx.input, {
    search: ['nullable', 'string', 'max:150'],
    category: ['nullable', oneOf(CATEGORIES)],
    include_hidden: ['nullable', 'boolean'],
  })
  const search = String(ctx.query.search ?? '').trim()
  const includeHidden = boolean(ctx.query.include_hidden)
  const rows = db
    .where('drugs', (drug) => (includeHidden || drug.is_active) && (!ctx.query.category || drug.category === ctx.query.category) && (!search || matches(drug, search)))
    .sort(byTradeName)
  return paginate(ctx, rows, resources.drug, { perPage: PER_PAGE })
}

/** GET /doctor/drugs/{drug}: hidden drugs are still readable (FR-J.3, RX-3). */
export const show = (ctx) => resource(resources.drug(bind(ctx, 'drugs', 'drug')))

const RULES = {
  trade_name: ['required', 'string', 'max:150'],
  form: ['required', 'string', 'max:60'],
  pack: ['nullable', 'string', 'max:60'],
  category: ['required', oneOf(CATEGORIES)],
  active_ingredients: ['required', 'array', 'min:1', 'max:10'],
  'active_ingredients.*.name': ['required', 'string', 'max:100'],
  'active_ingredients.*.note': ['nullable', 'string', 'max:255'],
  uses: ['required', 'string', 'max:2000'],
  warnings: ['nullable', 'string', 'max:2000'],
  suggested_dose: ['nullable', 'string', 'max:1000'],
  is_active: ['sometimes', 'boolean'],
}

const ATTRIBUTES = {
  trade_name: 'trade name',
  form: 'form',
  pack: 'pack',
  category: 'category',
  active_ingredients: 'active ingredients',
  'active_ingredients.*.name': 'ingredient name',
  'active_ingredients.*.note': 'ingredient note',
  uses: 'uses',
  warnings: 'warnings',
  suggested_dose: 'suggested dose',
  is_active: 'shown in search',
}

/** UpdateDrugRequest: every top-level rule becomes `sometimes`. */
const UPDATE_RULES = Object.fromEntries(
  Object.entries(RULES).map(([field, rules]) => [field, field.includes('.*.') || rules.includes('sometimes') ? rules : ['sometimes', ...rules]]),
)

/** StoreDrugRequest::drugData(): ingredients trimmed, empty notes as null. */
function drugData(ctx, rules) {
  const data = validate(ctx, ctx.input, rules, { attributes: ATTRIBUTES })
  const fields = only(data, Object.keys(RULES).filter((field) => !field.includes('.')))
  if (fields.active_ingredients) {
    fields.active_ingredients = Object.values(fields.active_ingredients).map((ingredient) => ({
      name: String(ingredient.name).trim(),
      note: ingredient.note ? String(ingredient.note).trim() : null,
    }))
  }
  if (Object.hasOwn(fields, 'is_active')) fields.is_active = boolean(fields.is_active)
  return fields
}

export function store(ctx) {
  const fields = drugData(ctx, RULES)
  const drug = db.insert('drugs', {
    pack: null,
    warnings: null,
    suggested_dose: null,
    seed_key: null,
    source_page: null,
    is_active: true,
    ...fields,
  })
  return resource(resources.drug(drug), __(ctx, 'Drug added.'), 201)
}

/** PUT /doctor/drugs/{drug}: edit, or hide / show with `is_active`. */
export function update(ctx) {
  const drug = bind(ctx, 'drugs', 'drug')
  db.update('drugs', drug.id, drugData(ctx, UPDATE_RULES))
  return resource(resources.drug(drug), __(ctx, 'Drug updated.'))
}
