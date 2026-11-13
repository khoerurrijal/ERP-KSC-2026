import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getProductionItemProgress,
  getRecalculatedProductionStatus,
  getAutomaticProductionColorPass,
  getAutomaticProductionProgressQty,
  isAutomaticProductionLog,
  isProductionPassQtyWithinTarget,
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

test('editing processed date does not change the automatic period or saved color stage', () => {
  const editedLog = {
    id: 'edited-date-w2',
    job_id: job.id,
    qty_processed: 100,
    processed_date: '2026-10-31',
    created_at: '2026-11-12 04:29:22.19236+00',
    notes: '[[WARNA_PASS:2]]'
  }
  const result = reconcileProductionColorPasses([job], [editedLog])

  assert.equal(isAutomaticProductionLog(editedLog), true)
  assert.equal(result.colorPassByLogId.get(editedLog.id), 2)
  assert.equal(result.colorPassTotalsByJobId.get(job.id)[2], 100)
})

test('two-color readiness requires both passes and counts physical goods only once', () => {
  const item = { id: 'ready-two-color', notes: '2 warna', qty: 1000, unit_multiplier: 1 }
  const logs = [
    { id: 'w1', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11 09:00:00.000000+00', notes: '[[WARNA_PASS:1]]' },
    { id: 'w2', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11 10:00:00.000000+00', notes: '[[WARNA_PASS:2]]' }
  ]
  const complete = getProductionItemProgress(item, logs)

  assert.equal(complete.qtyActivity, 2000)
  assert.equal(complete.qtyPhysicalCompleted, 1000)
  assert.equal(complete.isComplete, true)
  assert.equal(getRecalculatedProductionStatus(item, logs, { currentStatus: 'PROSES' }), 'SIAP KIRIM')
})

test('deleting or reducing W2 returns a complete W1 job to the W2 stage', () => {
  const item = { id: 'delete-w2', notes: '2 warna', qty: 1000, unit_multiplier: 1 }
  const logs = [
    { id: 'w1', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11 09:00:00.000000+00', notes: '[[WARNA_PASS:1]]' },
    { id: 'w2', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11 10:00:00.000000+00', notes: '[[WARNA_PASS:2]]' }
  ]
  const withoutW2 = logs.filter(log => log.id !== 'w2')
  const reducedW2 = logs.map(log => log.id === 'w2' ? { ...log, qty_processed: 500 } : log)

  for (const remaining of [withoutW2, reducedW2]) {
    const progress = getProductionItemProgress(item, remaining)
    assert.equal(progress.qtyColorOne, 1000)
    assert.equal(progress.qtyColorTwo, remaining === withoutW2 ? 0 : 500)
    assert.equal(progress.nextColorPass, 2)
    assert.equal(getRecalculatedProductionStatus(item, remaining, { currentStatus: 'SIAP KIRIM', forceRecalculate: true }), 'PROSES')
  }
})

test('deleting or reducing W1 returns the job to the W1 stage', () => {
  const item = { id: 'delete-w1', notes: '2 warna', qty: 1000, unit_multiplier: 1 }
  const logs = [
    { id: 'w1', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11 09:00:00.000000+00', notes: '[[WARNA_PASS:1]]' },
    { id: 'w2', job_id: item.id, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11 10:00:00.000000+00', notes: '[[WARNA_PASS:2]]' }
  ]
  const withoutW1 = logs.filter(log => log.id !== 'w1')
  const reducedW1 = logs.map(log => log.id === 'w1' ? { ...log, qty_processed: 500 } : log)

  for (const remaining of [withoutW1, reducedW1]) {
    const progress = getProductionItemProgress(item, remaining)
    assert.equal(progress.qtyColorOne, remaining === withoutW1 ? 0 : 500)
    assert.equal(progress.qtyColorTwo, 1000)
    assert.equal(progress.nextColorPass, 1)
    assert.equal(getRecalculatedProductionStatus(item, remaining, { currentStatus: 'SIAP KIRIM', forceRecalculate: true }), 'PROSES')
  }
})

test('per-color input cannot exceed the remaining target', () => {
  const item = { id: 'boundary', notes: '2 warna', qty: 1000, unit_multiplier: 1 }
  const progress = getProductionItemProgress(item, [
    { id: 'partial-w1', job_id: item.id, qty_processed: 500, processed_date: '2026-11-12', created_at: '2026-11-12 09:00:00.000000+00', notes: '[[WARNA_PASS:1]]' }
  ])

  assert.equal(isProductionPassQtyWithinTarget(500, progress.qtyColorOne, progress.targetPerColor), true)
  assert.equal(isProductionPassQtyWithinTarget(501, progress.qtyColorOne, progress.targetPerColor), false)
})

test('one-color edit and delete recalculation preserve physical quantity semantics', () => {
  const item = { id: 'one-color', notes: '1 warna', qty: 1000, unit_multiplier: 1 }
  const full = [{ id: 'one-log', job_id: item.id, qty_processed: 1000 }]
  const edited = [{ ...full[0], qty_processed: 500 }]

  assert.equal(getProductionItemProgress(item, full).qtyPhysicalCompleted, 1000)
  assert.equal(getRecalculatedProductionStatus(item, full, { currentStatus: 'PROSES', forceRecalculate: true }), 'SIAP KIRIM')
  assert.equal(getRecalculatedProductionStatus(item, edited, { currentStatus: 'SIAP KIRIM', forceRecalculate: true }), 'PROSES')
  assert.equal(getRecalculatedProductionStatus(item, [], { currentStatus: 'SIAP KIRIM', canProceed: true, forceRecalculate: true }), 'SIAP PROSES')
})
