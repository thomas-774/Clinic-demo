import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPatient, listPatients } from '../api/doctorPatients'

export const patientsKey = ['doctor', 'patients']

/** The doctor's patient list; keeps the previous page on screen while the next loads. */
export function usePatients({ search, page }) {
  return useQuery({
    queryKey: [...patientsKey, 'list', { search, page }],
    queryFn: () => listPatients({ search, page }),
    placeholderData: keepPreviousData,
  })
}

export function useCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientsKey }),
  })
}
