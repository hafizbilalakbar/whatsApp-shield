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
  const sz = size === 'lg' ? 'w-9 h-9 text-sm' : size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-xs';
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

/* ============================================================
   Scene 1 · Discover / Import — leads enter the scene, then
   organize into a clean list. Duplicates merge.
   ============================================================ */

const FLOAT_CHIPS = [
  { icon: Search, label: 'furniture wholesalers · UAE', left: '6%', top: '12%', fx: -260, fy: -70 },
  { icon: Building2, label: 'IT services · Abu Dhabi', left: '82%', top: '16%', fx: 280, fy: -40 },
  { icon: MapPin, label: 'Real estate · Dubai', left: '8%', top: '68%', fx: -300, fy: 60 },
  { icon: RefreshCw, label: 'Directory sync', left: '84%', top: '64%', fx: 300, fy: 80 },
];

const ImportRows = ({ mv }) => {
  const rows = [
    { name: 'Ahmed Raza', meta: 'Real Estate · Dubai, UAE', phone: '+971 52 182 3400', img: 'omar', initials: 'AR' },
    { name: 'Tech Solutions', meta: 'IT Services · Abu Dhabi', phone: '+971 2 555 0987', img: 'marco', initials: 'TS' },
    { name: 'Summit Interiors', meta: 'Interior Fit-out · Sharjah', phone: '+971 6 700 2233', img: 'lena', initials: 'SI' },
  ];
  return (
    <div className="w-full" style={{ backgroundColor: 'transparent' }}>
      {rows.map((r, i) => (
        <ImportRow key={r.name} mv={mv} i={i} {...r} />
      ))}
    </div>
  );
};

const ImportRow = ({ mv, i, name, meta, phone, img, initials }) => {
  const op = inRange(mv, 0.3 + i * 0.07, 0.4 + i * 0.07);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.3 + i * 0.07) / 0.1))) * 16);
  const isMerged = i === 0;
  const merged = inRange(mv, 0.6, 0.72);
  return (
    <motion.div
      style={{ opacity: op, y }}
      className="flex items-center gap-2.5 rounded-xl border px-3 py-2 mt-1.5 first:mt-0"
    >
      <Avatar img={img} initials={initials} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{name}</p>
        <p className="text-[9px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{meta}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[9.5px] font-semibold tabular-nums" style={{ color: 'var(--ma-list-title)' }}>
          {isMerged ? (
            <motion.span style={{ opacity: merged }}>
              <Check size={10} className="inline text-success mr-0.5" />2 merged
            </motion.span>
          ) : (
            phone
          )}
        </span>
        <StatusBadge tone={isMerged ? 'success' : 'muted'} className={isMerged ? '' : 'opacity-80'}>
          {isMerged ? (
            <motion.span style={{ opacity: merged }} className="inline-flex items-center gap-1">
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
  const pnlOp = inRange(mv, 0.12, 0.26);
  const pnlScale = useTransform(mv, (v) => 0.96 + 0.04 * easeOut(clamp01((v - 0.12) / 0.14)));
  const pnlY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.12) / 0.14))) * 22);
  const statusOp = inRange(mv, 0.75, 0.88);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* floating source chips — enter, drift toward center, fade out */}
      {FLOAT_CHIPS.map((c) => (
        <FloatChip key={c.label} mv={mv} {...c} />
      ))}

      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale, y: pnlY }}
        className="relative w-full max-w-md mx-auto"
      >
        <div
          className="rounded-3xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          {/* console header */}
          <div className="px-4 py-3 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <span className="w-8 h-8 rounded-full bg-primary/12 border border-primary/25 text-primary flex items-center justify-center shrink-0">
              <Inbox size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Business Discovery</p>
              <p className="text-[9.5px]" style={{ color: 'var(--ma-muted-text)' }}>Importing leads into the pipeline</p>
            </div>
            <StatusBadge><RefreshCw size={9} /> Syncing</StatusBadge>
          </div>

          {/* lead rows assembling */}
          <div className="px-3.5 py-3" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
            <ImportRows mv={mv} />
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

const FloatChip = ({ mv, icon: Icon, label, left, top, fx, fy }) => {
  const op = fade(mv, 0.02, 0.16, 0.55, 0.7);
  const x = useTransform(mv, (v) => {
    const t = easeOut(clamp01((v - 0.14) / 0.3));
    return fx * (1 - t);
  });
  const y = useTransform(mv, (v) => {
    const t = easeOut(clamp01((v - 0.14) / 0.3));
    return fy * (1 - t);
  });
  return (
    <motion.div
      style={{ opacity: op, x, y, left, top }}
      className="absolute z-10 flex items-center gap-1.5 rounded-full border bg-surface/90 backdrop-blur-md px-3 py-1.5 shadow-lg"
    >
      <span className="w-5 h-5 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
        <Icon size={11} />
      </span>
      <span className="text-[10px] font-bold text-text-primary whitespace-nowrap">{label}</span>
    </motion.div>
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
    <div className="w-full">
      <div className="flex items-stretch gap-0">
        {steps.map((s, i) => (
          <VerifyStep key={s.label} mv={mv} i={i} total={steps.length} icon={s.icon} label={s.label} />
        ))}
      </div>
    </div>
  );
};

const VerifyStep = ({ mv, i, total, icon: Icon, label }) => {
  const start = 0.08 + i * 0.16;
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
          className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0"
        >
          <Icon size={14} />
        </motion.div>
        <motion.div
          style={{ width: lineW }}
          className={cn('h-[2px] rounded-full origin-left bg-primary', i < total - 1 ? '' : 'opacity-0')}
        />
      </div>
      <motion.span style={{ opacity: done }} className="mt-1.5 text-[10px] font-bold">{label}</motion.span>
    </div>
  );
};

const VerificationScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.12, 0.26);
  const pnlScale = useTransform(mv, (v) => 0.96 + 0.04 * easeOut(clamp01((v - 0.12) / 0.14)));
  const scan = useTransform(mv, [0.3, 0.62], ['-20%', '120%']);
  const scanOp = fade(mv, 0.28, 0.34, 0.66, 0.74);
  const verifiedOp = inRange(mv, 0.74, 0.86);
  const verifiedScale = useTransform(mv, (v) => 0.92 + 0.08 * easeOut(clamp01((v - 0.74) / 0.12)));
  const numFormatted = inRange(mv, 0.45, 0.58);
  const statusCheck = inRange(mv, 0.55, 0.68);
  const profileOp = inRange(mv, 0.2, 0.34);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="w-full max-w-md mx-auto"
      >
        {/* process rail */}
        <div className="relative z-10 mb-3">
          <VerifySteps mv={mv} />
        </div>

        {/* verification console */}
        <div
          className="relative rounded-3xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <div className="px-4 py-3 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
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

          <div className="px-4 py-4" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
            {/* number card with scanning line */}
            <div
              className="relative rounded-2xl border px-4 py-3.5 overflow-hidden"
              style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Phone number</span>
                <motion.span style={{ opacity: statusCheck }} className="text-[10px] font-bold text-success">Checking…</motion.span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={15} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0" />
                <motion.span
                  style={{ color: 'var(--ma-list-title)' }}
                  className="text-[15px] font-bold tabular-nums tracking-tight"
                >
                  <motion.span style={{ opacity: numFormatted }}>+971 52 182 3400</motion.span>
                </motion.span>
                <motion.span style={{ opacity: verifiedOp, scale: verifiedScale }} className="ml-auto inline-flex items-center gap-1">
                  <Ticks level="read" />
                </motion.span>
              </div>
              {/* scanning line */}
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

            {/* lead profile */}
            <motion.div style={{ opacity: profileOp }} className="mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5">
              <Avatar img="omar" initials="AR" size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Ahmed Raza</p>
                <p className="text-[9px] truncate" style={{ color: 'var(--ma-muted-text)' }}>Real Estate · Dubai, UAE</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-success">
                <Wifi size={10} /> WhatsApp
              </span>
            </motion.div>

            {/* verified state */}
            <motion.div
              style={{ opacity: verifiedOp, scale: verifiedScale, backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
              className="mt-3 rounded-2xl border px-4 py-3 flex items-center gap-2.5"
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
   Scene 3 · Conversation — verified contact becomes a live,
   AI-assisted WhatsApp conversation.
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
        className={cn('relative max-w-[82%] rounded-xl rounded-2xl px-3 py-1.5 text-[11px] leading-snug', agent ? 'rounded-tr-sm' : 'rounded-tl-sm')}
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

const ConversationScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.14, 0.26);
  const pnlScale = useTransform(mv, (v) => 0.96 + 0.04 * easeOut(clamp01((v - 0.14) / 0.12)));
  const composerOp = inRange(mv, 0.5, 0.62);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="w-full max-w-md mx-auto"
      >
        <div
          className="rounded-3xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          {/* chat header — verified contact */}
          <div className="px-3.5 py-2.5 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <Avatar img="omar" initials="AR" online />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Ahmed Raza</p>
              <p className="text-[9.5px] flex items-center gap-1" style={{ color: 'var(--ma-accent)' }}>
                <BadgeCheck size={10} /> Verified WhatsApp
              </p>
            </div>
            <Video size={16} style={{ color: 'var(--ma-muted-text)' }} className="hidden sm:block" />
            <MoreVertical size={16} style={{ color: 'var(--ma-muted-text)' }} />
          </div>

          {/* messages */}
          <div className="px-3.5 py-3.5 flex flex-col gap-2 min-h-[240px] justify-end" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
            {CHAT_MSGS.map((m) => <ChatBubble key={m.text} mv={mv} msg={m} />)}
            <TypingRow mv={mv} at={0.26} out={0.36} />
          </div>

          {/* AI qualification chip */}
          <div className="px-3.5 py-2 border-t flex items-center justify-center gap-1.5" style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}>
            <motion.div
              style={{ opacity: inRange(mv, 0.5, 0.62) }}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 text-primary text-[9.5px] font-bold px-2.5 py-1"
            >
              <Sparkles size={10} /> AI Qualification running
            </motion.div>
          </div>

          {/* composer */}
          <motion.div
            style={{ opacity: composerOp }}
            className="px-3.5 py-2 flex items-center gap-2"
          >
            <div className="flex-1 rounded-full px-3 py-1.5 text-[10.5px]" style={{ backgroundColor: 'var(--ma-bg-elevated)', color: 'var(--ma-muted-text)' }}>
              Type a message
            </div>
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
              <Send size={12} className="text-white" />
            </span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   Scene 4 · CRM Pipeline — AI qualifies, then the lead moves
   through a CRM from New → Negotiation.
   ============================================================ */

const PIPE_STAGES = ['New', 'Contacted', 'Responded', 'Qualified', 'Negotiation'];

const PipelineStage = ({ mv, i, label }) => {
  const threshold = 0.14 + i * 0.16;
  const active = inRange(mv, threshold, threshold + 0.06);
  const borderColor = useTransform(active, [0, 1], ['var(--ma-line-slim)', 'var(--primary)']);
  const textColor = useTransform(active, [0, 1], ['var(--ma-muted-text)', 'var(--primary)']);
  const scale = useTransform(active, [0, 1], [1, 1.05]);
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <motion.div
        style={{
          borderColor,
          color: textColor,
          scale,
        }}
        className="w-full rounded-xl border px-2 py-2.5 text-center"
      >
        <p className="text-[10px] font-bold">{label}</p>
      </motion.div>
    </div>
  );
};

const LeadCard = ({ mv }) => {
  const x = useTransform(mv, (v) => {
    const t = clamp01(v);
    return `${t * 100}%`;
  });
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

const CRMScene = ({ mv }) => {
  const pnlOp = inRange(mv, 0.14, 0.26);
  const pnlScale = useTransform(mv, (v) => 0.96 + 0.04 * easeOut(clamp01((v - 0.14) / 0.12)));
  const totalOp = fade(mv, 0.4, 0.5, 0.94, 1);
  const doneOp = inRange(mv, 0.88, 0.97);
  const connectW = useTransform(mv, (v) => `${clamp01((v - 0.14) / 0.86) * 96}%`);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ opacity: pnlOp, scale: pnlScale }}
        className="w-full max-w-2xl mx-auto"
      >
        {/* AI qualification floating status */}
        <motion.div
          style={{ opacity: fade(mv, 0.02, 0.1, 0.9, 1) }}
          className="mb-4 flex justify-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-[10.5px] font-bold px-3 py-1.5 shadow-[0_0_22px_-6px_var(--primary-alpha)]">
            <Sparkles size={12} /> AI Qualification
          </span>
        </motion.div>

        <div
          className="rounded-3xl border overflow-hidden relative"
          style={{
            backgroundColor: 'var(--ma-bg-panel)',
            borderColor: 'var(--ma-line)',
            boxShadow: '0 30px 70px -24px rgba(0,0,0,0.45), var(--showcase-accent-soft-glow)',
          }}
        >
          <div className="px-4 py-3 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
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

          {/* pipeline track */}
          <div className="px-3.5 py-5" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
            <div className="relative px-8">
              {/* connector line */}
              <div className="absolute top-1/2 left-8 right-8 h-[2px] rounded-full -mt-[7px]" style={{ backgroundColor: 'var(--ma-line-slim)' }} />
              <motion.div
                style={{ width: connectW }}
                className="absolute top-1/2 left-8 h-[2px] rounded-full -mt-[7px] origin-left"
              />
              {/* stage slots */}
              <div className="flex items-start gap-2 relative z-10">
                {PIPE_STAGES.map((s, i) => <PipelineStage key={s} mv={mv} i={i} label={s} />)}
              </div>
              {/* lead card rides the track */}
              <LeadCard mv={mv} />
            </div>

            {/* outcome chips */}
            <motion.div style={{ opacity: totalOp }} className="mt-5 flex items-center justify-center gap-2.5">
              <StatusBadge tone="success"><Layers size={9} /> Stage updated</StatusBadge>
              <StatusBadge><TrendingUp size={9} /> CRM tracked</StatusBadge>
              <StatusBadge><Timer size={9} /> 3 min to qualify</StatusBadge>
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
   Main pinned section
   ============================================================ */

const Intro = ({ headOp }) => (
  <motion.header
    style={{ opacity: headOp }}
    className="absolute top-[4%] inset-x-0 z-30 text-center px-4 pointer-events-none"
  >
    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">Start With a Goal</p>
    <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">WhatsApp</Badge>
    <h2 className="text-xl sm:text-3xl lg:text-4xl font-display font-bold leading-tight text-text-primary">
      What Do You Want to Accomplish on WhatsApp?
    </h2>
    <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-xl mx-auto leading-relaxed">
      One connected journey takes a lead from discovery to a verified conversation and a CRM negotiation.
    </p>
  </motion.header>
);

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

  const headOp = fade(p, 0, 0.04, 0.22, 0.3);
  const hintOp = fade(p, 0.05, 0.12, 0.18, 0.24);
  const ctaOp = inRange(p, 0.9, 0.97);

  if (reduce) {
    return (
      <div className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8 bg-surface border-t border-border">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">Start With a Goal</p>
          <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">WhatsApp</Badge>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2">What Do You Want to Accomplish on WhatsApp?</h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed mb-8">
            Discover leads, verify them, chat on WhatsApp with AI help, and move every conversation into a CRM pipeline.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-left">
            {[
              { icon: Search, title: 'Find business leads', desc: 'Discover and import leads from the markets you choose.' },
              { icon: ShieldCheck, title: 'Verify leads', desc: 'Normalize numbers and confirm WhatsApp accounts.' },
              { icon: MessageCircle, title: 'Chat with AI', desc: 'Run real conversations with contact info, ticks and typing.' },
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
      <div className="sticky top-0 h-screen overflow-hidden">
        <WorkflowBackground p={p} />
        <Intro headOp={headOp} />

        {/* scene stage */}
        <div className="relative z-10 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="relative w-full max-w-6xl h-[58vh] min-h-[420px] max-h-[620px]">
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
        <div className="absolute bottom-5 inset-x-0 z-30 flex flex-col items-center gap-2.5">
          <motion.div style={{ opacity: hintOp }} className="flex flex-col items-center gap-1.5">
            <ProgressDots ops={[o1, o2, o3, o4]} />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Scroll to explore</span>
          </motion.div>
          <motion.div style={{ opacity: ctaOp, y: useTransform(p, [0.9, 1], [16, 0]) }}>
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