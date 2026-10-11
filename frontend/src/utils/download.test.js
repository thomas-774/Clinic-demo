import { AxiosHeaders } from 'axios'
import { vi } from 'vitest'
import { fileNameFrom, parseBlobError, saveBlob } from './download'

describe('fileNameFrom', () => {
  const fallback = 'visit-88.pdf'

  it('reads a quoted file name', () => {
    expect(fileNameFrom({ 'content-disposition': 'attachment; filename="visit-2026-10-07-88.pdf"' }, fallback)).toBe('visit-2026-10-07-88.pdf')
  })

  it('reads an unquoted file name', () => {
    expect(fileNameFrom({ 'content-disposition': 'attachment; filename=visit-2026-10-07-88.docx' }, fallback)).toBe('visit-2026-10-07-88.docx')
    expect(fileNameFrom({ 'content-disposition': 'attachment; filename=visit-1.pdf; size=10' }, fallback)).toBe('visit-1.pdf')
  })

  it('prefers the RFC 5987 encoded name', () => {
    const header = `attachment; filename="visit.pdf"; filename*=UTF-8''visit%20%D9%85.pdf`
    expect(fileNameFrom({ 'content-disposition': header }, fallback)).toBe('visit م.pdf')
  })

  it('falls back when the header is missing or has no name', () => {
    expect(fileNameFrom({}, fallback)).toBe(fallback)
    expect(fileNameFrom(undefined, fallback)).toBe(fallback)
    expect(fileNameFrom({ 'content-disposition': 'attachment' }, fallback)).toBe(fallback)
    expect(fileNameFrom({ 'content-disposition': 'attachment; filename=""' }, fallback)).toBe(fallback)
  })

  it('reads axios headers whatever the case', () => {
    const headers = new AxiosHeaders({ 'Content-Disposition': 'attachment; filename="visit-2026-10-07-88.pdf"' })
    expect(fileNameFrom(headers, fallback)).toBe('visit-2026-10-07-88.pdf')
  })
})

describe('saveBlob', () => {
  afterEach(() => vi.restoreAllMocks())

  it('clicks a temporary download link, then removes it and revokes the URL', () => {
    URL.createObjectURL = vi.fn(() => 'blob:visit')
    URL.revokeObjectURL = vi.fn()
    const clicked = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.push({ href: this.href, download: this.download, attached: document.body.contains(this) })
    })
    const blob = new Blob(['%PDF'], { type: 'application/pdf' })

    saveBlob(blob, 'visit-2026-10-07-88.pdf')

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked).toEqual([{ href: 'blob:visit', download: 'visit-2026-10-07-88.pdf', attached: true }])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:visit')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})

describe('parseBlobError', () => {
  it('turns a JSON error blob into an object', async () => {
    const error = { response: { status: 403, data: new Blob([JSON.stringify({ message: 'Forbidden.' })], { type: 'application/json' }) } }
    expect((await parseBlobError(error)).response.data).toEqual({ message: 'Forbidden.' })
  })

  it('leaves errors without a blob body alone', async () => {
    const network = new Error('Network Error')
    expect(await parseBlobError(network)).toBe(network)
  })

  it('empties a body that is not JSON', async () => {
    const error = { response: { status: 500, data: new Blob(['<html>'], { type: 'text/html' }) } }
    expect((await parseBlobError(error)).response.data).toEqual({})
  })
})
