import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAutomaticProductionColorPass,
  getAutomaticProductionProgressQty,
  inferProductionColorPasses,
  reconcileProductionColorPasses
} from '../src/utils/productionColorPasses.mjs'

const job = { id: 'two-color-item', notes: '2 warna', qty: 100, unit_multiplier: 1 }

test('automatic production stage changes only after each color target is complete', () => {
  assert.equal(getAutomaticProductionColorPass(0, 100), 1)
  assert.equal(getAutomaticProductionColorPass(99, 100), 1)
  assert.equal(getAutomaticProductionColorPass(100, 100), 2)
  assert.equal(getAutomaticProductionColorPass(199, 100), 2)
  assert.equal(getAutomaticProductionColorPass(200, 100), null)
})

test('an explicitly tagged historical W1 unlocks automatic W2 input in November', () => {
  const stages = inferProductionColorPasses([job], [
    { id: 'w1-legacy', job_id: job.id, qty_processed: 100, processed_date: '2026-10-31', created_at: '2026-10-31T09:00:00+07:00', notes: '[[WARNA_PASS:1]]' },
    { id: 'first-w2', job_id: job.id, qty_processed: 60, processed_date: '2026-11-02', created_at: '2026-11-02T09:00:00+07:00', notes: '' },
    { id: 'second-w2', job_id: job.id, qty_processed: 40, processed_date: '2026-11-03', created_at: '2026-11-03T09:00:00+07:00', notes: '' }
  ])

  assert.equal(stages.get('w1-legacy'), 1)
  assert.equal(stages.get('first-w2'), 2)
  assert.equal(stages.get('second-w2'), 2)
})

test('automatic input progress ignores production recorded before November', () => {
  assert.equal(getAutomaticProductionProgressQty([
    { qty_processed: 100, processed_date: '2026-10-31' },
    { qty_processed: 60, processed_date: '2026-11-02' },
    { qty_processed: 40, processed_date: '2026-11-03' }
  ]), 100)
})

test('records before November keep their existing saved color stage', () => {
  const logs = [
    { id: 'legacy-one', job_id: job.id, qty_processed: 100, processed_date: '2026-10-31', created_at: '2026-10-31T09:00:00+07:00', notes: '[[WARNA_PASS:2]]' },
    { id: 'legacy-two', job_id: job.id, qty_processed: 100, processed_date: '2026-10-31', created_at: '2026-10-31T10:00:00+07:00', notes: '[[WARNA_PASS:1]]' }
  ]
  const result = reconcileProductionColorPasses([job], logs)

  assert.equal(result.colorPassByLogId.get('legacy-one'), 2)
  assert.equal(result.colorPassByLogId.get('legacy-two'), 1)
  assert.deepEqual(result.colorPassTotalsByJobId.get(job.id), { 1: 100, 2: 100 })
})

test('Casa de Spazio stages include Oct 31 W1 and Nov 4 W2 without doubling ordered qty', () => {
  const casa = { id: 'casa', notes: '2 warna', qty: 1000, unit_multiplier: 1 }
  const logs = [
    { id: 'casa-w1', job_id: casa.id, qty_processed: 1000, processed_date: '2026-10-31', created_at: '2026-10-31T09:00:00+07:00', notes: '[[WARNA_PASS:1]]' },
    { id: 'casa-w2', job_id: casa.id, qty_processed: 1000, processed_date: '2026-11-04', created_at: '2026-11-04T09:00:00+07:00', notes: '[[WARNA_PASS:2]]' }
  ]

  const result = reconcileProductionColorPasses([casa], logs)

  assert.deepEqual(result.colorPassTotalsByJobId.get(casa.id), { 1: 1000, 2: 1000 })
  assert.equal(result.colorPassByLogId.get('casa-w1'), 1)
  assert.equal(result.colorPassByLogId.get('casa-w2'), 2)
  assert.equal(result.effectiveQtyByLogId.get('casa-w1') + result.effectiveQtyByLogId.get('casa-w2'), 2000)
  assert.equal(casa.qty, 1000)
})

test('a recorded correction removes canceled duplicate inputs from November accumulation', () => {
  const item = { id: 'casa', notes: '2 warna', qty: 2000, unit_multiplier: 1 }
  const logs = [
    { id: 'old-w1', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11T09:00:00+07:00', notes: 'Warna ke 1' },
    { id: 'old-w2', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11T09:01:00+07:00', notes: 'Warna ke 2' },
    { id: 'correction', job_id: item.id, qty_processed: -2000, processed_date: '2026-11-12', created_at: '2026-11-12T09:00:00+07:00', notes: 'Koreksi Qty oleh Admin' },
    { id: 'new-w1', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-12', created_at: '2026-11-12T09:01:00+07:00', notes: 'Warna ke 1' },
    { id: 'new-w2', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-12', created_at: '2026-11-12T09:02:00+07:00', notes: 'Warna ke 2' }
  ]

  const result = reconcileProductionColorPasses([item], logs)
  const colorTotals = result.colorPassTotalsByJobId.get(item.id)

  assert.deepEqual(logs.map(log => result.effectiveQtyByLogId.get(log.id)), [0, 0, 0, 1000, 1000])
  assert.deepEqual(colorTotals, { 1: 1000, 2: 1000 })
  assert.equal(result.colorPassByLogId.get('new-w1'), 1)
  assert.equal(result.colorPassByLogId.get('new-w2'), 2)
})

test('production entered above one color order quantity is excluded from accumulation', () => {
  const item = { id: 'over-input', notes: '2 warna', qty: 2000, unit_multiplier: 1 }
  const logs = [
    { id: 'over-w1', job_id: item.id, qty_processed: 5000, processed_date: '2026-11-12', created_at: '2026-11-12T09:00:00+07:00' },
    { id: 'later-w2', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-12', created_at: '2026-11-12T09:01:00+07:00' }
  ]

  const result = reconcileProductionColorPasses([item], logs)

  assert.equal(result.effectiveQtyByLogId.get('over-w1'), 2000)
  assert.equal(result.effectiveQtyByLogId.get('later-w2'), 1000)
  assert.deepEqual(result.colorPassTotalsByJobId.get(item.id), { 1: 2000, 2: 1000 })
})
