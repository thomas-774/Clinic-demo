/**
 * A visit being written while the doctor writes its prescription first (before
 * the cost is known). Kept for this browser tab only, keyed by the visit form's
 * URL, so going to the prescription and back keeps what was typed. The
 * prescriptions saved meanwhile are linked to the visit once it is saved.
 * Storage can throw (private mode, blocked site data): the draft is then lost.
 */
const KEY = 'clinic.visitDraft'
const MAX_AGE_MS = 12 * 60 * 60 * 1000

/** Only the visit form may be returned to from the prescription form. */
export const isVisitFormPath = (path) => typeof path === 'string' && path.startsWith('/doctor/visits/new')

/** The draft for the visit form at `url`, or null: { url, form, prescriptionIds }. */
export function loadVisitDraft(url) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY))
    if (draft?.url !== url || Date.now() - draft.savedAt > MAX_AGE_MS) return null
    return { ...draft, prescriptionIds: Array.isArray(draft.prescriptionIds) ? draft.prescriptionIds : [] }
  } catch {
    return null
  }
}

/** Keeps the visit form at `url`, with the prescriptions already written for it. */
export function saveVisitDraft(url, form) {
  const prescriptionIds = loadVisitDraft(url)?.prescriptionIds ?? []
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ url, form, prescriptionIds, savedAt: Date.now() }))
  } catch {
    // ignore: the visit form then starts empty again
  }
}

/** Records a prescription written for the draft visit at `url`. */
export function addDraftPrescription(url, prescriptionId) {
  const draft = loadVisitDraft(url)
  if (!draft) return
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...draft, prescriptionIds: [...new Set([...draft.prescriptionIds, prescriptionId])], savedAt: Date.now() }),
    )
  } catch {
    // ignore: the prescription stays on the patient, just not linked to the visit
  }
}

export function clearVisitDraft() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
