import React from 'react';
import { motion } from 'framer-motion';
import {
  Search, ShieldCheck, Check, LayoutGrid, Users, Settings,
  MessageCircle, Star, TrendingUp, PhoneOff, Copy, Trophy, Filter,
} from 'lucide-react';
import { cn } from '../../../ui/cn';
import { Avatar, StatusBadge } from '../shared';
import { useCountUp } from './motionHooks';

function Desk({ children, title, inView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="overflow-hidden rounded-xl border border-white/[0.09] bg-[#0c1216]"
    >
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400/50" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/50" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/50" />
        <span className="ml-1 truncate text-[7px] font-semibold text-white/40">{title}</span>
      </div>
      {children}
    </motion.div>
  );
}

const NAV1 = ['Discover', 'Leads', 'Lists', 'Campaigns', 'CRM', 'Settings'];
const ROWS1 = [
  { initials: 'NS', tint: 158, name: 'Nadia El-Sayed', role: 'Solar & Renewables', city: 'Dubai', match: 96 },
  { initials: 'OR', tint: 202, name: 'Omar Reza', role: 'Fitness Studio', city: 'Riyadh', match: 91 },
  { initials: 'SL', tint: 268, name: 'Sofia Lindqvist', role: 'Cloud Consulting', city: 'Doha', match: 88 },
  { initials: 'YA', tint: 20, name: 'Yusuf Adeyemi', role: 'Property Manager', city: 'Abu Dhabi', match: 84 },
];

export function DesktopMock1({ inView, reduce }) {
  const found = useCountUp(1460, { start: inView, duration: 1400, reduce });
  return (
    <Desk title="Message Agent — Discover" inView={inView}>
      <div className="flex gap-2 p-2">
        <aside className="hidden w-24 shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5 sm:block">
          <p className="mb-1.5 flex items-center gap-1 text-[7px] font-bold text-primary"><ShieldCheck size={8} /> Shield</p>
          {NAV1.map((n, i) => (
            <p key={n} className={cn('flex items-center gap-1 rounded px-1 py-[3px] text-[6.5px]', i === 0 ? 'bg-primary/10 font-semibold text-primary' : 'text-white/40')}>
              <span className="h-1 w-1 rounded-full bg-current" />{n}
            </p>
          ))}
        </aside>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <div className="flex h-5 flex-1 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5">
              <Search size={7} className="text-white/35" />
              <span className="text-[6px] text-white/35">Search business, role, location…</span>
            </div>
            <span className="flex h-5 items-center gap-1 rounded-md bg-primary px-2 text-[6px] font-bold text-[#04140f]"><Search size={7} /> Search</span>
          </div>
          <div className="mt-1 flex items-center gap-1 overflow-hidden">
            <Filter size={7} className="shrink-0 text-white/35" />
            {['Dubai', 'Real Estate', 'Property Manager', 'Business Size'].map((f) => (
              <span key={f} className="shrink-0 rounded-full bg-white/[0.05] px-1.5 py-[2px] text-[5.5px] font-semibold text-white/55">{f}</span>
            ))}
          </div>
          <p className="mt-1.5 text-[6.5px] font-semibold text-white/45">
            <span className="text-[8px] font-extrabold tabular-nums text-primary">{found.toLocaleString('en-US')}</span> business leads found
          </p>
          <div className="mt-1 space-y-1">
            {ROWS1.map((r) => (
              <div key={r.name} className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-1.5 py-1">
                <Avatar initials={r.initials} tint={r.tint} size={16} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[6.5px] font-bold text-white/90">{r.name}</p>
                  <p className="truncate text-[5.5px] text-white/40">{r.role} · {r.city}</p>
                </div>
                <span className="text-[6px] font-bold tabular-nums text-primary">{r.match}%</span>
                <StatusBadge tone="success"><ShieldCheck size={6} /> Verified</StatusBadge>
                <span className="rounded-md border border-white/12 px-1.5 py-[2px] text-[5.5px] font-semibold text-white/65">Add to CRM</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Desk>
  );
}

const CHECK2 = ['Import contacts', 'Normalize numbers', 'Check WhatsApp', 'Remove duplicates', 'Ready to message'];

export function DesktopMock2({ inView, reduce }) {
  const pct = useCountUp(78, { start: inView, duration: 1300, reduce });
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <Desk title="Message Agent — Verify" inView={inView}>
      <div className="grid grid-cols-[1fr_auto_1.2fr] gap-2 p-2">
        <div>
          <p className="text-[7px] font-bold text-white/85">Verification steps</p>
          <div className="mt-1 space-y-[3px]">
            {CHECK2.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span className={cn('flex h-3 w-3 items-center justify-center rounded-full border', i < 4 ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/12 text-white/25')}>
                  {i < 4 ? <Check size={6} strokeWidth={3.2} /> : <span className="h-[3px] w-[3px] rounded-full bg-current" />}
                </span>
                <span className={cn('truncate text-[6px]', i < 4 ? 'text-white/80' : 'text-white/35')}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="url(#d2g)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
            <defs><linearGradient id="d2g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#5eead4" /></linearGradient></defs>
          </svg>
          <span className="absolute text-[9px] font-extrabold tabular-nums text-white">{pct}%</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {[['Total', '1,240'], ['Ready', '892'], ['Invalid', '336']].map(([k, v], i) => (
            <div key={k} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-1">
              <p className="text-[5.5px] text-white/40">{k}</p>
              <p className={cn('text-[8px] font-extrabold tabular-nums', i === 2 ? 'text-amber-300' : 'text-primary')}>{v}</p>
            </div>
          ))}
          <div className="col-span-3 space-y-[3px]">
            {[{ n: 'Rafael Ortega', t: 'Ready' }, { n: 'Amara Diop', t: 'Ready' }, { n: 'Sophie Laurent', t: 'Duplicate' }, { n: 'Jonas Lindqvist', t: 'Invalid' }].map((r) => (
              <div key={r.n} className="flex items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-[3px]">
                <span className="truncate text-[6px] text-white/75">{r.n}</span>
                <StatusBadge tone={r.t === 'Ready' ? 'success' : r.t === 'Invalid' ? 'warn' : 'muted'}>
                  {r.t === 'Ready' ? <ShieldCheck size={6} /> : r.t === 'Invalid' ? <PhoneOff size={6} /> : <Copy size={6} />}{r.t}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Desk>
  );
}

const CHATS = [
  { initials: 'MB', tint: 318, name: 'Mara Bertolini', sub: 'Interior · New lead', active: true },
  { initials: 'KA', tint: 12, name: 'Kemi Adegoke', sub: 'Retail · Replied', active: false },
  { initials: 'DF', tint: 210, name: 'Diego Fuentes', sub: 'Logistics · Qualified', active: false },
];

export function DesktopMock3({ inView, reduce }) {
  const score = useCountUp(86, { start: inView, duration: 1400, reduce });
  return (
    <Desk title="Message Agent — Engage" inView={inView}>
      <div className="grid grid-cols-[24px_1fr_1.2fr] gap-2 p-2">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 text-white/30">
          {[MessageCircle, Users, LayoutGrid, Star, Settings].map((I, i) => (
            <I key={i} size={9} className={i === 0 ? 'text-primary' : ''} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-[3px] text-[5.5px] font-semibold text-primary">
            <Star size={6} /> AI-qualified leads
          </div>
          {CHATS.map((ch) => (
            <div key={ch.name} className={cn('flex items-center gap-1.5 rounded-lg border p-1', ch.active ? 'border-primary/25 bg-primary/[0.06]' : 'border-white/[0.06] bg-white/[0.02]')}>
              <Avatar initials={ch.initials} tint={ch.tint} size={15} online={ch.active} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[6.5px] font-bold text-white/85">{ch.name}</p>
                <p className="truncate text-[5.5px] text-white/40">{ch.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="min-w-0 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
          <p className="text-[6.5px] font-bold text-white/85">Mara Bertolini</p>
          <div className="mt-1 space-y-1">
            <p className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-white/[0.06] px-1.5 py-1 text-[6px] text-white/80">Hi! Saw you’re looking for an interior refresh 👋</p>
            <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-primary/20 px-1.5 py-1 text-[6px] text-white/90">Yes — we need a full office fit-out.</p>
            <p className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-white/[0.06] px-1.5 py-1 text-[6px] text-white/80">Perfect. What’s your ideal timeline?</p>
          </div>
          <div className="mt-1.5 rounded-md border border-white/[0.08] p-1.5">
            <p className="flex items-center justify-between text-[5.5px]"><span className="text-white/45">Lead score</span><span className="font-extrabold tabular-nums text-primary">{score}%</span></p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-[width] duration-500" style={{ width: `${score}%` }} /></div>
            <div className="mt-1 flex items-center justify-between text-[6px] font-bold text-primary"><span>Mark as Qualified</span><Check size={7} strokeWidth={3} /></div>
          </div>
        </div>
      </div>
    </Desk>
  );
}

const STAGE_PILLS = [['New Lead', 24], ['Contacted', 18], ['Qualified', 12], ['Follow-up', 7], ['Opportunity', 4], ['Converted', 3]];
const KANBAN = [
  { title: 'Qualified', items: ['Aurora Fit-out', 'Nile Freight'] },
  { title: 'Follow-up', items: ['PixelBrew Studio', 'Verana Home'] },
  { title: 'Opportunity', items: ['Golden Thread Imports'] },
];

export function DesktopMock4({ inView, reduce }) {
  const conv = useCountUp(18, { start: inView, duration: 1300, reduce });
  return (
    <Desk title="Message Agent — CRM" inView={inView}>
      <div className="p-2">
        <div className="flex flex-wrap items-center gap-1">
          {STAGE_PILLS.map(([s, n], i) => (
            <span key={s} className={cn('flex items-center gap-1 rounded-full border px-1.5 py-[2px] text-[5.5px] font-semibold', i === 4 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.02] text-white/50')}>
              {s}<span className="tabular-nums text-white/35">{n}</span>
            </span>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-[1.4fr_1fr] gap-2">
          <div className="grid grid-cols-3 gap-1">
            {KANBAN.map((col) => (
              <div key={col.title} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
                <p className="mb-1 text-[5.5px] font-bold uppercase tracking-wide text-white/40">{col.title}</p>
                <div className="space-y-1">
                  {col.items.map((it) => (
                    <div key={it} className="rounded-md border border-white/[0.07] bg-white/[0.03] p-1">
                      <p className="truncate text-[6px] font-semibold text-white/80">{it}</p>
                      <span className="mt-1 inline-block rounded bg-white/[0.05] px-1 text-[5px] text-white/40">Follow-up</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
              <p className="flex items-center gap-1 text-[6px] font-semibold text-white/60"><TrendingUp size={8} className="text-primary" /> Conversion rate</p>
              <p className="text-[13px] font-extrabold tabular-nums text-primary">{conv}% <span className="text-[7px] text-primary/70">↑</span></p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
              <p className="mb-1 flex items-center gap-1 text-[6px] font-semibold text-white/60"><Trophy size={8} className="text-amber-300" /> Recent activity</p>
              {['Opportunity created · Golden Thread', 'Reminder set · Verana Home', 'Qualified · Nile Freight'].map((a) => (
                <p key={a} className="truncate text-[5.5px] text-white/45"><span className="mr-1 text-primary">•</span>{a}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Desk>
  );
}
