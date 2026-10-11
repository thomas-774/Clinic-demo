import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDrug, getDrug, listDrugs, searchDrugs, updateDrug } from '../api/drugs'
import { useDebouncedValue } from './useDebouncedValue'

export const drugsKey = ['doctor', 'drugs']

export const SEARCH_DELAY_MS = 250
export const MIN_SEARCH_LENGTH = 2

/**
 * Drug suggestions for `q` (FR-J.2): asks the server 250 ms after the last
 * keystroke, from 2 characters, and keeps the previous results on screen
 * while the next ones load. `query` is the text the results belong to.
 */
export function useDrugSearch(q) {
  const query = useDebouncedValue(q.trim(), SEARCH_DELAY_MS)
  const enabled = query.length >= MIN_SEARCH_LENGTH

  const result = useQuery({
    queryKey: [...drugsKey, 'search', query],
    queryFn: () => searchDrugs(query),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  return { ...result, query, enabled, drugs: enabled ? (result.data ?? []) : [] }
}

/** One full drug for the side note; catalogue entries change rarely, so it is cached for a while. */
export function useDrug(id) {
  return useQuery({
    queryKey: [...drugsKey, 'one', id],
    queryFn: () => getDrug(id),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  })
}

/** Settings → Drugs (FR-J.6): one page of the catalogue; keeps the previous page on screen while the next loads. */
export function useDrugList({ search, category, includeHidden, page }) {
  return useQuery({
    queryKey: [...drugsKey, 'list', { search, category, includeHidden, page }],
    queryFn: () => listDrugs({ search, category, includeHidden, page }),
    placeholderData: keepPreviousData,
  })
}

/** A catalogue change touches the list, the search suggestions and the side notes. */
function useRefreshDrugs() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: drugsKey })
}

/** Adds a drug, or edits one when `id` is given. */
export function useSaveDrug() {
  return useMutation({
    mutationFn: ({ id, ...fields }) => (id ? updateDrug(id, fields) : createDrug(fields)),
    onSuccess: useRefreshDrugs(),
  })
}

/** Hides (`is_active: false`) or shows a drug; hidden drugs are never suggested (RX-3). */
export function useSetDrugActive() {
  return useMutation({
    mutationFn: ({ id, isActive }) => updateDrug(id, { is_active: isActive }),
    onSuccess: useRefreshDrugs(),
  })
}
