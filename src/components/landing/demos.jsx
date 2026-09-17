import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ShieldCheck, CheckCheck, Check, Bot, Clock, Wifi, QrCode, Sparkles, Send,
  MessageCircle, Star, CalendarCheck, CircleCheck, CircleAlert, EllipsisVertical,
  Landmark, Building2, Stethoscope, GraduationCap, Cpu, ShoppingCart, Megaphone,
  Wrench, Store, Truck, Handshake, MapPin, Phone, Video, ArrowRight, Search, Smile,
  Paperclip, Mic, UserCheck, ClipboardList, Tags, CalendarClock, Zap, LayoutDashboard,
  Upload, ScanLine, Target, FolderCheck, ChartNoAxesCombined, Settings, Download, X,
  ChevronRight, TrendingUp, Activity, BadgeCheck, Gauge, Timer, Reply,
  Signal, Users, ArrowLeft, Camera, MoreVertical,
} from 'lucide-react';
import { cn } from '../ui/cn';

/* ============================================================
   Motion / timing helpers
   ============================================================ */

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
const phase = (t, a, b) => easeOut(clamp01((t - a) / (b - a)));

/* Looping rAF clock (0..1), frozen at a representative frame for reduced motion. */
export function useDemoClock(total, freezeAt = 0.62) {
  const reduce = useReducedMotion();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduce) { setT(freezeAt); return undefined; }
    let raf;
    let start = null;
    let prev = 0;
    const frame = (now) => {
      if (start === null) start = now;
      const el = now - start;
      if (el - prev >= 40) {
        prev = el;
        setT((el % total) / total);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduce, total, freezeAt]);
  return t;
}

/* Discrete step sequence that starts at 0 after `delay`, steps through the
   sequence, holds the final frame for `hold`, then replays. Fully revealed
   under prefers-reduced-motion. A lightweight 200ms interval only triggers
   re-renders when the step actually changes. */
function useChatSteps(total, ms = 1500, delay = 0, hold = 2600) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return undefined;
    const cycle = Math.max(1, ms * total + hold);
    const startAt = Date.now() + delay;
    const id = setInterval(() => {
      const el = Date.now() - startAt;
      if (el < 0) return;
      setStep(Math.min(total - 1, Math.floor((el % cycle) / Math.max(1, ms))));
    }, 200);
    return () => clearInterval(id);
  }, [reduce, total, ms, delay, hold]);
  return reduce ? total - 1 : step;
}

/* Animated integer that eases from its previous value. */
const Counter = ({ value, className, duration = 700 }) => {
  const [disp, setDisp] = useState(0);
  const pv = useRef(0);
  useEffect(() => {
    const from = pv.current;
    const to = value;
    pv.current = to;
    if (to === from) return undefined;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{disp}</span>;
};

/* ============================================================
   Shared primitives
   ============================================================ */

const PHOTO_SIZES = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
  xl: 'w-14 h-14',
};

/* Licensed stock profile photos cached locally under public/avatars/ so the
   page never depends on remote URLs. Replace with authorized photos when
   verified customer images are available. */
const ProfilePhoto = ({ img, initials, tint = 'from-primary to-secondary', size = 'md', online = false, ping = false, className }) => {
  const [err, setErr] = useState(false);
  return (
    <span className={cn('relative shrink-0 inline-block align-middle', className)}>
      {img && !err ? (
        <img
          src={`/avatars/${img}.jpg`}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setErr(true)}
          className={cn('rounded-full object-cover ring-1 ring-border/60 bg-surface shadow-sm', PHOTO_SIZES[size])}
        />
      ) : (
        <span className={cn('rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br', PHOTO_SIZES[size], size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm', tint)}>
          {initials}
        </span>
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#25D366] border-2" style={{ borderColor: 'var(--ma-bg-panel)' }} />
      )}
      {ping && (
        <span className="absolute inset-0 rounded-full border-2 border-[#25D366]/70 animate-ping" aria-hidden="true" />
      )}
    </span>
  );
};

const TypingDots = ({ className }) => (
  <span className={cn('flex items-center gap-0.5', className)} aria-hidden="true">
    {[0, 120, 240].map((d) => (
      <span key={d} className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />
    ))}
  </span>
);

const CHAT_PATTERN = {
  backgroundImage: 'radial-gradient(circle, var(--ma-line-slim) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
};

const DemoWindow = ({ icon: Icon, title, subtitle, right, children, className }) => (
  <div className={cn('rounded-2xl border border-border bg-surface shadow-xl overflow-hidden', className)}>
    <div className="flex items-center gap-2 px-3.5 sm:px-4 h-11 border-b shrink-0" style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
      </div>
      <span className="ml-1.5 w-6 h-6 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
        <Icon size={13} className="text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold truncate leading-tight" style={{ color: 'var(--ma-list-title)' }}>{title}</p>
        {subtitle && <p className="text-[9px] truncate leading-tight" style={{ color: 'var(--ma-muted-text)' }}>{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

/* ============================================================
   Category logo tiles (neutral — no brand/partnership implied)
   ============================================================ */

export const CATEGORY_LOGOS = [
  { name: 'E-Commerce', desc: 'Online stores', icon: ShoppingCart, tint: 'from-emerald-400 to-teal-600' },
  { name: 'Marketing', desc: 'Agencies & growth', icon: Megaphone, tint: 'from-violet-400 to-purple-600' },
  { name: 'Real Estate', desc: 'Property & brokers', icon: Building2, tint: 'from-sky-400 to-blue-600' },
  { name: 'Healthcare', desc: 'Clinics & care', icon: Stethoscope, tint: 'from-rose-400 to-pink-600' },
  { name: 'Education', desc: 'Schools & training', icon: GraduationCap, tint: 'from-amber-400 to-orange-600' },
  { name: 'Finance', desc: 'Banking & fintech', icon: Landmark, tint: 'from-teal-400 to-cyan-600' },
  { name: 'Technology', desc: 'Software & IT', icon: Cpu, tint: 'from-cyan-400 to-indigo-600' },
  { name: 'Logistics', desc: 'Freight & delivery', icon: Truck, tint: 'from-orange-400 to-amber-600' },
  { name: 'Services', desc: 'Field & trade', icon: Wrench, tint: 'from-slate-400 to-slate-600' },
  { name: 'Local Business', desc: 'Shops & venues', icon: Store, tint: 'from-lime-400 to-green-600' },
  { name: 'Sales Teams', desc: 'Pipeline & outreach', icon: Handshake, tint: 'from-green-400 to-emerald-600' },
];

export const CategoryLogoTile = ({ item }) => (
  <div className="mx-2.5 sm:mx-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-sm px-4 py-3 min-w-max shadow-sm transition-colors duration-300 hover:border-primary/30">
    <span className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm shrink-0', item.tint)}>
      <item.icon size={16} className="text-white" />
    </span>
    <span className="flex flex-col leading-tight">
      <span className="text-[13px] font-bold text-text-primary tracking-tight whitespace-nowrap">{item.name}</span>
      <span className="text-[10px] text-text-muted whitespace-nowrap">{item.desc}</span>
    </span>
  </div>
);

/* ============================================================
   WhatsApp Shield — desktop SaaS dashboard
   ============================================================ */

const SHIELD_STEPS = ['Scan', 'Verify', 'Quality', 'Organize', 'Ready'];
const SHIELD_STAGE_LABELS = [
  { label: 'Scanning contacts', tone: 'text-text-muted border-border/70 bg-background' },
  { label: 'Verifying presence', tone: 'text-primary border-primary/30 bg-primary/5' },
  { label: 'Checking quality', tone: 'text-primary border-primary/30 bg-primary/5' },
  { label: 'Organizing', tone: 'text-primary border-primary/30 bg-primary/5' },
  { label: 'Ready', tone: 'text-success border-success/30 bg-success/10' },
];

const SHIELD_NAV = [
  { icon: LayoutDashboard, label: 'Overview' },
  { icon: Upload, label: 'Import data' },
  { icon: ScanLine, label: 'Validation', active: true, badge: '5' },
  { icon: Target, label: 'Quality' },
  { icon: FolderCheck, label: 'Organized', badge: '4' },
  { icon: MessageCircle, label: 'Agent inbox' },
  { icon: ChartNoAxesCombined, label: 'Reports' },
  { icon: Settings, label: 'Settings' },
];

/* Sample personas for layout — swap in authorized data before going live. */
const SHIELD_LEADS = [
  { img: 'aisha', initials: 'AR', tint: 'from-rose-400 to-pink-600', name: 'Aisha Rahman', business: 'Online store', location: 'Dubai, AE', wa: true, score: 96 },
  { img: 'daniel', initials: 'DM', tint: 'from-sky-400 to-blue-600', name: 'Daniel Moreau', business: 'Property agency', location: 'Lyon, FR', wa: true, score: 88 },
  { img: 'priya', initials: 'PS', tint: 'from-violet-400 to-purple-600', name: 'Priya Sharma', business: 'Marketing agency', location: 'Mumbai, IN', wa: true, score: 74 },
  { img: 'luis', initials: 'LF', tint: 'from-green-400 to-emerald-600', name: 'Luis Ferreira', business: 'Dealership', location: 'Lisbon, PT', wa: true, score: 91 },
  { img: 'hana', initials: 'HY', tint: 'from-orange-400 to-amber-600', name: 'Hana Yoo', business: 'Freight line', location: 'Busan, KR', wa: false, score: 0 },
  { img: 'marco', initials: 'MB', tint: 'from-cyan-400 to-teal-600', name: 'Marco Bellini', business: 'Local services', location: 'Milan, IT', wa: true, score: 52 },
];

const shieldStage = (t) => (t < 0.09 ? 0 : t < 0.23 ? 1 : t < 0.35 ? 2 : t < 0.47 ? 3 : 4);

const QualityChip = ({ score, active }) => (
  <span className={cn(
    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8.5px] font-bold tabular-nums whitespace-nowrap',
    active && score >= 85 ? 'border-success/35 bg-success/10 text-success' : active && score >= 60 ? 'border-primary/35 bg-primary/10 text-primary' : active ? 'border-warning/40 bg-warning/10 text-warning' : 'border-border/70 bg-background text-text-muted'
  )}>
    <Zap size={9} /> {active ? `${score}%` : 'Quality'}
  </span>
);

const ShieldLeadRow = ({ lead, t, stage, i }) => {
  const shown = t >= 0.04 + i * 0.03;
  const presenceKnown = t >= 0.24 + i * 0.04;
  const qualityKnown = t >= 0.40 + i * 0.035;
  const active = shown && stage >= 1;
  const ready = stage >= 4 && lead.wa && active;

  return (
    <motion.div
      animate={{ opacity: shown ? 1 : 0.35, y: shown ? 0 : 5 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_104px_minmax(0,1.1fr)] items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors duration-300',
        ready ? 'border-primary/40 bg-primary/5' : shown ? 'border-border/60 bg-surface' : 'border-transparent bg-surface/30'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <ProfilePhoto img={lead.img} initials={lead.initials} tint={lead.tint} size="sm" online={active && lead.wa} ping={shown && stage === 0} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-text-primary truncate">{lead.name}</p>
          <p className="text-[9px] text-text-muted truncate">{lead.business}</p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1 text-[9px] text-text-muted truncate">
        <MapPin size={9} className="shrink-0" /> <span className="truncate">{lead.location}</span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
        {stage === 0 && shown && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-text-muted whitespace-nowrap">
            <span className="w-3 h-3 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
            Scanning
          </span>
        )}
        {stage >= 1 && presenceKnown && !lead.wa && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-1.5 py-0.5 text-[8.5px] font-bold text-text-muted whitespace-nowrap">
            <CircleAlert size={9} /> No WhatsApp
          </span>
        )}
        {stage >= 1 && presenceKnown && lead.wa && (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[8.5px] font-bold text-success whitespace-nowrap">
            <Wifi size={9} /> WhatsApp
          </span>
        )}
        {stage >= 2 && <QualityChip score={lead.score} active={lead.wa && qualityKnown} />}
        {stage >= 3 && (
          <span className={cn('inline-flex items-center gap-1 text-[8.5px] font-bold whitespace-nowrap', lead.wa ? 'text-primary' : 'text-text-muted')}>
            <Check size={9} /> {lead.wa ? 'Organized' : 'Excluded'}
          </span>
        )}
        {ready && (
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-bold text-primary whitespace-nowrap"
          >
            <MessageCircle size={9} /> Ready for Agent
          </motion.span>
        )}
      </div>
    </motion.div>
  );
};

const ShieldStat = ({ label, icon: Icon, value, pct }) => (
  <div className="rounded-xl border border-border/70 bg-surface px-2.5 py-2.5 min-w-0">
    <div className="flex items-center justify-between gap-1">
      <span className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted truncate">{label}</span>
      <Icon size={11} className="text-primary/70 shrink-0" />
    </div>
    <p className="mt-1 text-[17px] font-display font-bold text-text-primary tabular-nums leading-none"><Counter value={value} /></p>
    <div className="mt-1.5 h-1 rounded-full bg-background border border-border/50 overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-200 ease-out" style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  </div>
);

export const ShieldScanDemo = ({ clock = null }) => {
  const t = clock ?? useDemoClock(11000, 0.66);
  const stage = shieldStage(t);
  const stageInfo = SHIELD_STAGE_LABELS[stage];

  const scanned = Math.round(1460 * phase(t, 0.02, 0.24));
  const present = Math.round(1108 * phase(t, 0.22, 0.40));
  const valid = Math.round(960 * phase(t, 0.40, 0.54));
  const ready = Math.round(960 * phase(t, 0.52, 0.64));

  const stats = [
    { label: 'Scanned', icon: ScanLine, value: scanned, pct: phase(t, 0.02, 0.26) },
    { label: 'WhatsApp', icon: Wifi, value: present, pct: phase(t, 0.22, 0.42) },
    { label: 'Valid', icon: ShieldCheck, value: valid, pct: phase(t, 0.4, 0.55) },
    { label: 'Ready', icon: MessageCircle, value: ready, pct: phase(t, 0.52, 0.66) },
  ];

  return (
    <DemoWindow
      icon={ShieldCheck}
      title="WhatsApp Shield"
      subtitle="Discover · Validate · Qualify · Organize"
      right={
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold shrink-0', stageInfo.tone)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', stage >= 4 ? 'bg-success' : 'bg-primary animate-pulse')} />
          {stageInfo.label}
        </span>
      }
    >
      <div className="flex h-[520px] overflow-hidden">
        {/* left navigation */}
        <nav className="hidden md:flex flex-col w-[150px] shrink-0 border-r p-2 gap-0.5" style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}>
          <div className="flex items-center gap-1.5 px-1.5 pt-1 pb-2 mb-1 border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="w-5 h-5 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
              <ShieldCheck size={11} className="text-primary" />
            </span>
            <span className="text-[10px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Workspace</span>
          </div>
          {SHIELD_NAV.map((n) => (
            <div
              key={n.label}
              className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-colors duration-200', n.active ? 'bg-primary/10 text-primary border border-primary/25' : 'text-text-muted hover:bg-background/70 border border-transparent')}
            >
              <n.icon size={12} className="shrink-0" />
              <span className="truncate">{n.label}</span>
              {n.badge && (
                <span className="ml-auto w-4 h-4 rounded-full bg-primary/15 text-primary text-[7.5px] font-bold flex items-center justify-center shrink-0">{n.badge}</span>
              )}
            </div>
          ))}
          <div className="mt-auto px-1.5 pt-2">
            <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-1.5">
              <span className="flex items-center gap-1 text-[8.5px] font-semibold text-success">
                <QrCode size={9} /> Connected
              </span>
              <p className="text-[8px] text-text-muted mt-0.5 truncate">WhatsApp #4812-9C</p>
            </div>
          </div>
        </nav>

        {/* main workspace */}
        <main className="flex-1 min-w-0 flex flex-col p-3 sm:p-4 gap-2.5 overflow-hidden">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold leading-tight truncate" style={{ color: 'var(--ma-list-title)' }}>Validation run #4821</p>
              <p className="text-[9px] text-text-muted truncate">CSV imported · 1,460 contacts · normalized</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {SHIELD_STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors duration-300 whitespace-nowrap',
                    i < stage && 'border-success/35 bg-success/10 text-success',
                    i === stage && 'border-primary/50 bg-primary/10 text-primary',
                    i > stage && 'border-border/70 bg-surface text-text-muted'
                  )}
                >
                  {i < stage ? <Check size={8} /> : <span className="text-[7.5px]">{i + 1}</span>}
                  {s}
                </span>
              ))}
            </div>
            <span className={cn('hidden lg:inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold', stage >= 4 ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border/70 bg-background text-text-muted')}>
              <Download size={10} /> Export
            </span>
          </div>

          {/* statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stats.map((s) => <ShieldStat key={s.label} {...s} />)}
          </div>

          {/* lead table */}
          <div className="flex-1 min-h-[220px] rounded-xl border border-border/70 bg-background/40 flex flex-col overflow-hidden">
            <div className="px-2.5 py-1.5 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_104px_minmax(0,1.1fr)] items-center gap-2 border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
              <span className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted">Lead</span>
              <span className="hidden sm:block text-[8.5px] font-bold uppercase tracking-widest text-text-muted">Location</span>
              <span className="text-right text-[8.5px] font-bold uppercase tracking-widest text-text-muted">Status</span>
            </div>
            <div className="relative flex-1 min-h-0 overflow-y-auto landing-scrollbar p-1.5 space-y-1.5">
              {stage < 4 && <div className="ma-scan pointer-events-none absolute inset-x-0 top-0 h-16 opacity-40" aria-hidden="true" />}
              {SHIELD_LEADS.map((lead, i) => (
                <ShieldLeadRow key={lead.name} lead={lead} t={t} stage={stage} i={i} />
              ))}
            </div>
          </div>

          {/* hand-off */}
          <div className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors duration-300', stage >= 4 ? 'border-primary/35 bg-primary/5' : 'border-border/60 bg-surface')}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                <MessageCircle size={13} className="text-primary" />
              </span>
              <div className="min-w-0">
                <p className={cn('text-[10px] font-bold leading-tight truncate', stage >= 4 ? 'text-primary' : 'text-text-muted')}>
                  {stage >= 4 ? '960 qualified leads ready' : 'Preparing qualified leads…'}
                </p>
                <p className="text-[8.5px] text-text-muted truncate">Valid · organized · reachable on WhatsApp</p>
              </div>
            </div>
            <motion.span
              animate={stage >= 4 ? { x: [0, 4, 0] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="shrink-0"
            >
              <ArrowRight size={15} className={stage >= 4 ? 'text-primary' : 'text-text-muted'} />
            </motion.span>
          </div>

          <p className="text-[9px] text-text-muted flex items-center gap-1.5">
            <QrCode size={10} className="shrink-0" /> Connected via QR · validation running
          </p>
        </main>
      </div>
    </DemoWindow>
  );
};

/* ============================================================
   Message Agent — WhatsApp-style 3-pane business inbox
   ============================================================ */

const AGENT_CONVOS = [
  {
    id: 'aisha', name: 'Aisha Rahman', img: 'aisha', initials: 'AR', tint: 'from-rose-400 to-pink-600',
    business: 'Boutique Retail', industry: 'E-Commerce', location: 'Madrid, ES', online: true, lastSeen: 'online',
    unread: 2, lastTime: '09:05',
    statusSteps: ['Qualified lead', 'Messaged', 'AI qualified', 'Replied', 'Follow-up scheduled'],
    qualification: 'AI qualified · interest + ready to meet',
    interest: ['Interest', 'Budget', 'Timing'],
    suggestion: { title: 'Suggested reply', text: 'Offer a 15-minute walkthrough call this week.' },
    followUp: 'Thu · 3:00 PM',
    activity: [
      { icon: ShieldCheck, text: 'Validated via Shield', time: '09:01' },
      { icon: Sparkles, text: 'AI qualification passed', time: '09:02' },
      { icon: CalendarCheck, text: 'Follow-up scheduled', time: 'Thu 3 PM' },
    ],
    msgs: [
      { k: 'u', t: '09:01', text: 'Hi Aisha! Thanks for connecting through WhatsApp Shield.' },
      { k: 'u', t: '09:01', text: 'Would you like a quick overview of Message Agent?' },
      { k: 'c', t: '09:02', text: "Hi! Yes — we're looking for a simpler way to handle inbound leads." },
      { k: 'ai', t: '09:02', text: 'Interest detected · budget signal noted.' },
      { k: 'u', t: '09:03', text: 'Perfect, sending a short overview and pricing now. Is Thursday around 3 PM good for a 15-minute call?' },
      { k: 'c', t: '09:05', text: 'Yes, Thursday at 3 PM works for me.' },
    ],
  },
  {
    id: 'lena', name: 'Lena Vogel', img: 'lena', initials: 'LV', tint: 'from-violet-400 to-purple-600',
    business: 'Clinic Network', industry: 'Healthcare', location: 'Hamburg, DE', online: true, lastSeen: 'online',
    unread: 3, lastTime: '11:24',
    statusSteps: ['Qualified lead', 'Consulting', 'AI qualified', 'Replied', 'Follow-up scheduled'],
    qualification: 'AI qualified · appointment intent',
    interest: ['Consent', 'Opt-in', 'Timing'],
    suggestion: { title: 'Suggested reply', text: 'Send appointment message now.' },
    followUp: 'Mon · 10:00 AM',
    activity: [
      { icon: ShieldCheck, text: 'Validated via Shield', time: '11:20' },
      { icon: Sparkles, text: 'Opt-in confirmed', time: '11:21' },
      { icon: CalendarCheck, text: 'Appointment slot held', time: 'Mon 10 AM' },
    ],
    msgs: [
      { k: 'c', t: '11:20', text: 'We need to reach patients who actually opted in.' },
      { k: 'u', t: '11:21', text: 'Shield already validated the list — everyone here is reachable.' },
      { k: 'ai', t: '11:21', text: 'Consent confirmed · appointment question detected.' },
      { k: 'c', t: '11:23', text: 'Perfect. When can you send the appointment message?' },
      { k: 'u', t: '11:24', text: 'Sending it now — you will see it in your Sent folder.' },
    ],
  },
  {
    id: 'omar', name: 'Omar Farouk', img: 'omar', initials: 'OF', tint: 'from-teal-400 to-cyan-600',
    business: 'Growth Team', industry: 'Sales Teams', location: 'Cairo, EG', online: false, lastSeen: 'last seen 21:40',
    unread: 1, lastTime: '12:06',
    statusSteps: ['Qualified lead', 'Consulting', 'AI qualified', 'Replied', 'Follow-up scheduled'],
    qualification: 'AI qualified · warm pipeline lead',
    interest: ['Pipeline', 'Owner', 'Timing'],
    suggestion: { title: 'Suggested reply', text: 'Send a quick walkthrough of lead statuses.' },
    followUp: 'Tomorrow · 9:30 AM',
    activity: [
      { icon: ShieldCheck, text: 'Validated via Shield', time: '12:00' },
      { icon: Sparkles, text: 'Pipeline intent detected', time: '12:02' },
      { icon: CalendarCheck, text: 'Status review set', time: '9:30 AM' },
    ],
    msgs: [
      { k: 'ai', t: '12:00', text: 'Quality lead from Shield · wants a cleaner follow-up flow.' },
      { k: 'c', t: '12:01', text: 'We need every rep to keep warm leads moving without endless standups.' },
      { k: 'u', t: '12:03', text: 'Message Agent gives each lead a status and an owner — exactly that.' },
      { k: 'c', t: '12:05', text: 'Nice. Can you show how statuses update after a reply?' },
      { k: 'u', t: '12:06', text: 'Sure — statuses move automatically as conversations progress.' },
    ],
  },
];

const AGENT_EXTRA = [
  { img: 'daniel', initials: 'DM', name: 'Daniel Moreau', business: 'Property agency', lastTime: '10:12', unread: 0, muted: true, text: 'You: Let me send you the listing batch.' },
  { img: 'priya', initials: 'PS', name: 'Priya Sharma', business: 'Marketing agency', lastTime: 'Wed', unread: 1, text: 'Reporting template looks great — thanks!' },
];

const threadReveals = (n, i) => ((i + 1) / (n + 1)) * 0.8;

const ThreadBubble = ({ m, groupTop, groupBottom, read, finalMine }) => {
  const mine = m.k === 'u';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.34, ease: 'easeOut' }}
      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn('max-w-[86%] sm:max-w-[82%] rounded-xl px-2.5 py-1.5 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm', groupTop && 'rounded-t-md', groupBottom && 'rounded-b-md', m.k === 'ai' && 'border')}
        style={{
          backgroundColor: m.k === 'ai' ? 'var(--ma-bubble-ai)' : mine ? 'var(--ma-bubble-sent)' : 'var(--ma-bubble-received)',
          borderColor: m.k === 'ai' ? 'var(--ma-bubble-ai-border)' : undefined,
          color: 'var(--ma-list-title)',
        }}
      >
        {m.k === 'ai' && (
          <div className="flex items-center gap-1 mb-0.5">
            <Bot size={10} style={{ color: 'var(--ma-accent)' }} />
            <span className="text-[8.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ma-accent)' }}>AI Agent</span>
          </div>
        )}
        <p className="text-[11px] leading-relaxed">{m.text}</p>
        {m.t && (
          <div className="flex items-center justify-end gap-1 mt-0.5" style={{ color: 'var(--ma-muted-text)' }}>
            <span className="text-[8px]">{m.t}</span>
            {mine && (
              read && finalMine ? (
                <CheckCheck size={10} style={{ color: 'var(--ma-accent)' }} />
              ) : (
                <Check size={10} />
              )
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const AgentThread = ({ convo, local }) => {
  const reduce = useReducedMotion();
  const scrollRef = useRef(null);
  const n = convo.msgs.length;
  const shown = convo.msgs.filter((_, i) => local >= threadReveals(n, i)).length;
  const read = shown >= n;
  const pending = shown < n ? convo.msgs[shown] : null;
  const typing = !!pending && pending.k !== 'u';
  const aiSuggested = !read && convo.msgs.some((m, i) => m.k === 'ai' && i < shown && !(convo.msgs[i + 1] && convo.msgs[i + 1].k === 'u' && i + 1 < shown));
  const lastMineIdx = convo.msgs.reduce((acc, m, i) => (m.k === 'u' && i < shown ? i : acc), -1);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, reduce]);

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto landing-scrollbar" style={{ ...CHAT_PATTERN, backgroundColor: 'var(--ma-bg-root)' }}>
      <div className="min-h-full flex flex-col justify-end gap-1 px-3 py-3">
        <AnimatePresence initial={false}>
          {convo.msgs.slice(0, shown).map((m, i) => {
            const prev = i > 0 ? convo.msgs[i - 1] : null;
            const next = i + 1 < shown ? convo.msgs[i + 1] : null;
            const sameAsPrev = prev && prev.k === m.k;
            const sameAsNext = next && next.k === m.k;
            return (
              <ThreadBubble
                key={`${m.k}-${i}`}
                m={m}
                groupTop={sameAsPrev}
                groupBottom={sameAsNext}
                read={read}
                finalMine={i === lastMineIdx}
              />
            );
          })}
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-start">
              <div className="rounded-xl rounded-tl-sm px-3 py-2 shadow-sm" style={{ backgroundColor: 'var(--ma-bubble-received)' }}>
                <TypingDots />
              </div>
            </motion.div>
          )}
          {aiSuggested && (
            <motion.div
              key="suggest"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center"
            >
              <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 max-w-[92%]">
                <Sparkles size={10} className="text-primary shrink-0" />
                <span className="text-[9px] font-semibold text-text-primary truncate">{convo.suggestion.title}: {convo.suggestion.text}</span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center ml-1 shrink-0" style={{ backgroundColor: 'var(--ma-accent)' }}>
                  <Send size={8} className="text-white" />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const AgentListRow = ({ convo, active, local, onSelect }) => {
  const n = convo.msgs.length;
  const shown = convo.msgs.filter((_, i) => local >= threadReveals(n, i)).length;
  const preview = shown > 0 ? convo.msgs[shown - 1] : convo.msgs[convo.msgs.length - 1];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg border text-left transition-colors duration-200', active ? 'border-primary/30 bg-primary/5' : 'border-transparent hover:bg-background/60')}
    >
      <ProfilePhoto img={convo.img} initials={convo.initials} tint={convo.tint} size="sm" online={convo.online} ping={active} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] font-bold text-text-primary truncate">{convo.name}</p>
          <span className="text-[8px] text-text-muted shrink-0 tabular-nums">{convo.lastTime}</span>
        </div>
        <p className="text-[9px] text-text-secondary truncate leading-snug">
          {shown > 0 ? `${preview.k === 'u' ? 'You: ' : ''}${preview.text}` : 'New from Shield…'}
        </p>
      </div>
      {active ? (
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: 'var(--ma-accent)' }}>
          <Check size={10} className="text-white" />
        </span>
      ) : convo.unread > 0 ? (
        <span className="h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: 'var(--ma-accent)' }}>
          {convo.unread}
        </span>
      ) : (
        <EllipsisVertical size={13} className="text-text-muted shrink-0" />
      )}
    </button>
  );
};

const AgentChatList = ({ locals, activeIndex }) => (
  <div className="flex-1 min-h-0 overflow-y-auto landing-scrollbar px-1.5 py-1.5 space-y-0.5">
    {AGENT_CONVOS.map((c, i) => (
      <AgentListRow key={c.id} convo={c} active={i === activeIndex} local={locals[i]} />
    ))}
    {AGENT_EXTRA.map((c) => (
      <button type="button" key={c.name} className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg border text-left', c.muted ? 'opacity-55' : 'border-transparent hover:bg-background/60')}>
        <ProfilePhoto img={c.img} initials={c.initials} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] font-semibold text-text-primary truncate">{c.name}</p>
            <span className="text-[8px] text-text-muted shrink-0 tabular-nums">{c.lastTime}</span>
          </div>
          <p className="text-[9px] text-text-secondary truncate leading-snug">{c.text}</p>
        </div>
        {c.unread > 0 && (
          <span className="h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: 'var(--ma-accent)' }}>
            {c.unread}
          </span>
        )}
      </button>
    ))}
  </div>
);

const AgentInfoPanel = ({ convo, local, statusIdx, isDone }) => (
  <div className="flex-1 min-h-0 overflow-y-auto landing-scrollbar">
    <div className="px-3 py-2.5 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
      <ProfilePhoto img={convo.img} initials={convo.initials} tint={convo.tint} size="lg" online={convo.online} />
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-text-primary truncate">{convo.name}</p>
        <p className="text-[9px] text-text-muted truncate">{convo.business}</p>
      </div>
    </div>
    <div className="px-3 py-2.5 border-b space-y-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
      <div>
        <p className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted mb-1">Lead status</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> {convo.statusSteps[statusIdx]}
        </span>
      </div>
      {[
        [UserCheck, 'Qualification', convo.qualification],
        [Tags, 'Industry', convo.industry],
        [MapPin, 'Location', convo.location],
      ].map(([Icon, label, value]) => (
        <div key={label} className="flex items-start gap-1.5">
          <Icon size={11} className="mt-0.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
            <p className="text-[9.5px] text-text-primary leading-tight">{value}</p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={11} className="text-primary shrink-0" />
        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[8px] font-bold text-success">Source: Shield</span>
      </div>
    </div>
    <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
      <p className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Interest signals</p>
      <div className="flex flex-wrap gap-1">
        {convo.interest.map((tag) => (
          <motion.span
            key={tag}
            animate={{ opacity: local >= 0.2 ? 1 : 0.35, scale: local >= 0.2 ? 1 : 0.95 }}
            transition={{ duration: 0.3 }}
            className="rounded-full border border-primary/25 bg-primary/5 px-1.5 py-0.5 text-[8.5px] font-semibold text-primary"
          >
            {tag}
          </motion.span>
        ))}
      </div>
    </div>
    <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
      <p className="text-[8.5px] font-bold uppercase tracking-widest flex items-center gap-1 text-text-muted mb-1.5">
        <CalendarClock size={10} /> Follow-up
      </p>
      <p className="text-[10px] text-text-primary font-semibold">{convo.followUp}</p>
    </div>
    <div className="px-3 py-2.5">
      <p className="text-[8.5px] font-bold uppercase tracking-widest flex items-center gap-1 text-text-muted mb-1.5">
        <ClipboardList size={10} /> Notes / activity
      </p>
      <div className="space-y-1.5">
        {convo.activity.map((row, i) => {
          const on = local >= 0.12 + i * 0.24;
          return (
            <motion.div key={row.text} animate={{ opacity: on ? 1 : 0.3, x: on ? 0 : -4 }} transition={{ duration: 0.3 }} className="flex items-center gap-1.5">
              <row.icon size={10} className="text-primary shrink-0" />
              <span className="text-[9px] text-text-secondary truncate min-w-0">{row.text}</span>
              <span className="ml-auto text-[8px] tabular-nums shrink-0" style={{ color: 'var(--ma-muted-text)' }}>{row.time}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-2">
        <p className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted mb-1">{isDone ? 'Status updated' : 'Next action'}</p>
        <p className="text-[9px] text-text-secondary leading-snug">{isDone ? 'Lead marked as follow-up scheduled.' : 'Draft the first response to qualify faster.'}</p>
      </div>
    </div>
  </div>
);

export const AgentChatDemo = ({ clock = null }) => {
  const t = clock ?? useDemoClock(17000, 0.72);
  const [drawer, setDrawer] = useState(null);
  const locals = [
    clamp01(phase(t, 0.34, 0.60)),
    clamp01(phase(t, 0.60, 0.84)),
    clamp01(phase(t, 0.82, 1.06)),
  ];
  const activeIndex = t < 0.60 ? 0 : t < 0.84 ? 1 : 2;
  const active = AGENT_CONVOS[activeIndex];
  const local = locals[activeIndex];
  const statusIdx = Math.min(active.statusSteps.length - 1, Math.floor(clamp01(local) * active.statusSteps.length));
  const isDone = local >= 1;

  return (
    <DemoWindow
      icon={MessageCircle}
      title="Message Agent"
      subtitle="Conversation workspace"
      right={
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[9px] font-bold text-primary shrink-0">
          <Sparkles size={9} /> {active.statusSteps[statusIdx]}
        </span>
      }
    >
      <div className="relative flex h-[520px] overflow-hidden">
        {/* LEFT — chat sidebar */}
        <aside className="hidden sm:flex flex-col w-[170px] lg:w-[186px] shrink-0 border-r min-w-0" style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}>
          <div className="px-2 pt-2 pb-1.5 flex items-center justify-between gap-1 shrink-0">
            <span className="flex items-center gap-1.5 text-[10px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>
              <MessageCircle size={12} className="text-primary shrink-0" /> Inbox
            </span>
            <span className="rounded-full bg-primary/15 text-primary text-[8px] font-bold px-1.5 py-0.5 shrink-0">3</span>
          </div>
          <div className="px-2 pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 border" style={{ backgroundColor: 'var(--ma-bg-elevated)', borderColor: 'var(--ma-line-slim)' }}>
              <Search size={11} style={{ color: 'var(--ma-muted-text)' }} />
              <span className="text-[9.5px] truncate" style={{ color: 'var(--ma-muted-text)' }}>Search or start chat</span>
            </div>
          </div>
          <AgentChatList locals={locals} activeIndex={activeIndex} />
          <div className="px-2 py-2 border-t shrink-0" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="flex items-center gap-1.5 text-[8.5px] font-semibold text-primary">
              <ShieldCheck size={10} /> Synced with Shield
            </span>
          </div>
        </aside>

        {/* CENTER — conversation */}
        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* mobile action bar */}
          <div className="flex sm:hidden items-center justify-between gap-2 px-2 py-1.5 border-b shrink-0" style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}>
            <button type="button" onClick={() => setDrawer(drawer === 'list' ? null : 'list')} className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[9.5px] font-bold text-text-muted">
              <Search size={10} /> Contacts
            </button>
            <span className="text-[10px] font-bold text-text-primary truncate">{active.name}</span>
            <button type="button" onClick={() => setDrawer(drawer === 'info' ? null : 'info')} className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[9.5px] font-bold text-text-muted">
              Info
            </button>
          </div>

          {/* conversation header */}
          <div className="flex items-center gap-2.5 px-3 py-2 border-b shrink-0" style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}>
            <ProfilePhoto img={active.img} initials={active.initials} tint={active.tint} size="md" online={active.online} ping={local < 0.25} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold truncate leading-tight" style={{ color: 'var(--ma-list-title)' }}>{active.name}</p>
              <p className="text-[9.5px] truncate leading-tight text-success">{active.lastSeen}</p>
            </div>
            <span className="hidden sm:flex items-center gap-2.5 shrink-0" style={{ color: 'var(--ma-muted-text)' }}>
              <Phone size={13} />
              <Video size={13} />
              <EllipsisVertical size={14} />
            </span>
          </div>

          <motion.div
            key={active.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <AgentThread convo={active} local={local} />

            {/* follow-up strip */}
            <div className="px-3 py-1.5 border-t flex items-center gap-2 shrink-0" style={{ borderColor: 'var(--ma-line-slim)' }}>
              <AnimatePresence initial={false}>
                {isDone ? (
                  <motion.span
                    key="followup"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[9.5px] font-bold text-primary"
                  >
                    <CalendarCheck size={11} /> Follow-up scheduled · {active.followUp}
                  </motion.span>
                ) : (
                  <span key="hint" className="inline-flex items-center gap-1.5 text-[9.5px] text-text-muted">
                    <Clock size={11} /> Status updates as the conversation moves
                  </span>
                )}
              </AnimatePresence>
            </div>

            {/* composer */}
            <div className="px-3 py-2 flex items-center gap-2 border-t shrink-0" style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}>
              <span className="shrink-0" style={{ color: 'var(--ma-muted-text)' }}>
                <Paperclip size={14} />
              </span>
              <div className="flex-1 flex items-center justify-between rounded-full px-3 py-1.5 min-w-0" style={{ backgroundColor: 'var(--ma-bg-elevated)' }}>
                <span className="text-[10.5px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{isDone ? 'Type a message…' : 'Reading conversation…'}</span>
                <Smile size={13} className="shrink-0" style={{ color: 'var(--ma-muted-text)' }} />
              </div>
              <span className="shrink-0" style={{ color: 'var(--ma-muted-text)' }}>
                <Mic size={14} />
              </span>
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--ma-accent)' }}>
                <Send size={12} className="text-white" />
              </span>
            </div>
          </motion.div>
        </section>

        {/* RIGHT — lead info */}
        <aside className="hidden lg:flex flex-col w-[196px] shrink-0 border-l min-w-0" style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}>
          <AgentInfoPanel key={active.id} convo={active} local={local} statusIdx={statusIdx} isDone={isDone} />
        </aside>

        {/* mobile drawers */}
        <AnimatePresence initial={false}>
          {drawer && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-20 bg-black/45 sm:hidden"
                onClick={() => setDrawer(null)}
              />
              <motion.aside
                key={`panel-${drawer}`}
                initial={{ x: drawer === 'list' ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: drawer === 'list' ? '-100%' : '100%' }}
                transition={{ type: 'tween', duration: 0.24 }}
                className={cn('absolute top-0 bottom-0 z-30 w-[80%] max-w-[300px] sm:hidden flex flex-col', drawer === 'list' ? 'left-0 border-r' : 'right-0 border-l')}
                style={{ backgroundColor: 'var(--ma-bg-panel)' }}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0" style={{ borderColor: 'var(--ma-line-slim)' }}>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--ma-list-title)' }}>{drawer === 'list' ? 'Conversations' : 'Lead info'}</span>
                  <button type="button" onClick={() => setDrawer(null)} className="rounded-full border border-border/60 p-1" aria-label="Close panel">
                    <X size={12} className="text-text-muted" />
                  </button>
                </div>
                {drawer === 'list' ? (
                  <AgentChatList locals={locals} activeIndex={activeIndex} />
                ) : (
                  <AgentInfoPanel convo={active} local={local} statusIdx={statusIdx} isDone={isDone} />
                )}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </DemoWindow>
  );
};

/* ============================================================
   WhatsApp-style customer stories
   ------------------------------------------------------------
   Each conversation is a data record so verified testimonials
   can be loaded from an API / CMS / database without redesigning
   the component. Flow tokens: 'c' customer message · 'u' our
   reply · 'typing' indicator · 'stars' rating reveal · 'read'
   handshake. Each card runs its own independent, self-timed
   loop — no scroll listeners and no shared playback clock.
   ============================================================ */

export const TESTIMONIAL_CHATS = [
  {
    id: 'ecommerce', category: 'E-Commerce', name: 'Aisha Rahman', role: 'Online store owner',
    img: 'aisha', initials: 'AR', tint: 'from-rose-400 to-pink-600',
    when: '2h ago', outcome: 'more qualified inquiries', verified: false,
    pace: 1500, startIn: 120,
    flow: [
      { k: 'c', t: '09:12', text: 'Hi! We used Shield to reach buyers who were actually reachable for the store.' },
      { k: 'typing' },
      { k: 'u', t: '09:13', text: 'Thank you for the update! Glad the validated list made outreach easier.' },
      { k: 'c', t: '09:14', text: 'The best part was that Message Agent kept every reply in one place.' },
      { k: 'typing' },
      { k: 'u', t: '09:14', text: 'That is exactly what we built it for. Anything we can improve?' },
      { k: 'c', t: '09:15', text: 'Not really — the follow-up reminders are a big win for us.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '09:16', text: 'Really appreciate the kind words. More seats are ready whenever you expand.' },
      { k: 'read' },
    ],
  },
  {
    id: 'realestate', category: 'Real Estate', name: 'Daniel Moreau', role: 'Property agency',
    img: 'daniel', initials: 'DM', tint: 'from-sky-400 to-blue-600',
    when: 'Yesterday', outcome: 'better lead quality', verified: false,
    pace: 1640, startIn: 420,
    flow: [
      { k: 'c', t: '15:02', text: 'We imported a messy CSV of property leads and let Shield clean it.' },
      { k: 'typing' },
      { k: 'u', t: '15:03', text: 'Great to hear! Duplicates and dead numbers are usually the biggest win there.' },
      { k: 'c', t: '15:04', text: 'It filtered out a lot of dead numbers — we stopped wasting agent time.' },
      { k: 'typing' },
      { k: 'u', t: '15:04', text: 'That is exactly the point. More reachable buyers, fewer awkward calls.' },
      { k: 'c', t: '15:06', text: 'And the follow-ups through your team felt very natural to manage.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '15:07', text: 'Thank you! Happy to help with your next campaign list.' },
      { k: 'read' },
    ],
  },
  {
    id: 'marketing', category: 'Marketing Agency', name: 'Priya Sharma', role: 'Agency founder',
    img: 'priya', initials: 'PS', tint: 'from-violet-400 to-purple-600',
    when: '3 days ago', outcome: 'faster client reporting', verified: false,
    pace: 1480, startIn: 740,
    flow: [
      { k: 'c', t: '11:31', text: 'We manage lists for several clients, and cleaning was eating hours.' },
      { k: 'typing' },
      { k: 'u', t: '11:32', text: 'Totally relatable. Shield is built for exactly this workflow.' },
      { k: 'c', t: '11:33', text: 'Now validation runs in minutes and exports drop straight into reports.' },
      { k: 'typing' },
      { k: 'u', t: '11:33', text: 'Love that — same-day reporting for your clients must feel great.' },
      { k: 'c', t: '11:35', text: 'Our team basically treats it as our onboarding checklist now.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '11:36', text: 'That means a lot. Thank you for the thoughtful feedback!' },
      { k: 'read' },
    ],
  },
  {
    id: 'saas', category: 'Technology / SaaS', name: 'Tomas Novak', role: 'Growth lead',
    img: 'tomas', initials: 'TN', tint: 'from-cyan-400 to-indigo-600',
    when: 'Yesterday', outcome: 'a more organized pipeline', verified: false,
    pace: 1720, startIn: 1010,
    flow: [
      { k: 'c', t: '10:20', text: 'Inbound volume spikes each launch — keeping numbers clean was the bottleneck.' },
      { k: 'typing' },
      { k: 'u', t: '10:21', text: 'Spikes are brutal. Routing them through Shield first keeps things tidy.' },
      { k: 'c', t: '10:22', text: 'Then Message Agent organizes every follow-up in one thread. Very smooth.' },
      { k: 'typing' },
      { k: 'u', t: '10:22', text: 'Happy to hear the flow feels native. Any friction to report?' },
      { k: 'c', t: '10:24', text: 'Honestly none — it just slots into our weekly cadence.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '10:25', text: 'Music to our ears. Ping us when you need more seats.' },
      { k: 'read' },
    ],
  },
  {
    id: 'healthcare', category: 'Healthcare', name: 'Dr. Farah Noor', role: 'Clinic manager',
    img: 'farah', initials: 'FN', tint: 'from-emerald-400 to-teal-600',
    when: '4 days ago', outcome: 'more appointment requests', verified: false,
    pace: 1560, startIn: 1330,
    flow: [
      { k: 'c', t: '08:44', text: 'We needed to reach patients who had actually opted in and were reachable.' },
      { k: 'typing' },
      { k: 'u', t: '08:45', text: 'That is the exact use case Shield was built for.' },
      { k: 'c', t: '08:46', text: 'The validation run respected our consent lists, which mattered a lot.' },
      { k: 'typing' },
      { k: 'u', t: '08:46', text: 'Privacy-first was a hard requirement — good to hear it holds up.' },
      { k: 'c', t: '08:48', text: 'Fewer wasted messages, and more patients actually booked.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '08:49', text: 'Thank you. Wishing you many smooth appointment weeks!' },
      { k: 'read' },
    ],
  },
  {
    id: 'education', category: 'Education', name: 'Adeyemi Okafor', role: 'Academy director',
    img: 'adeyemi', initials: 'AO', tint: 'from-amber-400 to-orange-600',
    when: '2h ago', outcome: 'warmer enrollment leads', verified: false,
    pace: 1430, startIn: 1560,
    flow: [
      { k: 'c', t: '12:10', text: 'Our enrollment lists mixed old and new contacts. Nightmare to follow up.' },
      { k: 'typing' },
      { k: 'u', t: '12:11', text: 'We see that often — fresh and stale numbers mixed together.' },
      { k: 'c', t: '12:12', text: 'After validation, parents actually replied to the follow-ups.' },
      { k: 'typing' },
      { k: 'u', t: '12:12', text: 'That is the outcome we love to hear about.' },
      { k: 'c', t: '12:14', text: 'The chat view keeps every reply visible for our admissions team.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '12:15', text: 'Thank you! Reach out anytime as you enroll the next batch.' },
      { k: 'read' },
    ],
  },
  {
    id: 'automotive', category: 'Automotive', name: 'Luis Ferreira', role: 'Dealership',
    img: 'luis', initials: 'LF', tint: 'from-green-400 to-emerald-600',
    when: 'Yesterday', outcome: 'more showroom visits', verified: false,
    pace: 1490, startIn: 1890,
    flow: [
      { k: 'c', t: '16:05', text: 'We tested Shield on a small batch of test-drive leads first.' },
      { k: 'typing' },
      { k: 'u', t: '16:06', text: 'Smart way to start — a small batch keeps it easy to compare.' },
      { k: 'c', t: '16:07', text: 'Validated leads replied far more often about test drives.' },
      { k: 'typing' },
      { k: 'u', t: '16:07', text: 'That reply rate is what turns lists into showroom footfall.' },
      { k: 'c', t: '16:09', text: 'And the follow-ups in Message Agent were effortless.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '16:10', text: 'Thank you! Hope the showroom stays busy.' },
      { k: 'read' },
    ],
  },
  {
    id: 'logistics', category: 'Logistics', name: 'Hana Yoo', role: 'Freight coordinator',
    img: 'hana', initials: 'HY', tint: 'from-orange-400 to-amber-600',
    when: '3 days ago', outcome: 'reachable B2B contacts', verified: false,
    pace: 1610, startIn: 2140,
    flow: [
      { k: 'c', t: '09:50', text: 'B2B outreach only works when the number on the other end is real.' },
      { k: 'typing' },
      { k: 'u', t: '09:51', text: 'Absolutely — dead numbers kill cold outreach instantly.' },
      { k: 'c', t: '09:52', text: "Shield's presence check saved us from a pile of dead-end messages." },
      { k: 'typing' },
      { k: 'u', t: '09:52', text: 'That is one of our favorite flags to hear about.' },
      { k: 'c', t: '09:54', text: 'The organized exports also landed cleanly in our CRM.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '09:55', text: 'Thank you! Glad it slots into your existing tools.' },
      { k: 'read' },
    ],
  },
  {
    id: 'local', category: 'Local Business', name: 'Marco Bellini', role: 'Local services',
    img: 'marco', initials: 'MB', tint: 'from-lime-400 to-green-600',
    when: '5 days ago', outcome: 'nearby customers reached', verified: false,
    pace: 1520, startIn: 2380,
    flow: [
      { k: 'c', t: '14:23', text: 'I only needed local customers, not a giant list.' },
      { k: 'typing' },
      { k: 'u', t: '14:24', text: 'Good instinct — small, validated lists usually perform best.' },
      { k: 'c', t: '14:25', text: 'Following up one by one brought me repeat work.' },
      { k: 'typing' },
      { k: 'u', t: '14:25', text: 'Repeat work is the best kind of win for a local business.' },
      { k: 'c', t: '14:27', text: 'Even the number check on local leads felt spot-on.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '14:28', text: 'Thank you! Here is to more returning customers.' },
      { k: 'read' },
    ],
  },
  {
    id: 'services', category: 'Professional Services', name: 'Sofia Lindqvist', role: 'Consultant',
    img: 'sofia', initials: 'SL', tint: 'from-slate-400 to-slate-600',
    when: 'Yesterday', outcome: 'follow-ups that convert', verified: false,
    pace: 1750, startIn: 2620,
    flow: [
      { k: 'c', t: '13:05', text: 'The follow-up reminder alone changed how I run outreach.' },
      { k: 'typing' },
      { k: 'u', t: '13:06', text: 'Timely follow-up is such an underrated lever — love that it landed.' },
      { k: 'c', t: '13:07', text: 'Leads that used to go quiet now get a second message from me.' },
      { k: 'typing' },
      { k: 'u', t: '13:07', text: 'That second message is where most conversions actually happen.' },
      { k: 'c', t: '13:09', text: 'Consults are easier to book when nothing slips between the cracks.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '13:10', text: 'Thank you! Wishing you a fully booked calendar.' },
      { k: 'read' },
    ],
  },
  {
    id: 'sales', category: 'Sales Teams', name: 'Omar Farouk', role: 'Sales lead',
    img: 'omar', initials: 'OF', tint: 'from-teal-400 to-cyan-600',
    when: '6 days ago', outcome: 'clearer lead status', verified: false,
    pace: 1460, startIn: 2860,
    flow: [
      { k: 'c', t: '17:40', text: 'We had no visibility on which of our leads were still warm.' },
      { k: 'typing' },
      { k: 'u', t: '17:41', text: 'Visibility is the first thing teams ask us for.' },
      { k: 'c', t: '17:42', text: 'Now every lead has a status and an owner on the team.' },
      { k: 'typing' },
      { k: 'u', t: '17:42', text: 'That alone shortens most standups considerably.' },
      { k: 'c', t: '17:44', text: 'Handoffs between reps finally feel clean.' },
      { k: 'typing' },
      { k: 'stars' },
      { k: 'u', t: '17:45', text: 'Thank you! Happy selling with your new pipeline.' },
      { k: 'read' },
    ],
  },
];

/* ============================================================
   WhatsApp-style rotating testimonial pool
   ============================================================ */

const TESTIMONIAL_PERSONAS = [
  ...TESTIMONIAL_CHATS.map(({ id, name, role, category, img, initials, tint }) => ({ id, name, role, category, img, initials, tint })),
  { id: 'lena', name: 'Lena Vogel', role: 'Practice manager', category: 'Healthcare', img: 'lena', initials: 'LV', tint: 'from-fuchsia-400 to-purple-600' },
  { id: 'aisha2', name: 'Aisha Patel', role: 'Growth lead', category: 'SaaS', img: 'aisha', initials: 'AP', tint: 'from-rose-400 to-pink-600' },
  { id: 'aisha3', name: 'Aisha Kim', role: 'Brand manager', category: 'Marketing', img: 'aisha', initials: 'AK', tint: 'from-rose-400 to-pink-600' },
  { id: 'daniel2', name: 'Daniel Okafor', role: 'Sales director', category: 'Sales', img: 'daniel', initials: 'DO', tint: 'from-sky-400 to-blue-600' },
  { id: 'daniel3', name: 'Daniel Cruz', role: 'Consultant', category: 'Professional Services', img: 'daniel', initials: 'DC', tint: 'from-sky-400 to-blue-600' },
  { id: 'priya2', name: 'Priya Nair', role: 'Product lead', category: 'Product', img: 'priya', initials: 'PN', tint: 'from-violet-400 to-purple-600' },
  { id: 'priya3', name: 'Priya Singh', role: 'Content strategist', category: 'Media', img: 'priya', initials: 'PS', tint: 'from-violet-400 to-purple-600' },
  { id: 'tomas2', name: 'Tomas Weber', role: 'CTO', category: 'Engineering', img: 'tomas', initials: 'TW', tint: 'from-cyan-400 to-indigo-600' },
  { id: 'tomas3', name: 'Tomas Berg', role: 'Founder', category: 'Startup', img: 'tomas', initials: 'TB', tint: 'from-cyan-400 to-indigo-600' },
  { id: 'farah2', name: 'Farah Amin', role: 'Operations head', category: 'Healthcare', img: 'farah', initials: 'FA', tint: 'from-emerald-400 to-teal-600' },
  { id: 'farah3', name: 'Farah Yusuf', role: 'Patient advocate', category: 'Healthcare', img: 'farah', initials: 'FY', tint: 'from-emerald-400 to-teal-600' },
  { id: 'adeyemi2', name: 'Adeyemi Cole', role: 'Training lead', category: 'EdTech', img: 'adeyemi', initials: 'AC', tint: 'from-amber-400 to-orange-600' },
  { id: 'adeyemi3', name: 'Adeyemi Banks', role: 'Curriculum designer', category: 'Education', img: 'adeyemi', initials: 'AB', tint: 'from-amber-400 to-orange-600' },
  { id: 'luis2', name: 'Luis Santos', role: 'Fleet manager', category: 'Logistics', img: 'luis', initials: 'LS', tint: 'from-green-400 to-emerald-600' },
  { id: 'luis3', name: 'Luis Oliveira', role: 'Service director', category: 'Automotive', img: 'luis', initials: 'LO', tint: 'from-green-400 to-emerald-600' },
  { id: 'hana2', name: 'Hana Park', role: 'Supply lead', category: 'Logistics', img: 'hana', initials: 'HP', tint: 'from-orange-400 to-amber-600' },
  { id: 'hana3', name: 'Hana Cho', role: 'Warehouse ops', category: 'Supply Chain', img: 'hana', initials: 'HC', tint: 'from-orange-400 to-amber-600' },
  { id: 'marco2', name: 'Marco Rossi', role: 'Franchise owner', category: 'Retail', img: 'marco', initials: 'MR', tint: 'from-lime-400 to-green-600' },
  { id: 'marco3', name: 'Marco Bianchi', role: 'Event organizer', category: 'Hospitality', img: 'marco', initials: 'MB', tint: 'from-lime-400 to-green-600' },
  { id: 'sofia2', name: 'Sofia Muller', role: 'Account director', category: 'Sales', img: 'sofia', initials: 'SM', tint: 'from-slate-400 to-slate-600' },
  { id: 'sofia3', name: 'Sofia Werner', role: 'Project lead', category: 'Professional Services', img: 'sofia', initials: 'SW', tint: 'from-slate-400 to-slate-600' },
  { id: 'omar2', name: 'Omar Hassan', role: 'RevOps manager', category: 'Operations', img: 'omar', initials: 'OH', tint: 'from-teal-400 to-cyan-600' },
  { id: 'omar3', name: 'Omar Khalil', role: 'Enablement lead', category: 'Sales', img: 'omar', initials: 'OK', tint: 'from-teal-400 to-cyan-600' },
  { id: 'lena2', name: 'Lena Krause', role: 'Clinic director', category: 'Healthcare', img: 'lena', initials: 'LK', tint: 'from-fuchsia-400 to-purple-600' },
  { id: 'lena3', name: 'Lena Fischer', role: 'Compliance lead', category: 'Healthcare', img: 'lena', initials: 'LF', tint: 'from-fuchsia-400 to-purple-600' },
  { id: 'aisha4', name: 'Aisha Costa', role: 'Health coach', category: 'Wellness', img: 'aisha', initials: 'AC', tint: 'from-rose-400 to-pink-600' },
  { id: 'daniel4', name: 'Daniel Reid', role: 'Investor', category: 'Real Estate', img: 'daniel', initials: 'DR', tint: 'from-sky-400 to-blue-600' },
  { id: 'tomas4', name: 'Tomas Park', role: 'Product manager', category: 'Tech', img: 'tomas', initials: 'TP', tint: 'from-cyan-400 to-indigo-600' },
  { id: 'sofia4', name: 'Sofia Ali', role: 'HR director', category: 'People', img: 'sofia', initials: 'SA', tint: 'from-slate-400 to-slate-600' },
  { id: 'omar4', name: 'Omar Wells', role: 'Marketing VP', category: 'Growth', img: 'omar', initials: 'OW', tint: 'from-teal-400 to-cyan-600' },
];

const TESTIMONIAL_CONVERSATIONS = TESTIMONIAL_CHATS.map(({ flow, pace }) => ({ flow, pace }));

const TESTIMONIAL_TIMES = ['just now', '8m ago', '24m ago', '1h ago', '2h ago', 'Today', 'Yesterday', '2 days ago', '3 days ago', 'This week', 'Last week', '2 weeks ago'];

const TESTIMONIAL_OUTCOMES = [
  'more qualified inquiries', 'better lead quality', 'a more organized pipeline', 'faster follow-ups',
  'reachable contacts only', 'cleaner handoffs', 'warmer conversations', 'no follow-ups missed',
  'clearer lead status', 'less time on dead numbers', 'steadier reply flow', 'a tidier contact list',
  'higher reply rates', 'more showroom visits', 'faster reporting', 'warmer enrollment leads',
  'smoother team handoffs', 'stronger local reach',
];

const TESTIMONIAL_BADGES = [
  { icon: ShieldCheck, label: 'Validated' },
  { icon: BadgeCheck, label: 'WhatsApp active' },
  { icon: Zap, label: 'Fast follow-up' },
  { icon: Activity, label: 'Live thread' },
  { icon: CheckCheck, label: 'Read' },
  { icon: TrendingUp, label: 'High intent' },
  { icon: CircleCheck, label: 'Verified' },
  { icon: Clock, label: 'Timely' },
  { icon: Reply, label: 'Responsive' },
  { icon: Sparkles, label: 'Top performer' },
];

const TESTIMONIAL_METRICS = [
  { icon: TrendingUp, value: '96%', label: 'reply rate' },
  { icon: Timer, value: '4m', label: 'avg reply' },
  { icon: Gauge, value: '92', label: 'lead score' },
  { icon: CheckCheck, value: '100%', label: 'read' },
  { icon: Activity, value: '18', label: 'threads' },
  { icon: BadgeCheck, value: '1,240', label: 'validated' },
  { icon: Reply, value: 'same day', label: 'response' },
  { icon: Signal, value: 'online', label: 'WhatsApp' },
  { icon: MessageCircle, value: '42', label: 'conversations' },
  { icon: Users, value: '12', label: 'team members' },
  { icon: Target, value: '89', label: 'on target' },
  { icon: Zap, value: '3x', label: 'faster' },
];

const TESTIMONIAL_CHARTS = [
  [42, 68, 54, 86, 64, 92, 74],
  [58, 44, 78, 60, 90, 70, 96],
  [34, 62, 50, 74, 92, 66, 84],
  [70, 52, 66, 46, 84, 60, 90],
  [48, 76, 58, 88, 56, 80, 68],
  [62, 40, 72, 56, 86, 64, 94],
  [38, 55, 72, 64, 78, 82, 70],
  [80, 60, 45, 70, 55, 90, 65],
  [45, 70, 62, 80, 72, 66, 88],
  [55, 48, 82, 68, 74, 60, 92],
];

const CARD_SLOTS = 12;

let testimonialUid = 0;

const shuffleList = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const takeFromQueue = (queue, length) => {
  if (!queue.current.length) queue.current = shuffleList([...Array(length).keys()]);
  return queue.current.shift();
};

const makeTestimonial = (personaId, convoId, seq) => {
  const persona = TESTIMONIAL_PERSONAS[personaId];
  const convo = TESTIMONIAL_CONVERSATIONS[convoId];
  return {
    uid: `ts-${(testimonialUid += 1)}`,
    ...persona,
    flow: convo.flow,
    pace: convo.pace,
    when: TESTIMONIAL_TIMES[seq % TESTIMONIAL_TIMES.length],
    outcome: TESTIMONIAL_OUTCOMES[seq % TESTIMONIAL_OUTCOMES.length],
    badge: TESTIMONIAL_BADGES[seq % TESTIMONIAL_BADGES.length],
    metric: TESTIMONIAL_METRICS[seq % TESTIMONIAL_METRICS.length],
    chart: TESTIMONIAL_CHARTS[seq % TESTIMONIAL_CHARTS.length],
  };
};

/* ── Small analytics bar inside the card ── */
const MiniChart = ({ heights, active }) => (
  <span className="flex h-[14px] items-end gap-[2px] shrink-0" aria-hidden="true">
    {heights.map((h, i) => (
      <motion.span
        key={i}
        className="w-[4px] origin-bottom rounded-sm bg-[#25D366]/70"
        style={{ height: `${Math.round(h * 0.16)}px` }}
        initial={false}
        animate={active ? { scaleY: 1, opacity: 1 } : { scaleY: 0.2, opacity: 0.35 }}
        transition={{ duration: 0.45, delay: 0.08 + i * 0.06, ease: 'easeOut' }}
      />
    ))}
  </span>
);

const StarsRow = () => (
  <motion.div
    key="stars"
    initial={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0 }}
    className="flex items-center gap-0.5 pl-0.5 py-0.5"
  >
    {[...Array(5)].map((_, si) => (
      <motion.span
        key={si}
        initial={{ opacity: 0, scale: 0.4, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, delay: si * 0.09 }}
      >
        <Star size={9} className="text-warning fill-warning" />
      </motion.span>
    ))}
  </motion.div>
);

const ACTIVITY_HEIGHTS = [6, 10, 8, 13, 9, 12, 7];

const ActivityBars = ({ active }) => (
  <span className="flex items-end gap-[2px] h-[10px] shrink-0" aria-hidden="true">
    {ACTIVITY_HEIGHTS.map((h, i) => (
      <motion.span
        key={i}
        className="w-[2px] origin-bottom rounded-full bg-[#25D366]/70"
        style={{ height: `${h}px` }}
        initial={false}
        animate={active ? { scaleY: 1, opacity: 1 } : { scaleY: 0.15, opacity: 0.3 }}
        transition={{ duration: 0.4, delay: 0.12 + i * 0.05, ease: 'easeOut' }}
      />
    ))}
  </span>
);

/* ── WhatsApp-style chat card ── */
export const WhatsAppTestimonialCard = ({ t, index = 0 }) => {
  const flow = useMemo(() => t.flow, [t]);
  const total = flow.length + 1;
  const pace = (t.pace || 1500) + (index % 5) * 90;
  const startIn = (index * 780) % 5200;
  const hold = 3000 + (index % 4) * 700;
  const step = useChatSteps(total, pace, startIn, hold);

  const shown = step - 1;
  const active = shown >= 0;
  const readIdx = flow.findIndex((f) => f.k === 'read');
  const starsIdx = flow.findIndex((f) => f.k === 'stars');
  const read = readIdx >= 0 && shown >= readIdx;
  const rated = starsIdx >= 0 && shown >= starsIdx;
  const lastMineIdx = flow.reduce((acc, f, i) => (f.k === 'u' && i <= shown ? i : acc), -1);
  const firstCustomerMsg = flow.findIndex((f) => f.k === 'c');
  const MetricIcon = t.metric.icon;

  const [inputText, setInputText] = useState('');

  const items = flow.map((f, i) => ({ f, i })).filter(({ i }) => i <= shown);

  const hasText = inputText.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: (index % 5) * 0.06, ease: 'easeOut' }}
      className="rounded-[14px] overflow-hidden flex flex-col w-full min-w-0 shadow-[0_4px_24px_rgba(0,0,0,0.45)] border border-white/[0.06] h-[420px] sm:h-[460px] md:h-[500px] lg:h-[540px]"
      style={{ backgroundColor: '#111B21' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0" style={{ backgroundColor: '#111B21', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <ArrowLeft size={16} className="text-[#8696A0] shrink-0" />
        <ProfilePhoto img={t.img} initials={t.initials} tint={t.tint} size="sm" online={active} ping={shown === firstCustomerMsg && active} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold truncate text-[#E9EDEF]">{t.name}</p>
          <p className="text-[8px] text-[#8696A0] truncate">
            {active ? (
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" /> online</span>
            ) : (
              <span>{t.role}</span>
            )}
          </p>
        </div>
        <Search size={14} className="text-[#8696A0] shrink-0" />
        <EllipsisVertical size={16} className="text-[#8696A0] shrink-0" />
        <Phone size={14} className="text-[#8696A0] shrink-0" />
        <Video size={14} className="text-[#8696A0] shrink-0" />
      </div>

      {/* ── System pill ── */}
      <div className="px-3 py-1 shrink-0">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#202C33] px-3 py-0.5 text-[8px] text-[#8696A0]">
          <ShieldCheck size={9} className="text-[#25D366]" /> Messages are end-to-end encrypted
        </span>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-hidden px-3 py-2 flex flex-col gap-1.5" style={{ backgroundColor: '#0B141A' }}>
        <AnimatePresence initial={false}>
          {items.map(({ f, i }) => {
            if (f.k === 'typing') {
              return (
                <motion.div key={`typing-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-1.5 items-end">
                  <ProfilePhoto img={t.img} initials={t.initials} tint={t.tint} size="sm" />
                  <div className="bg-[#202C33] rounded-xl rounded-tl-sm px-3 py-2">
                    <TypingDots />
                  </div>
                </motion.div>
              );
            }
            if (f.k === 'stars') return <StarsRow key={`stars-${i}`} />;
            if (f.k === 'read') return null;
            const mine = f.k === 'u';
            const prev = i > 0 ? flow[i - 1] : null;
            const sameAsPrev = prev && prev.k === f.k;
            if (mine) {
              return (
                <motion.div key={`out-${i}`} initial={{ opacity: 0, y: 8, x: 10 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0 }} className="flex justify-end pl-8">
                  <div className="bg-[#005C4B] rounded-xl rounded-tr-sm px-3 py-2 max-w-[78%]">
                    <p className="text-[11px] text-[#E9EDEF] leading-relaxed">{f.text}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[8px] text-[#8696A0]">{f.t}</span>
                      {read && (
                        <CheckCheck size={13} style={{ color: read ? '#25D366' : '#8696A0' }} />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            }
            return (
              <motion.div key={`in-${i}`} initial={{ opacity: 0, y: 8, x: -10 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0 }} className="flex gap-1.5 items-end">
                <ProfilePhoto img={t.img} initials={t.initials} tint={t.tint} size="sm" />
                <div className="bg-[#202C33] rounded-xl rounded-tl-sm px-3 py-2 max-w-[78%]">
                  <p className="text-[11px] text-[#E9EDEF] leading-relaxed">{f.text}</p>
                  <span className="text-[8px] text-[#8696A0]">{f.t}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Analytics strip ── */}
      <div className="px-3 py-1.5 shrink-0 flex items-center gap-2" style={{ backgroundColor: '#111B21', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <MiniChart heights={t.chart} active={read || rated} />
        <span className="text-[8px] text-[#8696A0] shrink-0">
          <MetricIcon size={10} className="inline text-[#25D366] align-middle mr-0.5" /> {t.metric.value} {t.metric.label}
        </span>
      </div>

      {/* ── Input ── */}
      <div className="px-3 py-2 shrink-0 flex items-center gap-1.5" style={{ backgroundColor: '#111B21', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Smile size={18} className="text-[#8696A0] shrink-0" />
        <Paperclip size={18} className="text-[#8696A0] shrink-0" />
        <div className="flex-1 rounded-full bg-[#202C33] px-4 py-2 flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message"
            className="flex-1 bg-transparent text-[11px] text-[#E9EDEF] outline-none placeholder-[#8696A0]"
          />
          {hasText && (
            <Send size={16} className="text-[#25D366] shrink-0 ml-1" />
          )}
        </div>
        <Camera size={18} className="text-[#8696A0] shrink-0" />
        {!hasText ? (
          <Mic size={18} className="text-[#25D366] shrink-0" />
        ) : null}
      </div>
    </motion.div>
  );
};

/* ── Drag-to-scroll hook for the testimonial track ── */
const useDragScroll = (trackRef, autoPausedRef) => {
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    startX.current = e.pageX - trackRef.current.offsetLeft;
    scrollLeft.current = trackRef.current.scrollLeft;
    autoPausedRef.current = true;
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    trackRef.current.scrollLeft = scrollLeft.current - walk;
  }, [isDragging]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    autoPausedRef.current = false;
  }, []);

  const onTouchStart = useCallback((e) => {
    setIsDragging(true);
    startX.current = e.touches[0].pageX - trackRef.current.offsetLeft;
    scrollLeft.current = trackRef.current.scrollLeft;
    autoPausedRef.current = true;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.touches[0].pageX - trackRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    trackRef.current.scrollLeft = scrollLeft.current - walk;
  }, [isDragging]);

  const onTouchEnd = useCallback(() => {
    setIsDragging(false);
    autoPausedRef.current = false;
  }, []);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave: onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};

export const TestimonialsFeed = () => {
  const reduce = useReducedMotion();
  const trackRef = useRef(null);
  const slotEls = useRef([]);
  const staleSlots = useRef([]);
  const personaQueue = useRef([]);
  const convoQueue = useRef([]);
  const seqRef = useRef(0);
  const autoPausedRef = useRef(false);
  const autoTimerRef = useRef(null);

  const [cards, setCards] = useState(() => {
    const personas = shuffleList([...Array(TESTIMONIAL_PERSONAS.length).keys()]);
    const convos = shuffleList([...Array(TESTIMONIAL_CONVERSATIONS.length).keys()]);
    staleSlots.current = Array.from({ length: CARD_SLOTS }, () => false);
    return Array.from({ length: CARD_SLOTS }, (_, i) => {
      const seq = seqRef.current;
      seqRef.current += 1;
      return makeTestimonial(personas[i % personas.length], convos[i % convos.length], seq);
    });
  });

  const rotate = useCallback((slot) => {
    setCards((prev) => {
      const visiblePersonas = new Set();
      prev.forEach((card, i) => {
        if (!staleSlots.current[i]) visiblePersonas.add(card.id);
      });
      let personaId = takeFromQueue(personaQueue, TESTIMONIAL_PERSONAS.length);
      let guard = 0;
      while (visiblePersonas.has(TESTIMONIAL_PERSONAS[personaId].id) && guard < TESTIMONIAL_PERSONAS.length) {
        personaId = takeFromQueue(personaQueue, TESTIMONIAL_PERSONAS.length);
        guard += 1;
      }
      const convoId = takeFromQueue(convoQueue, TESTIMONIAL_CONVERSATIONS.length);
      const next = prev.slice();
      next[slot] = makeTestimonial(personaId, convoId, seqRef.current);
      seqRef.current += 1;
      return next;
    });
  }, []);

  useEffect(() => {
    const root = trackRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const slot = Number(entry.target.dataset.slot);
        if (entry.isIntersecting) {
          if (staleSlots.current[slot]) {
            staleSlots.current[slot] = false;
            rotate(slot);
          }
        } else {
          staleSlots.current[slot] = true;
        }
      });
    }, { root, rootMargin: '0px 340px 0px 340px', threshold: 0 });
    const observeAll = () => {
      slotEls.current.forEach((el) => { if (el) observer.observe(el); });
    };
    observeAll();
    const mutationObs = new MutationObserver(() => {
      slotEls.current.forEach((el) => { if (el) observer.observe(el); });
    });
    mutationObs.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutationObs.disconnect(); };
  }, [rotate]);

  const advance = useCallback(() => {
    const el = trackRef.current;
    if (!el || autoPausedRef.current) return;
    const first = el.querySelector('[data-slot]');
    const delta = first ? first.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: delta, behavior: reduce ? 'auto' : 'smooth' });
  }, [reduce]);

  useEffect(() => {
    if (reduce) return undefined;
    autoTimerRef.current = setInterval(advance, 5000);
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  }, [advance, reduce]);

  const dragHandlers = useDragScroll(trackRef, autoPausedRef);

  return (
    <div className="relative">
      <div className="absolute -inset-x-4 top-1/2 -translate-y-1/2 w-[calc(100%+2rem)] h-32 sm:h-40 bg-[#25D366]/[0.04] blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-16 sm:w-20 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-16 sm:w-20 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        <div
          ref={trackRef}
          {...dragHandlers}
          role="region"
          aria-label="Customer stories"
          tabIndex={0}
          onMouseEnter={() => { autoPausedRef.current = true; }}
          onMouseLeave={() => { autoPausedRef.current = false; }}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 sm:gap-4 overflow-x-auto px-3 sm:px-4 pb-2 select-none cursor-grab active:cursor-grabbing"
          style={{ scrollBehavior: reduce ? 'auto' : 'smooth', overscrollBehaviorX: 'contain' }}
        >
          {cards.map((card, i) => (
            <div
              key={i}
              data-slot={i}
              ref={(el) => { slotEls.current[i] = el; }}
              className="w-[260px] shrink-0 snap-start sm:w-[300px] md:w-[340px] lg:w-[380px]"
            >
              <WhatsAppTestimonialCard key={card.uid} t={card} index={i} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
