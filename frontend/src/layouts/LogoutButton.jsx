import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'

export default function LogoutButton({ className = '' }) {
  const { t } = useTranslation()
  const { logout } = useAuth()

  return (
    <button
      type="button"
      onClick={logout}
      className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 ${className}`}
    >
      {t('common.logout')}
    </button>
  )
}
