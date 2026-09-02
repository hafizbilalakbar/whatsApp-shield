import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Activity, StopCircle, CheckCircle2, Shield, BarChart3, Sparkles, ArrowDown, Pause, Play, CloudOff, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { useTheme } from '../../context/ThemeProvider';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Progress } from '../ui/Progress';
import { Badge } from '../ui/Badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/AlertDialog';
import { cn } from '../ui/cn';
import { DEFAULT_COUNTRY_CODE } from '../../data/countries';

const CONFETTI_COLORS = ['#00D97E', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6', '#FF6B6B', '#48D1CC', '#FFE66D'];

const Step4Scanning = ({ onNext }) => {
  const { resolvedTheme } = useTheme();
  const { 
    systemLogs, 
    setSystemLogs,
    isChecking, 
    totalToCheck, 
    checkedCount, 
    progressPercent, 
    currentCheckingNum,
    cooldownActive,
    addLog,
    clearScanState,
    sessionUser,
    resultsList,
    sendMessage,
    status,
    isConnected,
    scanState,
    pauseScan,
    resumeScan,
    stopScan,
    serverScanActive,
    reconcileScanStatus,
    reconcileResolved,
    activeJobId,
    isOffline,
    connectivityPaused
  } = useWebSocket();

  const terminalRef = useRef(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [reportNavigating, setReportNavigating] = useState(false);
  const [confettiPieces] = useState(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 5 + Math.random() * 6
    }))
  );
  const [countUp, setCountUp] = useState({ total: 0, registered: 0, unregistered: 0 });
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [isNewDataset, setIsNewDataset] = useState(false);
  const autoAdvanceRef = useRef(null);
  const countUpIntervalRef = useRef(null);
  const celebrationTimeoutRef = useRef(null);
  const scanTriggeredRef = useRef(false);
  const pendingTimers = useRef([]);

  // Control request gate — prevents double-click / duplicate pause|resume|stop
  // while a control request is in flight. Cleared when the backend confirms the
  // new state (scanState change) or after a safety timeout.
  const [controlPending, setControlPending] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const pendingRef = useRef(false);

  const requestControl = (action, fn) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setControlPending(true);
    setPendingAction(action);
    fn();
    addTimer(() => {
      pendingRef.current = false;
      setPendingAction(null);
      setControlPending(false);
    }, 6000);
  };

  useEffect(() => {
    pendingRef.current = false;
    setPendingAction(null);
    setControlPending(false);
  }, [scanState]);

  // On every mount of the Live Validation screen (navigating back to it from
  // another page), reconcile against the backend's authoritative scan state.
  // This restores the exact current Total / Processed / Registered / Progress
  // for the active scan (if any) instead of showing stale or partial counters,
  // and never restarts the workflow or duplicates the running scan.
  useEffect(() => {
    if (typeof reconcileScanStatus === 'function') {
      reconcileScanStatus();
    }
    // Run on mount only; subsequent live WS events and provider-side
    // reconciliation keep it synchronized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track all one-off timers so nothing fires after the component unmounts
  // (prevents state updates on a detached component + timer accumulation).
  const addTimer = useRef((fn, ms) => {
    const t = setTimeout(fn, ms);
    pendingTimers.current.push(t);
    return t;
  }).current;

  useEffect(() => {
    return () => {
      pendingTimers.current.forEach(t => clearTimeout(t));
      pendingTimers.current = [];
      if (countUpIntervalRef.current) clearInterval(countUpIntervalRef.current);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  // Auto-scroll to bottom — only on new logs, respects manual scroll. Keyed on
  // the latest log's sequence number (not the array length) so auto-scroll keeps
  // working even after the capped terminal (200 lines) stops growing.
  const programmaticScrollRef = useRef(false);
  const lastLogSeq = systemLogs.length > 0 ? systemLogs[systemLogs.length - 1].seq : 0;
  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;
    if (!userScrolledUp) {
      programmaticScrollRef.current = true;
      el.scrollTop = el.scrollHeight;
    }
  }, [lastLogSeq]);

  // Handle scroll events — ignore programmatic scrolls
  const handleScroll = () => {
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false;
      return;
    }
    const el = terminalRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setUserScrolledUp(!atBottom);
  };

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      setUserScrolledUp(false);
    }
  };

  const stats = useMemo(() => {
    const total = resultsList.length;
    const registered = resultsList.filter(r => r.exists).length;
    const unregistered = resultsList.filter(r => !r.exists && r.isValidFormat).length;
    return { total, registered, unregistered };
  }, [resultsList]);

  const isComplete = scanState === 'COMPLETED';
  const isStopped = scanState === 'STOPPED';
  const isDone = isComplete || isStopped;

  const statusLabel = connectivityPaused
    ? 'CONNECTION LOST'
    : cooldownActive
      ? 'COOLING'
      : scanState;
  const statusColorClass = connectivityPaused
    ? 'text-warning'
    : cooldownActive
    ? 'text-warning'
    : scanState === 'PAUSED' || scanState === 'RESUMING' || scanState === 'STARTING'
      ? 'text-warning'
      : scanState === 'STOPPED'
        ? 'text-error'
        : (scanState === 'SCANNING' || scanState === 'COMPLETED')
          ? 'text-success'
          : 'text-text-muted';

  // Celebration sequence
  useEffect(() => {
    if (isComplete && !showCelebration) {
      setShowCelebration(true);
      const target = stats;
      let frame = 0;
      const totalFrames = 30;
      countUpIntervalRef.current = setInterval(() => {
        frame++;
        const progress = Math.min(frame / totalFrames, 1);
        setCountUp({
          total: Math.round(target.total * progress),
          registered: Math.round(target.registered * progress),
          unregistered: Math.round(target.unregistered * progress)
        });
        if (frame >= totalFrames) {
          clearInterval(countUpIntervalRef.current);
        }
      }, 50);

      celebrationTimeoutRef.current = setTimeout(() => {
        const btn = document.getElementById('view-reports-btn');
        if (btn) {
          btn.classList.add('animate-pulse-glow');
        }
      }, 200);

      autoAdvanceRef.current = setTimeout(() => {
        if (reportNavPendingRef.current) return;
        reportNavPendingRef.current = true;
        onNext();
      }, 3000);
    }
    return () => {
      if (countUpIntervalRef.current) clearInterval(countUpIntervalRef.current);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [isComplete]);

  useEffect(() => {
    // Skip if scan already in progress
    if (isChecking) return;

    // CRITICAL global-scan guard: if the backend reports an active scan (from
    // /api/scan-status reconciliation) OR we are already tracking a live job,
    // NEVER fire a new scan here. This prevents navigating back to the Live
    // Scan (or a page refresh mid-scan) from starting a competing, duplicate
    // scan that corrupts Total / Processed / Registered counters.
    if (serverScanActive || activeJobId) return;

    // Do not auto-start until the authoritative server scan state has been
    // reconciled at least once. Without this, a page refresh or component
    // remount inside the initial reconcile window would see serverScanActive
    // still false and fire a duplicate scan for the persisted audience.
    if (!reconcileResolved) return;

    // A stopped or completed scan must never auto-restart.
    if (scanState === 'STOPPED' || scanState === 'COMPLETED') {
      scanTriggeredRef.current = true;
      return;
    }

    // Scan completed — reset trigger ref for next submission
    if (checkedCount > 0) {
      scanTriggeredRef.current = false;
      return;
    }

    // Guard: don't start if already triggered for this reset cycle
    if (scanTriggeredRef.current) return;

    // The bulk-check API is strictly gated on a live, connected session. If the
    // WhatsApp link dropped (or was never established), surface a clear message
    // instead of firing a doomed request that the server will 409.
    if (status !== 'CONNECTED' || !isConnected) {
      if (!checkedCount && !scanTriggeredRef.current) {
        scanTriggeredRef.current = true;
        addLog('WhatsApp session is not active. Reconnect in Step 1 to continue.', 'error');
        addTimer(() => { scanTriggeredRef.current = false; }, 3000);
      }
      return;
    }

    let numbers = window.whatsappShieldAudience || [];
    const countryCode = window.whatsappShieldCountryCode || DEFAULT_COUNTRY_CODE;
    // Note: countryCode is only metadata (dial code). Report country/campaign
    // name is always derived from each record's detectedCountry (iso code),
    // so no country-code fallback (e.g. '1') is ever applied.
    const settings = window.whatsappShieldSettings || { shieldMode: true, delayMs: 3000 };
    const ownNumber = sessionUser?.number?.replace(/\D/g, '');

    if (numbers.length === 0) return;

    // Mark as triggered to prevent double-fire
    setIsNewDataset(true);
    scanTriggeredRef.current = true;

    // Clear terminal for fresh scan session
    setSystemLogs([]);

    if (ownNumber) {
      const beforeCount = numbers.length;
      numbers = numbers.filter(num => {
        const cleanNum = num.replace(/\D/g, '');
        return cleanNum !== ownNumber;
      });
      const removedCount = beforeCount - numbers.length;
      if (removedCount > 0) {
        addLog(`Safety Guard: Removed ${removedCount} occurrence(s) of your own number from the validation list.`, 'warn');
      }
    }

    if (numbers.length > 0) {
      addLog(`Processing new dataset: ${numbers.length} numbers`, 'status');
      addLog('This session is isolated from previous scan results.', 'info');
      fetch('/api/check-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers,
          phone: ownNumber || '',
          countryCode,
          delayMs: settings.delayMs,
          shieldMode: settings.shieldMode,
          countryIso: window.whatsappShieldCountryIso || null,
          countryName: window.whatsappShieldCountryName || null
        })
      }).then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          addLog(`API Error: ${errData.error || 'Unknown error'}`, 'error');
          return;
        }
        const responseData = await res.json();
        return responseData;
      }).catch(err => {
        addLog(`Failed to start request: ${err.message}`, 'error');
      });

      // Clear new dataset indicator after 3s
      addTimer(() => setIsNewDataset(false), 3000);
    } else {
      addLog('No numbers to validate after safety guard check.', 'error');
    }
  }, [isChecking, checkedCount, status, isConnected, scanState, serverScanActive, activeJobId, reconcileResolved]);

  const handleStop = () => {
    requestControl('stop', stopScan);
    addLog('Stop signal sent to server.', 'warn');
  };

  // Report navigation guard: prevents a rapid double-click (or a race between
  // the auto-advance timer and a manual click) from firing onNext twice. Once a
  // report request is issued, further clicks are ignored until the component
  // remounts with a fresh scan.
  const reportNavPendingRef = useRef(false);
  const handleViewReports = () => {
    if (reportNavPendingRef.current) return;
    if (!isDone) return;
    reportNavPendingRef.current = true;
    setReportNavigating(true);
    // Brief, smooth preparation transition so the report opens without a jarring
    // instant cut. The report itself renders synchronously from resultsList.
    addTimer(() => {
      onNext();
    }, 250);
  };

  const canPause = isChecking && (scanState === 'SCANNING' || scanState === 'STARTING') && !controlPending;
  const canResume = scanState === 'PAUSED' && !controlPending;
  const canStop = isChecking && (scanState === 'SCANNING' || scanState === 'STARTING' || scanState === 'PAUSED') && !controlPending;

  const getLogTypeClass = (type) => {
    switch (type) {
      case 'success': return 'type-success';
      case 'error': return 'type-error';
      case 'warn': return 'type-warn';
      case 'status': return 'type-status';
      default: return 'type-info';
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="absolute inset-0 z-40 pointer-events-none">
          <div className="confetti-container">
            {confettiPieces.map(p => (
              <div
                key={p.id}
                className="confetti-piece"
                style={{
                  left: `${p.left}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  backgroundColor: p.color,
                  width: p.size,
                  height: p.size
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex justify-between items-end relative z-10">
        <div>
          <h2 className="text-2xl font-display font-semibold flex items-center gap-2">
            <ActivityIcon active={scanState === 'SCANNING' || scanState === 'RESUMING' || scanState === 'STARTING'} /> Live Validation Stream
          </h2>
          <p className="text-text-secondary mt-1">Real-time gateway logs and validation status.</p>
        </div>
        <div className="flex items-center gap-3">
          {isNewDataset && (
            <Badge variant="outline" className="font-mono bg-primary/10 border-primary/30 text-primary animate-in fade-in zoom-in-95 duration-200">
              <Activity size={12} className="mr-1.5" /> Processing New Numbers
            </Badge>
          )}
          <Badge variant="outline" className={cn("font-mono bg-surface", (isOffline || connectivityPaused) && "border-warning/40 text-warning")}>
            {isOffline ? (
              <><WifiOff size={12} className="mr-1.5" /> Connection Lost</>
            ) : connectivityPaused ? (
              <><CloudOff size={12} className="mr-1.5" /> Connection Unstable</>
            ) : (
              <><Wifi size={12} className={cn("mr-1.5", "text-success")} /> Connected</>
            )}
          </Badge>
          <Badge variant="outline" className="font-mono bg-surface">
            <Shield size={12} className={cn("mr-1.5", window.whatsappShieldSettings?.shieldMode ? "text-success" : "text-text-muted")} /> 
            Shield: {window.whatsappShieldSettings?.shieldMode ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        </div>
      </div>

      {/* Paused / Resuming banner */}
      {(scanState === 'PAUSED' || scanState === 'RESUMING') && !connectivityPaused && (
        <div className="relative z-20 mb-4 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {scanState === 'PAUSED' ? <Pause size={18} className="text-warning shrink-0" /> : <Play size={18} className="text-warning shrink-0" />}
          <div className="text-sm">
            <span className="font-semibold text-warning">{scanState === 'PAUSED' ? 'Scan paused' : 'Resuming scan'}.</span>{' '}
            <span className="text-text-secondary">
              {scanState === 'PAUSED'
                ? `Frozen at ${checkedCount} of ${totalToCheck || window.whatsappShieldAudience?.length || 0} — resume to continue from the exact position.`
                : 'Preparing to continue from the saved position...'}
            </span>
          </div>
        </div>
      )}

      {/* Connectivity / Internet-loss banner — shown while the scanner is alive but
          blocked waiting for the internet/WhatsApp gateway to recover. Non-intrusive,
          does not touch the session, campaign, or any validated results. */}
      {(isOffline || connectivityPaused) && (isChecking || connectivityPaused) && (
        <div className="relative z-20 mb-4 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <CloudOff size={18} className="text-warning shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-warning">{isOffline ? 'Internet connection lost.' : 'Connection unstable.'}</span>{' '}
            <span className="text-text-secondary">
              Live scanning is paused until your connection is restored. Your session, campaign, and all validated numbers are safely preserved — validation will resume automatically from the exact same position.
            </span>
          </div>
        </div>
      )}

      {/* Stopped / partial-result banner */}
      {isStopped && (
        <div className="relative z-20 mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <StopCircle size={18} className="text-error shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-error">Scan stopped.</span>{' '}
            <span className="text-text-secondary">
              {stats.total} partial result(s) processed ({stats.registered} registered, {stats.unregistered} unregistered). Review and export them below.
            </span>
          </div>
        </div>
      )}

      {/* Celebration Card */}
      {showCelebration && (
        <div className="relative z-30 mb-6 celebration-card">
          <div className={cn(
            "rounded-xl border border-success/30 p-4 md:p-6 glow-pulse-green",
            resolvedTheme === 'dark' ? 'bg-[#0A1520]' : 'bg-white'
          )}>
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <div className="relative">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle2 size={28} className="md:w-8 md:h-8 text-success" />
                </div>
                <Sparkles size={16} className="absolute -top-1 -right-1 text-warning animate-pulse" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg md:text-xl font-display font-bold text-success">Validation Complete!</h3>
                <p className="text-sm text-text-secondary">All numbers have been processed successfully.</p>
                <div className="auto-advance-bar mt-3 max-w-[200px]" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 md:mt-6">
              <div className={cn("text-center p-3 rounded-lg border", resolvedTheme === 'dark' ? 'bg-[#020B06] border-[#1F2937]' : 'bg-gray-50 border-gray-200')}>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Scanned</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-text-primary">{countUp.total}</div>
              </div>
              <div className={cn("text-center p-3 rounded-lg border", resolvedTheme === 'dark' ? 'bg-[#020B06] border-[#1F2937]' : 'bg-gray-50 border-gray-200')}>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Registered</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-success">{countUp.registered}</div>
              </div>
              <div className={cn("text-center p-3 rounded-lg border", resolvedTheme === 'dark' ? 'bg-[#020B06] border-[#1F2937]' : 'bg-gray-50 border-gray-200')}>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Not Registered</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-error">{countUp.unregistered}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-0 relative z-10">
        
        {/* Stats Cards (Mobile: 2x2 grid at top, Desktop: right sidebar) */}
        <div className="w-full lg:w-[35%] flex flex-row lg:flex-col gap-3 order-first lg:order-none">
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-1 gap-3">
            <Card>
              <CardContent className="p-3 md:p-4">
                <div className="text-xs text-text-secondary mb-1">Total Numbers</div>
                <div className="text-xl md:text-2xl font-mono font-bold">{totalToCheck || window.whatsappShieldAudience?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:p-4">
                <div className="text-xs text-text-secondary mb-1">Processed</div>
                <div className="text-xl md:text-2xl font-mono font-bold text-primary">{checkedCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:p-4">
                <div className="text-xs text-text-secondary mb-1">Registered Numbers</div>
                <div className="text-xl md:text-2xl font-mono font-bold text-success">{stats.registered}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:p-4">
                <div className="text-xs text-text-secondary mb-1">Current</div>
                <div className="text-sm md:text-lg font-mono font-bold truncate">{currentCheckingNum || '---'}</div>
              </CardContent>
            </Card>
            <Card className={cn("transition-colors", (cooldownActive || scanState === 'PAUSED' || scanState === 'RESUMING' || scanState === 'STARTING') && "bg-warning/10 border-warning/50", scanState === 'STOPPED' && "bg-error/10 border-error/50")}>
              <CardContent className="p-3 md:p-4">
                <div className="text-xs text-text-secondary mb-1">Status</div>
                <div className={cn("text-sm md:text-lg font-mono font-bold", statusColorClass)}>
                  {statusLabel}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Terminal */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-mono">
              <span>Progress</span>
              <span className={cn(progressPercent === 100 && "text-success")}>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Terminal Container — fixed height, never grows */}
          <div className={cn(
            "terminal-container flex flex-col h-[300px] lg:h-[420px]",
            resolvedTheme === 'light' ? 'light-border' : ''
          )}>
            {/* Matrix Background — clean glyphs only */}
            <div className="terminal-matrix-bg" aria-hidden="true" />

            {/* Scanline Overlay */}
            <div className="terminal-scanline" />

            {/* Glow Line */}
            <div className="terminal-glow-line" />

            {/* Terminal Header */}
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot amber" />
              <div className="terminal-dot green" />
              <span className="terminal-title">shield-gateway.log</span>
              <div className="terminal-live">
                <span className="terminal-live-dot" />
                LIVE
              </div>
            </div>

            {/* Terminal Screen — fills remaining space inside fixed container, scrolls internally */}
            <div
              ref={terminalRef}
              onScroll={handleScroll}
              className="terminal-screen"
            >
              {systemLogs.map(log => (
                <div
                  key={log.seq}
                  className={cn(
                    "terminal-log-line",
                    getLogTypeClass(log.type)
                  )}
                >
                  <span className="timestamp">[{log.time}]</span>
                  {log.text}
                </div>
              ))}
              {systemLogs.length > 0 && (
                <span className="terminal-cursor" />
              )}
            </div>

            {/* Jump to Latest Button */}
            {userScrolledUp && (
              <button
                onClick={scrollToBottom}
                className="terminal-scroll-btn"
              >
                <ArrowDown size={12} className="inline mr-1" />
                Jump to Latest
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 relative z-10">
        <div className="flex gap-3 w-full sm:w-auto">
          <Button
            onClick={() => requestControl('pause', pauseScan)}
            disabled={!canPause}
            loading={controlPending && pendingAction === 'pause'}
            className="bg-amber-500 hover:bg-amber-400 text-white shadow-sm hover:shadow active:translate-y-px active:scale-[0.98] transition-all duration-150 w-full sm:w-auto focus-visible:ring-amber-400"
          >
            <Pause size={16} className="mr-2" /> Pause
          </Button>

          <Button
            onClick={() => requestControl('resume', resumeScan)}
            disabled={!canResume}
            loading={controlPending && pendingAction === 'resume'}
            className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm hover:shadow active:translate-y-px active:scale-[0.98] transition-all duration-150 w-full sm:w-auto focus-visible:ring-emerald-400"
          >
            <Play size={16} className="mr-2" /> Resume
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto active:translate-y-px active:scale-[0.98] transition-all duration-150" disabled={!canStop} loading={controlPending && pendingAction === 'stop'}>
                <StopCircle size={16} className="mr-2" /> Stop
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop Validation Process?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently terminate the scan and save all results processed so far as a partial report.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleStop} className="bg-error hover:bg-error/90 text-white">Confirm Stop</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        <Button 
          id="view-reports-btn"
          className={cn(
            "w-full sm:w-auto px-6 md:px-8 transition-all duration-300 relative",
            isComplete && "shimmer-button shadow-[0_0_20px_rgba(0,217,126,0.3)]"
          )}
          onClick={handleViewReports}
          disabled={!isDone || reportNavPendingRef.current}
          loading={reportNavigating}
          variant={isDone ? "default" : "secondary"}
        >
          {isComplete ? (
            <><BarChart3 size={16} className="mr-2" /> View Reports <CheckCircle2 size={16} className="ml-2" /></>
          ) : isStopped ? (
            <><BarChart3 size={16} className="mr-2" /> View Partial Reports</>
          ) : (
            <>Waiting for completion...</>
          )}
        </Button>
      </div>

    </div>
  );
};

const ActivityIcon = ({ active }) => (
  <div className="relative w-6 h-6 flex items-center justify-center">
    <Activity size={24} className="text-primary relative z-10" />
    {active && (
      <span className="absolute inset-[-4px] animate-ping rounded-full bg-primary/20" />
    )}
  </div>
);

export default Step4Scanning;
