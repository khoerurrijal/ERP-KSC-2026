import { createHash } from 'node:crypto';

export const NON_TEXT_MESSAGE = 'non-text message';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeWebhookIdentifier(value) {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function normalizeWebhookTimestamp(value) {
  const timestamp = normalizeWebhookIdentifier(value);
  if (!timestamp) return null;

  if (/^\d+(?:\.\d+)?$/.test(timestamp)) {
    const numericTimestamp = Number(timestamp);
    const milliseconds = numericTimestamp < 1e12 ? numericTimestamp * 1000 : numericTimestamp;
    const parsedNumeric = new Date(milliseconds);
    return Number.isNaN(parsedNumeric.getTime()) ? timestamp : parsedNumeric.toISOString();
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toISOString();
}

export function getWebhookDedupeKey({ body = {}, sender, normalizedSender, message, mediaKind }) {
  const canonicalSender = normalizedSender || normalizeWebhookIdentifier(sender);
  if (!canonicalSender) return null;

  const device = normalizeWebhookIdentifier(body.device) || 'unknown-device';
  const inboxId = normalizeWebhookIdentifier(body.inboxid);

  let eventIdentity;
  if (inboxId) {
    eventIdentity = `inbox:${inboxId}`;
  } else {
    const timestamp = normalizeWebhookTimestamp(body.timestamp);
    if (!timestamp) return null;

    eventIdentity = `timestamp:${timestamp}|kind:${mediaKind || 'text'}|content:${sha256(String(message || '').trim())}`;
  }

  return `wa:v2:${sha256(`${device}|${canonicalSender}|${eventIdentity}`)}`;
}

export function buildBurstContext(messages = []) {
  const textParts = [];
  const mediaKinds = new Set();

  for (const entry of messages) {
    const content = String(entry?.content || '').trim();
    if (!content) continue;

    if (content.toLowerCase() === NON_TEXT_MESSAGE) {
      mediaKinds.add('lampiran');
      continue;
    }

    const mediaMarker = content.match(/\n\[\[Lampiran:([^\]]+)\]\]$/);
    const text = mediaMarker ? content.slice(0, mediaMarker.index).trim() : content;
    if (mediaMarker) mediaKinds.add(mediaMarker[1].trim() || 'lampiran');
    if (text) textParts.push(text);
  }

  return {
    text: textParts.join('\n').trim(),
    hasMedia: mediaKinds.size > 0,
    mediaKinds: [...mediaKinds],
  };
}

export function selectBurstMessages(descendingMessages = [], currentMessageId, quietWindowMs = 2500) {
  const currentIndex = descendingMessages.findIndex(message => message.id === currentMessageId);
  if (currentIndex < 0) return [];

  const burst = [descendingMessages[currentIndex]];
  for (let index = currentIndex + 1; index < descendingMessages.length; index += 1) {
    const newerTime = new Date(burst[burst.length - 1].created_at).getTime();
    const olderTime = new Date(descendingMessages[index].created_at).getTime();
    if (!Number.isFinite(olderTime) || newerTime - olderTime > quietWindowMs) break;
    burst.push(descendingMessages[index]);
  }
  return burst.reverse();
}

export function normalizeFonnteResponse(httpOk, httpStatus, data = {}) {
  const providerStatus = data?.status ?? data?.Status;
  const accepted = httpOk && providerStatus === true;
  return {
    accepted,
    certainty: accepted || providerStatus === false ? 'known' : 'unknown',
    providerStatus: providerStatus ?? null,
    httpStatus,
    requestId: data?.requestid ?? null,
    messageIds: Array.isArray(data?.id) ? data.id.map(String) : data?.id ? [String(data.id)] : [],
    process: data?.process ?? null,
    reason: accepted ? null : data?.reason ?? data?.detail ?? null,
  };
}

export function normalizeFonnteFailure(error) {
  return {
    accepted: false,
    certainty: 'unknown',
    error: error?.name || 'Fonnte request failed',
  };
}

export function claimOutboundAttempt(state) {
  if (state.attempted) return false;
  state.attempted = true;
  return true;
}
