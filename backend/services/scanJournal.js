'use strict';

/**
 * Crash-durable scan journal.
 *
 * A scan used to live ONLY in memory (`bulkCheckJob`). Any backend restart, crash
 * or uncaught exception therefore threw the whole job away: the UI showed
 * 0/0 Idle, the Leads list and live phone preview emptied, and no report was
 * ever written. This module makes the running scan durable so a restart resumes
 * it (or finalizes a partial report) instead of losing it.
 *
 * Design notes:
 *  - Lives in backend/scan-state/ which contains no .js files, so the dev
 *    process can never be restarted by its own writes (nothing watches it).
 *  - Every write is async and serialized through a single promise chain: the
 *    event loop is never blocked, which is what previously caused Baileys
 *    ping timeouts.
 *  - The queue/settings are written once (atomic tmp+rename) when a job opens;
 *    results are appended to a JSONL journal keyed by their loop index, so the
 *    resume position is recoverable from the journal itself. Rewriting the whole
 *    file per result would be O(n^2) for a 10k scan.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'scan-state');
const META_FILE = path.join(DIR, 'active-scan.json');
const JOURNAL_FILE = path.join(DIR, 'active-scan.journal.jsonl');
const TMP_FILE = path.join(DIR, 'active-scan.json.tmp');

// Results are buffered and flushed in batches: one write per result would hammer
// the disk on fast (non-shield) scans, while an unbounded delay risks losing
// work on a hard kill. 400ms bounds the loss to well under one lookup.
const FLUSH_DEBOUNCE_MS = 400;
const MAX_BUFFERED = 25;

let writeChain = Promise.resolve();
let buffer = [];
let flushTimer = null;
let disabled = false;

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

// Serialized async write. Errors are swallowed (with a single warning) because a
// failed journal must never abort a live scan.
function enqueue(task) {
  writeChain = writeChain.then(task).catch((err) => {
    if (!disabled) {
      disabled = true;
      console.error('[SCAN-JOURNAL] Disabled after write failure (scan continues in memory only):', err && err.message);
    }
  });
  return writeChain;
}

function flushNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  const payload = batch.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
  enqueue(async () => {
    ensureDir();
    await fs.promises.appendFile(JOURNAL_FILE, payload, 'utf8');
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flushNow, FLUSH_DEBOUNCE_MS);
  flushTimer.unref?.();
}

/**
 * Record the immutable identity of the running scan: id, settings and the full
 * number queue. Written before the first lookup so a crash at 0% is still
 * recoverable, and replaced (not appended) whenever a different job opens.
 */
function writeMeta(meta) {
  return enqueue(async () => {
    ensureDir();
    await fs.promises.writeFile(TMP_FILE, JSON.stringify(meta), 'utf8');
    await fs.promises.rename(TMP_FILE, META_FILE);
    // New job => drop the previous job's journal so replays never mix.
    await fs.promises.writeFile(JOURNAL_FILE, '', 'utf8');
  });
}

/** Append one completed result at its loop index. */
function appendResult(index, result) {
  if (disabled) return;
  buffer.push({ t: 'r', i: index, v: result });
  if (buffer.length >= MAX_BUFFERED) flushNow();
  else scheduleFlush();
}

/** Append the pre-scan invalid rows that are seeded before the loop starts. */
function appendResults(entries) {
  if (disabled || !Array.isArray(entries) || entries.length === 0) return;
  for (const e of entries) {
    if (e && Number.isInteger(e.i)) buffer.push({ t: 'r', i: e.i, v: e.v });
  }
  flushNow();
}

/** Best-effort synchronous-ish flush for shutdown paths. */
function flushSync() {
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  try {
    ensureDir();
    fs.appendFileSync(JOURNAL_FILE, batch.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  } catch (_) { /* best effort only */ }
}

/**
 * Replay the journal into { meta, results, cursor }.
 * `cursor` is the highest index durably recorded, so a resume continues at the
 * next unprocessed number instead of re-checking work that already completed.
 * A truncated final line (killed mid-write) is simply ignored.
 */
function readActiveScan() {
  let meta = null;
  let results = [];
  let cursor = -1;
  try {
    if (fs.existsSync(META_FILE)) {
      meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    }
  } catch (_) { return null; }
  if (!meta || !Array.isArray(meta.numbers)) return null;

  try {
    if (fs.existsSync(JOURNAL_FILE)) {
      const raw = fs.readFileSync(JOURNAL_FILE, 'utf8');
      const byIndex = new Map();
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let entry;
        try { entry = JSON.parse(trimmed); } catch (_) { continue; }
        if (!entry || entry.t !== 'r' || !Number.isInteger(entry.i)) continue;
        // Last write for an index wins (idempotent replay).
        byIndex.set(entry.i, entry.v);
        // Negative indexes are pre-scan invalid rows (seeded before the loop),
        // not loop positions, so they never advance the resume cursor.
        if (entry.i >= 0 && entry.i > cursor) cursor = entry.i;
      }
      results = Array.from(byIndex.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => v)
        .filter((v) => v && typeof v === 'object');
    }
  } catch (_) { /* partial journal is still usable */ }

  return { meta, results, cursor };
}

/** Remove the journal once the job is finalized so the next boot starts clean. */
function clearActiveScan() {
  buffer = [];
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  return enqueue(async () => {
    await Promise.allSettled([
      fs.promises.rm(META_FILE, { force: true }),
      fs.promises.rm(JOURNAL_FILE, { force: true }),
      fs.promises.rm(TMP_FILE, { force: true }),
    ]);
  });
}

module.exports = { writeMeta, appendResult, appendResults, flushSync, readActiveScan, clearActiveScan, SCAN_STATE_DIR: DIR };
