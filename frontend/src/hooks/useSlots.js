import { useQuery } from '@tanstack/react-query'
import { getSlots } from '../api/slots'
import { WARM_STALE_TIME } from './useProfile'

/** Free slots for `date` ("YYYY-MM-DD"); idle until a date is chosen. */
export function useSlots(date) {
  return useQuery({
    queryKey: ['slots', date],
    queryFn: () => getSlots(date),
    enabled: Boolean(date),
    staleTime: WARM_STALE_TIME,
  })
}
