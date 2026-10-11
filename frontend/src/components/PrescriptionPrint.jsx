import { useTranslation } from 'react-i18next'
import { formatDate } from '../utils/format'
import { paperOf } from '../utils/prescriptions'

/**
 * The printed prescription (§7.3 Printing, FR-J.5): the clinic header, the
 * patient, the date, "Rx" with the numbered lines, notes, a signature line
 * and the footer. Nothing else is ever on it (RX-4): no side notes,
 * warnings, ingredients or prices, which is why it reads only these fields.
 *
 * `prescription` = { issued_on, notes, items: [{ drug_name, drug_form, instructions }],
 * patient: { name, age }, print: { clinic_name, doctor_name, doctor_title,
 * clinic_address, clinic_phone, footer, paper } } — the API's prescription.
 *
 * On screen it is drawn as a sheet of the chosen paper; the page's
 * `rx-paper-*` class picks the printed page size (index.css).
 */
export default function PrescriptionPrint({ prescription, className = '' }) {
  const { t } = useTranslation()
  const { print = {}, patient = {}, items = [], notes, issued_on: issuedOn } = prescription
  const paper = paperOf(prescription)

  return (
    <article
      aria-label={t('rxPrint.title')}
      data-paper={paper}
      className={`rx-paper-${paper.toLowerCase()} flex flex-col bg-white p-[10mm] text-black print:p-0 ${
        paper === 'A4' ? 'min-h-[297mm] w-[210mm]' : 'min-h-[210mm] w-[148mm]'
      } print:min-h-0 print:w-auto ${className}`}
    >
      <header className="text-center">
        {print.clinic_name && (
          <h1 dir="auto" className="text-xl font-bold">
            {print.clinic_name}
          </h1>
        )}
        <p className="font-semibold">{print.doctor_name}</p>
        {print.doctor_title && (
          <p dir="auto" className="text-sm">
            {print.doctor_title}
          </p>
        )}
        {(print.clinic_address || print.clinic_phone) && (
          <p className="text-xs">
            {print.clinic_address && <span dir="auto">{print.clinic_address}</span>}
            {print.clinic_address && print.clinic_phone && ' · '}
            {print.clinic_phone && <span dir="ltr">{print.clinic_phone}</span>}
          </p>
        )}
      </header>

      <hr className="my-3 border-black" />

      <dl className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm">
        <div>
          <dt className="inline font-semibold">{t('rxPrint.patient')}: </dt>
          <dd dir="auto" className="inline">
            {patient.name}
          </dd>
        </div>
        {patient.age != null && (
          <div>
            <dt className="inline font-semibold">{t('rxPrint.age')}: </dt>
            <dd className="inline">{patient.age}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-semibold">{t('rxPrint.date')}: </dt>
          <dd className="inline">{formatDate(issuedOn)}</dd>
        </div>
      </dl>

      <p dir="ltr" className="mt-4 text-start font-serif text-2xl font-bold italic">
        Rx
      </p>
      <ol className="mt-2 space-y-3">
        {items.map((item, index) => (
          <li key={item.id ?? index} className="flex break-inside-avoid gap-2">
            <span className="font-bold">{index + 1}.</span>
            <div className="min-w-0">
              <p className="font-bold">
                <span dir="auto">{item.drug_name}</span>
                {item.drug_form && (
                  <>
                    {' — '}
                    <span dir="auto">{item.drug_form}</span>
                  </>
                )}
              </p>
              <p dir="auto" className="text-sm">
                {item.instructions}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {notes && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-sm font-semibold">{t('rxPrint.notes')}</h2>
          <p dir="auto" className="w-fit max-w-full whitespace-pre-line text-sm">
            {notes}
          </p>
        </section>
      )}

      <div className="mt-auto flex break-inside-avoid justify-end pt-12 print:mt-0">
        <p className="w-48 border-t border-black pt-1 text-center text-sm">{t('rxPrint.signature')}</p>
      </div>

      {print.footer && (
        <footer dir="auto" className="mt-4 break-inside-avoid border-t border-black pt-2 text-center text-xs">
          {print.footer}
        </footer>
      )}
    </article>
  )
}
