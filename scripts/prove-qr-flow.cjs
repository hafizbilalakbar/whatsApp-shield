'use strict';
/*
 * prove-qr-flow.cjs
 *
 * End-to-end proof of the QR emission path for the hardened WhatsApp service,
 * WITHOUT any real WhatsApp traffic. It loads the REAL backend/whatsapp.js and
 * intercepts ONLY `makeWASocket` (the Baileys network entry point) so we can
 * emit a controlled `connection.update { qr }` event and observe exactly what
 * the service does with it.
 *
 * Why this exists: live WhatsApp currently 403-denies this account (server-side
 * flag), so a real scan cannot be captured here. This harness proves the CODE
 * path that produces + broadcasts a QR is correct and regression-free.
 *
 * Scenarios:
 *   A. Fresh Connect with no session  -> QR is emitted + broadcast as QR_CODE.
 *   B. Connect AFTER a 403 auth-stop  -> state cleared, old session BACKED UP
 *      (not deleted), fresh QR emitted.
 *   C. Double-click Connect           -> single-flight: exactly one socket.
 *
 * Run:  node scripts/prove-qr-flow.cjs
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const MODULE = path.resolve(__dirname, '../backend/whatsapp.js');
const BAILEYS = require.resolve('@whiskeysockets/baileys', { paths: [path.dirname(MODULE)] });

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass += 1; console.log(`  \u2713 ${name}`); }
  else { fail += 1; console.log(`  \u2717 ${name}${detail ? `  [${detail}]` : ''}`); }
}

// --- Intercept makeWASocket BEFORE whatsapp.js captures it -------------------
// Baileys exposes `default` as a non-configurable getter, so we cannot reassign
// it. Instead we replace the module's CACHED exports with a shallow copy whose
// `default` is our fake; whatsapp.js then destructures the fake when loaded.
const realBaileys = require(BAILEYS);
const sockets = [];
let madeSockets = 0;
function makeWASocketFake(cfg) {
  madeSockets += 1;
  const handlers = Object.create(null);
  const sock = {
    cfg,
    user: { id: 'self@s.whatsapp.net', name: 'Proof User' },
    ev: {
      on(ev, cb) { (handlers[ev] = handlers[ev] || []).push(cb); },
      removeAllListeners(ev) { if (ev) handlers[ev] = []; else Object.keys(handlers).forEach((k) => { handlers[k] = []; }); },
      emit(ev, payload) { (handlers[ev] || []).slice().forEach((cb) => cb(payload)); }
    },
    end: async () => {},
    logout: async () => {},
    onWhatsApp: async () => [],
    profilePictureUrl: async () => null
  };
  sockets.push(sock);
  return sock;
}
try { realBaileys.default = makeWASocketFake; } catch (_) { /* read-only */ }
const shim = {};
for (const k of Reflect.ownKeys(realBaileys)) {
  try { shim[k] = realBaileys[k]; } catch (_) { /* skip throwing getter */ }
}
shim.default = makeWASocketFake;
const baileysEntry = require.resolve(BAILEYS);
require.cache[baileysEntry].exports = shim;

// Fast/no-op timings so the harness is instant and cannot self-abort mid-test.
Object.assign(process.env, {
  WA_CONNECT_TIMEOUT_MS: '60000',
  WA_QR_TIMEOUT_MS: '60000',
  WA_QR_MAX_REFRESHES: '3',
  WA_QR_COOLDOWN_MS: '50',
  WA_WARMUP_MS: '100'
});

const srv = require(MODULE);
const { SessionManager } = require(path.resolve(__dirname, '../backend/services/sessionManager.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-qr-proof-'));
const sessionManager = new SessionManager({ backendDir: tmp });
srv.sessionManager = sessionManager;
srv.sessionId = 'default';
srv.sessionPath = sessionManager.getSessionPath('default');
fs.mkdirSync(srv.sessionPath, { recursive: true });

let events = [];
srv.onStatusChangeCallback = (payload) => { events.push(payload); };

function clearTimers() {
  ['_connectTimeout', '_qrTimeoutTimer', '_reconnectTimer', '_cooldownTimer',
    '_warmupTimer', '_stableResetTimer', '_versionRefreshTimer', '_presenceInterval'
  ].forEach((k) => { if (srv[k]) { clearTimeout(srv[k]); clearInterval(srv[k]); srv[k] = null; } });
}

function reset(withCreds) {
  clearTimers();
  try { fs.rmSync(sessionManager.getSessionPath('default'), { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(srv.sessionPath, { recursive: true });
  if (withCreds) {
    fs.writeFileSync(path.join(srv.sessionPath, 'creds.json'), JSON.stringify({
      registered: true, me: { id: 'self@s.whatsapp.net' },
      noiseKey: { priv: 'a', pub: 'b' }, signedIdentityKey: { priv: 'a', pub: 'b' }, signedPreKey: { priv: 'a', pub: 'b' }
    }));
  }
  srv.userInfo = null;
  srv.qrCodeDataUrl = null;
  srv.status = 'DISCONNECTED';
  srv._connecting = false;
  srv._intentionalDisconnect = false;
  srv._pendingPairing = false;
  srv._pairingConnect = false;
  srv._qrGenerating = false;
  srv._qrRefreshCount = 0;
  srv._qrCooldownUntil = 0;
  srv._rateLimitedUntil = 0;
  srv._needsManualRelink = false;
  srv._manualRelinkReason = null;
  srv._sessionInvalidated = false;
  srv._authRejectStreak = 0;
  srv._reconnectPaused = false;
  srv._reconnectAttempts = 0;
  srv._circuitErrors = [];
  srv._circuitOpenUntil = 0;
  srv._globalOpTimes = [];
  srv._lastDisconnectReason = null;
  srv.sock = null;
  events = [];
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function lastStatus(s) { for (let i = events.length - 1; i >= 0; i -= 1) if (events[i].status === s) return events[i]; return null; }
function lastEvent() { return events[events.length - 1] || {}; }

(async () => {
  console.log('==========================================================');
  console.log('Scenario A: fresh Connect (no session) emits + broadcasts QR');
  console.log('==========================================================');
  reset(false);
  const socketsA = madeSockets;
  await srv.generateQRCode();
  check('A: a socket was created', madeSockets - socketsA === 1, `made=${madeSockets - socketsA}`);
  check('A: status is CONNECTING after request', srv.status === 'CONNECTING', srv.status);
  check('A: marked as a pairing attempt', srv._pairingConnect === true);
  check('A: _needsManualRelink cleared by the request', srv._needsManualRelink === false);

  // Simulate Baileys emitting the FIRST QR.
  sockets[sockets.length - 1].ev.emit('connection.update', { qr: 'PROOF-QR-PAYLOAD-0001' });
  await wait(150);
  const qrEvt = lastStatus('QR_CODE');
  check('A: status becomes QR_CODE', srv.status === 'QR_CODE', srv.status);
  check('A: qrCodeDataUrl generated (data:image/png)', typeof srv.qrCodeDataUrl === 'string' && srv.qrCodeDataUrl.startsWith('data:image/png'), String(srv.qrCodeDataUrl).slice(0, 24));
  check('A: QR_CODE broadcast carried the QR payload', !!(qrEvt && typeof qrEvt.qr === 'string' && qrEvt.qr.startsWith('data:image/png')));

  console.log('\n==========================================================');
  console.log('Scenario B: Connect AFTER a 403 auth-stop (backup, not delete)');
  console.log('==========================================================');
  reset(true);
  check('B: precondition — session is valid before stop', srv._hasValidSession() === true);
  await srv._handleClose({ statusCode: 403, closeMessage: 'forbidden' });
  check('B: 403 sets _needsManualRelink', srv._needsManualRelink === true);
  const stopEvt = lastStatus('DISCONNECTED');
  check('B: broadcast flagged relinkRequired + needsManualRelink', !!(stopEvt && stopEvt.relinkRequired === true && stopEvt.needsManualRelink === true));
  check('B: broadcast carried the real reason', !!(stopEvt && typeof stopEvt.reason === 'string' && stopEvt.reason.length > 0), stopEvt && stopEvt.reason);
  check('B: session files still exist right after the stop (kept)', srv._hasValidSession() === true);

  const backupsDir = path.join(tmp, 'session_backups');
  const socketsB = madeSockets;
  await srv.generateQRCode();
  check('B: request cleared the manual-relink stop flag', srv._needsManualRelink === false);
  check('B: a fresh socket was created', madeSockets - socketsB === 1);
  check('B: old session folder was MOVED to a timestamped backup',
    fs.existsSync(backupsDir) && fs.readdirSync(backupsDir).some((n) => n.startsWith('default_')),
    fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).join(',') : '(no backups dir)');
  check('B: session dir was recreated empty', fs.existsSync(srv.sessionPath) && !fs.existsSync(path.join(srv.sessionPath, 'creds.json')));

  sockets[sockets.length - 1].ev.emit('connection.update', { qr: 'PROOF-QR-PAYLOAD-0002' });
  await wait(150);
  check('B: fresh QR emitted after the 403 stop', srv.status === 'QR_CODE', srv.status);
  check('B: fresh QR broadcast to the frontend', !!lastStatus('QR_CODE'));

  console.log('\n==========================================================');
  console.log('Scenario C: double-click Connect is single-flight (one socket)');
  console.log('==========================================================');
  reset(false);
  const socketsC = madeSockets;
  await Promise.all([srv.generateQRCode(), srv.generateQRCode()]);
  check('C: exactly ONE socket created for two rapid requests', madeSockets - socketsC === 1, `made=${madeSockets - socketsC}`);

  console.log('\n==========================================================');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  console.log('==========================================================');
  clearTimers();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e); clearTimers(); process.exit(2); });
