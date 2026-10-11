import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '../../../components/DataTable'
import { LoadError, Loading } from '../../../components/QueryState'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useDrugList, useSetDrugActive } from '../../../hooks/useDrugs'
import { useToast } from '../../../toast/useToast'
import { errorMessage } from '../../../utils/apiErrors'
import { DRUG_CATEGORIES } from '../../../utils/drugCategories'
import DrugFormModal from './DrugFormModal'

const smallButton = 'rounded-md px-2 py-1 text-xs font-semibold hover:bg-slate-100'
const control = 'rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-600'

/**
 * Settings → Drugs (FR-J.6): search the catalogue, filter by section, show
 * hidden drugs, add or edit a drug and hide / show it. Hidden drugs are not
 * suggested any more but stay on old prescriptions (RX-3).
 */
export default function DrugsTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [includeHidden, setIncludeHidden] = useState(false)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, drug = edit
  const debouncedSearch = useDebouncedValue(search.trim(), 300)

  // A new filter starts again at page 1.
  const [filters, setFilters] = useState({ debouncedSearch, category, includeHidden })
  if (filters.debouncedSearch !== debouncedSearch || filters.category !== category || filters.includeHidden !== includeHidden) {
    setFilters({ debouncedSearch, category, includeHidden })
    setPage(1)
  }

  const { data, isPending, isError, refetch } = useDrugList({ search: debouncedSearch, category, includeHidden, page })
  const setActive = useSetDrugActive()

  const toggle = (drug) =>
    setActive.mutate(
      { id: drug.id, isActive: !drug.is_active },
      {
        onSuccess: () => toast.success(t(drug.is_active ? 'drugsAdmin.hidden' : 'drugsAdmin.shown', { name: drug.trade_name })),
        onError: (error) => toast.error(errorMessage(error, t('common.networkError'))),
      },
    )

  const columns = [
    { key: 'trade_name', header: t('drugsAdmin.tradeName'), render: (drug) => <span dir="auto" className="font-medium">{drug.trade_name}</span> },
    {
      key: 'form',
      header: t('drugsAdmin.form'),
      render: (drug) => <span dir="auto">{[drug.form, drug.pack].filter(Boolean).join(' · ')}</span>,
    },
    { key: 'category', header: t('drugsAdmin.category'), render: (drug) => t(`drugCategory.${drug.category}`) },
    {
      key: 'status',
      header: t('drugsAdmin.status'),
      render: (drug) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${drug.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-200 text-slate-700'}`}
        >
          {t(drug.is_active ? 'drugsAdmin.active' : 'drugsAdmin.hiddenStatus')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('drugsAdmin.actions')}</span>,
      className: 'text-end whitespace-nowrap',
      render: (drug) => (
        <>
          <button
            type="button"
            onClick={() => setEditing(drug)}
            aria-label={t('drugsAdmin.editLabel', { name: drug.trade_name })}
            className={`${smallButton} text-sky-700`}
          >
            {t('drugsAdmin.edit')}
          </button>
          <button
            type="button"
            onClick={() => toggle(drug)}
            disabled={setActive.isPending}
            aria-label={t(drug.is_active ? 'drugsAdmin.hideLabel' : 'drugsAdmin.showLabel', { name: drug.trade_name })}
            className={`${smallButton} ${drug.is_active ? 'text-slate-700' : 'text-green-700'}`}
          >
            {t(drug.is_active ? 'drugsAdmin.hide' : 'drugsAdmin.show')}
          </button>
        </>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          dir="auto"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('drugsAdmin.searchPlaceholder')}
          aria-label={t('drugsAdmin.search')}
          className={`${control} w-full sm:w-64`}
        />
        <select aria-label={t('drugsAdmin.category')} value={category} onChange={(event) => setCategory(event.target.value)} className={control}>
          <option value="">{t('drugsAdmin.allCategories')}</option>
          {DRUG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`drugCategory.${c}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(event) => setIncludeHidden(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
          />
          {t('drugsAdmin.showHidden')}
        </label>
        <button
          type="button"
          onClick={() => setEditing({})}
          className="ms-auto rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          {t('drugsAdmin.add')}
        </button>
      </div>

      {isPending ? (
        <Loading />
      ) : isError ? (
        <LoadError onRetry={refetch} />
      ) : (
        <>
          <p className="text-sm text-slate-500">{t('drugsAdmin.count', { total: data.meta?.total ?? data.data.length })}</p>
          <DataTable
            columns={columns}
            rows={data.data}
            emptyMessage={t('drugsAdmin.empty')}
            pagination={{ page: data.meta?.current_page ?? page, lastPage: data.meta?.last_page ?? 1, onPageChange: setPage }}
          />
        </>
      )}

      {editing && <DrugFormModal drug={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </div>
  )
}
