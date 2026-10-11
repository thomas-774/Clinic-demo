import * as audit from '../../audit'
import { nowLocal, parseToLocal, today } from '../../clock'
import * as db from '../../db'
import { resource } from '../../http'
import { money, toPiastres } from '../../money'
import * as resources from '../../resources'
import { moneyRules } from '../../rules'
import { transitionTo } from '../../services/appointments'
import * as payments from '../../services/payments'
import { exists, oneOf, validate } from '../../validate'
import { __, bind } from '../shared'

/** Doctor → visits and payments (Doctor\VisitController, PaymentService). */

export const PAYMENT_METHODS = ['cash', 'card', 'wallet']

/** StorePaymentRequest (the assistant uses the same one). */
export function paymentInput(ctx) {
  return validate(
    ctx,
    ctx.input,
    {
      amount: ['required', ...moneyRules(), 'gt:0'],
      method: ['nullable', oneOf(PAYMENT_METHODS)],
      // When the money was received; it counts in that period's revenue (PR-4).
      paid_at: ['nullable', 'date', 'before_or_equal:now'],
    },
    { attributes: { amount: 'amount', method: 'payment method', paid_at: 'payment date' } },
  )
}

/** POST …/visits/{visit}/payments: an installment (FR-D.6); answers with the visit and its new balance. */
export function storePaymentFor(ctx, present) {
  const visit = bind(ctx, 'visits', 'visit')
  const data = paymentInput(ctx)
  const method = PAYMENT_METHODS.includes(data.method) ? data.method : 'cash'
  payments.addPayment(ctx, visit, data.amount, method, data.paid_at ? parseToLocal(data.paid_at) : null)
  return resource(present(visit), __(ctx, 'Payment recorded.'), 201)
}

/** POST /doctor/visits: the visit, its first payment and the appointment set to completed, together (§6.4). */
export function store(ctx) {
  const data = validate(
    ctx,
    ctx.input,
    {
      patient_id: ['required', 'integer', exists('patients')],
      appointment_id: ['nullable', 'integer', exists('appointments')],
      work_done: ['required', 'string', 'max:5000'],
      total_amount: ['required', ...moneyRules()],
      paid_now: ['nullable', ...moneyRules()],
      method: ['nullable', oneOf(PAYMENT_METHODS)],
    },
    {
      attributes: {
        patient_id: 'patient',
        appointment_id: 'appointment',
        work_done: 'work done',
        total_amount: 'total cost',
        paid_now: 'amount paid now',
        method: 'payment method',
      },
      after(add, errors) {
        if (Object.keys(errors).length) return
        // PR-2: the first payment cannot be more than the total.
        if (toPiastres(ctx.input.paid_now) > toPiastres(ctx.input.total_amount)) {
          add('paid_now', __(ctx, 'The amount paid cannot be more than the total.'))
        }
        const appointment = ctx.input.appointment_id ? db.find('appointments', ctx.input.appointment_id) : null
        if (!appointment) return
        if (appointment.patient_id !== Number(ctx.input.patient_id)) {
          add('appointment_id', __(ctx, 'This appointment belongs to another patient.'))
        } else if (!['booked', 'checked_in'].includes(appointment.status)) {
          add('appointment_id', __(ctx, 'This appointment is not open for a visit.'))
        } else if (db.first('visits', { appointment_id: appointment.id })) {
          add('appointment_id', __(ctx, 'This appointment already has a visit.'))
        }
      },
    },
  )

  const appointment = data.appointment_id ? db.find('appointments', data.appointment_id) : null
  const visit = audit.create(ctx, 'visits', {
    patient_id: Number(data.patient_id),
    appointment_id: appointment?.id ?? null,
    // The visit belongs to its appointment's day: reports count money by visit date.
    visit_date: appointment ? appointment.start_at.slice(0, 10) : today(),
    work_done: data.work_done,
    total_amount: money(data.total_amount),
  })

  if (toPiastres(data.paid_now) > 0) {
    audit.create(ctx, 'payments', {
      visit_id: visit.id,
      amount: money(data.paid_now),
      method: data.method ?? 'cash',
      paid_at: nowLocal(),
      recorded_by: ctx.user.id,
    })
  }

  if (appointment) {
    // §4.3: completed follows checked in; a patient seen straight from booked is checked in on the way.
    if (appointment.status === 'booked') transitionTo(appointment, 'checked_in')
    transitionTo(appointment, 'completed')
  }

  return resource(resources.visit(visit), __(ctx, 'Visit saved.'), 201)
}

/** PUT /doctor/visits/{visit}: work done and total; remaining follows. */
export function update(ctx) {
  const visit = bind(ctx, 'visits', 'visit')
  const data = validate(
    ctx,
    ctx.input,
    { work_done: ['required', 'string', 'max:5000'], total_amount: ['required', ...moneyRules()] },
    { attributes: { work_done: 'work done', total_amount: 'total cost' } },
  )
  payments.assertTotalAllowed(ctx, visit, data.total_amount)
  audit.update(ctx, 'visits', visit, { work_done: data.work_done, total_amount: money(data.total_amount) })
  return resource(resources.visit(visit), __(ctx, 'Visit updated.'))
}

export const storePayment = (ctx) => storePaymentFor(ctx, resources.visit)
