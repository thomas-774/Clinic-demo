import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DEMO_MODE } from '../api/client'
import { addPayment, createVisit, exportVisit, updateVisit } from '../api/visits'
import { useToast } from '../toast/useToast'
import { errorMessage } from '../utils/apiErrors'
import { fileNameFrom, parseBlobError, printHtml, saveBlob } from '../utils/download'
import { patientsKey } from './usePatients'
import { reportsKey } from './useReports'
import { scheduleKey } from './useSchedule'

/** Visits change balances on the patient pages, appointment statuses on the schedule and the report numbers. */
function useRefreshAfterVisit() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: patientsKey }),
      queryClient.invalidateQueries({ queryKey: scheduleKey }),
      queryClient.invalidateQueries({ queryKey: reportsKey }),
    ])
}

export function useCreateVisit() {
  return useMutation({ mutationFn: (fields) => createVisit(fields), onSuccess: useRefreshAfterVisit() })
}

export function useUpdateVisit() {
  return useMutation({ mutationFn: ({ id, ...fields }) => updateVisit(id, fields), onSuccess: useRefreshAfterVisit() })
}

export function useAddPayment() {
  return useMutation({ mutationFn: ({ visitId, ...fields }) => addPayment(visitId, fields), onSuccess: useRefreshAfterVisit() })
}

/** The visit file formats offered. The demo has no Word export; its PDF is the browser's print dialog. */
export const VISIT_FILE_FORMATS = DEMO_MODE ? ['pdf'] : ['pdf', 'docx']

/**
 * Downloads a visit's file: `mutate({ id, format })` with format 'pdf' | 'docx'.
 * Fetched fresh each time, so it always shows the current balance (FR-K.4).
 * `showErrors: false` leaves the failure message to the caller (the visit form shows its own).
 */
export function useVisitExport({ showErrors = true } = {}) {
  const { t } = useTranslation()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ id, format }) => {
      try {
        const response = await exportVisit(id, format)
        // The demo answers with a printable page instead of a PDF file.
        if (response.data?.type?.startsWith('text/html')) {
          printHtml(await response.data.text())
          return 'print'
        }
        saveBlob(response.data, fileNameFrom(response.headers, `visit-${id}.${format}`))
        return format
      } catch (error) {
        throw await parseBlobError(error)
      }
    },
    onSuccess: (format) => toast.success(t({ docx: 'visitFile.docxSaved', print: 'demo.printOpened' }[format] ?? 'visitFile.pdfSaved')),
    onError: (error) => {
      if (showErrors) toast.error(errorMessage(error, t('visitFile.failed')))
    },
  })
}
