import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, LogOut, ArrowRight, Loader2, QrCode, UserPlus, CheckCircle2, BadgeCheck, Globe, Users, Megaphone, MessageCircle, Target, BarChart3, FileText, Workflow } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../ui/cn';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/AlertDialog';

const CAPABILITIES = [
  { icon: BadgeCheck, headline: 'Validate Thousands of Contacts', desc: 'Validate thousands of numbers in real time and reach only verified contacts.', short: 'Validation' },
  { icon: Globe, headline: 'Find Your Next Customers', desc: 'Turn your contact lists into qualified prospects worldwide — no manual research.', short: 'Discovery' },
  { icon: Users, headline: 'Organize Validated Leads', desc: 'Move validated leads straight into organized CRM pipelines in one click.', short: 'Leads' },
  { icon: Megaphone, headline: 'Reach New Business Opportunities', desc: 'Reach new customers through authorized, policy-compliant business campaigns.', short: 'Campaigns' },
  { icon: MessageCircle, headline: 'Turn Conversations Into Leads', desc: 'Manage every conversation in one workspace while AI qualifies and prioritizes leads.', short: 'Message Agent' },
  { icon: Target, headline: 'Build Targeted Audiences', desc: 'Segment prospects by country, status, and results into clean target audiences.', short: 'Audiences' },
  { icon: BarChart3, headline: 'Analyze Campaign Performance', desc: 'Track response rates, validation results, and pipeline health in real time.', short: 'Analytics' },
  { icon: FileText, headline: 'Export Professional Reports', desc: 'Export professional PDF, CSV, TXT, and JSON reports for clients or your team.', short: 'Reports' },
  { icon: Workflow, headline: 'Automate Repetitive Workflows', desc: 'Smart templates and AI-assist automate follow-ups while you focus on closing.', short: 'Automation' },
];

const ROTATION_MS = 5000;
const TYPE_MS_PER_CHAR = 26;
const DELETE_MS_PER_CHAR = 22;
const MIN_HOLD_MS = 700;
const TICK_MS = 26;

// Splits a fixed 5s cycle into typing / hold / deleting phases that always sum to ROTATION_MS,
// so the progress bar, auto-rotation, and typewriter stay perfectly synchronized.
function getPhaseDurations(length) {
  let typingMs = length * TYPE_MS_PER_CHAR;
  let deletingMs = length * DELETE_MS_PER_CHAR;
  const maxWork = ROTATION_MS - MIN_HOLD_MS;
  if (typingMs + deletingMs > maxWork) {
    const scale = maxWork / (typingMs + deletingMs);
    typingMs *= scale;
    deletingMs *= scale;
  }
  return { typingMs, deletingMs, holdMs: ROTATION_MS - typingMs - deletingMs };
}

function Typewriter({ text, displayLen }) {
  return (
    <span aria-label={text}>
      {text.slice(0, displayLen)}
      <span className="ws-caret inline-block w-[2px] h-[1em] ml-1 align-middle rounded-full bg-[var(--showcase-caret)] shadow-[0_0_6px_var(--showcase-caret)]" aria-hidden="true" />
    </span>
  );
}

const SHOWCASE_STATS = [
  { value: '195+', label: 'Countries covered' },
  { value: '4', label: 'Export formats' },
  { value: 'Real-time', label: 'Validation results' },
];

function CapabilityShowcase() {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [cycleStart, setCycleStart] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(() => Date.now());

  const idxRef = React.useRef(0);
  const cycleStartRef = React.useRef(cycleStart);
  idxRef.current = activeIdx;
  cycleStartRef.current = cycleStart;

  // Single synchronized clock drives the typewriter, auto-rotation, and progress bar.
  // Created once, cleaned up on unmount, no duplicate timers. Runs unconditionally.
  React.useEffect(() => {
    const tick = setInterval(() => {
      const t = Date.now();
      const text = CAPABILITIES[idxRef.current].headline;
      const { typingMs, deletingMs, holdMs } = getPhaseDurations(text.length);
      if (t - cycleStartRef.current >= typingMs + holdMs + deletingMs) {
        const next = (idxRef.current + 1) % CAPABILITIES.length;
        idxRef.current = next;
        cycleStartRef.current = t;
        setActiveIdx(next);
        setCycleStart(t);
      }
      setNow(t);
    }, TICK_MS);
    return () => clearInterval(tick);
  }, []);

  const selectCapability = (i) => {
    const t = Date.now();
    idxRef.current = i;
    cycleStartRef.current = t;
    setActiveIdx(i);
    setCycleStart(t);
    setNow(t);
  };

  const active = CAPABILITIES[activeIdx];
  const ActiveIcon = active.icon;
  const { typingMs, deletingMs, holdMs } = getPhaseDurations(active.headline.length);
  const cycleMs = typingMs + holdMs + deletingMs;
  const elapsed = Math.max(0, now - cycleStart);

  let displayLen;
  if (elapsed <= typingMs) {
    displayLen = Math.min(active.headline.length, Math.floor(elapsed / TYPE_MS_PER_CHAR));
  } else if (elapsed <= typingMs + holdMs) {
    displayLen = active.headline.length;
  } else if (elapsed <= cycleMs) {
    const del = Math.floor((elapsed - typingMs - holdMs) / DELETE_MS_PER_CHAR);
    displayLen = Math.max(0, active.headline.length - del);
  } else {
    displayLen = active.headline.length;
  }

  const progressPct = Math.min(100, (elapsed / ROTATION_MS) * 100);
  const clusterTransition = { duration: 0.4, ease: [0.22, 1, 0.36, 1] };

  return (
    <motion.div
      className="relative flex flex-col flex-grow overflow-hidden rounded-2xl border border-[var(--showcase-line)] bg-gradient-to-b from-[var(--showcase-surface-1)] via-[var(--showcase-surface-2)] to-[var(--showcase-surface-3)] shadow-[var(--showcase-shadow)]"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      role="region"
      aria-label="WhatsApp Shield capabilities"
    >
      {/* Ambient background orbs + faint grid + soft light sheen */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="ws-orb ws-orb-a" />
        <div className="ws-orb ws-orb-b" />
        <div className="ws-orb ws-orb-c" />
      </div>
      <div
        className="absolute inset-0 opacity-[var(--showcase-grid-opacity)] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(var(--showcase-grid) 1px, transparent 1px), linear-gradient(90deg, var(--showcase-grid) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        aria-hidden="true"
      />
      <div className="ws-showcase-sheen absolute inset-0 pointer-events-none" aria-hidden="true" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--showcase-hairline)] to-transparent" aria-hidden="true" />

      {/* Header: eyebrow + slide counter */}
      <div className="relative flex items-center justify-between gap-2 px-4 pt-3.5 pb-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[var(--showcase-dot-glow)]" aria-hidden="true" />
          One workspace. More possibilities.
        </div>
        <span className="font-mono text-[10px] text-[var(--showcase-text-3)] tabular-nums tracking-wider shrink-0">
          {String(activeIdx + 1).padStart(2, '0')}
          <span className="mx-1 text-[var(--showcase-line-strong)]">/</span>
          {String(CAPABILITIES.length).padStart(2, '0')}
        </span>
      </div>

      {/* Content cluster: icon + typewriter headline + description (synchronized crossfade) */}
      <div className="relative flex flex-col flex-grow px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={clusterTransition}
              className="flex flex-col"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1.5 rounded-xl bg-[var(--showcase-accent-glow)] blur-md" aria-hidden="true" />
                  <div className="relative w-10 h-10 rounded-xl p-px bg-gradient-to-br from-[var(--showcase-badge-1)] via-[var(--showcase-badge-2)] to-[var(--showcase-badge-3)]">
                    <div className="w-full h-full rounded-[11px] bg-[var(--showcase-inner)] flex items-center justify-center">
                      <ActiveIcon size={20} className="text-primary" />
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--showcase-text-3)]">Capability {String(activeIdx + 1).padStart(2, '0')}</div>
                  <div className="text-[11px] text-[var(--showcase-text-2)] mt-0.5 truncate">{active.short}</div>
                </div>
              </div>

              {/* Headline: reserved 2-line height keeps layout stable while typing */}
              <div className="relative">
                <div className="ws-headline-glow" aria-hidden="true" />
                <h3 className="relative font-display font-semibold leading-snug flex items-center min-h-[2.9rem] sm:min-h-[3.3rem] text-[1.05rem] sm:text-[1.2rem]">
                  <span className="ws-headline-gradient block w-full min-w-0 break-words">
                    <Typewriter text={active.headline} displayLen={displayLen} />
                  </span>
                </h3>
              </div>

              <p className="mt-1.5 text-[12px] leading-snug text-[var(--showcase-text-2)] min-h-[2.1rem] sm:min-h-[2.2rem] line-clamp-2 break-words">
                {active.desc}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Verified quick stats */}
        <div className="relative mt-3.5 grid grid-cols-3 divide-x divide-[var(--showcase-line)] rounded-lg border border-[var(--showcase-line)] bg-[var(--showcase-slate)] py-2">
          {SHOWCASE_STATS.map(s => (
            <div key={s.label} className="px-1.5 sm:px-2 text-center min-w-0">
              <div className="font-mono text-[12px] sm:text-[13px] font-semibold text-primary truncate">{s.value}</div>
              <div className="text-[9px] sm:text-[10px] text-[var(--showcase-text-3)] mt-0.5 truncate">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-4 sm:pt-5">
          {/* Progress / timer indicator (single synchronized clock) */}
          <div className="h-1 rounded-full bg-[var(--showcase-line)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--showcase-accent-from)] to-[var(--showcase-accent-to)] shadow-[var(--showcase-accent-glow-strong)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {CAPABILITIES.map((c, i) => (
                <button
                  key={c.headline}
                  type="button"
                  onClick={() => selectCapability(i)}
                  aria-label={`Show ${c.headline}`}
                  aria-current={i === activeIdx ? 'true' : undefined}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--showcase-accent-line)]',
                    i === activeIdx
                      ? 'w-5 bg-gradient-to-r from-[var(--showcase-accent-from)] to-[var(--showcase-accent-to)] shadow-[var(--showcase-accent-soft-glow)]'
                      : 'w-1.5 bg-[var(--showcase-dot-idle)] hover:bg-[var(--showcase-dot-idle-hover)]'
                  )}
                />
              ))}
            </div>
            <span className="hidden sm:inline text-[10px] font-mono text-[var(--showcase-text-3)] tabular-nums">Auto-playing</span>
          </div>

          {/* Capability chips */}
          <div className="flex flex-wrap gap-1 mt-3">
            {CAPABILITIES.map((c, i) => {
              const Icon = c.icon;
              const isActiveCap = i === activeIdx;
              return (
                <span
                  key={c.headline}
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-medium transition-all duration-300',
                    isActiveCap
                      ? 'border-[var(--showcase-accent-line)] bg-[var(--showcase-accent-soft)] text-primary shadow-[var(--showcase-accent-soft-glow)]'
                      : 'border-[var(--showcase-line)] bg-[var(--showcase-slate)] text-[var(--showcase-text-3)]'
                  )}
                >
                  <Icon size={9} className={isActiveCap ? 'drop-shadow-[var(--showcase-accent-drop)]' : ''} />
                  {c.short}
                </span>
              );
            })}
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-3.5 pt-2.5 border-t border-[var(--showcase-line)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--showcase-text-3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[var(--showcase-dot-glow)]" aria-hidden="true" />
            Built for organized audience workflows
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--showcase-text-2)]">
            <Shield size={11} className="text-primary" />
            Your workspace <span className="text-primary" aria-hidden="true">&bull;</span> Protected
          </span>
        </div>
      </div>
    </motion.div>
  );
}

const Step1Auth = ({ onNext }) => {
  const navigate = useNavigate();
  const { 
    status, 
    isConnected, 
    qrCode, 
    sessionUser, 
    logout,
    sendMessage
  } = useWebSocket();

  const [connectionPhase, setConnectionPhase] = React.useState(null);
  const [exiting, setExiting] = React.useState(false);
  const [awaitingQr, setAwaitingQr] = React.useState(false);
  const prevStatusRef = React.useRef(status);
  const wasQrScanRef = React.useRef(false);
  const statusRef = React.useRef(status);

  // Phase machine: detects QR_CODE→CONNECTED transition
  React.useEffect(() => {
    const wasQr = prevStatusRef.current === 'QR_CODE';
    prevStatusRef.current = status;
    if (!isConnected) {
      setConnectionPhase(null);
      return;
    }
    if (wasQr) {
      wasQrScanRef.current = true;
      setConnectionPhase('authenticating');
    } else if (connectionPhase === null) {
      wasQrScanRef.current = false;
      setConnectionPhase('connected');
    }
  }, [status, isConnected, connectionPhase]);

  // Phase timer: authenticating → connected → auto-advance
  React.useEffect(() => {
    if (connectionPhase === 'authenticating') {
      const t = setTimeout(() => setConnectionPhase('connected'), 500);
      return () => clearTimeout(t);
    }
    if (connectionPhase === 'connected') {
      const delay = wasQrScanRef.current ? 1200 : 400;
      const t = setTimeout(() => {
        setExiting(true);
        setTimeout(() => onNext(), 300);
      }, delay);
      return () => clearTimeout(t);
    }
  }, [connectionPhase, onNext]);

  // Keep a ref to the latest status so the unmount cleanup reads the current value
  React.useEffect(() => { statusRef.current = status; }, [status]);

  // On mount: always start clean — cancel any stale QR, show the button
  // On unmount: cancel any active QR so a future visit starts fresh
  React.useEffect(() => {
    setAwaitingQr(false);
    sendMessage({ type: 'cancel_qr' });
    return () => {
      if (statusRef.current === 'QR_CODE') {
        sendMessage({ type: 'cancel_qr' });
      }
    };
  }, [sendMessage]);

  const handleGenerateQR = () => {
    setAwaitingQr(true);
    sendMessage({ type: 'generate_qr' });
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold flex items-center gap-2">
          <Shield className="text-primary" /> Sign In
        </h2>
        <p className="text-text-secondary mt-1">Connect your WhatsApp account to get started with Shield validation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 flex-grow">
        
        {/* Left Col (3/5): QR Login for New Users */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <Card className="flex-grow flex flex-col overflow-hidden relative">
            <CardHeader className="bg-background/50 border-b border-border pb-4">
              <CardTitle className="flex justify-between items-center text-lg">
                <span className="flex items-center gap-2">
                  <UserPlus size={18} className="text-primary" /> New Connection
                </span>
                <Badge variant={isConnected ? "success" : (status === "CONNECTING" ? "warning" : "outline")} className="font-mono text-xs">
                  {status === 'CONNECTED' && <><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success animate-pulse inline-block" /> Connected</>}
                  {status === 'CONNECTING' && <Loader2 size={12} className="animate-spin mr-1.5 inline-block" />}
                  {status === 'QR_CODE' && <><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-warning animate-pulse inline-block" /> Scan Ready</>}
                  {status === 'DISCONNECTED' && 'Disconnected'}
                </Badge>
              </CardTitle>
              {!isConnected && status !== 'CONNECTING' && (
                <CardDescription>
                  Scan the QR code below with your phone to link your WhatsApp account.
                </CardDescription>
              )}
            </CardHeader>
            
            <CardContent className="flex-grow flex flex-col items-center justify-center p-6 md:p-8">
              <AnimatePresence mode="wait">
                {connectionPhase === 'authenticating' ? (
                  <motion.div
                    key="authenticating"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    className="text-center flex flex-col items-center justify-center py-12 space-y-6"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-border rounded-full animate-pulse" />
                      <div className="w-16 h-16 border-4 border-primary rounded-full border-t-transparent animate-spin absolute inset-0" />
                    </div>
                    <div>
                      <p className="text-text-primary font-semibold text-lg">QR Code Scanned!</p>
                      <p className="text-text-secondary text-sm mt-1">Authenticating your device...</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <div className="flex -space-x-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>Linking your WhatsApp account</span>
                    </div>
                  </motion.div>
                ) : isConnected && sessionUser ? (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={exiting ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-center flex flex-col items-center"
                  >
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 p-1 mb-4 relative">
                      {sessionUser.avatar ? (
                        <img src={sessionUser.avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                          {sessionUser.name ? sessionUser.name.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 w-4 h-4 bg-success border-2 border-surface rounded-full shadow-sm" />
                    </div>
                    <h3 className="text-lg font-display font-semibold mb-1">{sessionUser.name || 'WhatsApp Session'}</h3>
                    <p className="text-sm text-text-secondary font-mono mb-4">{sessionUser.number}</p>
                    <div className="flex items-center gap-2 text-xs text-success mb-3">
                      <CheckCircle2 size={14} /> Connected successfully
                    </div>
                    <div className="flex gap-3 w-full max-w-xs">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-error hover:text-error hover:bg-error/10 border-error/20">
                            <LogOut size={14} className="mr-1" /> Disconnect
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect Session?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will clear your local authentication keys. You will need to scan a new QR code to reconnect.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={logout} className="bg-error hover:bg-error/90 text-white">Disconnect</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button size="sm" onClick={() => { setExiting(true); setTimeout(() => { navigate('/dashboard'); onNext(); }, 200); }}>
                        Dashboard <ArrowRight size={14} className="ml-1" />
                      </Button>
                    </div>
                  </motion.div>
                ) : (awaitingQr && status === 'QR_CODE' && qrCode) ? (
                  <motion.div
                    key="qr"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    className="text-center flex flex-col items-center w-full max-w-sm"
                  >
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-lg mb-5 relative overflow-hidden group">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 md:w-56 md:h-56 relative z-10" />
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_10px_rgba(0,217,126,1)] z-20 animate-scan-line pointer-events-none" />
                    </div>
                    <h3 className="font-semibold mb-3">Scan to Link Your Device</h3>
                    <ol className="text-sm text-text-secondary text-left space-y-2 max-w-xs mx-auto">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">1</span>
                        Open WhatsApp on your phone
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">2</span>
                        Go to <strong>Settings</strong> &rarr; <strong>Linked Devices</strong>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">3</span>
                        Tap <strong>Link a Device</strong> and scan this code
                      </li>
                    </ol>
                  </motion.div>
                ) : status === 'CONNECTING' ? (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-center flex flex-col items-center justify-center text-text-muted space-y-4"
                  >
                    <div className="relative">
                      <div className="w-14 h-14 border-4 border-border rounded-full animate-pulse" />
                      <div className="w-14 h-14 border-4 border-primary rounded-full border-t-transparent animate-spin absolute inset-0" />
                    </div>
                    <p className="text-sm">Initializing secure gateway...</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="disconnected"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-center flex flex-col items-center justify-center text-text-muted space-y-5 py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center border-2 border-dashed border-border">
                      <QrCode size={28} className="opacity-40" />
                    </div>
                    <div>
                      <p className="text-text-primary font-semibold mb-1">Ready to Connect</p>
                      <p className="text-sm">Click below to generate your secure QR code.</p>
                    </div>
                    <Button onClick={handleGenerateQR} variant="default" size="sm" disabled={isConnected || status === 'CONNECTING'}>
                      {status === 'CONNECTING' ? <><Loader2 size={14} className="animate-spin mr-2" /> Initializing...</> : <><QrCode size={16} className="mr-2" /> Generate QR Code</>}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Right Col (2/5): WhatsApp Shield capability showcase */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <CapabilityShowcase />
        </div>

      </div>
    </div>
  );
};

export default Step1Auth;
