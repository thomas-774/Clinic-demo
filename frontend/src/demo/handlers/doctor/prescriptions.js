import * as audit from '../../audit'
import { today } from '../../clock'
import * as db from '../../db'
import { json, resource } from '../../http'
import * as resources from '../../resources'
import { exists, validate } from '../../validate'
import { __, bind } from '../shared'

/** Doctor → prescriptions (PrescriptionController, PrescriptionService, FR-J). */

export const MAX_ITEMS = 15

/** StorePrescriptionRequest; the after() check is RX-5 (the visit is this patient's). */
function prescriptionInput(ctx, patient) {
  return validate(
    ctx,
    ctx.input,
    {
      visit_id: ['nullable', 'integer', exists('visits')],
      issued_on: ['nullable', 'date_format:Y-m-d'],
      notes: ['nullable', 'string', 'max:1000'],
      items: ['required', 'array', 'min:1', `max:${MAX_ITEMS}`],
      'items.*': ['array'],
      'items.*.drug_id': ['nullable', 'integer', exists('drugs')],
      'items.*.drug_name': ['nullable', 'required_without:items.*.drug_id', 'string', 'max:150'],
      'items.*.instructions': ['required', 'string', 'max:255'],
    },
    {
      attributes: {
        visit_id: 'visit',
        issued_on: 'prescription date',
        notes: 'notes',
        items: 'prescription lines',
        'items.*.drug_id': 'drug',
        'items.*.drug_name': 'drug',
        'items.*.instructions': 'instructions',
      },
      messages: { 'items.*.drug_name.required_without': __(ctx, 'Choose a drug or write its name.') },
      after(add, errors) {
        if (Object.keys(errors).length || !ctx.input.visit_id) return
        if (db.find('visits', ctx.input.visit_id)?.patient_id !== patient.id) {
          add('visit_id', __(ctx, 'This visit belongs to another patient.'))
        }
      },
    },
  )
}

/** PrescriptionService::save(): the header, then the lines replaced; catalogue lines copy the drug's name and form (RX-2). */
function save(ctx, patient, data, existing = null) {
  // The keys are the order the doctor wrote the lines in.
  const items = Object.entries(data.items)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, item]) => item)
  const header = {
    visit_id: data.visit_id ? Number(data.visit_id) : null,
    issued_on: data.issued_on ?? existing?.issued_on ?? today(),
    notes: data.notes ?? null,
  }
  const prescription = existing
    ? audit.update(ctx, 'prescriptions', existing, header)
    : audit.create(ctx, 'prescriptions', { patient_id: patient.id, doctor_id: ctx.user.id, ...header })

  // A query delete in the source: the old lines go without audit rows.
  db.remove('prescription_items', { prescription_id: prescription.id })
  items.forEach((item, index) => {
    const drug = item.drug_id ? db.find('drugs', item.drug_id) : null
    audit.create(ctx, 'prescription_items', {
      prescription_id: prescription.id,
      drug_id: drug?.id ?? null,
      drug_name: drug?.trade_name ?? String(item.drug_name).trim(),
      drug_form: drug?.form ?? null,
      instructions: String(item.instructions).trim(),
      position: index + 1,
    })
  })
  return prescription
}

/** GET /doctor/patients/{patient}/prescriptions: newest first, with drug names (FR-J.7). */
export function index(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  const rows = db.where('prescriptions', { patient_id: patient.id }).sort((a, b) => b.issued_on.localeCompare(a.issued_on) || b.id - a.id)
  return resource(rows.map(resources.prescriptionListItem))
}

export function store(ctx) {
  const patient = bind(ctx, 'patients', 'patient')
  const data = prescriptionInput(ctx, patient)
  const prescription = save(ctx, patient, data)
  return resource(resources.prescription(prescription), __(ctx, 'Prescription saved.'), 201)
}

/** GET /doctor/prescriptions/{prescription}[?purpose=print]: audited as printed or viewed (NFR-S.4). */
export function show(ctx) {
  const prescription = bind(ctx, 'prescriptions', 'prescription')
  audit.record(ctx, ctx.query.purpose === 'print' ? 'printed' : 'viewed', 'prescriptions', prescription)
  return resource(resources.prescription(prescription))
}

export function update(ctx) {
  const prescription = bind(ctx, 'prescriptions', 'prescription')
  const patient = db.find('patients', prescription.patient_id)
  const data = prescriptionInput(ctx, patient)
  save(ctx, patient, data, prescription)
  return resource(resources.prescription(prescription), __(ctx, 'Prescription updated.'))
}

/** DELETE /doctor/prescriptions/{prescription}: the lines go with it. */
export function destroy(ctx) {
  const prescription = bind(ctx, 'prescriptions', 'prescription')
  audit.remove(ctx, 'prescriptions', prescription)
  db.remove('prescription_items', { prescription_id: prescription.id })
  return json({ data: null, message: __(ctx, 'Prescription deleted.') })
}
