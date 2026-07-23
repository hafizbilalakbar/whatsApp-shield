import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Activity, StopCircle, CheckCircle2, Shield, BarChart3, Sparkles, ArrowDown } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { useTheme } from '../../context/ThemeProvider';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Progress } from '../ui/Progress';
import { Badge } from '../ui/Badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/AlertDialog';
import { cn } from '../ui/cn';

const CONFETTI_COLORS = ['#00D97E', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6', '#FF6B6B', '#48D1CC', '#FFE66D'];

const Step4Scanning = ({ onNext }) => {
  const { theme } = useTheme();
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
    sendMessage
  } = useWebSocket();

  const terminalRef = useRef(null);
  const [showCelebration, setShowCelebration] = useState(false);
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
  const [animatingIndices, setAnimatingIndices] = useState(new Set());
  const [isNewDataset, setIsNewDataset] = useState(false);
  const prevLogsLength = useRef(0);
  const animTimeouts = useRef([]);
  const autoAdvanceRef = useRef(null);
  const countUpIntervalRef = useRef(null);
  const celebrationTimeoutRef = useRef(null);
  const scanTriggeredRef = useRef(false);

  // Auto-scroll to bottom — only on new logs, respects manual scroll
  const programmaticScrollRef = useRef(false);
  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;
    if (!userScrolledUp) {
      programmaticScrollRef.current = true;
      el.scrollTop = el.scrollHeight;
    }
  }, [systemLogs.length]);

  // Animate new log lines with 150ms stagger (non-destructive to pending animations)
  useEffect(() => {
    if (systemLogs.length > prevLogsLength.current) {
      const startIdx = prevLogsLength.current;
      const newCount = systemLogs.length - prevLogsLength.current;
      prevLogsLength.current = systemLogs.length;
      
      for (let i = 0; i < newCount; i++) {
        const idx = startIdx + i;
        const t = setTimeout(() => {
          setAnimatingIndices(prev => new Set([...prev, idx]));
        }, i * 150);
        animTimeouts.current.push(t);
      }
    }
    return () => {}; // don't cancel — let pending animations complete
  }, [systemLogs]);

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

  const isComplete = !isChecking && checkedCount > 0 && checkedCount === totalToCheck;

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

    // Scan completed — reset trigger ref for next submission
    if (checkedCount > 0) {
      scanTriggeredRef.current = false;
      return;
    }

    // Guard: don't start if already triggered for this reset cycle
    if (scanTriggeredRef.current) return;

    let numbers = window.whatsappShieldAudience || [];
    const countryCode = window.whatsappShieldCountryCode || '1';
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
          shieldMode: settings.shieldMode
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
      setTimeout(() => setIsNewDataset(false), 3000);
    } else {
      addLog('No numbers to validate after safety guard check.', 'error');
    }
  }, [isChecking, checkedCount]);

  const handleStop = () => {
    sendMessage({ type: 'stop_bulk_check' });
    addLog('Stop signal sent to server.', 'warn');
  };

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
            <ActivityIcon active={isChecking} /> Live Validation Stream
          </h2>
          <p className="text-text-secondary mt-1">Real-time gateway logs and validation status.</p>
        </div>
        <div className="flex items-center gap-3">
          {isNewDataset && (
            <Badge variant="outline" className="font-mono bg-primary/10 border-primary/30 text-primary animate-in fade-in zoom-in-95 duration-200">
              <Activity size={12} className="mr-1.5" /> Processing New Numbers
            </Badge>
          )}
          <Badge variant="outline" className="font-mono bg-surface">
            <Shield size={12} className={cn("mr-1.5", window.whatsappShieldSettings?.shieldMode ? "text-success" : "text-text-muted")} /> 
            Shield: {window.whatsappShieldSettings?.shieldMode ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        </div>
      </div>

      {/* Celebration Card */}
      {showCelebration && (
        <div className="relative z-30 mb-6 celebration-card">
          <div className={cn(
            "rounded-xl border border-success/30 p-4 md:p-6 glow-pulse-green",
            theme === 'dark' ? 'bg-[#0A1520]' : 'bg-white'
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
              <div className={cn("text-center p-3 rounded-lg border", theme === 'dark' ? 'bg-[#020B06] border-[#1F2937]' : 'bg-gray-50 border-gray-200')}>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Scanned</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-text-primary">{countUp.total}</div>
              </div>
              <div className={cn("text-center p-3 rounded-lg border", theme === 'dark' ? 'bg-[#020B06] border-[#1F2937]' : 'bg-gray-50 border-gray-200')}>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Registered</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-success">{countUp.registered}</div>
              </div>
              <div className={cn("text-center p-3 rounded-lg border", theme === 'dark' ? 'bg-[#020B06] border-[#1F2937]' : 'bg-gray-50 border-gray-200')}>
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
                <div className="text-xs text-text-secondary mb-1">Current</div>
                <div className="text-sm md:text-lg font-mono font-bold truncate">{currentCheckingNum || '---'}</div>
              </CardContent>
            </Card>
            <Card className={cn("transition-colors", cooldownActive && "bg-warning/10 border-warning/50")}>
              <CardContent className="p-3 md:p-4">
                <div className="text-xs text-text-secondary mb-1">Status</div>
                <div className={cn("text-sm md:text-lg font-mono font-bold", cooldownActive ? "text-warning" : "text-success")}>
                  {cooldownActive ? 'COOLING' : (isChecking ? 'SCANNING' : (isComplete ? 'DONE' : 'IDLE'))}
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
            theme === 'light' ? 'light-border' : ''
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
              {systemLogs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    "terminal-log-line",
                    animatingIndices.has(index) && "visible",
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-error/20 text-error hover:bg-error/10 hover:text-error w-full sm:w-auto" disabled={!isChecking}>
                <StopCircle size={16} className="mr-2" /> Stop
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop Validation Process?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will halt the current scanning loop. Partial results will be saved.
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
          onClick={onNext}
          disabled={!isComplete}
          variant={isComplete ? "default" : "secondary"}
        >
          {isComplete ? (
            <><BarChart3 size={16} className="mr-2" /> View Reports <CheckCircle2 size={16} className="ml-2" /></>
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
