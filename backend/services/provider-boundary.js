'use strict';

// Provider boundary for the two product halves.
//
//   shield -> Baileys. QR login, number checking, profile photos, scan results.
//             Lookup/validation ONLY. Never sends a message.
//   crm    -> Official Meta WhatsApp Cloud API. Messages, approved templates,
//             campaigns, AI agents, inbox, auto-replies. Never touches Baileys.
//
// This module is the single place that states which transport a flow is allowed
// to use, so a CRM code path physically cannot fall back to the linked device
// and Shield cannot be wired into an outbound send.

const PROVIDERS = Object.freeze({
  SHIELD: 'shield',
  META: 'meta',
});

// The only transport allowed to originate an outbound WhatsApp message.
// Shield is intentionally absent — a lead-finder must never send.
const SEND_TRANSPORT = PROVIDERS.META;

class ProviderBoundaryError extends Error {
  constructor(message, { provider, attemptedTransport } = {}) {
    super(message);
    this.name = 'ProviderBoundaryError';
    this.code = 'PROVIDER_BOUNDARY_VIOLATION';
    this.provider = provider;
    this.attemptedTransport = attemptedTransport;
  }
}

/**
 * Hard gate for every outbound WhatsApp send in the product.
 *
 * @param {string} flow            logical flow name, for logs/audit
 * @param {object} [opts]
 * @param {string} [opts.provider] provider the caller is running as
 * @param {string} [opts.transport] transport the caller intends to use
 * @param {boolean} [opts.requireTemplate] outbound first touch must use a template
 * @returns {string} the approved transport
 * @throws {ProviderBoundaryError} when a non-Meta path tries to send
 */
const assertCanSend = (flow, opts = {}) => {
  const provider = opts.provider || PROVIDERS.META;
  const transport = opts.transport || SEND_TRANSPORT;

  if (provider === PROVIDERS.SHIELD) {
    throw new ProviderBoundaryError(
      'WhatsApp Shield is a lookup-only tool and cannot send messages.',
      { provider, attemptedTransport: transport }
    );
  }

  if (transport !== PROVIDERS.META) {
    throw new ProviderBoundaryError(
      `The CRM can only send through the official Meta Cloud API (attempted "${transport}").`,
      { provider, attemptedTransport: transport }
    );
  }

  return SEND_TRANSPORT;
};

/**
 * Shield capability filter. A Baileys result can only become a CRM contact when
 * it is a real 1-to-1 user and it was validated for lookup purposes only.
 */
const isShieldLookupResult = (result = {}) => {
  if (result.error) return false;
  if (result.isValidFormat === false) return false;
  return result.exists === true;
};

/** Opt-in tri-state used by campaigns and the 24-hour window rules. */
const OPT_IN = Object.freeze({
  UNKNOWN: 'unknown',
  OPTED_IN: 'opted_in',
  OPTED_OUT: 'opted_out',
});

const normalizeOptIn = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'opted_in' || v === 'opted-in' || v === 'optedin' || v === 'true' || v === 'yes') {
    return OPT_IN.OPTED_IN;
  }
  if (v === 'opted_out' || v === 'opted-out' || v === 'optedout' || v === 'false' || v === 'no') {
    return OPT_IN.OPTED_OUT;
  }
  return OPT_IN.UNKNOWN;
};

const isOptedOut = (contact = {}) => normalizeOptIn(contact.optIn) === OPT_IN.OPTED_OUT;
const hasUnknownOptIn = (contact = {}) => normalizeOptIn(contact.optIn) === OPT_IN.UNKNOWN;

// Meta's customer-service window: free-form replies are only allowed for 24h
// after the customer's last inbound message.
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * @param {object} contact
 * @param {Date|string|number} [now]
 * @returns {{ open: boolean, expiresAt: string|null, remainingMs: number }}
 */
const serviceWindow = (contact = {}, now = Date.now()) => {
  const last = contact.lastInboundAt || contact.lastInbound || contact.lastMessageAt || null;
  if (!last) {
    return { open: false, expiresAt: null, remainingMs: 0 };
  }
  const ts = new Date(last).getTime();
  if (Number.isNaN(ts)) return { open: false, expiresAt: null, remainingMs: 0 };

  const expiresAt = ts + SERVICE_WINDOW_MS;
  const remainingMs = Math.max(0, expiresAt - now);
  return {
    open: remainingMs > 0,
    expiresAt: new Date(expiresAt).toISOString(),
    remainingMs,
  };
};

/** Meta treats these keywords as an opt-out request. */
const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'stopall', 'end', 'cancel', 'quit', 'optout', 'opt out'];

/**
 * Detect an opt-out request in inbound text.
 * @returns {{ optedOut: boolean, keyword: string|null }}
 */
const detectOptOut = (text) => {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return { optedOut: false, keyword: null };
  // Normalise so "STOP", "stop" and " Stop " all match.
  const normalized = value.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const keyword of OPT_OUT_KEYWORDS) {
    if (normalized === keyword) return { optedOut: true, keyword };
    if (normalized.split(' ').includes(keyword) && keyword.length > 4) {
      return { optedOut: true, keyword };
    }
  }
  return { optedOut: false, keyword: null };
};

/**
 * Decide what a contact is allowed to receive.
 *
 * @returns {{ allowed: boolean, mode: 'template'|'freeform', reason?: string, requiresOptInWarning?: boolean }}
 */
const resolveSendPolicy = (contact = {}, opts = {}) => {
  const optIn = normalizeOptIn(contact.optIn);

  if (optIn === OPT_IN.OPTED_OUT) {
    return { allowed: false, mode: 'template', reason: 'Contact has opted out and must never be messaged.' };
  }

  const templateName = opts.templateName || null;
  const templateApproved = opts.templateApproved !== false;

  if (templateName) {
    if (!templateApproved) {
      return { allowed: false, mode: 'template', reason: `Template "${templateName}" is not approved by Meta.` };
    }
    return {
      allowed: true,
      mode: 'template',
      requiresOptInWarning: optIn === OPT_IN.UNKNOWN,
    };
  }

  const window = serviceWindow(contact);
  if (!window.open) {
    return {
      allowed: false,
      mode: 'template',
      reason: 'Outside the 24-hour customer service window — an approved template is required.',
    };
  }

  return { allowed: true, mode: 'freeform', requiresOptInWarning: optIn === OPT_IN.UNKNOWN };
};

module.exports = {
  PROVIDERS,
  SEND_TRANSPORT,
  OPT_IN,
  SERVICE_WINDOW_MS,
  ProviderBoundaryError,
  assertCanSend,
  isShieldLookupResult,
  normalizeOptIn,
  isOptedOut,
  hasUnknownOptIn,
  serviceWindow,
  detectOptOut,
  resolveSendPolicy,
};
