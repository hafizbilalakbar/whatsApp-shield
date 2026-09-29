import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Activity, Square, CheckCircle2, Shield, ShieldCheck, BarChart3, Sparkles, ArrowDown,
  Pause, Play, CloudOff, Wifi, WifiOff, Users, Camera, Timer, Gauge, ListFilter
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { useTheme } from '../../context/ThemeProvider';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Progress } from '../ui/Progress';
import { Badge } from '../ui/Badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/AlertDialog';
import ResultAvatar from '../ResultAvatar';
import FlagIcon from '../ui/FlagIcon';
import { useCountUp } from '../../hooks/useCountUp';
import { cn } from '../ui/cn';
import { DEFAULT_COUNTRY_CODE } from '../../data/countries';

const CONFETTI_COLORS = ['#00D97E', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6', '#FF6B6B', '#48D1CC', '#FFE66D'];

// Hard cap on rendered feed rows so a long run can never grow the DOM without
// bound. The full result set still lives in resultsList for the report/export.
const LEADS_RENDER_CAP = 60;

const hasPhoto = (result) => !!result && (result.profilePhotoAvailable === true || !!result.avatar);

const formatClock = (ms) => {
  if (!ms || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

const formatSpeed = (perMinute) => {
  if (!perMinute || !isFinite(perMinute)) return '—';
  if (perMinute < 1) return '<1 / min';
  return `${perMinute.toFixed(perMinute >= 10 ? 0 : 1)} / min`;
};

const formatNumber = (result) => {
  const raw = result?.formatted || result?.cleanNumber || result?.number || result?.jid || '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return String(raw || '');
  const core = digits.length > 10 ? digits.slice(-10) : digits;
  return `+${digits.slice(0, digits.length - core.length)}${core.replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3')}`.trim();
};

const resultOutcome = (result) => {
  if (result?.exists === true) return { label: 'Active', tone: 'success' };
  if (result?.isValidFormat) return { label: 'Not registered', tone: 'muted' };
  return { label: 'Invalid', tone: 'error' };
};

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
    sessionUser,
    resultsList,
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
  const leadsRef = useRef(null);
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

  // ---------------------------------------------------------------------
  // Run context
  // The Shield pill used to read window.whatsappShieldSettings during render,
  // which is undefined after a refresh or a direct jump to this step — so an
  // actively shielded run still displayed "Shield: INACTIVE". The settings are
  // now snapshotted at the moment the scan is actually fired (the same object
  // that is posted to /api/check-bulk), and refreshed from the global whenever
  // the user changes it before starting.
  // ---------------------------------------------------------------------
  const [runMeta, setRunMeta] = useState(() => ({
    shieldMode: !!(window.whatsappShieldSettings && window.whatsappShieldSettings.shieldMode),
    countryName: window.whatsappShieldCountryName || '',
    countryIso: window.whatsappShieldCountryIso || '',
    regionName: (window.whatsappShieldRegion && window.whatsappShieldRegion.name) || '',
  }));

  const syncRunMetaFromGlobals = (settings) => {
    setRunMeta({
      shieldMode: settings ? !!settings.shieldMode : !!window.whatsappShieldSettings?.shieldMode,
      countryName: window.whatsappShieldCountryName || '',
      countryIso: window.whatsappShieldCountryIso || '',
      regionName: (window.whatsappShieldRegion && window.whatsappShieldRegion.name) || '',
    });
  };

  // Keep the header in sync when the operator changes Shield before starting.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSettingsChange = () => syncRunMetaFromGlobals(window.whatsappShieldSettings);
    window.addEventListener('whatsapp-shield-settings-change', onSettingsChange);
    return () => window.removeEventListener('whatsapp-shield-settings-change', onSettingsChange);
  }, []);

  // Elapsed / speed / ETA. A one-second ticker only runs while scanning, and
  // time spent paused is excluded so the throughput estimate stays honest.
  const [now, setNow] = useState(() => Date.now());
  const scanStartedAtRef = useRef(null);
  const pausedAccumRef = useRef(0);
  const pausedAtRef = useRef(null);

  useEffect(() => {
    if (isChecking && !scanStartedAtRef.current) scanStartedAtRef.current = Date.now();
  }, [isChecking]);

  useEffect(() => {
    if (!isChecking) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isChecking]);

  useEffect(() => {
    const isPaused = scanState === 'PAUSED' || scanState === 'STOPPED';
    if (isPaused && !pausedAtRef.current) pausedAtRef.current = Date.now();
    if (!isPaused && pausedAtRef.current) {
      pausedAccumRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [scanState]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track all one-off timers so nothing fires after the component unmounts.
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

  const photoCount = useMemo(() => resultsList.filter(hasPhoto).length, [resultsList]);

  const isComplete = scanState === 'COMPLETED';
  const isStopped = scanState === 'STOPPED';
  const isDone = isComplete || isStopped;

  const effectiveTotal = totalToCheck || window.whatsappShieldAudience?.length || 0;
  const remainingCount = Math.max(0, effectiveTotal - checkedCount);

  const activePause = pausedAtRef.current;
  const elapsedMs = scanStartedAtRef.current
    ? Math.max(0, now - scanStartedAtRef.current - pausedAccumRef.current - (activePause ? now - activePause : 0))
    : 0;
  const elapsedMinutes = elapsedMs / 60000;
  const speedPerMinute = elapsedMinutes > 0.02 ? checkedCount / elapsedMinutes : 0;
  const etaMs = isDone ? 0 : (speedPerMinute > 0 ? (remainingCount / speedPerMinute) * 60000 : null);

  const registeredAnimated = useCountUp(stats.registered);
  const photoAnimated = useCountUp(photoCount);

  const effectiveStatus = connectivityPaused
    ? 'CONNECTION LOST'
    : cooldownActive
      ? 'COOLING'
      : scanState;

  const statusLabel = {
    IDLE: 'Idle',
    STARTING: 'Starting',
    SCANNING: 'Scanning',
    COOLING: 'Cooling down',
    PAUSED: 'Paused',
    RESUMING: 'Resuming',
    COMPLETED: 'Complete',
    STOPPED: 'Stopped',
    'CONNECTION LOST': 'Connection lost',
  }[effectiveStatus] || effectiveStatus;

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
    // NEVER fire a new scan here.
    if (serverScanActive || activeJobId) return;

    // Do not auto-start until the authoritative server scan state has been
    // reconciled at least once.
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

    // The bulk-check API is strictly gated on a live, connected session.
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
    const settings = window.whatsappShieldSettings || { shieldMode: true, delayMs: 3000 };
    const ownNumber = sessionUser?.number?.replace(/\D/g, '');

    if (numbers.length === 0) return;

    // Freeze the run context so the header reflects what this scan is actually
    // doing, even if the operator navigates away and back.
    syncRunMetaFromGlobals(settings);

    // Mark as triggered to prevent double-fire
    setIsNewDataset(true);
    scanTriggeredRef.current = true;
    scanStartedAtRef.current = Date.now();
    pausedAccumRef.current = 0;
    pausedAtRef.current = null;

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
          // Random variation (0-100%). The backend re-validates and clamps
          // this; it drives the per-check randomization band.
          jitter: typeof settings.jitter === 'number' ? settings.jitter : 50,
          countryIso: window.whatsappShieldCountryIso || null,
          countryName: window.whatsappShieldCountryName || null,
          regionName: (window.whatsappShieldRegion && window.whatsappShieldRegion.name) || null,
          regionPrefix: (window.whatsappShieldRegion && window.whatsappShieldRegion.prefix) || null,
          audienceType: window.whatsappShieldAudienceType || null
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

  // ---------------------------------------------------------------------
  // Live Leads feed
  // ---------------------------------------------------------------------
  const [leadsFilter, setLeadsFilter] = useState('all');
  const [leadsScrolledAway, setLeadsScrolledAway] = useState(false);

  const leadsRows = useMemo(() => {
    // resultsList is appended oldest-first, so reverse for a newest-first feed.
    const newestFirst = resultsList.slice().reverse();
    if (leadsFilter === 'leads') return newestFirst.filter(r => r.exists);
    if (leadsFilter === 'photo') return newestFirst.filter(r => r.exists && hasPhoto(r));
    return newestFirst;
  }, [resultsList, leadsFilter]);

  const visibleLeads = useMemo(() => leadsRows.slice(0, LEADS_RENDER_CAP), [leadsRows]);

  const filterCounts = useMemo(() => ({
    all: resultsList.length,
    leads: stats.registered,
    photo: photoCount,
  }), [resultsList.length, stats.registered, photoCount]);

  // Newest results appear at the top; follow them unless the user scrolled away.
  useEffect(() => {
    if (!leadsScrolledAway && leadsRef.current) leadsRef.current.scrollTop = 0;
  }, [leadsRows.length, leadsScrolledAway]);

  const handleLeadsScroll = () => {
    const el = leadsRef.current;
    if (!el) return;
    setLeadsScrolledAway(el.scrollTop > 24);
  };

  const jumpToNewestLead = () => {
    if (leadsRef.current) leadsRef.current.scrollTop = 0;
    setLeadsScrolledAway(false);
  };

  const handleStop = () => {
    requestControl('stop', stopScan);
    addLog('Stop signal sent to server.', 'warn');
  };

  // Report navigation guard: prevents a rapid double-click (or a race between
  // the auto-advance timer and a manual click) from firing onNext twice.
  const reportNavPendingRef = useRef(false);
  const handleViewReports = () => {
    if (reportNavPendingRef.current) return;
    if (!isDone) return;
    reportNavPendingRef.current = true;
    setReportNavigating(true);
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

  const shieldActive = runMeta.shieldMode;
  const regionLabel = runMeta.countryName || 'All countries';
  const isScanningNow = isChecking && !isDone;

  return (
    <TooltipProvider delayDuration={200}>
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

      {/* Header */}
      <div className="mb-5 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-3 relative z-10">
        <div className="min-w-0">
          <h2 className="text-2xl font-display font-semibold flex items-center gap-2">
            <ActivityIcon active={scanState === 'SCANNING' || scanState === 'RESUMING' || scanState === 'STARTING'} /> Live Validation Stream
          </h2>
          <p className="text-text-secondary mt-1 flex items-center gap-2 flex-wrap">
            <span>Checking every number against WhatsApp as it arrives.</span>
            <span className="inline-flex items-center gap-1.5 text-text-primary font-medium">
              <FlagIcon code={runMeta.countryIso || ''} size={16} className="shrink-0" />
              <span className="truncate">{regionLabel}</span>
              {runMeta.regionName && (
                <>
                  <span className="text-text-muted" aria-hidden="true">/</span>
                  <span className="truncate">{runMeta.regionName}</span>
                </>
              )}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isNewDataset && (
            <Badge variant="outline" className="font-mono bg-primary/10 border-primary/30 text-primary animate-in fade-in zoom-in-95 duration-200">
              <Activity size={12} className="mr-1.5" /> Processing New Numbers
            </Badge>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono bg-surface gap-1.5",
                    (isOffline || connectivityPaused) && "border-warning/40 text-warning"
                  )}
                >
                  {isOffline ? (
                    <><WifiOff size={12} /> Connection Lost</>
                  ) : connectivityPaused ? (
                    <><CloudOff size={12} /> Connection Unstable</>
                  ) : (
                    <><Wifi size={12} className="text-success" /> Connected</>
                  )}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {isOffline || connectivityPaused
                ? 'Validation is paused and will resume automatically when the connection is restored.'
                : 'Connected to the WhatsApp gateway.'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono bg-surface gap-1.5",
                    shieldActive ? "border-primary/40 text-primary" : "text-text-muted"
                  )}
                >
                  {shieldActive ? <ShieldCheck size={12} /> : <Shield size={12} />}
                  {shieldActive ? 'Shield On' : 'Shield Off'}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {shieldActive
                ? 'Randomised pauses are active for this run, which makes the traffic pattern look natural.'
                : 'Fixed, evenly spaced pauses are used for this run.'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono bg-surface gap-1.5",
                    isScanningNow && "border-primary/40 text-primary",
                    isDone && !isStopped && "border-success/40 text-success",
                    isStopped && "border-error/40 text-error",
                    connectivityPaused && "border-warning/40 text-warning"
                  )}
                >
                  {isScanningNow && <span className="live-pill-dot" aria-hidden="true" />}
                  {statusLabel}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>Current status of this validation run.</TooltipContent>
          </Tooltip>
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
                ? `Frozen at ${checkedCount} of ${effectiveTotal} — resume to continue from the exact position.`
                : 'Preparing to continue from the saved position...'}
            </span>
          </div>
        </div>
      )}

      {/* Connectivity / Internet-loss banner */}
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
          <Square size={18} className="text-error shrink-0 fill-error" />
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4 relative z-10">
        <StatCard label="Total Numbers" value={effectiveTotal.toLocaleString()} />
        <StatCard label="Processed" value={checkedCount.toLocaleString()} tone="primary" />
        <StatCard label="Registered" value={registeredAnimated.toLocaleString()} tone="success" icon={<Users size={12} />} />
        <StatCard label="Current Number" value={currentCheckingNum || '—'} mono={false} />
        <StatCard
          label="Status"
          value={statusLabel}
          tone={statusColorClass.replace('text-', '')}
          mono={false}
        />
      </div>

      {/* Live leads + terminal */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-grow min-h-0 relative z-10">

        {/* Live Leads */}
        <Card className="lg:w-[58%] flex flex-col min-h-0 overflow-hidden">
          <div className="live-leads-header">
            <div className="flex items-center gap-2 min-w-0">
              <Users size={14} className="text-primary shrink-0" />
              <h3 className="text-sm font-semibold truncate">Live Results</h3>
              {isScanningNow && <span className="live-pill-dot" aria-hidden="true" />}
            </div>
            <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Filter results">
              <FilterPill
                active={leadsFilter === 'all'}
                onClick={() => setLeadsFilter('all')}
                icon={<ListFilter size={11} />}
                label="All"
                count={filterCounts.all}
              />
              <FilterPill
                active={leadsFilter === 'leads'}
                onClick={() => setLeadsFilter('leads')}
                icon={<Users size={11} />}
                label="Leads"
                count={filterCounts.leads}
              />
              <FilterPill
                active={leadsFilter === 'photo'}
                onClick={() => setLeadsFilter('photo')}
                icon={<Camera size={11} />}
                label="With Photo"
                count={filterCounts.photo}
              />
            </div>
          </div>

          <div className="live-leads-counters">
            <div className="live-leads-counter">
              <span className="live-leads-counter-value text-success">{registeredAnimated.toLocaleString()}</span>
              <span className="live-leads-counter-label">Active accounts</span>
            </div>
            <div className="live-leads-counter">
              <span className="live-leads-counter-value">{photoAnimated.toLocaleString()}</span>
              <span className="live-leads-counter-label">Profile photos</span>
            </div>
            <div className="live-leads-counter">
              <span className="live-leads-counter-value">{stats.unregistered.toLocaleString()}</span>
              <span className="live-leads-counter-label">Not registered</span>
            </div>
          </div>

          <div className="relative flex-1 min-h-0">
            <div
              ref={leadsRef}
              onScroll={handleLeadsScroll}
              className="live-leads-list h-[260px] lg:h-[420px]"
            >
              {visibleLeads.length === 0 ? (
                <div className="live-leads-empty">
                  <div className="live-leads-empty-icon">
                    <Users size={22} />
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    {leadsFilter === 'all' ? 'No results yet' : 'Nothing matches this filter'}
                  </p>
                  <p className="text-xs text-text-muted max-w-[240px]">
                    {leadsFilter === 'all'
                      ? 'Every checked number will appear here the moment the gateway answers.'
                      : 'Try a different filter to see more results.'}
                  </p>
                </div>
              ) : (
                visibleLeads.map((result, idx) => {
                  const outcome = resultOutcome(result);
                  return (
                    <div key={`${result.cleanNumber || result.number || result.jid || idx}-${idx}`} className="live-lead-row">
                      <ResultAvatar result={result} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="live-lead-number font-mono">{formatNumber(result)}</p>
                        <p className="live-lead-meta">
                          {outcome.label}
                          {hasPhoto(result) && (
                            <span className="live-lead-photo-tag">
                              <Camera size={9} /> Photo
                            </span>
                          )}
                        </p>
                      </div>
                      {idx === 0 && isScanningNow && (
                        <span className="live-lead-new-tag" aria-label="Newest result">New</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {leadsScrolledAway && visibleLeads.length > 0 && (
              <button type="button" onClick={jumpToNewestLead} className="terminal-scroll-btn live-leads-jump">
                <ArrowDown size={12} className="inline mr-1 rotate-180" />
                Newest result
              </button>
            )}
          </div>
        </Card>

        {/* Right column: progress + terminal */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-mono">
              <span className="text-text-secondary">Progress</span>
              <span className={cn("flex items-center gap-3", progressPercent === 100 && "text-success")}>
                <span className="text-text-muted">
                  {checkedCount.toLocaleString()} / {effectiveTotal.toLocaleString()}
                </span>
                <span className="font-bold">{progressPercent}%</span>
              </span>
            </div>
            <Progress value={progressPercent} className="h-2.5" />
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <MetricChip icon={<Gauge size={11} />} label="Speed" value={formatSpeed(speedPerMinute)} />
              <MetricChip icon={<Timer size={11} />} label="Elapsed" value={formatClock(elapsedMs)} />
              <MetricChip
                icon={<Timer size={11} />}
                label="Time left"
                value={isDone ? 'Done' : (etaMs === null ? '—' : formatClock(etaMs))}
              />
            </div>
          </div>

          {/* Terminal */}
          <div className={cn(
            "terminal-container flex flex-col flex-1 min-h-0",
            resolvedTheme === 'light' ? 'light-border' : ''
          )}>
            <div className="terminal-matrix-bg" aria-hidden="true" />
            <div className="terminal-scanline" />
            <div className="terminal-glow-line" />

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

            <div ref={terminalRef} onScroll={handleScroll} className="terminal-screen">
              {systemLogs.length === 0 ? (
                <div className="terminal-placeholder">
                  Waiting for gateway events...
                </div>
              ) : (
                systemLogs.map(log => (
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
                ))
              )}
              {systemLogs.length > 0 && (
                <span className="terminal-cursor" />
              )}
            </div>

            {userScrolledUp && (
              <button type="button" onClick={scrollToBottom} className="terminal-scroll-btn">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={() => requestControl('pause', pauseScan)}
                  disabled={!canPause}
                  loading={controlPending && pendingAction === 'pause'}
                  className="bg-amber-500 hover:bg-amber-400 text-white shadow-sm hover:shadow active:translate-y-px active:scale-[0.98] transition-all duration-150 w-full sm:w-auto focus-visible:ring-amber-400"
                >
                  <Pause size={16} className="mr-2" /> Pause
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{canPause ? 'Pause the run and keep your position' : 'Available while the scan is running'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={() => requestControl('resume', resumeScan)}
                  disabled={!canResume}
                  loading={controlPending && pendingAction === 'resume'}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm hover:shadow active:translate-y-px active:scale-[0.98] transition-all duration-150 w-full sm:w-auto focus-visible:ring-emerald-400"
                >
                  <Play size={16} className="mr-2" /> Resume
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{canResume ? 'Continue from where you paused' : 'Available once the scan is paused'}</TooltipContent>
          </Tooltip>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto active:translate-y-px active:scale-[0.98] transition-all duration-150" disabled={!canStop} loading={controlPending && pendingAction === 'stop'}>
                <Square size={15} className="mr-2 fill-current" /> Stop
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

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-full sm:w-auto">
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
                  <><BarChart3 size={16} className="mr-2" /> View Report <CheckCircle2 size={16} className="ml-2" /></>
                ) : isStopped ? (
                  <><BarChart3 size={16} className="mr-2" /> View Partial Report</>
                ) : (
                  <><BarChart3 size={16} className="mr-2" /> View Report</>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isDone ? 'Open the full report for this run' : 'Available when the run finishes or is stopped'}
          </TooltipContent>
        </Tooltip>
      </div>

    </div>
    </TooltipProvider>
  );
};

const StatCard = ({ label, value, tone, icon, mono = true }) => (
  <Card className="scan-stat-card">
    <CardContent className="p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1.5">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("text-xl font-bold truncate", mono && "font-mono", tone)}>{value}</div>
    </CardContent>
  </Card>
);

const MetricChip = ({ icon, label, value }) => (
  <div className="scan-metric-chip">
    <span className="scan-metric-chip-label">
      {icon}
      {label}
    </span>
    <span className="scan-metric-chip-value font-mono">{value}</span>
  </div>
);

const FilterPill = ({ active, onClick, icon, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn('live-leads-filter-pill', active && 'is-active')}
  >
    {icon}
    <span>{label}</span>
    <span className="live-leads-filter-count">{count}</span>
  </button>
);

const ActivityIcon = ({ active }) => (
  <div className="relative w-6 h-6 flex items-center justify-center">
    <Activity size={24} className="text-primary relative z-10" />
    {active && (
      <span className="absolute inset-[-4px] animate-ping rounded-full bg-primary/20" />
    )}
  </div>
);

export default Step4Scanning;
