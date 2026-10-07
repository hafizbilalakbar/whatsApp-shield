import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { showToast } from '../components/ui/ToastNotification';
import { derivePreviewLeads } from '../components/dashboard/mockup/mockupSelectors';

const MOCKUP_CLEARED_STORAGE_KEY = 'whatsapp-shield-mockup-cleared-at';

const WebSocketContext = createContext(null);

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll'];
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const PING_INTERVAL_MS = 30000;
// Generous on purpose: the backend is busy during a scan (WhatsApp lookups,
// shield cooldowns, atomic report/journal writes) and a late pong is normal,
// not an outage. Only a genuinely dead channel misses this window.
const PONG_TIMEOUT_MS = 20000;

export const WebSocketProvider = ({ children }) => {
  // Connection State
  const [status, setStatus] = useState('DISCONNECTED');
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [sessionUser, setSessionUser] = useState(null);

  // App State
  const [systemLogs, setSystemLogs] = useState([]);
  const [isChecking, setIsChecking] = useState(false);

  // Bulk Checking Stats
  const [totalToCheck, setTotalToCheck] = useState(0);
  const [currentCheckingNum, setCurrentCheckingNum] = useState('');
  const [resultsList, setResultsList] = useState([]);
  // The campaign record the backend PERSISTED for the scan that just finished.
  // Reports renders this instead of `resultsList`: the report must reflect what
  // was saved, so it is correct even if the live stream was partial, out of date,
  // or already cleared by the time the user opens the step.
  const [finalizedCampaign, setFinalizedCampaign] = useState(null);
  // Numbers the backend refused at the pre-scan gate (wrong length / wrong
  // country / not a phone number). They are never looked up, but they ARE part
  // of the user's requested total, so they are surfaced separately from genuine
  // lookups to keep "N invalid, skipped" visible instead of silently vanishing.
  const [invalidInputCount, setInvalidInputCount] = useState(0);
  // Total the user actually asked us to validate (valid + invalid). Invalid
  // entries count toward the progress denominator so the bar can reach 100%.
  const [requestedTotal, setRequestedTotal] = useState(0);

  // Processed count and progress are DERIVED from resultsList — the single
  // authoritative source of truth for completed validations. This keeps the
  // "Processed" counter, the progress bar, the summary stats, and the live log
  // perfectly synchronized: they can never disagree with the visible results.
  const checkedCount = resultsList.length;
  const progressPercent = totalToCheck > 0
    ? Math.min(100, Math.round((resultsList.length / totalToCheck) * 100))
    : 0;

  // Authoritative scan lifecycle, mirrored 1:1 from the backend job.
  // IDLE | STARTING | SCANNING | PAUSED | RESUMING | COMPLETED | STOPPED
  const [scanState, setScanState] = useState('IDLE');
  const [activeJobId, setActiveJobId] = useState(null);
  // Whether the backend currently reports an active scan. Populated by the
  // authoritative /api/scan-status reconciliation. Guards the Step4 auto-start
  // effect so navigating back to the Live Scan (or a fresh page load mid-scan)
  // can NEVER fire a duplicate scan — it must first confirm the backend has no
  // active job before launching a new one.
  const [serverScanActive, setServerScanActive] = useState(false);
  const serverScanActiveRef = useRef(false);
  // True once the authoritative /api/scan-status reconciliation has settled at
  // least once for this provider lifetime. The auto-start gate waits on this so
  // it never fires a scan inside the initial reconcile window (which would
  // duplicate an already-running server scan).
  const [reconcileResolved, setReconcileResolved] = useState(false);

  // Cool-down State
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  // True when the backend reports the scan is paused due to a connectivity /
  // WhatsApp-gateway outage (auto-pause), as opposed to a user-initiated pause.
  const [connectivityPaused, setConnectivityPaused] = useState(false);

  // Campaign History
  const [campaignHistory, setCampaignHistory] = useState([]);

  // Loading states
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- Feature States ---
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [connectionStable, setConnectionStable] = useState(true);
  // True while the socket is down and a reconnect is pending. The scan UI shows
  // a small "Reconnecting..." badge instead of clearing anything, so a brief
  // disconnect never looks like a lost scan.
  const [reconnecting, setReconnecting] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [lastActiveTime, setLastActiveTime] = useState(Date.now());

  // WebSocket Reference
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const activityTimerRef = useRef(null);
  const sessionUserRef = useRef(sessionUser);
  const scanStateRef = useRef('IDLE');
  const activeJobIdRef = useRef(null);
  // Authoritative results index: a map of unique phone number -> last result for
  // the active job. Built from every completed BULK_CHECK_PROGRESS AND from the
  // authoritative REST reconciliation snapshot. Guards idempotency: a duplicate /
  // re-delivered event or a background reconciliation can never double-count a
  // number, because results are keyed by stable normalized phone number.
  const resultsByNumberRef = useRef(new Map());
  // Guards against overlapping background reconciliation fetches so a refresh +
  // visibility-change + reconnect storm never issues duplicate /api/scan-status
  // calls at the same instant.
  const reconcileInFlightRef = useRef(false);
  // Last job id that a reconciliation snapshot was applied for, so reconnects
  // that return identical state do not reset `lastProcessedIndexRef` or mutate
  // the results list unnecessarily (avoids churn/log spam).
  const lastReconciledJobRef = useRef(null);
  // jobId of the scan whose completion UI flow has already run. Completion can
  // be signalled by the one-shot WS terminal event, by the local
  // processed>=total safety net, and by a /api/scan-status reconciliation after
  // a reconnect — all three can fire for the same scan. This ref makes the whole
  // flow idempotent so a report is generated, and the Reports step opened, at
  // most once per scan.
  const finalizedScanRef = useRef(null);
  // Index of the most recently completed number within the active job. Guards
  // against duplicate / out-of-order BULK_CHECK_PROGRESS events so a stale or
  // re-delivered result can never be appended twice or rewrite a later result.
  const lastProcessedIndexRef = useRef(-1);
  // Set once the WebSocket has delivered a STATUS_UPDATE. Guards the initial
  // /api/status fetch so a stale (pre-QR) HTTP response can never overwrite a
  // newer QR/connection state pushed over the socket.
  const receivedWsStatusRef = useRef(false);
  // Messages sent while the socket is connecting/closed (e.g. "generate_qr"
  // right after a backend restart) are queued and delivered on the next open.
  const pendingMessagesRef = useRef([]);
  // WebSocket auto-reconnect: the socket re-establishes itself after a
  // transient drop (backend restart, network blip) with exponential backoff so
  // the user is never forced to re-link WhatsApp over a transport hiccup. A
  // genuine WhatsApp logout is still reported by the server as STATUS_UPDATE
  // DISCONNECTED after the reconnect and clears the session as before.
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  // A dropped socket is reported ONCE (the reconnect attempts are visible as a
  // single status line) instead of appending an identical log entry on every
  // backoff retry, which used to flood the activity log forever.
  const backendOfflineLoggedRef = useRef(false);
  // True only between a deliberate self-heal close() and the next successful
  // open, so that close is not reported as a backend outage.
  const selfHealingRef = useRef(false);
  // Set while an explicit logout is in progress / has completed. Blocks every
  // *automatic* reconnect path (scheduled timer, onclose, browser 'online') so
  // a session the user logged out of is never silently re-established. Cleared
  // the moment the user explicitly re-initiates a connection from the UI.
  const logoutRef = useRef(false);
  // Dedup for campaign history refreshes: track which session we already loaded
  // history for and the last time we asked, so reconnect storms cannot spam the
  // backend with repeated get_history requests.
  const historyRequestedForRef = useRef(null);
  const lastHistoryRequestAtRef = useRef(0);
  // Live cool-down countdown timer (kept in a ref so it can be torn down from
  // any lifecycle edge: pause, resume, stop, complete, socket drop, logout).
  const cooldownCountdownRef = useRef(null);
  // Global Mockup Preview Auto-Clear & Manual Clear State
  // Runs in the global provider so auto-clear executes reliably across page changes and closed panels
  const [mockupClearedAt, setMockupClearedAt] = useState(() => {
    try {
      const raw = localStorage.getItem(MOCKUP_CLEARED_STORAGE_KEY);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch (_) {
      return null;
    }
  });
  const globalAutoClearTimerRef = useRef(null);
  // Ref-counted suspension of the auto-clear while the phone preview is busy
  // (video countdown / render), plus a record of a clear that became due while
  // suspended so it can run as soon as the preview is free again.
  const mockupAutoClearHoldRef = useRef(0);
  const mockupAutoClearPendingRef = useRef(false);

  // The single live leads list that the preview holds. Both the mockup panel and
  // the floating pill badge read from this — never from private copies — so they
  // can never disagree, and a clear is reflected everywhere at once.
  const previewLeads = useMemo(
    () => derivePreviewLeads(resultsList, mockupClearedAt),
    [resultsList, mockupClearedAt]
  );
  const previewLeadCount = previewLeads.length;

  const clearMockupLeads = useCallback(() => {
    if (globalAutoClearTimerRef.current) {
      clearTimeout(globalAutoClearTimerRef.current);
      globalAutoClearTimerRef.current = null;
    }
    const ts = Date.now();
    setMockupClearedAt(ts);
    try {
      localStorage.setItem(MOCKUP_CLEARED_STORAGE_KEY, String(ts));
    } catch (_) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mockup-leads-cleared', { detail: { clearedAt: ts } }));
    }
  }, []);

  const resetMockupClear = useCallback(() => {
    if (globalAutoClearTimerRef.current) {
      clearTimeout(globalAutoClearTimerRef.current);
      globalAutoClearTimerRef.current = null;
    }
    mockupAutoClearPendingRef.current = false;
    setMockupClearedAt(null);
    try {
      localStorage.removeItem(MOCKUP_CLEARED_STORAGE_KEY);
    } catch (_) {}
  }, []);

  const scheduleMockupAutoClear = useCallback(() => {
    if (globalAutoClearTimerRef.current) {
      clearTimeout(globalAutoClearTimerRef.current);
      globalAutoClearTimerRef.current = null;
    }
    // A video export is in flight (countdown running, or frames being rendered).
    // Clearing the phone now would abort the render, so remember that a clear is
    // owed and arm the timer when the export ends instead.
    if (mockupAutoClearHoldRef.current > 0) {
      mockupAutoClearPendingRef.current = true;
      return;
    }
    let delay = 6000;
    try {
      const raw = localStorage.getItem('whatsapp-shield-mockup-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.autoClearDelay === 'number') delay = parsed.autoClearDelay;
      }
    } catch (_) {}

    if (delay > 0) {
      globalAutoClearTimerRef.current = setTimeout(() => {
        globalAutoClearTimerRef.current = null;
        const ts = Date.now();
        setMockupClearedAt(ts);
        try {
          localStorage.setItem(MOCKUP_CLEARED_STORAGE_KEY, String(ts));
        } catch (_) {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mockup-leads-cleared', { detail: { clearedAt: ts } }));
        }
      }, delay);
    }
  }, []);

  /**
   * Suspend the auto-clear while something is using the preview (a video export
   * countdown, or the render itself). Nested holds are reference-counted so two
   * independent callers can each hold and release safely.
   *
   * Without this, a 3s auto-clear fired at the exact moment the 3s video countdown
   * reached zero: the render was aborted almost immediately and the user got a
   * cleared phone instead of a video.
   */
  const holdMockupAutoClear = useCallback(() => {
    mockupAutoClearHoldRef.current += 1;
    if (globalAutoClearTimerRef.current) {
      clearTimeout(globalAutoClearTimerRef.current);
      globalAutoClearTimerRef.current = null;
    }
  }, []);

  const releaseMockupAutoClear = useCallback(() => {
    mockupAutoClearHoldRef.current = Math.max(0, mockupAutoClearHoldRef.current - 1);
    if (mockupAutoClearHoldRef.current > 0) return;
    // The scan already finished while we were held, so honour the deferred clear.
    if (mockupAutoClearPendingRef.current) {
      mockupAutoClearPendingRef.current = false;
      scheduleMockupAutoClear();
    }
  }, [scheduleMockupAutoClear]);

  // Request/response correlation: maps a requestId -> resolver for messages that
  // need the backend's result (e.g. delete_campaign). Lets callers await the
  // backend instead of optimistically assuming success.
  const requestHandlersRef = useRef(new Map());
  // Safety net so the transient RESUMING state can never linger: if the backend
  // ack (BULK_CHECK_RESUMED) or the next processing/progress event does not
  // arrive (e.g. the socket stalled mid-resume), fall back to SCANNING so the UI
  // reflects that the worker is live rather than appearing frozen on "Resuming".
  const resumeFallbackRef = useRef(null);
  const scheduleResumeFallback = useCallback(() => {
    if (resumeFallbackRef.current) clearTimeout(resumeFallbackRef.current);
    resumeFallbackRef.current = setTimeout(() => {
      resumeFallbackRef.current = null;
      setScanState(prev => (prev === 'RESUMING' ? 'SCANNING' : prev));
    }, 4000);
  }, []);
  const clearResumeFallback = useCallback(() => {
    if (resumeFallbackRef.current) {
      clearTimeout(resumeFallbackRef.current);
      resumeFallbackRef.current = null;
    }
  }, []);

  const addLog = (text, type = 'info') => {
    setSystemLogs(prev => {
      const seq = prev.length > 0 ? prev[prev.length - 1].seq + 1 : 1;
      const newLogs = [...prev, { seq, time: new Date().toLocaleTimeString(), text, type }];
      if (newLogs.length > 200) return newLogs.slice(-200);
      return newLogs;
    });
  };

  // Keeps sessionUserRef in sync with state to avoid stale closures
  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);

  useEffect(() => {
    scanStateRef.current = scanState;
  }, [scanState]);

  useEffect(() => {
    activeJobIdRef.current = activeJobId;
  }, [activeJobId]);

  // Delivers any messages queued while the socket was not open. Runs once the
  // WebSocket reconnects so nothing sent in the meantime is lost.
  const flushPendingMessagesRef = useRef(() => {});
  flushPendingMessagesRef.current = () => {
    if (pendingMessagesRef.current.length === 0) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const batch = pendingMessagesRef.current;
    pendingMessagesRef.current = [];
    batch.forEach(msg => ws.send(JSON.stringify(msg)));
  };

  // End any in-flight cool-down countdown and reset its UI state. Idempotent,
  // safe to call from every scan lifecycle edge (start, progress, pause, stop,
  // complete, interrupt, socket drop, logout, unmount).
  const endCooldown = useCallback(() => {
    setCooldownActive(false);
    setCooldownTimeLeft(0);
    setConnectivityPaused(false);
    if (cooldownCountdownRef.current) {
      clearInterval(cooldownCountdownRef.current);
      cooldownCountdownRef.current = null;
    }
  }, []);

  // Start a live cooldown countdown from an ABSOLUTE deadline (Date.now() ms) —
  // the same authoritative deadline every tab derives from the backend. Because
  // the deadline is absolute (not relative seconds measured from receipt time),
  // a tab that reconnects / reconciles mid-cooldown ends up on the SAME
  // remaining time as every other tab instead of restarting the pause.
  const startCooldownFromDeadline = useCallback((until, message) => {
    const totalMs = Math.max(0, (Number(until) || 0) - Date.now());
    setCooldownActive(true);
    if (cooldownCountdownRef.current) {
      clearInterval(cooldownCountdownRef.current);
      cooldownCountdownRef.current = null;
    }
    if (totalMs <= 0) {
      endCooldown();
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil(totalMs / 1000));
      setCooldownTimeLeft(left);
      if (left <= 0) {
        if (cooldownCountdownRef.current) clearInterval(cooldownCountdownRef.current);
        cooldownCountdownRef.current = null;
        setCooldownActive(false);
      }
    };
    tick();
    cooldownCountdownRef.current = setInterval(tick, 500);
  }, [endCooldown]);

  // Exponential backoff reconnect: 1s, 2s, 4s, 8s, ... capped at 30s, with
  // ±20% jitter so multiple tabs/agents reconnecting at once don't stampede the
  // backend into synchronized handshakes. The attempt counter resets on a
  // successful open, so repeated transient drops restart from 1s instead of
  // hanging forever at the cap. A logged-out session never auto-reconnects.
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    if (logoutRef.current) return;
    const attempt = reconnectAttemptsRef.current;
    const base = Math.min(30000, 1000 * Math.pow(2, attempt));
    const jitter = Math.round((Math.random() * 2 - 1) * base * 0.2);
    const delay = Math.max(1000, base + jitter);
    reconnectAttemptsRef.current += 1;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (logoutRef.current) return;
      connectRef.current();
    }, delay);
  }, []);

  const sendMessage = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return;
    }
    // Socket is connecting or dropped (e.g. after a backend restart). A message
    // sent here from the UI is an explicit user action (Generate QR, start
    // scan, ...), so it also re-arms automatic reconnection for a fresh session.
    logoutRef.current = false;
    if (connectRef.current) connectRef.current();
    // Keep the retry queue bounded so a reconnect storm cannot grow memory
    // without limit. Oldest messages are dropped first; the current action
    // (which is what the user just asked for) is always kept.
    if (pendingMessagesRef.current.length >= 24) {
      pendingMessagesRef.current.shift();
    }
    pendingMessagesRef.current.push(msg);
    flushPendingMessagesRef.current?.();
  }, []);

  // Sends a message and resolves with the backend's matching response. The
  // caller's `responseType` must match the server's reply type (the server
  // echoes `requestId` on result messages). Rejects on timeout or if the socket
  // never delivers a response — the UI must wait for the backend result rather
  // than assuming the operation succeeded.
  const sendMessageWithResult = useCallback((payload, responseType, timeoutMs = 12000) => {
    return new Promise((resolve, reject) => {
      if (!payload || typeof payload !== 'object') {
        reject(new Error('Invalid message payload'));
        return;
      }
      const requestId = payload.requestId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const msg = { ...payload, requestId };
      const handleResponse = (data) => {
        if (timer) clearTimeout(timer);
        resolve(data);
      };
      const timer = setTimeout(() => {
        requestHandlersRef.current.delete(requestId);
        reject(new Error('No response from backend. Please try again.'));
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      requestHandlersRef.current.set(requestId, { resolve: handleResponse, timer });
      sendMessage(msg);
    });
  }, [sendMessage]);

  // Delete a single campaign and wait for the backend's authoritative result.
  // Returns the DELETE_RESULT payload ({ success, campaigns, error }).
  const deleteCampaign = useCallback(async (id, phone) => {
    return sendMessageWithResult({ type: 'delete_campaign', id, phone }, 'DELETE_RESULT');
  }, [sendMessageWithResult]);

  // Reject any in-flight request/response waits so callers can surface an error
  // instead of hanging when the transport goes away (logout, backend restart).
  // Any pending timeout timers are cleared, so the callers' promises resolve
  // exactly once.
  const rejectAllPendingRequests = useCallback(() => {
    const handlers = requestHandlersRef.current;
    requestHandlersRef.current = new Map();
    handlers.forEach((handler) => {
      try {
        if (handler && typeof handler.timer !== 'undefined') clearTimeout(handler.timer);
        if (handler && typeof handler.resolve === 'function') {
          handler.resolve({ success: false, error: 'Connection to backend was lost.' });
        }
      } catch (_) {}
    });
  }, []);

  // Fetch/replace campaign history with dedup. Automatic requests (e.g. the one
  // fired after every successful reconnect) must not slam the backend with
  // repeated identical queries, so a session's history is fetched at most once
  // and never more often than once per 3 seconds.
  const requestHistory = useCallback((phone) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) return;
    if (historyRequestedForRef.current === cleanPhone) return;
    const now = Date.now();
    if (now - lastHistoryRequestAtRef.current < 3000) return;
    lastHistoryRequestAtRef.current = now;
    historyRequestedForRef.current = cleanPhone;
    sendMessage({ type: 'get_history', phone: cleanPhone });
  }, [sendMessage]);

  const fetchCampaignHistory = useCallback((phone) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      setCampaignHistory([]);
      return;
    }
    // Manual refresh is an explicit user action: force past the dedup so it
    // always fetches fresh data.
    historyRequestedForRef.current = null;
    lastHistoryRequestAtRef.current = 0;
    requestHistory(cleanPhone);
  }, [requestHistory]);

  const clearScanState = useCallback(() => {
    setResultsList([]);
    setTotalToCheck(0);
    setCurrentCheckingNum('');
    setIsChecking(false);
    endCooldown();
    setScanState('IDLE');
    setActiveJobId(null);
    activeJobIdRef.current = null;
    lastProcessedIndexRef.current = -1;
    resultsByNumberRef.current = new Map();
    serverScanActiveRef.current = false;
    setServerScanActive(false);
    // A new scan invalidates the previous campaign as "the report to show", so
    // Reports falls back to live state while this one is still running.
    setFinalizedCampaign(null);
  }, [endCooldown]);

  // Rebuild the results list as an authoritative, deduplicated array from the
  // map keyed by normalized phone number. Applied whenever a reconciliation
  // snapshot arrives or a fresh batch of progress events needs collapse.
  const rebuildResultsList = useCallback((map) => {
    return Array.from(map.values());
  }, []);

  /**
   * THE single completion path for a finished scan.
   *
   * Every route into "this scan is over" funnels through here:
   *   1. BULK_CHECK_COMPLETE / BULK_CHECK_STOPPED (the one-shot WS terminal event)
   *   2. the local processed>=total safety net (event lost while the tab was busy)
   *   3. /api/scan-status reconciliation on reconnect or the periodic poll
   *
   * Before this existed each route duplicated the teardown, so a scan that
   * finished while the socket was down kept `scanState === 'SCANNING'` forever:
   * the UI sat at N/N (100%) with no report and no automatic navigation to
   * Reports. It is idempotent per jobId, so whichever signal arrives first wins
   * and the rest are no-ops — a reconnect can never produce a second report.
   *
   * @param {object} payload
   * @param {string} payload.jobId
   * @param {'COMPLETED'|'STOPPED'} payload.status
   * @param {Array} [payload.results] authoritative campaign results, if available
   * @param {object} [payload.campaign] the persisted campaign record, if available
   * @param {number} [payload.total] the user's requested total
   * @param {number} [payload.resultsCount]
   * @param {string} [payload.source] 'event' | 'reconcile' | 'local' (for logging)
   */
  const finalizeScan = useCallback((payload = {}) => {
    const {
      jobId,
      status = 'COMPLETED',
      results: authoritativeResults,
      campaign,
      total,
      resultsCount,
      source = 'event',
    } = payload;

    // Idempotency: one completion per scan. Re-run only when a genuinely new
    // job appears (a fresh scan re-arms the guard on the backend too).
    if (finalizedScanRef.current === jobId) return false;
    finalizedScanRef.current = jobId;

    // Fold the authoritative result set in (idempotent, number-keyed) so the
    // live view, the report and the mockup snapshot all agree even if progress
    // events were lost.
    const finalResults = Array.isArray(authoritativeResults) ? authoritativeResults : null;
    if (finalResults && finalResults.length > 0) {
      const merged = new Map(resultsByNumberRef.current);
      for (const r of finalResults) {
        if (!r) continue;
        const key = String(r.cleanNumber || r.number || r.whatsappId || r.jid || '').split('@')[0].replace(/\D/g, '');
        if (key) merged.set(key, r);
      }
      resultsByNumberRef.current = merged;
      setResultsList(rebuildResultsList(merged));
    }

    if (typeof total === 'number' && total > 0) {
      setTotalToCheck(total);
      setRequestedTotal(total);
    }

    const counted = resultsCount ?? (finalResults ? finalResults.length : resultsByNumberRef.current.size);

    // Publish the SAVED campaign so Reports renders exactly what the backend
    // persisted, not whatever the live stream happened to hold. When the signal
    // that ended the scan carried no campaign object (the local safety net
    // fires before persistence settles), a stub is published now and the
    // `campaignHistory` refresh below fills in the persisted record by id.
    if (campaign) {
      setFinalizedCampaign({ ...campaign, status: campaign.status || status });
    } else {
      setFinalizedCampaign({
        id: jobId,
        status,
        results: finalResults || rebuildResultsList(resultsByNumberRef.current),
        totalChecked: counted,
        pendingPersist: true,
      });
    }

    activeJobIdRef.current = null;
    setActiveJobId(null);
    lastProcessedIndexRef.current = -1;
    setIsChecking(false);
    setScanState(status === 'STOPPED' ? 'STOPPED' : 'COMPLETED');
    serverScanActiveRef.current = false;
    setServerScanActive(false);
    endCooldown();
    clearResumeFallback();

    // The mockup auto-clear and the video auto-start countdown both key off the
    // terminal state, so they must run after the state is committed. If a video
    // export is still in flight the auto-clear is deferred, not dropped — the
    // panel releases the hold when the render ends and the clear then runs.
    scheduleMockupAutoClear();

    const viaNote = source === 'event' ? '' : ' (recovered after a dropped connection)';
    addLog(
      status === 'STOPPED'
        ? `Validation stopped. ${counted} partial result(s) saved.${viaNote}`
        : `Validation complete. Processed ${counted} numbers.${viaNote}`,
      'status'
    );

    // The scan just added/updated a campaign, so bypass the history dedup and
    // pull the SAVED record — Reports and History must never read live preview
    // state, only what the backend persisted.
    if (sessionUserRef.current?.number) {
      historyRequestedForRef.current = null;
      requestHistory(sessionUserRef.current.number);
    }
    return true;
  }, [rebuildResultsList, endCooldown, clearResumeFallback, scheduleMockupAutoClear, addLog, requestHistory]);

  // Fetch the backend's authoritative scan state and reconcile the live UI with
  // it. Idempotent: if two reconciliations race, only the first wins; every
  // number is keyed by stable normalized phone so refreshes / reconnect /
  // duplicate events can never double-count. Used on mount, page refresh,
  // component remount, tab-visible, and WebSocket reconnect.
  const reconcileScanStatus = useCallback(async (opts = {}) => {
    if (reconcileInFlightRef.current) return;
    reconcileInFlightRef.current = true;
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const controller = new AbortController();
      const timeoutMs = opts.timeout || 8000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${backendUrl}/api/scan-status`, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (!data || data.active !== true || !data.jobId) {
        // No active scan on the server. Reflect that the backend is free so the
        // auto-start gate can safely launch a new scan later.
        serverScanActiveRef.current = false;
        setServerScanActive(false);

        // The backend may have finished a scan whose one-shot terminal event this
        // client never received (dropped socket, backgrounded tab, restart).
        // `lastCompleted` carries the persisted campaign, so the same completion
        // flow runs exactly once and the user still reaches their report.
        const finished = data?.lastCompleted;
        if (finished && finished.jobId && finalizedScanRef.current !== finished.jobId) {
          finalizeScan({
            jobId: finished.jobId,
            status: finished.status === 'STOPPED' ? 'STOPPED' : 'COMPLETED',
            campaign: finished.campaign,
            results: finished.campaign?.results,
            total: finished.total ?? finished.campaign?.totalChecked,
            resultsCount: finished.resultsCount,
            source: 'reconcile',
          });
          return;
        }

        // A scan a crash or restart left on disk. Re-adopt its recovered
        // counters, leads and phone preview instead of dropping to 0/0 Idle.
        const interrupted = data?.interrupted;
        if (interrupted && Array.isArray(interrupted.results)) {
          const nextMap = new Map(resultsByNumberRef.current);
          for (const r of interrupted.results) {
            if (!r) continue;
            const key = String(r.cleanNumber || r.number || r.whatsappId || r.jid || '').split('@')[0].replace(/\D/g, '');
            if (key) nextMap.set(key, r);
          }
          resultsByNumberRef.current = nextMap;
          setResultsList(rebuildResultsList(nextMap));
          if (typeof interrupted.total === 'number' && interrupted.total > 0) {
            setTotalToCheck(interrupted.total);
            setRequestedTotal(interrupted.total);
          }
          lastProcessedIndexRef.current = Math.max(lastProcessedIndexRef.current, (interrupted.resultCount || 0) - 1);
          activeJobIdRef.current = interrupted.jobId;
          setActiveJobId(interrupted.jobId);
          setIsChecking(true);
          setScanState('PAUSED');
          addLog(`Recovered an interrupted scan from disk: ${interrupted.resultCount}/${interrupted.total} results restored. Press Resume to continue.`, 'warn');
          return;
        }

        // The backend is idle and there is nothing to recover: keep every
        // counter, lead, log and the phone preview exactly as they are. A
        // disconnect or a reconcile must NEVER reset the UI to 0/Idle - only a
        // genuine new scan, an explicit clear or a real completion may do that.
        return;
      }

// The backend reports an active job; record it so the auto-start gate
      // never fires a competing scan while one is live.
      serverScanActiveRef.current = true;
      setServerScanActive(true);

      // Drop a stale reconciliation for a superseded job (e.g. this client just
      // started a fresh one and the REST snapshot is from an older job). The
      // server still has an active scan, so the auto-start gate stays closed.
      if (activeJobIdRef.current !== null && activeJobIdRef.current !== data.jobId) {
        // If we are not currently checking anything, adopt the server's job so
        // all counters come from the same authoritative scan. Otherwise (a real
        // live job is in flight on this client) ignore the stale snapshot.
        if (!isChecking) {
          activeJobIdRef.current = data.jobId;
          setActiveJobId(data.jobId);
          setIsChecking(true);
        } else {
          return;
        }
      }

      const sameJobAsLastReconcile = data.jobId === lastReconciledJobRef.current;
      const authoritativeResults = Array.isArray(data.results) && data.results.length > 0
        ? data.results
        : [];

      // Collapse the authoritative results into the idempotent number-keyed map.
      // Each number contributes to the counters exactly once.
      const nextMap = new Map(resultsByNumberRef.current);
      for (const r of authoritativeResults) {
        if (!r) continue;
        const key = String(r.cleanNumber || r.number || r.whatsappId || r.jid || '').split('@')[0].replace(/\D/g, '');
        if (key) nextMap.set(key, r);
      }

      // Adopt the authoritative snapshot — never go backwards, always land on the
      // exact server-side count.
      resultsByNumberRef.current = nextMap;
      setResultsList(rebuildResultsList(nextMap));
      if (!sameJobAsLastReconcile && authoritativeResults.length > 0) {
        // Only move the progress guard forward when the snapshot grew. `cursor`
        // is authoritative (0-based index of the last completed number); when it
        // is absent fall back to results.length - 1.
        const targetIndex = typeof data.cursor === 'number' && data.cursor >= 0
          ? data.cursor
          : Math.max(0, authoritativeResults.length - 1);
        lastProcessedIndexRef.current = Math.max(lastProcessedIndexRef.current, targetIndex);
      }

      if (typeof data.total === 'number' && data.total > 0) {
        setTotalToCheck(data.total);
      }
      if (data.currentNumber) {
        const digits = String(data.currentNumber).replace(/\D/g, '');
        setCurrentCheckingNum(digits ? `+${digits}` : data.currentNumber);
      }

      const isActiveState = data.state === 'SCANNING' || data.state === 'STARTING' ||
        data.state === 'RESUMING' || data.state === 'PAUSED';
      if (isActiveState) {
        setIsChecking(true);
      }
      if (data.state === 'SCANNING' || data.state === 'STARTING' ||
          data.state === 'RESUMING' || data.state === 'PAUSED') {
        activeJobIdRef.current = data.jobId;
        setActiveJobId(data.jobId);
        setScanState(data.state === 'STARTING' ? 'SCANNING' : data.state);
      }
      // Restore the exact live cooldown from the authoritative server deadline
      // so a reconciling tab lands on the same pause state/remaining time as
      // every other tab. If the deadline has passed (or none is active) the
      // cooldown UI is cleared.
      if (data.cooldownUntil && Date.now() < Number(data.cooldownUntil)) {
        setConnectivityPaused(data.connectivityPaused === true);
        startCooldownFromDeadline(Number(data.cooldownUntil), data.cooldownMessage);
      } else {
        endCooldown();
      }
      lastReconciledJobRef.current = data.jobId;

      // The scan has already processed its whole queue but the terminal event has
      // not been delivered yet (or was lost). Finalize from the authoritative
      // snapshot so the UI cannot hang at N/N.
      if (data.processedComplete === true && finalizedScanRef.current !== data.jobId) {
        finalizeScan({
          jobId: data.jobId,
          status: data.state === 'STOPPED' ? 'STOPPED' : 'COMPLETED',
          results: data.results,
          total: data.total,
          resultsCount: data.resultCount,
          source: 'reconcile',
        });
      }
    } catch (err) {
      // Reconciliation is best-effort; a failed fetch (abort, network blip)
      // leaves existing state untouched so the live stream never resets.
    } finally {
      // Mark reconciliation as settled so the auto-start gate can safely decide
      // (it will not fire while this is false, avoiding duplicate scans in the
      // initial reconcile window on refresh/mount).
      setReconcileResolved(true);
      reconcileInFlightRef.current = false;
    }
  }, [activeJobId, isChecking, rebuildResultsList, startCooldownFromDeadline, endCooldown, finalizeScan, addLog]);

  const pauseScan = useCallback(() => sendMessage({ type: 'pause_bulk_check' }), [sendMessage]);
  const resumeScan = useCallback(() => sendMessage({ type: 'resume_bulk_check' }), [sendMessage]);
  const stopScan = useCallback(() => sendMessage({ type: 'stop_bulk_check' }), [sendMessage]);

  // Local completion safety net.
  //
  // If every requested number has been processed and nothing is in flight, the
  // scan is over regardless of what the socket delivered. This catches the
  // narrow window where the last PROGRESS arrives but the terminal event does
  // not (socket closed at exactly that moment). It deliberately does NOT try to
  // re-derive the persisted campaign — the watchdog reconciliation is what pulls
  // the saved report — it only guarantees the UI leaves the "Scanning" state and
  // lets the normal report/navigation flow run.
  useEffect(() => {
    if (!isChecking || scanState !== 'SCANNING') return;
    if (!totalToCheck || totalToCheck <= 0) return;
    if (resultsList.length < totalToCheck) return;
    // A number is still being looked up: the queue is not empty yet.
    if (currentCheckingNum) return;
    if (activeJobIdRef.current === null) return;

    const jobId = activeJobIdRef.current;
    finalizeScan({
      jobId,
      status: 'COMPLETED',
      results: resultsList,
      total: totalToCheck,
      resultsCount: resultsList.length,
      source: 'local',
    });
  }, [isChecking, scanState, totalToCheck, resultsList, currentCheckingNum, finalizeScan]);

  const clearAllState = useCallback(() => {
    setStatus('DISCONNECTED');
    setIsConnected(false);
    setIsAuthenticated(false);
    setSessionUser(null);
    setQrCode('');
    setSystemLogs([]);
    clearScanState();
    setCampaignHistory([]);
  }, [clearScanState]);

  // --- Ping/Pong mechanism ---
  const startPing = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping' });
        if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = setTimeout(() => {
          setConnectionStable(false);
          addLog('Connection unstable — ping timeout. Reconnecting...', 'warn');
          // Half-open socket self-heal: force it closed so the reconnect path
          // kicks in deterministically. A dead TCP channel can hang without
          // ever firing onerror/onclose on its own.
          //
          // This close is SELF-INITIATED, so it must not be reported as a
          // backend outage: onclose stays quiet for it, otherwise a routine
          // half-open heal looks to the user like the backend went offline
          // mid-scan (exactly the false "Backend is offline" report).
          selfHealingRef.current = true;
          try {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.close();
            }
          } catch (_) {}
          // Deterministic retry even if the forced close is swallowed.
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          scheduleReconnect();
        }, PONG_TIMEOUT_MS);
      }
    }, PING_INTERVAL_MS);
  }, [sendMessage, addLog, scheduleReconnect]);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
    setConnectionStable(true);
  }, []);

  // --- Activity tracking ---
  const handleActivity = useCallback(() => {
    const now = Date.now();
    setLastActiveTime(now);
    localStorage.setItem('ws_shield_last_active', String(now));
    if (isIdle) setIsIdle(false);
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    activityTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_TIMEOUT_MS);
  }, [isIdle]);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, handleActivity, { passive: true }));
    handleActivity();
    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, handleActivity));
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, [handleActivity]);

  // --- Online/Offline handling ---
  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setConnectionStable(false);
      // Connectivity handling for the Live Scan: a browser/device internet loss
      // must NEVER log the user out, destroy the session/campaign, or clear
      // validated numbers. The backend independently detects the same outage
      // (its WhatsApp lookups fail) and auto-pauses with backoff, preserving the
      // exact scan position. Here we surface the professional message and let the
      // backend's authoritative state drive the pause. Nothing is reset.
      if (scanStateRef.current === 'SCANNING' || scanStateRef.current === 'STARTING' || scanStateRef.current === 'PAUSED' || scanStateRef.current === 'RESUMING') {
        addLog('[Live Scan] Internet connection lost — validation paused until your connection is restored.', 'warn');
      } else {
        addLog('Internet connection lost.', 'warn');
      }
    };
    const goOnline = () => {
      setIsOffline(false);
      // Optimistically report restoration; the authoritative scan state is
      // restored via the WS reconnect + reconcile below.
      addLog('[Live Scan] Internet connection restored — live scanning is resuming.', 'success');
      // Re-establish the transport; the server pushes a fresh STATUS_UPDATE on
      // the next open so the real session state (and any backend auto-pause) is
      // reflected automatically. A logged-out session must NOT auto-reconnect —
      // the user has to start a fresh login explicitly.
      if (!logoutRef.current) connectRef.current();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  // --- WebSocket connection ---
  const connectRef = useRef(null);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const base = backendUrl || window.location.origin;
    const wsUrl = base.startsWith('http')
      ? base.replace(/^http/, 'ws') + '/ws'
      : (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + base + '/ws';

    console.log("Connecting to WebSocket at", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established');
      selfHealingRef.current = false;
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (backendOfflineLoggedRef.current) {
        // Only report recovery when we had actually reported the outage, so a
        // normal (re)connect keeps its usual single status line.
        backendOfflineLoggedRef.current = false;
        addLog('Backend is back online.', 'success');
      } else {
        addLog('WebSocket connection to WhatsApp Shield established.', 'status');
      }
      startPing();
      flushPendingMessagesRef.current?.();
      // On (re)connect, probe the backend for an authoritative active-scan
      // snapshot so a mid-scan reconnect immediately restores the correct
      // Processed / Registered / Total / Progress instead of showing stale or
      // empty counters. The server also pushes BULK_CHECK_START(resume:true),
      // but the REST reconciliation is a deterministic fallback for browsers
      // whose buffered WS events overflowed while backgrounded.
      window.setTimeout(() => reconcileScanStatus(), 0);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS RECEIVED:', data.type, data);

        // Resolve any pending request waiting on this response (requestId echo).
        if (data.requestId && requestHandlersRef.current.has(data.requestId)) {
          const handler = requestHandlersRef.current.get(data.requestId);
          requestHandlersRef.current.delete(data.requestId);
          if (handler && typeof handler.timer !== 'undefined') clearTimeout(handler.timer);
          handler?.resolve?.(data);
        }

        // Single-authority job guard: every bulk event carries a jobId. The
        // first jobId observed adopts the stream; events from any other job are
        // dropped so a stale/superseded job can never update a fresh scan.
        // A BULK_CHECK_START always adopts (a fresh server job must win), so a
        // COMPLETE/STOPPED event lost during a background/transport drop cannot
        // leave the client stuck on an old job forever.
        const adoptBulkEvent = (ev) => {
          if (!ev.jobId) return false;
          if (activeJobIdRef.current === null) {
            activeJobIdRef.current = ev.jobId;
            setActiveJobId(ev.jobId);
            return true;
          }
          if (ev.type === 'BULK_CHECK_START') {
            activeJobIdRef.current = ev.jobId;
            setActiveJobId(ev.jobId);
            return true;
          }
          return ev.jobId === activeJobIdRef.current;
        };

        switch (data.type) {
          case 'ping':
            // Respond to server-initiated keep-alive ping
            sendMessage({ type: 'pong' });
            break;

          case 'pong':
            setConnectionStable(true);
            if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
            break;

          case 'STATUS_UPDATE':
            receivedWsStatusRef.current = true;
            setStatus(data.status);
            setIsConnected(data.status === 'CONNECTED');
            if (data.status === 'CONNECTED') {
              setIsAuthenticated(true);
            }
            if (data.status === 'DISCONNECTED') {
              setIsAuthenticated(false);
              setSessionUser(null);
              setQrCode('');
            }
            setQrCode(data.qr || '');
            setSessionUser(data.user || null);
            if (data.status === 'QR_CODE') {
              addLog('Waiting for QR scan...', 'status');
            } else if (data.status === 'CONNECTED') {
              // Application identity is WhatsApp Shield; the log must never expose
              // the linked account's profile name or phone number.
              addLog('Successfully connected to WhatsApp Shield.', 'success');
              // Dedup'd history load: fires at most once per connected session;
              // reconnect storms can no longer replay an identical get_history
              // query for the same account.
              if (data.user?.number) requestHistory(data.user.number);
            } else if (data.status === 'DISCONNECTED') {
              addLog('WhatsApp session disconnected.', 'warn');
              setIsChecking(false);
              endCooldown();
              clearResumeFallback();
              setScanState('IDLE');
              setActiveJobId(null);
              activeJobIdRef.current = null;
              lastProcessedIndexRef.current = -1;
              resultsByNumberRef.current = new Map();
            }
            if (data.error) {
              addLog(`Connection error: ${data.error}`, 'error');
            }
            break;

          case 'USER_UPDATE':
            setSessionUser(data.user || null);
            break;

          case 'HISTORY_RESULT':
            {
              const campaigns = data.campaigns || [];
              setCampaignHistory(campaigns);
              // Promote the stub published by the local completion safety net to
              // the real persisted record once history delivers it, so Reports
              // shows the saved campaign (correct metadata, id and counts)
              // instead of the temporary local snapshot.
              setFinalizedCampaign(prev => {
                if (!prev || !prev.pendingPersist) return prev;
                const match = campaigns.find(c => c && (c.id === prev.id || c.jobId === prev.id));
                return match ? { ...match, status: match.status || prev.status } : prev;
              });
            }
            break;

          case 'DELETE_RESULT':
            if (data.success) {
              setCampaignHistory(data.campaigns || []);
              addLog('Campaign deleted successfully.', 'info');
            } else {
              addLog(`Failed to delete campaign: ${data.error}`, 'error');
            }
            break;

          case 'LOGOUT_RESULT':
            if (data.success) {
              clearAllState();
              addLog('Logged out successfully.', 'info');
            } else {
              addLog(`Logout failed: ${data.error}`, 'error');
            }
            break;

          case 'BULK_CHECK_INVALID_INPUT':
            {
              // Emitted by the pre-scan gate BEFORE a job starts (and also when
              // every number is rejected and the scan is refused outright).
              // It is informational: the authoritative per-row invalid entries
              // ride along in BULK_CHECK_START.invalidResults once the job opens.
              setInvalidInputCount(data.invalid ?? data.invalidCount ?? 0);
              if (data.total) setRequestedTotal(data.total);
              const sample = Array.isArray(data.samples) ? data.samples.filter(Boolean) : [];
              if (sample.length) {
                for (const s of sample) {
                  addLog(`[${s.number}] Invalid format${s.reason ? ` - ${s.reason}` : ''}`, 'error');
                }
              }
              if (data.invalid) {
                addLog(`Pre-scan validation: ${data.invalid} of ${data.total ?? '?'} numbers are invalid and will NOT be sent to WhatsApp.`, 'warn');
              }
            }
            break;

          case 'BULK_CHECK_START':
            if (!adoptBulkEvent(data)) break;
            resetMockupClear();
            if (data.jobId) {
              activeJobIdRef.current = data.jobId;
              setActiveJobId(data.jobId);
            }
            setScanState('SCANNING');
            setTotalToCheck(data.total);
            // The progress denominator is the user's full requested list, which
            // is what the backend reports in `total`. Fall back to it if an older
            // backend only sends the lookup count.
            setRequestedTotal(data.total ?? data.validTotal ?? 0);
            setInvalidInputCount(0);
            serverScanActiveRef.current = true;
            setServerScanActive(true);
            if (data.resume && Array.isArray(data.results)) {
              // Mid-scan reconnect / refresh: the backend snapshot carries every
              // already-completed result plus the number being checked right now.
              // Merge into the idempotent number-keyed map so a snapshot arriving
              // after an earlier REST reconciliation can never truncate results,
              // and nothing validated before the link is lost or double-counted.
              const resumeMap = new Map(resultsByNumberRef.current);
              for (const r of data.results) {
                if (!r) continue;
                const key = String(r.cleanNumber || r.number || r.whatsappId || r.jid || '').split('@')[0].replace(/\D/g, '');
                if (key) resumeMap.set(key, r);
              }
              resultsByNumberRef.current = resumeMap;
              setResultsList(rebuildResultsList(resumeMap));
              setIsChecking(true);
              // Authoritative progress: the backend snapshot's resumed result set
              // is the true completed count. Make the processed guard match it so
              // it can never lag or reset backwards. `resumeMap.size - 1` is the
              // 0-based index of the last completed number (results excludes the
              // current in-flight number).
              if (resumeMap.size > 0) {
                lastProcessedIndexRef.current = Math.max(lastProcessedIndexRef.current, resumeMap.size - 1);
              }
              setCurrentCheckingNum(data.currentNumber ? `+${String(data.currentNumber).replace(/\D/g, '')}` : '');
              if (data.state === 'PAUSED' || data.state === 'RESUMING') setScanState(data.state);
              // If the backend is mid-cooldown right now, reflect the SAME
              // absolute deadline so this tab's remaining pause matches every
              // other tab instead of starting a fresh countdown.
              if (data.cooldownUntil && Date.now() < Number(data.cooldownUntil)) {
                startCooldownFromDeadline(Number(data.cooldownUntil), data.cooldownMessage);
              } else {
                endCooldown();
              }
              addLog(`Reconnected to active validation: ${resumeMap.size}/${data.total} processed.`, 'status');
            } else {
              // GENUINE new scan (not a resume): reset local accounting for a
              // fresh job. This only happens when the auto-start gate confirmed
              // no other scan is active, so no competing job can be running.
              lastProcessedIndexRef.current = -1;
              resultsByNumberRef.current = new Map();
              setResultsList([]);
              setIsChecking(true);
              setCurrentCheckingNum('');
              endCooldown();
              // Numbers rejected by the backend's pre-scan gate arrive here rather
              // than as progress rows: a progress row must carry a monotonic
              // `index`, and an invalid number never had a lookup slot to occupy.
              // They are seeded into the same number-keyed map so they appear in
              // the log, counters and Validation Summary immediately and are
              // indistinguishable in shape from a scanned row.
              const seeded = Array.isArray(data.invalidResults) ? data.invalidResults.filter(Boolean) : [];
              for (const r of seeded) {
                const key = String(r.cleanNumber || r.number || '').split('@')[0].replace(/\D/g, '');
                if (!key) continue;
                resultsByNumberRef.current.set(key, r);
                const label = r.formatted || r.number || `+${key}`;
                addLog(`[${label}] Invalid format${r.invalidReason ? ` - ${r.invalidReason}` : ''}`, 'error');
              }
              if (seeded.length) {
                setResultsList(rebuildResultsList(resultsByNumberRef.current));
              }
              setInvalidInputCount(data.invalidCount ?? seeded.length);
              addLog(
                data.invalidCount
                  ? `Started validation of ${data.total} numbers (${data.invalidCount} invalid, skipped)`
                  : `Started validation of ${data.total} numbers`,
                'status'
              );
            }
            break;

          case 'BULK_CHECK_PROCESSING':
            {
              // Fired the instant the backend starts checking a number so the
              // "Current Number" updates immediately, before the lookup finishes.
              if (!adoptBulkEvent(data)) break;
              // Never let a stale/duplicate "processing" event move the cursor
              // backwards after that number has already completed.
              if (typeof data.index === 'number' && data.index < lastProcessedIndexRef.current) break;
              setScanState(prev => (prev === 'RESUMING' || prev === 'STARTING' || prev === 'IDLE' ? 'SCANNING' : prev));
              setCurrentCheckingNum(data.cleanNumber ? `+${data.cleanNumber}` : data.number || '');
              endCooldown();
              clearResumeFallback();
            }
            break;

          case 'BULK_CHECK_PROGRESS':
            {
              if (!adoptBulkEvent(data)) break;
              // Duplicate/out-of-order guard: each index completes exactly once
              // per job. Re-delivered or stale events are ignored so results,
              // counters, and logs can never diverge. Additionally key results by
              // stable normalized phone so a background reconciliation re-insert
              // can never double-count a number.
              const resultKey = String(
                data.result?.cleanNumber || data.result?.number || data.cleanNumber || ''
              ).split('@')[0].replace(/\D/g, '');
              if (typeof data.index === 'number' && data.index <= lastProcessedIndexRef.current) break;
              if (resultKey && resultsByNumberRef.current.has(resultKey)) {
                // The number already counted (reconciliation or prior event).
                // Refresh its stored result and rebuild, but do NOT increment the
                // processed guard / append again.
                if ((typeof data.index === 'number') && data.index > lastProcessedIndexRef.current) {
                  lastProcessedIndexRef.current = data.index;
                }
                resultsByNumberRef.current.set(resultKey, data.result);
                setResultsList(rebuildResultsList(resultsByNumberRef.current));
                break;
              }
              lastProcessedIndexRef.current = data.index;
              const formatted = data.result.formatted || data.result.number || `+${data.cleanNumber}`;
              setCurrentCheckingNum(formatted);
              if (resultKey) {
                resultsByNumberRef.current.set(resultKey, data.result);
                setResultsList(rebuildResultsList(resultsByNumberRef.current));
              } else {
                setResultsList(prev => [...prev, data.result]);
              }
              setScanState(prev => (prev === 'RESUMING' || prev === 'STARTING' || prev === 'IDLE' ? 'SCANNING' : prev));
              if (data.result.error) {
                addLog(`[${formatted}] Error: ${data.result.error}`, 'error');
              } else if (data.result.exists) {
                addLog(`[${formatted}] Active WhatsApp account`, 'success');
              } else if (!data.result.isValidFormat) {
                addLog(`[${formatted}] Invalid format`, 'error');
              } else {
                addLog(`[${formatted}] Not registered`, 'warn');
              }
              endCooldown();
              clearResumeFallback();
            }
            break;

          case 'BULK_CHECK_COOLDOWN':
            if (!adoptBulkEvent(data)) break;
            clearResumeFallback();
            setConnectivityPaused(data.connectivityPaused === true);
            // Drive a live cool-down countdown instead of leaving cooldownTimeLeft
            // as dead state (it was previously never updated). Use an absolute
            // deadline so a tab that missed the start of the pause (reconnect /
            // reconcile) joins the same remaining time as every other tab.
            {
              const until = (Number(data.cooldownUntil) || (Date.now() + (Number(data.timeLeft) || 0) * 1000));
              startCooldownFromDeadline(until, data.message);
            }
            if (data.connectivityPaused === true) {
              addLog('[Live Scan] Internet connection lost — validation paused until your connection is restored.', 'warn');
            } else {
              addLog(data.message, 'warn');
            }
            break;

          case 'BULK_CHECK_PAUSED':
            if (!adoptBulkEvent(data)) break;
            clearResumeFallback();
            setScanState('PAUSED');
            endCooldown();
            addLog(`Scan paused. ${data.processed} number(s) processed, resuming at ${data.cursor + 1}.`, 'status');
            break;

          case 'BULK_CHECK_RESUMING':
            if (!adoptBulkEvent(data)) break;
            setScanState('RESUMING');
            scheduleResumeFallback();
            addLog('Resuming validation from the saved position...', 'status');
            break;

          case 'BULK_CHECK_RESUMED':
            // Definitive backend ack that the scan has actually left the paused
            // state and is scanning again. Never allow the transient RESUMING
            // state to linger: if a progress/processing event was delayed (long
            // cooldown right after resume) this ack is what restores SCANNING.
            if (!adoptBulkEvent(data)) break;
            clearResumeFallback();
            setScanState('SCANNING');
            endCooldown();
            if (typeof data.processed === 'number' && data.processed > 0) {
              addLog(`Resumed — continuing at result ${data.processed + 1}.`, 'status');
            }
            break;

          case 'BULK_CHECK_COMPLETE':
            {
              if (!adoptBulkEvent(data)) break;
              // The terminal event carries the authoritative, complete result
              // set, so a transport drop that skipped individual PROGRESS events
              // cannot leave the live view partial. Reconciliation, teardown and
              // navigation all live in the single idempotent `finalizeScan`.
              finalizeScan({
                jobId: data.jobId,
                status: 'COMPLETED',
                campaign: data.campaign,
                results: data.campaign?.results,
                total: data.total ?? data.campaign?.totalChecked,
                resultsCount: data.resultsCount ?? data.campaign?.totalChecked,
                source: 'event',
              });
            }
            break;

          case 'BULK_CHECK_STOPPED':
            {
              if (!adoptBulkEvent(data)) break;
              // Identical rules to COMPLETE — a stopped scan finalizes through the
              // same path, so partial results are reconciled the same way and the
              // report/navigation behaviour cannot diverge between the two.
              finalizeScan({
                jobId: data.jobId,
                status: 'STOPPED',
                campaign: data.campaign,
                results: data.campaign?.results,
                total: data.total ?? data.campaign?.totalChecked,
                resultsCount: data.resultsCount ?? data.campaign?.totalChecked,
                source: 'event',
              });
            }
            break;

          case 'BULK_CHECK_INTERRUPTED':
            {
              const hasActiveJob = activeJobIdRef.current !== null;
              if (data.jobId && hasActiveJob && data.jobId !== activeJobIdRef.current) break;
              if (data.jobId || !hasActiveJob) {
                activeJobIdRef.current = null;
                setActiveJobId(null);
                lastProcessedIndexRef.current = -1;
                resultsByNumberRef.current = new Map();
                setIsChecking(false);
                setScanState('IDLE');
                serverScanActiveRef.current = false;
                setServerScanActive(false);
                endCooldown();
                clearResumeFallback();
                addLog(`Validation interrupted: ${data.reason}`, 'error');
              }
            }
            break;

          case 'BACKEND_DEGRADED':
            // Process guard caught an internal error and kept the server alive.
            addLog(data.message || 'Backend recovered from an internal error and is still running.', 'warn');
            break;

          case 'MESSAGE_AGENT_UPDATE':
            console.log('Message Agent update:', data);
            window.dispatchEvent(new CustomEvent('messageAgent-update', { detail: data }));
            break;

          case 'SEND_GATE_UPDATE':
            window.dispatchEvent(new CustomEvent('send-gate-update', { detail: data }));
            break;

          default:
            console.log("WS UNHANDLED TYPE:", data.type, data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      // Ignore close events from a superseded socket (e.g. React StrictMode
      // dev double-mount, where the first WS is closed right after mount).
      if (wsRef.current !== ws) return;
      console.log('WebSocket disconnected');
      setConnectionStable(false);
      stopPing();
      // Keep the session/authentication state intact — a transport drop is not a
      // logout. Schedule an automatic reconnect; the server pushes a fresh
      // STATUS_UPDATE on the next open, so a genuine WhatsApp logout is still
      // surfaced (and the session cleared) exactly as before, while a transient
      // drop never forces the user to re-link.
      // IMPORTANT: do NOT wipe scan/results state here. A transport drop is
      // transient — erasing Processed/Registered/Total and the Pause state here
      // would flicker the UI and (before the authoritative reconciliation) look
      // like the scan was lost. Instead we keep the last-known state on screen;
      // on reconnect, reconcileScanStatus() reasserts the authoritative backend
      // snapshot (or clears it if the job truly ended).
      endCooldown();
      clearResumeFallback();
      rejectAllPendingRequests();
      if (selfHealingRef.current) {
        // Deliberate half-open heal, not an outage: no offline line, no badge.
        setReconnecting(false);
      } else {
        // The scan UI keeps every counter, lead and log through the outage and
        // shows a "Reconnecting..." badge instead of resetting to 0/Idle.
        setReconnecting(true);
      }
      if (!backendOfflineLoggedRef.current) {
        backendOfflineLoggedRef.current = true;
        addLog('Backend is offline. Retrying connection...', 'warn');
      }
      // scheduleReconnect is a no-op while a logout is in progress, so a
      // session the user terminated is never silently re-established.
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, [addLog, startPing, stopPing, sendMessage, clearAllState, scheduleReconnect, rejectAllPendingRequests,
    requestHistory, endCooldown, startCooldownFromDeadline, reconcileScanStatus, scheduleResumeFallback, clearResumeFallback]);

  connectRef.current = connectWebSocket;

  // Initial mount
  useEffect(() => {
    if (connectRef.current) connectRef.current();

    // Tab-visibility reconciliation: browsers heavily throttle background tabs
    // (WS events can stall or the socket can silently buffer/drop updates). The
    // instant the tab is visible again, fetch the authoritative scan state so
    // the Live Validation counters resync to the real backend count rather than
    // showing stale values from before the tab was hidden.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconcileScanStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic reconciliation WHILE a scan is active.
    //
    // The terminal event is delivered exactly once. If the socket drops at the
    // precise moment the last number finishes, that event is lost and nothing
    // else would ever tell the client the scan is over — the UI would sit at
    // N/N (100%) on "Scanning" forever. Polling the authoritative endpoint while
    // a job is live turns that unrecoverable case into a self-healing one; it is
    // a no-op once no scan is active, so it costs nothing when idle.
    const SCAN_WATCHDOG_MS = 4000;
    const watchdog = window.setInterval(() => {
      if (activeJobIdRef.current !== null) reconcileScanStatus();
    }, SCAN_WATCHDOG_MS);

    // Reconciliation on initial mount: if the backend reports an active scan
    // (e.g. the page was refreshed mid-scan, or the user re-navigates to a
    // running scan), rehydrate immediately from authoritative state.
    const initialReconcileTimer = window.setTimeout(() => reconcileScanStatus(), 0);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    // Abortable so the fetch cannot call setState after this effect is undone.
    const controller = new AbortController();

    fetch(`${backendUrl}/api/status`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        // The socket is authoritative: if a STATUS_UPDATE already arrived, the
        // fetch response is stale and must not clobber newer QR/connection state.
        if (receivedWsStatusRef.current) return;
        setStatus(data.status);
        setIsConnected(data.status === 'CONNECTED');
        if (data.status === 'CONNECTED') {
          setIsAuthenticated(true);
        }
        if (data.qr) setQrCode(data.qr);
        if (data.user) setSessionUser(data.user);
      })
      .catch(err => {
        if (err && err.name === 'AbortError') return;
        console.warn("Failed to fetch initial status via API, falling back to WS", err);
      });

    // Load last active idle timestamp from localStorage
    const saved = localStorage.getItem('ws_shield_last_active');
    if (saved) setLastActiveTime(Number(saved));

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.clearInterval(watchdog);
      window.clearTimeout(initialReconcileTimer);
      stopPing();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (cooldownCountdownRef.current) clearInterval(cooldownCountdownRef.current);
      clearResumeFallback();
      // Drop any queued messages and pending request waits so nothing resolves
      // or re-sends after the provider is unmounted.
      pendingMessagesRef.current = [];
      rejectAllPendingRequests();
      controller.abort();
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejectAllPendingRequests]);

  const logout = async () => {
    setIsLoggingOut(true);
    // Block every automatic reconnect path immediately — a session the user
    // ends must never be silently re-established by a timer, onclose handler,
    // or the browser 'online' event.
    logoutRef.current = true;

    // Halt all background processes immediately
    stopPing();
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    endCooldown();

    // Kill any active bulk-check / scan on the backend
    sendMessage({ type: 'stop_bulk_check' });
    sendMessage({ type: 'cancel_qr' });

    // Tell the backend to tear down and invalidate the WhatsApp session
    sendMessage({ type: 'logout' });
    // Re-assert after the queued sends: if the socket was closed, sendMessage
    // re-arms reconnection for "explicit user action" and would flip the guard
    // back off. The REST logout below is the authoritative teardown.
    logoutRef.current = true;
    pendingMessagesRef.current = [];

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${backendUrl}/api/logout`, { method: 'POST' });
    } catch (err) {
      console.error('REST logout failed:', err);
    }

    // Close the WebSocket so no more messages arrive
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    rejectAllPendingRequests();

    // Forget session-scoped bookkeeping so a fresh login starts clean.
    historyRequestedForRef.current = null;
    lastHistoryRequestAtRef.current = 0;

    // Wipe all cross-step window globals so stale data never leaks into a new session
    delete window.whatsappShieldAudience;
    delete window.__whatsappShieldAudience;
    delete window.whatsappShieldCountryCode;
    delete window.whatsappShieldCountryIso;
    delete window.whatsappShieldCountryName;
    delete window.whatsappShieldInputTimestamp;
    delete window.whatsappShieldSettings;

    // Reset every piece of React state
    clearAllState();
    localStorage.removeItem('ws_shield_last_active');

    // Close all open modals / popups / drawers
    window.dispatchEvent(new CustomEvent('close-all-modals'));

    setTimeout(() => setIsLoggingOut(false), 300);
  };

  const dotState = (() => {
    if (!isAuthenticated) return 'gray';
    if (isOffline) return 'amber';
    if (!isConnected) return 'red';
    if (!connectionStable) return 'amber';
    if (isChecking) return 'green-pulse';
    if (isIdle) return 'green-dim';
    return 'green';
  })();

  return (
    <WebSocketContext.Provider value={{
      status,
      isConnected,
      isAuthenticated,
      qrCode,
      sessionUser,
      systemLogs,
      setSystemLogs,
      isChecking,
      totalToCheck,      checkedCount,
      progressPercent,
      invalidInputCount,
      requestedTotal,
      currentCheckingNum,
      serverScanActive,
      reconcileScanStatus,
      reconcileResolved,
      resultsList,
      setResultsList,
      clearScanState,
      scanState,
      activeJobId,
      pauseScan,
      resumeScan,
      stopScan,
      cooldownActive,
      cooldownTimeLeft,
      connectivityPaused,
    campaignHistory,
    setCampaignHistory,
    finalizedCampaign,
      addLog,
      logout,
      connectWebSocket,
      sendMessage,
      sendMessageWithResult,
      deleteCampaign,
      fetchCampaignHistory,
      clearAllState,
      // Mockup Preview Global Auto-Clear & Manual Clear
      mockupClearedAt,
      clearMockupLeads,
      resetMockupClear,
    holdMockupAutoClear,
    releaseMockupAutoClear,
      // Single live leads list shared by the mockup + floating pill badge
      previewLeads,
      previewLeadCount,
      // New feature states
      isOffline,
      connectionStable,
      reconnecting,
      isIdle,
      lastActiveTime,
      dotState,
      isLoggingOut,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
