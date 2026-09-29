import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import {
  Activity, Square, CheckCircle2, Shield, ShieldCheck, BarChart3, Sparkles, ArrowDown,
  Pause, Play, CloudOff, Wifi, WifiOff, Users, Camera, Timer, Gauge, ListFilter, UserCheck, Phone
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

// Hard cap on rendered feed rows in the DOM so long runs never cause memory/render leaks.
// Full dataset remains intact in resultsList for reporting and export.
const LEADS_RENDER_CAP = 400;
const LOGS_RENDER_CAP = 300;

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

/* -------------------------------------------------------------------------
   Memoized Lead Card Row (Prevents re-renders of the whole list)
   ------------------------------------------------------------------------- */
const LeadRow = memo(function LeadRow({ lead, isNew }) {
  const formattedPhone = formatNumber(lead);
  const name = lead.displayName || lead.verifiedName || null;
  const isBiz = lead.isBusiness === true;
  const photoAvailable = hasPhoto(lead);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200",
        isNew ? "bg-primary/[0.08] border-primary/40 animate-lead-in" : "bg-surface border-border/70 hover:border-primary/30 hover:bg-primary/[0.02]"
      )}
    >
      <div className="relative shrink-0">
        <ResultAvatar result={lead} size={36} />
        {photoAvailable && (
          <span
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shadow-xs border border-surface"
            title="Profile photo captured"
          >
            <Camera size={9} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-xs text-text-primary">
            {formattedPhone}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-success/12 text-success border border-success/25">
            Active
          </span>
          {isBiz ? (
            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
              Business
            </span>
          ) : (
            <span className="text-[10px] text-text-muted">
              Personal
            </span>
          )}
        </div>

        {name && (
          <p className="text-xs text-text-secondary truncate mt-0.5 font-medium">
            {name}
          </p>
        )}
      </div>

      {lead.time && (
        <span className="text-[10px] font-mono text-text-muted shrink-0 tabular-nums">
          {lead.time}
        </span>
      )}
    </div>
  );
});

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
  const [terminalScrolledUp, setTerminalScrolledUp] = useState(false);
  const [leadsScrolledUp, setLeadsScrolledUp] = useState(false);
  const [unreadLeadsCount, setUnreadLeadsCount] = useState(0);
  const [isNewDataset, setIsNewDataset] = useState(false);

  const autoAdvanceRef = useRef(null);
  const countUpIntervalRef = useRef(null);
  const celebrationTimeoutRef = useRef(null);
  const scanTriggeredRef = useRef(false);
  const pendingTimers = useRef([]);

  // Run context
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSettingsChange = () => syncRunMetaFromGlobals(window.whatsappShieldSettings);
    window.addEventListener('whatsapp-shield-settings-change', onSettingsChange);
    return () => window.removeEventListener('whatsapp-shield-settings-change', onSettingsChange);
  }, []);

  // Elapsed / speed / ETA tracking
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

  // Control request gate
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

  useEffect(() => {
    if (typeof reconcileScanStatus === 'function') {
      reconcileScanStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Filter ONLY REGISTERED LEADS for the Leads Found panel
  const [leadsFilter, setLeadsFilter] = useState('all'); // 'all' (all leads) | 'photo' (leads with photo)

  const registeredLeads = useMemo(() => {
    // Only registered numbers are true leads
    return resultsList.filter(r => r.exists === true);
  }, [resultsList]);

  const filteredLeads = useMemo(() => {
    if (leadsFilter === 'photo') {
      return registeredLeads.filter(hasPhoto);
    }
    return registeredLeads;
  }, [registeredLeads, leadsFilter]);

  // Cap visible leads to prevent DOM bloat
  const visibleLeads = useMemo(() => {
    return filteredLeads.slice(-LEADS_RENDER_CAP);
  }, [filteredLeads]);

  const photoCount = useMemo(() => registeredLeads.filter(hasPhoto).length, [registeredLeads]);

  const stats = useMemo(() => {
    const total = resultsList.length;
    const registered = registeredLeads.length;
    const unregistered = resultsList.filter(r => !r.exists && r.isValidFormat).length;
    return { total, registered, unregistered };
  }, [resultsList, registeredLeads.length]);

  // Auto-scroll for TERMINAL (newest at bottom)
  const lastLogSeq = systemLogs.length > 0 ? systemLogs[systemLogs.length - 1].seq : 0;
  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;
    if (!terminalScrolledUp) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lastLogSeq, terminalScrolledUp]);

  const handleTerminalScroll = () => {
    const el = terminalRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 35;
    setTerminalScrolledUp(!atBottom);
  };

  const scrollToTerminalBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      setTerminalScrolledUp(false);
    }
  };

  // Auto-scroll for LEADS FOUND (newest at bottom, consistent with terminal)
  useEffect(() => {
    const el = leadsRef.current;
    if (!el) return;
    if (!leadsScrolledUp) {
      el.scrollTop = el.scrollHeight;
      setUnreadLeadsCount(0);
    } else {
      setUnreadLeadsCount(prev => prev + 1);
    }
  }, [registeredLeads.length, leadsScrolledUp]);

  const handleLeadsScroll = () => {
    const el = leadsRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 35;
    setLeadsScrolledUp(!atBottom);
    if (atBottom) {
      setUnreadLeadsCount(0);
    }
  };

  const scrollToLeadsBottom = () => {
    if (leadsRef.current) {
      leadsRef.current.scrollTop = leadsRef.current.scrollHeight;
      setLeadsScrolledUp(false);
      setUnreadLeadsCount(0);
    }
  };

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
  const hitRate = checkedCount > 0 ? ((stats.registered / checkedCount) * 100).toFixed(1) : '0.0';

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
    COMPLETED: 'Completed',
    STOPPED: 'Stopped',
    'CONNECTION LOST': 'Connection lost',
  }[effectiveStatus] || effectiveStatus;

  const statusBadgeColor = connectivityPaused
    ? 'border-warning/40 text-warning bg-warning/10'
    : cooldownActive
      ? 'border-warning/40 text-warning bg-warning/10'
      : scanState === 'PAUSED' || scanState === 'RESUMING' || scanState === 'STARTING'
        ? 'border-warning/40 text-warning bg-warning/10'
        : scanState === 'STOPPED'
          ? 'border-error/40 text-error bg-error/10'
          : (scanState === 'SCANNING' || scanState === 'COMPLETED')
            ? 'border-success/40 text-success bg-success/10'
            : 'border-border text-text-muted bg-surface';

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

  // Bulk check trigger
  useEffect(() => {
    if (isChecking) return;
    if (serverScanActive || activeJobId) return;
    if (!reconcileResolved) return;

    if (scanState === 'STOPPED' || scanState === 'COMPLETED') {
      scanTriggeredRef.current = true;
      return;
    }

    if (checkedCount > 0) {
      scanTriggeredRef.current = false;
      return;
    }

    if (scanTriggeredRef.current) return;

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

    syncRunMetaFromGlobals(settings);

    setIsNewDataset(true);
    scanTriggeredRef.current = true;
    scanStartedAtRef.current = Date.now();
    pausedAccumRef.current = 0;
    pausedAtRef.current = null;

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
      addLog(`Processing new validation dataset: ${numbers.length} numbers`, 'status');
      addLog('Shield active. Pacing requests with natural randomized intervals.', 'info');
      fetch('/api/check-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers,
          phone: ownNumber || '',
          countryCode,
          delayMs: settings.delayMs,
          shieldMode: settings.shieldMode,
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

      addTimer(() => setIsNewDataset(false), 3000);
    } else {
      addLog('No numbers to validate after safety guard check.', 'error');
    }
  }, [isChecking, checkedCount, status, isConnected, scanState, serverScanActive, activeJobId, reconcileResolved]);

  const handleStop = () => {
    requestControl('stop', stopScan);
    addLog('Stop signal sent to server.', 'warn');
  };

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
      case 'success': return 'text-success';
      case 'error': return 'text-error';
      case 'warn': return 'text-warning';
      case 'status': return 'text-primary';
      default: return 'text-text-muted';
    }
  };

  const shieldActive = runMeta.shieldMode;
  const regionLabel = runMeta.countryName || 'All countries';
  const isScanningNow = isChecking && !isDone && scanState !== 'PAUSED';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 relative max-w-7xl mx-auto w-full">

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

        {/* ---------------- Row 1: Header ---------------- */}
        <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 relative z-10">
          <div className="min-w-0">
            <h2 className="text-2xl font-display font-semibold flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Activity size={20} className={cn(isScanningNow && "animate-pulse")} />
              </div>
              Live Validation Stream
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 flex items-center gap-2 flex-wrap">
              <span>Checking numbers live against WhatsApp.</span>
              <span className="inline-flex items-center gap-1.5 text-text-primary font-medium">
                <FlagIcon code={runMeta.countryIso || ''} size={15} className="shrink-0" />
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

          {/* Status Pills */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs py-1 px-2.5 rounded-full flex items-center gap-1.5",
                (isOffline || connectivityPaused) ? "border-warning/40 text-warning bg-warning/10" : "border-border bg-surface text-text-secondary"
              )}
            >
              {isOffline ? (
                <><WifiOff size={13} /> Connection Lost</>
              ) : connectivityPaused ? (
                <><CloudOff size={13} /> Connection Unstable</>
              ) : (
                <><Wifi size={13} className="text-success" /> Connected</>
              )}
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs py-1 px-2.5 rounded-full flex items-center gap-1.5",
                shieldActive ? "border-primary/40 text-primary bg-primary/10" : "border-border text-text-muted bg-surface"
              )}
            >
              {shieldActive ? <ShieldCheck size={13} /> : <Shield size={13} />}
              {shieldActive ? 'Shield Active' : 'Shield Off'}
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs py-1 px-2.5 rounded-full flex items-center gap-1.5 transition-colors",
                statusBadgeColor
              )}
            >
              {isScanningNow && <span className="w-2 h-2 rounded-full bg-success animate-ping inline-block" />}
              {statusLabel}
            </Badge>
          </div>
        </div>

        {/* Informational Banners */}
        {(scanState === 'PAUSED' || scanState === 'RESUMING') && !connectivityPaused && (
          <div className="relative z-20 mb-4 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs sm:text-sm animate-in fade-in">
            <Pause size={16} className="text-warning shrink-0" />
            <div>
              <span className="font-semibold text-warning">Scan paused.</span>{' '}
              <span className="text-text-secondary">
                Frozen at {checkedCount} of {effectiveTotal}. Click Resume to continue safely.
              </span>
            </div>
          </div>
        )}

        {(isOffline || connectivityPaused) && (
          <div className="relative z-20 mb-4 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs sm:text-sm animate-in fade-in">
            <CloudOff size={16} className="text-warning shrink-0" />
            <div>
              <span className="font-semibold text-warning">Connection unstable.</span>{' '}
              <span className="text-text-secondary">
                Validation is paused. All results are saved and will resume automatically.
              </span>
            </div>
          </div>
        )}

        {isStopped && (
          <div className="relative z-20 mb-4 flex items-center gap-3 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-xs sm:text-sm animate-in fade-in">
            <Square size={16} className="text-error shrink-0 fill-error" />
            <div>
              <span className="font-semibold text-error">Scan stopped.</span>{' '}
              <span className="text-text-secondary">
                {stats.total} number(s) processed ({stats.registered} active leads found). You can view the report below.
              </span>
            </div>
          </div>
        )}

        {/* ---------------- Row 2: 5 Compact Equal-width KPI Cards ---------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-4 relative z-10">
          <Card className="rounded-xl border-border bg-surface shadow-2xs">
            <CardContent className="p-3.5 flex flex-col justify-between h-full">
              <span className="text-[11px] uppercase font-semibold tracking-wider text-text-muted">Total Numbers</span>
              <div className="text-xl font-bold font-mono text-text-primary mt-1 tabular-nums">
                {effectiveTotal.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-surface shadow-2xs">
            <CardContent className="p-3.5 flex flex-col justify-between h-full">
              <span className="text-[11px] uppercase font-semibold tracking-wider text-text-muted">Processed</span>
              <div className="text-xl font-bold font-mono text-primary mt-1 tabular-nums">
                {checkedCount.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-success/30 bg-success/[0.04] shadow-2xs">
            <CardContent className="p-3.5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-semibold tracking-wider text-success">Leads Found</span>
                <Users size={14} className="text-success" />
              </div>
              <div className="text-xl font-bold font-mono text-success mt-1 tabular-nums">
                {registeredAnimated.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-surface shadow-2xs">
            <CardContent className="p-3.5 flex flex-col justify-between h-full">
              <span className="text-[11px] uppercase font-semibold tracking-wider text-text-muted truncate">Current Number</span>
              <div className="text-sm sm:text-base font-bold font-mono text-text-primary mt-1 truncate tabular-nums">
                {currentCheckingNum || '—'}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-surface shadow-2xs col-span-2 sm:col-span-1">
            <CardContent className="p-3.5 flex flex-col justify-between h-full">
              <span className="text-[11px] uppercase font-semibold tracking-wider text-text-muted">Status</span>
              <div className="text-sm sm:text-base font-bold text-text-primary mt-1 truncate flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", isScanningNow ? "bg-success animate-ping" : isDone ? "bg-primary" : "bg-warning")} />
                {statusLabel}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- Row 3: Progress Bar & Speed / Time ---------------- */}
        <div className="rounded-xl border border-border bg-surface p-3.5 mb-4 space-y-2.5 relative z-10 shadow-2xs">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-text-secondary font-semibold">Scan Progress</span>
            <div className="flex items-center gap-3">
              <span className="text-text-muted">
                {checkedCount.toLocaleString()} / {effectiveTotal.toLocaleString()}
              </span>
              <span className="font-bold text-text-primary font-mono tabular-nums text-sm">
                {progressPercent}%
              </span>
            </div>
          </div>

          <Progress value={progressPercent} className="h-2 rounded-full" />

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-background/60 px-2.5 py-1.5 rounded-lg border border-border/50">
              <Gauge size={13} className="text-primary shrink-0" />
              <span className="text-text-muted">Speed:</span>
              <span className="font-mono font-semibold text-text-primary ml-auto">{formatSpeed(speedPerMinute)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-background/60 px-2.5 py-1.5 rounded-lg border border-border/50">
              <Timer size={13} className="text-primary shrink-0" />
              <span className="text-text-muted">Elapsed:</span>
              <span className="font-mono font-semibold text-text-primary ml-auto">{formatClock(elapsedMs)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-background/60 px-2.5 py-1.5 rounded-lg border border-border/50">
              <Timer size={13} className="text-primary shrink-0" />
              <span className="text-text-muted">Time left:</span>
              <span className="font-mono font-semibold text-text-primary ml-auto">
                {isDone ? 'Finished' : (etaMs === null ? '—' : formatClock(etaMs))}
              </span>
            </div>
          </div>
        </div>

        {/* ---------------- Row 4: Two Equal-Height Panels (Leads Found & Activity Log) ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow min-h-0 relative z-10 mb-4">

          {/* Left Panel: Leads Found (5 cols on lg, 6 on xl) */}
          <Card className="lg:col-span-6 xl:col-span-6 flex flex-col rounded-2xl border-border overflow-hidden min-h-0 h-[380px] lg:h-[clamp(360px,calc(100dvh-400px),520px)] shadow-2xs">
            {/* Panel Header */}
            <div className="p-3 sm:px-4 sm:py-3 border-b border-border bg-surface/90 flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-success" />
                <h3 className="font-semibold text-sm text-text-primary">Leads Found</h3>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-success/12 text-success border border-success/25">
                  {stats.registered}
                </span>
              </div>

              {/* Segmented Filter */}
              <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border text-xs" role="group">
                <button
                  type="button"
                  onClick={() => setLeadsFilter('all')}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-all",
                    leadsFilter === 'all'
                      ? "bg-surface text-text-primary shadow-xs font-semibold"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  All leads ({stats.registered})
                </button>
                <button
                  type="button"
                  onClick={() => setLeadsFilter('photo')}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1",
                    leadsFilter === 'photo'
                      ? "bg-surface text-text-primary shadow-xs font-semibold"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  <Camera size={11} /> With photo ({photoCount})
                </button>
              </div>
            </div>

            {/* Compact Summary Row */}
            <div className="grid grid-cols-3 border-b border-border/70 bg-background/50 text-[11px] divide-x divide-border/60 shrink-0">
              <div className="py-1.5 px-3 text-center">
                <span className="text-text-muted">Active leads: </span>
                <span className="font-mono font-semibold text-success">{stats.registered}</span>
              </div>
              <div className="py-1.5 px-3 text-center">
                <span className="text-text-muted">Photos: </span>
                <span className="font-mono font-semibold text-text-primary">{photoCount}</span>
              </div>
              <div className="py-1.5 px-3 text-center">
                <span className="text-text-muted">Hit rate: </span>
                <span className="font-mono font-semibold text-primary">{hitRate}%</span>
              </div>
            </div>

            {/* Scrollable Leads List (Newest at Bottom) */}
            <div className="relative flex-1 min-h-0 bg-background/30">
              <div
                ref={leadsRef}
                onScroll={handleLeadsScroll}
                className="h-full overflow-y-auto p-3 space-y-2"
              >
                {visibleLeads.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 min-h-[220px]">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                      <Users size={22} className={cn(isScanningNow && "animate-pulse")} />
                    </div>
                    <p className="text-sm font-semibold text-text-primary">
                      {isDone ? 'No active WhatsApp leads found' : 'Looking for active accounts...'}
                    </p>
                    <p className="text-xs text-text-muted max-w-xs mt-1">
                      {isDone
                        ? 'None of the tested numbers were registered on WhatsApp.'
                        : 'Leads will appear here automatically as soon as they are found.'}
                    </p>
                  </div>
                ) : (
                  visibleLeads.map((lead, idx) => (
                    <LeadRow
                      key={lead.cleanNumber || lead.number || lead.jid || idx}
                      lead={lead}
                      isNew={idx === visibleLeads.length - 1 && isScanningNow}
                    />
                  ))
                )}
              </div>

              {/* Jump to latest lead pill button */}
              {leadsScrolledUp && visibleLeads.length > 0 && (
                <button
                  type="button"
                  onClick={scrollToLeadsBottom}
                  className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold shadow-md hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2"
                >
                  <ArrowDown size={13} />
                  Jump to latest {unreadLeadsCount > 0 ? `(${unreadLeadsCount} new)` : ''}
                </button>
              )}
            </div>
          </Card>

          {/* Right Panel: Activity Log Terminal (6 cols on lg/xl) */}
          <Card className="lg:col-span-6 xl:col-span-6 flex flex-col rounded-2xl border-border overflow-hidden min-h-0 h-[380px] lg:h-[clamp(360px,calc(100dvh-400px),520px)] shadow-2xs">
            {/* Terminal Header */}
            <div className="p-3 sm:px-4 sm:py-3 border-b border-border bg-[#0B1015] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00D97E]" />
                </div>
                <span className="font-mono text-xs text-[#9CA3AF] ml-2">shield-gateway.log</span>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                LIVE
              </div>
            </div>

            {/* Terminal Screen (Newest at Bottom) */}
            <div className="relative flex-1 min-h-0 bg-[#070C10] text-[#E5E7EB]">
              <div
                ref={terminalRef}
                onScroll={handleTerminalScroll}
                className="h-full overflow-y-auto p-3 font-mono text-xs leading-relaxed space-y-1"
              >
                {systemLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-6 text-text-muted min-h-[220px]">
                    Waiting for gateway events...
                  </div>
                ) : (
                  systemLogs.slice(-LOGS_RENDER_CAP).map((log) => (
                    <div key={log.seq} className="flex items-start gap-2.5 hover:bg-white/[0.03] py-0.5 px-1 rounded transition-colors">
                      <span className="text-[#4B5563] shrink-0 tabular-nums">[{log.time}]</span>
                      <span className={cn("break-all flex-1", getLogTypeClass(log.type))}>
                        {log.text}
                      </span>
                    </div>
                  ))
                )}
                {systemLogs.length > 0 && isScanningNow && (
                  <span className="inline-block w-2 h-3.5 bg-primary animate-pulse ml-1 align-middle" />
                )}
              </div>

              {/* Jump to latest log button */}
              {terminalScrolledUp && systemLogs.length > 0 && (
                <button
                  type="button"
                  onClick={scrollToTerminalBottom}
                  className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-mono backdrop-blur-xs hover:bg-primary/30 transition-all animate-in fade-in"
                >
                  <ArrowDown size={13} />
                  Jump to latest
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* ---------------- Row 5: Action Controls ---------------- */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 relative z-10 pt-1">
          <div className="flex gap-2.5 w-full sm:w-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => requestControl('pause', pauseScan)}
                  disabled={!canPause}
                  loading={controlPending && pendingAction === 'pause'}
                  className="bg-amber-500 hover:bg-amber-400 text-white font-semibold shadow-xs flex-1 sm:flex-none h-11 px-5 rounded-xl transition-all"
                >
                  <Pause size={16} className="mr-2" /> Pause
                </Button>
              </TooltipTrigger>
              <TooltipContent>{canPause ? 'Pause the scan safely' : 'Available while scanning'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => requestControl('resume', resumeScan)}
                  disabled={!canResume}
                  loading={controlPending && pendingAction === 'resume'}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow-xs flex-1 sm:flex-none h-11 px-5 rounded-xl transition-all"
                >
                  <Play size={16} className="mr-2" /> Resume
                </Button>
              </TooltipTrigger>
              <TooltipContent>{canResume ? 'Resume from current position' : 'Available when paused'}</TooltipContent>
            </Tooltip>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="h-11 px-5 rounded-xl font-semibold shadow-xs flex-1 sm:flex-none"
                  disabled={!canStop}
                  loading={controlPending && pendingAction === 'stop'}
                >
                  <Square size={14} className="mr-2 fill-current" /> Stop
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop Validation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will end the validation run and save all processed leads as a partial campaign report.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleStop} className="bg-error hover:bg-error/90 text-white rounded-xl font-semibold">
                    Confirm Stop
                  </AlertDialogAction>
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
                    "w-full sm:w-auto h-11 px-7 rounded-xl font-semibold transition-all duration-300 relative shadow-sm",
                    isComplete && "shimmer-button bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(0,217,126,0.3)]"
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
              {isDone ? 'Open the audit report and export verified leads' : 'Available when validation completes or is stopped'}
            </TooltipContent>
          </Tooltip>
        </div>

      </div>
    </TooltipProvider>
  );
};

export default Step4Scanning;
