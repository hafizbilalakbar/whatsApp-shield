import React from 'react';
import { motion } from 'framer-motion';
import {
  Search, Check, Home, Users, LayoutGrid, MoreHorizontal, ShieldCheck,
  ArrowLeft, Loader2, CalendarClock, Sparkles, Bell, Send, MessageSquare, Building2, CheckCheck,
} from 'lucide-react';
import { cn } from '../../../ui/cn';
import { Avatar } from '../shared';
import { useCountUp, useSequence } from './motionHooks';
import DEMO from '../demoData';

export const VERIFY_PCT = Math.round((DEMO.verified / DEMO.contacts) * 100);

export function PhoneFrame({ children, className }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[212px] rounded-[1.75rem] border border-p-line-strong bg-p-root p-1.5 shadow-p-phone md:max-w-[182px]', className)}>
      <div className="absolute left-1/2 top-2 z-20 h-1 w-9 -translate-x-1/2 rounded-full bg-white/15" />
      <div className="relative overflow-hidden rounded-[1.4rem] border border-p-line-soft bg-p-screen">
        <div className="flex items-center justify-between px-3 pb-1 pt-2.5 text-[6.5px] font-semibold text-p-mut">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-2 rounded-[1px] bg-white/45" />
            <span className="inline-block h-1.5 w-2 rounded-[1px] bg-white/25" />
            <span className="inline-block h-2 w-3 rounded-[2px] border border-p-status" />
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

const LEADS = DEMO.leads.slice(0, 3).map((l) => ({
  name: l.contact,
  img: l.img,
  role: l.cat,
  city: l.loc,
}));

export function PhoneMock1({ inView, reduce }) {
  const found = useCountUp(DEMO.found, { start: inView, duration: 1400, reduce });
  const shown = useSequence(LEADS.length, { start: inView, stepMs: 240, reduce });
  const added = shown >= LEADS.length;

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between">
        <p className="text-[8.5px] font-bold text-p-title">Leads found</p>
        <span className="text-[10px] font-extrabold tabular-nums text-primary">{found.toLocaleString('en-US')}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <div className="flex h-6 flex-1 items-center gap-1 rounded-md border border-p-line bg-p-chip-strong px-1.5">
          <Search size={8} className="shrink-0 text-p-faint" />
          <span className="truncate text-[6px] text-p-faint">Business, role, location…</span>
        </div>
        <div className="flex h-6 items-center gap-1 rounded-md bg-primary px-1.5 text-[6px] font-bold text-[#04140f]">
          <Search size={7} strokeWidth={2.6} /> Search
        </div>
      </div>
      <div className="mt-1.5 flex gap-1">
        {['Leads', 'Companies', 'Filters'].map((t, i) => (
          <span key={t} className={cn('rounded-full px-1.5 py-[2px] text-[5.5px] font-semibold', i === 0 ? 'bg-primary/15 text-primary' : 'bg-p-chip-strong text-p-mut')}>
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
            className="flex items-center gap-1.5 rounded-lg border border-p-line-soft bg-p-chip p-1.5"
          >
            <Avatar img={l.img} initials={l.name.split(' ').map((n) => n[0]).join('')} size={18} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[6.5px] font-bold text-p-title">{l.name}</p>
              <p className="truncate text-[5.5px] text-p-mut">{l.role} · {l.city}</p>
            </div>
            <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors duration-300', i < shown ? 'border-primary/40 bg-primary/15 text-primary' : 'border-p-line-strong text-p-faint')}>
              {i < shown ? <Check size={8} strokeWidth={3} /> : <span className="text-[8px] leading-none">+</span>}
            </span>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={added ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mt-1 flex items-center gap-1 rounded-md border border-primary/25 bg-primary/[0.08] px-1.5 py-1 text-[5.5px] font-semibold text-primary"
      >
        <Check size={7} strokeWidth={3} /> 3 new leads added to CRM
      </motion.div>
      <div className="mt-1.5 flex items-center justify-around rounded-lg border border-p-line-soft bg-p-chip py-1.5 text-[5.5px] font-semibold text-p-faint">
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
        <circle cx="43" cy="43" r={r} fill="none" stroke="var(--gs-line)" strokeWidth="7" />
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
        <span className="text-[15px] font-extrabold tabular-nums text-p-title">{pct}%</span>
        <span className="text-[5.5px] font-semibold uppercase tracking-wide text-p-mut">verified</span>
      </div>
      {active && <span className="absolute inset-0 rounded-full ring-2 ring-primary/25" />}
    </div>
  );
}

const CHECKS = ['Importing contacts', 'Normalizing numbers', 'Checking WhatsApp', 'Removing duplicates'];
const CHECKS_DONE = [DEMO.contacts, DEMO.contacts, DEMO.verified, DEMO.dups];
const VERIFIED = DEMO.verify.list.filter((r) => r.status === 'ready').slice(0, 2).map((r) => ({ name: r.name, img: r.img, role: r.role }));

export function PhoneMock2({ inView, reduce }) {
  const pct = useCountUp(VERIFY_PCT, { start: inView, duration: 1300, reduce });
  const step = useSequence(CHECKS.length, { start: inView, stepMs: 300, reduce });
  const done = step >= CHECKS.length;

  return (
    <PhoneFrame>
      <div className="flex items-center gap-1.5 border-b border-p-line-soft pb-1.5">
        <ArrowLeft size={9} className="text-p-mut" />
        <ShieldCheck size={10} className="text-primary" />
        <p className="text-[8px] font-bold text-p-title">Verification</p>
        <span className="ml-auto rounded-full bg-p-chip-strong px-1.5 py-[2px] text-[5.5px] font-semibold text-p-mut">Live</span>
      </div>
      <div className="py-2">
        <Ring pct={pct} active={step < CHECKS.length && !reduce} />
      </div>
      <div className="space-y-[3px]">
        {CHECKS.map((label, i) => {
          const isDone = i < step;
          const current = i === step;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border', isDone ? 'border-primary/40 bg-primary/15 text-primary' : current ? 'border-primary/40 text-primary' : 'border-p-line-strong text-p-faint')}>
                {isDone ? <Check size={7} strokeWidth={3.2} /> : current ? <Loader2 size={7} className={reduce ? '' : 'animate-spin'} /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              <span className={cn('flex-1 truncate text-[6.5px]', isDone || current ? 'text-p-body' : 'text-p-faint')}>{label}</span>
              <span className={cn('text-[6px] font-bold tabular-nums', isDone ? 'text-primary' : 'text-p-faint')}>{isDone ? CHECKS_DONE[i].toLocaleString('en-US') : '—'}</span>
            </div>
          );
        })}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mt-1.5 flex items-center gap-1.5"
      >
        {VERIFIED.map((v) => (
          <span key={v.name} className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-p-line-soft bg-p-chip px-1.5 py-1">
            <Avatar img={v.img} initials={v.name.split(' ').map((n) => n[0]).join('')} size={15} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[6px] font-semibold text-p-body">{v.name}</span>
              <span className="block truncate text-[5px] text-p-mut">{v.role}</span>
            </span>
            <Check size={7} strokeWidth={3} className="shrink-0 text-primary" />
          </span>
        ))}
      </motion.div>
      <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.06] p-1.5">
        <div className="flex-1">
          <p className="text-[6px] text-p-mut">WhatsApp-ready</p>
          <p className="text-[9px] font-extrabold tabular-nums text-primary">{DEMO.verified.toLocaleString('en-US')}<span className="ml-1 text-[5.5px] font-semibold text-p-mut">contacts</span></p>
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
  const score = useCountUp(DEMO.chat.score, { start: inView, duration: 1400, delay: 500, reduce });
  const ready = score >= DEMO.chat.score;
  const read = shown >= BUBBLES.length;

  return (
    <PhoneFrame>
      <div className="flex items-center gap-1.5 border-b border-p-line-soft pb-1.5">
        <Avatar img={DEMO.chats[0].img} initials={DEMO.chats[0].name.split(' ').map((n) => n[0]).join('')} size={18} online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[7.5px] font-bold text-p-title">{DEMO.chats[0].name}</p>
          <p className="truncate text-[5.5px] text-primary/80">{DEMO.chats[0].role} · online</p>
        </div>
        <MessageSquare size={9} className="text-p-faint" />
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
            <div className={cn('max-w-[84%]', b.me ? 'text-right' : 'text-left')}>
              <p className={cn('inline-block rounded-xl px-1.5 py-1 text-[6px] leading-snug', b.me ? 'rounded-br-sm bg-primary/20 text-p-title' : 'rounded-bl-sm bg-p-chip-strong text-p-body')}>
                {b.text}
              </p>
              {b.me && (
                <motion.span
                  animate={read ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="ml-1 inline-flex items-center gap-[2px] align-middle text-[5px] text-primary"
                >
                  <CheckCheck size={7} strokeWidth={2.6} /> Read
                </motion.span>
              )}
            </div>
          </motion.div>
        ))}
        {shown < BUBBLES.length && (
          <div className="flex justify-start">
            <span className="flex items-center gap-1 rounded-xl rounded-bl-sm bg-p-chip-strong px-2 py-1.5">
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
        className="mt-2 rounded-lg border border-p-line bg-p-chip p-1.5"
      >
        <p className="flex items-center gap-1 text-[6px] font-bold text-p-body">
          <Sparkles size={8} className="text-primary" /> AI Qualification
        </p>
        <div className="mt-1 flex items-center justify-between text-[6px]">
          <span className="text-p-mut">Lead score</span>
          <span className="font-extrabold tabular-nums text-primary">{score}%</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-p-chip-strong">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-[width] duration-500" style={{ width: `${score}%` }} />
        </div>
        <div className="mt-1.5 space-y-[3px] text-[5.5px]">
          {[['Business type', 'Interior Design'], ['Budget range', '$8k–$12k'], ['Timeline', '3–4 weeks']].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-p-mut">{k}</span>
              <span className="font-semibold text-p-body">{v}</span>
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
      <div className="flex items-center gap-1.5 border-b border-p-line-soft pb-1.5">
        <ArrowLeft size={9} className="text-p-mut" />
        <p className="text-[8px] font-bold text-p-title">Lead Details</p>
        <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-[2px] text-[5.5px] font-semibold text-primary">Active</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Avatar img={DEMO.pipeline.p.img} initials={DEMO.pipeline.p.name.split(' ').map((n) => n[0]).join('')} size={24} online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[7.5px] font-bold text-p-title">{DEMO.pipeline.p.name}</p>
          <p className="flex items-center gap-1 truncate text-[5.5px] text-p-mut"><Building2 size={7} /> {DEMO.pipeline.p.role}</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {DEMO.pipeline.tags.map((t) => (
          <span key={t} className="rounded-full bg-p-chip-strong px-1.5 py-[2px] text-[5.5px] font-semibold text-p-mut">{t}</span>
        ))}
      </div>
      <p className="mt-2 text-[5.5px] font-bold uppercase tracking-wide text-p-faint">Pipeline stage</p>
      <div className="mt-1 space-y-[3px]">
        {STAGES.map((s, i) => {
          const isDone = i < step;
          const current = i === step;
          return (
            <motion.div key={s} initial={{ opacity: 0, x: -6 }} animate={i <= step ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="flex items-center gap-1.5">
              <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border', isDone ? 'border-primary/40 bg-primary/15 text-primary' : current ? 'border-primary/40 text-primary' : 'border-p-line-strong text-p-faint')}>
                {isDone ? <Check size={7} strokeWidth={3.2} /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              <span className={cn('flex-1 truncate text-[6.5px]', isDone || current ? 'text-p-body' : 'text-p-faint')}>{s}</span>
            </motion.div>
          );
        })}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mt-2 flex items-center gap-1.5 rounded-lg border border-p-line bg-p-chip p-1.5"
      >
        <CalendarClock size={10} className="text-primary" />
        <div className="flex-1">
          <p className="text-[5.5px] text-p-mut">Schedule follow-up</p>
          <p className="text-[6.5px] font-bold text-p-body">Fri, 24 Nov · 10:00 AM</p>
        </div>
      </motion.div>
      <motion.div
        animate={ready && !reduce ? { scale: [1, 1.04, 1], opacity: [1, 0.88, 1] } : { scale: 1, opacity: 1 }}
        transition={ready && !reduce ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        className="mt-1.5 flex items-center justify-center gap-1 rounded-md bg-primary py-1 text-[6px] font-bold text-[#04140f]"
      >
        <Bell size={7} strokeWidth={2.6} /> Set Reminder
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="mt-1.5 flex items-center justify-center gap-1 text-[5.5px] text-p-faint"
      >
        <Send size={7} /> Auto-message queued
      </motion.div>
    </PhoneFrame>
  );
}