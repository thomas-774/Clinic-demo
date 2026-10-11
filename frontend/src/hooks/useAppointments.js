import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bookAppointment, cancelMyAppointment, getMyAppointments } from '../api/appointments'
import { profileKey, WARM_STALE_TIME } from './useProfile'

export const myAppointmentsKey = ['patient', 'appointments']

export function useMyAppointments() {
  return useQuery({ queryKey: myAppointmentsKey, queryFn: getMyAppointments, staleTime: WARM_STALE_TIME })
}

/** Booking or cancelling changes the free slots, the list and the next appointment. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['slots'] }),
      queryClient.invalidateQueries({ queryKey: myAppointmentsKey }),
      queryClient.invalidateQueries({ queryKey: profileKey }),
    ])
}

export function useBookAppointment() {
  return useMutation({ mutationFn: (startAt) => bookAppointment(startAt), onSuccess: useRefreshAfterChange() })
}

export function useCancelMyAppointment() {
  return useMutation({ mutationFn: (id) => cancelMyAppointment(id), onSuccess: useRefreshAfterChange() })
}
