import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

/**
 * Simple table.
 * - columns: [{ key, header, render?(row), className? }]
 * - rowHref(row): makes the first cell a link and the whole row clickable
 * - pagination: { page, lastPage, onPageChange } (hidden for a single page)
 * - footer: { [column key]: content } for a totals row under the body
 */
export default function DataTable({ columns, rows, rowHref, emptyMessage, pagination, onRowClick, footer }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (!rows.length) {
    return <p className="rounded-xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">{emptyMessage}</p>
  }

  const cell = (column, row) => (column.render ? column.render(row) : row[column.key])

  return (
    <div>
      {/* relative: absolutely placed sr-only text stays inside the scroll box instead of widening the page. */}
      <div className="relative overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={`px-4 py-3 text-start font-medium ${column.className ?? ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={rowHref ? () => navigate(rowHref(row)) : onRowClick ? () => onRowClick(row) : undefined}
                className={rowHref || onRowClick ? 'cursor-pointer hover:bg-sky-50/60' : undefined}
              >
                {columns.map((column, index) => (
                  <td key={column.key} className={`px-4 py-3 text-slate-800 ${column.className ?? ''}`}>
                    {index === 0 && rowHref ? (
                      <Link
                        to={rowHref(row)}
                        onClick={(event) => event.stopPropagation()}
                        className="font-medium text-sky-800 hover:underline"
                      >
                        {cell(column, row)}
                      </Link>
                    ) : (
                      cell(column, row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <tr>
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 ${column.className ?? ''}`}>
                    {footer[column.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pagination && pagination.lastPage > 1 && (
        <nav aria-label={t('table.pagination')} className="mt-3 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            className="rounded-lg px-3 py-1.5 ring-1 ring-slate-300 disabled:opacity-40"
          >
            {t('table.previous')}
          </button>
          <span className="text-slate-600">{t('table.pageOf', { page: pagination.page, total: pagination.lastPage })}</span>
          <button
            type="button"
            disabled={pagination.page >= pagination.lastPage}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            className="rounded-lg px-3 py-1.5 ring-1 ring-slate-300 disabled:opacity-40"
          >
            {t('table.next')}
          </button>
        </nav>
      )}
    </div>
  )
}
