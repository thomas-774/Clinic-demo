/** The prescription's paper (doctor_settings.prescription_paper): A5 unless the settings say A4. */
export function paperOf(prescription) {
  return prescription?.print?.paper === 'A4' ? 'A4' : 'A5'
}
