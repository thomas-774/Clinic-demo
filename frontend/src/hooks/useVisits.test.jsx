import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { vi } from 'vitest'
import client from '../api/client'
import { ToastProvider } from '../toast/ToastProvider'
import { useVisitExport } from './useVisits'
import { errorToasts, successToasts } from '../test/a11y'

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// Replace the network with a fake adapter that records each request.
function fakeServer(respond) {
  const requests = []
  client.defaults.adapter = async (config) => {
    requests.push(config)
    const { status = 200, data, headers = {} } = respond(config)
    const response = { status, data, headers: new AxiosHeaders(headers), config, statusText: '' }
    if (status >= 400) throw new AxiosError('error', String(status), config, null, response)
    return response
  }
  return requests
}

const jsonBlob = (body) => new Blob([JSON.stringify(body)], { type: 'application/json' })

function renderExport() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
  return renderHook(() => useVisitExport(), { wrapper }).result
}

describe('useVisitExport', () => {
  const originalAdapter = client.defaults.adapter
  let saved

  beforeEach(() => {
    saved = []
    URL.createObjectURL = vi.fn(() => 'blob:visit-file')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      saved.push(this.download)
    })
  })

  afterEach(() => {
    client.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('fetches the PDF as a blob and saves it under the server’s file name', async () => {
    const file = new Blob(['%PDF-1.4'], { type: PDF })
    const requests = fakeServer(() => ({
      data: file,
      headers: { 'Content-Type': PDF, 'Content-Disposition': 'attachment; filename="visit-2026-10-07-88.pdf"' },
    }))
    const result = renderExport()

    await act(() => result.current.mutateAsync({ id: 88, format: 'pdf' }))

    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('/doctor/visits/88/export')
    expect(requests[0].params).toEqual({ format: 'pdf' })
    expect(requests[0].responseType).toBe('blob')
    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(saved).toEqual(['visit-2026-10-07-88.pdf'])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:visit-file')
    await vi.waitFor(() => expect(successToasts()).toHaveTextContent('PDF saved.'))
  })

  it('saves a Word file, with a fallback name when the header is not readable', async () => {
    const requests = fakeServer(() => ({ data: new Blob(['PK'], { type: DOCX }), headers: { 'Content-Type': DOCX } }))
    const result = renderExport()

    await act(() => result.current.mutateAsync({ id: 12, format: 'docx' }))

    expect(requests[0].params).toEqual({ format: 'docx' })
    expect(saved).toEqual(['visit-12.docx'])
    await vi.waitFor(() => expect(successToasts()).toHaveTextContent('Word file saved.'))
  })

  it.each([
    [403, 'This action is unauthorized.'],
    [422, 'The selected file format is invalid.'],
  ])('shows the server’s message from a %i error blob', async (status, message) => {
    fakeServer(() => ({ status, data: jsonBlob({ message }) }))
    const result = renderExport()

    await act(() => result.current.mutateAsync({ id: 88, format: 'pdf' }).catch(() => {}))

    await vi.waitFor(() => expect(errorToasts()).toHaveTextContent(message))
    expect(result.current.error.response.data).toEqual({ message })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(saved).toEqual([])
  })

  it('shows a general message when the server cannot be reached', async () => {
    client.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }
    const result = renderExport()

    await act(() => result.current.mutateAsync({ id: 88, format: 'pdf' }).catch(() => {}))

    await vi.waitFor(() => expect(errorToasts()).toHaveTextContent('The file could not be downloaded. Please try again.'))
  })
})
