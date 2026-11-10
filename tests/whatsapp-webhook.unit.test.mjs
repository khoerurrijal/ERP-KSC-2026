import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NON_TEXT_MESSAGE,
  buildBurstContext,
  claimOutboundAttempt,
  getWebhookDedupeKey,
  normalizeFonnteFailure,
  normalizeFonnteResponse,
  selectBurstMessages,
} from '../src/utils/whatsappWebhook.mjs';

test('numeric Fonnte inboxid is normalized and produces a stable event key', () => {
  const first = getWebhookDedupeKey({
    body: { device: '628100000000', inboxid: 12345 },
    normalizedSender: '628200000000',
    message: 'halo',
  });
  const retry = getWebhookDedupeKey({
    body: { device: '628100000000', inboxid: '12345', timestamp: 'a later retry time' },
    normalizedSender: '628200000000',
    message: 'halo',
  });

  assert.equal(first, retry);
  assert.ok(first.startsWith('wa:v2:'));
});

test('ten parallel retries yield one atomic claim and at most one outbound attempt', async () => {
  const claims = new Set();
  const outboundState = { attempted: false };
  const results = await Promise.all(Array.from({ length: 10 }, async () => {
    const key = getWebhookDedupeKey({
      body: { device: '628100000000', inboxid: 67890 },
      normalizedSender: '628200000000',
      message: 'foto produk',
      mediaKind: 'image',
    });
    if (claims.has(key)) return { stored: false, sent: false };
    claims.add(key); // In-memory simulation of the database unique index.
    return { stored: true, sent: claimOutboundAttempt(outboundState) };
  }));

  assert.equal(results.filter(result => result.stored).length, 1);
  assert.equal(results.filter(result => result.sent).length, 1);
});

test('distinct inboxids remain distinct even when sender and text match', () => {
  const first = getWebhookDedupeKey({
    body: { device: 'device-a', inboxid: 1 },
    normalizedSender: '628200000000',
    message: 'harga',
  });
  const second = getWebhookDedupeKey({
    body: { device: 'device-a', inboxid: 2 },
    normalizedSender: '628200000000',
    message: 'harga',
  });

  assert.notEqual(first, second);
});

test('timestamp fallback is stable for retries and distinguishes a later identical message', () => {
  const timestampSeconds = Date.parse('2026-11-09T18:40:00.000Z') / 1000;
  const first = getWebhookDedupeKey({
    body: { device: 'device-a', timestamp: timestampSeconds },
    normalizedSender: '628200000000',
    message: 'halo',
    mediaKind: 'text',
  });
  const retry = getWebhookDedupeKey({
    body: { device: 'device-a', timestamp: '2026-11-09T18:40:00.000Z' },
    normalizedSender: '628200000000',
    message: 'halo',
    mediaKind: 'text',
  });
  const laterMessage = getWebhookDedupeKey({
    body: { device: 'device-a', timestamp: '2026-11-09T18:40:01.000Z' },
    normalizedSender: '628200000000',
    message: 'halo',
    mediaKind: 'text',
  });

  assert.equal(first, retry);
  assert.notEqual(first, laterMessage);
});

test('event without inboxid or timestamp has no automatic dedupe key', () => {
  assert.equal(getWebhookDedupeKey({
    body: { device: 'device-a' },
    normalizedSender: '628200000000',
    message: 'halo',
  }), null);
});

test('burst context preserves text order and collapses media metadata', () => {
  const context = buildBurstContext([
    { content: 'Halo, saya mau tanya harga' },
    { content: `${NON_TEXT_MESSAGE}` },
    { content: 'paper cup 12 oz\n[[Lampiran:image]]' },
  ]);

  assert.deepEqual(context, {
    text: 'Halo, saya mau tanya harga\npaper cup 12 oz',
    hasMedia: true,
    mediaKinds: ['lampiran', 'image'],
  });
});

test('a burst follows the 2.5 second silence window and preserves message order', () => {
  const start = Date.parse('2026-11-09T18:40:00.000Z');
  const burst = selectBurstMessages([
    { id: 'latest', created_at: new Date(start + 4900).toISOString(), content: 'ketiga' },
    { id: 'middle', created_at: new Date(start + 2400).toISOString(), content: 'kedua' },
    { id: 'first', created_at: new Date(start).toISOString(), content: 'pertama' },
    { id: 'old', created_at: new Date(start - 2600).toISOString(), content: 'sebelumnya' },
  ], 'latest');

  assert.deepEqual(burst.map(message => message.id), ['first', 'middle', 'latest']);
  assert.equal(buildBurstContext(burst).text, 'pertama\nkedua\nketiga');
});

test('Fonnte status false is a known rejection and is not treated as accepted', () => {
  assert.deepEqual(normalizeFonnteResponse(true, 200, { status: false, reason: 'device offline' }), {
    accepted: false,
    certainty: 'known',
    providerStatus: false,
    httpStatus: 200,
    requestId: null,
    messageIds: [],
    process: null,
    reason: 'device offline',
  });
});

test('Fonnte accepted response records provider identifiers', () => {
  const result = normalizeFonnteResponse(true, 200, {
    status: true,
    requestid: 'req-1',
    id: [123, '456'],
    process: 'queued',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.certainty, 'known');
  assert.equal(result.requestId, 'req-1');
  assert.deepEqual(result.messageIds, ['123', '456']);
});

test('a Fonnte timeout is ambiguous and the same burst can claim only one send', () => {
  const failure = normalizeFonnteFailure({ name: 'TimeoutError' });
  assert.equal(failure.accepted, false);
  assert.equal(failure.certainty, 'unknown');

  const state = { attempted: false };
  assert.equal(claimOutboundAttempt(state), true);
  assert.equal(claimOutboundAttempt(state), false);
});
