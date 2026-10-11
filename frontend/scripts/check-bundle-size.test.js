import { vi } from 'vitest'
import { checkBundle, LIMITS, staticClosure } from './check-bundle-size.js'

const manifest = {
  'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_client.js'] },
  '_client.js': { file: 'assets/client.js' },
  '_format.js': { file: 'assets/format.js' },
  'src/pages/patient/PatientHome.jsx': { file: 'assets/PatientHome.js', imports: ['_client.js', '_format.js'] },
  'src/pages/patient/BookAppointment.jsx': { file: 'assets/BookAppointment.js', imports: ['_format.js'] },
  'src/pages/patient/MyAppointments.jsx': { file: 'assets/MyAppointments.js' },
  'src/pages/doctor/Reports.jsx': { file: 'assets/Reports.js', imports: ['_format.js'] },
}

/** Random bytes do not compress, so gzip size ≈ length. */
const noise = (bytes) => Buffer.from(Array.from({ length: bytes }, () => Math.floor(Math.random() * 256)))

function chunks(overrides = {}) {
  const files = { 'assets/Reports.js': Buffer.from('class="recharts-wrapper"'), ...overrides }
  return (file) => files[file] ?? Buffer.from(`/* ${file} */`)
}

describe('check-bundle-size', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}))

  it('follows static imports from the entry and the patient pages, not the doctor pages', () => {
    const files = staticClosure(manifest, ['index.html', 'src/pages/patient/PatientHome.jsx', 'src/pages/patient/BookAppointment.jsx'])
    expect(files.sort()).toEqual(['assets/BookAppointment.js', 'assets/PatientHome.js', 'assets/client.js', 'assets/format.js', 'assets/index.js'])
  })

  it('passes a build within budget, with Recharts only in Reports', () => {
    expect(checkBundle(manifest, chunks())).toEqual([])
  })

  it('fails when the patient pages need more than 200 kB gzip', () => {
    const problems = checkBundle(manifest, chunks({ 'assets/client.js': noise(LIMITS.patientInitialGzip) }))
    expect(problems).toEqual([expect.stringContaining("patient pages' initial JS")])
  })

  it('fails on a chunk over 500 kB minified, even one the patient never loads', () => {
    const problems = checkBundle(manifest, chunks({ 'assets/Reports.js': Buffer.alloc(LIMITS.chunkMinified + 1, 'a') }))
    expect(problems).toEqual([expect.stringContaining('assets/Reports.js is 500.0 kB minified')])
  })

  it('fails when Recharts reaches a chunk the patient pages load', () => {
    const problems = checkBundle(manifest, chunks({ 'assets/format.js': Buffer.from('"recharts-wrapper"') }))
    expect(problems).toEqual(['Recharts is in assets/format.js, which the patient pages load'])
  })
})
