import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getHealth } from '../api/health'

export default function Status() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  })

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold text-slate-900">{t('status.title')}</h1>
        <p className="mt-4 text-sm text-slate-600">{t('status.apiStatus')}</p>
        {isPending && (
          <p role="status" className="mt-1 text-slate-500">
            {t('status.checking')}
          </p>
        )}
        {isError && (
          <div role="alert">
            <p className="mt-1 font-semibold text-red-600">{t('status.unreachable')}</p>
            <button type="button" onClick={() => refetch()} className="mt-3 min-h-11 rounded bg-slate-900 px-4 text-sm text-white">
              {t('status.retry')}
            </button>
          </div>
        )}
        {data && (
          <>
            <p className="mt-1 text-lg font-semibold text-green-700">{data.status}</p>
            <p className="text-sm text-slate-500">{t('status.serverTime', { time: data.time })}</p>
          </>
        )}
      </div>
    </main>
  )
}
