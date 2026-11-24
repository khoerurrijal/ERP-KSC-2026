import assert from 'node:assert/strict'
import test from 'node:test'

import { isFullyPaidForDelivery, shouldCompleteDelivery } from './deliveryStatus.mjs'

test('fully paid delivery statuses are recognized', () => {
  assert.equal(isFullyPaidForDelivery('LUNAS'), true)
  assert.equal(isFullyPaidForDelivery('SETTLED_EXTERNAL'), true)
  assert.equal(isFullyPaidForDelivery('DP'), false)
  assert.equal(isFullyPaidForDelivery('BELUM LUNAS'), false)
})

test('shipped or collected items complete only after full payment', () => {
  assert.equal(shouldCompleteDelivery('DIKIRIM', 'LUNAS'), true)
  assert.equal(shouldCompleteDelivery('SUDAH DIAMBIL', 'SETTLED_EXTERNAL'), true)
  assert.equal(shouldCompleteDelivery('TERKIRIM', 'LUNAS'), true)
  assert.equal(shouldCompleteDelivery('DIKIRIM', 'DP'), false)
  assert.equal(shouldCompleteDelivery('SELESAI', 'LUNAS'), false)
})
