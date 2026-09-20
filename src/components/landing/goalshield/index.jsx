import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, ShieldCheck, MessageCircle, ClipboardList, ArrowRight } from 'lucide-react';
import { cn } from '../../ui/cn';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { inRange, fade, clamp01, easeOut } from './shared';
import DiscoverScene from './discover';
import VerifyScene from './verify';
import EngageScene from './engage';
import ConvertScene from './convert';
import { useMinWidth } from './useMediaQuery';
import FunnelShowcase from './mobile/FunnelShowcase';

const PROCESS_LINE = [
  'Find leads',
  'Verify contacts',
  'Engage with WhatsApp',
  'Qualify with AI',
  'Follow up',
  'Grow your business',
];

const Gradient = ({ children }) => (
  <span className="bg-gradient-to-r from-primary via-emerald-300 to-primary bg-clip-text text-transparent">{children}</span>
);

function SectionHeader({ p }) {
  const headOp = inRange(p, 0, 0.06);
  const headY = useTransform(p, (v) => (1 - easeOut(clamp01(v / 0.06))) * 12);

  const pillOp = fade(p, 0, 0.03, 1.2, 1.4);
  const pillY = useTransform(p, (v) => (1 - easeOut(clamp01((v - 0.015) / 0.03))) * 10);
  const titleOp = fade(p, 0.01, 0.04, 1.2, 1.4);
  const titleY = useTransform(p, (v) => (1 - easeOut(clamp01((v - 0.025) / 0.035))) * 8);
  const lineOp = fade(p, 0.02, 0.05, 1.2, 1.4);
  const lineY = useTransform(p, (v) => (1 - easeOut(clamp01((v - 0.035) / 0.03))) * 6);

  return (
    <motion.header style={{ opacity: headOp, y: headY }} className="relative z-20 shrink-0 px-4 pt-2.5 pb-1 sm:px-6 sm:pt-4 sm:pb-2 lg:px-8 lg:pt-3 lg:pb-1.5 xl:pt-4">
      <div className="mx-auto w-full max-w-4xl text-center xl:max-w-5xl">
        <motion.div style={{ opacity: pillOp, y: pillY }}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[8px] font-bold tracking-wide text-primary sm:text-[9px]">
            <ShieldCheck size={10} strokeWidth={2.4} />
            WhatsApp Shield + Message Agent
          </span>
        </motion.div>
        <motion.div style={{ opacity: titleOp, y: titleY }}>
          <h2 className="mt-1.5 text-[1.12rem] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[1.45rem] lg:text-[1.7rem] xl:text-[2rem]">
            From <Gradient>Discovery</Gradient> to Conversion &#8212; <Gradient>All in One Platform</Gradient>
          </h2>
        </motion.div>
        <motion.div style={{ opacity: lineOp, y: lineY }}>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-[8px] font-semibold text-white/45 sm:text-[9.5px] lg:mt-2 lg:text-[10px]">
            {PROCESS_LINE.map((step, i) => (
              <React.Fragment key={step}>
                {i > 0 && <ArrowRight size={9} className="shrink-0 text-primary/60" />}
                <span className="leading-tight">{step}</span>
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}

function Ambient({ p }) {
  const breathe = useTransform(p, (v) => (0.5 + 0.5 * Math.sin(v * Math.PI * 2)) * 0.2);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div style={{ opacity: breathe }} className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[90px]" />
      <div className="absolute -bottom-16 right-1/5 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_20%,rgba(29,217,168,0.06),transparent_70%)]" />
    </div>
  );
}

function ProgressDots({ ops }) {
  return (
    <span className="flex items-center gap-1.5">
      {ops.map((o, i) => (
        <motion.span key={i} style={{ opacity: o }} className="h-1.5 w-1.5 rounded-full bg-primary" />
      ))}
    </span>
  );
}

const STATIC_CARDS = [
  { icon: Search, title: '1 · Lead Discovery', points: ['Search across business directories', 'Score every lead 84–98% match', 'Verified contact details & profiles'] },
  { icon: ShieldCheck, title: '2 · Contact Verification', points: ['Normalize phone numbers', 'Check WhatsApp availability', 'Remove duplicates automatically'] },
  { icon: MessageCircle, title: '3 · Message Agent', points: ['AI first-touch outreach', 'Human-style WhatsApp replies', 'Auto-qualify hot leads'] },
  { icon: ClipboardList, title: '4 · CRM & Follow-up', points: ['Kanban pipeline tracking', 'Scheduled follow-ups & reminders', 'Conversion analytics dashboard'] },
];

const PinnedShowcase = () => {
  const reduce = useReducedMotion();
  const secRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: secRef, offset: ['start start', 'end end'] });
  const p = useSpring(scrollYProgress, { stiffness: 70, damping: 24, mass: 0.5 });

  const s1 = inRange(p, 0.04, 0.34);
  const s2 = inRange(p, 0.26, 0.56);
  const s3 = inRange(p, 0.5, 0.8);
  const s4 = inRange(p, 0.74, 1);

  const o1 = fade(p, 0.04, 0.1, 0.3, 0.36);
  const o2 = fade(p, 0.26, 0.32, 0.54, 0.6);
  const o3 = fade(p, 0.5, 0.56, 0.78, 0.84);
  const o4 = fade(p, 0.74, 0.8, 1.05, 1.1);

  const hintOp = fade(p, 0.06, 0.14, 0.18, 0.24);
  const ctaOp = inRange(p, 0.9, 0.97);
  const ctaY = useTransform(p, [0.9, 1], [12, 0]);

  if (reduce) {
    return (
      <div className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8 bg-surface border-t border-border">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">Start With a Goal</p>
          <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">WhatsApp</Badge>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2">From Discovery to Conversion — All in One Platform</h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed mb-8">
            Find leads, verify contacts, engage on WhatsApp with AI help, and move every conversation into a CRM pipeline.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-left">
            {STATIC_CARDS.map((card) => (
              <div key={card.title} className="rounded-2xl border border-border/70 bg-surface p-4">
                <card.icon size={18} className="text-primary mb-2" />
                <p className="text-sm font-bold mb-1">{card.title}</p>
                <ul className="text-xs text-text-secondary leading-relaxed space-y-1">
                  {card.points.map((pt) => <li key={pt} className="list-disc list-inside">{pt}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/message-agent">
                Open the live workspace <ArrowRight size={15} className="ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={secRef} className="relative w-full h-[460vh] bg-surface border-t border-border overflow-x-clip">
      {/* pinned below the fixed header (56px), sized to the live viewport */}
      <div className="sticky top-[56px] h-[calc(100svh-56px)] max-h-[calc(100svh-56px)] overflow-hidden flex flex-col">
        <Ambient p={p} />

        <SectionHeader p={p} />

        {/* scene stage — one large mockup at a time */}
        <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-3 xl:py-4">
          <div className="relative w-full max-w-6xl h-[min(68svh,430px)] sm:h-[min(64svh,470px)] md:h-[min(64svh,510px)] lg:h-[min(70svh,590px)] xl:h-[min(68svh,640px)] max-h-full">
            <motion.div style={{ opacity: o1 }} className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-line/80 bg-panel/95 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
              <DiscoverScene mv={s1} />
            </motion.div>
            <motion.div style={{ opacity: o2 }} className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-line/80 bg-panel/95 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
              <VerifyScene mv={s2} />
            </motion.div>
            <motion.div style={{ opacity: o3 }} className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-line/80 bg-panel/95 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
              <EngageScene mv={s3} />
            </motion.div>
            <motion.div style={{ opacity: o4 }} className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-line/80 bg-panel/95 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
              <ConvertScene mv={s4} />
            </motion.div>
          </div>
        </div>

        {/* scroll hint + CTA (share one row so height never shifts) */}
        <div className="relative z-30 shrink-0 flex items-center justify-center px-4 pb-3.5 pt-1">
          <motion.div style={{ opacity: hintOp }} className="absolute inset-0 flex items-center justify-center gap-3">
            <ProgressDots ops={[o1, o2, o3, o4]} />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Scroll to explore</span>
          </motion.div>
          <motion.div style={{ opacity: ctaOp, y: ctaY }} className="relative">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/message-agent">
                Open the live workspace <ArrowRight size={13} />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export const GoalWorkflowSection = () => {
  const desktop = useMinWidth(1200);

  // Desktop (>=1200px) keeps the pinned storytelling exactly as before.
  // Mobile + tablet (<1200px) get the stacked card layout.
  return desktop ? <PinnedShowcase /> : <FunnelShowcase />;
};

export const WhatsAppWorkflowSection = GoalWorkflowSection;