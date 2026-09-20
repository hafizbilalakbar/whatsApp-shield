import React from 'react';
import { motion, useTransform } from 'framer-motion';
import {
  ClipboardList, Trophy, CalendarClock, MessageCircle, Check, CheckCircle2,
  TrendingUp, Zap, ArrowRight, FolderKanban,
} from 'lucide-react';
import { cn } from '../../ui/cn';
import {
  SceneHeader, FooterStrip, Avatar,
  clamp01, easeOut, inRange, fade,
} from './shared';
import DEMO from './demoData';

const tintOf = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

const STAGES = DEMO.stages;
const COLUMNS = DEMO.kanban.columns.map((col) => ({
  id: col.id,
  label: col.label,
  count: col.count,
  dot: col.dot,
  cards: col.cards.map((c) => ({
    brand: c.card.company.brand,
    person: c.card.company.person.name,
    img: c.card.company.person.img,
    meta: c.meta,
    prio: c.prio,
    note: c.note,
    tint: tintOf(c.card.company.brand),
    at: c.at,
  })),
}));
const LEAD_TEST_ID = COLUMNS.find((c) => c.id === 'opp').cards[0].brand;

const FEED_ICONS = [Trophy, CalendarClock, MessageCircle];
const FEED = DEMO.activity.map((a, i) => ({ icon: FEED_ICONS[i], title: a.title, desc: a.desc, time: a.time }));

const initials = (name) => name.split(' ').map((w) => w[0]).join('');

function StageRow({ stage, i, mv }) {
  const win = [0.18, 0.4, 0.62];
  const a = win[Math.min(2, Math.max(0, i - 2))];
  const b = a + 0.24;
  const act = useTransform(mv, (v) => {
    if (i < 2 || i > 4) {
      const x = clamp01((v - 0.12) / 0.06);
      const y = clamp01((v - 0.28) / 0.5);
      return Math.max(0, easeOut(x) - easeOut(y) * 0.4);
    }
    const x = clamp01((v - a) / 0.03);
    const y = clamp01((v - b) / 0.06);
    return Math.max(0, easeOut(x) - easeOut(y));
  });
  return (
    <motion.div style={{ opacity: act }} className="flex items-center justify-between rounded-lg border border-line/60 bg-p-chip px-2 py-[5px]">
      <span className="flex items-center gap-1.5 text-[7.5px] font-bold">
        <span className={cn('rounded-full bg-p-chip-strong px-1.5 py-[1px] text-[6.5px] text-p-mut')}>{i + 1}</span>
        <span className={cn(i >= 2 && i <= 4 ? 'text-primary' : 'text-p-sub')}>{stage.label}</span>
      </span>
      <span className="rounded-md bg-primary/15 px-1 py-[1px] text-[7px] font-extrabold text-primary">{stage.n}</span>
    </motion.div>
  );
}

function KanbanCard({ card, mv }) {
  const op = inRange(mv, card.at, card.at + 0.05);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - card.at) / 0.05))) * 8);
  return (
    <motion.div style={{ opacity: op, y }} data-testid={card.brand === LEAD_TEST_ID ? 'lead-card' : undefined} className="min-w-0 rounded-lg border border-line/70 bg-p-chip px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1">
        <Avatar img={card.img} initials={initials(card.person)} tint={card.tint} size={12} />
        <span className="min-w-0 truncate text-[8px] font-bold text-p-body">{card.person}</span>
      </div>
      <p className="truncate pt-[1px] pl-[17px] text-[6.5px] text-p-mut">{card.brand} · {card.meta}</p>
      <div className="mt-[5px] flex min-w-0 items-center justify-between gap-1">
        <span className={cn('shrink-0 rounded-full border px-1 py-[1px] text-[6px] font-bold', card.prio === 'High' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-line bg-p-chip-strong text-p-mut')}>{card.prio}</span>
        <span className="min-w-0 truncate text-[6px] font-medium text-p-faint">{card.note}</span>
      </div>
    </motion.div>
  );
}

function Chart({ mv }) {
  const op = inRange(mv, 0.68, 0.76);
  const pl = inRange(mv, 0.68, 0.92);
  const bump = useTransform(mv, (v) => {
    const a = clamp01((v - 0.9) / 0.06);
    const b = clamp01((v - 0.96) / 0.4);
    return 1 - 0.14 * a * (1 - b);
  });
  const d = 'M4 34 L26 27 L48 30 L70 20 L92 23 L114 12 L138 6';
  return (
    <motion.div style={{ opacity: op }} className="flex shrink-0 items-end gap-2 rounded-xl border border-line/70 bg-p-chip px-2.5 py-1.5">
      <svg width="96" height="38" viewBox="0 0 142 40" className="overflow-visible">
        <motion.path d={d} fill="none" stroke="var(--primary, #1ed9a8)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: pl }} />
        <circle cx="138" cy="6" r="2.5" fill="var(--primary, #1ed9a8)" className="opacity-70" />
      </svg>
      <div className="flex flex-col items-start pb-[2px]">
        <p className="text-[6.5px] font-semibold text-p-mut">Conversion rate</p>
        <motion.p style={{ scale: bump }} className="text-[12px] font-extrabold leading-none text-primary">{DEMO.conv}% <span className="text-[7px]">&#8593;</span></motion.p>
      </div>
    </motion.div>
  );
}

function TrophyBadge({ mv }) {
  const op = fade(mv, 0.5, 0.56, 1.06, 1.14);
  const y = useTransform(mv, (v) => {
    const a = clamp01((v - 0.56) / 0.5);
    return -Math.abs(Math.sin(a * Math.PI * 4)) * 8 * (1 - a);
  });
  const glow = useTransform(mv, (v) => {
    const a = clamp01((v - 0.56) / 0.5);
    return 0.5 + 0.5 * (1 - a);
  });
  return (
    <motion.div style={{ opacity: op, y, }} className="absolute bottom-[2.3rem] left-1/2 z-30 hidden -translate-x-1/2 items-center gap-1.5 rounded-full border border-primary/40 bg-p-panel/95 py-1 pl-1.5 pr-3 shadow-p-float sm:flex">
      <motion.span style={{ opacity: glow }} className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[#07130f]">
        <Trophy size={11} strokeWidth={2.5} />
      </motion.span>
      <span className="text-[8.5px] font-extrabold text-p-title">Sales opportunity created</span>
    </motion.div>
  );
}

export default function ConvertScene({ mv }) {
  const bodyOp = inRange(mv, 0.06, 0.14);
  const bodyY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.06) / 0.08))) * 9);
  const sideOp = inRange(mv, 0.12, 0.2);
  const kanOp = inRange(mv, 0.14, 0.22);
  const feedOp = inRange(mv, 0.2, 0.28);
  const kickOp = inRange(mv, 0.66, 0.74);
  const kickY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.66) / 0.08))) * 8);

  return (
    <div className="relative flex h-full min-h-0 flex-col" data-testid="crm-panel">
      <SceneHeader n={4} icon={ClipboardList} title="Manage Leads & Grow Revenue" sub="Kanban pipeline, follow-ups and conversion analytics" pill="CRM & Follow-up" pillIcon={FolderKanban} iconTone="text-primary" />
      <motion.div style={{ opacity: bodyOp, y: bodyY }} className="flex min-h-0 flex-1">
        {/* Stage list */}
        <motion.aside style={{ opacity: sideOp }} className="hidden w-[126px] shrink-0 flex-col gap-1 border-r border-line/70 px-2 py-2 md:flex">
          <p className="px-1 pb-[2px] text-[7.5px] font-bold tracking-wide text-p-mut">PIPELINE</p>
          {STAGES.map((s, i) => <StageRow key={s.label} stage={s} i={i} mv={mv} />)}
          <div className="mt-auto flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.07] px-2 py-1.5">
            <Zap size={10} className="text-primary" />
            <span className="text-[7px] font-bold text-p-sub">Auto follow-ups: ON</span>
          </div>
        </motion.aside>

        {/* Kanban */}
        <motion.div style={{ opacity: kanOp }} className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between px-2.5 pt-2">
            <span className="text-[7.5px] font-bold tracking-wide text-p-mut">KANBAN PIPELINE</span>
            <span className="flex items-center gap-1 text-[7px] font-semibold text-p-mut">
              <CheckCircle2 size={9} className="text-primary" />
              This week: 1 won · 3 active
            </span>
          </div>
          <div className="flex min-h-0 w-full flex-1 gap-1.5 px-2 py-2 sm:px-3">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 rounded-xl border border-line/50 bg-p-chip p-1.5 pb-2">
                <div className="flex items-center gap-1.5 px-0.5 pb-1">
                  <span className={cn('h-1.5 w-1.5 rounded-full', col.dot)} />
                  <span className="truncate text-[7.5px] font-bold text-p-sub">{col.label}</span>
                  <span className="ml-auto rounded-md bg-p-chip-strong px-1 py-[1px] text-[6.5px] font-extrabold text-p-mut">{col.count}</span>
                </div>
                {col.cards.map((card) => <KanbanCard key={card.brand} card={card} mv={mv} />)}
              </div>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 px-2.5 pb-1.5">
            <span className="hidden items-center gap-1 text-[7px] font-medium text-p-faint sm:flex">
              <ArrowRight size={8} className="text-primary" />
              Drag cards between stages to update your pipeline
            </span>
            <Chart mv={mv} />
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.aside style={{ opacity: feedOp }} className="hidden w-[170px] shrink-0 flex-col gap-1.5 border-l border-line/70 px-2 py-2 xl:flex">
          <p className="px-1 pb-[2px] text-[7.5px] font-bold tracking-wide text-p-mut">ACTIVITY</p>
          {FEED.map(({ icon: Icon, title, desc, time }, i) => {
            const at = 0.2 + i * 0.05;
            const itemOp = inRange(mv, at, at + 0.04);
            const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - at) / 0.04))) * 8);
            return (
              <motion.div key={title} style={{ opacity: itemOp, y }} className="rounded-lg border border-line/60 bg-p-chip px-2 py-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1 text-[7.5px] font-bold text-p-sub">
                    <Icon size={9} className="shrink-0 text-primary" />
                    {title}
                  </span>
                  <span className="shrink-0 text-[6px] text-p-faint">{time}</span>
                </div>
                <p className="truncate pt-[2px] text-[6.5px] text-p-mut">{desc}</p>
              </motion.div>
            );
          })}
          <motion.div style={{ opacity: kickOp, y: kickY }} className="mt-auto flex flex-col items-center gap-1 rounded-xl border border-primary/30 bg-primary/[0.08] py-2 text-center">
            <TrendingUp size={14} className="text-primary" />
            <p className="px-2 text-[7px] font-bold text-p-sub">Next: proposal review</p>
          </motion.div>
        </motion.aside>
      </motion.div>

      <TrophyBadge mv={mv} />

      <FooterStrip
        mv={mv}
        left={<><Trophy size={9} className="text-primary" />{DEMO.found.toLocaleString('en-US')} leads · {DEMO.score}% qualified</>}
        right={<><Check size={9} />Next: watch your pipeline grow</>}
      />
    </div>
  );
}