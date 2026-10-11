/**
 * Helpers for the API's error shape: { message, errors?: { field: [messages] } }.
 */

/** First message per field from a 422 response, e.g. { phone: 'The phone has already been taken.' }. */
export function fieldErrors(error) {
  const errors = error?.response?.status === 422 ? error.response.data?.errors : null
  if (!errors) return {}
  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, messages[0]]))
}

/** The server's message, or `fallback` when there is no response (network down). */
export function errorMessage(error, fallback) {
  return error?.response?.data?.message || fallback
}
