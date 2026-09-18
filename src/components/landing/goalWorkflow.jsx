import React, { useEffect, useRef, useState } from 'react';
import {
  motion, AnimatePresence, useReducedMotion, useScroll, useSpring, useTransform,
} from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search, BadgeCheck, ShieldCheck, Check, CheckCheck, Sparkles, Send,
  MapPin, Phone, Globe, Users, Tag, ArrowRight, CalendarClock, MessageCircle,
  Megaphone, Repeat, Inbox, ClipboardList, Wifi, Bot, FileText, Filter,
  Reply, Timer, UserCheck, Paperclip, Smile, Mic, Plus, CheckCircle2, Clock,
  Layers, TrendingUp, BellRing,
} from 'lucide-react';
import { cn } from '../ui/cn';
import { Button } from '../ui/Button';
import { SectionHeading } from './shared';
import { useDemoClock } from './demos';

/* ============================================================
   Motion / timing helpers (shared with the demo scenes)
   ============================================================ */

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
const phase = (t, a, b) => easeOut(clamp01((t - a) / (b - a)));

/* Steps a child in at `at`, holds it, then steps it out before the loop
   restarts so the sequence reads as a continuous, elegant product demo. */
const Reveal = ({ t, at, out = 0.94, dur = 0.16, y = 12, children, className }) => {
  const inP = clamp01(phase(t, at, at + dur));
  const outP = 1 - clamp01(phase(t, out, Math.min(1, out + 0.07)));
  const p = Math.min(inP, outP);
  return (
    <motion.div
      initial={false}
      style={{ opacity: p, y: p * y, filter: p === 1 ? 'none' : `blur(${(1 - p) * 1.5}px)` }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  );
};

/* ============================================================
   Shared mockup primitives (WhatsApp-inspired, theme-aware)
   ============================================================ */

const Avatar = ({ img, initials, size = 'md', online = false, className }) => {
  const [err, setErr] = useState(false);
  const sz = size === 'lg' ? 'w-10 h-10 text-sm' : size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-xs';
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

const ChatRow = ({ side, text, time, ticks, ai = false, typing = false }) => (
  <div className={cn('flex', side === 'mine' ? 'justify-end' : 'justify-start')}>
    <div
      className={cn(
        'relative max-w-[82%] rounded-xl px-3 py-1.5 text-xs leading-snug',
        side === 'mine' ? 'rounded-tr-sm' : 'rounded-tl-sm'
      )}
      style={{
        backgroundColor:
          ai ? 'var(--ma-bubble-ai)'
            : side === 'mine' ? 'var(--ma-bubble-sent)'
              : 'var(--ma-bubble-received)',
        color: 'var(--ma-message-text)',
        border: ai ? '1px solid var(--ma-bubble-ai-border)' : '1px solid var(--ma-line-slim)',
        boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
      }}
    >
      {ai && (
        <div className="flex items-center gap-1 mb-0.5">
          <Sparkles size={10} className="text-primary" />
          <span className="text-[8.5px] font-bold uppercase tracking-wider text-primary">AI Agent</span>
        </div>
      )}
      {typing ? (
        <span style={{ color: 'var(--ma-muted-text)' }}><TypingDots /></span>
      ) : (
        <p>{text}</p>
      )}
      {(time || ticks) && !typing && (
        <span className="flex items-center justify-end gap-1 translate-y-[2px] mt-0.5 shrink-0">
          {time && <span className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>{time}</span>}
          {ticks && <Ticks level={ticks} />}
        </span>
      )}
    </div>
  </div>
);

const SystemPill = ({ children }) => (
  <div className="flex justify-center py-0.5">
    <span
      className="rounded-full border px-2.5 py-1 text-[9px] font-semibold"
      style={{ backgroundColor: 'var(--ma-bg-panel)', color: 'var(--ma-muted-text)', borderColor: 'var(--ma-line-slim)' }}
    >
      {children}
    </span>
  </div>
);

const SceneHeader = ({ icon: Icon, title, sub, right }) => (
  <div
    className="flex items-center gap-2.5 px-3 sm:px-4 py-2.5 border-b shrink-0"
    style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
  >
    <span className="w-8 h-8 rounded-full bg-primary/12 border border-primary/25 text-primary flex items-center justify-center shrink-0">
      <Icon size={15} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[12.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{title}</p>
      <p className="text-[9.5px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{sub}</p>
    </div>
    {right}
  </div>
);

const StatusPill = ({ tone = 'primary', children, className }) => (
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

const MiniBar = ({ pct, className }) => (
  <div className={cn('h-1.5 w-full rounded-full bg-border/60 overflow-hidden', className)}>
    <div
      className="h-full rounded-full transition-[width] duration-150 ease-out"
      style={{ width: `${Math.round(clamp01(pct) * 100)}%`, background: 'var(--primary)' }}
    />
  </div>
);

const SceneBody = ({ children, className }) => (
  <div
    className={cn('flex-1 min-h-0 px-3 sm:px-4 py-3 flex flex-col gap-2 overflow-hidden', className)}
    style={{ backgroundColor: 'var(--ma-bg-root)' }}
  >
    {children}
  </div>
);

const Composer = ({ placeholder = 'Type a message' }) => (
  <div
    className="px-3 sm:px-4 py-2 flex items-center gap-1.5 border-t shrink-0"
    style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
  >
    <Plus size={14} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0 hidden sm:block" />
    <Paperclip size={14} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0" />
    <div
      className="flex-1 rounded-full px-3 py-1.5 text-[10.5px] truncate"
      style={{ backgroundColor: 'var(--ma-bg-elevated)', color: 'var(--ma-muted-text)' }}
    >
      {placeholder}
    </div>
    <Smile size={14} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0 hidden sm:block" />
    <Mic size={14} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0" />
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: 'var(--primary)' }}
    >
      <Send size={11} className="text-white" />
    </span>
  </div>
);

/* ============================================================
   Workflow data
   ============================================================ */

const GOALS = [
  {
    id: 'discover', icon: Search,
    label: 'Find business leads',
    desc: 'Find and organize potential businesses from the markets you choose — with contactable WhatsApp numbers attached.',
    steps: ['Discover', 'Lead found', 'Business info', 'Verify contact', 'Add to pipeline'],
    chips: [
      { icon: BadgeCheck, label: 'Lead Verified', edge: 'left', top: '8%' },
      { icon: MessageCircle, label: 'Contact ready', edge: 'right', top: '34%' },
      { icon: Inbox, label: 'In lead pipeline', edge: 'right', top: '62%' },
    ],
    scene: 'discovery',
  },
  {
    id: 'verify', icon: BadgeCheck,
    label: 'Verify my leads',
    desc: 'Import lists, normalize the numbers, then check every contact for a WhatsApp account — before any message goes out.',
    steps: ['Import', 'Normalize', 'Validate', 'Verify', 'Ready'],
    chips: [
      { icon: ShieldCheck, label: 'Checked before messaging', edge: 'left', top: '16%' },
      { icon: Check, label: '960 ready for outreach', edge: 'right', top: '46%' },
    ],
    scene: 'verify',
  },
  {
    id: 'pipeline', icon: ClipboardList,
    label: 'Manage WhatsApp leads',
    desc: 'Every lead moves through a clear pipeline as it progresses from first contact to negotiation.',
    steps: ['New', 'Contacted', 'Responded', 'Qualified', 'Negotiation'],
    chips: [
      { icon: UserCheck, label: 'Stage updated', edge: 'left', top: '20%' },
      { icon: Layers, label: 'CRM tracked', edge: 'right', top: '55%' },
    ],
    scene: 'pipeline',
  },
  {
    id: 'followup', icon: CalendarClock,
    label: 'Follow up with prospects',
    desc: 'Never let a good lead go quiet — schedule reminders and send timely follow-ups automatically.',
    steps: ['First message', 'No reply', 'Reminder set', 'Follow-up', 'Replied'],
    chips: [
      { icon: CalendarClock, label: 'Follow-up scheduled', edge: 'left', top: '18%' },
      { icon: MessageCircle, label: 'Customer replied', edge: 'right', top: '48%' },
    ],
    scene: 'followup',
  },
  {
    id: 'ai', icon: WandSparkles,
    label: 'Qualify leads with AI',
    desc: 'Let AI read replies, surface intent, and flag the leads that are most worth your time.',
    steps: ['Inbound', 'AI reads', 'Intent scored', 'Qualify', 'Passed to sales'],
    chips: [
      { icon: Sparkles, label: 'AI Qualification', edge: 'left', top: '12%' },
      { icon: TrendingUp, label: 'High intent', edge: 'right', top: '58%' },
    ],
    scene: 'ai',
  },
  {
    id: 'inbox', icon: MessageCircle,
    label: 'Manage customer conversations',
    desc: 'Keep every conversation organized in one inbox — answer, act, and follow up from a single place.',
    steps: ['Inbox', 'Pick chat', 'Conversation', 'Quick action', 'Handled'],
    chips: [
      { icon: Inbox, label: 'Multi-chat inbox', edge: 'left', top: '14%' },
      { icon: Timer, label: 'Replied in 3 min', edge: 'right', top: '46%' },
    ],
    scene: 'inbox',
  },
  {
    id: 'campaign', icon: Megaphone,
    label: 'Promote my services',
    desc: 'Reach only verified, relevant audiences with approved templates — and watch responses come back.',
    steps: ['Service', 'Template', 'Verified leads', 'Send', 'Responses'],
    chips: [
      { icon: Megaphone, label: 'Campaign active', edge: 'left', top: '10%' },
      { icon: Reply, label: '38 replies', edge: 'right', top: '52%' },
    ],
    scene: 'campaign',
  },
  {
    id: 'automation', icon: Repeat,
    label: 'Automate follow-ups',
    desc: 'Build repeatable flows that message, wait, follow up, and alert you the moment a lead replies.',
    steps: ['Lead in', 'Message', 'Wait', 'Follow-up', 'Reply', 'Agent alerted'],
    chips: [
      { icon: Repeat, label: 'Automation running', edge: 'left', top: '16%' },
      { icon: BellRing, label: 'Agent notified', edge: 'right', top: '56%' },
    ],
    scene: 'automation',
  },
];

/* Order of scene rendering mirrors GOALS array. */

/* ============================================================
   1 · Find business leads — lead discovery card + pipeline add
   ============================================================ */
const DiscoveryScene = ({ t }) => {
  const added = t > 0.5;
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
      <SceneHeader
        icon={Search}
        title="Business Discovery"
        sub="Furniture wholesale · Dubai, UAE"
        right={<StatusPill tone="success"><Check size={9} /> Contact available</StatusPill>}
      />
      <SceneBody>
        <Reveal t={t} at={0.02}>
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
          >
            <Search size={13} style={{ color: 'var(--ma-muted-text)' }} />
            <span className="text-[10.5px]" style={{ color: 'var(--ma-muted-text)' }}>furniture wholesalers · UAE</span>
          </div>
        </Reveal>

        <Reveal t={t} at={0.1} y={16}>
          <div
            className="rounded-2xl border p-3"
            style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
          >
            <div className="flex items-center gap-2.5">
              <Avatar img="omar" initials="AN" size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Al Noor Furnishings</p>
                <p className="text-[9.5px]" style={{ color: 'var(--ma-muted-text)' }}>Furniture &amp; Decor</p>
              </div>
              <StatusPill tone="success"><ShieldCheck size={9} /> Verified</StatusPill>
            </div>
            <div className="mt-2.5 pt-2.5 border-t space-y-1.5" style={{ borderColor: 'var(--ma-line-slim)' }}>
              <Reveal t={t} at={0.16} y={6}>
                <div className="flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--ma-text-secondary)' }}>
                  <MapPin size={11} className="shrink-0" style={{ color: 'var(--ma-muted-text)' }} /> Dubai · UAE
                  <span className="ml-auto inline-flex items-center gap-1 text-success"><Check size={10} /> Reachable</span>
                </div>
              </Reveal>
              <Reveal t={t} at={0.22} y={6}>
                <div className="flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--ma-text-secondary)' }}>
                  <Globe size={11} className="shrink-0" style={{ color: 'var(--ma-muted-text)' }} /> Lead source · Directory
                </div>
              </Reveal>
              <Reveal t={t} at={0.28} y={6}>
                <div className="flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--ma-text-secondary)' }}>
                  <Phone size={11} className="shrink-0" style={{ color: 'var(--ma-muted-text)' }} />
                  <span className="font-semibold" style={{ color: 'var(--ma-list-title)' }}>+971 52 000 1122</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-success"><Check size={10} /> Checked</span>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>

        <Reveal t={t} at={0.4} y={16}>
          <div
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl w-full py-2.5 text-[11px] font-bold transition-colors duration-300',
              added ? 'text-success' : 'text-white'
            )}
            style={{
              backgroundColor: added ? 'rgba(16,185,129,0.12)' : 'var(--primary)',
              border: added ? '1px solid rgba(16,185,129,0.35)' : 'none',
              boxShadow: added ? 'none' : '0 6px 16px -6px var(--primary-alpha)',
            }}
          >
            <CheckCircle2 size={13} /> {added ? 'Added to lead pipeline' : 'Add to lead pipeline'}
          </div>
        </Reveal>

        <Reveal t={t} at={0.52} y={12}>
          <div
            className="rounded-xl border px-3 py-2 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }}
          >
            <CheckCircle2 size={13} className="text-success shrink-0" />
            <span className="text-[10px] font-semibold text-success">Saved · ready for outreach on WhatsApp</span>
            <span className="ml-auto text-[9px] text-success/70 font-bold">1 / 1</span>
          </div>
        </Reveal>
      </SceneBody>
    </div>
  );
};

/* ============================================================
   2 · Verify my leads — import → normalize → validate → verify
   ============================================================ */
const VerifyScene = ({ t }) => {
  const scanning = clamp01(phase(t, 0.2, 0.34));
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
      <SceneHeader
        icon={ShieldCheck}
        title="Lead Verification"
        sub="Checked before any message is sent"
        right={<StatusPill><Wifi size={9} /> Live check</StatusPill>}
      />
      <SceneBody>
        {[
          { at: 0.03, label: 'Imported', meta: '1,460 contacts' },
          { at: 0.1, label: 'Normalized', meta: '+971 international format' },
          { at: 0.16, label: 'Validated', meta: 'Number structure OK' },
        ].map((s) => (
          <Reveal key={s.label} t={t} at={s.at} y={8}>
            <div
              className="flex items-center gap-2.5 rounded-xl border px-3 py-2"
              style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
            >
              <span className="w-6 h-6 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                <Check size={12} />
              </span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--ma-list-title)' }}>{s.label}</span>
              <span className="ml-auto text-[9.5px]" style={{ color: 'var(--ma-muted-text)' }}>
                {s.meta}
              </span>
            </div>
          </Reveal>
        ))}

        <Reveal t={t} at={0.2} y={8}>
          <div
            className="rounded-xl border px-3 py-2.5"
            style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Wifi size={12} />
              </span>
              <span className="text-[11px] font-semibold flex-1" style={{ color: 'var(--ma-list-title)' }}>
                Verifying WhatsApp presence
              </span>
              <span className="text-[9.5px] font-bold text-primary tabular-nums">{Math.round(scanning * 100)}%</span>
            </div>
            <MiniBar pct={scanning} className="mt-2" />
          </div>
        </Reveal>

        <Reveal t={t} at={0.38} y={16}>
          <div
            className="rounded-xl border px-3 py-3 flex items-center gap-3"
            style={{ backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.3)', boxShadow: '0 8px 24px -14px rgba(16,185,129,0.5)' }}
          >
            <span className="w-9 h-9 rounded-full bg-success text-white flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(16,185,129,0.5)]">
              <CheckCircle2 size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-success">Verified WhatsApp number</p>
              <p className="text-[9.5px] truncate" style={{ color: 'var(--ma-muted-text)' }}>+971 55 111 2345 · Sara Ali</p>
            </div>
            <span className="ml-auto text-[9px] font-bold text-success/80">✓</span>
          </div>
        </Reveal>

        <Reveal t={t} at={0.5} y={10}>
          <div className="flex items-center justify-between px-1">
            <span className="text-[9.5px] font-semibold" style={{ color: 'var(--ma-muted-text)' }}>Ready for outreach</span>
            <StatusPill tone="success">960 validated leads</StatusPill>
          </div>
        </Reveal>
      </SceneBody>
    </div>
  );
};

/* ============================================================
   3 · Manage WhatsApp leads — CRM pipeline progression
   ============================================================ */
const PIPELINE_STAGES = ['New', 'Contacted', 'Responded', 'Qualified', 'Negotiation'];

const PipelineScene = ({ t }) => {
  const reduce = useReducedMotion();
  const stage = reduce ? 4 : Math.min(4, Math.floor((t % 1) / 0.1));
  const stagePct = stage * 20;
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
      <SceneHeader
        icon={ClipboardList}
        title="Lead Pipeline"
        sub="Shield discovery → Message Agent → CRM"
        right={<StatusPill tone="success"><UserCheck size={9} /> {PIPELINE_STAGES[stage]}</StatusPill>}
      />
      <SceneBody>
        <Reveal t={t} at={0.02}>
          <div className="grid grid-cols-5 gap-1">
            {PIPELINE_STAGES.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'rounded-lg border text-center py-1 text-[8.5px] font-bold truncate transition-colors duration-300',
                  i === stage ? 'border-primary/40 text-primary bg-primary/10' : 'border-border/50 text-text-muted bg-surface/40'
                )}
              >
                {s}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal t={t} at={0.08} y={8}>
          <div className="relative h-[70px] rounded-xl border bg-surface/50" style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'var(--ma-bg-panel)' }}>
            <motion.div
              initial={false}
              animate={{ left: `${stagePct}%` }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="absolute top-2 bottom-2 w-[20%] px-0.5"
            >
              <div
                className="h-full rounded-lg border flex flex-col items-center justify-center gap-0.5 px-0.5"
                style={{ backgroundColor: 'var(--ma-bubble-ai)', borderColor: 'var(--ma-bubble-ai-border)', boxShadow: '0 6px 18px -8px var(--primary-alpha)' }}
              >
                <Avatar img="omar" initials="AR" size="sm" />
                <p className="text-[8.5px] font-bold truncate w-full text-center" style={{ color: 'var(--ma-list-title)' }}>Ahmed Raza</p>
              </div>
            </motion.div>
          </div>
        </Reveal>

        {PIPELINE_STAGES.map((s, i) => (
          <Reveal key={`log-${s}`} t={t} at={0.16 + i * 0.09} y={6}>
            <div
              className={cn(
                'flex items-center gap-2 text-[10px] rounded-lg px-2.5 py-1.5 border',
                i === stage ? 'border-primary/30 text-primary' : 'border-transparent'
              )}
              style={i === stage ? { backgroundColor: 'var(--ma-bubble-ai)' } : { color: 'var(--ma-muted-text)' }}
            >
              <span className={cn('w-4 h-4 rounded-full flex items-center justify-center shrink-0', i <= stage ? 'bg-success/15 text-success' : 'bg-border/60 text-text-muted')}>
                <Check size={9} />
              </span>
              Moved to <span className="font-bold">{s}</span>
              {i === stage && <span className="ml-auto inline-flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-success animate-pulse" /> live</span>}
            </div>
          </Reveal>
        ))}
      </SceneBody>
    </div>
  );
};

/* ============================================================
   4 · Follow up — conversation with reminder → follow-up → reply
   ============================================================ */
const FollowupScene = ({ t }) => (
  <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
    <SceneHeader
      icon={Clock}
      title="Omar Bakir"
      sub="Sourcing · catalog follow-up"
      right={<span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" /><StatusPill>Follow-up</StatusPill></span>}
    />
    <SceneBody>
      <Reveal t={t} at={0.02}>
        <ChatRow side="mine" text="Hi Omar — sending the glassware catalog now." time="11:02" ticks="read" />
      </Reveal>
      <Reveal t={t} at={0.12}>
        <SystemPill>No reply yet · 2 days</SystemPill>
      </Reveal>
      <Reveal t={t} at={0.2}>
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
        >
          <span className="w-6 h-6 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <CalendarClock size={12} />
          </span>
          <span className="text-[10px] font-semibold flex-1" style={{ color: 'var(--ma-list-title)' }}>
            Follow-up scheduled · today 11:30
          </span>
          <StatusPill>Auto</StatusPill>
        </div>
      </Reveal>
      <Reveal t={t} at={0.3} y={6}>
        <ChatRow side="mine" text="Omar, are you still interested in the December collection?" time="11:31" ticks="read" />
      </Reveal>
      <Reveal t={t} at={0.36}>
        <ChatRow side="ai" typing />
      </Reveal>
      <Reveal t={t} at={0.42}>
        <ChatRow side="mine" text="No rush — happy to hold the price until Friday." time="11:31" ticks="read" />
      </Reveal>
      <Reveal t={t} at={0.54} y={8}>
        <ChatRow side="them" text="Yes — let's talk Thursday morning." time="11:36" />
      </Reveal>
      <Reveal t={t} at={0.66} y={10}>
        <div
          className="rounded-xl border px-3 py-2 flex items-center gap-2"
          style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }}
        >
          <CheckCircle2 size={13} className="text-success shrink-0" />
          <span className="text-[10px] font-semibold text-success">Replied · follow-up complete</span>
          <span className="ml-auto text-[9px] text-success/70 font-bold">4 min</span>
        </div>
      </Reveal>
    </SceneBody>
    <Composer />
  </div>
);

/* ============================================================
   5 · Qualify with AI — inbound → analysis → score → qualified
   ============================================================ */
const AIScene = ({ t }) => {
  const score = clamp01(phase(t, 0.26, 0.4));
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
      <SceneHeader
        icon={Bot}
        title="AI Qualification"
        sub="Message Agent · assist on"
        right={<StatusPill tone="success"><Sparkles size={9} /> AI active</StatusPill>}
      />
      <SceneBody>
        <Reveal t={t} at={0.02}>
          <ChatRow side="them" text="Can you handle 200 units per month for us?" time="14:02" />
        </Reveal>
        <Reveal t={t} at={0.1}>
          <ChatRow side="ai" typing />
        </Reveal>
        <Reveal t={t} at={0.18}>
          <ChatRow side="ai" text="Intent high · budget confirmed · volume 200/mo. Suggests a pricing call." time="14:02" />
        </Reveal>
        <Reveal t={t} at={0.26} y={10}>
          <div
            className="rounded-2xl border p-3"
            style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Lead score</span>
              <span className="text-[13px] font-bold text-primary tabular-nums">{Math.round(score * 92)}</span>
            </div>
            {[
              { label: 'Engagement', val: clamp01(score) },
              { label: 'Budget', val: clamp01(score * 1.05) },
              { label: 'Timeline', val: clamp01(score * 0.92) },
            ].map((b) => (
              <div key={b.label} className="mb-1.5 last:mb-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>{b.label}</span>
                  <span className="text-[8.5px] font-bold text-success">{Math.round(b.val * 100)}%</span>
                </div>
                <MiniBar pct={b.val} />
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal t={t} at={0.44} y={10}>
          <div
            className="rounded-xl border px-3 py-2 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }}
          >
            <CheckCircle2 size={13} className="text-success shrink-0" />
            <span className="text-[10px] font-semibold text-success">Qualified · passed to sales</span>
          </div>
        </Reveal>
      </SceneBody>
      <Composer />
    </div>
  );
};

/* ============================================================
   6 · Manage conversations — inbox list + active chat + actions
   ============================================================ */
const INBOX_CHATS = [
  { img: 'lena', initials: 'LV', name: 'Lena Vogel', meta: 'Design review', time: '10:24', unread: 1 },
  { img: 'marco', initials: 'MR', name: 'Marco Ruiz', meta: 'Order #2204', time: '09:47', unread: 0 },
  { img: 'aisha', initials: 'AK', name: 'Aisha Khan', meta: 'Support · billing', time: '08:12', unread: 0 },
];

const InboxScene = ({ t }) => (
  <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
      <SceneHeader
        icon={MessageCircle}
        title="Inbox"
        sub="3 conversations · all in one place"
        right={<StatusPill tone="success"><Users size={9} /> 1 new</StatusPill>}
      />
      <SceneBody>
        <div className="space-y-1.5">
          {INBOX_CHATS.map((c, i) => {
            const isActive = i === 0;
            return (
              <Reveal key={c.name} t={t} at={0.02 + i * 0.05} y={8}>
                <div
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-all duration-300',
                    isActive && phase(t, 0.16, 0.3) > 0.5 ? 'border-primary/35' : 'border-border/60'
                  )}
                  style={{
                    backgroundColor: isActive && phase(t, 0.16, 0.3) > 0.5 ? 'var(--ma-bubble-ai)' : 'var(--ma-bg-panel)',
                  }}
                >
                  <Avatar img={c.img} initials={c.initials} online={isActive} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{c.name}</p>
                    <p className="text-[9px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{c.meta}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>{c.time}</span>
                    {c.unread > 0 && (
                      <span className="w-3.5 h-3.5 rounded-full bg-primary text-white text-[7.5px] font-bold flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal t={t} at={0.18} y={14} className="flex-1 min-h-0">
          <div
            className="flex flex-col gap-2 rounded-2xl border p-3 h-full min-h-[150px]"
            style={{ backgroundColor: 'var(--ma-bg-root)', borderColor: 'var(--ma-line)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-success">Lena Vogel · active</span>
              <span className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>today</span>
            </div>
            <Reveal t={t} at={0.24} y={6}>
              <ChatRow side="them" text="Can you share the updated proposal?" />
            </Reveal>
            <Reveal t={t} at={0.32} y={6}>
              <ChatRow side="mine" text="Sending it now — one sec." time="10:25" ticks="read" />
            </Reveal>
            <Reveal t={t} at={0.42} y={10}>
              <div className="flex items-center gap-1.5 mt-auto pt-1">
                <button type="button" className="rounded-full border border-primary/35 bg-primary/10 text-primary text-[9px] font-bold px-2.5 py-1">
                  Send quote
                </button>
                <button type="button" className="rounded-full border border-success/35 bg-success/10 text-success text-[9px] font-bold px-2.5 py-1">
                  Mark done
                </button>
              </div>
            </Reveal>
          </div>
        </Reveal>

<Reveal t={t} at={0.56} y={8}>
          <div className="flex items-center justify-between px-1">
            <span className="text-[9.5px] font-semibold" style={{ color: 'var(--ma-muted-text)' }}>Conversation handled</span>
            <StatusPill tone="success">Replied in 3 min</StatusPill>
          </div>
        </Reveal>
      </SceneBody>
    </div>
  );

/* ============================================================
   7 · Promote services — approved template campaign
   ============================================================ */
const CampaignScene = ({ t }) => {
  const progress = clamp01(phase(t, 0.42, 0.56));
  const sending = phase(t, 0.42, 0.56) < 1;
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
      <SceneHeader
        icon={Megaphone}
        title="Campaigns"
        sub="Broadcast · approved template"
        right={<StatusPill tone="success"><Check size={9} /> Template approved</StatusPill>}
      />
      <SceneBody>
        <Reveal t={t} at={0.02} y={8}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Service</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1">
              <Globe size={11} /> Website Development
            </span>
          </div>
        </Reveal>

        <Reveal t={t} at={0.08} y={10}>
          <div
            className="rounded-2xl border p-3"
            style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--ma-muted-text)' }}>Message template</span>
              <StatusPill tone="success"><FileText size={9} /> GDLC-02</StatusPill>
            </div>
            <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--ma-list-title)' }}>
              Hi {`{{first_name}}`}, we build fast, conversion-ready websites for growing businesses — want a free audit?
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Google Ads', 'Facebook Marketing', 'AI Automation'].slice(0, 2).map((f) => (
                <span key={f} className="rounded-md border border-border/60 bg-surface/60 px-1.5 py-0.5 text-[8.5px] font-semibold" style={{ color: 'var(--ma-muted-text)' }}>
                  + {f}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal t={t} at={0.2} y={10}>
          <div
            className="rounded-xl border px-3 py-2 flex items-center gap-2.5"
            style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
          >
            <span className="w-6 h-6 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
              <Users size={12} />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>1,240 verified recipients</p>
              <p className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>Region · UAE, KSA · B2B filters applied</p>
            </div>
            <Filter size={12} style={{ color: 'var(--ma-muted-text)' }} className="shrink-0 ml-auto" />
          </div>
        </Reveal>

        <Reveal t={t} at={0.32} y={10}>
          {sending ? (
            <div
              className="rounded-xl border px-3 py-2.5"
              style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Sending campaign…</span>
                <span className="text-[9.5px] font-bold text-primary tabular-nums">{Math.round(progress * 100)}%</span>
              </div>
              <MiniBar pct={progress} />
            </div>
          ) : (
            <div
              className="rounded-xl border px-3 py-2.5 flex items-center gap-2.5"
              style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }}
            >
              <CheckCircle2 size={14} className="text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold text-success">Delivered to 1,240</p>
                <p className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>Delivered now · no spam-like volume</p>
              </div>
            </div>
          )}
        </Reveal>

        <Reveal t={t} at={0.6} y={10}>
          <div
            className="rounded-xl border px-3 py-2 flex items-center gap-2.5"
            style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
          >
            <span className="w-6 h-6 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
              <Reply size={12} />
            </span>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--ma-list-title)' }}>Responses</span>
            <span className="ml-auto inline-flex items-center gap-1">
              <TrendingUp size={11} className="text-success" />
              <span className="text-[11px] font-bold text-success tabular-nums">+38</span>
              <span className="text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>in 24h</span>
            </span>
          </div>
        </Reveal>
      </SceneBody>
    </div>
  );
};

/* ============================================================
   8 · Automate follow-ups — node flow with lifecycle pulse
   ============================================================ */
const AUTOMATION_NODES = ['Lead in', 'Message', 'Wait 2d', 'Follow-up', 'Reply', 'Alert agent'];

const AutomationScene = ({ t }) => {
  const reduce = useReducedMotion();
  const activeIdx = reduce ? 4 : Math.min(AUTOMATION_NODES.length - 1, Math.floor((t % 1) / 0.06));
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
      <SceneHeader
        icon={Repeat}
        title="Automations"
        sub="Follow-up flow · runs in background"
        right={<StatusPill tone="success"><span className="w-1 h-1 rounded-full bg-success animate-pulse" /> Running</StatusPill>}
      />
      <SceneBody>
        <Reveal t={t} at={0.02} y={6}>
          <div className="flex flex-wrap items-center gap-1">
            {AUTOMATION_NODES.map((n, i) => (
              <div key={n} className="flex items-center gap-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[8.5px] font-bold transition-colors duration-300',
                    i === activeIdx ? 'border-primary/45 text-primary bg-primary/10 shadow-sm' : 'border-border/50 text-text-muted bg-surface/40'
                  )}
                  style={i === activeIdx ? { boxShadow: '0 0 0 3px var(--primary-alpha)' } : {}}
                >
                  {i === activeIdx && <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />}
                  {n}
                </span>
                {i < AUTOMATION_NODES.length - 1 && <ArrowRight size={9} className="text-text-muted shrink-0" />}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal t={t} at={0.32} y={12}>
          <div
            className="rounded-2xl border p-3"
            style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Avatar img="aisha" initials="SA" size="sm" />
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>Sara Ali · quote follow-up</p>
                <p className="text-[8.5px] text-success">+971 55 111 2345</p>
              </div>
              <span className="ml-auto text-[8.5px]" style={{ color: 'var(--ma-muted-text)' }}>day 3 of flow</span>
            </div>
            <Reveal t={t} at={0.38} y={6}>
              <ChatRow side="mine" text="Sara? Just checking in on the website quote — still a fit?" time="09:00" />
            </Reveal>
            <Reveal t={t} at={0.46}>
              <ChatRow side="ai" text="Drafting a gentle nudge…" typing={phase(t, 0.46, 0.52) < 1} />
            </Reveal>
            <Reveal t={t} at={0.52}>
              <ChatRow side="them" text="Thanks! Sending approval today." time="09:14" />
            </Reveal>
          </div>
        </Reveal>

        <Reveal t={t} at={0.64} y={10}>
          <div
            className="rounded-xl border px-3 py-2 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }}
          >
            <BellRing size={13} className="text-success shrink-0" />
            <span className="text-[10px] font-semibold text-success">Agent alerted · task created</span>
            <span className="ml-auto text-[9px] text-success/70 font-bold">flow done</span>
          </div>
        </Reveal>
      </SceneBody>
    </div>
  );
};

/* ============================================================
   Scene switch + phone frame
   ============================================================ */
const SCENES = {
  discovery: DiscoveryScene,
  verify: VerifyScene,
  pipeline: PipelineScene,
  followup: FollowupScene,
  ai: AIScene,
  inbox: InboxScene,
  campaign: CampaignScene,
  automation: AutomationScene,
};

const PhoneMockup = ({ goal }) => {
  const Scene = SCENES[goal.scene];
  const t = useDemoClock(12000, 0.66);
  return (
    <div className="relative w-full max-w-[360px] sm:max-w-[400px] lg:max-w-[440px] mx-auto">
      {/* ambient under-glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-[2.2rem] blur-2xl opacity-70"
        style={{ background: 'radial-gradient(60% 60% at 50% 40%, var(--showcase-accent-glow) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      {/* glow ring */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[2.2rem] opacity-70"
        style={{ background: 'linear-gradient(180deg, var(--showcase-accent-line) 0%, transparent 45%)' }}
        aria-hidden="true"
      />
      <div
        className="relative rounded-[2rem] border overflow-hidden"
        style={{
          backgroundColor: 'var(--ma-bg-root)',
          borderColor: 'var(--ma-line)',
          boxShadow: '0 30px 70px -24px rgba(0,0,0,0.4), var(--showcase-accent-soft-glow)',
        }}
      >
        <div className="h-[460px] sm:h-[500px] lg:h-[520px]">
          <Scene t={t} />
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Objective selector — wrap on desktop, swipe on mobile
   ============================================================ */
const GoalPills = ({ active, onChange }) => (
  <div className="relative mt-8 sm:mt-10">
    <div
      className="flex gap-2 sm:gap-2.5 overflow-x-auto lg:flex-wrap lg:justify-center lg:overflow-visible pb-2 lg:pb-0 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Choose a WhatsApp workflow goal"
    >
      {GOALS.map((g, i) => {
        const Icon = g.icon;
        const act = active === i;
        return (
          <motion.button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={act}
            onClick={() => onChange(i)}
            whileTap={{ scale: 0.96 }}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-full border px-3 py-2 whitespace-nowrap text-[11px] sm:text-xs font-semibold transition-all duration-300 shrink-0',
              act
                ? 'bg-primary/10 border-primary/45 text-primary shadow-[0_4px_14px_-6px_var(--primary-alpha)]'
                : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary'
            )}
          >
            <Icon size={13} />
            {g.label}
            {act && (
              <motion.span layoutId="goal-pill-dot" className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
          </motion.button>
        );
      })}
    </div>
  </div>
);

/* ============================================================
   Step rail under the mockup — mirrors the active scene
   ============================================================ */
const StepRail = ({ goal }) => {
  const t = useDemoClock(12000, 0.66);
  const activeStep = Math.min(goal.steps.length - 1, Math.floor(clamp01(t) * goal.steps.length));
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-2xl mx-auto">
      {goal.steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5 sm:gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all duration-300',
              i === activeStep ? 'border-primary/45 bg-primary/10' : i < activeStep ? 'border-border/70 bg-surface/70' : 'border-border/60 bg-surface/40'
            )}
          >
            <span
              className={cn(
                'w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 transition-colors duration-300',
                i <= activeStep ? 'bg-primary/15 text-primary' : 'bg-border/60 text-text-muted'
              )}
            >
              {i < activeStep ? <Check size={10} /> : i + 1}
            </span>
            <span className={cn('text-[10.5px] sm:text-[11px] font-semibold whitespace-nowrap', i <= activeStep ? 'text-text-primary' : 'text-text-muted')}>
              {s}
            </span>
          </div>
          {i < goal.steps.length - 1 && (
            <ArrowRight size={11} className="text-text-muted hidden sm:block" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
};

/* ============================================================
   Floating status chips around the mockup (xl+)
   ============================================================ */
const FloatChips = ({ goal }) => {
  const reduce = useReducedMotion();
  return (
    <div className="hidden xl:block pointer-events-none" aria-hidden="true">
      {goal.chips.map((chip, i) => {
        const Icon = chip.icon;
        return (
          <motion.div
            key={chip.label}
            className="absolute z-20"
            style={{ [chip.edge]: '-72px', top: chip.top }}
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.08 }}
          >
            <motion.div
              animate={reduce ? undefined : { y: [0, -5, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
              className="flex items-center gap-1.5 rounded-full border bg-surface/90 backdrop-blur-md px-3 py-1.5 shadow-lg"
              style={{ borderColor: 'var(--border)', boxShadow: '0 10px 26px -12px rgba(0,0,0,0.25)' }}
            >
              <span className="w-5 h-5 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
                <Icon size={11} />
              </span>
              <span className="text-[10px] font-bold text-text-primary whitespace-nowrap">{chip.label}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};

/* ============================================================
   Main section
   ============================================================ */
export const GoalWorkflowSection = () => {
  const reduce = useReducedMotion();
  const secRef = useRef(null);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);

  const { scrollYProgress } = useScroll({ target: secRef, offset: ['start end', 'end start'] });
  const scaleP = useTransform(scrollYProgress, [0, 0.5, 1], [0.94, 1, 0.94]);
  const parallax = useSpring(scaleP, { stiffness: 90, damping: 24 });

  useEffect(() => {
    if (reduce || hovered) return undefined;
    const id = setInterval(() => setActive((a) => (a + 1) % GOALS.length), 9000);
    return () => clearInterval(id);
  }, [reduce, hovered]);

  const goal = GOALS[active];

  return (
    <div ref={secRef}>
      <SectionHeading
        eyebrow="Start With a Goal"
        badge="WhatsApp"
        title="What Do You Want to Accomplish on WhatsApp?"
        subtitle="Pick an objective to see the relevant product workflow."
      />

      <GoalPills active={active} onChange={setActive} />

      <div
        className="relative mt-6 sm:mt-8"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* section ambient background */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[520px] lg:w-[620px] aspect-square rounded-full"
          style={{ background: 'radial-gradient(circle, var(--showcase-accent-glow) 0%, transparent 62%)' }}
          aria-hidden="true"
        />

        <FloatChips goal={goal} />

        <motion.div style={reduce ? undefined : { scale: parallax }} className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.985 }}
              transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
            >
              <PhoneMockup goal={goal} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="mt-7 sm:mt-8">
        <div className="mb-6 sm:mb-7">
          <StepRail goal={goal} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <p className="text-xs sm:text-sm text-text-secondary max-w-xl text-center sm:text-left leading-relaxed">
              {goal.desc}
            </p>
            <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
              <Link to="/message-agent">
                Open the live workspace
                <ArrowRight size={13} />
              </Link>
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};