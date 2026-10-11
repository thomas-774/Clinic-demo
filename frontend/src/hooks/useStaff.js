import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createStaff, getStaff, updateStaff } from '../api/settings'

const staffKey = ['doctor', 'staff']

/** The doctor's assistant accounts (FR-I.1). */
export function useStaff() {
  return useQuery({ queryKey: staffKey, queryFn: getStaff })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: staffKey })
}

export function useCreateStaff() {
  return useMutation({ mutationFn: (fields) => createStaff(fields), onSuccess: useRefresh() })
}

export function useUpdateStaff() {
  return useMutation({ mutationFn: ({ id, ...fields }) => updateStaff(id, fields), onSuccess: useRefresh() })
}
