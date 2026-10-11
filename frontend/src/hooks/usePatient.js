import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addHistoryEntry,
  deleteHistoryEntry,
  getPatient,
  updateHistoryEntry,
  updatePatient,
} from '../api/doctorPatients'
import { patientsKey } from './usePatients'

export const patientKey = (id) => [...patientsKey, 'detail', String(id)]

/** One patient for the doctor: info, detailed history, visits. */
export function usePatient(id, { enabled = true } = {}) {
  return useQuery({ queryKey: patientKey(id), queryFn: () => getPatient(id), enabled })
}

/** After any change: refresh the patient lists and every patient detail. */
function useInvalidatePatients() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: patientsKey })
}

export function useUpdatePatient(id) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidatePatients()
  return useMutation({
    mutationFn: (fields) => updatePatient(id, fields),
    onSuccess: (patient) => {
      queryClient.setQueryData(patientKey(id), patient)
      invalidate()
    },
  })
}

export function useSaveHistoryEntry(patientId) {
  const invalidate = useInvalidatePatients()
  return useMutation({
    mutationFn: ({ id, ...fields }) =>
      id ? updateHistoryEntry(patientId, id, fields) : addHistoryEntry(patientId, fields),
    onSuccess: invalidate,
  })
}

export function useDeleteHistoryEntry(patientId) {
  const invalidate = useInvalidatePatients()
  return useMutation({
    mutationFn: (entryId) => deleteHistoryEntry(patientId, entryId),
    onSuccess: invalidate,
  })
}
