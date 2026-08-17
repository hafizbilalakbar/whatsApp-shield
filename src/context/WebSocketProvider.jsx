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
  const [checkedCount, setCheckedCount] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentCheckingNum, setCurrentCheckingNum] = useState('');
  const [resultsList, setResultsList] = useState([]);

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
  // Set once the WebSocket has delivered a STATUS_UPDATE. Guards the initial
  // /api/status fetch so a stale (pre-QR) HTTP response can never overwrite a
  // newer QR/connection state pushed over the socket.
  const receivedWsStatusRef = useRef(false);
  // Messages sent while the socket is connecting/closed (e.g. "generate_qr"
  // right after a backend restart) are queued and delivered on the next open.
  const pendingMessagesRef = useRef([]);

  const addLog = (text, type = 'info') => {
    setSystemLogs(prev => {
      const newLogs = [...prev, { time: new Date().toLocaleTimeString(), text, type }];
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

  const sendMessage = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return;
    }
    // Socket is connecting or dropped (e.g. after a backend restart). Never
    // drop the message silently — that makes user actions like "Generate QR
    // Code" appear to do nothing. Re-establish the transport and deliver it
    // once the socket opens.
    if (connectRef.current) connectRef.current();
    pendingMessagesRef.current.push(msg);
    flushPendingMessagesRef.current?.();
  }, []);

  const fetchCampaignHistory = useCallback((phone) => {
    if (!phone) {
      setCampaignHistory([]);
      return;
    }
    sendMessage({ type: 'get_history', phone });
  }, [sendMessage]);

  const clearScanState = useCallback(() => {
    setResultsList([]);
    setCheckedCount(0);
    setTotalToCheck(0);
    setProgressPercent(0);
    setCurrentCheckingNum('');
    setIsChecking(false);
    setCooldownActive(false);
    setScanState('IDLE');
    setActiveJobId(null);
  }, []);

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
        setConnectionStable(false);
        if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = setTimeout(() => {
          setConnectionStable(false);
          addLog('Connection unstable — ping timeout.', 'warn');
        }, PONG_TIMEOUT_MS);
      }
    }, PING_INTERVAL_MS);
  }, [sendMessage, addLog]);

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
      // No automatic reconnection — the user must explicitly re-initiate the QR flow.
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [isConnected, isAuthenticated, addLog]);

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
      addLog('WebSocket connection to WhatsApp Shield established.', 'status');
      startPing();
      flushPendingMessagesRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS RECEIVED:', data.type, data);

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
              const phone = data.user?.number?.replace(/\D/g, '');
              if (phone) {
                setTimeout(() => sendMessage({ type: 'get_history', phone }), 500);
              }
            } else if (data.status === 'DISCONNECTED') {
              addLog('WhatsApp session disconnected.', 'warn');
              setIsChecking(false);
              setScanState('IDLE');
              setActiveJobId(null);
              activeJobIdRef.current = null;
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
            if (data.jobId) {
              activeJobIdRef.current = data.jobId;
              setActiveJobId(data.jobId);
            }
            setIsChecking(true);
            setScanState('SCANNING');
            setTotalToCheck(data.total);
            setCheckedCount(0);
            setProgressPercent(0);
            setResultsList([]);
            setCurrentCheckingNum('');
            setCooldownActive(false);
            addLog(`Started validation of ${data.total} numbers`, 'status');
            break;

          case 'BULK_CHECK_PROGRESS':
            {
              if (!adoptBulkEvent(data)) break;
              setCheckedCount(data.index + 1);
              setProgressPercent(Math.round(((data.index + 1) / data.total) * 100));
              setCurrentCheckingNum(data.result.formatted || data.result.number || '');
              setResultsList(prev => [...prev, data.result]);
              setScanState(prev => (prev === 'RESUMING' || prev === 'STARTING' ? 'SCANNING' : prev));
              if (data.result.exists) {
                addLog(`[${data.result.formatted}] Active WhatsApp account`, 'success');
              } else if (!data.result.isValidFormat) {
                addLog(`[${data.result.formatted}] Invalid format`, 'error');
              } else {
                addLog(`[${data.result.formatted}] Not registered`, 'warn');
              }
              setCooldownActive(false);
            }
            break;

          case 'BULK_CHECK_COOLDOWN':
            if (!adoptBulkEvent(data)) break;
            setCooldownActive(true);
            addLog(data.message, 'warn');
            break;

          case 'BULK_CHECK_PAUSED':
            if (!adoptBulkEvent(data)) break;
            setScanState('PAUSED');
            setCooldownActive(false);
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
              activeJobIdRef.current = null;
              setActiveJobId(null);
              setIsChecking(false);
              setScanState('COMPLETED');
              setProgressPercent(100);
              setCooldownActive(false);
              addLog(`Validation complete. Processed ${data.resultsCount} numbers.`, 'status');
              const phone = sessionUserRef.current?.number?.replace(/\D/g, '');
              if (phone) {
                setTimeout(() => sendMessage({ type: 'get_history', phone }), 300);
              }
            }
            break;

          case 'BULK_CHECK_STOPPED':
            {
              if (!adoptBulkEvent(data)) break;
              activeJobIdRef.current = null;
              setActiveJobId(null);
              setIsChecking(false);
              setScanState('STOPPED');
              setCooldownActive(false);
              if (typeof data.resultsCount === 'number' && data.total) {
                setProgressPercent(Math.min(100, Math.round((data.resultsCount / data.total) * 100)));
              }
              addLog(`Validation stopped. ${data.resultsCount} partial result(s) saved.`, 'status');
              const stopPhone = sessionUserRef.current?.number?.replace(/\D/g, '');
              if (stopPhone) {
                setTimeout(() => sendMessage({ type: 'get_history', stopPhone }), 300);
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
                setIsChecking(false);
                setScanState('IDLE');
                setCooldownActive(false);
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
      // Never keep stale "connected" state: if the WS link dies, the session
      // status is unknown and the user must explicitly re-initiate the QR flow.
      // The backend deliberately does no auto-reconnect / session restore.
      setStatus('DISCONNECTED');
      setIsConnected(false);
      setIsAuthenticated(false);
      setSessionUser(null);
      setQrCode('');
      setIsChecking(false);
      setCooldownActive(false);
      setScanState('IDLE');
      setActiveJobId(null);
      activeJobIdRef.current = null;
      // No automatic reconnection. The user must explicitly re-initiate the QR flow.
      addLog('WebSocket connection lost. Please reconnect to continue.', 'warn');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, [addLog, startPing, stopPing, sendMessage, clearAllState]);

  connectRef.current = connectWebSocket;

  // Initial mount
  useEffect(() => {
    if (connectRef.current) connectRef.current();

    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

    fetch(`${backendUrl}/api/status`)
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
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const logout = async () => {
    setIsLoggingOut(true);

    // Halt all background processes immediately
    stopPing();
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);

    // Kill any active bulk-check / scan on the backend
    sendMessage({ type: 'stop_bulk_check' });
    sendMessage({ type: 'cancel_qr' });

    // Tell the backend to tear down and invalidate the WhatsApp session
    sendMessage({ type: 'logout' });
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

    // Wipe all cross-step window globals so stale data never leaks into a new session
    delete window.whatsappShieldAudience;
    delete window.whatsappShieldCountryCode;
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
