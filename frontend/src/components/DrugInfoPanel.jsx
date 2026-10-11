import { useTranslation } from 'react-i18next'
import { useDrug } from '../hooks/useDrugs'
import { LoadError } from './QueryState'

function Section({ title, children }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  )
}

/** Keeps the PDF's line breaks; the texts are shown as written, in Arabic (FR-J.1). */
function Text({ children }) {
  return (
    <p dir="auto" className="whitespace-pre-line">
      {children}
    </p>
  )
}

/**
 * The side note beside the prescription (FR-J.3): what the drug is for, its
 * warnings in red, its active ingredients and the suggested dose, which one
 * click copies into the line's instructions. It is never printed (RX-4).
 *
 * - `drugId` — the highlighted or chosen catalogue drug.
 * - `preview` — the search result for that drug, shown while the full drug loads.
 * - `freeText` — the name of a line written as free text (not in the catalogue).
 * - `onUseDose(text)` — "Use suggested dose" was clicked.
 *
 * On wide screens it sticks to the top while the form scrolls; the form
 * places it beside the lines, or below the line on narrow screens.
 */
export default function DrugInfoPanel({ drugId, preview, freeText, onUseDose, className = '' }) {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useDrug(drugId)

  const drug = data ?? (preview && preview.id === drugId ? preview : null)

  let body
  if (drugId) {
    body = (
      <>
        {drug && (
          <header>
            <h2 dir="auto" className="text-lg font-semibold text-slate-900">
              {drug.trade_name}
            </h2>
            <p dir="auto" className="text-sm text-slate-600">
              {[drug.form, drug.pack].filter(Boolean).join(' · ')}
            </p>
            {drug.category && (
              <span className="mt-2 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                {t(`drugCategory.${drug.category}`)}
              </span>
            )}
          </header>
        )}

        {data ? (
          <>
            <Section title={t('drugInfo.uses')}>
              <Text>{data.uses}</Text>
            </Section>

            {data.warnings && (
              <div role="note" aria-label={t('drugInfo.warnings')} className="mt-4 rounded-lg bg-red-50 p-3 ring-1 ring-red-200">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700">{t('drugInfo.warnings')}</h3>
                <div className="mt-1 text-sm text-red-800">
                  <Text>{data.warnings}</Text>
                </div>
              </div>
            )}

            {data.active_ingredients?.length > 0 && (
              <Section title={t('drugInfo.ingredients')}>
                <ul className="space-y-1">
                  {data.active_ingredients.map((ingredient, i) => (
                    <li key={i}>
                      <bdi className="font-medium">{ingredient.name}</bdi>
                      {ingredient.note && (
                        <span dir="auto" className="text-slate-600">
                          {' — '}
                          {ingredient.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {data.suggested_dose && (
              <Section title={t('drugInfo.suggestedDose')}>
                <Text>{data.suggested_dose}</Text>
                {onUseDose && (
                  <button
                    type="button"
                    onClick={() => onUseDose(data.suggested_dose)}
                    className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {t('drugInfo.useDose')}
                  </button>
                )}
              </Section>
            )}
          </>
        ) : isError ? (
          <div className="mt-4">
            <LoadError onRetry={refetch} />
          </div>
        ) : (
          isPending && (
            <p role="status" className="mt-4 text-sm text-slate-500">
              {t('common.loading')}
            </p>
          )
        )}
      </>
    )
  } else if (freeText) {
    body = (
      <>
        <h2 dir="auto" className="text-lg font-semibold text-slate-900">
          {freeText}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{t('drugInfo.notInCatalogue')}</p>
      </>
    )
  } else {
    body = <p className="text-sm text-slate-500">{t('drugInfo.empty')}</p>
  }

  return (
    <aside
      aria-label={t('drugInfo.title')}
      aria-live="polite"
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4 ${className}`}
    >
      {body}
    </aside>
  )
}
