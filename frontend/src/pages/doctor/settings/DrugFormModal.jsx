import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../../components/Modal'
import SelectField from '../../../components/form/SelectField'
import TextAreaField from '../../../components/form/TextAreaField'
import TextField from '../../../components/form/TextField'
import { useSaveDrug } from '../../../hooks/useDrugs'
import { useToast } from '../../../toast/useToast'
import { errorMessage, fieldErrors } from '../../../utils/apiErrors'
import { DRUG_CATEGORIES } from '../../../utils/drugCategories'
import Form from '../../../components/form/Form'

/** The backend allows 1 to 10 active ingredients. */
const MAX_INGREDIENTS = 10

let lastKey = 0
const ingredientRow = ({ name = '', note = '' } = {}) => {
  lastKey += 1
  return { key: lastKey, name, note: note ?? '' }
}

/**
 * Add (drug = null) or edit a catalogue drug (FR-J.6): every field, with the
 * active ingredients as rows that can be added and removed.
 */
export default function DrugFormModal({ drug, onClose }) {
  const { t } = useTranslation()
  const toast = useToast()
  const save = useSaveDrug()
  const [form, setForm] = useState(() => ({
    trade_name: drug?.trade_name ?? '',
    form: drug?.form ?? '',
    pack: drug?.pack ?? '',
    category: drug?.category ?? '',
    uses: drug?.uses ?? '',
    warnings: drug?.warnings ?? '',
    suggested_dose: drug?.suggested_dose ?? '',
  }))
  const [ingredients, setIngredients] = useState(() =>
    drug?.active_ingredients?.length ? drug.active_ingredients.map(ingredientRow) : [ingredientRow()],
  )

  const errors = fieldErrors(save.error)
  const formError = save.error && !Object.keys(errors).length ? errorMessage(save.error, t('common.networkError')) : ''
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const setIngredient = (key, field, value) =>
    setIngredients((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)))

  // Rows are sent in order without the empty ones, so items.N errors are matched by that order.
  const sentRows = ingredients.filter((row) => row.name.trim() || row.note.trim())
  const ingredientError = (row) => {
    const index = sentRows.indexOf(row)
    return index < 0 ? undefined : (errors[`active_ingredients.${index}.name`] ?? errors[`active_ingredients.${index}.note`])
  }

  function handleSubmit(event) {
    event.preventDefault()
    const orNull = (value) => value.trim() || null
    const fields = {
      trade_name: form.trade_name.trim(),
      form: form.form.trim(),
      pack: orNull(form.pack),
      category: form.category,
      active_ingredients: sentRows.map((row) => ({ name: row.name.trim(), note: orNull(row.note) })),
      uses: form.uses.trim(),
      warnings: orNull(form.warnings),
      suggested_dose: orNull(form.suggested_dose),
    }
    save.mutate(drug ? { id: drug.id, ...fields } : fields, {
      onSuccess: (saved) => {
        toast.success(t(drug ? 'drugsAdmin.updated' : 'drugsAdmin.added', { name: saved.trade_name }))
        onClose()
      },
    })
  }

  return (
    <Modal open size="lg" title={drug ? t('drugsAdmin.editTitle', { name: drug.trade_name }) : t('drugsAdmin.addTitle')} onClose={onClose}>
      <Form onSubmit={handleSubmit} className="space-y-3">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('drugsAdmin.tradeName')} dir="auto" value={form.trade_name} onChange={set('trade_name')} error={errors.trade_name} required className="sm:col-span-2" />
          <TextField label={t('drugsAdmin.form')} dir="auto" value={form.form} onChange={set('form')} error={errors.form} hint={t('drugsAdmin.formHint')} required />
          <TextField label={t('drugsAdmin.pack')} dir="auto" value={form.pack} onChange={set('pack')} error={errors.pack} hint={t('drugsAdmin.packHint')} />
          <SelectField
            label={t('drugsAdmin.category')}
            value={form.category}
            onChange={set('category')}
            error={errors.category}
            required
            className="sm:col-span-2"
            options={[{ value: '', label: t('drugsAdmin.chooseCategory') }, ...DRUG_CATEGORIES.map((c) => ({ value: c, label: t(`drugCategory.${c}`) }))]}
          />
        </div>

        <fieldset className="rounded-xl p-3 ring-1 ring-slate-200">
          <legend className="px-1 text-sm font-medium text-slate-700">{t('drugsAdmin.ingredients')}</legend>
          {errors.active_ingredients && <p className="mb-2 text-sm text-red-600">{errors.active_ingredients}</p>}
          <ul className="space-y-2">
            {ingredients.map((row, index) => {
              const error = ingredientError(row)
              return (
                <li key={row.key}>
                  <div className="flex gap-2">
                    <input
                      dir="auto"
                      aria-label={t('drugsAdmin.ingredientName', { number: index + 1 })}
                      aria-invalid={error ? true : undefined}
                      placeholder={t('drugsAdmin.ingredientNamePlaceholder')}
                      value={row.name}
                      onChange={(event) => setIngredient(row.key, 'name', event.target.value)}
                      className={`w-2/5 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${error ? 'border-red-600 focus:ring-red-600' : 'border-slate-500 focus:ring-sky-600'}`}
                    />
                    <input
                      dir="auto"
                      aria-label={t('drugsAdmin.ingredientNote', { number: index + 1 })}
                      placeholder={t('drugsAdmin.ingredientNotePlaceholder')}
                      value={row.note}
                      onChange={(event) => setIngredient(row.key, 'note', event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                    />
                    <button
                      type="button"
                      onClick={() => setIngredients((current) => current.filter((r) => r.key !== row.key))}
                      disabled={ingredients.length === 1}
                      aria-label={t('drugsAdmin.removeIngredient', { number: index + 1 })}
                      className="rounded px-2 text-red-600 hover:bg-red-50 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                  {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => setIngredients((current) => [...current, ingredientRow()])}
            disabled={ingredients.length >= MAX_INGREDIENTS}
            className="mt-2 text-sm font-semibold text-sky-700 hover:underline disabled:opacity-50"
          >
            + {t('drugsAdmin.addIngredient')}
          </button>
        </fieldset>

        <TextAreaField label={t('drugInfo.uses')} dir="auto" rows={3} value={form.uses} onChange={set('uses')} error={errors.uses} required />
        <TextAreaField label={t('drugInfo.warnings')} dir="auto" rows={2} value={form.warnings} onChange={set('warnings')} error={errors.warnings} />
        <TextAreaField
          label={t('drugInfo.suggestedDose')}
          dir="auto"
          rows={2}
          value={form.suggested_dose}
          onChange={set('suggested_dose')}
          error={errors.suggested_dose}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </Form>
    </Modal>
  )
}
