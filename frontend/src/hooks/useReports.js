import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getDailyRevenue, getOutstanding, getReportPayments, getReportSummary } from '../api/reports'

export const reportsKey = ['doctor', 'reports']

/** Patients seen, revenue and outstanding for today / this week / this month (FR-H.1, H.2). */
export function useReportSummary(period) {
  return useQuery({
    queryKey: [...reportsKey, 'summary', period],
    queryFn: () => getReportSummary(period),
  })
}

/** One page of the payments table with the whole range's totals (FR-H.3); keeps the old page on screen while the next loads. */
export function useReportPayments({ from, to, page }, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...reportsKey, 'payments', { from, to, page }],
    queryFn: () => getReportPayments({ from, to, page }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Revenue for every day of a "YYYY-MM" month (FR-H.4). */
export function useDailyRevenue(month) {
  return useQuery({
    queryKey: [...reportsKey, 'daily-revenue', month],
    queryFn: () => getDailyRevenue(month),
    placeholderData: keepPreviousData,
  })
}

/** Who owes what, loaded when the details are opened. */
export function useOutstanding({ enabled = true } = {}) {
  return useQuery({ queryKey: [...reportsKey, 'outstanding'], queryFn: getOutstanding, enabled })
}
