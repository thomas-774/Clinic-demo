import client from './client'

const data = (res) => res.data.data

/** Typeahead (FR-J.2): up to 15 active drugs [{ id, trade_name, form, pack, category, short_use }]. */
export const searchDrugs = (q) => client.get('/doctor/drugs/search', { params: { q } }).then(data)

/** The full drug for the side note (FR-J.3); hidden drugs too. */
export const getDrug = (id) => client.get(`/doctor/drugs/${id}`).then(data)

/** Settings → Drugs (FR-J.6): resolves to { data: [...], meta: { current_page, last_page, total } }. */
export const listDrugs = ({ search = '', category = '', includeHidden = false, page = 1 } = {}) =>
  client
    .get('/doctor/drugs', {
      params: { search: search || undefined, category: category || undefined, include_hidden: includeHidden ? 1 : undefined, page },
    })
    .then((res) => res.data)

/** { trade_name, form, pack?, category, active_ingredients: [{ name, note? }], uses, warnings?, suggested_dose? } */
export const createDrug = (fields) => client.post('/doctor/drugs', fields).then(data)

/** Any of the create fields, or `{ is_active }` alone to hide / show the drug. */
export const updateDrug = (id, fields) => client.put(`/doctor/drugs/${id}`, fields).then(data)
