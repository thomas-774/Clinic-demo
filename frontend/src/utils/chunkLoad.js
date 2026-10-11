/**
 * A page's code could not be downloaded (offline, or a new version was
 * deployed and the old chunk is gone). Vite's dynamic import rejects with
 * one of these messages, depending on the browser.
 */
export function isChunkLoadError(error) {
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Loading chunk/i.test(String(error?.message ?? ''))
}
