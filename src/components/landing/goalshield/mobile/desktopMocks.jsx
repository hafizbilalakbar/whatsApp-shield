import React from 'react';
import { motion } from 'framer-motion';
import {
  Search, ShieldCheck, Check, LayoutGrid, Users, Settings,
  MessageCircle, Star, TrendingUp, PhoneOff, Copy, Trophy, Filter, CheckCheck,
} from 'lucide-react';
import { cn } from '../../../ui/cn';
import { Avatar, StatusBadge } from '../shared';
import { useCountUp, useSequence } from './motionHooks';
import { USERS, companyOf } from './userData';

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

const initials = (u) => u.name.split(' ').map((n) => n[0]).join('');

const NAV1 = ['Discover', 'Leads', 'Lists', 'Campaigns', 'CRM', 'Settings'];
const ROWS1 = [
  { u: USERS.nadia, match: 96 },
  { u: USERS.omar, match: 91 },
  { u: USERS.sofia, match: 88 },
  { u: USERS.yusuf, match: 84 },
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
            {ROWS1.map(({ u, match }) => (
              <div key={u.name} className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-1.5 py-1">
                <Avatar img={u.img} initials={initials(u)} size={18} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[6.5px] font-bold text-white/90">{u.name}</p>
                  <p className="truncate text-[5.5px] text-white/40">{u.role} · {u.city}</p>
                </div>
                <span className="text-[6px] font-bold tabular-nums text-primary">{match}%</span>
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
const CONTACTS2 = [
  { u: USERS.rafael, t: 'Ready' },
  { u: USERS.amara, t: 'Ready' },
  { u: USERS.sophie, t: 'Duplicate' },
  { u: USERS.jonas, t: 'Invalid' },
];

export function DesktopMock2({ inView, reduce }) {
  const pct = useCountUp(78, { start: inView, duration: 1300, reduce });
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <Desk title="Message Agent — Verify" inView={inView}>
      <div className="grid grid-cols-[1fr_auto_1.3fr] gap-2 p-2">
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
            {CONTACTS2.map(({ u, t }) => (
              <div key={u.name} className="flex items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-[3px]">
                <Avatar img={u.img} initials={initials(u)} size={15} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[6px] text-white/75">{u.name}</span>
                  <span className="block truncate text-[5px] text-white/40">{u.role}</span>
                </span>
                <StatusBadge tone={t === 'Ready' ? 'success' : t === 'Invalid' ? 'warn' : 'muted'}>
                  {t === 'Ready' ? <ShieldCheck size={6} /> : t === 'Invalid' ? <PhoneOff size={6} /> : <Copy size={6} />}{t}
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
  { u: USERS.mara, sub: 'Interior · New lead', active: true },
  { u: USERS.kemi, sub: 'Retail · Replied', active: false },
  { u: USERS.diego, sub: 'Logistics · Qualified', active: false },
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
            <div key={ch.u.name} className={cn('flex items-center gap-1.5 rounded-lg border p-1', ch.active ? 'border-primary/25 bg-primary/[0.06]' : 'border-white/[0.06] bg-white/[0.02]')}>
              <Avatar img={ch.u.img} initials={initials(ch.u)} size={16} online={ch.active} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[6.5px] font-bold text-white/85">{ch.u.name}</p>
                <p className="truncate text-[5.5px] text-white/40">{ch.sub}</p>
              </div>
              {!ch.active && <span className="flex h-2 w-2 shrink-0 items-center justify-center rounded-full bg-primary text-[5px] leading-none text-[#04140f]">1</span>}
            </div>
          ))}
        </div>
        <div className="min-w-0 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
          <p className="flex items-center gap-1 text-[6.5px] font-bold text-white/85">
            {USERS.mara.name}
            <span className="inline-flex items-center gap-[2px] text-[5px] text-primary"><CheckCheck size={6} strokeWidth={2.6} /> Read</span>
          </p>
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
const QUALIFIED = [companyOf('Aurora Fit-out'), companyOf('Nile Freight')];
const FOLLOWUP = [companyOf('Verana Home'), companyOf('PixelBrew Studio')];
const OPPORTUNITY = [companyOf('Golden Thread Imports'), companyOf('Canary Works')];
const ACTIVITY = [
  { u: USERS.raees, text: 'Opportunity created' },
  { u: USERS.ingrid, text: 'Reminder set · 24 Nov' },
  { u: USERS.marcus, text: 'Qualified' },
];

function MiniCard({ co, moving, reduce }) {
  const u = USERS[co.user];
  return (
    <motion.div
      initial={moving ? { opacity: 0, x: 10, scale: 0.92 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-md border border-white/[0.07] bg-white/[0.03] p-1"
    >
      <div className="flex items-center gap-1">
        <Avatar img={u.img} initials={initials(u)} size={15} />
        <span className="min-w-0 flex-1 truncate text-[6px] font-semibold text-white/80">{u.name}</span>
      </div>
      <p className="mt-1 truncate text-[5px] text-white/45">{co.company}</p>
      {moving && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={moving && !reduce ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
          transition={moving && !reduce ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
          className="mt-1 inline-block rounded bg-primary/15 px-1 text-[5px] font-semibold text-primary"
        >
          Moved · follows up Fri
        </motion.span>
      )}
    </motion.div>
  );
}

export function DesktopMock4({ inView, reduce }) {
  const conv = useCountUp(18, { start: inView, duration: 1300, reduce });
  const moved = useSequence(1, { start: inView, stepMs: 1600, reduce }) >= 1;
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
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
              <p className="mb-1 text-[5.5px] font-bold uppercase tracking-wide text-white/40">Qualified</p>
              <div className="space-y-1">{QUALIFIED.map((co) => <MiniCard key={co.company} co={co} reduce={reduce} />)}</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
              <p className="mb-1 text-[5.5px] font-bold uppercase tracking-wide text-white/40">Follow-up</p>
              <div className="space-y-1">
                {FOLLOWUP.filter((co) => co.company !== 'PixelBrew Studio' || !moved).map((co) => (
                  <MiniCard key={co.company} co={co} reduce={reduce} />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-1">
              <p className="mb-1 text-[5.5px] font-bold uppercase tracking-wide text-primary">Opportunity</p>
              <div className="space-y-1">
                {[...OPPORTUNITY, ...(moved ? [companyOf('PixelBrew Studio')] : [])].map((co) => (
                  <MiniCard key={co.company} co={co} reduce={reduce} moving={co.company === 'PixelBrew Studio'} />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
              <p className="flex items-center gap-1 text-[6px] font-semibold text-white/60"><TrendingUp size={8} className="text-primary" /> Conversion rate</p>
              <p className="text-[13px] font-extrabold tabular-nums text-primary">{conv}% <span className="text-[7px] text-primary/70">↑</span></p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
              <p className="mb-1 flex items-center gap-1 text-[6px] font-semibold text-white/60"><Trophy size={8} className="text-amber-300" /> Recent activity</p>
              <div className="space-y-1">
                {ACTIVITY.map((a) => (
                  <div key={a.u.name} className="flex items-center gap-1">
                    <Avatar img={a.u.img} initials={initials(a.u)} size={13} />
                    <p className="truncate text-[5.5px] text-white/45"><span className="mr-1 text-primary">•</span>{a.text} · {a.u.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Desk>
  );
}