import * as audit from '../../audit'
import * as db from '../../db'
import { abort, json, paginate, resource } from '../../http'
import * as resources from '../../resources'
import { normalizePhone, phoneRules } from '../../rules'
import { unique, oneOf, validate } from '../../validate'
import { __, bind, boolean, byPatientName, initialPassword, only, patientMatches } from '../shared'

/** Doctor → patients and their medical history (Doctor\PatientController, MedicalHistoryController). */

const PER_PAGE = 20

/** StorePatientRequest (the assistant's version leaves out current_illness). */
export const storePatientRules = ({ withIllness = true } = {}) => ({
  name: ['required', 'string', 'max:120'],
  phone: ['required', ...phoneRules()],
  email: ['nullable', 'string', 'email', 'max:150', unique('users', 'email')],
  address: ['required', 'string', 'max:255'],
  date_of_birth: ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
  gender: ['nullable', 'in:male,female'],
  ...(withIllness ? { current_illness: ['nullable', 'string', 'max:2000'] } : {}),
})

/** UpdatePatientRequest */
export const updatePatientRules = (patient, { withIllness = true } = {}) => ({
  name: ['required', 'string', 'max:120'],
  phone: ['required', ...phoneRules(patient.user_id)],
  address: ['required', 'string', 'max:255'],
  date_of_birth: ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
  gender: ['nullable', 'in:male,female'],
  ...(withIllness ? { current_illness: ['nullable', 'string', 'max:2000'] } : {}),
})

/** The patient list (FR-C.1, FR-I.2): by name or phone, sorted by name. */
export function listPatients(ctx, map) {
  const search = String(ctx.query.search ?? '').trim()
  const rows = db
    .where('patients', (p) => patientMatches(p, search))
    .sort(byPatientName)
  return paginate(ctx, rows, map, { perPage: PER_PAGE })
}

/** PatientAccountService::create(): the account, its patient record and the one-time password. */
export function createPatientAccount(ctx, data, patientFields) {
  const password = initialPassword()
  const account = db.insert('users', { name: data.name, phone: data.phone, email: data.email ?? null, password, role: 'patient', is_active: true })
  const patient = audit.create(ctx, 'patients', {
    user_id: account.id,
    address: data.address,
    date_of_birth: data.date_of_birth ?? null,
    gender: data.gender ?? null,
    current_illness: null,
    ...only(data, patientFields),
  })
  return [patient, password]
}

/** Updates the account (name, phone) and the patient fields that were sent. */
export function updatePatientRecord(ctx, patient, data, patientFields) {
  db.update('users', patient.user_id, only(data, ['name', 'phone']))
  audit.update(ctx, 'patients', patient, only(data, patientFields))
}

export const index = (ctx) => listPatients(ctx, resources.patientListItem)

/** POST /doctor/patients: the initial password is in this response only (FR-C.6). */
export function store(ctx) {
  const data = validate(ctx, normalizePhone({ ...ctx.input }), storePatientRules())
  const [patient, password] = createPatientAccount(ctx, data, ['address', 'date_of_birth', 'gender', 'current_illness'])
  return resource({ ...resources.patient(patient), initial_password: password }, __(ctx, 'Patient account created.'), 201)
}

/** GET /doctor/patients/{patient}: the full profile; this read is audited (NFR-S.4). */
export function show(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  audit.record(ctx, 'viewed', 'patients', patient)
  return resource(resources.patientDetail(patient))
}

export function update(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  const data = validate(ctx, normalizePhone({ ...ctx.input }), updatePatientRules(patient))
  updatePatientRecord(ctx, patient, data, ['address', 'date_of_birth', 'gender', 'current_illness'])
  return resource(resources.patientDetail(patient), __(ctx, 'Patient updated.'))
}

// ---- medical history (doctor only, FR-C.4) ----

const HISTORY_TYPES = ['condition', 'allergy', 'surgery', 'medication', 'note']

/** HistoryEntryRequest::entryAttributes(); patient_visible is false unless sent as true. */
function historyAttributes(ctx) {
  const data = validate(ctx, ctx.input, {
    type: ['required', oneOf(HISTORY_TYPES)],
    title: ['required', 'string', 'max:150'],
    details: ['nullable', 'string', 'max:5000'],
    patient_visible: ['sometimes', 'boolean'],
    recorded_on: ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
  })
  return { ...only(data, ['type', 'title', 'details', 'recorded_on']), patient_visible: boolean(ctx.input.patient_visible) }
}

/** scopeBindings(): the entry must belong to the patient in the URL. */
function bindEntry(ctx, patient) {
  const entry = bind(ctx, 'medical_history_entries', 'entry')
  if (entry.patient_id !== patient.id) abort(ctx, 404)
  return entry
}

export function storeHistory(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  const attributes = historyAttributes(ctx)
  const entry = audit.create(ctx, 'medical_history_entries', { patient_id: patient.id, details: null, ...attributes })
  return resource(resources.historyEntry(entry), __(ctx, 'History entry added.'), 201)
}

export function updateHistory(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  const entry = bindEntry(ctx, patient)
  audit.update(ctx, 'medical_history_entries', entry, historyAttributes(ctx))
  return resource(resources.historyEntry(entry), __(ctx, 'History entry updated.'))
}

export function destroyHistory(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  const entry = bindEntry(ctx, patient)
  audit.remove(ctx, 'medical_history_entries', entry)
  return json({ data: null, message: __(ctx, 'History entry deleted.') })
}
