import React from 'react';
import { motion } from 'framer-motion';
import {
  Search, ShieldCheck, Check, LayoutGrid, Users, Settings,
  MessageCircle, Star, TrendingUp, PhoneOff, Copy, Trophy, Filter, CheckCheck,
} from 'lucide-react';
import { cn } from '../../../ui/cn';
import { Avatar, StatusBadge } from '../shared';
import { useCountUp, useSequence } from './motionHooks';
import DEMO from '../demoData';

const VERIFY_PCT = Math.round((DEMO.verified / DEMO.contacts) * 100);
const DEALS = DEMO.deals;
const MOVE = DEALS[4];
const QUALIFIED = [DEALS[1], DEALS[2]];
const FOLLOWUP = [DEALS[3], DEALS[4]];
const OPPORTUNITY = [DEALS[0], DEALS[5]];

const ACTIVITY = DEMO.activity.map((a) => ({
  img: a.p.img,
  name: a.p.name,
  text: a.text,
}));

function Desk({ children, title, inView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="overflow-hidden rounded-xl border border-p-line bg-p-panel"
    >
      <div className="flex items-center gap-1.5 border-b border-p-line-soft bg-p-chip px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400/50" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/50" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/50" />
        <span className="ml-1 truncate text-[7px] font-semibold text-p-mut">{title}</span>
      </div>
      {children}
    </motion.div>
  );
}

const initials = (u) => u.name.split(' ').map((n) => n[0]).join('');

const NAV1 = ['Discover', 'Leads', 'Lists', 'Campaigns', 'CRM', 'Settings'];
const ROWS1 = DEMO.leads.slice(0, 4).map((l, i) => ({
  u: { name: l.contact, img: l.img, role: l.cat, city: l.loc },
  match: l.match,
}));

export function DesktopMock1({ inView, reduce }) {
  const found = useCountUp(DEMO.found, { start: inView, duration: 1400, reduce });
  return (
    <Desk title="Message Agent — Discover" inView={inView}>
      <div className="flex gap-2 p-2">
        <aside className="hidden w-24 shrink-0 rounded-lg border border-p-line-soft bg-p-chip p-1.5 sm:block">
          <p className="mb-1.5 flex items-center gap-1 text-[7px] font-bold text-primary"><ShieldCheck size={8} /> Shield</p>
          {NAV1.map((n, i) => (
            <p key={n} className={cn('flex items-center gap-1 rounded px-1 py-[3px] text-[6.5px]', i === 0 ? 'bg-primary/10 font-semibold text-primary' : 'text-p-mut')}>
              <span className="h-1 w-1 rounded-full bg-current" />{n}
            </p>
          ))}
        </aside>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <div className="flex h-5 flex-1 items-center gap-1 rounded-md border border-p-line bg-p-chip-strong px-1.5">
              <Search size={7} className="text-p-faint" />
              <span className="text-[6px] text-p-faint">Search business, role, location…</span>
            </div>
            <span className="flex h-5 items-center gap-1 rounded-md bg-primary px-2 text-[6px] font-bold text-[#04140f]"><Search size={7} /> Search</span>
          </div>
          <div className="mt-1 flex items-center gap-1 overflow-hidden">
            <Filter size={7} className="shrink-0 text-p-faint" />
            {['London', 'Real Estate', 'Property Manager', 'Business Size'].map((f) => (
              <span key={f} className="shrink-0 rounded-full bg-p-chip-strong px-1.5 py-[2px] text-[5.5px] font-semibold text-p-mut">{f}</span>
            ))}
          </div>
          <p className="mt-1.5 text-[6.5px] font-semibold text-p-mut">
            <span className="text-[8px] font-extrabold tabular-nums text-primary">{found.toLocaleString('en-US')}</span> business leads found
          </p>
          <div className="mt-1 space-y-1">
            {ROWS1.map(({ u, match }) => (
              <div key={u.name} className="flex items-center gap-1.5 rounded-lg border border-p-line-soft bg-p-chip px-1.5 py-1">
                <Avatar img={u.img} initials={initials(u)} size={18} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[6.5px] font-bold text-p-title">{u.name}</p>
                  <p className="truncate text-[5.5px] text-p-mut">{u.role} · {u.city}</p>
                </div>
                <span className="text-[6px] font-bold tabular-nums text-primary">{match}%</span>
                <StatusBadge tone="success"><ShieldCheck size={6} /> Verified</StatusBadge>
                <span className="rounded-md border border-p-line-strong px-1.5 py-[2px] text-[5.5px] font-semibold text-p-sub">Add to CRM</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Desk>
  );
}

const CHECK2 = ['Import contacts', 'Normalize numbers', 'Check WhatsApp', 'Remove duplicates', 'Ready to message'];
const LABEL_OF = { ready: 'Ready', dup: 'Duplicate', invalid: 'Invalid' };
const CONTACTS2 = DEMO.verify.list.map((r) => ({ u: { name: r.name, img: r.img, role: r.role }, t: LABEL_OF[r.status] }));

export function DesktopMock2({ inView, reduce }) {
  const pct = useCountUp(VERIFY_PCT, { start: inView, duration: 1300, reduce });
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <Desk title="Message Agent — Verify" inView={inView}>
      <div className="grid grid-cols-[1fr_auto_1.3fr] gap-2 p-2">
        <div>
          <p className="text-[7px] font-bold text-p-body">Verification steps</p>
          <div className="mt-1 space-y-[3px]">
            {CHECK2.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span className={cn('flex h-3 w-3 items-center justify-center rounded-full border', i < 4 ? 'border-primary/40 bg-primary/15 text-primary' : 'border-p-line-strong text-p-faint')}>
                  {i < 4 ? <Check size={6} strokeWidth={3.2} /> : <span className="h-[3px] w-[3px] rounded-full bg-current" />}
                </span>
                <span className={cn('truncate text-[6px]', i < 4 ? 'text-p-body' : 'text-p-faint')}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" stroke="var(--gs-line)" strokeWidth="6" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="url(#d2g)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
            <defs><linearGradient id="d2g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#5eead4" /></linearGradient></defs>
          </svg>
          <span className="absolute text-[9px] font-extrabold tabular-nums text-p-title">{pct}%</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {[
            ['Total', DEMO.contacts.toLocaleString('en-US')],
            ['Ready', DEMO.verified.toLocaleString('en-US')],
            ['Invalid', DEMO.invalid.toLocaleString('en-US')],
          ].map(([k, v], i) => (
            <div key={k} className="rounded-md border border-p-line-soft bg-p-chip p-1">
              <p className="text-[5.5px] text-p-mut">{k}</p>
              <p className={cn('text-[8px] font-extrabold tabular-nums', i === 2 ? 'text-warning' : 'text-primary')}>{v}</p>
            </div>
          ))}
          <div className="col-span-3 space-y-[3px]">
            {CONTACTS2.map(({ u, t }) => (
              <div key={u.name} className="flex items-center gap-1.5 rounded border border-p-line-soft bg-p-chip px-1.5 py-[3px]">
                <Avatar img={u.img} initials={initials(u)} size={15} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[6px] text-p-sub">{u.name}</span>
                  <span className="block truncate text-[5px] text-p-mut">{u.role}</span>
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

const CHATS = DEMO.chats.map((ch, i) => ({
  u: { name: ch.name, img: ch.img },
  sub: `${ch.role.split(' ')[0]} · ${ch.active ? 'New lead' : i === 1 ? 'Replied' : 'Qualified'}`,
  active: ch.active,
}));

export function DesktopMock3({ inView, reduce }) {
  const score = useCountUp(DEMO.chat.score, { start: inView, duration: 1400, reduce });
  return (
    <Desk title="Message Agent — Engage" inView={inView}>
      <div className="grid grid-cols-[24px_1fr_1.2fr] gap-2 p-2">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-p-line-soft bg-p-chip py-2 text-p-faint">
          {[MessageCircle, Users, LayoutGrid, Star, Settings].map((I, i) => (
            <I key={i} size={9} className={i === 0 ? 'text-primary' : ''} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-[3px] text-[5.5px] font-semibold text-primary">
            <Star size={6} /> AI-qualified leads
          </div>
          {CHATS.map((ch) => (
            <div key={ch.u.name} className={cn('flex items-center gap-1.5 rounded-lg border p-1', ch.active ? 'border-primary/25 bg-primary/[0.06]' : 'border-p-line-soft bg-p-chip')}>
              <Avatar img={ch.u.img} initials={initials(ch.u)} size={16} online={ch.active} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[6.5px] font-bold text-p-body">{ch.u.name}</p>
                <p className="truncate text-[5.5px] text-p-mut">{ch.sub}</p>
              </div>
              {!ch.active && <span className="flex h-2 w-2 shrink-0 items-center justify-center rounded-full bg-primary text-[5px] leading-none text-[#04140f]">1</span>}
            </div>
          ))}
        </div>
        <div className="min-w-0 rounded-lg border border-p-line-soft bg-p-chip p-1.5">
          <p className="flex items-center gap-1 text-[6.5px] font-bold text-p-body">
            {DEMO.chats[0].name}
            <span className="inline-flex items-center gap-[2px] text-[5px] text-primary"><CheckCheck size={6} strokeWidth={2.6} /> Read</span>
          </p>
          <div className="mt-1 space-y-1">
            <p className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-p-chip-strong px-1.5 py-1 text-[6px] text-p-body">Hi! Saw you’re looking for an interior refresh 👋</p>
            <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-primary/20 px-1.5 py-1 text-[6px] text-p-title">Yes — we need a full office fit-out.</p>
            <p className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-p-chip-strong px-1.5 py-1 text-[6px] text-p-body">Perfect. What’s your ideal timeline?</p>
          </div>
          <div className="mt-1.5 rounded-md border border-p-line-soft p-1.5">
            <p className="flex items-center justify-between text-[5.5px]"><span className="text-p-mut">Lead score</span><span className="font-extrabold tabular-nums text-primary">{score}%</span></p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-p-chip-strong"><div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-[width] duration-500" style={{ width: `${score}%` }} /></div>
            <div className="mt-1 flex items-center justify-between text-[6px] font-bold text-primary"><span>Mark as Qualified</span><Check size={7} strokeWidth={3} /></div>
          </div>
        </div>
      </div>
    </Desk>
  );
}

const STAGE_PILLS = DEMO.stages.map((s) => [s.label, s.n]);

function MiniCard({ d, moving, reduce }) {
  const brand = d.company.brand;
  const person = d.company.person;
  return (
    <motion.div
      initial={moving ? { opacity: 0, x: 10, scale: 0.92 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-md border border-p-line-soft bg-p-chip p-1"
    >
      <div className="flex items-center gap-1">
        <Avatar img={person.img} initials={initials(person)} size={15} />
        <span className="min-w-0 flex-1 truncate text-[6px] font-semibold text-p-body">{person.name}</span>
      </div>
      <p className="mt-1 truncate text-[5px] text-p-mut">{brand}</p>
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
  const conv = useCountUp(DEMO.conv, { start: inView, duration: 1300, reduce });
  const moved = useSequence(1, { start: inView, stepMs: 1600, reduce }) >= 1;
  return (
    <Desk title="Message Agent — CRM" inView={inView}>
      <div className="p-2">
        <div className="flex flex-wrap items-center gap-1">
          {STAGE_PILLS.map(([s, n], i) => (
            <span key={s} className={cn('flex items-center gap-1 rounded-full border px-1.5 py-[2px] text-[5.5px] font-semibold', i === 4 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-p-line-soft bg-p-chip text-p-mut')}>
              {s}<span className="tabular-nums text-p-faint">{n}</span>
            </span>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-[1.4fr_1fr] gap-2">
          <div className="grid grid-cols-3 gap-1">
            <div className="rounded-lg border border-p-line-soft bg-p-chip p-1">
              <p className="mb-1 text-[5.5px] font-bold uppercase tracking-wide text-p-mut">Qualified</p>
              <div className="space-y-1">{QUALIFIED.map((d) => <MiniCard key={d.company.brand} d={d} reduce={reduce} />)}</div>
            </div>
            <div className="rounded-lg border border-p-line-soft bg-p-chip p-1">
              <p className="mb-1 text-[5.5px] font-bold uppercase tracking-wide text-p-mut">Follow-up</p>
              <div className="space-y-1">
                {FOLLOWUP.filter((d) => d.company.brand !== MOVE.company.brand || !moved).map((d) => (
                  <MiniCard key={d.company.brand} d={d} reduce={reduce} />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-1">
              <p className="mb-1 text-[5.5px] font-bold uppercase tracking-wide text-primary">Opportunity</p>
              <div className="space-y-1">
                {[...OPPORTUNITY, ...(moved ? [MOVE] : [])].map((d) => (
                  <MiniCard key={d.company.brand} d={d} reduce={reduce} moving={d === MOVE} />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="rounded-lg border border-p-line-soft bg-p-chip p-1.5">
              <p className="flex items-center gap-1 text-[6px] font-semibold text-p-sub"><TrendingUp size={8} className="text-primary" /> Conversion rate</p>
              <p className="text-[13px] font-extrabold tabular-nums text-primary">{conv}% <span className="text-[7px] text-primary/70">↑</span></p>
            </div>
            <div className="rounded-lg border border-p-line-soft bg-p-chip p-1.5">
              <p className="mb-1 flex items-center gap-1 text-[6px] font-semibold text-p-sub"><Trophy size={8} className="text-warning" /> Recent activity</p>
              <div className="space-y-1">
                {ACTIVITY.map((a) => (
                  <div key={a.name} className="flex items-center gap-1">
                    <Avatar img={a.img} initials={initials(a)} size={13} />
                    <p className="truncate text-[5.5px] text-p-mut"><span className="mr-1 text-primary">•</span>{a.text} · {a.name}</p>
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