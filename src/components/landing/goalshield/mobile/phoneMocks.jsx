import React from 'react';
import { motion } from 'framer-motion';
import {
  Search, Check, Home, Users, LayoutGrid, MoreHorizontal, ShieldCheck,
  ArrowLeft, Loader2, CalendarClock, Sparkles, Bell, Send, MessageSquare, Building2,
} from 'lucide-react';
import { cn } from '../../../ui/cn';
import { Avatar } from '../shared';
import { useCountUp, useSequence } from './motionHooks';

export function PhoneFrame({ children, className }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[212px] rounded-[1.75rem] border border-white/[0.12] bg-[#0a0f14] p-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.55)] md:max-w-[178px]', className)}>
      <div className="absolute left-1/2 top-2 z-20 h-1 w-9 -translate-x-1/2 rounded-full bg-white/15" />
      <div className="relative overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-[#0d1418]">
        <div className="flex items-center justify-between px-3 pb-1 pt-2.5 text-[6.5px] font-semibold text-white/55">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-2 rounded-[1px] bg-white/45" />
            <span className="inline-block h-1.5 w-2 rounded-[1px] bg-white/25" />
            <span className="inline-block h-2 w-3 rounded-[2px] border border-white/40" />
          </span>
        </div>
        <div className="px-2.5 pb-3">{children}</div>
      </div>
    </div>
  );
}

const riseIn = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut', delay },
});

/* ------------------------------- 1 · LEADS ------------------------------- */

const LEADS = [
  { initials: 'NS', tint: 158, name: 'Nadia El-Sayed', role: 'Solar & Renewables', city: 'Dubai' },
  { initials: 'OR', tint: 202, name: 'Omar Reza', role: 'Fitness Studio', city: 'Riyadh' },
  { initials: 'SL', tint: 268, name: 'Sofia Lindqvist', role: 'Cloud Consulting', city: 'Doha' },
];

export function PhoneMock1({ inView, reduce }) {
  const found = useCountUp(1460, { start: inView, duration: 1400, reduce });
  const shown = useSequence(LEADS.length, { start: inView, stepMs: 240, reduce });

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between">
        <p className="text-[8.5px] font-bold text-white/90">Leads found</p>
        <span className="text-[10px] font-extrabold tabular-nums text-primary">{found.toLocaleString('en-US')}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <div className="flex h-6 flex-1 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5">
          <Search size={8} className="shrink-0 text-white/35" />
          <span className="truncate text-[6px] text-white/35">Business, role, location…</span>
        </div>
        <div className="flex h-6 items-center gap-1 rounded-md bg-primary px-1.5 text-[6px] font-bold text-[#04140f]">
          <Search size={7} strokeWidth={2.6} /> Search
        </div>
      </div>
      <div className="mt-1.5 flex gap-1">
        {['Leads', 'Companies', 'Filters'].map((t, i) => (
          <span key={t} className={cn('rounded-full px-1.5 py-[2px] text-[5.5px] font-semibold', i === 0 ? 'bg-primary/15 text-primary' : 'bg-white/[0.05] text-white/40')}>
            {t}
          </span>
        ))}
      </div>
      <div className="mt-1.5 space-y-1">
        {LEADS.map((l, i) => (
          <motion.div
            key={l.name}
            initial={{ opacity: 0, y: 8 }}
            animate={i < shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5"
          >
            <Avatar initials={l.initials} tint={l.tint} size={17} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[6.5px] font-bold text-white/90">{l.name}</p>
              <p className="truncate text-[5.5px] text-white/40">{l.role} · {l.city}</p>
            </div>
            <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors duration-300', i < shown ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/12 text-white/30')}>
              {i < shown ? <Check size={8} strokeWidth={3} /> : <span className="text-[8px] leading-none">+</span>}
            </span>
          </motion.div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-around rounded-lg border border-white/[0.08] bg-white/[0.02] py-1.5 text-[5.5px] font-semibold text-white/35">
        <span className="flex flex-col items-center gap-[2px] text-primary"><Home size={9} />Home</span>
        <span className="flex flex-col items-center gap-[2px]"><Users size={9} />Leads</span>
        <span className="flex flex-col items-center gap-[2px]"><LayoutGrid size={9} />CRM</span>
        <span className="flex flex-col items-center gap-[2px]"><MoreHorizontal size={9} />More</span>
      </div>
    </PhoneFrame>
  );
}

/* ------------------------------ 2 · VERIFY ------------------------------- */

function Ring({ pct, active }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-[86px] w-[86px]">
      <svg viewBox="0 0 86 86" className="h-full w-full -rotate-90">
        <circle cx="43" cy="43" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="43" cy="43" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-extrabold tabular-nums text-white">{pct}%</span>
        <span className="text-[5.5px] font-semibold uppercase tracking-wide text-white/40">verified</span>
      </div>
      {active && <span className="absolute inset-0 rounded-full ring-2 ring-primary/25" />}
    </div>
  );
}

const CHECKS = ['Importing contacts', 'Normalizing numbers', 'Checking WhatsApp', 'Removing duplicates'];
const CHECKS_DONE = [1240, 1240, 892, 12];

export function PhoneMock2({ inView, reduce }) {
  const pct = useCountUp(78, { start: inView, duration: 1300, reduce });
  const step = useSequence(CHECKS.length, { start: inView, stepMs: 300, reduce });

  return (
    <PhoneFrame>
      <div className="flex items-center gap-1.5 border-b border-white/[0.08] pb-1.5">
        <ArrowLeft size={9} className="text-white/50" />
        <ShieldCheck size={10} className="text-primary" />
        <p className="text-[8px] font-bold text-white/90">Verification</p>
        <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-[2px] text-[5.5px] font-semibold text-white/45">Live</span>
      </div>
      <div className="py-2">
        <Ring pct={pct} active={step < CHECKS.length && !reduce} />
      </div>
      <div className="space-y-[3px]">
        {CHECKS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border', done ? 'border-primary/40 bg-primary/15 text-primary' : current ? 'border-primary/40 text-primary' : 'border-white/12 text-white/25')}>
                {done ? <Check size={7} strokeWidth={3.2} /> : current ? <Loader2 size={7} className={reduce ? '' : 'animate-spin'} /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              <span className={cn('flex-1 truncate text-[6.5px]', done || current ? 'text-white/85' : 'text-white/35')}>{label}</span>
              <span className={cn('text-[6px] font-bold tabular-nums', done ? 'text-primary' : 'text-white/25')}>{done ? CHECKS_DONE[i].toLocaleString('en-US') : '—'}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.06] p-1.5">
        <div className="flex-1">
          <p className="text-[6px] text-white/45">WhatsApp-ready</p>
          <p className="text-[9px] font-extrabold tabular-nums text-primary">892<span className="ml-1 text-[5.5px] font-semibold text-white/40">contacts</span></p>
        </div>
        <span className="rounded-md bg-primary px-2 py-1 text-[6px] font-bold text-[#04140f]">View results</span>
      </div>
    </PhoneFrame>
  );
}

/* ------------------------------ 3 · ENGAGE ------------------------------- */

const BUBBLES = [
  { me: false, text: 'Hi! Saw you’re looking for an interior refresh 👋' },
  { me: true, text: 'Yes — we need a full office fit-out.' },
  { me: false, text: 'Perfect. What’s your ideal timeline?' },
];

export function PhoneMock3({ inView, reduce }) {
  const shown = useSequence(BUBBLES.length, { start: inView, stepMs: 420, reduce });
  const score = useCountUp(86, { start: inView, duration: 1400, delay: 500, reduce });
  const ready = score >= 86;

  return (
    <PhoneFrame>
      <div className="flex items-center gap-1.5 border-b border-white/[0.08] pb-1.5">
        <Avatar initials="MB" tint={318} size={18} online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[7.5px] font-bold text-white/90">Mara Bertolini</p>
          <p className="truncate text-[5.5px] text-primary/80">Interior Design · online</p>
        </div>
        <MessageSquare size={9} className="text-white/35" />
      </div>
      <div className="mt-1.5 space-y-1">
        {BUBBLES.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={i < shown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className={cn('flex', b.me ? 'justify-end' : 'justify-start')}
          >
            <p className={cn('max-w-[80%] rounded-xl px-1.5 py-1 text-[6px] leading-snug', b.me ? 'rounded-br-sm bg-primary/20 text-white/90' : 'rounded-bl-sm bg-white/[0.05] text-white/80')}>
              {b.text}
            </p>
          </motion.div>
        ))}
        {shown < BUBBLES.length && (
          <div className="flex justify-start">
            <span className="flex items-center gap-1 rounded-xl rounded-bl-sm bg-white/[0.05] px-2 py-1.5">
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="h-1 w-1 rounded-full bg-white/45" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
              ))}
            </span>
          </div>
        )}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={shown >= BUBBLES.length ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mt-2 rounded-lg border border-white/[0.1] bg-white/[0.03] p-1.5"
      >
        <p className="flex items-center gap-1 text-[6px] font-bold text-white/80">
          <Sparkles size={8} className="text-primary" /> AI Qualification
        </p>
        <div className="mt-1 flex items-center justify-between text-[6px]">
          <span className="text-white/45">Lead score</span>
          <span className="font-extrabold tabular-nums text-primary">{score}%</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-[width] duration-500" style={{ width: `${score}%` }} />
        </div>
        <div className="mt-1.5 space-y-[3px] text-[5.5px]">
          {[['Business type', 'Interior Design'], ['Budget range', '$8k–$12k'], ['Timeline', '3–4 weeks']].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-white/40">{k}</span>
              <span className="font-semibold text-white/80">{v}</span>
            </div>
          ))}
        </div>
        <motion.div
          animate={ready && !reduce ? { scale: [1, 1.04, 1], opacity: [1, 0.88, 1] } : { scale: 1, opacity: 1 }}
          transition={ready && !reduce ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          className="mt-1.5 flex items-center justify-center gap-1 rounded-md bg-primary py-1 text-[6px] font-bold text-[#04140f]"
        >
          <Check size={7} strokeWidth={3} /> Mark as Qualified
        </motion.div>
      </motion.div>
    </PhoneFrame>
  );
}

/* ----------------------------- 4 · FOLLOW-UP ----------------------------- */

const STAGES = ['New Lead', 'Contacted', 'Qualified', 'Follow-up', 'Opportunity'];

export function PhoneMock4({ inView, reduce }) {
  const step = useSequence(STAGES.length, { start: inView, stepMs: 260, reduce });
  const ready = step >= STAGES.length;

  return (
    <PhoneFrame>
      <div className="flex items-center gap-1.5 border-b border-white/[0.08] pb-1.5">
        <ArrowLeft size={9} className="text-white/50" />
        <p className="text-[8px] font-bold text-white/90">Lead Details</p>
        <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-[2px] text-[5.5px] font-semibold text-primary">Active</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Avatar initials="RM" tint={28} size={24} online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[7.5px] font-bold text-white/90">Raees Malik</p>
          <p className="flex items-center gap-1 truncate text-[5.5px] text-white/40"><Building2 size={7} /> Golden Thread Imports</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {['Importer', 'Repeat buyer', 'High intent'].map((t) => (
          <span key={t} className="rounded-full bg-white/[0.05] px-1.5 py-[2px] text-[5.5px] font-semibold text-white/55">{t}</span>
        ))}
      </div>
      <p className="mt-2 text-[5.5px] font-bold uppercase tracking-wide text-white/35">Pipeline stage</p>
      <div className="mt-1 space-y-[3px]">
        {STAGES.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border', done ? 'border-primary/40 bg-primary/15 text-primary' : current ? 'border-primary/40 text-primary' : 'border-white/12 text-white/25')}>
                {done ? <Check size={7} strokeWidth={3.2} /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              <span className={cn('flex-1 truncate text-[6.5px]', done || current ? 'text-white/85' : 'text-white/35')}>{s}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] p-1.5">
        <CalendarClock size={10} className="text-primary" />
        <div className="flex-1">
          <p className="text-[5.5px] text-white/40">Schedule follow-up</p>
          <p className="text-[6.5px] font-bold text-white/85">Fri, 24 Nov · 10:00 AM</p>
        </div>
      </div>
      <motion.div
        animate={ready && !reduce ? { scale: [1, 1.04, 1], opacity: [1, 0.88, 1] } : { scale: 1, opacity: 1 }}
        transition={ready && !reduce ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        className="mt-1.5 flex items-center justify-center gap-1 rounded-md bg-primary py-1 text-[6px] font-bold text-[#04140f]"
      >
        <Bell size={7} strokeWidth={2.6} /> Set Reminder
      </motion.div>
      <div className="mt-1.5 flex items-center justify-center gap-1 text-[5.5px] text-white/30">
        <Send size={7} /> Auto-message queued
      </div>
    </PhoneFrame>
  );
}
