/**
 * Saving files the API sends (visit PDF / Word). The request goes through the axios
 * client so the token is sent; the bytes are then handed to the browser as a download.
 */

/** Saves `blob` as `fileName` through a temporary object URL and `<a download>`. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}

/**
 * The file name from a `Content-Disposition` header, e.g. `attachment; filename="visit-2026-10-07-88.pdf"`.
 * Prefers RFC 5987 `filename*=UTF-8''…`; returns `fallback` when the header is missing or has no name.
 */
export function fileNameFrom(headers, fallback) {
  const header = headers?.['content-disposition'] ?? headers?.get?.('content-disposition')
  if (!header) return fallback

  const encoded = /filename\*\s*=\s*(?:[\w-]+)?'[^']*'([^;]+)/i.exec(header)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // a malformed encoding: try the plain filename below
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header)
  const name = (plain?.[1] ?? plain?.[2] ?? '').trim()
  return name || fallback
}

/**
 * With `responseType: 'blob'` an error body is a Blob too. Turns a JSON one back into an
 * object, so `errorMessage(error, …)` from apiErrors.js works as for any other request.
 */
export async function parseBlobError(error) {
  const body = error?.response?.data
  if (typeof Blob === 'undefined' || !(body instanceof Blob)) return error
  try {
    error.response.data = JSON.parse(await body.text())
  } catch {
    error.response.data = {}
  }
  return error
}
