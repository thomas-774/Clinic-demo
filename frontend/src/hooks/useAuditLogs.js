import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listAuditLogs } from '../api/auditLogs'

export const auditLogsKey = ['doctor', 'audit-logs']

/** Settings → Activity: one filtered page; keeps the previous page on screen while the next loads. */
export function useAuditLogs(filters) {
  return useQuery({
    queryKey: [...auditLogsKey, filters],
    queryFn: () => listAuditLogs(filters),
    placeholderData: keepPreviousData,
  })
}
