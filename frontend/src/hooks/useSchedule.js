import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bookForPatient, getSchedule, updateAppointmentStatus } from '../api/appointments'

export const scheduleKey = ['doctor', 'appointments']

/** The doctor's appointments between two dates; refreshed every 60 s (§7.3). */
export function useSchedule({ from, to }, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...scheduleKey, { from, to }],
    queryFn: () => getSchedule({ from, to }),
    refetchInterval: 60_000,
    enabled,
  })
}

/** A booking or status change moves slots and every schedule view. */
function useRefreshSchedule() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: scheduleKey }),
      queryClient.invalidateQueries({ queryKey: ['slots'] }),
    ])
}

export function useUpdateAppointmentStatus() {
  return useMutation({
    mutationFn: ({ id, status }) => updateAppointmentStatus(id, status),
    onSuccess: useRefreshSchedule(),
  })
}

export function useBookForPatient() {
  return useMutation({ mutationFn: (fields) => bookForPatient(fields), onSuccess: useRefreshSchedule() })
}
