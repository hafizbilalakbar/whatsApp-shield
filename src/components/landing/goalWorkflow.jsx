import React, { useRef } from 'react';
import {
  motion, useScroll, useTransform, useSpring, useReducedMotion,
} from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search, Target, Globe, Store, Users, RefreshCw, ShieldCheck, BadgeCheck,
  Check, CheckCheck, Sparkles, Send, Phone, MessageCircle, MoreVertical,
  Video, ArrowRight, Wifi, BellRing, Layers, TrendingUp, Inbox,
  ClipboardList, Timer, UserPlus, X, CalendarClock,
} from 'lucide-react';
import { cn } from '../ui/cn';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

/* ============================================================
   Motion math
   ============================================================ */

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);

/* 0→1 eased across [a,b] of a scroll motion value `v`. */
const inRange = (mv, a, b) => (
  useTransform(mv, (v) => easeOut(clamp01((v - a) / (b - a))))
);

/* fade in over [inA,inB], hold, fade out over [outA,outB]. */
const fade = (mv, inA, inB, outA, outB) => (
  useTransform(mv, (v) => Math.min(clamp01((v - inA) / (inB - inA)), 1 - clamp01((v - outA) / (outB - outA))))
);

/* ============================================================
   Shared mockup primitives (WhatsApp-inspired, theme-aware)
   ============================================================ */

const Avatar = ({ img, initials, tint, size = 'md', online = false, className }) => {
  const [err, setErr] = React.useState(false);
  const sz = size === 'xl' ? 'w-10 h-10 text-sm'
    : size === 'lg' ? 'w-9 h-9 text-sm'
      : size === 'sm' ? 'w-6 h-6 text-[9px]'
        : 'w-8 h-8 text-xs';
  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      <span className={cn('rounded-full flex items-center justify-center overflow-hidden ring-1 ring-black/10 dark:ring-white/15 text-white font-bold', sz, tint || 'bg-gradient-to-br from-[#00B86E]/90 to-[#0D9488]/90')}>
        {img && !err ? (
          <img src={`/avatars/${img}.jpg`} alt="" loading="lazy" draggable={false} onError={() => setErr(true)} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </span>
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--ma-bg-panel)] bg-[#25D366] shadow-sm" />
      )}
    </span>
  );
};

const BrandMark = ({ initials, tint }) => (
  <span className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold shrink-0 ring-1 ring-black/10 dark:ring-white/10', tint)}>
    {initials}
  </span>
);

const Ticks = ({ level }) =>
  level === 'read' ? (
    <CheckCheck size={12} className="text-[#53BDEB]" aria-hidden="true" />
  ) : (
    <Check size={12} className="text-[#53BDEB]" aria-hidden="true" />
  );

const TypingDots = ({ className }) => (
  <span className={cn('inline-flex items-end gap-[3px]', className)} aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="w-[5px] h-[5px] rounded-full bg-current"
        animate={{ y: [0, -2.5, 0], opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
      />
    ))}
  </span>
);

const StatusBadge = ({ tone = 'primary', children, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[8.5px] font-bold whitespace-nowrap shrink-0',
      tone === 'success' ? 'text-success border-success/30 bg-success/10'
        : tone === 'muted' ? 'text-text-muted border-border/70 bg-surface/60'
          : 'text-primary border-primary/30 bg-primary/5',
      className
    )}
  >
    {children}
  </span>
);

/* switchable status: two absolutely-stacked badges cross-fading in a stable slot */
const SwappingBadge = ({ a, b, opA, opB, toneA = 'muted' }) => (
  <span className="relative inline-block w-[84px] text-right">
    <motion.span style={{ opacity: opA }} className="absolute inset-0 inline-flex justify-end">
      <StatusBadge tone={toneA}>{a}</StatusBadge>
    </motion.span>
    <motion.span style={{ opacity: opB }} className="inline-flex justify-end">
      <StatusBadge tone="success">{b}</StatusBadge>
    </motion.span>
  </span>
);

/* rounded "traffic light" title bar used by every desktop mockup window */
const TitleBar = ({ label }) => (
  <div className="hidden sm:flex shrink-0 items-center gap-1.5 border-b px-4 py-1.5" style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}>
    <span className="w-2 h-2 rounded-full bg-[#FF5F57]" aria-hidden="true" />
    <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
    <span className="w-2 h-2 rounded-full bg-[#28C840]" aria-hidden="true" />
    <span className="ml-2 text-[9.5px] font-semibold truncate" style={{ color: 'var(--ma-muted-text)' }}>{label}</span>
  </div>
);

/* ============================================================
   Scene 1 · Discover — find and import the exact business leads
   ============================================================ */

const DISCOVER_SOURCES = [
  { icon: Store, name: 'Renewables & Solar', region: 'Dubai · AE', count: '2.1k' },
  { icon: Store, name: 'Interior & Fit-out', region: 'Sharjah · AE', count: '1.4k' },
  { icon: Store, name: 'Freight & Logistics', region: 'Abu Dhabi · AE', count: '0.9k' },
  { icon: RefreshCw, name: 'Directory sync', region: 'Runs daily', count: 'Live' },
];

const DISCOVER_FILTERS = [
  { icon: Target, label: 'Industry' },
  { icon: Globe, label: 'Location' },
  { icon: Users, label: 'Status' },
];

const DISCOVER_LEADS = [
  {
    initials: 'AS', tint: 'from-amber-400 to-orange-600',
    brand: 'Arka Solar Co.', meta: 'Solar installers · Dubai, AE',
    contact: 'Maria Vidal', phone: '+971 55 204 8811',
    tags: ['Renewables', 'Commercial'], wa: true,
  },
  {
    initials: 'MV', tint: 'from-rose-400 to-pink-600',
    brand: 'Maison Vale', meta: 'Interior studio · Sharjah, AE',
    contact: 'Tarek Nasser', phone: '+971 50 411 7720',
    tags: ['Design', 'Fit-out'], wa: true,
  },
  {
    initials: 'NC', tint: 'from-sky-400 to-blue-600',
    brand: 'Nexus Cargo', meta: 'Freight & logistics · Abu Dhabi, AE',
    contact: 'Adam Foster', phone: '+971 2 633 4490',
    tags: ['Logistics', 'Fleet'], wa: true,
  },
  {
    initials: 'ZD', tint: 'from-violet-400 to-purple-600',
    brand: 'Zephyr Digital', meta: 'Ad agency · Dubai, AE',
    contact: 'Lina Corvi', phone: '+971 4 351 2088',
    tags: ['Marketing', 'SaaS'], wa: false,
  },
];

const DiscoverySource = ({ mv, i, icon: Icon, name, region, count }) => {
  const op = inRange(mv, 0.1 + i * 0.05, 0.18 + i * 0.05);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - (0.1 + i * 0.05)) / 0.08))) * 14);
  const countOp = inRange(mv, 0.3 + i * 0.04, 0.38 + i * 0.04);
  return (
    <motion.div style={{ opacity: op, y }} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
      <span className="w-6 h-6 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0">
        <Icon size={11} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{name}</p>
        <p className="text-[8px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{region}</p>
      </div>
      <motion.span style={{ opacity: countOp, color: 'var(--ma-accent)' }} className="text-[9px] font-semibold tabular-nums">{count}</motion.span>
    </motion.div>
  );
};

const DiscoverRow = ({ mv, i, row }) => {
  const inAt = 0.24 + i * 0.05;
  const op = inRange(mv, inAt, inAt + 0.07);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - inAt) / 0.09))) * 16);
  const dmOp = inRange(mv, 0.44 + i * 0.035, 0.5 + i * 0.035);
  const addedAt = 0.54 + i * 0.05;
  const newOp = fade(mv, inAt + 0.02, inAt + 0.08, addedAt, addedAt + 0.05);
  const addedOp = inRange(mv, addedAt, addedAt + 0.06);
  return (
    <motion.div
      style={{ opacity: op, y }}
      className="flex items-center gap-2.5 rounded-xl border px-3 py-1.5 mt-1.5 first:mt-0"
    >
      <BrandMark initials={row.initials} tint={row.tint} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] sm:text-[12px] lg:text-[11px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{row.brand}</p>
          <motion.span style={{ opacity: dmOp }} className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-1.5 py-[1px] text-[8px] font-bold text-primary whitespace-nowrap">
            <UserPlus size={8} /> Decision maker
          </motion.span>
        </div>
        <p className="text-[8px] sm:text-[9px] lg:text-[8px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{row.meta}</p>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          {row.tags.map((t, j) => (
            <motion.span
              key={t}
              style={{ opacity: inRange(mv, inAt + 0.06 + j * 0.04, inAt + 0.1 + j * 0.04) }}
              className="rounded-full border border-border/70 bg-surface/60 px-1.5 py-[1px] text-[7.5px] font-bold text-text-muted whitespace-nowrap"
            >
              {t}
            </motion.span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 hidden sm:flex">
        <span className="text-[9px] font-semibold tabular-nums" style={{ color: 'var(--ma-list-title)' }}>{row.phone}</span>
        <span className="text-[8px] font-semibold" style={{ color: 'var(--ma-muted-text)' }}>{row.contact}</span>
      </div>
      <SwappingBadge
        a="New"
        b={row.wa ? (<><Check size={8} /> Lead added</>) : (<><X size={8} /> No WhatsApp</>)}
        opA={newOp}
        opB={addedOp}
      />
    </motion.div>
  );
};

const DiscoverCounter = ({ mv }) => {
  const val = useTransform(mv, (v) => Math.round(easeOut(clamp01((v - 0.66) / 0.1)) * 42));
  const op = inRange(mv, 0.64, 0.72);
  const barW = useTransform(mv, (v) => `${easeOut(clamp01((v - 0.72) / 0.1)) * 100}%`);
  return (
    <motion.div style={{ opacity: op, borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }} className="mt-3 mx-1 rounded-xl border p-2.5">
      <div className="flex items-end justify-between">
        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Qualified leads</span>
        <motion.span className="text-[17px] font-bold tabular-nums text-primary leading-none">
          <motion.span>{val}</motion.span>
        </motion.span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-border/60 overflow-hidden">
        <motion.div style={{ width: barW }} className="h-full rounded-full bg-primary" />
      </div>
      <p className="mt-1.5 text-[8px] font-semibold text-success flex items-center gap-1">
        <Check size={8} /> Ready to verify
      </p>
    </motion.div>
  );
};

const LeadDiscoveryScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.02, 0.08);
  const pnlScale = useTransform(mv, (v) => 0.97 + 0.03 * easeOut(clamp01((v - 0.02) / 0.06)));
  const startOp = inRange(mv, 0.3, 0.36);
  const counterOp = inRange(mv, 0.6, 0.68);
  const footerOp = inRange(mv, 0.72, 0.8);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="relative z-10 flex flex-col w-full h-full max-w-sm sm:max-w-xl lg:max-w-6xl mx-auto"
      >
        <div
          className="flex flex-col min-h-0 flex-1 rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <TitleBar label="wa-shield — Business Discovery" />

          {/* app header */}
          <div className="shrink-0 px-4 py-2 sm:py-2.5 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="w-8 h-8 rounded-full bg-primary/12 border border-primary/25 text-primary flex items-center justify-center shrink-0">
              <Inbox size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] lg:text-[12px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Business Discovery</p>
              <p className="text-[9.5px] lg:text-[9px]" style={{ color: 'var(--ma-muted-text)' }}>Finding leads that match your market</p>
            </div>
            <StatusBadge tone="muted" className="hidden sm:inline-flex">1/4 · Discover</StatusBadge>
            <span className="relative inline-block w-[88px] text-right">
              <motion.span style={{ opacity: fade(mv, 0.16, 0.24, 0.3, 0.38) }} className="absolute inset-0 inline-flex justify-end">
                <StatusBadge><RefreshCw size={9} /> Finding leads</StatusBadge>
              </motion.span>
              <motion.span style={{ opacity: startOp }} className="inline-flex justify-end">
                <StatusBadge tone="success"><Check size={9} /> Import ready</StatusBadge>
              </motion.span>
            </span>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)] md:[grid-template-rows:1fr] flex-1 min-h-0">
            {/* audience sidebar (desktop) */}
            <aside
              className="hidden md:flex min-h-0 flex-col border-r px-2 py-2.5"
              style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-root)' }}
            >
              <div className="px-2 pb-1.5 flex items-center justify-between">
                <p className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Audience</p>
                <span className="text-[8.5px] font-bold text-primary">3 filters</span>
              </div>
              <div className="flex-1 min-h-0">
                {DISCOVER_SOURCES.map((s, i) => <DiscoverySource key={s.name} mv={mv} i={i} {...s} />)}
              </div>
              <motion.div style={{ opacity: counterOp }} className="mt-auto">
                <DiscoverCounter mv={mv} />
              </motion.div>
            </aside>

            {/* matched lead list */}
            <div className="md:h-full md:flex md:flex-col md:min-h-0 px-3 sm:px-4 py-2.5 sm:py-3" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-1 min-w-[180px] rounded-lg border px-2.5 py-1.5" style={{ backgroundColor: 'var(--ma-bg-elevated)' }}>
                  <Search size={11} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0" />
                  <span className="text-[9.5px] truncate" style={{ color: 'var(--ma-muted-text)' }}>Show leads matching your market</span>
                </div>
                {DISCOVER_FILTERS.map((f, i) => (
                  <motion.span
                    key={f.label}
                    style={{ opacity: inRange(mv, 0.18 + i * 0.04, 0.24 + i * 0.04) }}
                    className="hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold"
                  >
                    <f.icon size={9} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0" />
                    {f.label}
                  </motion.span>
                ))}
              </div>
              <div className="hidden md:flex items-center justify-between px-1 pb-1.5">
                <p className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Matched leads</p>
                <motion.p style={{ opacity: counterOp }} className="text-[8.5px] font-semibold" >
                  <span style={{ color: 'var(--ma-accent)' }}>1,460 found</span>
                  <span className="inline-flex items-center gap-1 ml-2"><Layers size={9} /> Auto-deduplicated</span>
                </motion.p>
              </div>
              <div className="md:flex-1 md:min-h-0 md:overflow-hidden">
                {DISCOVER_LEADS.map((r, i) => <DiscoverRow key={r.brand} mv={mv} i={i} row={r} />)}
              </div>
            </div>
          </div>

          {/* discovery footer */}
          <div className="shrink-0 px-4 py-2 flex items-center justify-between border-t" style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}>
            <motion.div style={{ opacity: footerOp }} className="flex items-center gap-2">
              <Users size={12} style={{ color: 'var(--ma-muted-text)' }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--ma-list-title)' }}>
                42 qualified leads
                <span className="hidden sm:inline font-semibold" style={{ color: 'var(--ma-muted-text)' }}> ready to verify</span>
              </span>
            </motion.div>
            <motion.div style={{ opacity: footerOp }} className="flex items-center gap-1.5">
              <StatusBadge>Next: Verify</StatusBadge>
              <ArrowRight size={11} style={{ color: 'var(--ma-muted-text)' }} />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   Scene 2 · Verify — normalize, check availability, confirm live
   ============================================================ */

const VERIFY_STEPS = [
  { icon: Inbox, label: 'Import' },
  { icon: Layers, label: 'Normalize' },
  { icon: ShieldCheck, label: 'Check' },
  { icon: BadgeCheck, label: 'Verify' },
];

const VerifyStep = ({ mv, i, total, icon: Icon, label }) => {
  const start = 0.08 + i * 0.13;
  const on = inRange(mv, start, start + 0.05);
  const done = inRange(mv, start + 0.02, start + 0.11);
  const iconOp = fade(mv, start, start + 0.06, start + 0.1, start + 0.16);
  const checkOp = fade(mv, start + 0.1, start + 0.16, 1.1, 1.16);
  const lineColor = useTransform(on, [0, 1], ['var(--ma-line-slim)', 'var(--primary)']);
  const lineW = useTransform(mv, (v) => `${easeOut(clamp01((v - (start + 0.08)) / 0.16)) * 100}%`);
  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="flex items-center w-full">
        <motion.div
          style={{ backgroundColor: i === 0 ? 'transparent' : lineColor }}
          className="h-[2px] flex-1 rounded-full"
        />
        <motion.div
          style={{ scale: on, borderColor: lineColor, color: lineColor }}
          className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center shrink-0"
        >
          <motion.span style={{ opacity: iconOp }} className="absolute inset-0 flex items-center justify-center">
            <Icon size={13} />
          </motion.span>
          <motion.span style={{ opacity: checkOp }} className="absolute inset-0 flex items-center justify-center">
            <Check size={12} className="text-success" />
          </motion.span>
        </motion.div>
        <motion.div style={{ width: lineW }} className={cn('h-[2px] rounded-full origin-left bg-primary', i < total - 1 ? '' : 'opacity-0')} />
      </div>
      <motion.span style={{ opacity: done }} className="mt-1.5 text-[9.5px] sm:text-[10px] font-bold">{label}</motion.span>
    </div>
  );
};

const VerifyBulkRow = ({ mv, i, row }) => {
  const op = inRange(mv, 0.32 + i * 0.05, 0.4 + i * 0.05);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - (0.32 + i * 0.05)) / 0.08))) * 10);
  const okOp = inRange(mv, 0.56 + i * 0.04, 0.62 + i * 0.04);
  const ignoreOp = inRange(mv, 0.64, 0.7);
  const sub = row.state === 'ok'
    ? { tone: 'success', icon: <BadgeCheck size={10} />, text: 'Verified' }
    : row.state === 'dup'
      ? { tone: 'primary', icon: <X size={9} />, text: 'Removed' }
      : { tone: 'muted', icon: <X size={9} />, text: 'No WhatsApp' };
  return (
    <motion.div style={{ opacity: op, y }} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
      <Avatar initials={row.initials} tint={row.tint} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{row.name}</p>
        <p className="text-[8px] tabular-nums truncate" style={{ color: 'var(--ma-muted-text)' }}>{row.num}</p>
      </div>
      <span className="hidden sm:block text-[8px] font-semibold shrink-0" style={{ color: 'var(--ma-muted-text)' }}>{row.city}</span>
      {row.state === 'ok' ? (
        <motion.span style={{ opacity: okOp }} className="shrink-0">
          <StatusBadge tone="success">{sub.icon}{sub.text}</StatusBadge>
        </motion.span>
      ) : (
        <motion.span style={{ opacity: ignoreOp }} className="shrink-0">
          <StatusBadge tone={sub.tone}>{sub.icon}{sub.text}</StatusBadge>
        </motion.span>
      )}
    </motion.div>
  );
};

const VERIFY_BULK = [
  { initials: 'RO', tint: 'from-sky-400 to-blue-600', name: 'Rafael Ortega', num: '+34 612 345 678', city: 'Madrid, ES', state: 'ok' },
  { initials: 'AD', tint: 'from-emerald-400 to-green-600', name: 'Amara Diop', num: '+221 77 123 45 67', city: 'Dakar, SN', state: 'ok' },
  { initials: 'JL', tint: 'from-amber-400 to-orange-600', name: 'Jonas Lindqvist', num: '+46 70 123 45 67', city: 'Stockholm, SE', state: 'none' },
  { initials: 'RD', tint: 'from-violet-400 to-purple-600', name: 'Duplicate entry', num: '+34 612 345 678', city: 'Auto-merged', state: 'dup' },
];

const VerifyBulkPanel = ({ mv }) => {
  const op = inRange(mv, 0.28, 0.36);
  const doneOp = inRange(mv, 0.64, 0.72);
  return (
    <motion.div style={{ opacity: op }} className="rounded-2xl border flex flex-col">
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
        <p className="text-[10px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Across imports</p>
        <motion.span style={{ opacity: doneOp }}>
          <StatusBadge tone="success"><Check size={8} /> 3 live</StatusBadge>
        </motion.span>
      </div>
      <div className="px-2 pb-1">
        {VERIFY_BULK.map((r, i) => <VerifyBulkRow key={r.name} mv={mv} i={i} row={r} />)}
      </div>
      <div className="px-3 pt-1.5 pb-2.5 border-t text-center" style={{ borderColor: 'var(--ma-line-slim)' }}>
        <motion.p style={{ opacity: doneOp, color: 'var(--ma-accent)' }} className="text-[9px] font-semibold">
          Ready to message — no bouncing
        </motion.p>
      </div>
    </motion.div>
  );
};

const VerificationScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.04, 0.1);
  const pnlScale = useTransform(mv, (v) => 0.97 + 0.03 * easeOut(clamp01((v - 0.04) / 0.06)));
  const scan = useTransform(mv, [0.36, 0.64], ['-20%', '120%']);
  const scanOp = fade(mv, 0.32, 0.38, 0.68, 0.76);
  const verifiedOp = inRange(mv, 0.68, 0.78);
  const verifiedScale = useTransform(mv, (v) => 0.92 + 0.08 * easeOut(clamp01((v - 0.68) / 0.1)));
  const numFormatted = inRange(mv, 0.54, 0.64);
  const statusCheck = inRange(mv, 0.6, 0.7);
  const profileOp = inRange(mv, 0.18, 0.26);
  const mobileStatusOp = inRange(mv, 0.56, 0.64);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="relative z-10 flex flex-col w-full h-full max-w-sm sm:max-w-xl lg:max-w-6xl mx-auto"
      >
        <div
          className="flex flex-col min-h-0 flex-1 rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <TitleBar label="wa-shield — Contact Verification" />

          <div className="shrink-0 px-4 py-2 sm:py-2.5 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="w-8 h-8 rounded-full bg-primary/12 border border-primary/25 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] lg:text-[12px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Contact Verification</p>
              <p className="text-[9.5px] lg:text-[9px]" style={{ color: 'var(--ma-muted-text)' }}>Checking WhatsApp availability</p>
            </div>
            <StatusBadge tone="muted" className="hidden sm:inline-flex">2/4 · Verify</StatusBadge>
            <motion.div style={{ opacity: verifiedOp, scale: verifiedScale }}>
              <StatusBadge tone="success"><BadgeCheck size={10} /> Verified</StatusBadge>
            </motion.div>
          </div>

          <div className="flex flex-col min-h-0 flex-1 px-3 sm:px-4 pb-3 pt-2" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
            {/* process rail */}
            <div className="relative z-10 mb-2.5 shrink-0">
              <div className="flex items-stretch gap-0">
                {VERIFY_STEPS.map((s, i) => (
                  <VerifyStep key={s.label} mv={mv} i={i} total={VERIFY_STEPS.length} icon={s.icon} label={s.label} />
                ))}
              </div>
            </div>

            {/* centered verification group */}
            <div className="flex-1 min-h-0 flex flex-col justify-center gap-2">
              <div className="grid sm:grid-cols-[1fr_240px] gap-2">
                {/* number card with scanning line */}
                <div
                  className="rounded-2xl border px-4 py-3 relative overflow-hidden"
                  style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Phone number</span>
                    <motion.span style={{ opacity: statusCheck }} className="text-[10px] font-bold text-success">Verified</motion.span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone size={15} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0" />
                    <motion.span style={{ color: 'var(--ma-list-title)' }} className="text-[14px] sm:text-lg lg:text-base font-bold tabular-nums tracking-tight">
                      <motion.span style={{ opacity: numFormatted }}>+34 612 345 678</motion.span>
                    </motion.span>
                    <motion.span style={{ opacity: verifiedOp, scale: verifiedScale }} className="ml-auto inline-flex items-center gap-1">
                      <StatusBadge tone="success"><Wifi size={9} /> WhatsApp</StatusBadge>
                    </motion.span>
                  </div>
                  <motion.div
                    style={{
                      top: scan,
                      opacity: scanOp,
                      background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
                      boxShadow: '0 0 14px -2px var(--primary-alpha)',
                    }}
                    className="absolute left-3 right-3 h-[2px] rounded-full pointer-events-none"
                  />
                </div>

                {/* bulk verification panel */}
                <div className="hidden sm:block">
                  <VerifyBulkPanel mv={mv} />
                </div>
              </div>

              {/* lead profile */}
              <motion.div style={{ opacity: profileOp }} className="shrink-0 flex items-center gap-2.5 rounded-xl border px-3 py-2">
                <Avatar initials="RO" tint="from-sky-400 to-blue-600" size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Rafael Ortega</p>
                  <p className="text-[9px] truncate" style={{ color: 'var(--ma-muted-text)' }}>Short-stay apartments · Madrid, ES</p>
                </div>
                <motion.span style={{ opacity: mobileStatusOp }} className="sm:hidden">
                  <StatusBadge tone="success"><Check size={8} /> 3 live</StatusBadge>
                </motion.span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold text-success">
                  <Wifi size={10} /> WhatsApp
                </span>
              </motion.div>
            </div>

            {/* verified state */}
            <motion.div
              style={{
                opacity: verifiedOp,
                scale: verifiedScale,
                backgroundColor: 'var(--ma-bg-panel)',
                borderColor: 'var(--ma-line-slim)',
              }}
              className="shrink-0 mt-2 rounded-2xl border px-4 py-2.5 flex items-center gap-2.5"
            >
              <span className="w-9 h-9 rounded-full bg-success flex items-center justify-center shadow-[0_0_18px_-4px_var(--success)] shrink-0">
                <Check size={18} className="text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-success">Number Verified — Safe to message</p>
                <p className="text-[9px]" style={{ color: 'var(--ma-muted-text)' }}>3 WhatsApp-ready contacts · 0 bounces</p>
              </div>
              <motion.div className="ml-auto shrink-0">
                <StatusBadge tone="success"><BellRing size={9} /> Ready</StatusBadge>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   Scene 3 · Engage + Qualify — AI-assisted WhatsApp conversation
   ============================================================ */

const ENGAGE_CHATS = [
  { initials: 'MB', tint: 'from-teal-400 to-cyan-600', name: 'Mara Bertolini', last: 'Short-stay · Milan', time: '12:45', active: true, online: true, count: 0 },
  { initials: 'KA', tint: 'from-emerald-400 to-green-600', name: 'Kemi Adegoke', last: 'WhatsApp campaigns', time: '11:18', active: false, online: false, count: 2 },
  { initials: 'DF', tint: 'from-amber-400 to-orange-500', name: 'Diego Fuentes', last: 'Sync operations', time: '09:04', active: false, online: false, count: 1 },
];

const ChatRow = ({ mv, i, row }) => {
  const op = inRange(mv, 0.12 + i * 0.05, 0.2 + i * 0.05);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - (0.12 + i * 0.05)) / 0.08))) * 12);
  return (
    <motion.div
      style={{ opacity: op, y }}
      className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-xl mx-1.5', row.active && 'bg-primary/10')}
    >
      <Avatar initials={row.initials} tint={row.tint} size="xl" online={row.online} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] font-bold truncate" style={{ color: row.active ? 'var(--primary)' : 'var(--ma-list-title)' }}>{row.name}</p>
          <span className="text-[8px] shrink-0" style={{ color: 'var(--ma-muted-text)' }}>{row.time}</span>
        </div>
        <p className="text-[8.5px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{row.last}</p>
      </div>
      {row.count > 0 && (
        <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary/15 text-primary text-[8px] font-bold flex items-center justify-center shrink-0">
          {row.count}
        </span>
      )}
    </motion.div>
  );
};

const ChatBubble = ({ mv, msg }) => {
  const op = inRange(mv, msg.at, msg.at + 0.06);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - msg.at) / 0.06))) * 14);
  const agent = msg.side === 'agent';
  return (
    <motion.div style={{ opacity: op, y }} className={cn('flex', agent ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('relative max-w-[82%] lg:max-w-[62%] rounded-xl px-3 py-1.5 text-[11px] lg:text-[10.5px] leading-snug', agent ? 'rounded-tr-sm' : 'rounded-tl-sm')}
        style={{
          backgroundColor: agent ? 'var(--ma-bubble-sent)' : 'var(--ma-bubble-received)',
          color: 'var(--ma-message-text)',
          border: '1px solid var(--ma-line-slim)',
          boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
        }}
      >
        {msg.ai && (
          <div className="flex items-center gap-1 mb-0.5">
            <Sparkles size={10} className="text-[#00D97E]" />
            <span className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-accent)' }}>AI Agent</span>
          </div>
        )}
        <p>{msg.text}</p>
        <span className="flex items-center justify-end gap-1 translate-y-[2px] mt-0.5 shrink-0">
          <span className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>{msg.time}</span>
          {msg.ticks && <Ticks level="read" />}
        </span>
      </div>
    </motion.div>
  );
};

const TypingRow = ({ mv, at, out }) => {
  const op = fade(mv, at, at + 0.04, out + 0.05, out + 0.1);
  return (
    <motion.div style={{ opacity: op }} className="flex justify-start">
      <div
        className="rounded-xl rounded-tl-sm px-3 py-2"
        style={{ backgroundColor: 'var(--ma-bubble-received)', color: 'var(--ma-muted-text)', border: '1px solid var(--ma-line-slim)' }}
      >
        <TypingDots />
      </div>
    </motion.div>
  );
};

const ENGAGE_MSGS = [
  { side: 'lead', at: 0.14, time: '12:41', text: 'Hi! We\u2019re looking for booking help over WhatsApp for our apartments.' },
  { side: 'agent', ai: true, at: 0.32, time: '12:42', ticks: true, text: 'Happy to help. Which type of properties do you manage?' },
  { side: 'lead', at: 0.52, time: '12:44', text: 'Short-stay apartments in Milan — around 40 units.' },
  { side: 'agent', ai: true, at: 0.7, time: '12:45', ticks: true, text: 'Perfect fit. I\u2019ll send our Short-Stay plan and set up a follow-up call.' },
];

const ConversationScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.06, 0.12);
  const pnlScale = useTransform(mv, (v) => 0.97 + 0.03 * easeOut(clamp01((v - 0.06) / 0.06)));
  const composerOp = inRange(mv, 0.2, 0.28);
  const stripOp = inRange(mv, 0.24, 0.32);
  const score = useTransform(mv, (v) => Math.round(easeOut(clamp01((v - 0.42) / 0.28)) * 92));
  const barW = useTransform(mv, (v) => `${easeOut(clamp01((v - 0.42) / 0.28)) * 92}%`);
  const runOp = fade(mv, 0.3, 0.38, 0.76, 0.84);
  const qualOp = inRange(mv, 0.74, 0.82);
  const followOp = inRange(mv, 0.82, 0.9);
  const qaOp = fade(mv, 0.3, 0.38, 0.62, 0.7);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="relative z-10 flex flex-col w-full h-full max-w-sm sm:max-w-xl lg:max-w-6xl mx-auto"
      >
        <div
          className="flex flex-col min-h-0 flex-1 rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <TitleBar label="wa-shield — Message Agent" />

          <div className="flex flex-col min-h-0 flex-1 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:[grid-template-rows:1fr]">
            {/* chat list sidebar (desktop) */}
            <aside
              className="hidden md:flex min-h-0 flex-col border-r py-2.5"
              style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-root)' }}
            >
              <div className="px-3 pb-2">
                <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5" style={{ backgroundColor: 'var(--ma-bg-elevated)' }}>
                  <Search size={11} style={{ color: 'var(--ma-muted-text)' }} />
                  <span className="text-[9px]" style={{ color: 'var(--ma-muted-text)' }}>Search conversations</span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {ENGAGE_CHATS.map((c, i) => <ChatRow key={c.name} mv={mv} i={i} row={c} />)}
              </div>
              <motion.div style={{ opacity: composerOp }} className="mx-3 mt-2 mb-1 flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 px-2.5 py-2">
                <Sparkles size={11} className="text-primary shrink-0" />
                <p className="text-[8.5px] font-semibold leading-tight text-primary">AI agents handling 12 conversations</p>
              </motion.div>
            </aside>

            {/* conversation pane */}
            <section className="flex flex-col min-w-0 h-full min-h-0">
              {/* chat header — engaged contact */}
              <div className="shrink-0 px-3.5 py-2 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
                <Avatar initials="MB" tint="from-teal-400 to-cyan-600" online />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] lg:text-[12px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Mara Bertolini</p>
                  <p className="text-[9.5px] flex items-center gap-1" style={{ color: 'var(--ma-accent)' }}>
                    <BadgeCheck size={10} /> Verified WhatsApp
                  </p>
                </div>
                <StatusBadge tone="muted" className="hidden sm:inline-flex">3/4 · Engage + Qualify</StatusBadge>
                <Video size={15} style={{ color: 'var(--ma-muted-text)' }} className="hidden sm:block" />
                <Phone size={13} style={{ color: 'var(--ma-muted-text)' }} className="hidden sm:block" />
                <MoreVertical size={15} style={{ color: 'var(--ma-muted-text)' }} />
              </div>

              {/* messages */}
              <div className="px-3.5 py-2.5 lg:px-4 flex flex-col gap-1.5 min-h-0 flex-1 justify-end overflow-hidden" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
                <ChatBubble mv={mv} msg={ENGAGE_MSGS[0]} />
                <TypingRow mv={mv} at={0.24} out={0.32} />
                <ChatBubble mv={mv} msg={ENGAGE_MSGS[1]} />
                <ChatBubble mv={mv} msg={ENGAGE_MSGS[2]} />
                <TypingRow mv={mv} at={0.62} out={0.7} />
                <ChatBubble mv={mv} msg={ENGAGE_MSGS[3]} />
              </div>

              {/* active lead AI profile */}
              <motion.div
                style={{ opacity: stripOp }}
                className="shrink-0 px-3.5 py-2 border-t flex items-center gap-2.5 flex-wrap"
              >
                <Avatar initials="MB" tint="from-teal-400 to-cyan-600" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Mara Bertolini · 40 units</p>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[8.5px] font-bold tabular-nums text-primary"><motion.span>{score}</motion.span>%</span>
                      <span className="w-10 h-1.5 rounded-full bg-border/60 overflow-hidden hidden sm:block">
                        <motion.span className="block h-full rounded-full" style={{ width: barW, background: 'var(--primary)' }} />
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <StatusBadge tone="muted" className="text-[7.5px] px-1.5 py-[1px]">Short-stay</StatusBadge>
                    <StatusBadge tone="muted" className="text-[7.5px] px-1.5 py-[1px]">Milan</StatusBadge>
                    <motion.span style={{ opacity: qaOp }}><StatusBadge tone="primary" className="text-[7.5px] px-1.5 py-[1px]"><CalendarClock size={8} /> Follow-up Fri</StatusBadge></motion.span>
                  </div>
                </div>
                <div className="relative inline-block w-[92px] text-right shrink-0 hidden sm:block">
                  <motion.span style={{ opacity: runOp }} className="absolute inset-0 inline-flex justify-end">
                    <StatusBadge><Sparkles size={9} /> Qualifying</StatusBadge>
                  </motion.span>
                  <motion.span style={{ opacity: qualOp }} className="inline-flex justify-end">
                    <StatusBadge tone="success"><BadgeCheck size={9} /> Qualified</StatusBadge>
                  </motion.span>
                </div>
              </motion.div>

              {/* follow-up strip */}
              <motion.div
                style={{ opacity: followOp, borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}
                className="shrink-0 px-4 py-1.5 border-t flex items-center justify-center gap-1.5"
              >
                <BellRing size={9} className="text-primary shrink-0" />
                <span className="text-[8.5px] font-semibold truncate" >
                  Follow-up scheduled · Fri 10:00 · Short-Stay plan ready to send
                </span>
              </motion.div>

              {/* composer */}
              <motion.div style={{ opacity: composerOp }} className="shrink-0 px-3.5 py-1.5 flex items-center gap-2 border-t">
                <div className="flex-1 rounded-full px-3 py-1.5 text-[10px]" style={{ backgroundColor: 'var(--ma-bg-elevated)', color: 'var(--ma-muted-text)' }}>
                  Reply to lead…
                </div>
                <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
                  <Send size={12} className="text-white" />
                </span>
              </motion.div>
            </section>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   Scene 4 · Convert — AI-qualified lead rides New → Opportunity
   ============================================================ */

const PIPE_STAGES = [
  { label: 'New', count: '12' },
  { label: 'Contacted', count: '8' },
  { label: 'Qualified', count: '5' },
  { label: 'Follow-up', count: '3' },
  { label: 'Opportunity', count: '1' },
];

const PipelineLabel = ({ mv, i, label }) => {
  const threshold = 0.14 + i * 0.15;
  const active = inRange(mv, threshold, threshold + 0.04);
  const textColor = useTransform(active, [0, 1], ['var(--ma-muted-text)', 'var(--primary)']);
  const dotColor = useTransform(active, [0, 1], ['var(--ma-line)', 'var(--primary)']);
  return (
    <div className="flex items-center justify-center gap-1 min-w-0">
      <motion.span style={{ backgroundColor: dotColor }} className="w-1.5 h-1.5 rounded-full shrink-0" />
      <motion.p style={{ color: textColor }} className="text-[8px] sm:text-[10px] lg:text-[9px] font-bold truncate">{label}</motion.p>
    </div>
  );
};

const PipelineStage = ({ mv, i, count }) => {
  const threshold = 0.14 + i * 0.15;
  const active = inRange(mv, threshold, threshold + 0.04);
  const borderColor = useTransform(active, [0, 1], ['var(--ma-line-slim)', 'var(--primary)']);
  const textColor = useTransform(active, [0, 1], ['var(--ma-muted-text)', 'var(--primary)']);
  const scale = useTransform(active, [0, 1], [1, 1.04]);
  return (
    <motion.div
      style={{ borderColor, color: textColor, scale }}
      className="rounded-lg border h-11 sm:h-14 lg:h-12 flex items-center justify-center min-w-0"
    >
      <span className="text-[10px] sm:text-[12.5px] lg:text-[11.5px] font-bold tabular-nums">{count}</span>
    </motion.div>
  );
};

const LeadCard = ({ mv }) => {
  const prog = useTransform(mv, (v) => clamp01((v - 0.18) / 0.76));
  const left = useTransform(prog, (v) => `${v * 100}%`);
  const x = useTransform(prog, (v) => `${-v * 100}%`);
  const opacity = fade(mv, 0.2, 0.28, 0.96, 1);
  const scale = useTransform(prog, [0, 0.5, 1], [0.94, 1, 1.04]);
  return (
    <motion.div
      style={{ left, x, y: '-50%', opacity, scale }}
      data-testid="lead-card"
      className="absolute top-1/2 z-20 pointer-events-none"
    >
      <div
        className="rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center gap-2"
        style={{
          backgroundColor: 'var(--ma-bg-elevated)',
          borderColor: 'var(--ma-line)',
          boxShadow: '0 16px 32px -14px rgba(0,0,0,0.55), var(--showcase-accent-glow)',
        }}
      >
        <Avatar initials="RM" tint="from-cyan-400 to-blue-600" size="sm" />
        <p className="text-[10.5px] sm:text-[11.5px] font-bold whitespace-nowrap truncate max-w-[64px] sm:max-w-[110px]" style={{ color: 'var(--ma-list-title)' }}>Raees Malik</p>
        <BadgeCheck size={13} className="text-success shrink-0 hidden sm:block" />
      </div>
    </motion.div>
  );
};

const LeadDetails = ({ mv }) => {
  const op = inRange(mv, 0.12, 0.2);
  const pct = useTransform(mv, (v) => clamp01((v - 0.14) / 0.56));
  const score = useTransform(pct, (v) => Math.round(v * 92));
  const barW = useTransform(pct, (v) => `${Math.round(v * 92)}%`);
  return (
    <motion.div
      style={{ opacity: op, borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}
      className="hidden lg:flex h-full flex-col justify-center rounded-2xl border px-3.5 py-3"
    >
      <div className="flex items-center gap-2.5">
        <BrandMark initials="GH" tint="from-cyan-400 to-blue-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Golden Thread Imports</p>
          <p className="text-[8.5px] font-semibold text-primary">Raees Malik · Qualified</p>
        </div>
      </div>
      <div className="mt-2.5 pt-2.5 border-t flex items-end justify-between" style={{ borderColor: 'var(--ma-line-slim)' }}>
        <span className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>AI intent score</span>
        <motion.span className="text-[15px] font-bold tabular-nums text-primary"><motion.span>{score}</motion.span>%</motion.span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-border/60 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ width: barW, background: 'var(--primary)' }} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <StatusBadge>Textiles</StatusBadge>
        <StatusBadge>Istanbul, TR</StatusBadge>
        <StatusBadge tone="success"><Wifi size={8} /> WhatsApp</StatusBadge>
      </div>
    </motion.div>
  );
};

const CRMScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.04, 0.1);
  const pnlScale = useTransform(mv, (v) => 0.97 + 0.03 * easeOut(clamp01((v - 0.04) / 0.06)));
  const doneOp = inRange(mv, 0.8, 0.88);
  const connectW = useTransform(mv, (v) => `${clamp01((v - 0.18) / 0.76) * 100}%`);
  const remindOp = inRange(mv, 0.5, 0.58);
  const replyOp = inRange(mv, 0.62, 0.7);
  const outOp = inRange(mv, 0.84, 0.92);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="relative z-10 flex flex-col w-full h-full max-w-sm sm:max-w-xl lg:max-w-6xl mx-auto"
      >
        {/* AI qualification floating status */}
        <motion.div
          style={{ opacity: fade(mv, 0.02, 0.1, 0.94, 1) }}
          className="shrink-0 mb-2 flex justify-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-[10px] sm:text-[10.5px] font-bold px-3 py-1 shadow-[0_0_22px_-6px_var(--primary-alpha)]">
            <Sparkles size={12} /> AI Qualification · Intent score 92
          </span>
        </motion.div>

        <div
          data-testid="crm-panel"
          className="flex flex-col min-h-0 flex-1 rounded-2xl border overflow-hidden relative"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <TitleBar label="wa-shield — CRM Pipeline" />

          <div className="shrink-0 px-4 py-2 sm:py-2.5 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="w-8 h-8 rounded-full bg-primary/12 border border-primary/25 text-primary flex items-center justify-center shrink-0">
              <ClipboardList size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] lg:text-[12px] font-bold" style={{ color: 'var(--ma-list-title)' }}>CRM Pipeline</p>
              <p className="text-[9.5px] lg:text-[9px]" style={{ color: 'var(--ma-muted-text)' }}>From qualified lead to signed opportunity</p>
            </div>
            <StatusBadge tone="muted" className="hidden sm:inline-flex">4/4 · Convert</StatusBadge>
            <motion.div style={{ opacity: doneOp }}>
              <StatusBadge tone="success"><Check size={9} /> Opportunity</StatusBadge>
            </motion.div>
          </div>

          {/* pipeline body */}
          <div className="flex flex-col min-h-0 flex-1 px-3 sm:px-5 py-3" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
            <div className="flex-1 min-h-0 flex items-center">
              <div className="grid w-full lg:grid-cols-[240px_1fr] gap-3 lg:gap-4 items-stretch">
                <LeadDetails mv={mv} />

                {/* pipeline track + events */}
                <div className="flex flex-col justify-center gap-2 min-w-0">
                  <div className="relative flex flex-col justify-center min-h-0">
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 mb-1.5">
                      {PIPE_STAGES.map((s, i) => <PipelineLabel key={s.label} mv={mv} i={i} label={s.label} />)}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full" style={{ backgroundColor: 'var(--ma-line-slim)' }} />
                      <motion.div
                        style={{ width: connectW }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full origin-left bg-primary"
                      />
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 relative">
                        {PIPE_STAGES.map((s, i) => <PipelineStage key={s.label} mv={mv} i={i} count={s.count} />)}
                      </div>
                      <LeadCard mv={mv} />
                    </div>
                  </div>

                  <motion.div style={{ opacity: remindOp, backgroundColor: 'var(--ma-bg-panel)' }} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                    <BellRing size={13} className="text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Follow-up reminder · Fri 9:30 AM</p>
                      <p className="text-[8px] truncate" style={{ color: 'var(--ma-muted-text)' }}>Sent automatically via WhatsApp</p>
                    </div>
                    <StatusBadge tone="success"><Check size={8} /> Sent</StatusBadge>
                  </motion.div>

                  <motion.div style={{ opacity: replyOp, backgroundColor: 'var(--ma-bg-panel)' }} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                    <MessageCircle size={12} className="text-success shrink-0" />
                    <p className="min-w-0 flex-1 text-[9.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>
                      Raees Malik: “Sounds good — let’s move ahead.”
                    </p>
                    <Ticks level="read" className="shrink-0" />
                  </motion.div>
                </div>
              </div>
            </div>

            {/* outcome chips */}
            <motion.div style={{ opacity: outOp }} className="shrink-0 mt-3 flex items-center justify-center gap-2 flex-wrap">
              <StatusBadge tone="success"><CheckCheck size={9} /> Opportunity created</StatusBadge>
              <StatusBadge><TrendingUp size={9} /> Intent qualified</StatusBadge>
              <StatusBadge><Timer size={9} /> 3 min to qualify</StatusBadge>
              <StatusBadge><BellRing size={9} /> Follow-ups queued</StatusBadge>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   Organic background — rounded shapes drifting behind the UI
   ============================================================ */

const WorkflowBackground = ({ p }) => {
  const blobX = useTransform(p, [0, 1], [0, 60]);
  const blobY = useTransform(p, [0, 1], [0, -50]);
  const blob2X = useTransform(p, [0, 1], [0, -70]);
  const blob2Y = useTransform(p, [0, 1], [0, 40]);
  const softScale = useTransform(p, [0, 1], [1, 1.12]);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* oversized rounded green shape — top left */}
      <motion.div
        style={{
          x: blobX,
          y: blobY,
          scale: softScale,
          background: 'radial-gradient(circle at 30% 30%, rgba(0,184,110,0.20), rgba(0,184,110,0.06) 45%, transparent 68%)',
        }}
        className="absolute -top-[12%] -left-[8%] w-[46vmax] h-[46vmax] rounded-[40%]"
      />
      {/* oversized curved panel — right */}
      <motion.div
        style={{
          x: blob2X,
          y: blob2Y,
          background: 'radial-gradient(circle at 70% 40%, rgba(13,148,136,0.16), rgba(13,148,136,0.05) 46%, transparent 66%)',
        }}
        className="absolute -bottom-[18%] -right-[10%] w-[40vmax] h-[40vmax] rounded-[38%]"
      />
      {/* soft central green ambient glow */}
      <motion.div
        style={{
          scale: softScale,
          background: 'radial-gradient(circle, rgba(0,217,126,0.12), transparent 62%)',
        }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34vmax] h-[34vmax] rounded-full"
      />
      {/* subtle dot field */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--ma-line-slim) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          opacity: 0.5,
          maskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
        }}
      />
    </div>
  );
};

/* ============================================================
   Dynamic headline system — one message per workflow phase.
   ============================================================ */

const HEADLINES = [
  {
    title: 'Find the Right Business Leads',
    sub: 'Discover and import the exact audiences you want to reach.',
    a: 0.02,
    b: 0.3,
  },
  {
    title: 'Verify Every Lead Before Messaging',
    sub: 'Confirm WhatsApp availability so every outreach lands.',
    a: 0.28,
    b: 0.58,
  },
  {
    title: 'Turn Conversations Into Qualified Leads',
    sub: 'Let AI agents qualify prospects inside WhatsApp.',
    a: 0.52,
    b: 0.82,
  },
  {
    title: 'Follow Up and Win More Deals',
    sub: 'Move qualified leads into your CRM and convert them into opportunities.',
    a: 0.76,
    b: 0.98,
  },
  {
    title: 'Automate Your Follow-Ups',
    sub: 'Stay on every deal with smart, timely sequences.',
    a: 0.9,
    b: 1,
  },
];

const Wordmark = () => (
  <div className="flex flex-col items-center justify-center text-center">
    <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted mb-1.5 sm:mb-2">Start With a Goal</p>
    <Badge variant="outline" className="text-[10px] sm:text-[11px] px-2.5 sm:px-3 py-0.5 sm:py-1 text-primary border-primary/30 bg-primary/5">WhatsApp</Badge>
  </div>
);

/* One word — reveals & settles as the scene's headline activates. */
const RevealWord = ({ r, i, count, accent, children }) => {
  const pos = useTransform(r, (v) => clamp01(v * count - i));
  const inEase = useTransform(pos, (v) => 1 - Math.pow(1 - v, 2.2));
  const o = useTransform(inEase, (v) => v);
  const y = useTransform(inEase, (v) => (1 - v) * 14);
  const scale = useTransform(inEase, (v) => 0.96 + v * 0.04);
  const blur = useTransform(inEase, (v) => Math.round((1 - v) * 7 * 10) / 10);
  const filter = useTransform(blur, (v) => (v > 0.05 ? `blur(${v}px)` : 'none'));
  return (
    <motion.span
      style={{ opacity: o, y, scale, filter, display: 'inline-block', willChange: 'transform, filter, opacity' }}
      className={cn('mr-[0.22em]', accent && 'headline-accent')}
    >
      {children}
    </motion.span>
  );
};

const Headline = ({ p, a, b, title, sub }) => {
  const words = title.split(' ');
  const r = inRange(p, a, a + 0.09);
  const fadeOut = useTransform(p, [b, b + 0.05], [1, 0]);
  const blurOut = useTransform(p, [b, b + 0.05], [0, 10]);
  const glow = fade(p, a + 0.03, a + 0.09, b, b + 0.05);
  const y = useTransform(p, [a, a + 0.09, b, b + 0.05], [14, 0, 0, -8]);
  const scale = useTransform(p, [a, a + 0.09, b, b + 0.05], [1.05, 1, 1, 1.035]);
  const filter = useTransform([blurOut, glow], ([bl, g]) => {
    const drop = `0 14px 40px rgba(0, 217, 126, ${(g * 0.14).toFixed(3)})`;
    return bl > 0.05 ? `blur(${bl.toFixed(2)}px) drop-shadow(${drop})` : `drop-shadow(${drop})`;
  });
  const subOp = useTransform(r, (v) => clamp01((v - 0.4) / 0.6));
  const subY = useTransform(r, (v) => (1 - clamp01((v - 0.4) / 0.6)) * 10);
  return (
    <motion.div
      style={{ opacity: fadeOut, y, scale, filter, willChange: 'transform, filter, opacity' }}
      className="absolute inset-0 flex flex-col items-center justify-start text-center"
    >
      <h2 className="font-display font-bold tracking-tight leading-[1.12] text-text-primary text-[1.125rem] sm:text-[1.6rem] lg:text-[1.75rem] xl:text-[2rem]">
        {words.map((w, i) => (
          <RevealWord key={`${i}-${w}`} r={r} i={i} count={words.length} accent={i === words.length - 1}>
            {w}
          </RevealWord>
        ))}
      </h2>
      <motion.div
        style={{ opacity: subOp, scaleX: subOp }}
        className="origin-center mt-2 sm:mt-2.5 h-px w-16 sm:w-20 rounded-full"
      >
        <div className="h-full w-full" style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)' }} />
      </motion.div>
      <motion.p
        style={{ opacity: subOp, y: subY }}
        className="mt-1.5 sm:mt-2 text-[10.5px] sm:text-[12px] lg:text-[13.5px] xl:text-[14px] text-text-secondary leading-snug max-w-[17rem] sm:max-w-md lg:max-w-xl xl:max-w-2xl"
      >
        {sub}
      </motion.p>
    </motion.div>
  );
};

const HeadlineBlock = ({ p, items }) => (
  <div className="relative mx-auto w-full max-w-4xl xl:max-w-5xl h-[8.5rem] sm:h-[8.25rem] lg:h-[6rem] xl:h-[6rem] overflow-hidden">
    {items.map((hd) => (
      <Headline key={hd.title} p={p} a={hd.a} b={hd.b} title={hd.title} sub={hd.sub} />
    ))}
  </div>
);

/* ============================================================
   Main pinned section
   ============================================================ */

const ProgressDots = ({ ops }) => (
  <div className="flex items-center gap-2.5">
    {ops.map((op, i) => (
      <motion.span
        key={i}
        style={{ opacity: op, scale: op }}
        className="w-2 h-2 rounded-full bg-primary"
      />
    ))}
  </div>
);

export const GoalWorkflowSection = () => {
  const reduce = useReducedMotion();
  const secRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: secRef, offset: ['start start', 'end end'] });
  const p = useSpring(scrollYProgress, { stiffness: 70, damping: 24, mass: 0.5 });

  /* per-scene progress → mapped to the sticky window */
  const s1 = inRange(p, 0.04, 0.34);
  const s2 = inRange(p, 0.26, 0.56);
  const s3 = inRange(p, 0.5, 0.8);
  const s4 = inRange(p, 0.74, 1);

  /* cross-fade opacities */
  const o1 = fade(p, 0.04, 0.1, 0.3, 0.36);
  const o2 = fade(p, 0.26, 0.32, 0.54, 0.6);
  const o3 = fade(p, 0.5, 0.56, 0.78, 0.84);
  const o4 = fade(p, 0.74, 0.8, 1.05, 1.1);

  const hintOp = fade(p, 0.06, 0.14, 0.18, 0.24);
  const ctaOp = inRange(p, 0.9, 0.97);
  const ctaY = useTransform(p, [0.9, 1], [12, 0]);

  if (reduce) {
    return (
      <div className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8 bg-surface border-t border-border">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">Start With a Goal</p>
          <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">WhatsApp</Badge>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2">Find the Right Business Leads</h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed mb-8">
            Discover leads, verify them, chat on WhatsApp with AI help, and move every conversation into a CRM pipeline.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-left">
            {[
              { icon: Search, title: 'Find leads', desc: 'Discover and import leads from the markets you choose.' },
              { icon: ShieldCheck, title: 'Verify leads', desc: 'Normalize numbers and confirm WhatsApp accounts.' },
              { icon: MessageCircle, title: 'Chat with AI', desc: 'Run real conversations with ticks and typing.' },
              { icon: ClipboardList, title: 'CRM pipeline', desc: 'Qualify intent and track New → Opportunity.' },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-border/70 bg-surface p-4">
                <c.icon size={18} className="text-primary mb-2" />
                <p className="text-sm font-bold mb-1">{c.title}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/message-agent">
                Open the live workspace <ArrowRight size={15} className="ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={secRef} className="relative w-full h-[460vh] bg-surface border-t border-border overflow-x-clip">
      {/* pinned below the fixed header (56px), sized to the live viewport */}
      <div className="sticky top-[56px] h-[calc(100svh-56px)] max-h-[calc(100svh-56px)] overflow-hidden flex flex-col">
        <WorkflowBackground p={p} />

        {/* heading group */}
        <header className="relative z-10 shrink-0 px-4 pt-2.5 sm:pt-4 lg:pt-3 xl:pt-4">
          <Wordmark />
          <div className="mt-2.5 sm:mt-2.5">
            <HeadlineBlock p={p} items={HEADLINES} />
          </div>
        </header>

        {/* scene stage — viewport-aware reserved area, always centered with breathing room */}
        <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-3 xl:py-4">
          <div className="relative w-full max-w-6xl h-[min(64svh,410px)] sm:h-[min(60svh,450px)] md:h-[min(60svh,480px)] lg:h-[min(66svh,560px)] xl:h-[min(62svh,600px)] max-h-full">
            <motion.div style={{ opacity: o1 }} className="absolute inset-0">
              <LeadDiscoveryScene mv={s1} />
            </motion.div>
            <motion.div style={{ opacity: o2 }} className="absolute inset-0">
              <VerificationScene mv={s2} />
            </motion.div>
            <motion.div style={{ opacity: o3 }} className="absolute inset-0">
              <ConversationScene mv={s3} />
            </motion.div>
            <motion.div style={{ opacity: o4 }} className="absolute inset-0">
              <CRMScene mv={s4} />
            </motion.div>
          </div>
        </div>

        {/* scroll hint + CTA (share one row so height never shifts) */}
        <div className="relative z-30 shrink-0 flex items-center justify-center px-4 pb-3.5 pt-1">
          <motion.div style={{ opacity: hintOp }} className="absolute inset-0 flex items-center justify-center gap-3">
            <ProgressDots ops={[o1, o2, o3, o4]} />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Scroll to explore</span>
          </motion.div>
          <motion.div style={{ opacity: ctaOp, y: ctaY }} className="relative">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/message-agent">
                Open the live workspace <ArrowRight size={13} />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export const WhatsAppWorkflowSection = GoalWorkflowSection;