import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Card from '../../components/Card'
import DrugInfoPanel from '../../components/DrugInfoPanel'
import DrugSearch from '../../components/DrugSearch'
import { LoadError, Loading } from '../../components/QueryState'
import TextAreaField from '../../components/form/TextAreaField'
import TextField from '../../components/form/TextField'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { usePatient } from '../../hooks/usePatient'
import { usePrescription, useSavePrescription } from '../../hooks/usePrescriptions'
import { useToast } from '../../toast/useToast'
import { errorMessage, fieldErrors } from '../../utils/apiErrors'
import { ageOn } from '../../utils/dates'
import { formatDate, todayInClinic } from '../../utils/format'
import Form from '../../components/form/Form'
import { addDraftPrescription, isVisitFormPath } from '../../utils/visitDraft'

/** RX-1: a prescription has 1 to 15 lines. */
export const MAX_LINES = 15
const MAX_INSTRUCTIONS = 255
const REMINDER_TYPES = ['allergy', 'condition']

let lastKey = 0

/**
 * One line of the form. `drug` is the chosen catalogue drug, `freeName` a
 * name used as written, `draft` the text typed in the search but not picked.
 */
function newLine(fields = {}) {
  lastKey += 1
  return { key: lastKey, drug: null, freeName: null, draft: '', instructions: '', ...fields }
}

/** A saved line back into the form: its snapshot name and form stand in for the drug. */
function lineFromItem(item) {
  return item.drug_id
    ? newLine({ drug: { id: item.drug_id, trade_name: item.drug_name, form: item.drug_form }, instructions: item.instructions })
    : newLine({ freeName: item.drug_name, instructions: item.instructions })
}

const isBlank = (line) => !line.drug && !line.freeName && !line.draft.trim() && !line.instructions.trim()

/** The client-side RX-1 check for one line; the server checks again. */
function lineProblem(line) {
  if (!line.drug && !line.freeName) return 'needDrug'
  const instructions = line.instructions.trim()
  if (!instructions) return 'needInstructions'
  if (instructions.length > MAX_INSTRUCTIONS) return 'tooLong'
  return null
}

/** The 422 message for the line sent at `index` (items.0.instructions …). */
function lineServerError(errors, index) {
  const prefix = `items.${index}`
  return errors[`${prefix}.drug_id`] ?? errors[`${prefix}.drug_name`] ?? errors[`${prefix}.instructions`] ?? errors[prefix]
}

/**
 * Write or edit a prescription (§7.2, FR-J.3, FR-J.4): numbered lines with
 * DrugSearch and instructions, a side note that follows the line being
 * edited, the patient's allergies and conditions as a reminder, and Save or
 * Save & Print.
 *
 * Routes: /doctor/patients/:id/prescriptions/new[?visit=:id | ?returnTo=:visitFormUrl] and, with
 * `editing`, /doctor/prescriptions/:id/edit.
 */
export default function PrescriptionForm({ editing = false }) {
  const { t } = useTranslation()
  const { id } = useParams()
  const [params] = useSearchParams()
  const prescription = usePrescription(id, { enabled: editing })
  const patientId = editing ? prescription.data?.patient_id : id
  const patient = usePatient(patientId, { enabled: Boolean(patientId) })

  const failed = editing ? prescription : patient
  if (failed.isError) {
    if (failed.error?.response?.status === 404) {
      return (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-900">
          {t(editing ? 'prescriptionForm.notFound' : 'patientDetails.notFound')}
        </p>
      )
    }
    return <LoadError onRetry={failed.refetch} />
  }
  if ((editing && prescription.isPending) || patient.isPending) return <Loading />
  if (patient.isError) return <LoadError onRetry={patient.refetch} />

  const visitId = editing ? prescription.data.visit_id : Number(params.get('visit')) || null
  // Written before its visit was saved: back to the visit form, which links it on save.
  const returnTo = !editing && isVisitFormPath(params.get('returnTo')) ? params.get('returnTo') : null

  return (
    <PrescriptionEditor
      key={editing ? `edit-${id}` : `new-${id}`}
      patient={patient.data}
      prescription={editing ? prescription.data : null}
      visitId={visitId}
      returnTo={returnTo}
    />
  )
}

function PrescriptionEditor({ patient, prescription, visitId, returnTo }) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const save = useSavePrescription()
  const wide = useMediaQuery('(min-width: 1024px)')

  const [issuedOn, setIssuedOn] = useState(() => prescription?.issued_on ?? todayInClinic())
  const [notes, setNotes] = useState(() => prescription?.notes ?? '')
  const [lines, setLines] = useState(() => (prescription?.items.length ? prescription.items.map(lineFromItem) : [newLine()]))
  const [activeKey, setActiveKey] = useState(() => lines[0].key)
  // The drug highlighted in a line's open search list, which the side note shows before it is picked.
  const [highlight, setHighlight] = useState({ key: null, drug: null })
  const [submitted, setSubmitted] = useState(false)

  // Inputs per line ({ search, instructions }) and the one to focus after the next render.
  const inputs = useRef(new Map())
  const focusNext = useRef(null)
  // Keys of the lines in the order they were sent, to put the server's items.N errors back on them.
  const [sentKeys, setSentKeys] = useState([])

  useEffect(() => {
    const target = focusNext.current
    const element = target && inputs.current.get(target.key)?.[target.field]
    if (element) {
      element.focus()
      focusNext.current = null
    }
  })

  const inputRef = (key, field) => (element) => {
    const entry = inputs.current.get(key) ?? {}
    entry[field] = element
    inputs.current.set(key, entry)
  }

  const focusLater = (key, field) => {
    focusNext.current = { key, field }
  }

  const update = (key, fields) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...fields } : line)))

  const pickDrug = (key, drug) => {
    update(key, { drug, freeName: null, draft: '' })
    setHighlight({ key: null, drug: null })
    focusLater(key, 'instructions')
  }

  const takeAsWritten = (key, name) => {
    update(key, { drug: null, freeName: name.trim(), draft: '' })
    focusLater(key, 'instructions')
  }

  const change = (line) => {
    update(line.key, { drug: null, freeName: null, draft: line.drug?.trade_name ?? line.freeName ?? '' })
    focusLater(line.key, 'search')
  }

  /** A new empty line after `afterKey` (or at the end), with its search focused. */
  const addLine = (afterKey) => {
    if (lines.length >= MAX_LINES) return
    const line = newLine()
    setLines((current) => {
      const at = afterKey ? current.findIndex((l) => l.key === afterKey) + 1 : current.length
      return [...current.slice(0, at), line, ...current.slice(at)]
    })
    setActiveKey(line.key)
    focusLater(line.key, 'search')
  }

  const remove = (key) => {
    const index = lines.findIndex((line) => line.key === key)
    const rest = lines.filter((line) => line.key !== key)
    setLines(rest)
    if (activeKey === key) setActiveKey(rest[Math.min(index, rest.length - 1)].key)
  }

  const move = (key, step) =>
    setLines((current) => {
      const from = current.findIndex((line) => line.key === key)
      const to = from + step
      if (to < 0 || to >= current.length) return current
      const next = [...current]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })

  /** Enter in the instructions goes on to the next line: the empty one below, or a new one. */
  const onInstructionsKeyDown = (event, line) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const next = lines[lines.findIndex((l) => l.key === line.key) + 1]
    if (next && isBlank(next)) {
      inputs.current.get(next.key)?.search?.focus()
    } else {
      addLine(line.key)
    }
  }

  // The side note follows the line being edited: its highlighted result, else its chosen drug.
  const activeLine = lines.find((line) => line.key === activeKey) ?? lines[0]
  const shown = (highlight.key === activeLine.key && highlight.drug) || activeLine.drug
  const sideNote = (
    <DrugInfoPanel
      drugId={shown?.id ?? null}
      preview={shown}
      freeText={shown ? null : activeLine.freeName}
      onUseDose={(text) => {
        update(activeLine.key, { instructions: text })
        focusLater(activeLine.key, 'instructions')
      }}
    />
  )

  const serverErrors = fieldErrors(save.error)
  const hasServerErrors = Object.keys(serverErrors).length > 0
  const formError = save.error && !hasServerErrors ? errorMessage(save.error, t('common.networkError')) : ''
  const otherServerError = serverErrors.items ?? serverErrors.visit_id

  const filled = lines.filter((line) => !isBlank(line))
  const problems = new Map(filled.map((line) => [line.key, lineProblem(line)]))
  const errorFor = (line) => {
    const problem = submitted ? problems.get(line.key) : null
    if (problem) return t(`prescriptionForm.${problem}`, { max: MAX_INSTRUCTIONS })
    const sent = sentKeys.indexOf(line.key)
    return sent >= 0 ? lineServerError(serverErrors, sent) : undefined
  }
  const noLines = submitted && filled.length === 0

  const submit = (print) => {
    setSubmitted(true)
    if (filled.length === 0 || [...problems.values()].some(Boolean) || save.isPending) return
    setSentKeys(filled.map((line) => line.key))
    save.mutate(
      {
        id: prescription?.id,
        patientId: patient.id,
        fields: {
          visit_id: visitId,
          issued_on: issuedOn,
          notes: notes.trim() || null,
          items: filled.map((line) => ({
            ...(line.drug ? { drug_id: line.drug.id } : { drug_name: line.freeName }),
            instructions: line.instructions.trim(),
          })),
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(t('prescriptionForm.saved'))
          if (returnTo) addDraftPrescription(returnTo, saved.id)
          if (print) navigate(`/doctor/prescriptions/${saved.id}/print`, { state: { returnTo } })
          else navigate(returnTo ?? `/doctor/patients/${patient.id}`)
        },
      },
    )
  }

  const age = ageOn(patient.date_of_birth, issuedOn)
  const visit = visitId ? patient.visits?.find((v) => v.id === visitId) : null
  const reminders = (patient.history ?? []).filter((entry) => REMINDER_TYPES.includes(entry.type))

  return (
    <Form
     
      onSubmit={(event) => {
        event.preventDefault()
        submit(false)
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to={`/doctor/patients/${patient.id}`} className="text-sm text-sky-700 hover:underline">
            {t('prescriptionForm.back', { name: patient.name })}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            {t(prescription ? 'pages.editPrescription' : 'pages.newPrescription')}
          </h1>
          <p className="mt-1 text-slate-700">
            <span className="font-semibold">{patient.name}</span>
            {age !== null && <span className="text-sm text-slate-500"> · {t('prescriptionForm.age', { age })}</span>}
          </p>
          {visit && <p className="text-sm text-slate-500">{t('prescriptionForm.forVisit', { date: formatDate(visit.visit_date) })}</p>}
          {returnTo && <p className="text-sm text-slate-500">{t('prescriptionForm.forTodaysVisit')}</p>}
        </div>
        <TextField
          type="date"
          label={t('prescriptionForm.date')}
          value={issuedOn}
          onChange={(event) => setIssuedOn(event.target.value)}
          error={serverErrors.issued_on}
          className="w-44"
        />
      </div>

      {reminders.length > 0 && (
        <div role="note" aria-label={t('prescriptionForm.reminder')} className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="text-sm font-semibold text-amber-900">{t('prescriptionForm.reminder')}</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
            {reminders.map((entry) => (
              <li key={entry.id}>
                <span className="font-semibold">{t(`history.types.${entry.type}`)}:</span>{' '}
                <span dir="auto">{entry.title}</span>
                {entry.details && (
                  <span dir="auto" className="text-amber-800">
                    {' — '}
                    {entry.details}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(formError || otherServerError) && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError || otherServerError}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          <Card title={t('prescriptionForm.lines')}>
            <ol className="space-y-3">
              {lines.map((line, index) => {
                const number = index + 1
                const error = errorFor(line)
                const errorId = `rx-line-${line.key}-error`
                const chosenName = line.drug?.trade_name ?? line.freeName
                return (
                  <li key={line.key}>
                    <div
                      role="group"
                      aria-label={t('prescriptionForm.line', { number })}
                      onFocus={() => setActiveKey(line.key)}
                      className={`flex gap-3 rounded-xl p-3 ring-1 ${
                        line.key === activeLine.key ? 'bg-sky-50/50 ring-sky-200' : 'ring-slate-200'
                      }`}
                    >
                      <span aria-hidden="true" className="pt-2 text-sm font-bold text-slate-500">
                        {number}.
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        {chosenName ? (
                          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <span dir="auto" className="min-w-0 truncate font-semibold text-slate-900">
                              {chosenName}
                            </span>
                            {line.drug?.form && (
                              <span dir="auto" className="text-xs text-slate-500">
                                {line.drug.form}
                              </span>
                            )}
                            {line.freeName && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                                {t('prescriptionForm.notInCatalogue')}
                              </span>
                            )}
                            <button
                              type="button"
                              ref={inputRef(line.key, 'search')}
                              onClick={() => change(line)}
                              aria-label={t('prescriptionForm.changeDrug', { name: chosenName })}
                              className="ms-auto text-sm font-semibold text-sky-700 hover:underline"
                            >
                              {t('prescriptionForm.change')}
                            </button>
                          </div>
                        ) : (
                          // Enter in DrugSearch never submits the whole form.
                          <DrugSearch
                            label={t('prescriptionForm.drugFor', { number })}
                            initialQuery={line.draft}
                            inputRef={inputRef(line.key, 'search')}
                            onInputChange={(text) => update(line.key, { draft: text })}
                            onSelect={(drug) => pickDrug(line.key, drug)}
                            onFreeText={(name) => takeAsWritten(line.key, name)}
                            onHighlight={(drug) => setHighlight({ key: line.key, drug })}
                            invalid={Boolean(error) && !chosenName}
                            describedBy={error ? errorId : undefined}
                          />
                        )}
                        <input
                          ref={inputRef(line.key, 'instructions')}
                          type="text"
                          dir="auto"
                          aria-label={t('prescriptionForm.instructionsFor', { number })}
                          aria-invalid={error && chosenName ? true : undefined}
                          aria-describedby={error ? errorId : undefined}
                          placeholder={t('prescriptionForm.instructionsPlaceholder')}
                          value={line.instructions}
                          onChange={(event) => update(line.key, { instructions: event.target.value })}
                          onKeyDown={(event) => onInstructionsKeyDown(event, line)}
                          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                            error && chosenName ? 'border-red-600 focus:ring-red-600' : 'border-slate-500 focus:ring-sky-600'
                          }`}
                        />
                        {error && (
                          <p id={errorId} className="text-sm text-red-600">
                            {error}
                          </p>
                        )}
                        {!wide && line.key === activeLine.key && sideNote}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => move(line.key, -1)}
                          disabled={index === 0}
                          aria-label={t('prescriptionForm.moveUp', { number })}
                          className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(line.key, 1)}
                          disabled={index === lines.length - 1}
                          aria-label={t('prescriptionForm.moveDown', { number })}
                          className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(line.key)}
                          disabled={lines.length === 1}
                          aria-label={t('prescriptionForm.remove', { number })}
                          className="rounded px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>

            {noLines && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {t('prescriptionForm.needLine')}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => addLine()}
                disabled={lines.length >= MAX_LINES}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50 disabled:opacity-50"
              >
                + {t('prescriptionForm.addLine')}
              </button>
              {lines.length >= MAX_LINES && <p className="text-sm text-slate-500">{t('prescriptionForm.maxLines', { max: MAX_LINES })}</p>}
            </div>
          </Card>

          <Card>
            <TextAreaField
              label={t('prescriptionForm.notes')}
              hint={t('prescriptionForm.notesHint')}
              rows={3}
              dir="auto"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              error={serverErrors.notes}
            />
          </Card>
        </div>

        {wide && sideNote}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => navigate(-1)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-lg px-5 py-2 text-sm font-semibold text-sky-700 ring-1 ring-sky-300 hover:bg-sky-50 disabled:opacity-60"
        >
          {save.isPending ? t('common.saving') : t('common.save')}
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={save.isPending}
          className="rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {t('prescriptionForm.saveAndPrint')}
        </button>
      </div>
    </Form>
  )
}
