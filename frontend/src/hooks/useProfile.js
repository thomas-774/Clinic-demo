import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProfile, updateProfile } from '../api/patient'

export const profileKey = ['patient', 'profile']

/**
 * Data fetched by warmStart() a moment before the page mounts is not asked
 * for again on mount (T11-14). Changes still refetch: they invalidate.
 */
export const WARM_STALE_TIME = 5000

export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: getProfile, staleTime: WARM_STALE_TIME })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => queryClient.setQueryData(profileKey, profile),
  })
}
