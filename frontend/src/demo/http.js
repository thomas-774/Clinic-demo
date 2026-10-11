import { choice, translate } from './lang'

/**
 * Responses and errors of the fake backend, in the source API's shapes:
 * resources as { data, message }, errors as { message } and validation
 * errors as 422 { message, errors: { field: [messages] } }.
 */
export class HttpError extends Error {
  constructor(status, data, headers = {}) {
    super(data?.message ?? `HTTP ${status}`)
    this.status = status
    this.data = data
    this.headers = headers
  }
}

/** HTTP status texts used as messages (bootstrap/app.php), translated through the JSON lines. */
const STATUS_TEXT = { 401: 'Unauthenticated.', 403: 'This action is unauthorized.', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict' }

/** Throws { message } with `status`; the message is translated (abort(403) etc.). */
export function abort(ctx, status, message = STATUS_TEXT[status] ?? 'Error', values) {
  throw new HttpError(status, { message: translate(ctx.locale, message, values) })
}

/** ValidationException::withMessages(): `errors` is { field: message | [messages] }, already translated. */
export function invalid(ctx, errors) {
  const bag = Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, [].concat(messages)]))
  throw new HttpError(422, { message: summarize(ctx.locale, bag), errors: bag })
}

/** ValidationException::summarize(): the first message, plus "(and N more errors)". */
export function summarize(locale, bag) {
  const all = Object.values(bag).flat()
  if (!all.length) return translate(locale, 'The given data was invalid.')
  const count = all.length - 1
  if (!count) return all[0]
  return `${all[0]} ${choice(locale, count === 1 ? '(and :count more error)' : '(and :count more errors)', count)}`
}

/** A JsonResource response: { data, message }. */
export const resource = (data, message = null, status = 200) => ({ status, data: { data, message } })

/** A plain JSON response. */
export const json = (data, status = 200, headers = {}) => ({ status, data, headers })

export const noContent = () => ({ status: 204, data: '' })

/**
 * Laravel's paginator as a resource collection: { data, links, meta, message }.
 *
 * @param {object} ctx  the request (its path and query build the links)
 * @param {Array} rows  every matching row, already sorted
 * @param {(row) => object} map  row → resource
 */
export function paginate(ctx, rows, map, { perPage = 15, extraMeta = {}, extra = {} } = {}) {
  const requested = Number.parseInt(ctx.query.page, 10)
  const total = rows.length
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1
  const slice = rows.slice((page - 1) * perPage, page * perPage)
  const path = `${ctx.baseUrl}${ctx.path}`
  const query = (p) => {
    const search = new URLSearchParams({ ...ctx.rawQuery, page: String(p) })
    return `${path}?${search}`
  }
  const from = slice.length ? (page - 1) * perPage + 1 : null
  return json({
    data: slice.map(map),
    links: {
      first: query(1),
      last: query(lastPage),
      prev: page > 1 ? query(page - 1) : null,
      next: page < lastPage ? query(page + 1) : null,
    },
    meta: {
      current_page: page,
      from,
      last_page: lastPage,
      path,
      per_page: perPage,
      to: from === null ? null : from + slice.length - 1,
      total,
      ...extraMeta,
    },
    ...extra,
    message: null,
  })
}
