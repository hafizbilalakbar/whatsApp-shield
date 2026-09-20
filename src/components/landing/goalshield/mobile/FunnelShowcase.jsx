import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Search, ListChecks, MessageCircle, Sparkles, CalendarClock,
  Trophy, ArrowRight, Users, ArrowUpRight,
} from 'lucide-react';
import { cn } from '../../../ui/cn';
import StepCard from './StepCard';
import { PhoneMock1, PhoneMock2, PhoneMock3, PhoneMock4 } from './phoneMocks';
import { DesktopMock1, DesktopMock2, DesktopMock3, DesktopMock4 } from './desktopMocks';
import { useInView } from './motionHooks';

const FUNNEL = [
  { label: 'Find', icon: Search },
  { label: 'Verify', icon: ShieldCheck },
  { label: 'Organize', icon: ListChecks },
  { label: 'Engage', icon: MessageCircle },
  { label: 'Qualify', icon: Sparkles },
  { label: 'Follow Up', icon: CalendarClock },
  { label: 'Convert', icon: Trophy },
];

const PROCESS_LINE = ['Find leads', 'Verify contacts', 'Engage on WhatsApp', 'Qualify with AI', 'Follow up', 'Convert'];

const Green = ({ children }) => (
  <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">{children}</span>
);

const CARDS = [
  {
    n: 1,
    eyebrow: 'Discovery',
    title: <>Find <Green>qualified</Green> leads in seconds</>,
    subtitle: 'Search millions of businesses and surface the ones most likely to buy.',
    current: 0,
    badge: '1,460 business leads found',
    badgeIcon: Users,
    Phone: PhoneMock1,
    Desktop: DesktopMock1,
  },
  {
    n: 2,
    eyebrow: 'Verification',
    title: <>Verify every <Green>contact</Green> automatically</>,
    subtitle: 'Clean, normalized numbers checked for WhatsApp before you reach out.',
    current: 1,
    badge: '892 WhatsApp-ready contacts',
    badgeIcon: ShieldCheck,
    Phone: PhoneMock2,
    Desktop: DesktopMock2,
  },
  {
    n: 3,
    eyebrow: 'Qualification',
    title: <>Engage and <Green>qualify</Green> with AI</>,
    subtitle: 'Human-style WhatsApp chats that score and route hot leads for you.',
    current: 3,
    badge: 'Lead Qualified · 86% score',
    badgeIcon: Sparkles,
    Phone: PhoneMock3,
    Desktop: DesktopMock3,
  },
  {
    n: 4,
    eyebrow: 'CRM & Pipeline',
    title: <>Follow up and <Green>convert</Green> on autopilot</>,
    subtitle: 'Track every deal in a CRM pipeline with reminders and conversion analytics.',
    current: 5,
    badge: 'Opportunity created',
    badgeIcon: Trophy,
    Phone: PhoneMock4,
    Desktop: DesktopMock4,
  },
];

function FunnelTicker({ reduce }) {
  const [ref, inView] = useInView(0.3);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) {
      setI(FUNNEL.length - 1);
      return undefined;
    }
    const id = window.setInterval(() => setI((v) => (v + 1) % FUNNEL.length), 700);
    return () => window.clearInterval(id);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
      {FUNNEL.map((s, idx) => (
        <React.Fragment key={s.label}>
          {idx > 0 && <ArrowRight size={10} className="shrink-0 text-primary/40" />}
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors duration-300 sm:text-[11px]',
              idx === i ? 'bg-primary text-[#04140f]' : idx < i ? 'bg-primary/15 text-primary' : 'bg-p-chip-strong text-p-mut',
            )}
          >
            {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function FunnelShowcase() {
  const reduce = useReducedMotion();
  const headRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: headRef, offset: ['start 0.95', 'start 0.45'] });
  const pillOp = useTransform(scrollYProgress, [0, 0.35], [0, 1]);
  const pillY = useTransform(scrollYProgress, [0, 0.35], [10, 0]);
  const titleOp = useTransform(scrollYProgress, [0.12, 0.5], [0, 1]);
  const titleY = useTransform(scrollYProgress, [0.12, 0.5], [16, 0]);
  const lineOp = useTransform(scrollYProgress, [0.24, 0.62], [0, 1]);
  const lineY = useTransform(scrollYProgress, [0.24, 0.62], [10, 0]);

  return (
    <div className="relative w-full overflow-x-clip border-t border-border bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(29,217,168,0.07),transparent_70%)]" />

      <div className="relative mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <header ref={headRef} className="text-center">
          <motion.div style={reduce ? undefined : { opacity: pillOp, y: pillY }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[9px] font-bold tracking-wide text-primary">
              <ShieldCheck size={11} strokeWidth={2.4} /> WhatsApp Shield + Message Agent
            </span>
          </motion.div>
          <motion.div style={reduce ? undefined : { opacity: titleOp, y: titleY }}>
            <h2 className="mt-2 text-[1.35rem] font-extrabold leading-[1.18] tracking-tight text-p-title text-balance sm:text-[1.6rem]">
              <span className="block sm:inline sm:whitespace-nowrap">From <Green>Discovery</Green> to Conversion</span>
              <span className="hidden sm:inline"> &#8212; </span>
              <span className="block sm:inline sm:whitespace-nowrap"> <Green>All in One Platform</Green></span>
            </h2>
          </motion.div>
          <motion.div style={reduce ? undefined : { opacity: lineOp, y: lineY }}>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] font-semibold text-p-mut sm:text-[11px]">
              {PROCESS_LINE.map((step, i) => (
                <React.Fragment key={step}>
                  {i > 0 && <ArrowRight size={10} className="shrink-0 text-primary/60" />}
                  <span>{step}</span>
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </header>

        <div className="mt-8">
          {CARDS.map((card) => (
            <StepCard key={card.n} {...card} funnel={FUNNEL} reduce={reduce} />
          ))}
        </div>

        <footer className="mt-10 rounded-2xl border border-p-line-soft bg-p-chip px-4 py-6 text-center">
          <span className="inline-flex items-center gap-2 text-[13px] font-extrabold tracking-tight text-p-title sm:text-[15px]">
            <ShieldCheck size={16} className="text-primary" /> WhatsApp Shield + Message Agent
          </span>
          <FunnelTicker reduce={reduce} />
          <Link
            to="/message-agent"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[12px] font-bold text-[#04140f] transition-transform hover:-translate-y-0.5"
          >
            Open the live workspace <ArrowUpRight size={13} strokeWidth={2.6} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
