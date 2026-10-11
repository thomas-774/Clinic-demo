import { beforeEach, describe, expect, it } from 'vitest'
import * as drugsApi from '../../../api/drugs'
import * as api from '../../../api/prescriptions'
import { today } from '../../clock'
import { db, failure, loginAs, resetDemo } from '../../../test/demo'

beforeEach(async () => {
  resetDemo()
  await loginAs('doctor')
})

const drugId = (seedKey) => db.first('drugs', { seed_key: seedKey }).id

describe('prescriptions', () => {
  it('lists a patient’s prescriptions newest first, with drug names', async () => {
    const list = await api.listPrescriptions(1)
    expect(list).toEqual([
      { id: 1, issued_on: expect.any(String), visit_id: null, notes: expect.any(String), drug_names: ['Augmentin 1 g', 'Brufen 400 mg', 'Panadol Extra'] },
    ])
  })

  it('creates one with catalogue and free-text lines, snapshots and print header', async () => {
    const visit = db.first('visits', { patient_id: 3 })
    const saved = await api.createPrescription(3, {
      visit_id: visit.id,
      notes: '  Soft food  ',
      items: [
        { drug_id: drugId('flagyl-500-tabs'), instructions: ' 1 tablet every 8 hours ' },
        { drug_name: ' Vitamin C ', instructions: 'Once a day' },
      ],
    })
    expect(saved).toMatchObject({ patient_id: 3, visit_id: visit.id, issued_on: today(), notes: 'Soft food' })
    expect(saved.items).toEqual([
      { id: expect.any(Number), position: 1, drug_id: drugId('flagyl-500-tabs'), drug_name: 'Flagyl 500 mg', drug_form: expect.any(String), instructions: '1 tablet every 8 hours' },
      { id: expect.any(Number), position: 2, drug_id: null, drug_name: 'Vitamin C', drug_form: null, instructions: 'Once a day' },
    ])
    expect(saved.patient).toEqual({ id: 3, name: 'محمد إبراهيم', age: expect.any(Number) })
    expect(saved.print).toMatchObject({ doctor_name: 'Dr. Doctor', clinic_name: 'عيادة الابتسامة لطب الأسنان', paper: 'A5' })

    // The prescription and each line are audited as created.
    const created = db.where('audit_logs', { action: 'created' }).map((row) => row.auditable_type)
    expect(created).toEqual(['App\\Models\\Prescription', 'App\\Models\\PrescriptionItem', 'App\\Models\\PrescriptionItem'])
  })

  it('refuses no lines, a line without drug, and another patient’s visit', async () => {
    const empty = await failure(api.createPrescription(3, { items: [] }))
    expect(empty.data.errors.items).toEqual(['The prescription lines field is required.'])

    const noDrug = await failure(api.createPrescription(3, { items: [{ instructions: 'x' }, { drug_id: 99999, instructions: '' }] }))
    expect(noDrug.data.errors).toEqual({
      'items.0.drug_name': ['Choose a drug or write its name.'],
      'items.1.drug_id': ['The selected drug is invalid.'],
      'items.1.instructions': ['The instructions field is required.'],
    })

    const otherVisit = db.first('visits', (v) => v.patient_id !== 3)
    const wrong = await failure(api.createPrescription(3, { visit_id: otherVisit.id, items: [{ drug_name: 'x', instructions: 'y' }] }))
    expect(wrong.data.errors.visit_id).toEqual(['This visit belongs to another patient.'])

    const tooMany = await failure(api.createPrescription(3, { items: Array.from({ length: 16 }, () => ({ drug_name: 'x', instructions: 'y' })) }))
    expect(tooMany.data.errors.items).toEqual(['The prescription lines field must not have more than 15 items.'])
  })

  it('updates (lines replaced, date kept), shows as printed, and deletes', async () => {
    const before = await api.getPrescription(2)
    const updated = await api.updatePrescription(2, { items: [{ drug_name: 'Only line', instructions: 'Now' }] })
    expect(updated.issued_on).toBe(before.issued_on)
    expect(updated.items.map((i) => i.drug_name)).toEqual(['Only line'])
    expect(db.where('prescription_items', { prescription_id: 2 })).toHaveLength(1)

    await api.getPrescription(2, { purpose: 'print' })
    expect(db.where('audit_logs', { action: 'printed' })).toHaveLength(1)

    await api.deletePrescription(2)
    expect(db.find('prescriptions', 2)).toBeNull()
    expect(db.where('prescription_items', { prescription_id: 2 })).toHaveLength(0)
    await expect(api.getPrescription(2)).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('a renamed drug keeps the old name on old prescriptions (RX-2)', async () => {
    const id = drugId('augmentin-1g-tabs')
    await drugsApi.updateDrug(id, { trade_name: 'Augmentin 1000' })
    expect((await api.getPrescription(1)).items[0].drug_name).toBe('Augmentin 1 g')
  })
})

describe('drugs', () => {
  it('suggests shown drugs by name first, then by ingredient, from two letters', async () => {
    expect(await drugsApi.searchDrugs('a')).toEqual([])
    const results = await drugsApi.searchDrugs('aug')
    expect(results[0]).toEqual({ id: expect.any(Number), trade_name: expect.stringMatching(/^Augmentin/), form: expect.any(String), pack: expect.any(String), category: 'antibiotic', short_use: expect.any(String) })

    const byIngredient = await drugsApi.searchDrugs('amoxicillin')
    expect(byIngredient.length).toBeGreaterThan(0)
    expect(byIngredient.length).toBeLessThanOrEqual(15)

    await drugsApi.updateDrug(results[0].id, { is_active: false })
    expect((await drugsApi.searchDrugs('aug')).map((d) => d.id)).not.toContain(results[0].id)
    // Hidden drugs stay readable (RX-3).
    expect((await drugsApi.getDrug(results[0].id)).is_active).toBe(false)
  })

  it('pages the catalogue, filters by category and can include hidden drugs', async () => {
    const page = await drugsApi.listDrugs()
    expect(page.meta).toMatchObject({ current_page: 1, per_page: 20, total: 128 })
    const antibiotics = await drugsApi.listDrugs({ category: 'antibiotic' })
    expect(antibiotics.data.every((d) => d.category === 'antibiotic')).toBe(true)

    await drugsApi.updateDrug(page.data[0].id, { is_active: false })
    expect((await drugsApi.listDrugs()).meta.total).toBe(127)
    expect((await drugsApi.listDrugs({ includeHidden: true })).meta.total).toBe(128)
    expect((await failure(drugsApi.listDrugs({ category: 'candy' }))).data.errors.category).toEqual(['The selected category is invalid.'])
  })

  it('adds a drug with trimmed ingredients and validates it', async () => {
    const drug = await drugsApi.createDrug({
      trade_name: 'Demo Gel',
      form: 'gel',
      category: 'other',
      active_ingredients: [{ name: ' lidocaine ', note: '' }],
      uses: 'Numbs the gum',
    })
    expect(drug).toMatchObject({ trade_name: 'Demo Gel', active_ingredients: [{ name: 'lidocaine', note: null }], is_active: true, source_page: null })

    const bad = await failure(drugsApi.createDrug({ trade_name: '', form: 'gel', category: 'other', active_ingredients: [], uses: 'x' }))
    expect(bad.data.errors).toEqual({
      trade_name: ['The trade name field is required.'],
      active_ingredients: ['The active ingredients field is required.'],
    })
  })
})
