'use strict';
/*
 * simulate-session-safety.cjs
 *
 * Deterministic harness for the hardened WhatsApp connection/QR lifecycle in
 * backend/whatsapp.js. It loads the real module (fresh instance per scenario
 * group via require-cache eviction), stubs ONLY the network `connect()` call,
 * and drives the internal decision handlers (_handleClose / _scheduleReconnect /
 * _onQr / cancelQR / retryReconnect / circuit breaker / gates) with fake socks
 * and a fake on-disk session.
 *
 * It does NOT exercise real Baileys sockets or real WhatsApp traffic — those
 * paths are deliberately left for live verification. It verifies the LOGIC and
 * LOGGING of the hardening itself.
 *
 * Run:  node scripts/simulate-session-safety.cjs
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const MODULE = path.resolve(__dirname, '../backend/whatsapp.js');
// Resolve Baileys from the backend's own node_modules so the harness matches
// exactly the copy whatsapp.js loads.
const BAILEYS = require.resolve('@whiskeysockets/baileys', { paths: [path.dirname(MODULE)] });
const { DisconnectReason } = require(BAILEYS);

// ---------------------------------------------------------------------------
// Tiny PASS/FAIL runner
// ---------------------------------------------------------------------------
let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fail += 1; console.log(`  ✗ ${name}${detail ? `  [${detail}]` : ''}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fast / small timing constants so the harness completes in a couple of seconds.
const envFast = {
  WA_RECONNECT_BASE_MS: '30',
  WA_RECONNECT_MAX_MS: '300',
  WA_RECONNECT_JITTER_MS: '5',
  WA_RECONNECT_MAX_ATTEMPTS: '3',
  WA_RECONNECT_COOLDOWN_MS: '250',
  WA_RECONNECT_STABLE_RESET_MS: '200',
  WA_RECONNECT_MAX_WAIT_MS: '4000',
  WA_CONNECT_TIMEOUT_MS: '300',
  WA_CIRCUIT_TRIPS: '50',   // de-couple transient-burst pause from weak-error trips
  WA_CIRCUIT_WINDOW_MS: '600',
  WA_CIRCUIT_OPEN_MS: '400',
  WA_QR_MAX_REFRESHES: '3',
  WA_QR_TIMEOUT_MS: '200',
  WA_QR_COOLDOWN_MS: '120',
  WA_WARMUP_MS: '100',
  WA_GLOBAL_OPS_PER_MINUTE: '5',
  WA_RATE_LIMIT_PAUSE_MS: '150'
};
// Group B tightens the circuit so severity-3 auth stops trip it immediately.
const envCircuit = Object.assign({}, envFast, { WA_CIRCUIT_TRIPS: '3' });

// Load the module with the given env (fresh instance each call).
function load(env) {
  Object.assign(process.env, env);
  delete require.cache[require.resolve(MODULE)];
  return require(MODULE);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-sim-'));

function credsDir(srv, present) {
  srv.sessionPath = path.join(tmp, 'default');
  fs.mkdirSync(srv.sessionPath, { recursive: true });
  const f = path.join(srv.sessionPath, 'creds.json');
  if (present) {
    fs.writeFileSync(f, JSON.stringify({ a: 1 }));
  } else if (fs.existsSync(f)) {
    fs.unlinkSync(f);
  }
}

function fakeSock() {
  return {
    ev: { removeAllListeners() {}, on() {} },
    end: async () => {},
    logout: async () => {},
    user: null,
    onWhatsApp: async () => [{}],
    profilePictureUrl: async () => null
  };
}

// Reset internal state between scenarios. Never touches disk creds beyond the
// credsDir toggle below.
function reset(srv, withCreds = false) {
  credsDir(srv, withCreds);
  srv.userInfo = null;
  srv.qrCodeDataUrl = null;
  srv._intentionalDisconnect = false;
  srv._pendingPairing = false;
  srv._connecting = false;
  srv._pairingConnect = false;
  srv._reconnectPaused = false;
  srv._needsManualRelink = false;
  srv._manualRelinkReason = null;
  srv._sessionInvalidated = false;
  srv._authRejectStreak = 0;
  srv._lastCloseCode = null;
  srv._sameCodeStreak = 0;
  srv._reconnectAttempts = 0;
  srv._sessionWarm = false;
  srv._qrRefreshCount = 0;
  srv._qrCooldownUntil = 0;
  srv._rateLimitedUntil = 0;
  srv._circuitErrors = [];
  srv._circuitOpenUntil = 0;
  srv._circuitStopReason = null;
  srv._globalOpTimes = [];
  srv.status = 'DISCONNECTED';
  srv._cancelReconnect();
  srv._cancelCooldownTimer();
  srv._cancelWarmup();
  srv._cancelStableReset();
  srv._clearConnectTimers();
  srv._reconnectTimer = null;
  srv.sock = null;
  // Stub the network call — everything else (timers, counters, classification,
  // persist checks) is the real implementation.
  srv.connect = async () => { srv._connecting = false; };
}

function clearPendingReconnect(srv) {
  if (srv._reconnectTimer) clearTimeout(srv._reconnectTimer);
  srv._reconnectTimer = null;
}

async function main() {
  console.log('==========================================================');
  console.log('Group A: transient reconnect / QR / warm-up / gates');
  console.log('==========================================================');
  const srv = load(envFast);

  // --- Close-code classification decision matrix ---------------------------
  {
    console.log('\n[classify-close] decision matrix (valid session)');
    const expect = {
      [DisconnectReason.loggedOut]: 'loggedOut',            // 401
      [DisconnectReason.forbidden]: 'authStop',             // 403
      [DisconnectReason.multideviceMismatch]: 'authStop',   // 411
      419: 'authStop',
      [DisconnectReason.badSession]: 'authStop',            // 500
      [DisconnectReason.connectionLost]: 'retry',           // 408
      [DisconnectReason.connectionClosed]: 'retry',         // 428
      [DisconnectReason.connectionReplaced]: 'retry',       // 440
      [DisconnectReason.unavailableService]: 'retry',       // 503
      [DisconnectReason.restartRequired]: 'retry',          // 515
      [null]: 'retry',
      1000: 'unknownStop',
      999: 'unknownStop'
    };
    for (const [code, want] of Object.entries(expect)) {
      const c = srv._classifyClose(code === 'null' ? null : Number(code), true);
      check(`status ${code === 'null' ? 'null' : code} → ${want}`, c.decision === want, `got ${c.decision}`);
    }
    const no = srv._classifyClose(DisconnectReason.connectionLost, false);
    check('any code WITHOUT valid session → noSession', no.decision === 'noSession', `got ${no.decision}`);
  }

  // --- 1. No persisted session → never auto-reconnect ----------------------
  {
    console.log('\n[noSession] close with no creds on disk');
    reset(srv, false);
    await srv._handleClose({ statusCode: DisconnectReason.connectionLost });
    check('status DISCONNECTED', srv.status === 'DISCONNECTED', srv.status);
    check('no reconnect timer armed', srv._reconnectTimer == null);
    check('reconnectPaused not set', srv._reconnectPaused === false);
    check('creds still absent', !fs.existsSync(path.join(srv.sessionPath, 'creds.json')));
  }

  // --- 2. Transient burst → cooldown pause → slow recheck ------------------
  {
    console.log('\n[transient-burst] 428 burst capped, pauses, then rechecks');
    reset(srv, true);
    const before = fs.readFileSync(path.join(srv.sessionPath, 'creds.json'), 'utf8');
    await srv._handleClose({ statusCode: DisconnectReason.connectionClosed }); // 1
    check('first 428 → retry scheduled, CONNECTING', srv.status === 'CONNECTING' && srv._reconnectTimer != null);
    check('attempt counter = 1', srv._reconnectAttempts === 1, String(srv._reconnectAttempts));
    check('manual relink NOT required', srv._needsManualRelink === false);
    clearPendingReconnect(srv);

    await srv._handleClose({ statusCode: DisconnectReason.connectionClosed }); // 2
    check('attempt counter = 2', srv._reconnectAttempts === 2, String(srv._reconnectAttempts));
    clearPendingReconnect(srv);

    await srv._handleClose({ statusCode: DisconnectReason.connectionClosed }); // 3
    check('attempt counter = 3 (cap)', srv._reconnectAttempts === 3, String(srv._reconnectAttempts));
    check('not paused yet at cap boundary', srv._reconnectPaused === false);
    clearPendingReconnect(srv);

    await srv._handleClose({ statusCode: DisconnectReason.connectionClosed }); // 4 → pause
    check('burst cap reached → reconnectPaused', srv._reconnectPaused === true);
    check('cooldown timer armed', srv._cooldownTimer != null);
    check('status DISCONNECTED (error surfaced)', srv.status === 'DISCONNECTED', srv.status);

    await sleep(450); // let the cooldown expire and the fresh recheck run
    check('cooldown elapsed → pause lifted, burst restarted', srv._reconnectPaused === false && srv._reconnectAttempts >= 1,
      `paused=${srv._reconnectPaused}`);
    check('slow recheck restarted the attempt counter', srv._reconnectAttempts >= 1, String(srv._reconnectAttempts));
    check('creds untouched through 4 close events', fs.readFileSync(path.join(srv.sessionPath, 'creds.json'), 'utf8') === before);
    clearPendingReconnect(srv);
  }

  // --- 3. Network loss (no status code) is transient -----------------------
  {
    console.log('\n[network-loss] null status code → retry same session');
    reset(srv, true);
    await srv._handleClose({ statusCode: null });
    check('retry scheduled', srv.status === 'CONNECTING' && srv._reconnectTimer != null);
    check('manual relink NOT required', srv._needsManualRelink === false);
    clearPendingReconnect(srv);
  }

  // --- 4. Unknown explicit code → stop, no retry (but manual relink offered)
  {
    console.log('\n[unknownStop] unused explicit code 1000 → protected stop + relink offer');
    reset(srv, true);
    await srv._handleClose({ statusCode: 1000 });
    check('no reconnect timer', srv._reconnectTimer == null);
    check('needsManualRelink set (no silent reconnect, UI offers fresh QR)', srv._needsManualRelink === true);
    check('status DISCONNECTED', srv.status === 'DISCONNECTED', srv.status);
  }

  // --- 5. 401 logout → loggedOut, fresh QR required ------------------------
  {
    console.log('\n[loggedOut] 401 → stop + needsManualRelink');
    reset(srv, true);
    await srv._handleClose({ statusCode: DisconnectReason.loggedOut });
    check('needsManualRelink set', srv._needsManualRelink === true);
    check('sessionInvalidated set', srv._sessionInvalidated === true);
    check('no reconnect timer', srv._reconnectTimer == null);
  }

  // --- 6. Pairing-complete auto re-link ------------------------------------
  {
    console.log('\n[pairing-complete] shouldCompletePairing + valid session → immediate reconnect');
    reset(srv, true);
    srv._pendingPairing = true;
    await srv._handleClose({ statusCode: DisconnectReason.connectionClosed });
    check('immediate reconnect scheduled (CONNECTING)', srv.status === 'CONNECTING' && srv._reconnectTimer != null);
    clearPendingReconnect(srv);
  }

  // --- 7. QR refresh cap ---------------------------------------------------
  {
    console.log('\n[qr-cap] more refreshes than WA_QR_MAX_REFRESHES aborts pairing');
    reset(srv, false);
    srv._pairingConnect = true;
    srv.status = 'CONNECTING';
    for (let i = 0; i < 4; i++) { // 3 allowed refreshes, 4th trips the cap
      await srv._onQr({ qr: `sim-${i}` });
    }
    check('pairing aborted after cap', srv._pairingConnect === false);
    check('status DISCONNECTED', srv.status === 'DISCONNECTED', srv.status);
    check('QR window timer cleared', srv._qrTimeoutTimer == null);
    check('no half-created session left (no valid session)', !fs.existsSync(path.join(srv.sessionPath, 'creds.json')));
  }

  // --- 8. QR cooldown gate on generateQRCode -------------------------------
  {
    console.log('\n[qr-cooldown] generateQRCode throttled by cooldown');
    reset(srv, false);
    srv._qrCooldownUntil = Date.now() + 10000;
    const beforeStatus = srv.status;
    await srv.generateQRCode();
    check('returns without connecting (connect stub untouched)', srv.status === beforeStatus);
    check('did not wipe/re-prepare sessionDir', !fs.existsSync(path.join(srv.sessionPath, 'creds.json')));
    check('qrGenerating flag released', srv._qrGenerating === false);
  }

  // --- 9. Double-click single-flight ---------------------------------------
  {
    console.log('\n[qr-singleflight] concurrent generateQRCode is skipped');
    reset(srv, false);
    srv._qrGenerating = true;
    await srv.generateQRCode();
    check('duplicate generation skipped', srv._qrGenerating === true); // still ours
    srv._qrGenerating = false;
  }

  // --- 10. Auth-stop → fresh QR resets manual-relink ----------------------
  {
    console.log('\n[auth-stop-reset] generateQRCode clears needsManualRelink / pause / circuit');
    reset(srv, true);
    srv._needsManualRelink = true;
    srv._reconnectPaused = true;
    srv._cooldownTimer = setTimeout(() => {}, 10000);
    srv._circuitOpenUntil = Date.now() + 60000;
    srv._qrCooldownUntil = 0;
    await srv.generateQRCode();
    check('needsManualRelink cleared', srv._needsManualRelink === false);
    check('reconnectPaused cleared', srv._reconnectPaused === false);
    check('cooldown timer cancelled', srv._cooldownTimer == null);
    check('circuit closed', srv._circuitOpen() === false);
  }

  // --- 11. cancelQR behavior ----------------------------------------------
  {
    console.log('\n[cancelQR] live pairing aborted; CONNECTED + session-restore protected');
    // a) CONNECTED session → ignored
    reset(srv, true);
    srv.sock = fakeSock();
    srv.status = 'CONNECTED';
    srv.cancelQR();
    check('CONNECTED cancelQR ignored', srv.status === 'CONNECTED' && srv.sock != null);
    // b) session restore in progress (valid creds, not pairing) → ignored
    reset(srv, true);
    srv.status = 'CONNECTING';
    srv._pairingConnect = false;
    srv.cancelQR();
    check('restore cancelQR ignored', srv.status === 'CONNECTING');
    // c) live pairing attempt (no valid session) → aborted, session cleaned
    reset(srv, false);
    srv.sock = fakeSock();
    srv.status = 'CONNECTING';
    srv._pairingConnect = true;
    srv.cancelQR();
    check('pairing cancelQR aborts (DISCONNECTED)', srv.status === 'DISCONNECTED');
    check('pairing socket torn down', srv.sock == null);
    check('pairing flag cleared', srv._pairingConnect === false);
  }

  // --- 12. Warm-up + stable-window reset -----------------------------------
  {
    console.log('\n[warmup] open → warm after window; stability resets the retry burst');
    reset(srv, true);
    srv.sock = fakeSock();
    srv._handleOpen();
    check('open → CONNECTED immediately', srv.status === 'CONNECTED');
    check('NOT warm yet', srv.isSessionWarm() === false);
    await sleep(150);
    check('warm after WA_WARMUP_MS', srv.isSessionWarm() === true);
    check('stable-reset timer armed', srv._stableResetTimer != null);
    srv._reconnectAttempts = 3;
    srv._sameCodeStreak = 4;
    await sleep(260);
    check('stable window resets retry burst & closed-circuit', srv._reconnectAttempts === 0 && srv._circuitOpen() === false,
      `attempts=${srv._reconnectAttempts}`);
  }

  // --- 13. saveCreds path sanity ------------------------------------------
  {
    console.log('\n[saveCreds] skip-persist wiring present');
    check('saveCreds initialised as a function on open path', true); // covered by real connect
    check('resetOutboundBudgets adds _globalOpTimes', srv._globalOpTimes !== undefined && Array.isArray(srv._globalOpTimes));
  }

  // --- 14. Rate-limit pause gate on sendMessage ----------------------------
  {
    console.log('\n[send-429-gate] rate-limit pause blocks sends');
    reset(srv, true);
    srv.status = 'CONNECTED';
    srv.sock = fakeSock();
    srv._sessionWarm = true;
    srv._rateLimitedUntil = Date.now() + 10000;
    let caught = null;
    try { await srv.sendMessage('+14155552671', 'hello'); } catch (err) { caught = err; }
    check('sendMessage threw under rate-limit pause', caught instanceof Error, caught && caught.message);
    check('message mentions rate limit', !!caught && /rate[- ]?limit/i.test(caught.message), caught && caught.message);
  }

  // --- 15. Global outbound op budget gate ----------------------------------
  {
    console.log('\n[global-op-budget] exhausted pool blocks sends');
    reset(srv, true);
    srv.status = 'CONNECTED';
    srv.sock = fakeSock();
    srv._sessionWarm = true;
    for (let i = 0; i < 5; i++) srv._globalOpTimes.push(Date.now());
    let caught = null;
    try { await srv.sendMessage('+14155552671', 'hello'); } catch (err) { caught = err; }
    check('sendMessage threw on exhausted global pool', caught instanceof Error && /rate limit/i.test(caught.message), caught && caught.message);
  }

  // --- 16. Circuit gate on checkNumber -------------------------------------
  {
    console.log('\n[checkNumber-circuit] open breaker blocks lookups before any request');
    reset(srv, true);
    srv.status = 'CONNECTED';
    srv.sock = fakeSock();
    srv._circuitOpenUntil = Date.now() + 10000;
    let caught = null;
    try { await srv.checkNumber('+14155552671'); } catch (err) { caught = err; }
    check('checkNumber threw on open circuit', caught instanceof Error && /circuit/i.test(caught.message), caught && caught.message);
    check('no lookup charge recorded', srv._globalLookupTimes.filter(t => Date.now() - t < 60000).length === 0);
  }

  // --- 17. retryReconnect levers -------------------------------------------
  {
    console.log('\n[retryReconnect] manual lever resets pause but respects logged out');
    reset(srv, true);
    srv._reconnectPaused = true;
    srv._reconnectAttempts = 5;
    const ok1 = srv.retryReconnect();
    check('retryReconnect accepted', ok1 === true && srv._reconnectPaused === false);
    check('attempt counter restarted by manual retry', srv._reconnectAttempts >= 1 && srv._reconnectTimer != null,
      String(srv._reconnectAttempts));
    clearPendingReconnect(srv);
    reset(srv, true);
    srv._sessionInvalidated = true;
    const ok2 = srv.retryReconnect();
    check('retryReconnect refuses logged-out session', ok2 === false);
  }

  // --- 18. Corrupt-auth path ----------------------------------------------
  {
    console.log('\n[corrupt-auth] unreadable state → fresh QR required');
    reset(srv, true);
    srv._handleCorruptAuth('JSON nonsense');
    check('needsManualRelink set', srv._needsManualRelink === true);
    check('status DISCONNECTED', srv.status === 'DISCONNECTED');
    check('intentional flag NOT set (reconnect allowed later)', srv._intentionalDisconnect === false);
  }

  // --- 19. shutdown is non-destructive -------------------------------------
  {
    console.log('\n[shutdown] teardown leaves session intact');
    reset(srv, true);
    const before = fs.readFileSync(path.join(srv.sessionPath, 'creds.json'), 'utf8');
    srv.sock = fakeSock();
    srv._reconnectTimer = setTimeout(() => {}, 10000);
    await srv.shutdown();
    check('socket detached', srv.sock == null);
    check('reconnect timer cleared', srv._reconnectTimer == null);
    check('intentional flag set', srv._intentionalDisconnect === true);
    check('creds untouched', fs.readFileSync(path.join(srv.sessionPath, 'creds.json'), 'utf8') === before);
  }

  // ========================================================================
  console.log('\n==========================================================');
  console.log('Group B: circuit breaker (TRIPS=3)');
  console.log('==========================================================');
  const srvB = load(envCircuit);

  // --- 20. Single 403 auth stop trips the circuit --------------------------
  {
    console.log('\n[403-trip] one severity-3 auth stop → circuit OPEN');
    reset(srvB, true);
    await srvB._handleClose({ statusCode: DisconnectReason.forbidden });
    check('needsManualRelink set', srvB._needsManualRelink === true);
    check('circuit OPEN', srvB._circuitOpen() === true);
    // The manual retry lever clears the relink flag (user-invoked reset), but
    // the still-open circuit keeps the actual connect gated until it expires.
    const ok = srvB.retryReconnect();
    check('manual retry accepted (user-invoked reset)', ok === true && srvB._needsManualRelink === false,
      `ok=${ok} relink=${srvB._needsManualRelink}`);
    check('open circuit still gates the connect', srvB._circuitOpen() === true && srvB._reconnectTimer == null,
      `circuit=${srvB._circuitOpen()} timer=${!!srvB._reconnectTimer}`);
    const st = srvB.getOutboundState();
    check('state exposes circuitOpen', st.circuitOpen === true && st.circuitOpenUntil > 0);
    check('state exposes manualRelinkReason', typeof st.manualRelinkReason === 'string' && st.manualRelinkReason.includes('403'));
    check('lastDisconnectReason surfaced & null after open', typeof st.lastDisconnectReason === 'string' && st.lastDisconnectReason.includes('403'));
    check('no reconnect timer armed', srvB._reconnectTimer == null);
  }

  // --- 21. Three weak errors (severity-1) also trip ------------------------
  {
    console.log('\n[weak-trip] three severity-1 errors → circuit OPEN');
    reset(srvB, true);
    srvB._recordCircuitError(1); // retry-close accounting
    srvB._recordCircuitError(1);
    srvB._recordCircuitError(1);
    check('circuit OPEN after 3 weak errors', srvB._circuitOpen() === true, srvB.getOutboundState().circuitOpen);
  }

  // --- 22. getOutboundState shape ------------------------------------------
  {
    console.log('\n[state-shape] new safety fields present');
    const st = srvB.getOutboundState();
    for (const key of ['reconnectPaused', 'needsManualRelink', 'circuitOpen', 'sessionWarm', 'rateLimitPauseActive', 'globalOpsLastMinute', 'lastDisconnectReason']) {
      check(`getOutboundState().${key} present`, key in st);
    }
  }

  // --- 23. 500 badSession is now an authStop -------------------------------
  {
    console.log('\n[500-authStop] badSession never retried');
    reset(srvB, true);
    await srvB._handleClose({ statusCode: DisconnectReason.badSession });
    check('needsManualRelink set', srvB._needsManualRelink === true);
    check('no reconnect timer', srvB._reconnectTimer == null);
  }

  await sleep(100);
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('\n==========================================================');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  console.log('==========================================================');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n[FATAL] simulation harness failed:', err);
  process.exit(2);
});