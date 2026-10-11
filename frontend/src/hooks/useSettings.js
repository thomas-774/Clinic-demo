import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, getWorkingHours, updateSettings, updateWorkingHours } from '../api/settings'

const settingsKey = ['doctor', 'settings']
const hoursKey = ['doctor', 'working-hours']

export function useDoctorSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: getSettings })
}

export function useWorkingHours() {
  return useQuery({ queryKey: hoursKey, queryFn: getWorkingHours })
}

/** Saving hours or duration changes every future slot list. */
function useSaved(key) {
  const queryClient = useQueryClient()
  return (saved) => {
    queryClient.setQueryData(key, saved)
    queryClient.invalidateQueries({ queryKey: ['slots'] })
  }
}

export function useUpdateSettings() {
  return useMutation({ mutationFn: (fields) => updateSettings(fields), onSuccess: useSaved(settingsKey) })
}

export function useUpdateWorkingHours() {
  return useMutation({ mutationFn: (days) => updateWorkingHours(days), onSuccess: useSaved(hoursKey) })
}
