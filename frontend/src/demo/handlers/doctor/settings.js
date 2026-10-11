import { toIso } from '../../clock'
import * as db from '../../db'
import { abort, paginate, resource } from '../../http'
import { hasLine, translate } from '../../lang'
import { MODELS } from '../../audit'
import { normalizePhone, phoneRules } from '../../rules'
import { oneOf, unique, validate } from '../../validate'
import { __, bind, boolean, initialPassword, only } from '../shared'

/** Doctor → settings, staff and the audit log (SettingsController, StaffController, AuditLogController). */

const DEFAULT_SETTINGS = { slot_duration_minutes: 45, booking_window_days: 30, cancel_cutoff_hours: 2, prescription_paper: 'A5' }
const PRINT_FIELDS = ['clinic_name', 'doctor_title', 'clinic_address', 'clinic_phone', 'prescription_footer']

/** The doctor's settings row, created with the defaults when missing. */
function settingsRow(ctx) {
  return (
    db.first('doctor_settings', { doctor_id: ctx.user.id }) ??
    db.insert('doctor_settings', { doctor_id: ctx.user.id, ...DEFAULT_SETTINGS, ...Object.fromEntries(PRINT_FIELDS.map((f) => [f, null])) })
  )
}

/** DoctorSettingResource */
const settingsResource = (row) => ({
  slot_duration_minutes: row.slot_duration_minutes,
  booking_window_days: row.booking_window_days,
  cancel_cutoff_hours: row.cancel_cutoff_hours,
  clinic_name: row.clinic_name ?? null,
  doctor_title: row.doctor_title ?? null,
  clinic_address: row.clinic_address ?? null,
  clinic_phone: row.clinic_phone ?? null,
  prescription_footer: row.prescription_footer ?? null,
  prescription_paper: row.prescription_paper,
})

export const showSettings = (ctx) => resource(settingsResource(settingsRow(ctx)))

export function updateSettings(ctx) {
  const row = settingsRow(ctx)
  const data = validate(
    ctx,
    ctx.input,
    {
      slot_duration_minutes: ['sometimes', 'required', 'integer', 'between:10,240'],
      booking_window_days: ['sometimes', 'required', 'integer', 'between:1,90'],
      cancel_cutoff_hours: ['sometimes', 'required', 'integer', 'between:0,72'],
      clinic_name: ['sometimes', 'nullable', 'string', 'max:150'],
      doctor_title: ['sometimes', 'nullable', 'string', 'max:150'],
      clinic_address: ['sometimes', 'nullable', 'string', 'max:150'],
      clinic_phone: ['sometimes', 'nullable', 'string', 'max:150'],
      prescription_footer: ['sometimes', 'nullable', 'string', 'max:255'],
      prescription_paper: ['sometimes', 'required', oneOf(['A5', 'A4'], 'in')],
    },
    {
      attributes: {
        clinic_name: 'clinic name',
        doctor_title: 'doctor title',
        clinic_address: 'clinic address',
        clinic_phone: 'clinic phone',
        prescription_footer: 'prescription footer',
        prescription_paper: 'paper size',
      },
    },
  )
  // Integer columns: "45" is stored as 45.
  for (const field of ['slot_duration_minutes', 'booking_window_days', 'cancel_cutoff_hours']) {
    if (Object.hasOwn(data, field)) data[field] = Number(data[field])
  }
  db.update('doctor_settings', row.id, data)
  return resource(settingsResource(row), __(ctx, 'Settings saved.'))
}

// ---- staff (assistant accounts, FR-I.1) ----

/** StaffResource */
const staffResource = (row) => ({ id: row.id, name: row.name, phone: row.phone, email: row.email, role: row.role, is_active: row.is_active })

const nameOrder = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/** GET /doctor/staff: every assistant, active ones first, then by name. */
export function staffIndex() {
  const rows = db.where('users', { role: 'assistant' }).sort((a, b) => Number(b.is_active) - Number(a.is_active) || nameOrder.compare(a.name, b.name) || a.id - b.id)
  return resource(rows.map(staffResource))
}

/** POST /doctor/staff: the initial password is in this response only. */
export function staffStore(ctx) {
  const data = validate(ctx, normalizePhone({ ...ctx.input }), {
    name: ['required', 'string', 'max:120'],
    phone: ['required', ...phoneRules()],
    email: ['nullable', 'string', 'email', 'max:150', unique('users', 'email')],
  })
  const password = initialPassword()
  const user = db.insert('users', { name: data.name, phone: data.phone, email: data.email ?? null, password, role: 'assistant', is_active: true })
  return resource({ ...staffResource(user), initial_password: password }, __(ctx, 'Assistant account created.'), 201)
}

/** PUT /doctor/staff/{staff}: edit, (de)activate, reset password; the last two log every session out. */
export function staffUpdate(ctx) {
  const staff = bind(ctx, 'users', 'staff')
  if (staff.role !== 'assistant') abort(ctx, 404)
  const data = validate(ctx, normalizePhone({ ...ctx.input }), {
    name: ['sometimes', 'required', 'string', 'max:120'],
    phone: ['sometimes', 'required', ...phoneRules(staff.id)],
    email: ['sometimes', 'nullable', 'string', 'email', 'max:150', unique('users', 'email', staff.id)],
    is_active: ['sometimes', 'boolean'],
    reset_password: ['sometimes', 'boolean'],
  })
  const password = boolean(ctx.input.reset_password) ? initialPassword() : null
  const changes = only(data, ['name', 'phone', 'email', 'is_active'])
  if (Object.hasOwn(changes, 'is_active')) changes.is_active = boolean(changes.is_active)
  if (password !== null) changes.password = password
  db.update('users', staff.id, changes)
  if (password !== null || !staff.is_active) db.remove('tokens', { user_id: staff.id })
  const out = staffResource(staff)
  return resource(password === null ? out : { ...out, initial_password: password }, __(ctx, 'Assistant updated.'))
}

// ---- the audit log (Settings → Activity, NFR-S.5) ----

const RECORD_TYPES = Object.fromEntries(
  Object.entries({ patients: 'patient', medical_history_entries: 'history_entry', visits: 'visit', payments: 'payment', prescriptions: 'prescription', prescription_items: 'prescription_item' }).map(
    ([table, type]) => [MODELS[table], type],
  ),
)

/** A translated label, or the code made readable ("work_done" → "Work done"). */
function label(ctx, key, code) {
  if (hasLine(ctx.locale, key)) return translate(ctx.locale, key)
  const text = code.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** AuditLogResource */
function auditLogResource(ctx, row) {
  const type = RECORD_TYPES[row.auditable_type] ?? row.auditable_type.split('\\').pop().toLowerCase()
  const user = row.user_id ? db.find('users', row.user_id) : null
  const patient = row.patient_id ? db.find('patients', row.patient_id) : null
  return {
    id: row.id,
    created_at: toIso(row.created_at),
    action: row.action,
    user: user ? { id: user.id, name: user.name } : null,
    user_role: row.user_role,
    record: { type, id: row.auditable_id, label: label(ctx, `audit.records.${type}`, type) },
    patient: patient ? { id: patient.id, name: db.find('users', patient.user_id).name } : null,
    changed_fields: (row.changed_fields ?? []).map((field) => ({ name: field, label: label(ctx, `audit.fields.${field}`, field) })),
    ip: row.ip,
  }
}

/** GET /doctor/audit-logs?patient_id=&user_id=&action=&from=&to=&page=: newest first, 50 per page. */
export function auditIndex(ctx) {
  const filters = validate(ctx, ctx.input, {
    patient_id: ['nullable', 'integer'],
    user_id: ['nullable', 'integer'],
    action: ['nullable', oneOf(['viewed', 'created', 'updated', 'deleted', 'exported', 'printed'])],
    from: ['nullable', 'date_format:Y-m-d'],
    to: ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
    page: ['nullable', 'integer', 'min:1'],
  })
  const rows = db
    .where(
      'audit_logs',
      (row) =>
        (!filters.patient_id || row.patient_id === Number(filters.patient_id)) &&
        (!filters.user_id || row.user_id === Number(filters.user_id)) &&
        (!filters.action || row.action === filters.action) &&
        (!filters.from || row.created_at >= `${filters.from} 00:00:00`) &&
        (!filters.to || row.created_at <= `${filters.to} 23:59:59`),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
  const patient = filters.patient_id ? db.find('patients', filters.patient_id) : null
  return paginate(ctx, rows, (row) => auditLogResource(ctx, row), {
    perPage: 50,
    // When filtered by patient, name them even on an empty page.
    extra: { filters: { patient: patient ? { id: patient.id, name: db.find('users', patient.user_id).name } : null } },
  })
}

