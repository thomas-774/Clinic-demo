import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import PrescriptionPrint from '../../components/PrescriptionPrint'
import { LoadError, Loading } from '../../components/QueryState'
import { usePrescription } from '../../hooks/usePrescriptions'
import { paperOf } from '../../utils/prescriptions'
import { isVisitFormPath } from '../../utils/visitDraft'

/** Opens the print dialog once, after the prescription and the web fonts are ready. */
function usePrintOnce(ready) {
  const printed = useRef(false)
  useEffect(() => {
    if (!ready) return undefined
    let active = true
    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    fontsReady.then(() => {
      if (active && !printed.current) {
        printed.current = true
        window.print()
      }
    })
    return () => {
      active = false
    }
  }, [ready])
}

/**
 * Puts the whole document on the sheet's named page (index.css) while the
 * print page is open. With the name on the sheet alone, any box after it
 * (the hidden toast area, an element the browser adds) stays on the default
 * page, and Chrome then prints a blank second sheet.
 */
function usePaperClass(paper) {
  useEffect(() => {
    if (!paper) return undefined
    const className = `rx-paper-${paper.toLowerCase()}`
    document.documentElement.classList.add(className)
    return () => document.documentElement.classList.remove(className)
  }, [paper])
}

/**
 * /doctor/prescriptions/:id/print (§7.3 Printing, FR-J.5): only the
 * prescription, outside the doctor layout, and the browser's print dialog
 * on load. "Print again" and "Back to patient" are never printed.
 */
export default function PrescriptionPrintPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  // Printed for a visit not saved yet: back to that visit form.
  const asked = useLocation().state?.returnTo
  const returnTo = isVisitFormPath(asked) ? asked : null
  const { data, isPending, isError, error, refetch } = usePrescription(id, { purpose: 'print' })
  usePaperClass(data ? paperOf(data) : null)
  usePrintOnce(Boolean(data))

  if (isPending) return <Loading />
  if (isError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        {error?.response?.status === 404 ? (
          <p className="rounded-xl bg-amber-50 p-4 text-amber-900">{t('prescriptionForm.notFound')}</p>
        ) : (
          <LoadError onRetry={refetch} />
        )}
      </div>
    )
  }

  const width = paperOf(data) === 'A4' ? 'max-w-[210mm]' : 'max-w-[148mm]'

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:min-h-0 print:bg-white print:py-0">
      <div className={`mx-auto mb-4 flex flex-wrap items-center justify-between gap-2 px-4 print:hidden ${width}`}>
        <Link to={returnTo ?? `/doctor/patients/${data.patient_id}`} className="text-sm font-semibold text-sky-700 hover:underline">
          {t(returnTo ? 'rxPrint.backToVisit' : 'rxPrint.backToPatient')}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          {t('rxPrint.printAgain')}
        </button>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <PrescriptionPrint prescription={data} className="mx-auto shadow-lg print:shadow-none" />
      </div>
    </div>
  )
}
