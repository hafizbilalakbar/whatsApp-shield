import React from 'react';
import { motion, useTransform } from 'framer-motion';
import {
  ShieldCheck, Inbox, Layers, RefreshCw, CheckCircle2, Check, Users,
  BadgeCheck, Wifi, X, AlertCircle, MoreVertical, MapPin,
} from 'lucide-react';
import { cn } from '../../ui/cn';
import {
  Avatar, StatusBadge, SceneHeader, CountUp, FooterStrip,
  clamp01, easeOut, inRange, fade,
} from './shared';

const CHECKLIST = [
  { icon: Inbox, label: 'Import contacts', sub: '1,240 phone numbers', at: 0.08, last: false },
  { icon: Layers, label: 'Normalize numbers', sub: 'Country codes added', at: 0.14, last: false },
  { icon: ShieldCheck, label: 'Check WhatsApp', sub: 'Lookup in progress', at: 0.2, last: false },
  { icon: RefreshCw, label: 'Remove duplicates', sub: '12 removed', at: 0.26, last: false },
  { icon: CheckCircle2, label: 'Ready to message', sub: 'All systems go', at: 0.32, last: true },
];

const STATS = [
  { icon: Users, label: 'Total contacts', to: 1240, at: 0.42 },
  { icon: BadgeCheck, label: 'Verified', to: 892, at: 0.48 },
  { icon: RefreshCw, label: 'Duplicates removed', to: 12, at: 0.54 },
];

const RESULTS = [
  { name: 'Rafael Ortega', loc: 'Madrid', phone: '+34 612 345 678', status: 'ready', tint: 200, at: 0.34 },
  { name: 'Amara Diop', loc: 'Dakar', phone: '+221 77 123 45 67', status: 'ready', tint: 15, at: 0.4 },
  { name: 'Sophie Laurent', loc: 'Lyon', phone: '+33 6 12 34 56 78', status: 'dup', tint: 265, at: 0.46 },
  { name: 'Jonas Lindqvist', loc: 'Stockholm', phone: '+46 70 123 45 67', status: 'invalid', tint: 190, at: 0.52 },
];

const STATUS = {
  ready: { icon: Wifi, cls: 'border-primary/30 bg-success/10 text-primary', label: 'WhatsApp Ready' },
  dup: { icon: X, cls: 'border-red-500/25 bg-red-500/10 text-red-400', label: 'Duplicate Removed' },
  invalid: { icon: AlertCircle, cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', label: 'Invalid Number' },
};

const initials = (name) => name.split(' ').map((w) => w[0]).join('');

function Ring({ mv, size = 80 }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const pct = useTransform(mv, (v) => easeOut(clamp01((v - 0.18) / 0.34)) * 68);
  const off = useTransform(pct, (v) => c * (1 - v / 100));
  const [num, setNum] = React.useState(0);
  React.useEffect(() => pct.on('change', (v) => setNum(Math.round(v))), [pct]);
  const w = size;
  return (
    <div className="relative shrink-0" style={{ width: w, height: w }}>
      <svg width={w} height={w} viewBox={`0 0 ${w} ${w}`}>
        <circle cx={w / 2} cy={w / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <motion.circle
          cx={w / 2} cy={w / 2} r={r} fill="none"
          stroke="var(--primary, #1ed9a8)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} style={{ strokeDashoffset: off, rotate: -90, transformOrigin: '50% 50%' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="text-[13px] font-extrabold text-white/90">{num}%</motion.span>
        <span className="text-[6px] font-semibold tracking-wide text-primary">VERIFIED</span>
      </div>
    </div>
  );
}

function CheckItem({ icon: Icon, label, sub, at, last, mv }) {
  const op = inRange(mv, at, at + 0.05);
  const x = useTransform(mv, (v) => (1 - easeOut(clamp01((v - at) / 0.05))) * 8);
  const tickOp = fade(mv, at + 0.05, at + 0.12, 0.8, 1.02);
  const tickSc = useTransform(mv, (v) => {
    const a = clamp01((v - at - 0.05) / 0.07);
    const b = clamp01((v - at - 0.12) / 0.5);
    return 0.3 + 0.7 * a * (1 - b);
  });
  return (
    <motion.div style={{ opacity: op, x }} className={cn('flex items-center gap-2 rounded-lg border px-2 py-1.5', last ? 'border-primary/30 bg-primary/[0.07]' : 'border-line/70 bg-white/[0.025]')}>
      <span className={cn('flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border', last ? 'border-primary/60 bg-primary' : 'border-line bg-white/[0.04]')}>
        <motion.span style={{ opacity: tickOp, scale: tickSc }} className="text-[#07130f]">
          <Check size={8} strokeWidth={3.5} />
        </motion.span>
      </span>
      <Icon size={11} className={cn('shrink-0', last ? 'text-primary' : 'text-white/35')} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[8.5px] font-bold text-white/85">{label}</p>
        <p className="truncate text-[7px] font-medium text-white/40">{sub}</p>
      </div>
    </motion.div>
  );
}

function StatusPill({ status, at, mv }) {
  const cfg = STATUS[status];
  const Icon = cfg.icon;
  const op = inRange(mv, at, at + 0.04);
  const pulse = useTransform(mv, (v) => {
    const a = clamp01((v - at - 0.04) / 0.08);
    const b = clamp01((v - at - 0.12) / 0.5);
    return 1 + 0.09 * a * (1 - b);
  });
  return (
    <motion.span style={{ opacity: op, scale: pulse }} className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-[3px] text-[7px] font-bold leading-none whitespace-nowrap', cfg.cls)}>
      <Icon size={8} strokeWidth={2.5} />
      {cfg.label}
    </motion.span>
  );
}

function ResultRow({ row }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line/60 bg-white/[0.02] px-2 py-[6px]">
      <Avatar initials={initials(row.name)} tint={row.tint} size={22} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[8.5px] font-bold text-white/85">{row.name}</p>
        <p className="truncate text-[7px] font-medium text-white/40">{row.phone} · {row.loc}</p>
      </div>
      <StatusPill status={row.status} at={row.at} mv={row._mv} />
      <MoreVertical size={10} className="shrink-0 text-white/25" />
    </div>
  );
}

function ResultsPanel({ mv, className }) {
  return (
    <div className={cn('flex flex-col gap-1 px-1', className)}>
      <div className="flex items-center justify-between px-1 pb-[2px]">
        <span className="text-[7.5px] font-bold tracking-wide text-white/40">VERIFICATION RESULTS</span>
        <span className="flex items-center gap-1 text-[7.5px] font-semibold text-primary">
          <CountUp mv={mv} a={0.52} b={0.68} to={892} /> verified
        </span>
      </div>
      {RESULTS.map((row) => (
        <ResultRow key={row.name} row={{ ...row, _mv: mv }} />
      ))}
    </div>
  );
}

export default function VerifyScene({ mv }) {
  const bodyOp = inRange(mv, 0.06, 0.14);
  const bodyY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.06) / 0.08))) * 9);
  const leftOp = inRange(mv, 0.12, 0.2);
  const rightOp = inRange(mv, 0.18, 0.26);
  const ringCardOp = inRange(mv, 0.16, 0.24);
  const ringLabelOp = inRange(mv, 0.3, 0.38);
  const barW = useTransform(mv, (v) => `${Math.round(easeOut(clamp01((v - 0.18) / 0.34)) * 100)}%`);

  return (
    <div className="relative flex h-full min-h-0 flex-col" data-testid="verify-panel">
      <SceneHeader n={2} icon={ShieldCheck} title="Verify WhatsApp Contacts" sub="Check every number before outreach" pill="Contact Verification" pillIcon={ShieldCheck} iconTone="text-primary" />
      <motion.div style={{ opacity: bodyOp, y: bodyY }} className="flex min-h-0 flex-1">
        {/* Checklist rail */}
        <motion.aside style={{ opacity: leftOp }} className="hidden w-[200px] shrink-0 flex-col gap-1.5 border-r border-line/70 px-2 py-2 md:flex">
          <p className="px-1 pb-[2px] text-[7.5px] font-bold tracking-wide text-white/40">VERIFY</p>
          {CHECKLIST.map((item) => (
            <CheckItem key={item.label} {...item} mv={mv} />
          ))}
        </motion.aside>

        {/* Center: ring + stats + mobile checklist */}
        <motion.div style={{ opacity: ringCardOp }} className="flex min-w-0 flex-1 flex-col gap-[6px] px-2 pt-2 sm:px-3">
          <div className="flex items-center gap-3 rounded-xl border border-line/70 bg-white/[0.02] px-2.5 py-2 sm:gap-4 sm:py-2.5">
            <Ring mv={mv} size={78} />
            <div className="min-w-0 flex-1">
              <motion.p style={{ opacity: ringLabelOp }} className="text-[9.5px] font-bold text-white/90">
                Checking WhatsApp availability…
              </motion.p>
              <motion.p style={{ opacity: ringLabelOp }} className="mt-[2px] text-[7.5px] font-medium text-white/45">
                Phone numbers are matched against active WhatsApp accounts. 68% verified so far.
              </motion.p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div style={{ width: barW }} className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {STATS.map(({ icon: Icon, label, to, at }) => (
              <motion.div key={label} style={{ opacity: inRange(mv, at, at + 0.05) }} className="rounded-lg border border-line/70 bg-white/[0.02] px-2 py-[7px]">
                <div className="flex items-center gap-1 text-white/40">
                  <Icon size={9} className="text-primary/70" />
                  <span className="truncate text-[6.5px] font-semibold uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-[3px] text-[11px] font-extrabold text-white/90">
                  <CountUp mv={mv} a={at} b={at + 0.1} to={to} />
                </p>
              </motion.div>
            ))}
          </div>

          {/* Results — mobile/tablet shown inline, desktop uses the right column */}
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden pb-1 lg:hidden">
            <ResultsPanel mv={mv} />
          </div>
        </motion.div>

        {/* Desktop results column */}
        <motion.aside style={{ opacity: rightOp }} className="hidden w-[228px] shrink-0 flex-col gap-1 border-l border-line/70 px-2 py-2 lg:flex">
          <ResultsPanel mv={mv} className="flex-1" />
        </motion.aside>
      </motion.div>

      <FooterStrip
        mv={mv}
        left={<><BadgeCheck size={9} className="text-primary" />892 verified · 12 duplicates removed</>}
        right={<><MapPin size={9} />Coverage: 6 countries</>}
      />
    </div>
  );
}