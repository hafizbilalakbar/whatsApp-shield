import React, { useRef } from 'react';
import {
  motion, useScroll, useTransform, useSpring, useReducedMotion,
} from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Building2, RefreshCw, ShieldCheck, BadgeCheck, Check,
  CheckCheck, Sparkles, Send, Phone, MessageCircle, MoreVertical,
  Video, Users, ArrowRight, Wifi, BellRing, Layers,
  TrendingUp, Inbox, ClipboardList, Timer,
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

const Avatar = ({ img, initials, size = 'md', online = false, className }) => {
  const [err, setErr] = React.useState(false);
  const sz = size === 'xl' ? 'w-10 h-10 text-sm'
    : size === 'lg' ? 'w-9 h-9 text-sm'
      : size === 'sm' ? 'w-6 h-6 text-[9px]'
        : 'w-8 h-8 text-xs';
  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      <span className={cn('rounded-full flex items-center justify-center overflow-hidden ring-1 ring-black/10 dark:ring-white/15 bg-gradient-to-br from-[#00B86E]/90 to-[#0D9488]/90 text-white font-bold', sz)}>
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

/* rounded "traffic light" title bar used by every desktop mockup window */
const TitleBar = ({ label }) => (
  <div className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 border-b" style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}>
    <span className="w-2 h-2 rounded-full bg-[#FF5F57]" aria-hidden="true" />
    <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
    <span className="w-2 h-2 rounded-full bg-[#28C840]" aria-hidden="true" />
    <span className="ml-2 text-[9.5px] font-semibold truncate" style={{ color: 'var(--ma-muted-text)' }}>{label}</span>
  </div>
);

/* ============================================================
   Scene 1 · Discover / Import — desktop "Business Discovery"
   window: source sidebar + lead list. Duplicates merge.
   ============================================================ */

const DISCOVERY_SOURCES = [
  { icon: Building2, name: 'Furniture Wholesalers', region: 'Sharjah · UAE', count: '8.4k' },
  { icon: MapPin, name: 'Real Estate', region: 'Dubai · UAE', count: '12.1k' },
  { icon: Search, name: 'IT Services', region: 'Abu Dhabi · UAE', count: '3.2k' },
  { icon: RefreshCw, name: 'Directory Sync', region: 'Auto · daily', count: 'Live' },
];

const DiscoverySource = ({ mv, i, icon: Icon, name, region, count }) => {
  const op = inRange(mv, 0.1 + i * 0.06, 0.18 + i * 0.06);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - (0.1 + i * 0.06)) / 0.08))) * 14);
  return (
    <motion.div style={{ opacity: op, y }} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
      <span className="w-6 h-6 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0">
        <Icon size={11} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{name}</p>
        <p className="text-[8px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{region}</p>
      </div>
      <span className="text-[9px] font-semibold tabular-nums" style={{ color: 'var(--ma-accent)' }}>{count}</span>
    </motion.div>
  );
};

const LEAD_ROWS = [
  { name: 'Ahmed Raza', meta: 'Real Estate · Dubai, UAE', phone: '+971 52 182 3400', img: 'omar', initials: 'AR', merged: true },
  { name: 'Tech Solutions', meta: 'IT Services · Abu Dhabi', phone: '+971 2 555 0987', img: 'marco', initials: 'TS', merged: false },
  { name: 'Summit Interiors', meta: 'Interior Fit-out · Sharjah', phone: '+971 6 700 2233', img: 'lena', initials: 'SI', merged: false },
  { name: 'Nova Builders', meta: 'Construction · Al Ain', phone: '+971 3 789 1122', img: '', initials: 'NB', merged: false },
];

const ImportRow = ({ mv, i, name, meta, phone, img, initials, merged }) => {
  const op = inRange(mv, 0.32 + i * 0.06, 0.42 + i * 0.06);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - (0.32 + i * 0.06)) / 0.1))) * 16);
  const mergeOp = inRange(mv, 0.62, 0.74);
  return (
    <motion.div
      style={{ opacity: op, y }}
      className="flex items-center gap-2.5 rounded-xl border px-3 py-2 mt-1.5 first:mt-0"
    >
      <Avatar img={img} initials={initials} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] sm:text-[12.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{name}</p>
        <p className="text-[8.5px] sm:text-[9.5px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{meta}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="hidden sm:block text-[9.5px] font-semibold tabular-nums" style={{ color: 'var(--ma-list-title)' }}>
          {merged ? (
            <motion.span style={{ opacity: mergeOp }}>
              <Check size={10} className="inline text-success mr-0.5" />2 merged
            </motion.span>
          ) : (
            phone
          )}
        </span>
        <StatusBadge tone={merged ? 'success' : 'muted'} className={merged ? '' : 'opacity-80'}>
          {merged ? (
            <motion.span style={{ opacity: mergeOp }} className="inline-flex items-center gap-1">
              <Check size={9} /> WhatsApp ready
            </motion.span>
          ) : (
            <><Wifi size={8} /> WhatsApp</>
          )}
        </StatusBadge>
      </div>
    </motion.div>
  );
};

const LeadDiscoveryScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.1, 0.24);
  const pnlScale = useTransform(mv, (v) => 0.97 + 0.03 * easeOut(clamp01((v - 0.1) / 0.14)));
  const pnlY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.1) / 0.14))) * 18);
  const statusOp = inRange(mv, 0.76, 0.88);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale, y: pnlY }}
        className="relative z-10 w-full max-w-sm sm:max-w-xl lg:max-w-4xl xl:max-w-5xl mx-auto"
      >
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <TitleBar label="wa-shield — Business Discovery" />

          {/* app header */}
          <div className="px-4 py-2.5 sm:py-3 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="w-8 h-8 rounded-full bg-primary/12 border border-primary/25 text-primary flex items-center justify-center shrink-0">
              <Inbox size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Business Discovery</p>
              <p className="text-[9.5px]" style={{ color: 'var(--ma-muted-text)' }}>Importing leads into the pipeline</p>
            </div>
            <StatusBadge><RefreshCw size={9} /> Syncing</StatusBadge>
          </div>

          <div className="grid md:grid-cols-[220px_1fr]">
            {/* source sidebar (desktop) */}
            <aside
              className="hidden md:flex flex-col border-r px-2 py-3"
              style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-root)' }}
            >
              <div className="px-2 pb-1.5 flex items-center justify-between">
                <p className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Sources</p>
                <span className="text-[8.5px] font-bold text-primary">3 active</span>
              </div>
              {DISCOVERY_SOURCES.map((s, i) => <DiscoverySource key={s.name} mv={mv} i={i} {...s} />)}
              <motion.div
                style={{ opacity: statusOp }}
                className="mt-auto pt-2.5 mx-1 border-t flex items-center justify-between"
              >
                <span className="text-[8.5px] font-semibold" style={{ color: 'var(--ma-muted-text)' }}>1,460 imported</span>
                <span className="text-[8.5px] font-bold text-success">Healthy</span>
              </motion.div>
            </aside>

            {/* imported lead list */}
            <div className="px-3 sm:px-4 py-3" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
              <div className="hidden md:flex items-center justify-between px-1 pb-2">
                <p className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Imported contacts</p>
                <p className="text-[8.5px] font-semibold" style={{ color: 'var(--ma-accent)' }}>Duplicates auto-merged</p>
              </div>
              <div className="w-full">
                {LEAD_ROWS.map((r, i) => <ImportRow key={r.name} mv={mv} i={i} {...r} />)}
              </div>
            </div>
          </div>

          {/* import footer */}
          <div className="px-4 py-2.5 flex items-center justify-between border-t" style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}>
            <motion.div style={{ opacity: statusOp }} className="flex items-center gap-2">
              <Users size={12} style={{ color: 'var(--ma-muted-text)' }} />
              <span className="text-[10px] font-semibold" style={{ color: 'var(--ma-muted-text)' }}>1,460 contacts imported</span>
            </motion.div>
            <motion.div style={{ opacity: statusOp }}>
              <StatusBadge tone="success"><Check size={9} /> Normalized</StatusBadge>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   Scene 2 · Verify — Import / Normalize / Validate / Verify as
   one connected process, ending in a verified contact.
   ============================================================ */

const VerifySteps = ({ mv }) => {
  const steps = [
    { icon: Inbox, label: 'Import' },
    { icon: Layers, label: 'Normalize' },
    { icon: ShieldCheck, label: 'Validate' },
    { icon: BadgeCheck, label: 'Verify' },
  ];
  return (
    <div className="flex items-stretch gap-0">
      {steps.map((s, i) => (
        <VerifyStep key={s.label} mv={mv} i={i} total={steps.length} icon={s.icon} label={s.label} />
      ))}
    </div>
  );
};

const VerifyStep = ({ mv, i, total, icon: Icon, label }) => {
  const start = 0.08 + i * 0.15;
  const on = inRange(mv, start, start + 0.06);
  const done = inRange(mv, start + 0.02, start + 0.14);
  const lineColor = useTransform(on, [0, 1], ['var(--ma-line-slim)', 'var(--primary)']);
  const lineW = useTransform(mv, (v) => `${easeOut(clamp01((v - (start + 0.1)) / 0.2)) * 100}%`);
  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="flex items-center w-full">
        <motion.div
          style={{ backgroundColor: i === 0 ? 'transparent' : lineColor }}
          className="h-[2px] flex-1 rounded-full"
        />
        <motion.div
          style={{ scale: on, borderColor: lineColor, color: lineColor }}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center shrink-0"
        >
          <Icon size={14} />
        </motion.div>
        <motion.div
          style={{ width: lineW }}
          className={cn('h-[2px] rounded-full origin-left bg-primary', i < total - 1 ? '' : 'opacity-0')}
        />
      </div>
      <motion.span style={{ opacity: done }} className="mt-1.5 text-[9.5px] sm:text-[10px] font-bold">{label}</motion.span>
    </div>
  );
};

const VerifiedSummary = ({ mv }) => {
  const op = inRange(mv, 0.5, 0.62);
  const cards = [
    { img: 'omar', initials: 'AR', name: 'Ahmed Raza', num: '+971 52 182 3400' },
    { img: 'marco', initials: 'TS', name: 'Tech Solutions', num: '+971 2 555 0987' },
    { img: 'lena', initials: 'SI', name: 'Summit Interiors', num: '+971 6 700 2233' },
  ];
  return (
    <motion.div
      style={{ opacity: op }}
      className="rounded-2xl border flex flex-col"
    >
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
        <p className="text-[10px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Bulk verification</p>
        <StatusBadge tone="success"><Check size={8} /> 3/3</StatusBadge>
      </div>
      <div className="px-2 pb-1">
        {cards.map((c, i) => {
          const rowOp = inRange(mv, 0.54 + i * 0.05, 0.6 + i * 0.05);
          const rowCheck = inRange(mv, 0.6 + i * 0.05, 0.66 + i * 0.05);
          return (
            <motion.div key={c.name} style={{ opacity: rowOp }} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
              <Avatar img={c.img} initials={c.initials} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{c.name}</p>
                <p className="text-[8px] tabular-nums truncate" style={{ color: 'var(--ma-muted-text)' }}>{c.num}</p>
              </div>
              <motion.span style={{ opacity: rowCheck }} className="text-success shrink-0">
                <BadgeCheck size={12} />
              </motion.span>
            </motion.div>
          );
        })}
      </div>
      <div className="px-3 pt-1.5 pb-2.5 border-t text-center" style={{ borderColor: 'var(--ma-line-slim)' }}>
        <p className="text-[9px] font-semibold" style={{ color: 'var(--ma-accent)' }}>Ready to message — no bouncing</p>
      </div>
    </motion.div>
  );
};

const VerificationScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.12, 0.26);
  const pnlScale = useTransform(mv, (v) => 0.97 + 0.03 * easeOut(clamp01((v - 0.12) / 0.14)));
  const scan = useTransform(mv, [0.3, 0.6], ['-20%', '120%']);
  const scanOp = fade(mv, 0.28, 0.34, 0.64, 0.72);
  const verifiedOp = inRange(mv, 0.74, 0.86);
  const verifiedScale = useTransform(mv, (v) => 0.92 + 0.08 * easeOut(clamp01((v - 0.74) / 0.12)));
  const numFormatted = inRange(mv, 0.45, 0.58);
  const statusCheck = inRange(mv, 0.55, 0.68);
  const profileOp = inRange(mv, 0.2, 0.34);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="relative z-10 w-full max-w-sm sm:max-w-xl lg:max-w-4xl xl:max-w-5xl mx-auto"
      >
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <TitleBar label="wa-shield — Contact Verification" />

          <div className="px-4 py-2.5 sm:py-3 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="w-8 h-8 rounded-full bg-primary/12 border border-primary/25 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Contact Verification</p>
              <p className="text-[9.5px]" style={{ color: 'var(--ma-muted-text)' }}>Checking WhatsApp availability</p>
            </div>
            <motion.div style={{ opacity: verifiedOp, scale: verifiedScale }}>
              <StatusBadge tone="success"><BadgeCheck size={10} /> Verified</StatusBadge>
            </motion.div>
          </div>

          <div className="px-3 sm:px-4 pb-3 pt-2" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
            {/* process rail */}
            <div className="relative z-10 mb-2.5">
              <VerifySteps mv={mv} />
            </div>

            <div className="grid lg:grid-cols-[1fr_240px] gap-2.5">
              {/* number card with scanning line */}
              <div
                className="rounded-2xl border px-4 py-3.5 relative overflow-hidden"
                style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Phone number</span>
                  <motion.span style={{ opacity: statusCheck }} className="text-[10px] font-bold text-success">Checking…</motion.span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone size={15} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0" />
                  <motion.span style={{ color: 'var(--ma-list-title)' }} className="text-[15px] sm:text-lg font-bold tabular-nums tracking-tight">
                    <motion.span style={{ opacity: numFormatted }}>+971 52 182 3400</motion.span>
                  </motion.span>
                  <motion.span style={{ opacity: verifiedOp, scale: verifiedScale }} className="ml-auto inline-flex items-center gap-1">
                    <Ticks level="read" />
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

              {/* bulk verification summary (desktop) */}
              <div className="hidden lg:block">
                <VerifiedSummary mv={mv} />
              </div>
            </div>

            {/* lead profile */}
            <motion.div style={{ opacity: profileOp }} className="mt-2.5 flex items-center gap-2.5 rounded-xl border px-3 py-2.5">
              <Avatar img="omar" initials="AR" size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Ahmed Raza</p>
                <p className="text-[9px] truncate" style={{ color: 'var(--ma-muted-text)' }}>Real Estate · Dubai, UAE</p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold text-success">
                <Wifi size={10} /> WhatsApp
              </span>
            </motion.div>

            {/* verified state */}
            <motion.div
              style={{
                opacity: verifiedOp,
                scale: verifiedScale,
                backgroundColor: 'var(--ma-bg-panel)',
                borderColor: 'var(--ma-line-slim)',
              }}
              className="mt-2.5 rounded-2xl border px-4 py-3 flex items-center gap-2.5"
            >
              <span className="w-9 h-9 rounded-full bg-success flex items-center justify-center shadow-[0_0_18px_-4px_var(--success)]">
                <Check size={18} className="text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold text-success">WhatsApp Number Verified</p>
                <p className="text-[9px]" style={{ color: 'var(--ma-muted-text)' }}>Safe to message · Send now</p>
              </div>
              <motion.div className="ml-auto">
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
   Scene 3 · Conversation — desktop WhatsApp chat: chat list
   sidebar + live AI-assisted conversation.
   ============================================================ */

const CHAT_MSGS = [
  { side: 'agent', ai: true, at: 0.06, time: '12:41', text: 'Hi Ahmed, we noticed you\u2019re looking into lead generation for your business.' },
  { side: 'lead', at: 0.2, time: '12:42', text: 'Yes, I\u2019m interested. Can you share more details?' },
  { side: 'agent', ai: true, at: 0.36, time: '12:43', ticks: true, text: 'Of course — I\u2019ve pre-qualified your profile and checked your WhatsApp number. A rep will follow up within the hour.' },
  { side: 'lead', at: 0.56, time: '12:44', text: 'Perfect, I\u2019ll be ready.' },
];

const ChatBubble = ({ mv, msg }) => {
  const op = inRange(mv, msg.at, msg.at + 0.06);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - msg.at) / 0.06))) * 14);
  const agent = msg.side === 'agent';
  return (
    <motion.div style={{ opacity: op, y }} className={cn('flex', agent ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('relative max-w-[82%] lg:max-w-[70%] rounded-xl px-3 py-1.5 text-[11px] leading-snug', agent ? 'rounded-tr-sm' : 'rounded-tl-sm')}
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
          <span className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>{msg.time || '12:41'}</span>
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

const CHAT_LIST = [
  { img: 'omar', initials: 'AR', name: 'Ahmed Raza', last: 'I\u2019ll be ready.', time: '12:44', active: true, online: true, count: 0 },
  { img: 'marco', initials: 'TS', name: 'Tech Solutions', last: 'Thanks, sharing specs.', time: '11:30', active: false, online: false, count: 2 },
  { img: 'lena', initials: 'SI', name: 'Summit Interiors', last: 'Can we meet Monday?', time: '09:12', active: false, online: false, count: 1 },
];

const ChatRow = ({ mv, i, img, initials, name, last, time, active, online, count }) => {
  const op = inRange(mv, 0.14 + i * 0.05, 0.22 + i * 0.05);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - (0.14 + i * 0.05)) / 0.08))) * 12);
  return (
    <motion.div
      style={{ opacity: op, y }}
      className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-xl mx-1.5', active && 'bg-primary/10')}
    >
      <Avatar img={img} initials={initials} size="xl" online={online} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] font-bold truncate" style={{ color: active ? 'var(--primary)' : 'var(--ma-list-title)' }}>{name}</p>
          <span className="text-[8px] shrink-0" style={{ color: 'var(--ma-muted-text)' }}>{time}</span>
        </div>
        <p className="text-[8.5px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{last}</p>
      </div>
      {count > 0 && (
        <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary/15 text-primary text-[8px] font-bold flex items-center justify-center shrink-0">
          {count}
        </span>
      )}
    </motion.div>
  );
};

const ConversationScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.14, 0.26);
  const pnlScale = useTransform(mv, (v) => 0.97 + 0.03 * easeOut(clamp01((v - 0.14) / 0.12)));
  const composerOp = inRange(mv, 0.5, 0.62);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="relative z-10 w-full max-w-sm sm:max-w-xl lg:max-w-4xl xl:max-w-5xl mx-auto"
      >
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <TitleBar label="wa-shield — Message Agent" />

          <div className="grid md:grid-cols-[230px_1fr]">
            {/* chat list sidebar (desktop) */}
            <aside
              className="hidden md:flex flex-col border-r py-2"
              style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-root)' }}
            >
              <div className="px-3 pb-2">
                <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5" style={{ backgroundColor: 'var(--ma-bg-elevated)' }}>
                  <Search size={11} style={{ color: 'var(--ma-muted-text)' }} />
                  <span className="text-[9px]" style={{ color: 'var(--ma-muted-text)' }}>Search chats</span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {CHAT_LIST.map((c, i) => <ChatRow key={c.name} mv={mv} i={i} {...c} />)}
              </div>
              <motion.div style={{ opacity: composerOp }} className="mx-3 mt-2 mb-1 flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 px-2.5 py-2">
                <Sparkles size={11} className="text-primary" />
                <p className="text-[8.5px] font-semibold leading-tight text-primary">AI agents handling 12 conversations</p>
              </motion.div>
            </aside>

            {/* conversation pane */}
            <section className="flex flex-col min-w-0">
              {/* chat header — verified contact */}
              <div className="px-3.5 py-2 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
                <Avatar img="omar" initials="AR" online />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Ahmed Raza</p>
                  <p className="text-[9.5px] flex items-center gap-1" style={{ color: 'var(--ma-accent)' }}>
                    <BadgeCheck size={10} /> Verified WhatsApp
                  </p>
                </div>
                <Video size={15} style={{ color: 'var(--ma-muted-text)' }} className="hidden sm:block" />
                <Phone size={13} style={{ color: 'var(--ma-muted-text)' }} className="hidden sm:block" />
                <MoreVertical size={15} style={{ color: 'var(--ma-muted-text)' }} />
              </div>

              {/* messages */}
              <div className="px-3.5 py-3 flex flex-col gap-2 min-h-[210px] sm:min-h-[260px] md:min-h-[300px] justify-end grow" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
                {CHAT_MSGS.map((m) => <ChatBubble key={m.text} mv={mv} msg={m} />)}
                <TypingRow mv={mv} at={0.26} out={0.36} />
              </div>

              {/* AI qualification chip */}
              <div className="px-3.5 py-1.5 border-t flex items-center justify-center" style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}>
                <motion.div
                  style={{ opacity: inRange(mv, 0.5, 0.62) }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 text-primary text-[9px] font-bold px-2.5 py-1"
                >
                  <Sparkles size={10} /> AI Qualification running
                </motion.div>
              </div>

              {/* composer */}
              <motion.div
                style={{ opacity: composerOp }}
                className="px-3.5 py-1.5 flex items-center gap-2 border-t"
              >
                <div className="flex-1 rounded-full px-3 py-1.5 text-[10px]" style={{ backgroundColor: 'var(--ma-bg-elevated)', color: 'var(--ma-muted-text)' }}>
                  Type a message
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
   Scene 4 · CRM Pipeline — AI qualifies, then the lead rides
   each stage from New → Negotiation.
   ============================================================ */

const PIPE_STAGES = [
  { label: 'New', count: '3' },
  { label: 'Contacted', count: '2' },
  { label: 'Responded', count: '5' },
  { label: 'Qualified', count: '9' },
  { label: 'Negotiation', count: '12' },
];

const PipelineStage = ({ mv, i, label, count }) => {
  const threshold = 0.14 + i * 0.15;
  const active = inRange(mv, threshold, threshold + 0.06);
  const borderColor = useTransform(active, [0, 1], ['var(--ma-line-slim)', 'var(--primary)']);
  const textColor = useTransform(active, [0, 1], ['var(--ma-muted-text)', 'var(--primary)']);
  const dotColor = useTransform(active, [0, 1], ['var(--ma-muted-text)', 'var(--primary)']);
  const scale = useTransform(active, [0, 1], [1, 1.05]);
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
      <div className="flex items-center justify-center gap-1 px-1">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        <p className="text-[8.5px] sm:text-[10px] font-bold truncate" style={{ color: textColor }}>{label}</p>
      </div>
      <motion.div
        style={{ borderColor, color: textColor, scale }}
        className="rounded-lg border h-10 sm:h-12 flex items-center justify-center"
      >
        <span className="text-[9px] sm:text-[11px] font-bold tabular-nums">{count}</span>
      </motion.div>
    </div>
  );
};

const LeadCard = ({ mv }) => {
  const x = useTransform(mv, (v) => `${clamp01(v) * 86}%`);
  return (
    <motion.div style={{ left: x }} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20">
      <div
        className="rounded-xl border px-3 py-2 flex items-center gap-2"
        style={{
          backgroundColor: 'var(--ma-bg-panel)',
          borderColor: 'var(--ma-line-slim)',
          boxShadow: '0 14px 28px -12px rgba(0,0,0,0.45), var(--showcase-accent-glow)',
        }}
      >
        <Avatar img="omar" initials="AR" />
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold whitespace-nowrap" style={{ color: 'var(--ma-list-title)' }}>Ahmed Raza</p>
          <p className="text-[8.5px] whitespace-nowrap" style={{ color: 'var(--ma-muted-text)' }}>Real Estate · WhatsApp Lead</p>
        </div>
        <BadgeCheck size={14} className="text-success shrink-0" />
      </div>
    </motion.div>
  );
};

const LeadDetails = ({ mv }) => {
  const op = inRange(mv, 0.14, 0.26);
  const score = useTransform(mv, (v) => Math.round(clamp01((v - 0.14) / 0.6) * 92));
  const barW = useTransform(mv, (v) => `${Math.round(clamp01((v - 0.14) / 0.6) * 92)}%`);
  return (
    <motion.div
      style={{ opacity: op }}
      className="hidden lg:flex flex-col rounded-2xl border px-3.5 py-3"
    >
      <div className="flex items-center gap-2.5">
        <Avatar img="omar" initials="AR" size="lg" online />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Ahmed Raza</p>
          <p className="text-[8.5px] font-semibold text-primary">Qualified Lead</p>
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
        <StatusBadge>Real Estate</StatusBadge>
        <StatusBadge>Dubai</StatusBadge>
        <StatusBadge tone="success"><Wifi size={8} /> WhatsApp</StatusBadge>
      </div>
    </motion.div>
  );
};

const CRMScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.14, 0.26);
  const pnlScale = useTransform(mv, (v) => 0.97 + 0.03 * easeOut(clamp01((v - 0.14) / 0.12)));
  const totalOp = fade(mv, 0.42, 0.52, 0.96, 1);
  const doneOp = inRange(mv, 0.9, 0.98);
  const connectW = useTransform(mv, (v) => `${clamp01((v - 0.14) / 0.86) * 88}%`);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="relative z-10 w-full max-w-sm sm:max-w-xl lg:max-w-5xl mx-auto"
      >
        {/* AI qualification floating status */}
        <motion.div
          style={{ opacity: fade(mv, 0.02, 0.1, 0.92, 1) }}
          className="mb-2.5 flex justify-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-[10px] sm:text-[10.5px] font-bold px-3 py-1 shadow-[0_0_22px_-6px_var(--primary-alpha)]">
            <Sparkles size={12} /> AI Qualification
          </span>
        </motion.div>

        <div
          className="rounded-2xl border overflow-hidden relative"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <TitleBar label="wa-shield — CRM Pipeline" />

          <div className="px-4 py-2.5 sm:py-3 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="w-8 h-8 rounded-full bg-primary/12 border border-primary/25 text-primary flex items-center justify-center shrink-0">
              <ClipboardList size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold" style={{ color: 'var(--ma-list-title)' }}>CRM Pipeline</p>
              <p className="text-[9.5px]" style={{ color: 'var(--ma-muted-text)' }}>Lead moves through every stage</p>
            </div>
            <motion.div style={{ opacity: doneOp }}>
              <StatusBadge tone="success"><Check size={9} /> Negotiation</StatusBadge>
            </motion.div>
          </div>

          {/* pipeline body */}
          <div className="px-3 sm:px-4 py-3" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
            <div className="grid lg:grid-cols-[250px_1fr] gap-2.5 items-start">
              <LeadDetails mv={mv} />

              {/* pipeline track */}
              <div className="relative py-2 px-2 sm:px-6">
                <div className="absolute top-[46%] left-2 right-2 sm:left-8 sm:right-8 h-[2px] rounded-full -mt-[7px]" style={{ backgroundColor: 'var(--ma-line-slim)' }} />
                <motion.div
                  style={{ width: connectW }}
                  className="absolute top-[46%] left-2 sm:left-8 h-[2px] rounded-full -mt-[7px] origin-left bg-primary"
                />
                {/* stage columns */}
                <div className="flex items-start gap-1.5 sm:gap-2.5 relative z-10">
                  {PIPE_STAGES.map((s, i) => <PipelineStage key={s.label} mv={mv} i={i} label={s.label} count={s.count} />)}
                </div>
                {/* lead card rides the track */}
                <LeadCard mv={mv} />
              </div>
            </div>

            {/* outcome chips */}
            <motion.div style={{ opacity: totalOp }} className="mt-3.5 flex items-center justify-center gap-2.5 flex-wrap">
              <StatusBadge tone="success"><Layers size={9} /> Stage updated</StatusBadge>
              <StatusBadge><TrendingUp size={9} /> CRM tracked</StatusBadge>
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
    title: 'Keep Every Customer Conversation Organized',
    sub: 'Every chat, ticket and status reflected in one CRM.',
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
  const y = useTransform(p, [a, a + 0.09, b, b + 0.05], [14, 0, 0, -12]);
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
      <h2 className="font-display font-bold tracking-tight leading-[1.12] text-text-primary text-[1.375rem] sm:text-[1.7rem] lg:text-[2.05rem] xl:text-[2.3rem]">
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
        className="mt-1.5 sm:mt-2 text-[11px] sm:text-[12.5px] lg:text-[15px] text-text-secondary leading-snug max-w-[17rem] sm:max-w-md lg:max-w-xl"
      >
        {sub}
      </motion.p>
    </motion.div>
  );
};

const HeadlineBlock = ({ p, items }) => (
  <div className="relative mx-auto w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl h-[7rem] sm:h-[5.25rem] lg:h-[5.75rem] xl:h-[6rem] overflow-hidden">
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
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.6 });

  /* per-scene progress → mapped to the sticky window */
  const s1 = inRange(p, 0.04, 0.32);
  const s2 = inRange(p, 0.26, 0.56);
  const s3 = inRange(p, 0.5, 0.8);
  const s4 = inRange(p, 0.74, 1);

  /* cross-fade opacities */
  const o1 = fade(p, 0.04, 0.1, 0.3, 0.36);
  const o2 = fade(p, 0.24, 0.3, 0.52, 0.58);
  const o3 = fade(p, 0.48, 0.54, 0.76, 0.82);
  const o4 = fade(p, 0.72, 0.78, 0.98, 1);

  const hintOp = fade(p, 0.06, 0.14, 0.18, 0.24);
  const ctaOp = inRange(p, 0.9, 0.97);
  const ctaY = useTransform(p, [0.9, 1], [16, 0]);

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
              { icon: ClipboardList, title: 'CRM pipeline', desc: 'Qualify intent and track New → Negotiation.' },
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
    <div ref={secRef} className="relative w-full h-[420vh] bg-surface border-t border-border overflow-x-clip">
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col">
        <WorkflowBackground p={p} />

        {/* heading group */}
        <header className="relative z-10 shrink-0 px-4 pt-6 sm:pt-8 lg:pt-10">
          <Wordmark />
          <div className="mt-2.5 sm:mt-3">
            <HeadlineBlock p={p} items={HEADLINES} />
          </div>
        </header>

        {/* scene stage — centered in the flexible middle, never overlaps */}
        <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-7">
          <div className="relative w-full max-w-6xl h-full max-h-[460px] sm:max-h-[500px] lg:max-h-[520px]">
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

        {/* scroll hint + progress + CTA */}
        <div className="relative z-30 shrink-0 flex flex-col items-center gap-2 px-4 pb-5 sm:pb-6">
          <motion.div style={{ opacity: hintOp }} className="flex flex-col items-center gap-1.5">
            <ProgressDots ops={[o1, o2, o3, o4]} />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Scroll to explore</span>
          </motion.div>
          <motion.div style={{ opacity: ctaOp, y: ctaY }}>
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