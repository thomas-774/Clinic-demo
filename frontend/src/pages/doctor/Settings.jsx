import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { LoadError, Loading } from '../../components/QueryState'
import { useDoctorSettings, useUpdateSettings, useUpdateWorkingHours, useWorkingHours } from '../../hooks/useSettings'
import { useToast } from '../../toast/useToast'
import { errorMessage } from '../../utils/apiErrors'
import ActivityTab from './settings/ActivityTab'
import BlockedTimesCard from './settings/BlockedTimesCard'
import StaffCard from './settings/StaffCard'
import BookingSettingsForm from './settings/BookingSettingsForm'
import DrugsTab from './settings/DrugsTab'
import PrescriptionHeaderTab from './settings/PrescriptionHeaderTab'
import SlotPreview from './settings/SlotPreview'
import WeeklyHoursForm from './settings/WeeklyHoursForm'

/** All 422 messages keyed by field, e.g. { "days.2.ranges.0.end_time": "…" }. */
function errorsOf(error) {
  const errors = error?.response?.status === 422 ? error.response.data?.errors : null
  return errors ? Object.fromEntries(Object.entries(errors).map(([key, messages]) => [key, messages[0]])) : {}
}

/**
 * Holds the unsaved values of both forms, so other parts of the page (the
 * slot preview) can react to them before saving.
 */
function SettingsEditor({ initialSettings, initialWeek }) {
  const { t } = useTranslation()
  const toast = useToast()
  const saveSettings = useUpdateSettings()
  const saveHours = useUpdateWorkingHours()
  const [settings, setSettings] = useState(initialSettings)
  const [week, setWeek] = useState(initialWeek)

  const notifyFailure = (error) => toast.error(error?.response?.status === 422 ? t('settings.fixErrors') : errorMessage(error, t('common.networkError')))

  function handleSaveSettings() {
    const { slot_duration_minutes, booking_window_days, cancel_cutoff_hours } = settings
    saveSettings.mutate(
      {
        slot_duration_minutes: Number(slot_duration_minutes),
        booking_window_days: Number(booking_window_days),
        cancel_cutoff_hours: Number(cancel_cutoff_hours),
      },
      {
        onSuccess: (saved) => {
          setSettings((current) => ({ ...saved, customDuration: current.customDuration }))
          toast.success(t('settings.bookingSaved'))
        },
        onError: notifyFailure,
      },
    )
  }

  function handleSaveHours() {
    saveHours.mutate(week, {
      onSuccess: (saved) => {
        setWeek(saved)
        toast.success(t('settings.hoursSaved'))
      },
      onError: notifyFailure,
    })
  }

  return (
    <div className="space-y-4">
      <BookingSettingsForm
        value={settings}
        onChange={setSettings}
        errors={errorsOf(saveSettings.error)}
        onSave={handleSaveSettings}
        saving={saveSettings.isPending}
      />
      <WeeklyHoursForm
        week={week}
        onChange={setWeek}
        errors={errorsOf(saveHours.error)}
        onSave={handleSaveHours}
        saving={saveHours.isPending}
        renderPreview={(day) => (
          <SlotPreview dayName={t(`days.${day}`)} ranges={week[day].ranges} duration={settings.slot_duration_minutes} />
        )}
      />
      <BlockedTimesCard />
      <StaffCard />
    </div>
  )
}

/** Hours and booking, the prescription parts (FR-J.6), then who did what (NFR-S.5). */
const TABS = ['general', 'drugs', 'prescription', 'activity']

/** Tab bar (ARIA tabs): ← → / Home / End move between tabs; the open tab is kept in ?tab=. */
function Tabs({ current, onChange }) {
  const { t } = useTranslation()
  const refs = useRef({})

  const onKeyDown = (event) => {
    const index = TABS.indexOf(current)
    const rtl = document.documentElement.dir === 'rtl'
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key]
    let next = null
    if (step) next = TABS[(index + step + TABS.length) % TABS.length]
    if (event.key === 'Home') next = TABS[0]
    if (event.key === 'End') next = TABS[TABS.length - 1]
    if (!next) return
    event.preventDefault()
    onChange(next)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={t('pages.settings')} className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200">
      {TABS.map((tab) => (
        <button
          key={tab}
          ref={(element) => {
            refs.current[tab] = element
          }}
          type="button"
          role="tab"
          id={`settings-tab-${tab}`}
          aria-selected={current === tab}
          aria-controls={`settings-panel-${tab}`}
          tabIndex={current === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={onKeyDown}
          className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${
            current === tab ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {t(`settings.tabs.${tab}`)}
        </button>
      ))}
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'general'
  const settings = useDoctorSettings()
  const hours = useWorkingHours()

  let panel
  if (tab === 'drugs') {
    panel = <DrugsTab />
  } else if (tab === 'activity') {
    panel = <ActivityTab />
  } else if (settings.isPending || hours.isPending) {
    panel = <Loading />
  } else if (settings.isError || hours.isError) {
    panel = (
      <LoadError
        onRetry={() => {
          settings.refetch()
          hours.refetch()
        }}
      />
    )
  } else if (tab === 'prescription') {
    panel = <PrescriptionHeaderTab settings={settings.data} />
  } else {
    panel = <SettingsEditor initialSettings={settings.data} initialWeek={hours.data} />
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t('pages.settings')}</h1>
      <Tabs current={tab} onChange={(next) => setParams(next === 'general' ? {} : { tab: next }, { replace: true })} />
      <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {panel}
      </div>
    </div>
  )
}
