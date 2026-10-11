import * as audit from '../audit'
import { nowLocal } from '../clock'
import * as db from '../db'
import { resource } from '../http'
import * as resources from '../resources'
import { normalizePhone, phoneRules } from '../rules'
import { clinicSettings } from '../services/slots'
import { validate } from '../validate'
import { ownPatient } from './schedule'
import { __ } from './shared'

/** The patient's own profile (Patient\ProfileController, FR-B). */

const present = (patient) => resources.patientProfile(patient, { now: nowLocal(), cutoffHours: clinicSettings().cancel_cutoff_hours })

export const show = (ctx) => resource(present(ownPatient(ctx)))

/** PATCH /patient/profile: phone and address only (FR-B.5). */
export function update(ctx) {
  const patient = ownPatient(ctx)
  const input = normalizePhone({ ...ctx.input })
  const data = validate(ctx, input, {
    phone: ['sometimes', 'required', ...phoneRules(ctx.user.id)],
    address: ['sometimes', 'required', 'string', 'max:255'],
  })
  if (Object.hasOwn(data, 'phone')) db.update('users', ctx.user.id, { phone: data.phone })
  // The patient's own changes are not audited (AuditLogger skips patients).
  if (Object.hasOwn(data, 'address')) audit.update(ctx, 'patients', patient, { address: data.address })
  return resource(present(patient), __(ctx, 'Profile updated.'))
}
