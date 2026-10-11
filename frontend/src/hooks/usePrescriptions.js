import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPrescription,
  deletePrescription,
  getPrescription,
  listPrescriptions,
  updatePrescription,
} from '../api/prescriptions'
import { patientsKey } from './usePatients'

export const prescriptionsKey = ['doctor', 'prescriptions']

export const prescriptionKey = (id) => [...prescriptionsKey, 'one', String(id)]

/** The patient's prescriptions list (FR-J.7). */
export function usePatientPrescriptions(patientId, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...prescriptionsKey, 'patient', String(patientId)],
    queryFn: () => listPrescriptions(patientId),
    enabled: enabled && Boolean(patientId),
  })
}

/**
 * One full prescription, for the form and (with `purpose: 'print'`) the print page. The
 * print page always asks the server, so every print is audited (NFR-S.4).
 */
export function usePrescription(id, { enabled = true, purpose } = {}) {
  return useQuery({
    queryKey: purpose ? [...prescriptionKey(id), purpose] : prescriptionKey(id),
    queryFn: () => (purpose ? getPrescription(id, { purpose }) : getPrescription(id)),
    enabled: enabled && Boolean(id),
    ...(purpose && { gcTime: 0 }),
  })
}

/** Prescriptions show on the patient page (list and count), so both are refreshed after a change. */
function useRefreshAfterPrescription() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: prescriptionsKey }),
      queryClient.invalidateQueries({ queryKey: patientsKey }),
    ])
}

/** Writes a new prescription (`patientId`) or edits one (`id`); resolves to the full prescription. */
export function useSavePrescription() {
  const queryClient = useQueryClient()
  const refresh = useRefreshAfterPrescription()
  return useMutation({
    mutationFn: ({ id, patientId, fields }) => (id ? updatePrescription(id, fields) : createPrescription(patientId, fields)),
    onSuccess: (prescription) => {
      queryClient.setQueryData(prescriptionKey(prescription.id), prescription)
      return refresh()
    },
  })
}

/**
 * Links prescriptions written before their visit was saved to it:
 * `mutateAsync({ ids, visitId })`. The update replaces every field, so each is
 * sent back as it is, with only `visit_id` changed.
 */
export function useLinkPrescriptions() {
  return useMutation({
    mutationFn: ({ ids, visitId }) =>
      Promise.all(
        ids.map(async (id) => {
          const prescription = await getPrescription(id)
          return updatePrescription(id, {
            visit_id: visitId,
            issued_on: prescription.issued_on,
            notes: prescription.notes,
            items: prescription.items.map((item) => ({
              ...(item.drug_id ? { drug_id: item.drug_id } : { drug_name: item.drug_name }),
              instructions: item.instructions,
            })),
          })
        }),
      ),
    onSuccess: useRefreshAfterPrescription(),
  })
}

export function useDeletePrescription() {
  return useMutation({ mutationFn: (id) => deletePrescription(id), onSuccess: useRefreshAfterPrescription() })
}
