import test from 'node:test'
import assert from 'node:assert/strict'
import { isProductionProgressSnapshotCurrent } from './productionColorPasses.mjs'

test('accepts an unchanged two-color W1 snapshot', () => {
  const progress = { qtyActivity: 500, qtyColorOne: 500, qtyColorTwo: 0, nextColorPass: 1 }
  assert.equal(isProductionProgressSnapshotCurrent(progress, progress, true), true)
})

test('rejects a stale W1 snapshot after another input advances the item to W2', () => {
  const submittedSnapshot = { qtyActivity: 1000, qtyColorOne: 1000, qtyColorTwo: 0, nextColorPass: 2 }
  const currentProgress = { qtyActivity: 2000, qtyColorOne: 1000, qtyColorTwo: 1000, nextColorPass: null }
  assert.equal(isProductionProgressSnapshotCurrent(submittedSnapshot, currentProgress, true), false)
})

test('rejects a stale single-color snapshot while accepting unchanged progress', () => {
  const submittedSnapshot = { qtyActivity: 500 }
  assert.equal(isProductionProgressSnapshotCurrent(submittedSnapshot, { qtyActivity: 500 }, false), true)
  assert.equal(isProductionProgressSnapshotCurrent(submittedSnapshot, { qtyActivity: 1000 }, false), false)
})

test('rejects two-color progress when W1/W2 changed without changing total activity', () => {
  const submittedSnapshot = { qtyActivity: 1000, qtyColorOne: 1000, qtyColorTwo: 0, nextColorPass: 2 }
  const currentProgress = { qtyActivity: 1000, qtyColorOne: 500, qtyColorTwo: 500, nextColorPass: 1 }
  assert.equal(isProductionProgressSnapshotCurrent(submittedSnapshot, currentProgress, true), false)
})
