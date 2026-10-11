// NFR-P.4 (T11-10): run after `vite build`. Fails when
//   - the patient pages' initial JS (the entry and every chunk the patient
//     pages need, followed through static imports) is over 200 kB gzip,
//   - any chunk is over 500 kB minified,
//   - Recharts is in the entry or in a patient page's chunks.
// Reads dist/.vite/manifest.json (build.manifest in vite.config.js).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const KB = 1000
export const LIMITS = { patientInitialGzip: 200 * KB, chunkMinified: 500 * KB }
const PATIENT_PAGES = ['src/pages/patient/PatientHome.jsx', 'src/pages/patient/BookAppointment.jsx', 'src/pages/patient/MyAppointments.jsx']
// Class names Recharts writes into its code; minifying keeps them.
const RECHARTS_MARK = 'recharts-wrapper'

/** Every chunk file `keys` load before running: themselves and their static imports. */
export function staticClosure(manifest, keys) {
  const files = new Set()
  const visit = (key) => {
    const entry = manifest[key]
    if (!entry) throw new Error(`${key} is not in the build manifest`)
    if (files.has(entry.file)) return
    files.add(entry.file)
    for (const imported of entry.imports ?? []) visit(imported)
  }
  keys.forEach(visit)
  return [...files]
}

/** @returns {string[]} what is over budget; empty when all is well */
export function checkBundle(manifest, readChunk) {
  const problems = []
  const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry)
  const patientFiles = staticClosure(manifest, [entryKey, ...PATIENT_PAGES])

  const gzip = patientFiles.reduce((sum, file) => sum + gzipSync(readChunk(file)).length, 0)
  console.log(`Patient pages, initial JS: ${(gzip / KB).toFixed(1)} kB gzip in ${patientFiles.length} files (limit ${LIMITS.patientInitialGzip / KB} kB)`)
  if (gzip > LIMITS.patientInitialGzip) {
    problems.push(`patient pages' initial JS is ${(gzip / KB).toFixed(1)} kB gzip, over ${LIMITS.patientInitialGzip / KB} kB`)
  }

  const chunks = [...new Set(Object.values(manifest).map((entry) => entry.file).filter((file) => file.endsWith('.js')))]
  let largest = { file: '', size: 0 }
  for (const file of chunks) {
    const size = readChunk(file).length
    if (size > largest.size) largest = { file, size }
    if (size > LIMITS.chunkMinified) problems.push(`${file} is ${(size / KB).toFixed(1)} kB minified, over ${LIMITS.chunkMinified / KB} kB`)
  }
  console.log(`Largest chunk: ${largest.file} ${(largest.size / KB).toFixed(1)} kB minified (limit ${LIMITS.chunkMinified / KB} kB)`)

  for (const file of patientFiles) {
    if (readChunk(file).includes(RECHARTS_MARK)) problems.push(`Recharts is in ${file}, which the patient pages load`)
  }

  return problems
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'))
  } catch {
    console.error('No dist/.vite/manifest.json: run `vite build` first.')
    process.exit(1)
  }

  const problems = checkBundle(manifest, (file) => readFileSync(join(dist, file)))
  if (problems.length) {
    problems.forEach((problem) => console.error(`Bundle budget: ${problem}`))
    process.exit(1)
  }
  console.log('Bundle budget: OK')
}
