import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable'
import { LoadError, Loading } from '../../components/QueryState'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useStaffApi } from '../../staff/staffApi'
import { formatDate } from '../../utils/format'
import NewPatientModal from './NewPatientModal'

/** Search and "New patient" (FR-C.1, FR-C.6); the assistant uses the same page (FR-I.2). */
export default function PatientsList() {
  const { t } = useTranslation()
  const { area, usePatients } = useStaffApi()
  const [params, setParams] = useSearchParams()
  const urlSearch = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(urlSearch)
  const [shownUrlSearch, setShownUrlSearch] = useState(urlSearch)
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const [creating, setCreating] = useState(false)

  // Back/forward changed ?search=: show it in the box.
  if (urlSearch !== shownUrlSearch) {
    setShownUrlSearch(urlSearch)
    setSearch(urlSearch)
  }

  // Typing updates ?search= after 300 ms and goes back to page 1. Runs only
  // when the typed text settles, so it never fights back/forward navigation.
  const setParamsRef = useRef(setParams)
  useEffect(() => {
    setParamsRef.current = setParams
  })
  useEffect(() => {
    setParamsRef.current(
      (current) => {
        if ((current.get('search') ?? '') === debouncedSearch) return current
        return debouncedSearch ? { search: debouncedSearch } : {}
      },
      { replace: true },
    )
  }, [debouncedSearch])

  const { data, isPending, isError, refetch } = usePatients({ search: urlSearch, page })

  const goToPage = (next) => setParams({ ...(urlSearch && { search: urlSearch }), page: String(next) })

  const columns = [
    { key: 'name', header: t('patientsList.name') },
    { key: 'phone', header: t('patientsList.phone'), render: (row) => <span dir="ltr">{row.phone}</span> },
    {
      key: 'last_visit_date',
      header: t('patientsList.lastVisit'),
      render: (row) => (row.last_visit_date ? formatDate(row.last_visit_date) : '—'),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t('pages.patients')}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ms-auto rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          {t('patientsList.newPatient')}
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('patientsList.searchPlaceholder')}
        aria-label={t('patientsList.search')}
        className="block w-full rounded-lg border border-slate-500 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-600 sm:max-w-sm"
      />

      {isPending ? (
        <Loading />
      ) : isError ? (
        <LoadError onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          rows={data.data}
          rowHref={(row) => `/${area}/patients/${row.id}`}
          emptyMessage={urlSearch ? t('patientsList.noMatches', { search: urlSearch }) : t('patientsList.empty')}
          pagination={{ page: data.meta.current_page, lastPage: data.meta.last_page, onPageChange: goToPage }}
        />
      )}

      <NewPatientModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
