import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../../components/Modal'
import SlotGrid from '../../../components/SlotGrid'
import TextField from '../../../components/form/TextField'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useSlots } from '../../../hooks/useSlots'
import { useStaffApi } from '../../../staff/staffApi'
import { useToast } from '../../../toast/useToast'
import { errorMessage } from '../../../utils/apiErrors'
import { todayInClinic } from '../../../utils/format'

/**
 * The doctor or the assistant picks a patient and a free slot (§6.3, FR-I.6).
 * Mounted only while open, so every opening starts empty, or with
 * `initialPatient` ({ id, name, phone }) chosen from a patient page.
 */
export default function BookForPatientModal({ initialDate, initialPatient = null, onClose }) {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { usePatients, useBookForPatient } = useStaffApi()
  const [search, setSearch] = useState('')
  const [patient, setPatient] = useState(initialPatient)
  const [date, setDate] = useState(initialDate)
  const [slot, setSlot] = useState(null)
  const [formError, setFormError] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const patients = usePatients({ search: debouncedSearch, page: 1 })
  const slots = useSlots(date)
  const book = useBookForPatient()

  function submit() {
    setFormError('')
    book.mutate(
      { patient_id: patient.id, start_at: slot.start_at },
      {
        onSuccess: () => {
          toast.success(t('schedule.bookedFor', { name: patient.name }))
          onClose()
        },
        onError: (error) => {
          setSlot(null)
          if (error?.response?.status === 409) {
            toast.error(t('book.slotTaken'))
            queryClient.invalidateQueries({ queryKey: ['slots', date] })
          } else {
            setFormError(errorMessage(error, t('common.networkError')))
          }
        },
      },
    )
  }

  return (
    <Modal open title={t('schedule.bookForPatient')} onClose={onClose} size="lg">
      <div className="space-y-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        {patient ? (
          <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2">
            <p>
              <span className="font-semibold text-slate-900">{patient.name}</span>{' '}
              <span dir="ltr" className="text-sm text-slate-600">
                {patient.phone}
              </span>
            </p>
            <button type="button" onClick={() => setPatient(null)} className="text-sm font-semibold text-sky-700 hover:underline">
              {t('schedule.changePatient')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <TextField
              label={t('schedule.patient')}
              type="search"
              value={search}
              placeholder={t('patientsList.searchPlaceholder')}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul aria-label={t('schedule.matchingPatients')} className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg ring-1 ring-slate-200">
              {(patients.data?.data ?? []).map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => setPatient(row)} className="flex w-full justify-between gap-3 px-3 py-2 text-start hover:bg-slate-50">
                    <span>{row.name}</span>
                    <span dir="ltr" className="text-sm text-slate-500">
                      {row.phone}
                    </span>
                  </button>
                </li>
              ))}
              {patients.data?.data.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{t('schedule.noPatientMatch')}</li>}
            </ul>
          </div>
        )}

        <TextField
          label={t('book.date')}
          type="date"
          dir="ltr"
          value={date}
          min={todayInClinic()}
          onChange={(e) => {
            setDate(e.target.value)
            setSlot(null)
          }}
          className="max-w-xs"
        />

        {date && <SlotGrid slots={slots.data?.data} loading={slots.isPending} selected={slot?.start_at} onSelect={setSlot} />}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!patient || !slot || book.isPending}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {book.isPending ? t('book.booking') : t('schedule.book')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
