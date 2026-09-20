import React from 'react';
import { motion, useTransform } from 'framer-motion';
import {
  Radar, Users, ListChecks, Megaphone, Settings, Globe, Store, Target,
  Search, Check, CheckCircle2, BadgeCheck, MapPin, UserPlus, Phone, BellRing,
  Zap, Filter, ChevronDown, WifiOff,
} from 'lucide-react';
import { cn } from '../../ui/cn';
import {
  Avatar, StatusBadge, SceneHeader, Pop, CountUp, Caret, FooterStrip,
  clamp01, easeOut, inRange, fade,
} from './shared';
import DEMO from './demoData';

const NAV = [
  { icon: Radar, label: 'Discover' },
  { icon: Users, label: 'Leads' },
  { icon: ListChecks, label: 'Lists' },
  { icon: Megaphone, label: 'Campaigns' },
  { icon: Settings, label: 'Settings' },
];

const SOURCES = [
  { icon: Globe, label: 'Company directory' },
  { icon: Store, label: 'Real estate' },
  { icon: Users, label: 'Retail network' },
  { icon: Target, label: 'B2B intel' },
];

const FILTERS = ['All', 'Real Estate', 'Retail', 'Services', 'Manufacturing'];

const LEADS = DEMO.leads;

const initials = (name) => name.split(' ').map((w) => w[0]).join('');

function LeadRow({ lead, i, mv }) {
  const st = 0.16 + i * 0.055;
  const rowOp = inRange(mv, st, st + 0.04);
  const rowY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - st) / 0.04))) * 9);
  const vAt = st + 0.03;
  const verScale = useTransform(mv, (v) => {
    const a = clamp01((v - vAt) / 0.06);
    const b = clamp01((v - vAt - 0.06) / 0.3);
    return Math.min(1.22, 1 + 0.22 * a * (1 - b));
  });
  const matchAt = st + 0.05;
  const matchOp = inRange(mv, matchAt, matchAt + 0.05);
  const badge1Op = fade(mv, st + 0.02, st + 0.06, st + 0.44, st + 0.5);
  const badge2Op = fade(mv, st + 0.48, st + 0.54, 1.02, 1.08);
  const badge1Y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - st - 0.02) / 0.04))) * 6);
  const badge2Y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - st - 0.48) / 0.06))) * 6);

  const match = lead.match;

  return (
    <motion.div style={{ opacity: rowOp, y: rowY }}>
      <div className="flex items-stretch gap-2 rounded-xl border border-line/70 bg-p-chip px-2 py-1.5 sm:gap-2.5 sm:px-2.5 sm:py-[7px]">
        <Avatar img={lead.img} initials={initials(lead.contact)} tint={lead.tint} size={26} className="mt-[2px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[9.5px] font-bold text-p-title">{lead.contact}</span>
            <motion.span style={{ scale: verScale }} className="text-primary">
              <BadgeCheck size={10} strokeWidth={2.4} />
            </motion.span>
          </div>
          <p className="truncate text-[7.5px] font-medium text-p-mut">
            {lead.brand} · {lead.cat} · {lead.loc}
          </p>
        </div>
        <motion.span
          style={{ opacity: matchOp, scale: verScale }}
          className="hidden items-center gap-[3px] self-center rounded-md border border-primary/25 bg-primary/10 px-1 py-[2px] text-[7.5px] font-bold text-primary sm:flex"
        >
          <Check size={8} strokeWidth={3} />
          {match}%
        </motion.span>
        <div className="relative h-[20px] w-[86px] self-center sm:h-[22px]">
          <motion.div style={{ opacity: badge1Op, y: badge1Y }} className="absolute inset-0 items-center justify-center gap-1 rounded-full border border-primary/30 bg-success/10 px-1 text-[7.5px] font-bold text-primary">
            <CheckCircle2 size={9} strokeWidth={2.2} />
            WhatsApp verified
          </motion.div>
          <motion.div style={{ opacity: badge2Op, y: badge2Y }} className={cn('absolute inset-0 items-center justify-center gap-1 rounded-full border px-1 text-[7.5px] font-bold', !lead.wa ? 'border-amber-500/30 bg-amber-500/10 text-warning' : 'border-primary/30 bg-success/10 text-primary')}>
            {!lead.wa ? <WifiOff size={9} strokeWidth={2.2} /> : <BellRing size={9} strokeWidth={2.2} />}
            {!lead.wa ? 'No WhatsApp' : 'New match'}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function DetailPanel({ mv }) {
  const op = inRange(mv, 0.34, 0.42);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.34) / 0.08))) * 12);
  const lead = LEADS[0];
  const btnAt = 0.62;
  const btnOp = inRange(mv, btnAt, btnAt + 0.05);
  const btnY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - btnAt) / 0.05))) * 8);
  const addedOp = fade(mv, btnAt + 0.1, btnAt + 0.16, 1.05, 1.12);
  const webAt = 0.55;
  const webOp = inRange(mv, webAt, webAt + 0.04);

  return (
    <motion.div style={{ opacity: op, y }} className="hidden w-[228px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line/70 bg-p-chip lg:flex">
      <div
        className="gs-detail-grad relative flex h-16 shrink-0 items-end p-2.5"
        style={{ '--gs-detail-hue': lead.tint }}
      >
        <Avatar img={lead.img} initials={initials(lead.contact)} tint={lead.tint} size={30} online />
        <span className="absolute right-2 top-2 rounded-full border border-primary/30 bg-p-panel/70 px-1.5 py-[2px] text-[7px] font-bold text-primary">
          Top match
        </span>
      </div>
      <div className="flex flex-col gap-[7px] px-3 py-2.5">
        <div className="flex items-center gap-1">
          <span className="truncate text-[10px] font-bold text-p-title">{lead.brand}</span>
          <BadgeCheck size={11} className="text-primary" strokeWidth={2.4} />
        </div>
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone="primary" pill>{lead.cat}</StatusBadge>
          <StatusBadge tone="muted" pill>98% match</StatusBadge>
        </div>
        <div className="mt-[2px] flex flex-col gap-[6px] text-[8px] font-medium text-p-mut">
          <span className="flex items-center gap-1.5"><MapPin size={9} className="shrink-0 text-p-faint" />{lead.loc}</span>
          <span className="flex items-center gap-1.5"><UserPlus size={9} className="shrink-0 text-p-faint" />{lead.contact} · Founder</span>
          <motion.span style={{ opacity: webOp }} className="flex items-center gap-1.5"><Phone size={9} className="shrink-0 text-p-faint" />{lead.phone}</motion.span>
          <motion.span style={{ opacity: webOp }} className="flex items-center gap-1.5"><Globe size={9} className="shrink-0 text-p-faint" />{lead.web}</motion.span>
        </div>
        <div className="relative mt-auto pt-1">
          <motion.div style={{ opacity: addedOp }} className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/20 px-2 py-[7px] text-[8.5px] font-bold text-primary">
            <Check size={10} strokeWidth={3} /> Added to Leads
          </motion.div>
          <motion.button style={{ opacity: btnOp, y: btnY }} className="w-full rounded-lg bg-primary px-2 py-[7px] text-center text-[8.5px] font-extrabold text-[#07130f]">
            Add to Leads
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function FloatingCounter({ mv }) {
  const op = fade(mv, 0.5, 0.56, 1.02, 1.08);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.5) / 0.06))) * 10);
  return (
    <motion.div style={{ opacity: op, y }} className="absolute bottom-[2.6rem] left-1/2 z-30 hidden -translate-x-1/2 items-center gap-1.5 rounded-full border border-primary/25 bg-p-panel/95 px-3 py-1 shadow-p-float sm:flex">
      <Users size={10} className="text-primary" strokeWidth={2.2} />
      <CountUp mv={mv} a={0.5} b={0.68} to={DEMO.found} className="text-[9px] font-extrabold text-primary" />
      <span className="text-[9px] font-semibold text-p-sub">business leads found</span>
    </motion.div>
  );
}

export default function DiscoverScene({ mv }) {
  const bodyOp = inRange(mv, 0.06, 0.14);
  const bodyY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.06) / 0.08))) * 9);
  const sideOp = inRange(mv, 0.14, 0.22);
  const midOp = inRange(mv, 0.1, 0.18);
  const pillAt = 0.22;
  const pillY = useTransform(mv, (v) => {
    const k = Math.floor(v / 0.05);
    const a = clamp01((v - pillAt - k * 0.05) / 0.04);
    const b = clamp01((v - pillAt - k * 0.05 - 0.04) / 0.4);
    return (1 - easeOut(a)) * (1 - b) * -6;
  });

  return (
    <div className="relative flex h-full min-h-0 flex-col" data-testid="discover-panel">
      <SceneHeader n={1} icon={Radar} title="Find Business Leads" sub="Discover vetted contacts across your niche" pill="Lead Discovery" pillIcon={Radar} iconTone="text-primary" />
      <motion.div style={{ opacity: bodyOp, y: bodyY }} className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <motion.aside style={{ opacity: sideOp }} className="hidden w-[148px] shrink-0 flex-col gap-0.5 border-r border-line/70 px-2 py-2 md:flex">
          <div className="flex flex-col gap-[3px]">
            {NAV.map(({ icon: Icon, label }, i) => (
              <span key={label} className={cn('flex items-center gap-2 rounded-lg px-1.5 py-[5px] text-[8px] font-semibold', i === 0 ? 'bg-primary/12 text-primary' : 'text-p-mut')}>
                <Icon size={11} strokeWidth={2} />{label}
              </span>
            ))}
          </div>
          <p className="mt-1.5 px-1.5 pb-[3px] text-[7px] font-bold tracking-wide text-p-faint">SOURCES</p>
          <div className="flex flex-col">
            {SOURCES.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2 rounded-lg px-1.5 py-[4px] text-[7.5px] font-medium text-p-mut">
                <Icon size={9} className="text-p-faint" />{label}
              </span>
            ))}
          </div>
          <div className="mt-1.5 rounded-xl border border-line/70 bg-p-chip px-2 py-1.5">
            <p className="text-[7px] font-bold tracking-wide text-p-faint">ACTIVE LISTS</p>
            <p className="truncate pt-[3px] text-[8px] font-semibold text-p-sub">EU &amp; North America Prospecting</p>
            <CountUp mv={mv} a={0.3} b={0.5} to={DEMO.found} className="text-[9px] font-extrabold text-primary" />
            <p className="text-[7px] text-p-faint">contacts seeded</p>
          </div>
        </motion.aside>

        {/* Middle: search + filters + list */}
        <motion.div style={{ opacity: midOp }} className="relative flex min-w-0 flex-1 flex-col gap-[6px] px-2 pt-2 sm:px-3 lg:pb-9">
          <div className="flex items-center gap-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line bg-p-chip px-2 py-[6px]">
              <Search size={10} className="shrink-0 text-p-faint" />
              <span className="truncate text-[8.5px] font-medium text-p-mut">Search business directories…</span>
              <motion.span className="ml-auto pr-[2px] text-[7px] text-p-faint"><Filter size={8} /></motion.span>
            </div>
            <button className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-[6px] text-[8.5px] font-extrabold text-[#07130f]">
              <Search size={9} strokeWidth={2.6} />Search
            </button>
          </div>

          <div className="flex items-center gap-1 overflow-hidden">
            {FILTERS.map((f, i) => (
              <motion.span key={f} style={{ y: pillY }} className={cn('shrink-0 rounded-full border px-2 py-[3px] text-[7.5px] font-semibold', i === 0 ? 'border-primary/40 bg-primary/15 text-primary' : 'border-line bg-p-chip text-p-mut')}>
                {f}
              </motion.span>
            ))}
            <span className="ml-auto flex shrink-0 items-center gap-0.5 px-1 text-[7.5px] font-medium text-p-mut">
              <ChevronDown size={8} className="text-primary" />
              More
            </span>
          </div>

          <div className="flex items-center justify-between px-0.5 pb-[2px]">
            <span className="flex items-center gap-1 text-[7.5px] font-semibold text-p-mut">
              <span className="relative flex h-[6px] w-[6px]"><motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="absolute inset-0 rounded-full bg-primary" /></span>
              <CountUp mv={mv} a={0.16} b={0.34} to={DEMO.found} className="font-extrabold text-p-body" />
              {' '}business leads found · auto-deduplicated
            </span>
            <span className="hidden items-center gap-1 text-p-faint sm:flex"><Caret />smart search</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            {LEADS.map((lead, i) => (
              <LeadRow key={lead.brand} lead={lead} i={i} mv={mv} />
            ))}
          </div>
          <FloatingCounter mv={mv} />
        </motion.div>

        {/* Right: detail */}
        <DetailPanel mv={mv} />
      </motion.div>

      <FooterStrip
        mv={mv}
        left={<><Check size={9} className="text-primary" />Searching 14 directories · {DEMO.found.toLocaleString('en-US')} matches</>}
        right={<><Zap size={9} />Next: Verify numbers</>}
      />
    </div>
  );
}