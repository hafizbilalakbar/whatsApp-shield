'use strict';

// Rate-limited collapsing of libsignal decrypt noise.
//
// libsignal prints decrypt failures straight to the console with
// `console.error(...)`, bypassing the Baileys pino logger (which this app
// silences). A single undecryptable message therefore emits:
//
//   Failed to decrypt message with any known session...
//   Session error:Error: Bad MAC      at Signal/session_cipher.js:...
//   Session error:Error: Bad MAC      at libsignal/src/session_cipher.js:...
//   ...one pair per known Signal session, per message...
//
// When WhatsApp pushes a backlog of notifications this floods the console,
// buries real errors, and makes the backend look broken when it is actually
// healthy. This module intercepts ONLY those specific decrypt messages,
// counts them, and emits a single line at most once per window so genuine
// problems are still visible but never flood.

const DECRYPT_MARKERS = [
  'Failed to decrypt message with any known session',
  'Session error:',
  'Bad MAC',
];

const isDecryptNoise = (text) => {
  if (typeof text !== 'string') return false;
  for (const marker of DECRYPT_MARKERS) {
    if (text.includes(marker)) return true;
  }
  return false;
};

/**
 * Install the collapsing console.error/console.warn filter.
 *
 * @param {object} [opts]
 * @param {number} [opts.intervalMs] Minimum gap between summary lines.
 * @param {(count:number, lastSample:string, sinceMs:number)=>void} [opts.onSummary]
 * @returns {() => void} uninstall function
 */
const installDecryptLogFilter = (opts = {}) => {
  const intervalMs = Number(opts.intervalMs) || 60_000;
  const logger = opts.logger || console;

  const originalError = console.error;
  const originalWarn = console.warn;

  let count = 0;
  let firstAt = Date.now();
  let lastEmitAt = 0;
  let lastSample = '';

  const summarize = () => {
    const now = Date.now();
    const dropped = count;
    const sinceMs = now - firstAt;
    count = 0;
    firstAt = now;
    lastEmitAt = now;
    if (opts.onSummary) {
      opts.onSummary(dropped, lastSample, sinceMs);
      return;
    }
    originalWarn(
      `[DECRYPT] Suppressed ${dropped} Signal decrypt failure${dropped === 1 ? '' : 's'} ` +
      `over the last ${Math.round(sinceMs / 1000)}s (harmless; no data lost). Last: ${lastSample}`
    );
  };

  // Decide whether this occurrence should be printed or folded into the counter.
  const gate = () => {
    count += 1;
    const now = Date.now();
    if (now - lastEmitAt >= intervalMs) {
      summarize();
      return true; // print this line instead of hiding it
    }
    return false;
  };

  const isDecryptArgs = (args) =>
    args.some((a) => typeof a === 'string' && isDecryptNoise(a)) ||
    (args[0] && args[0].constructor && args[0].constructor.name === 'Error'
      && isDecryptNoise(`${args[0].message} ${args[0].stack || ''}`));

  console.error = (...args) => {
    if (isDecryptArgs(args)) {
      lastSample = args.find((a) => typeof a === 'string' && isDecryptNoise(a)) || 'Session error: Bad MAC';
      if (gate()) originalError(...args);
      return;
    }
    originalError(...args);
  };

  console.warn = (...args) => {
    if (isDecryptArgs(args)) {
      lastSample = args.find((a) => typeof a === 'string' && isDecryptNoise(a)) || 'Session error: Bad MAC';
      if (gate()) originalWarn(...args);
      return;
    }
    originalWarn(...args);
  };

  // Final flush so a shutdown never silently swallows the last occurrences.
  const flush = () => {
    if (count > 0) summarize();
  };
  process.once('exit', flush);

  return () => {
    flush();
    console.error = originalError;
    console.warn = originalWarn;
  };
};

module.exports = { installDecryptLogFilter, isDecryptNoise };