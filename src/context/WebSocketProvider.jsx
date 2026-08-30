import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { showToast } from '../components/ui/ToastNotification';

const WebSocketContext = createContext(null);

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll'];
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const PING_INTERVAL_MS = 30000;
const PONG_TIMEOUT_MS = 5000;

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

  // Cool-down State
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);

  // Campaign History
  const [campaignHistory, setCampaignHistory] = useState([]);

  // Loading states
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- Feature States ---
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [connectionStable, setConnectionStable] = useState(true);
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
  // Request/response correlation: maps a requestId -> resolver for messages that
  // need the backend's result (e.g. delete_campaign). Lets callers await the
  // backend instead of optimistically assuming success.
  const requestHandlersRef = useRef(new Map());

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
    if (cooldownCountdownRef.current) {
      clearInterval(cooldownCountdownRef.current);
      cooldownCountdownRef.current = null;
    }
  }, []);

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
  }, [endCooldown]);

  const pauseScan = useCallback(() => sendMessage({ type: 'pause_bulk_check' }), [sendMessage]);
  const resumeScan = useCallback(() => sendMessage({ type: 'resume_bulk_check' }), [sendMessage]);
  const stopScan = useCallback(() => sendMessage({ type: 'stop_bulk_check' }), [sendMessage]);

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
      addLog('Internet connection lost.', 'warn');
    };
    const goOnline = () => {
      setIsOffline(false);
      addLog('Internet connection restored.', 'success');
      // Re-establish the transport; the server pushes a fresh STATUS_UPDATE on
      // the next open, so the real session state is reflected automatically.
      // A logged-out session must NOT auto-reconnect — the user has to start a
      // fresh login explicitly.
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
      reconnectAttemptsRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      addLog('WebSocket connection to WhatsApp Shield established.', 'status');
      startPing();
      flushPendingMessagesRef.current?.();
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
        const adoptBulkEvent = (ev) => {
          if (!ev.jobId) return false;
          if (activeJobIdRef.current === null) {
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
              addLog(`Authenticated successfully: ${data.user?.name || data.user?.number}`, 'success');
              // Dedup'd history load: fires at most once per connected session;
              // reconnect storms can no longer replay an identical get_history
              // query for the same account.
              if (data.user?.number) requestHistory(data.user.number);
            } else if (data.status === 'DISCONNECTED') {
              addLog('WhatsApp session disconnected.', 'warn');
              setIsChecking(false);
              endCooldown();
              setScanState('IDLE');
              setActiveJobId(null);
              activeJobIdRef.current = null;
              lastProcessedIndexRef.current = -1;
            }
            if (data.error) {
              addLog(`Connection error: ${data.error}`, 'error');
            }
            break;

          case 'USER_UPDATE':
            setSessionUser(data.user || null);
            break;

          case 'HISTORY_RESULT':
            setCampaignHistory(data.campaigns || []);
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

          case 'BULK_CHECK_START':
            if (!adoptBulkEvent(data)) break;
            if (data.jobId) {
              activeJobIdRef.current = data.jobId;
              setActiveJobId(data.jobId);
            }
            lastProcessedIndexRef.current = -1;
            setIsChecking(true);
            setScanState('SCANNING');
            setTotalToCheck(data.total);
            if (data.resume && Array.isArray(data.results)) {
              // Mid-scan reconnect / refresh: the backend snapshot carries every
              // already-completed result plus the number being checked right now.
              // Rebuild the live view from it so nothing validated before the
              // link is lost and no earlier progress event is re-appended.
              setResultsList(data.results);
              if (data.results.length > 0) lastProcessedIndexRef.current = data.results.length - 1;
              setCurrentCheckingNum(data.currentNumber ? `+${String(data.currentNumber).replace(/\D/g, '')}` : '');
              if (data.state === 'PAUSED' || data.state === 'RESUMING') setScanState(data.state);
              addLog(`Reconnected to active validation: ${data.results.length}/${data.total} processed.`, 'status');
            } else {
              setResultsList([]);
              setCurrentCheckingNum('');
              addLog(`Started validation of ${data.total} numbers`, 'status');
            }
            endCooldown();
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
            }
            break;

          case 'BULK_CHECK_PROGRESS':
            {
              if (!adoptBulkEvent(data)) break;
              // Duplicate/out-of-order guard: each index completes exactly once
              // per job. Re-delivered or stale events are ignored so results,
              // counters, and logs can never diverge.
              if (typeof data.index === 'number' && data.index <= lastProcessedIndexRef.current) break;
              lastProcessedIndexRef.current = data.index;
              const formatted = data.result.formatted || data.result.number || `+${data.cleanNumber}`;
              setCurrentCheckingNum(formatted);
              setResultsList(prev => [...prev, data.result]);
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
            }
            break;

          case 'BULK_CHECK_COOLDOWN':
            if (!adoptBulkEvent(data)) break;
            setCooldownActive(true);
            // Drive a live cool-down countdown instead of leaving cooldownTimeLeft
            // as dead state (it was previously never updated).
            if (cooldownCountdownRef.current) {
              clearInterval(cooldownCountdownRef.current);
              cooldownCountdownRef.current = null;
            }
            {
              const totalSeconds = Math.max(1, Number(data.timeLeft) || 0);
              const startedAt = Date.now();
              const tick = () => {
                const left = Math.max(0, Math.ceil(totalSeconds - (Date.now() - startedAt) / 1000));
                setCooldownTimeLeft(left);
                if (left <= 0) {
                  if (cooldownCountdownRef.current) clearInterval(cooldownCountdownRef.current);
                  cooldownCountdownRef.current = null;
                  setCooldownActive(false);
                }
              };
              tick();
              cooldownCountdownRef.current = setInterval(tick, 500);
            }
            addLog(data.message, 'warn');
            break;

          case 'BULK_CHECK_PAUSED':
            if (!adoptBulkEvent(data)) break;
            setScanState('PAUSED');
            endCooldown();
            addLog(`Scan paused. ${data.processed} number(s) processed, resuming at ${data.cursor + 1}.`, 'status');
            break;

          case 'BULK_CHECK_RESUMING':
            if (!adoptBulkEvent(data)) break;
            setScanState('RESUMING');
            addLog('Resuming validation from the saved position...', 'status');
            break;

          case 'BULK_CHECK_COMPLETE':
            {
              if (!adoptBulkEvent(data)) break;
              // The server streams one PROGRESS per number, but if the transport
              // dropped mid-scan (or the client connected after the scan began)
              // individual events can be missed. The terminal event carries the
              // authoritative, complete result set — reconcile with it so the
              // live view is never left partial.
              if (Array.isArray(data.campaign?.results) && data.campaign.results.length > 0) {
                setResultsList(data.campaign.results);
              }
              if (typeof data.total === 'number' && data.total > 0) {
                setTotalToCheck(data.total);
              }
              activeJobIdRef.current = null;
              setActiveJobId(null);
              lastProcessedIndexRef.current = -1;
              setIsChecking(false);
              setScanState('COMPLETED');
              endCooldown();
              addLog(`Validation complete. Processed ${data.resultsCount} numbers.`, 'status');
              // Force a fresh history refresh — the scan just added a campaign,
              // so the terminal event must bypass the reconnect dedup.
              if (sessionUserRef.current?.number) {
                historyRequestedForRef.current = null;
                requestHistory(sessionUserRef.current.number);
              }
            }
            break;

          case 'BULK_CHECK_STOPPED':
            {
              if (!adoptBulkEvent(data)) break;
              // Same authoritative reconciliation as COMPLETE: the partial
              // result set is never dropped when a transport blip skipped events.
              if (Array.isArray(data.campaign?.results) && data.campaign.results.length > 0) {
                setResultsList(data.campaign.results);
              }
              if (typeof data.total === 'number' && data.total > 0) {
                setTotalToCheck(data.total);
              }
              activeJobIdRef.current = null;
              setActiveJobId(null);
              lastProcessedIndexRef.current = -1;
              setIsChecking(false);
              setScanState('STOPPED');
              endCooldown();
              addLog(`Validation stopped. ${data.resultsCount} partial result(s) saved.`, 'status');
              // Force a fresh history refresh — results may have changed.
              if (sessionUserRef.current?.number) {
                historyRequestedForRef.current = null;
                requestHistory(sessionUserRef.current.number);
              }
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
                setIsChecking(false);
                setScanState('IDLE');
                endCooldown();
                addLog(`Validation interrupted: ${data.reason}`, 'error');
              }
            }
            break;

          case 'MESSAGE_AGENT_UPDATE':
            console.log('Message Agent update:', data);
            window.dispatchEvent(new CustomEvent('messageAgent-update', { detail: data }));
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
      setIsChecking(false);
      endCooldown();
      setScanState('IDLE');
      setActiveJobId(null);
      activeJobIdRef.current = null;
      lastProcessedIndexRef.current = -1;
      rejectAllPendingRequests();
      addLog('WebSocket connection lost — reconnecting...', 'warn');
      // scheduleReconnect is a no-op while a logout is in progress, so a
      // session the user terminated is never silently re-established.
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, [addLog, startPing, stopPing, sendMessage, clearAllState, scheduleReconnect, rejectAllPendingRequests,
    requestHistory, endCooldown]);

  connectRef.current = connectWebSocket;

  // Initial mount
  useEffect(() => {
    if (connectRef.current) connectRef.current();

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
      stopPing();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (cooldownCountdownRef.current) clearInterval(cooldownCountdownRef.current);
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
      totalToCheck,
      checkedCount,
      progressPercent,
      currentCheckingNum,
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
      campaignHistory,
      setCampaignHistory,
      addLog,
      logout,
      connectWebSocket,
      sendMessage,
      sendMessageWithResult,
      deleteCampaign,
      fetchCampaignHistory,
      clearAllState,
      // New feature states
      isOffline,
      connectionStable,
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
