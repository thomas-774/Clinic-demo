import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './accounts'
import { addDays, addMinutes, dayOfWeek, nowLocal, subMonths, subYears, timeToMinutes, today } from './clock'
import drugCatalogue from './data/drugs.json'
import { createRandom } from './random'

/**
 * The demo clinic, built fresh around "today" from the source app's seeders
 * (DoctorSeeder, AssistantSeeder, DrugSeeder, DemoSeeder, PrescriptionSeeder).
 * The same random seed every time, so a given moment always gives the same data.
 *
 * Bump SEED_VERSION when the shape or content changes: browsers holding an
 * older version are re-seeded on their next load.
 */
export const SEED_VERSION = 1

export const TABLES = [
  'users',
  'tokens',
  'patients',
  'medical_history_entries',
  'doctor_settings',
  'working_hours',
  'blocked_times',
  'appointments',
  'visits',
  'payments',
  'drugs',
  'prescriptions',
  'prescription_items',
  'audit_logs',
]

export { DEMO_ACCOUNTS, DEMO_PASSWORD }

const RANDOM_SEED = 2026
const PATIENTS = 30
const PHONE_PREFIX = '0102000'
const PAST_DAYS = 30
const FUTURE_DAYS = 7
const UPCOMING_BOOKINGS = 8
const TODAY_BOOKINGS = 3
/** Sat–Thu, 17:00–21:00. Friday (5) has no rows, so it is a day off. */
const WORKING_DAYS = [6, 0, 1, 2, 3, 4]

const DOCTOR_NAME = 'Dr. Doctor'
const ASSISTANT_NAME = 'Demo Assistant'

const SETTINGS = {
  slot_duration_minutes: 45,
  booking_window_days: 30,
  cancel_cutoff_hours: 2,
  clinic_name: 'عيادة الابتسامة لطب الأسنان',
  doctor_title: 'أخصائي طب وجراحة الفم والأسنان',
  clinic_address: '12 شارع التحرير، الدقي، الجيزة',
  clinic_phone: '01000000000',
  prescription_footer: 'مواعيد العمل: السبت – الخميس، 5 – 9 مساءً',
  prescription_paper: 'A5',
}

const NAMES = [
  'أحمد حسن', 'منى علي', 'محمد إبراهيم', 'سارة مصطفى', 'يوسف سعيد', 'نور كمال', 'عمر فتحي', 'هنا عادل',
  'محمود عبد الله', 'مريم سامي', 'خالد شريف', 'ياسمين طارق', 'كريم جمال', 'دينا حسين', 'مصطفى رضا',
  'Ahmed Hassan', 'Mona Ali', 'Omar Fathy', 'Sara Mostafa', 'Youssef Saeed', 'Nour Kamal', 'Hana Adel',
  'Mahmoud Abdallah', 'Mariam Samy', 'Khaled Sherif', 'Yasmine Tarek', 'Karim Gamal', 'Dina Hussein',
  'Mostafa Reda', 'Laila Nabil',
]

const ADDRESSES = ['الدقي، الجيزة', 'مدينة نصر، القاهرة', 'المعادي، القاهرة', 'Heliopolis, Cairo', 'Zamalek, Cairo', '6th of October City']

const ILLNESSES = [
  'ألم في الضرس السفلي منذ أسبوع', 'نزيف من اللثة عند التفريش', 'حساسية من البارد والساخن',
  'Swelling of the lower jaw for two days', 'Broken filling, upper left molar', null, null,
]

const HISTORY = [
  ['condition', 'سكر من النوع الثاني', 'تحت المتابعة مع الطبيب الباطني'],
  ['condition', 'Asthma', 'Uses an inhaler when needed'],
  ['allergy', 'حساسية من البنسلين', 'طفح جلدي بعد آخر جرعة'],
  ['allergy', 'Latex allergy', null],
  ['surgery', 'Knee replacement 2019', null],
  ['medication', 'Metformin 500 mg twice a day', null],
  ['note', 'يخاف من الحقن', 'يحتاج وقتاً أطول قبل التخدير'],
]

/** [work done, total in EGP] */
const TREATMENTS = [
  ['كشف وتنظيف جير وتلميع', 300],
  ['حشو كمبوزيت للضرس السفلي الأيمن', 750],
  ['خلع ضرس العقل العلوي الأيسر', 1000],
  ['علاج عصب - الجلسة الأولى', 1500],
  ['علاج عصب - الجلسة الثانية وحشو نهائي', 1500],
  ['تركيب طربوش زيركون', 3000],
  ['Scaling and polishing, oral hygiene instructions', 300],
  ['Composite filling, lower left first molar', 750],
  ['Root canal treatment, upper right premolar', 2000],
]

/** PrescriptionSeeder: one for each of the first two patients, then a few more. */
const PRESCRIPTIONS = [
  {
    patient: 1,
    daysAgo: 3,
    notes: 'أكل طري لمدة يومين، ولا مشروبات ساخنة اليوم.',
    items: [
      { seed_key: 'augmentin-1g-tabs', instructions: 'قرص كل 12 ساعة بعد الأكل لمدة 7 أيام' },
      { seed_key: 'brufen-400-tabs', instructions: 'قرص بعد الأكل عند اللزوم، بحد أقصى 3 أقراص يوميا' },
      { drug_name: 'Panadol Extra', instructions: '1 tablet when needed, at most 4 a day' },
    ],
  },
  {
    patient: 2,
    daysAgo: 10,
    notes: null,
    items: [
      { seed_key: 'flagyl-500-tabs', instructions: 'قرص كل 8 ساعات بعد الأكل لمدة 5 أيام' },
      { seed_key: 'hexitol-mouthwash', instructions: 'مضمضة 3 مرات يوميا بعد غسل الأسنان' },
    ],
  },
  {
    patient: 16,
    daysAgo: 6,
    notes: 'Soft food for 24 hours.',
    items: [
      { seed_key: 'brufen-400-tabs', instructions: '1 tablet after meals when needed, at most 3 a day' },
      { seed_key: 'hexitol-mouthwash', instructions: 'Rinse 3 times a day after brushing' },
    ],
  },
  {
    patient: 5,
    daysAgo: 20,
    notes: null,
    items: [{ seed_key: 'augmentin-1g-tabs', instructions: 'قرص كل 12 ساعة لمدة 5 أيام' }],
  },
]

const pad4 = (n) => String(n).padStart(4, '0')
const money = (egp) => `${egp}.00`

/**
 * A fresh database around `nowMs`. Pure: the same moment always gives the same rows.
 *
 * @param {number} [nowMs]
 */
export function buildSeed(nowMs = Date.now()) {
  const random = createRandom(RANDOM_SEED)
  const now = nowLocal(nowMs)
  const todayDate = today(nowMs)
  const db = Object.fromEntries(TABLES.map((table) => [table, []]))
  db.meta = { version: SEED_VERSION, seeded_at: now, ids: {} }

  const add = (table, row) => {
    const record = { id: db[table].length + 1, ...row, created_at: row.created_at ?? now, updated_at: row.updated_at ?? now }
    db[table].push(record)
    return record
  }

  const doctor = add('users', { name: DOCTOR_NAME, phone: DEMO_ACCOUNTS.doctor, email: null, password: DEMO_PASSWORD, role: 'doctor', is_active: true })
  const assistant = add('users', { name: ASSISTANT_NAME, phone: DEMO_ACCOUNTS.assistant, email: null, password: DEMO_PASSWORD, role: 'assistant', is_active: true })
  add('doctor_settings', { doctor_id: doctor.id, ...SETTINGS })
  for (const day of WORKING_DAYS) {
    add('working_hours', { doctor_id: doctor.id, day_of_week: day, start_time: '17:00:00', end_time: '21:00:00' })
  }

  for (const entry of drugCatalogue) {
    add('drugs', { pack: null, warnings: null, suggested_dose: null, source_page: null, ...entry, is_active: true })
  }

  const patients = NAMES.slice(0, PATIENTS).map((name, i) => {
    const user = add('users', { name, phone: PHONE_PREFIX + pad4(i + 1), email: null, password: DEMO_PASSWORD, role: 'patient', is_active: true })
    const patient = add('patients', {
      user_id: user.id,
      address: random.pick(ADDRESSES),
      date_of_birth: addDays(subYears(todayDate, random.int(8, 75)), -random.int(0, 364)),
      gender: (i + 1) % 2 ? 'male' : 'female',
      current_illness: random.pick(ILLNESSES),
    })
    for (const index of random.indexes(HISTORY, random.int(1, 3))) {
      const [type, title, details] = HISTORY[index]
      add('medical_history_entries', {
        patient_id: patient.id,
        type,
        title,
        details,
        // Notes stay private; the rest are a mix (FR-C.4).
        patient_visible: type !== 'note' && random.int(0, 1) === 1,
        recorded_on: subMonths(todayDate, random.int(1, 24)),
      })
    }
    return patient
  })

  const minutes = SETTINGS.slot_duration_minutes
  const slotsOn = (date) => {
    const starts = []
    const ranges = db.working_hours.filter((row) => row.day_of_week === dayOfWeek(date)).sort((a, b) => a.start_time.localeCompare(b.start_time))
    for (const range of ranges) {
      const end = timeToMinutes(range.end_time)
      for (let start = timeToMinutes(range.start_time); start + minutes <= end; start += minutes) {
        starts.push(addMinutes(`${date} 00:00:00`, start))
      }
    }
    return starts
  }

  const pay = (visit, amount, method, paidAt, by) => {
    if (amount <= 0) return
    add('payments', { visit_id: visit.id, amount: money(amount), method, paid_at: paidAt, recorded_by: by.id, created_at: paidAt, updated_at: paidAt })
  }

  // Half paid in full on the day; the rest part paid, and about half of those paid more later.
  const addVisit = (patient, appointment, date) => {
    const [work, total] = random.pick(TREATMENTS)
    const at = appointment ? appointment.start_at : `${date} 20:00:00`
    const visit = add('visits', { patient_id: patient.id, appointment_id: appointment?.id ?? null, visit_date: date, work_done: work, total_amount: money(total), created_at: at, updated_at: at })

    const paidAt = addMinutes(at, 30)
    const method = random.pick(['cash', 'cash', 'card', 'wallet'])
    const roll = random.int(1, 10)
    const first = roll <= 5 ? total : Math.floor((total * random.int(2, 6)) / 10)
    pay(visit, first, method, paidAt, doctor)

    const later = addMinutes(paidAt, random.int(3, 14) * 24 * 60)
    if (roll >= 8 && later < now) {
      // An installment at the front desk: all of the rest, or half of it.
      const rest = total - first
      pay(visit, roll === 10 ? rest : Math.floor(rest / 2), 'cash', later, assistant)
    }
  }

  const book = (patient, start, status, extra = {}) =>
    add('appointments', {
      doctor_id: doctor.id,
      patient_id: patient.id,
      start_at: start,
      end_at: addMinutes(start, minutes),
      status,
      checked_in_at: null,
      cancelled_at: null,
      ...extra,
    })

  // 2–4 appointments a day (mostly seen, some no-shows and cancellations), a walk-in on about one day in four.
  const seenDay = (date, slots) => {
    for (const index of random.indexes(slots, random.int(2, 4))) {
      const start = slots[index]
      const patient = random.pick(patients)
      const roll = random.int(1, 10)
      const status = roll === 1 ? 'no_show' : roll === 2 ? 'cancelled' : 'completed'
      const appointment = book(patient, start, status, {
        checked_in_at: status === 'completed' ? start : null,
        cancelled_at: status === 'cancelled' ? addMinutes(start, -24 * 60) : null,
        created_at: addMinutes(start, -3 * 24 * 60),
      })
      if (status === 'completed') addVisit(patient, appointment, date)
    }
    if (random.int(1, 4) === 1) addVisit(random.pick(patients), null, date)
  }

  for (let offset = -PAST_DAYS; offset < 0; offset++) {
    const date = addDays(todayDate, offset)
    const slots = slotsOn(date)
    if (slots.length) seenDay(date, slots)
  }

  // Upcoming bookings, one per patient (BR-4). Patient #1 has none, so the
  // demo patient can book straight away.
  const free = random.shuffle(patients.slice(1))
  let next = 0
  const todaySlots = slotsOn(todayDate)
  const todayDone = todaySlots.filter((start) => start < now)
  if (todayDone.length) seenDay(todayDate, todayDone)
  for (const start of todaySlots.filter((s) => s >= now).slice(0, TODAY_BOOKINGS)) {
    book(free[next++], start, 'booked', { created_at: addMinutes(now, -2 * 24 * 60) })
  }
  for (let offset = 1; offset <= FUTURE_DAYS && next < TODAY_BOOKINGS + UPCOMING_BOOKINGS; offset++) {
    for (const start of slotsOn(addDays(todayDate, offset)).slice(0, 2)) {
      if (next >= TODAY_BOOKINGS + UPCOMING_BOOKINGS) break
      book(free[next++], start, 'booked', { created_at: addMinutes(now, -24 * 60) })
    }
  }

  const drugsByKey = new Map(db.drugs.map((drug) => [drug.seed_key, drug]))
  for (const demo of PRESCRIPTIONS) {
    const issued = addDays(todayDate, -demo.daysAgo)
    const prescription = add('prescriptions', {
      patient_id: patients[demo.patient - 1].id,
      doctor_id: doctor.id,
      visit_id: null,
      issued_on: issued,
      notes: demo.notes,
      created_at: `${issued} 19:00:00`,
      updated_at: `${issued} 19:00:00`,
    })
    let position = 0
    for (const item of demo.items) {
      const drug = item.seed_key ? drugsByKey.get(item.seed_key) : null
      if (item.seed_key && !drug) continue
      add('prescription_items', {
        prescription_id: prescription.id,
        drug_id: drug?.id ?? null,
        // RX-2: name and form are a snapshot.
        drug_name: drug?.trade_name ?? item.drug_name,
        drug_form: drug?.form ?? null,
        instructions: item.instructions,
        position: ++position,
      })
    }
  }

  for (const table of TABLES) db.meta.ids[table] = db[table].length
  return db
}
