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
  const [previouslyConnected, setPreviouslyConnected] = useState([]);

  // App State
  const [systemLogs, setSystemLogs] = useState([]);
  const [isChecking, setIsChecking] = useState(false);

  // Bulk Checking Stats
  const [totalToCheck, setTotalToCheck] = useState(0);
  const [checkedCount, setCheckedCount] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentCheckingNum, setCurrentCheckingNum] = useState('');
  const [resultsList, setResultsList] = useState([]);

  // Cool-down State
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);

  // Campaign History
  const [campaignHistory, setCampaignHistory] = useState([]);

  // Restore state
  const [restoreFailed, setRestoreFailed] = useState(false);

  // Loading states
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Toast messages for auto-restore
  const autoRestoreAttemptedRef = useRef(false);

  // --- Feature States ---
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [connectionStable, setConnectionStable] = useState(true);
  const [isIdle, setIsIdle] = useState(false);
  const [lastActiveTime, setLastActiveTime] = useState(Date.now());

  // WebSocket Reference
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(1000);
  const wasConnectedBeforeOffline = useRef(false);
  const lastConnectedPhone = useRef(localStorage.getItem('ws_shield_last_phone') || '');
  const activityTimerRef = useRef(null);
  const sessionUserRef = useRef(sessionUser);

  const addLog = (text, type = 'info') => {
    setSystemLogs(prev => {
      const newLogs = [...prev, { time: new Date().toLocaleTimeString(), text, type }];
      if (newLogs.length > 200) return newLogs.slice(-200);
      return newLogs;
    });
  };

  // Keeps reconnection from re-authenticating after explicit logout
  const manualLogoutRef = useRef(false);

  // Keep sessionUserRef in sync with state to avoid stale closures
  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);

  // Allow Step1Auth to reset the manual-logout guard before sending auth messages
  const setManualLogoutFalse = useCallback(() => {
    manualLogoutRef.current = false;
  }, []);

  const sendMessage = useCallback((msg) => {
    // User-initiated auth actions should always clear the logout guard
    if (msg.type === 'generate_qr' || msg.type === 'restore_session') {
      manualLogoutRef.current = false;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('WS not open, cannot send:', msg.type);
    }
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
  }, []);

  const clearAllState = useCallback(() => {
    setStatus('DISCONNECTED');
    setIsConnected(false);
    setIsAuthenticated(false);
    setSessionUser(null);
    setQrCode('');
    setSystemLogs([]);
    clearScanState();
    setCampaignHistory([]);
    setRestoreFailed(false);
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
      wasConnectedBeforeOffline.current = isConnected || isAuthenticated;
      addLog('Internet connection lost.', 'warn');
    };
    const goOnline = () => {
      setIsOffline(false);
      addLog('Internet connection restored.', 'success');
      if (wasConnectedBeforeOffline.current) {
        reconnectDelayRef.current = 1000;
        if (connectRef.current) connectRef.current();
      }
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
      reconnectDelayRef.current = 1000;
      addLog('WebSocket connection to WhatsApp Shield established.', 'status');
      startPing();

      // Auto-restore: always attempt if we have a saved phone (handles hard refresh + reconnect)
      if (lastConnectedPhone.current) {
        console.log('Auto-restoring session for phone:', lastConnectedPhone.current);
        autoRestoreAttemptedRef.current = true;
        sendMessage({ type: 'restore_session', phone: lastConnectedPhone.current });
      }
      wasConnectedBeforeOffline.current = false;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS RECEIVED:', data.type, data);

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
            setStatus(data.status);
            setIsConnected(data.status === 'CONNECTED');
            if (data.status === 'CONNECTED') {
              // Reset logout guard on successful connection
              manualLogoutRef.current = false;
              if (!manualLogoutRef.current) {
                setIsAuthenticated(true);
                setRestoreFailed(false);
              }
              if (data.user?.number) {
                const cleanNum = data.user.number.replace(/\D/g, '');
                lastConnectedPhone.current = cleanNum;
                localStorage.setItem('ws_shield_last_phone', cleanNum);
              }
            }
            if (data.status === 'DISCONNECTED') {
              setIsAuthenticated(false);
              setSessionUser(null);
              setQrCode('');
              lastConnectedPhone.current = '';
              localStorage.removeItem('ws_shield_last_phone');
            }
            if (data.status === 'QR_CODE') {
              manualLogoutRef.current = false;
              if (data.restoreFailed) {
                setRestoreFailed(true);
              } else {
                setRestoreFailed(false);
              }
            }
            setQrCode(data.qr || '');
            setSessionUser(data.user || null);
            if (data.previouslyConnected) {
              setPreviouslyConnected(data.previouslyConnected);
            }
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
            }
            break;

          case 'connection_success':
            if (!manualLogoutRef.current) {
              setIsAuthenticated(true);
              setRestoreFailed(false);
            }
            if (data.user) {
              setSessionUser(data.user);
            }
            addLog('Session restored successfully.', 'success');
            if (autoRestoreAttemptedRef.current) {
              showToast('Session restored automatically.', 'success');
              autoRestoreAttemptedRef.current = false;
            }
            break;

          case 'restore_failed':
            setRestoreFailed(true);
            addLog('Session restore failed — QR code ready for fresh scan.', 'warn');
            if (autoRestoreAttemptedRef.current) {
              showToast('Could not restore session automatically — please scan QR again', 'error');
              autoRestoreAttemptedRef.current = false;
            }
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

          case 'SESSION_DELETED':
            if (data.success) {
              if (data.previouslyConnected) {
                setPreviouslyConnected(data.previouslyConnected);
              }
              if (data.soft) {
                // BUGFIX: Soft delete — only removed from history list, auth/session intact
                addLog(`Session reference removed from history (${data.phone}).`, 'info');
                showToast('Session removed from history.', 'success');
              } else if (data.disconnected) {
                setStatus('DISCONNECTED');
                setIsConnected(false);
                setIsAuthenticated(false);
                setSessionUser(null);
                setQrCode('');
                addLog(`Session ${data.phone} deleted.`, 'info');
                showToast('Session deleted successfully.', 'success');
              } else {
                addLog(`Session ${data.phone} removed.`, 'info');
                showToast('Session removed.', 'success');
              }
            } else {
              addLog(`Failed to delete session: ${data.error}`, 'error');
              showToast('Failed to delete session.', 'error');
            }
            break;

          case 'LOGOUT_RESULT':
            if (data.success) {
              clearAllState();
              lastConnectedPhone.current = '';
              localStorage.removeItem('ws_shield_last_phone');
              addLog('Logged out successfully.', 'info');
            } else {
              addLog(`Logout failed: ${data.error}`, 'error');
            }
            break;

          case 'BULK_CHECK_START':
            setIsChecking(true);
            setTotalToCheck(data.total);
            setCheckedCount(0);
            setProgressPercent(0);
            setResultsList([]);
            addLog(`Started validation of ${data.total} numbers`, 'status');
            break;

          case 'BULK_CHECK_PROGRESS':
            {
              setCheckedCount(data.index + 1);
              setProgressPercent(Math.round(((data.index + 1) / data.total) * 100));
              setCurrentCheckingNum(data.result.number);
              setResultsList(prev => [...prev, data.result]);
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
            setCooldownActive(true);
            addLog(data.message, 'warn');
            break;

          case 'BULK_CHECK_COMPLETE':
            setIsChecking(false);
            setProgressPercent(100);
            setCooldownActive(false);
            addLog(`Validation complete. Processed ${data.resultsCount} numbers.`, 'status');
            {
              const phone = sessionUserRef.current?.number?.replace(/\D/g, '') || lastConnectedPhone.current;
              if (phone) {
                setTimeout(() => sendMessage({ type: 'get_history', phone }), 300);
              }
            }
            break;

          case 'BULK_CHECK_INTERRUPTED':
            setIsChecking(false);
            setCooldownActive(false);
            addLog(`Validation interrupted: ${data.reason}`, 'error');
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
      console.log('WebSocket disconnected');
      setConnectionStable(false);
      stopPing();
      addLog('WebSocket connection lost. Reconnecting...', 'warn');
      const offline = !navigator.onLine;
      if (!offline) {
        const delay = Math.min(reconnectDelayRef.current, 30000);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (connectRef.current) connectRef.current();
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
        }, delay);
      }
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
        setStatus(data.status);
        setIsConnected(data.status === 'CONNECTED');
        if (data.status === 'CONNECTED') {
          setIsAuthenticated(true);
          if (data.user?.number) {
            lastConnectedPhone.current = data.user.number.replace(/\D/g, '');
          }
        }
        if (data.qr) setQrCode(data.qr);
        if (data.user) setSessionUser(data.user);
        if (data.previouslyConnected) setPreviouslyConnected(data.previouslyConnected);
      })
      .catch(err => {
        console.warn("Failed to fetch initial status via API, falling back to WS", err);
      });

    // Restore last active time from localStorage
    const saved = localStorage.getItem('ws_shield_last_active');
    if (saved) setLastActiveTime(Number(saved));

    return () => {
      stopPing();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const logout = async () => {
    manualLogoutRef.current = true;
    setIsLoggingOut(true);
    sendMessage({ type: 'logout' });
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${backendUrl}/api/logout`, { method: 'POST' });
    } catch (err) {
      console.error('REST logout failed:', err);
    }
    clearAllState();
    lastConnectedPhone.current = '';
    localStorage.removeItem('ws_shield_last_phone');
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
      previouslyConnected,
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
      cooldownActive,
      cooldownTimeLeft,
      campaignHistory,
      setCampaignHistory,
      restoreFailed,
      setRestoreFailed,
      addLog,
      logout,
      connectWebSocket,
      sendMessage,
      setManualLogoutFalse,
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
