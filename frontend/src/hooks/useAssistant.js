import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addPayment,
  bookForPatient,
  createPatient,
  getPatient,
  getSchedule,
  getUnpaidVisits,
  listPatients,
  updateAppointmentStatus,
  updatePatient,
} from '../api/assistant'

// Queries of the assistant area (/assistant/*), kept apart from the doctor's cache.
export const assistantKey = ['assistant']
const scheduleKey = [...assistantKey, 'appointments']
const patientsKey = [...assistantKey, 'patients']
const unpaidKey = [...assistantKey, 'unpaid']
export const assistantPatientKey = (id) => [...patientsKey, 'detail', String(id)]

/** The doctor's appointments between two dates; refreshed every 60 s like the doctor's (§7.3). */
export function useAssistantSchedule({ from, to }, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...scheduleKey, { from, to }],
    queryFn: () => getSchedule({ from, to }),
    refetchInterval: 60_000,
    enabled,
  })
}

/** A booking or status change moves slots, every schedule view and the patient pages. */
function useRefreshSchedule() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: scheduleKey }),
      queryClient.invalidateQueries({ queryKey: patientsKey }),
      queryClient.invalidateQueries({ queryKey: ['slots'] }),
    ])
}

export function useAssistantUpdateAppointmentStatus() {
  return useMutation({ mutationFn: ({ id, status }) => updateAppointmentStatus(id, status), onSuccess: useRefreshSchedule() })
}

export function useAssistantBookForPatient() {
  return useMutation({ mutationFn: (fields) => bookForPatient(fields), onSuccess: useRefreshSchedule() })
}

/** Today's (or `date`'s) visits that still owe money; refreshed every 60 s so new visits appear. */
export function useUnpaidVisits({ date } = {}) {
  return useQuery({
    queryKey: [...unpaidKey, { date }],
    queryFn: () => getUnpaidVisits({ date }),
    refetchInterval: 60_000,
  })
}

/** A payment changes the waiting list and the patient's balance. */
export function useAssistantAddPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ visitId, ...fields }) => addPayment(visitId, fields),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: unpaidKey }),
        queryClient.invalidateQueries({ queryKey: patientsKey }),
      ]),
  })
}

/** The patient list; keeps the previous page on screen while the next loads. */
export function useAssistantPatients({ search, page }) {
  return useQuery({
    queryKey: [...patientsKey, 'list', { search, page }],
    queryFn: () => listPatients({ search, page }),
    placeholderData: keepPreviousData,
  })
}

export function useAssistantCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientsKey }),
  })
}

/** One patient: contact info, next appointment, visits' money, balance. */
export function useAssistantPatient(id) {
  return useQuery({ queryKey: assistantPatientKey(id), queryFn: () => getPatient(id) })
}

export function useAssistantUpdatePatient(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields) => updatePatient(id, fields),
    onSuccess: (patient) => {
      queryClient.setQueryData(assistantPatientKey(id), patient)
      return queryClient.invalidateQueries({ queryKey: patientsKey })
    },
  })
}
