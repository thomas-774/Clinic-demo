import { nowLocal } from './clock'
import * as db from './db'
import { translate } from './lang'
import { fromPiastres, toPiastres } from './money'
import { yearsBetween } from './resources'
import * as payments from './services/payments'
import { clinicDoctor, clinicSettings } from './services/slots'

/**
 * The visit report (VisitReportService + reports/visit.blade.php) as a
 * printable HTML page: the demo has no PDF engine, so the browser's print
 * dialog makes the PDF. Same sections and wording as the source's file; never
 * medical history, current illness or drug notes (FR-K.3).
 */

const LABELS = {
  title: 'Visit report',
  patient: 'Patient',
  phone: 'Phone',
  age: 'Age',
  visit_date: 'Visit date',
  time: 'Time',
  walk_in: 'Walk-in',
  payment_status: 'Payment status',
  work_done: 'Work done today',
  money: 'Amounts',
  total: 'Total cost',
  paid: 'Amount paid',
  remaining: 'Remaining',
  payments: 'Payments',
  no_payments: 'No payments yet.',
  date: 'Date',
  amount: 'Amount',
  method: 'Method',
  recorded_by: 'Recorded by',
  outstanding: 'Overall outstanding balance',
  prescriptions: 'Prescriptions',
  drug: 'Drug',
  form: 'Form',
  instructions: 'Instructions',
  generated_on: 'Generated on',
  signature: 'Signature',
}
const STATUSES = { paid: 'Paid', partially_paid: 'Partially paid', unpaid: 'Unpaid' }
const METHODS = { cash: 'Cash', card: 'Card', wallet: 'Wallet' }
const DATE_LOCALES = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' }

const escape = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** dir="rtl" when the text starts with Arabic, as HTML's dir="auto" (VR-4). */
const dirOf = (text) => (/^[^\p{L}]*\p{Script=Arabic}/u.test(String(text ?? '')) ? 'rtl' : 'ltr')

/** "7 Oct 2026" / "7 أكتوبر 2026", Latin digits, from "YYYY-MM-DD" or a Cairo wall-clock string. */
function date(value, locale) {
  const day = value.slice(0, 10)
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

/** "1500.00" → "1,500.00 EGP" / "1,500.00 ج.م", grouped on the string (VR-2). */
export function money(amount, locale) {
  const value = fromPiastres(toPiastres(amount))
  const negative = value.startsWith('-')
  const [whole, fraction] = value.replace('-', '').split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}.${fraction} ${translate(locale, 'EGP')}`
}

/** VisitReportService::build() */
export function buildReport(visit, locale) {
  const t = (key) => translate(locale, key)
  const patient = db.find('patients', visit.patient_id)
  const user = db.find('users', patient.user_id)
  const appointment = visit.appointment_id ? db.find('appointments', visit.appointment_id) : null
  const doctor = clinicDoctor()
  const settings = clinicSettings()
  const remaining = payments.remainingPiastres(visit)
  const outstanding = db.where('visits', { patient_id: patient.id }).reduce((sum, v) => sum + payments.remainingPiastres(v), 0)
  const visitDate = date(visit.visit_date, locale)

  return {
    locale,
    rtl: locale === 'ar',
    title: `${t('Visit report')} — ${visitDate}`,
    labels: Object.fromEntries(Object.entries(LABELS).map(([name, key]) => [name, t(key)])),
    header: Object.fromEntries(
      Object.entries({
        clinic_name: settings.clinic_name,
        doctor_name: doctor.name,
        doctor_title: settings.doctor_title,
        address: settings.clinic_address,
        phone: settings.clinic_phone,
      }).filter(([, part]) => String(part ?? '').trim() !== ''),
    ),
    patient: {
      name: user.name,
      phone: user.phone || null,
      // Age on the visit day; left out without a date of birth.
      age: patient.date_of_birth ? yearsBetween(patient.date_of_birth, visit.visit_date) : null,
    },
    visit: {
      id: visit.id,
      date: visitDate,
      time: appointment ? `${appointment.start_at.slice(11, 16)} – ${appointment.end_at.slice(11, 16)}` : null,
      walk_in: appointment === null,
      payment_status: t(STATUSES[payments.status(visit)]),
    },
    workDone: String(visit.work_done ?? ''),
    money: {
      total: money(visit.total_amount, locale),
      paid: money(payments.paid(visit), locale),
      remaining: money(fromPiastres(remaining), locale),
      has_remaining: remaining > 0,
    },
    payments: payments
      .paymentsOf(visit)
      .sort((a, b) => a.paid_at.localeCompare(b.paid_at) || a.id - b.id)
      .map((p) => ({
        date: date(p.paid_at, locale),
        amount: money(p.amount, locale),
        method: t(METHODS[p.method]),
        recorded_by: p.recorded_by ? (db.find('users', p.recorded_by)?.name ?? null) : null,
      })),
    outstanding: money(fromPiastres(outstanding), locale),
    hasOutstanding: outstanding > 0,
    prescriptions: db
      .where('prescriptions', { visit_id: visit.id })
      .sort((a, b) => a.issued_on.localeCompare(b.issued_on) || a.id - b.id)
      .map((rx) => ({
        issued_on: date(rx.issued_on, locale),
        // Snapshot fields only (RX-2, RX-4).
        items: db
          .where('prescription_items', { prescription_id: rx.id })
          .sort((a, b) => a.position - b.position)
          .map((item) => ({ drug_name: item.drug_name, drug_form: item.drug_form || null, instructions: item.instructions })),
      })),
    generatedAt: `${date(nowLocal(), locale)} ${nowLocal().slice(11, 16)}`,
  }
}

/** reports/visit.blade.php as plain HTML; the styles are in public/visit-report.css (the page's CSP allows no inline style). */
export function renderReport(data) {
  const l = data.labels
  const h = data.header
  const span = (text, dir = 'ltr') => `<span dir="${dir}">${escape(text)}</span>`
  const cell = (text) => `<td class="start" dir="${dirOf(text)}">${escape(text)}</td>`

  const headerLines = [
    h.clinic_name && `<div class="clinic" dir="${dirOf(h.clinic_name)}">${escape(h.clinic_name)}</div>`,
    `<div class="doctor" dir="${dirOf(h.doctor_name)}">${escape(h.doctor_name ?? '')}${h.doctor_title ? ` — ${escape(h.doctor_title)}` : ''}</div>`,
    (h.address || h.phone) &&
      `<div class="muted" dir="${dirOf(h.address ?? '')}">${escape(h.address ?? '')}${h.address && h.phone ? ' · ' : ''}${h.phone ? span(h.phone) : ''}</div>`,
  ].filter(Boolean)

  const paymentsTable = data.payments.length
    ? `<table class="grid"><thead><tr><th class="start">${escape(l.date)}</th><th class="start">${escape(l.amount)}</th><th class="start">${escape(l.method)}</th><th class="start">${escape(l.recorded_by)}</th></tr></thead><tbody>${data.payments
        .map((p) => `<tr><td class="start">${escape(p.date)}</td><td class="start">${span(p.amount)}</td><td class="start">${escape(p.method)}</td>${cell(p.recorded_by)}</tr>`)
        .join('')}</tbody></table>`
    : `<p class="start">${escape(l.no_payments)}</p>`

  const prescriptions = data.prescriptions.length
    ? `<h2 class="start">${escape(l.prescriptions)}</h2>${data.prescriptions
        .map(
          (rx) =>
            `<p class="start muted rx-date">${escape(l.date)}: ${escape(rx.issued_on)}</p><table class="grid"><thead><tr><th class="start number">#</th><th class="start">${escape(l.drug)}</th><th class="start">${escape(l.form)}</th><th class="start">${escape(l.instructions)}</th></tr></thead><tbody>${rx.items
              .map((item, i) => `<tr><td class="start">${i + 1}</td><td class="start">${span(item.drug_name)}</td>${cell(item.drug_form)}${cell(item.instructions)}</tr>`)
              .join('')}</tbody></table>`,
        )
        .join('')}`
    : ''

  return `<!DOCTYPE html>
<html lang="${data.locale}" dir="${data.rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escape(data.title)}</title>
<link rel="stylesheet" href="/visit-report.css">
</head>
<body>
<div class="header center">${headerLines.join('')}</div>
<h1 class="start">${escape(l.title)}</h1>
<table class="info">
<tr><td class="label start">${escape(l.patient)}</td>${cell(data.patient.name)}<td class="label start">${escape(l.visit_date)}</td><td class="start">${escape(data.visit.date)}</td></tr>
<tr><td class="label start">${escape(l.phone)}</td><td class="start">${data.patient.phone ? span(data.patient.phone) : ''}</td><td class="label start">${escape(l.time)}</td><td class="start">${data.visit.walk_in ? escape(l.walk_in) : span(data.visit.time)}</td></tr>
<tr><td class="label start">${data.patient.age !== null ? escape(l.age) : ''}</td><td class="start">${data.patient.age ?? ''}</td><td class="label start">${escape(l.payment_status)}</td><td class="start">${escape(data.visit.payment_status)}</td></tr>
</table>
<h2 class="start">${escape(l.work_done)}</h2>
<div class="work start">${data.workDone
    .split(/\r?\n/)
    .map((line) => `<div dir="${dirOf(line)}" class="start">${escape(line)}&nbsp;</div>`)
    .join('')}</div>
<h2 class="start">${escape(l.money)}</h2>
<table class="money"><tr>
<td>${escape(l.total)}<br><span class="amount" dir="ltr">${escape(data.money.total)}</span></td>
<td>${escape(l.paid)}<br><span class="amount" dir="ltr">${escape(data.money.paid)}</span></td>
<td class="bold${data.money.has_remaining ? ' due' : ''}">${escape(l.remaining)}<br><span class="amount" dir="ltr">${escape(data.money.remaining)}</span></td>
</tr></table>
<h2 class="start">${escape(l.payments)}</h2>
${paymentsTable}
<p class="start bold outstanding">${escape(l.outstanding)}: <span dir="ltr" class="${data.hasOutstanding ? 'due' : ''}">${escape(data.outstanding)}</span></p>
${prescriptions}
<table class="signature"><tr><td class="start muted">${escape(l.generated_on)}: ${escape(data.generatedAt)}</td><td class="end">${escape(l.signature)}: ______________________</td></tr></table>
</body>
</html>
`
}
