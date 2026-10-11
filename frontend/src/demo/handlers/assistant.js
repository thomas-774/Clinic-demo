import * as audit from '../audit'
import { nowLocal, today } from '../clock'
import * as db from '../db'
import { resource } from '../http'
import * as resources from '../resources'
import { normalizePhone } from '../rules'
import * as payments from '../services/payments'
import { validate } from '../validate'
import { createPatientAccount, listPatients, storePatientRules, updatePatientRules, updatePatientRecord } from './doctor/patients'
import { storePaymentFor } from './doctor/visits'
import { __, bind } from './shared'

/** The front desk (Module I): contact info and money only (Assistant\PatientController, VisitController). */

const present = (patient) => resources.assistantPatient(patient, nowLocal())
const CONTACT_FIELDS = ['address', 'date_of_birth', 'gender']

/** GET /assistant/patients?search=: the same list and search as the doctor's. */
export const index = (ctx) => listPatients(ctx, resources.patientListItem)

/** POST /assistant/patients: a new patient; the initial password is in this response only. */
export function store(ctx) {
  const data = validate(ctx, normalizePhone({ ...ctx.input }), storePatientRules({ withIllness: false }))
  const [patient, password] = createPatientAccount(ctx, data, CONTACT_FIELDS)
  return resource({ ...present(patient), initial_password: password }, __(ctx, 'Patient account created.'), 201)
}

/** GET /assistant/patients/{patient}: audited like the doctor's page (NFR-S.4). */
export function show(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  audit.record(ctx, 'viewed', 'patients', patient)
  return resource(present(patient))
}

/** PUT /assistant/patients/{patient}: contact info only. */
export function update(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  const data = validate(ctx, normalizePhone({ ...ctx.input }), updatePatientRules(patient, { withIllness: false }))
  updatePatientRecord(ctx, patient, data, CONTACT_FIELDS)
  return resource(present(patient), __(ctx, 'Patient updated.'))
}

const visitWithPatient = (visit) => resources.assistantVisit(visit, { withPatient: true, withPayments: true })

/** GET /assistant/visits/unpaid?date=: that day's visits (today by default) that still owe, oldest first. */
export function unpaid(ctx) {
  const data = validate(ctx, ctx.input, { date: ['nullable', 'date_format:Y-m-d'] })
  const date = data.date ?? today()
  const rows = db
    .where('visits', (v) => v.visit_date === date && payments.remainingPiastres(v) > 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
  return resource(rows.map(visitWithPatient))
}

/** POST /assistant/visits/{visit}/payments: same rules as the doctor's installments (PR-2). */
export const storePayment = (ctx) => storePaymentFor(ctx, visitWithPatient)
