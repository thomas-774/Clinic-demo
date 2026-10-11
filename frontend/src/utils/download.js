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
 * Opens the browser's print dialog for an HTML document (the demo's visit
 * report, which the browser can save as PDF). It is printed from a hidden
 * frame, so no pop-up is needed after the request; the frame goes once printing is done.
 */
export function printHtml(html) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.className = 'fixed bottom-0 end-0 h-0 w-0 border-0'
  document.body.appendChild(frame)
  const view = frame.contentWindow
  let printed = false
  const print = () => {
    if (printed) return
    printed = true
    view.focus()
    view.print()
  }
  view.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0))
  // Printed when its stylesheet has loaded, or after a short wait at the latest.
  view.addEventListener('load', print)
  setTimeout(print, 1500)
  view.document.open()
  view.document.write(html)
  view.document.close()
  return frame
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
