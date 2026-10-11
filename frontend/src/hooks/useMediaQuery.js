import { useCallback, useSyncExternalStore } from 'react'

/** Whether the CSS media `query` matches now; follows changes. True where matchMedia is missing (tests). */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true))
}
