import { useTranslation } from 'react-i18next'
import Card from '../../../components/Card'
import SelectField from '../../../components/form/SelectField'
import TextField from '../../../components/form/TextField'
import { DURATION_PRESETS } from '../../../utils/schedule'
import Form from '../../../components/form/Form'

/** Duration (15/30/45/60/custom), booking window and cancellation cut-off (FR-G.2). */
export default function BookingSettingsForm({ value, onChange, errors, onSave, saving }) {
  const { t } = useTranslation()
  const isPreset = DURATION_PRESETS.includes(Number(value.slot_duration_minutes)) && !value.customDuration
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value })

  return (
    <Card title={t('settings.booking')}>
      <Form
       
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
        className="space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            label={t('settings.duration')}
            value={isPreset ? String(value.slot_duration_minutes) : 'custom'}
            onChange={(event) =>
              onChange(
                event.target.value === 'custom'
                  ? { ...value, customDuration: true }
                  : { ...value, customDuration: false, slot_duration_minutes: event.target.value },
              )
            }
            error={isPreset ? errors.slot_duration_minutes : undefined}
            options={[
              ...DURATION_PRESETS.map((minutes) => ({ value: String(minutes), label: t('settings.minutes', { count: minutes }) })),
              { value: 'custom', label: t('settings.custom') },
            ]}
          />
          {!isPreset && (
            <TextField
              label={t('settings.customDuration')}
              type="number"
              min={10}
              max={240}
              inputMode="numeric"
              value={value.slot_duration_minutes}
              onChange={set('slot_duration_minutes')}
              error={errors.slot_duration_minutes}
            />
          )}
          <TextField
            label={t('settings.bookingWindow')}
            hint={t('settings.bookingWindowHint')}
            type="number"
            min={1}
            max={90}
            inputMode="numeric"
            value={value.booking_window_days}
            onChange={set('booking_window_days')}
            error={errors.booking_window_days}
          />
          <TextField
            label={t('settings.cancelCutoff')}
            hint={t('settings.cancelCutoffHint')}
            type="number"
            min={0}
            max={72}
            inputMode="numeric"
            value={value.cancel_cutoff_hours}
            onChange={set('cancel_cutoff_hours')}
            error={errors.cancel_cutoff_hours}
          />
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
          {saving ? t('common.saving') : t('settings.saveBooking')}
        </button>
      </Form>
    </Card>
  )
}
