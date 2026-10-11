import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addBlockedTime, deleteBlockedTime, getBlockedTimes } from '../api/settings'

const blockedKey = ['doctor', 'blocked-times']

/** Upcoming blocks (today onward). */
export function useBlockedTimes() {
  return useQuery({ queryKey: blockedKey, queryFn: () => getBlockedTimes() })
}

/** A block changes which slots are free. */
function useRefresh() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: blockedKey })
    queryClient.invalidateQueries({ queryKey: ['slots'] })
  }
}

export function useAddBlockedTime() {
  return useMutation({ mutationFn: (fields) => addBlockedTime(fields), onSuccess: useRefresh() })
}

export function useDeleteBlockedTime() {
  return useMutation({ mutationFn: (id) => deleteBlockedTime(id), onSuccess: useRefresh() })
}
