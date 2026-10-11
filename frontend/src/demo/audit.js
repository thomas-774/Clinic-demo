import * as db from './db'

/**
 * The source app's audit log (AuditLogger + the Auditable trait, NFR-S.4):
 * creating, changing or deleting a medical or money record, and some reads,
 * write an audit_logs row. Patients' own actions and guests are not logged.
 */

/** Model → its morph class, as stored in audit_logs.auditable_type. */
export const MODELS = {
  patients: 'App\\Models\\Patient',
  medical_history_entries: 'App\\Models\\MedicalHistoryEntry',
  visits: 'App\\Models\\Visit',
  payments: 'App\\Models\\Payment',
  prescriptions: 'App\\Models\\Prescription',
  prescription_items: 'App\\Models\\PrescriptionItem',
}

const IGNORED = ['created_at', 'updated_at']
const READS = ['viewed', 'exported', 'printed']

/** The patient a row belongs to (auditPatientId()). */
export function patientIdOf(table, row) {
  switch (table) {
    case 'patients':
      return row.id
    case 'payments':
      return db.find('visits', row.visit_id)?.patient_id ?? null
    case 'prescription_items':
      return db.find('prescriptions', row.prescription_id)?.patient_id ?? null
    default:
      return row.patient_id ?? null
  }
}

/** AuditLogger::record(). Reads are logged once per request. */
export function record(ctx, action, table, row, changedFields = []) {
  const user = ctx.user
  if (!user || user.role === 'patient') return null

  if (READS.includes(action)) {
    const key = `${action}|${table}|${row.id}`
    ctx.auditedReads ??= new Set()
    if (ctx.auditedReads.has(key)) return null
    ctx.auditedReads.add(key)
  }

  const log = db.insert('audit_logs', {
    user_id: user.id,
    user_role: user.role,
    action,
    auditable_type: MODELS[table],
    auditable_id: row.id,
    patient_id: patientIdOf(table, row),
    changed_fields: changedFields.length ? changedFields.map(String) : null,
    ip: ctx.ip ?? null,
    user_agent: ctx.userAgent ? String(ctx.userAgent).slice(0, 252) : null,
  })
  delete log.updated_at // audit_logs has no updated_at (append-only)
  return log
}

// ---- writes that audit themselves, like models using the Auditable trait ----

export function create(ctx, table, values) {
  const row = db.insert(table, values)
  record(ctx, 'created', table, row)
  return row
}

/** Updates the row; logs the columns that really changed (getChanges()). */
export function update(ctx, table, row, values) {
  const changed = Object.keys(values).filter((key) => !IGNORED.includes(key) && JSON.stringify(row[key] ?? null) !== JSON.stringify(values[key] ?? null))
  if (!changed.length) return row
  db.update(table, row.id, values)
  record(ctx, 'updated', table, row, changed)
  return row
}

export function remove(ctx, table, row) {
  db.remove(table, row.id)
  record(ctx, 'deleted', table, row)
}
