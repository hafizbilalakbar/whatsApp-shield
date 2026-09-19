import React from 'react';
import { motion, useTransform } from 'framer-motion';
import {
  Bot, MessageCircle, Users, FolderKanban, ClipboardList, Zap, Settings,
  Search, CheckCheck, Send, Phone, Video, MoreVertical, CalendarClock,
  Sparkles, Check,
} from 'lucide-react';
import { cn } from '../../ui/cn';
import {
  Avatar, StatusBadge, SceneHeader, FooterStrip,
  clamp01, easeOut, inRange, fade,
} from './shared';

const NAV3 = [
  { icon: MessageCircle, label: 'Chats' },
  { icon: Users, label: 'Contacts' },
  { icon: FolderKanban, label: 'Leads' },
  { icon: ClipboardList, label: 'CRM' },
  { icon: Zap, label: 'Automation' },
  { icon: Settings, label: 'Settings' },
];

const CHATS = [
  { name: 'Mara Bertolini', meta: 'Interior Design · IT', tint: 265, when: '10:06', last: 'Sent a catalog - ready?', active: true },
  { name: 'Kemi Adegoke', meta: 'Logistics · NG', tint: 15, when: '09:44', last: 'Pricing request received', active: false },
  { name: 'Diego Fuentes', meta: 'Retail · ES', tint: 200, when: '09:12', last: 'Asked about bulk orders', active: false },
];

const MSGS = [
  { from: 'mara', text: 'Hi! We are renovating our showroom and need custom lighting quotes.', t: '10:02', at: 0.1 },
  { from: 'ai', text: 'Great to meet you, Mara. I will connect you with our specialists and send the catalog.', t: '10:03', at: 0.18, tags: ['Product Catalog', 'Showroom'] },
  { from: 'mara', text: 'Perfect - we need 40 units by next month.', t: '10:04', at: 0.3 },
  { from: 'ai', text: 'Sent: catalog with bulk pricing (40 pcs). Want a walkthrough call?', t: '10:05', at: 0.42 },
  { from: 'ai', text: 'Walkthrough locked for Fri 14:00.', t: '10:06', at: 0.76, sent: true },
];

const initials = (name) => name.split(' ').map((w) => w[0]).join('');

function Bubble({ from, text, t, at, tags, sent, mv }) {
  const op = inRange(mv, at, at + 0.05);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - at) / 0.05))) * 8);
  const isAI = from === 'ai';
  return (
    <motion.div style={{ opacity: op, y }} className={cn('flex items-end gap-1', isAI ? 'justify-start' : 'justify-end')}>
      {isAI && <Avatar initials="AI" tint={160} size={13} className="mb-[2px]" />}
      <div className={cn('max-w-[78%] rounded-2xl border px-2 py-1 text-[8px] leading-relaxed', isAI ? 'rounded-bl-sm border-primary/25 bg-primary/[0.1] text-white/85' : 'rounded-br-sm border-line bg-white/[0.06] text-white/85')}>
        {tags && (
          <div className="mb-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full border border-primary/30 bg-primary/10 px-1 py-[1px] text-[6.5px] font-bold text-primary">{tag}</span>
            ))}
          </div>
        )}
        <span className="whitespace-pre-line">{text}</span>
        <span className="mt-[3px] flex items-center justify-end gap-1 text-[6.5px] text-white/35">
          {t}
          {sent && <CheckCheck size={8} className="text-primary" strokeWidth={2.5} />}
        </span>
      </div>
    </motion.div>
  );
}

function Typing({ mv, at }) {
  const op = fade(mv, at, at + 0.04, at + 0.6, at + 0.66);
  return (
    <motion.div style={{ opacity: op }} className="flex items-end gap-1">
      <Avatar initials="AI" tint={160} size={13} className="mb-[2px]" />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-primary/25 bg-primary/[0.1] px-2 py-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-[4px] w-[4px] rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
        ))}
        <span className="ml-1 text-[6.5px] text-white/45">Mara Bertolini is typing...</span>
      </div>
    </motion.div>
  );
}

function ChatRow({ c }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg px-1.5 py-[5px]', c.active ? 'bg-primary/[0.09]' : '')}>
      <Avatar initials={initials(c.name)} tint={c.tint} size={22} online={c.active} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[8.5px] font-bold text-white/85">{c.name}</span>
          <span className="shrink-0 text-[6.5px] text-white/35">{c.when}</span>
        </div>
        <p className="truncate text-[7px] font-medium text-white/40">{c.meta} · {c.last}</p>
      </div>
    </div>
  );
}

function QualStep({ label, at, mv }) {
  const op = inRange(mv, at, at + 0.05);
  const tickOp = fade(mv, at + 0.04, at + 0.1, 0.9, 1.05);
  return (
    <motion.div style={{ opacity: op }} className="flex items-center gap-1.5">
      <span className="flex h-[12px] w-[12px] shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/15">
        <motion.span style={{ opacity: tickOp }} className="text-primary"><Check size={7} strokeWidth={3.5} /></motion.span>
      </span>
      <span className="truncate text-[7.5px] font-semibold text-white/70">{label}</span>
    </motion.div>
  );
}

function QualPanel({ mv }) {
  const op = inRange(mv, 0.44, 0.52);
  const y = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.44) / 0.08))) * 10);
  const barW = useTransform(mv, (v) => `${Math.round(easeOut(clamp01((v - 0.46) / 0.26)) * 86)}%`);
  const pctOp = inRange(mv, 0.52, 0.58);
  const steps = [
    { label: 'Asked about services', at: 0.58 },
    { label: 'Shared requirements', at: 0.64 },
    { label: 'Ready for proposal', at: 0.7 },
  ];
  const btnAt = 0.78;
  const btnOp = inRange(mv, btnAt, btnAt + 0.05);
  const doneOp = fade(mv, btnAt + 0.08, btnAt + 0.14, 1.05, 1.1);
  return (
    <motion.div style={{ opacity: op, y }} className="hidden w-[206px] shrink-0 flex-col gap-2 border-l border-line/70 px-2 py-2 xl:flex">
      <div className="rounded-xl border border-line/70 bg-white/[0.02] p-2">
        <div className="flex items-center gap-2">
          <Avatar initials="MB" tint={265} size={22} online />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[8.5px] font-bold text-white/90">Mara Bertolini</p>
            <p className="truncate text-[7px] text-white/40">Interior Design · IT</p>
          </div>
          <StatusBadge tone="primary">96% match</StatusBadge>
        </div>
      </div>

      <div className="rounded-xl border border-line/70 bg-white/[0.02] p-2">
        <div className="flex items-center justify-between">
          <p className="text-[7.5px] font-bold tracking-wide text-white/45">LEAD QUALIFICATION</p>
          <motion.span style={{ opacity: pctOp }} className="text-[9px] font-extrabold text-primary">86%</motion.span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div style={{ width: barW }} className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400" />
        </div>
        <div className="mt-2 flex flex-col gap-[5px]">
          {steps.map((s) => (
            <QualStep key={s.label} {...s} mv={mv} />
          ))}
        </div>
        <div className="relative mt-2">
          <motion.div style={{ opacity: doneOp }} className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/20 px-2 py-[6px] text-[8px] font-extrabold text-primary">
            <Check size={9} strokeWidth={3} /> Lead Qualified
          </motion.div>
          <motion.button style={{ opacity: btnOp }} className="w-full rounded-lg bg-primary px-2 py-[6px] text-center text-[8px] font-extrabold text-[#07130f]">
            Lead Qualified
          </motion.button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-1 text-[7px] font-medium text-white/35">
        <Sparkles size={9} className="text-primary" />
        Auto-synced to CRM pipeline
      </div>
    </motion.div>
  );
}

export default function EngageScene({ mv }) {
  const bodyOp = inRange(mv, 0.06, 0.14);
  const bodyY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - 0.06) / 0.08))) * 9);
  const listOp = inRange(mv, 0.12, 0.2);
  const railOp = inRange(mv, 0.1, 0.18);
  const chatOp = inRange(mv, 0.08, 0.16);
  const typingAt = 0.5;
  const composerAt = 0.68;
  const composerOp = inRange(mv, composerAt, composerAt + 0.05);
  const followAt = 0.72;
  const followOp = inRange(mv, followAt, followAt + 0.05);
  const followY = useTransform(mv, (v) => (1 - easeOut(clamp01((v - followAt) / 0.05))) * 8);

  return (
    <div className="relative flex h-full min-h-0 flex-col" data-testid="engage-panel">
      <SceneHeader n={3} icon={Bot} title="Start WhatsApp Conversations" sub="AI first-touch outreach that sounds human" pill="Message Agent" pillIcon={Bot} iconTone="text-primary" />
      <motion.div style={{ opacity: bodyOp, y: bodyY }} className="flex min-h-0 flex-1">
        {/* Nav rail */}
        <motion.aside style={{ opacity: railOp }} className="hidden w-11 shrink-0 flex-col items-center gap-1 border-r border-line/70 px-1 py-2 lg:flex">
          {NAV3.map(({ icon: Icon, label }, i) => (
            <span key={label} className={cn('flex w-9 flex-col items-center gap-[1px] rounded-lg py-1 text-white/35', i === 0 && 'bg-primary/10 text-primary')}>
              <Icon size={12} strokeWidth={2} />
              <span className="text-[5.5px] font-semibold">{label.slice(0, 5)}</span>
            </span>
          ))}
        </motion.aside>

        {/* Conversation list */}
        <motion.div style={{ opacity: listOp }} className="hidden w-[176px] shrink-0 flex-col gap-1 border-r border-line/70 px-2 py-2 md:flex">
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.035] px-2 py-[5px]">
            <Search size={9} className="text-white/35" />
            <span className="text-[7.5px] font-medium text-white/40">Search...</span>
          </div>
          <div className="mt-[2px] flex flex-col">
            {CHATS.map((c) => <ChatRow key={c.name} c={c} />)}
          </div>
          <div className="mt-auto flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/[0.09] px-2 py-1.5">
            <Avatar initials="AI" tint={160} size={15} />
            <div className="min-w-0">
              <p className="truncate text-[7.5px] font-bold text-primary">New conversation</p>
              <p className="truncate text-[6.5px] font-medium text-white/40">AI Agent is responding...</p>
            </div>
          </div>
        </motion.div>

        {/* Chat window */}
        <motion.div style={{ opacity: chatOp }} className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-line/70 px-2.5 py-1.5">
            <Avatar initials="MB" tint={265} size={22} online />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-[9px] font-bold text-white/90">Mara Bertolini <span className="rounded-full bg-primary/15 px-1.5 py-[1px] text-[6.5px] font-bold text-primary">LEAD</span></p>
              <p className="truncate text-[7px] text-white/40">Interior Design · Italy · online</p>
            </div>
            <div className="flex items-center gap-2 text-white/35">
              <Phone size={10} /><Video size={10} /><MoreVertical size={10} />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-2 py-2 sm:px-3">
            {MSGS.map((m) => <Bubble key={m.t} {...m} mv={mv} />)}
            <Typing mv={mv} at={typingAt} />
            <motion.div style={{ opacity: composerOp }} className="mt-auto flex items-center gap-1.5 rounded-xl border border-line bg-white/[0.03] px-2 py-1">
              <span className="text-[12px] leading-none text-white/25">+</span>
              <span className="flex-1 truncate text-[7.5px] font-medium text-white/35">Message would look like this...</span>
              <span className="flex items-center gap-1 rounded-lg bg-primary px-1.5 py-[3px] text-[#07130f]">
                <Send size={8} strokeWidth={2.6} />
              </span>
            </motion.div>
          </div>

          <motion.div style={{ opacity: followOp, y: followY }} className="mx-2 mb-1.5 flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-white/[0.02] px-2 py-1">
            <CalendarClock size={10} className="text-primary" />
            <span className="text-[7px] font-semibold text-white/55">Follow-up scheduled</span>
            <span className="ml-auto text-[7px] font-semibold text-primary">Fri 14:00</span>
          </motion.div>
        </motion.div>

        {/* Qualification panel */}
        <QualPanel mv={mv} />
      </motion.div>

      <FooterStrip
        mv={mv}
        left={<><MessageCircle size={9} className="text-primary" />94 conversations handled this week</>}
        right={<><Check size={9} />Qualified: 1 new lead</>}
      />
    </div>
  );
}