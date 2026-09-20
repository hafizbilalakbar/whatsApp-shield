import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search, BadgeCheck, Inbox, Repeat, WandSparkles, MessageSquareReply, Megaphone, CalendarClock,
  ShieldCheck, Check, Database, Lock, Users, Filter, Layers2,
  ShoppingCart, Rocket, Briefcase, Cpu, Target, Store, TrendingUp, Wrench, GraduationCap,
  Building2, Earth, MapPin, Globe, MessageCircle, HeartHandshake, Handshake, CalendarCheck,
  BellRing, Shield, ArrowRight, ArrowDown, Sparkles, RotateCcw, Plus,
  HeartPulse, Banknote, Truck, Stethoscope,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../ui/cn';
import {
  fadeUp, stagger, SectionHeading, SelectChip, FlowRail, ChatMock, useCyclingIndex,
  RadarVisual, Marquee, useInViewOnce,
} from './shared';
import { HeroWorkflow } from './mockups';
import {
  ShieldScanDemo, AgentChatDemo, TestimonialsFeed,
  CATEGORY_LOGOS, CategoryLogoTile, useDemoClock,
} from './demos';
import { SHIELD_HOME } from '../../utils/paths';

/* ================= DATA ================= */

const GOALS = [
  {
    icon: Search, label: 'Find business leads',
    desc: 'Discover and organize potential contacts from the markets you choose.',
    steps: ['Discover', 'Organize', 'Validate'],
  },
  {
    icon: BadgeCheck, label: 'Verify my leads',
    desc: 'Check every number before any message goes out.',
    steps: ['Import', 'Normalize', 'Validate', 'Verify'],
  },
  {
    icon: Inbox, label: 'Manage WhatsApp leads',
    desc: 'Keep every lead organized as it moves toward a conversation.',
    steps: ['Shield clean', 'Agent organize', 'CRM track'],
  },
  {
    icon: Repeat, label: 'Follow up with prospects',
    desc: 'Never let a good lead go quiet.',
    steps: ['Conversation', 'Set reminder', 'Follow up'],
  },
  {
    icon: WandSparkles, label: 'Qualify leads with AI',
    desc: 'Let AI read replies and surface the most interested contacts.',
    steps: ['Reply arrives', 'AI Agent', 'Qualify'],
  },
  {
    icon: MessageSquareReply, label: 'Manage customer conversations',
    desc: 'Exchange messages, answer questions, and keep context.',
    steps: ['From lead', 'Conversation', 'Support'],
  },
  {
    icon: Megaphone, label: 'Promote my services',
    desc: 'Reach audiences who are likely to respond — not everyone.',
    steps: ['Define audience', 'Verified list', 'Campaign'],
  },
  {
    icon: CalendarClock, label: 'Automate follow-ups',
    desc: 'Schedule and remind without tracking it all manually.',
    steps: ['Schedule', 'Automate', 'Remind'],
  },
];

const MARKETS = ['Pakistan', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'United States', 'Australia'];
const REGIONS = ['Capital region', 'Major metro area', 'Port & trade hubs', 'Countrywide'];
const INDUSTRIES = [
  'Wholesale & Distribution', 'Retail & Ecommerce', 'Construction & Contractors',
  'IT & Software Services', 'Healthcare & Clinics', 'Education & Training',
];
const AUDIENCES_S2 = [
  'Importers & Exporters', 'Retailers & Brands', 'Manufacturers',
  'Freelance Professionals', 'Clinics & Doctors', 'Schools & Trainers',
];

const INTERNATIONAL_MARKETS = [
  { place: 'United Kingdom', seg: 'London & regional companies' },
  { place: 'United States', seg: 'NY · LA · Texas — growth sectors' },
  { place: 'Canada', seg: 'Toronto · Montreal · Vancouver' },
  { place: 'France', seg: 'Paris · Lyon · Marseille — trade & services' },
  { place: 'Germany', seg: 'Berlin · Munich · Hamburg — manufacturing & SaaS' },
  { place: 'Netherlands', seg: 'Amsterdam / Rotterdam — logistics & trade' },
];

const AUDIENCES = [
  {
    icon: Layers2, label: 'SaaS',
    desc: 'Activate trials, answer product questions, and guide onboarding.',
    steps: ['Find decision-makers', 'Validate contacts', 'Run onboarding chats'],
  },
  {
    icon: ShoppingCart, label: 'Ecommerce',
    desc: 'Turn browsing into conversations — cart recovery, order updates, post-purchase care.',
    steps: ['Import customer lists', 'Validate WhatsApp reach', 'Engage buyers in chat'],
  },
  {
    icon: Megaphone, label: 'Agencies',
    desc: 'Run cleaner campaigns for more clients with validated audiences.',
    steps: ['Import client lists', 'Clean & verify', 'Launch outreach'],
  },
  {
    icon: Rocket, label: 'Startups',
    desc: 'Validate early lead lists and reach warm prospects directly.',
    steps: ['Find contacts', 'Validate numbers', 'Follow up consistently'],
  },
  {
    icon: Store, label: 'Local Businesses',
    desc: 'Turn local interest into bookings, directions, and repeat visits.',
    steps: ['Collect local leads', 'Validate numbers', 'Confirm & follow up'],
  },
  {
    icon: Briefcase, label: 'Service Businesses',
    desc: 'Book appointments and answer service questions in one channel.',
    steps: ['Add service leads', 'Validate numbers', 'Schedule & confirm'],
  },
  {
    icon: Cpu, label: 'Technology Companies',
    desc: 'Stay ahead of prospects and partners with verified engagement.',
    steps: ['Compile target accounts', 'Validate contacts', 'Nurture conversations'],
  },
  {
    icon: Target, label: 'Sales Teams',
    desc: 'Give reps clean lists and pre-qualified conversations.',
    steps: ['Prepare prospect lists', 'Verify reachability', 'Hand to CRM follow-up'],
  },
];

const MARKETING_USES = [
  { icon: MessageCircle, title: 'Sales conversations', desc: 'Turn interest into one-to-one talks.' },
  { icon: Repeat, title: 'Lead follow-ups', desc: 'Keep momentum without phone tag.' },
  { icon: MessageSquareReply, title: 'Customer support', desc: 'Answer questions where customers are.' },
  { icon: Megaphone, title: 'Product & service promotion', desc: 'Share updates with relevant audiences.' },
  { icon: WandSparkles, title: 'Lead qualification', desc: 'Identify the most interested contacts.' },
  { icon: HeartHandshake, title: 'Nurturing & engagement', desc: 'Build relationships that convert later.' },
];

const AI_USE_CASES = [
  { icon: TrendingUp, title: 'Sales qualification', desc: 'Rank inbound interest by intent.' },
  { icon: MessageSquareReply, title: 'Customer support', desc: 'Resolve common questions instantly.' },
  { icon: CalendarCheck, title: 'Lead follow-up', desc: 'Schedule and continue the right talks.' },
  { icon: BellRing, title: 'Business-specific responses', desc: 'Answers grounded in your business context.' },
  { icon: WandSparkles, title: 'Conversation assistance', desc: 'Helpful drafting and suggestions as you chat.' },
];

const AUTOMATION_STEPS = ['New lead', 'Detect', 'Validate', 'Add to list', 'Message', 'Follow up', 'Assign', 'Close'];

/* ---------- TRUST STRIP ---------- */
const TRUST_ITEMS = [
  { icon: ShoppingCart, label: 'E-Commerce', desc: 'Retail & marketplaces' },
  { icon: Megaphone, label: 'Marketing', desc: 'Agencies & campaigns' },
  { icon: Building2, label: 'Real Estate', desc: 'Property & rentals' },
  { icon: HeartPulse, label: 'Healthcare', desc: 'Clinics & telehealth' },
  { icon: GraduationCap, label: 'Education', desc: 'EdTech & training' },
  { icon: Banknote, label: 'Finance', desc: 'Banking & fintech' },
  { icon: Cpu, label: 'Technology', desc: 'SaaS & engineering' },
  { icon: Truck, label: 'Logistics', desc: 'Shipping & delivery' },
  { icon: Stethoscope, label: 'Healthcare', desc: 'Clinics & care' },
  { icon: Wrench, label: 'Services', desc: 'Field & repair teams' },
  { icon: Store, label: 'Local', desc: 'Shops & neighborhoods' },
  { icon: Users, label: 'Sales', desc: 'Inside & field teams' },
];

export const TrustStrip = () => (
  <div>
    <p className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-text-muted mb-5">
      Built for the businesses that already run on WhatsApp
    </p>
    <Marquee items={TRUST_ITEMS} trackClass="brand-track" duration="38s" render={(item) => (
      <div className="mx-3 sm:mx-4 flex items-center gap-2.5 rounded-2xl border border-border/70 bg-surface px-4 sm:px-5 py-3 min-w-max">
        <item.icon size={16} className="text-primary shrink-0" />
        <div>
          <p className="text-xs font-bold text-text-primary whitespace-nowrap">{item.label}</p>
          <p className="text-[9px] text-text-muted whitespace-nowrap">{item.desc}</p>
        </div>
      </div>
    )} />
  </div>
);

/* ---------- GOAL SELECTOR ---------- */
export const GoalSelector = () => {
  const [active, setActive] = useState(0);
  const goal = GOALS[active];
  const ActiveIcon = goal.icon;

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2 mb-6 sm:mb-8">
        {GOALS.map((g, i) => {
          const Icon = g.icon;
          return (
            <button
              key={g.label}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs sm:text-sm font-medium transition-all duration-200',
                active === i
                  ? 'bg-primary/10 border-primary/50 text-primary shadow-sm'
                  : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary'
              )}
            >
              <Icon size={14} />
              {g.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={goal.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <Card className="bg-surface border-border/60">
            <CardContent className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-6 items-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto sm:mx-0">
                <ActiveIcon size={22} className="text-primary" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-display font-bold text-text-primary mb-1">{goal.label}</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{goal.desc}</p>
              </div>
              <div className="sm:col-span-2">
                <div className="rounded-xl border border-border/70 bg-background p-4">
                  <FlowRail steps={goal.steps} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/* ---------- LEAD DISCOVERY EXPLORER ---------- */
export const LeadDiscoveryExplorer = () => {
  const [market, setMarket] = useState(null);
  const [region, setRegion] = useState(null);
  const [industry, setIndustry] = useState(null);
  const [audience, setAudience] = useState(null);
  const complete = market && industry;

  const reset = () => {
    setMarket(null);
    setRegion(null);
    setIndustry(null);
    setAudience(null);
  };

  const groups = [
    { title: '1 · Country', options: MARKETS, value: market, set: setMarket },
    { title: '2 · Region', options: REGIONS, value: region, set: setRegion },
    { title: '3 · Industry', options: INDUSTRIES, value: industry, set: setIndustry },
    { title: '4 · Audience', options: AUDIENCES_S2, value: audience, set: setAudience },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {groups.map((group) => (
          <Card key={group.title} className="bg-surface border-border/60">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-text-primary mb-3">{group.title}</p>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => (
                  <SelectChip key={opt} active={group.value === opt} onClick={() => group.set(opt)}>
                    {opt}
                  </SelectChip>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {complete ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="bg-surface border-primary/25">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Search size={13} className="text-primary shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Potential leads</span>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-text-primary leading-snug">
                    {industry || 'Business'} leads in {market}
                    {region && <span className="text-text-muted font-medium"> · {region}</span>}
                    {audience && <span className="text-text-muted font-medium"> · {audience}</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <FlowRail steps={['Organized', 'Validated', 'Ready for outreach']} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" asChild>
                    <Link to={SHIELD_HOME}>Open Shield</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset} className="gap-1" aria-label="Reset">
                    <RotateCcw size={13} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-xs sm:text-sm text-text-muted"
          >
            Pick a country and an industry to preview the workflow.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ---------- INTERNATIONAL ---------- */
export const InternationalSection = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className="relative flex items-center justify-center py-6"
      aria-hidden="true"
    >
      <RadarVisual className="w-52 h-52 sm:w-64 sm:h-64" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[10px] font-semibold text-text-muted bg-surface/90 border border-border rounded-full px-3 py-1">
        <Earth size={12} className="text-primary" /> Country → Market → Audience → Leads
      </div>
    </motion.div>

    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
      <motion.div variants={fadeUp}>
        <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">International</Badge>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2 leading-tight">Find Business Opportunities Beyond Your Local Market</h2>
        <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-6 max-w-xl">
          Build lead lists across regions and connect with audiences beyond your home market — every number
          validated before a single message goes out.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {INTERNATIONAL_MARKETS.map((m) => (
            <div key={m.place} className="rounded-xl border border-border/70 bg-surface flex items-start gap-2.5 p-3 hover:border-primary/40 transition-colors">
              <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary">{m.place}</p>
                <p className="text-[11px] text-text-muted leading-snug">{m.seg}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-text-muted mt-5 flex items-center gap-1.5">
          <Globe size={12} className="shrink-0" />
          Availability depends on the source lists you import — validate before you reach out.
        </p>
      </motion.div>
    </motion.div>
  </div>
);

/* ---------- WHATSAPP MARKETING ---------- */
export const MarketingSection = () => (
  <div>
    <SectionHeading
      eyebrow="WhatsApp Marketing"
      title="Turn WhatsApp Into a Business Growth Channel"
      subtitle="Use WhatsApp for the conversations that move your business forward — thoughtfully, not spammy."
    />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MARKETING_USES.map((u, i) => {
        const Icon = u.icon;
        return (
          <motion.div
            key={u.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="h-full hover:-translate-y-1 transition-transform duration-300 hover:border-[#25D366]/40 hover:shadow-lg">
              <CardContent className="p-4 sm:p-5">
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 text-[#1da851] flex items-center justify-center mb-3">
                  <Icon size={16} />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-text-primary mb-1.5">{u.title}</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{u.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
    <div className="mt-6 max-w-2xl mx-auto rounded-2xl border border-border bg-surface p-4 sm:p-5 flex items-start gap-3">
      <Handshake size={18} className="text-primary shrink-0 mt-0.5" />
      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
        <span className="font-semibold text-text-primary">Responsible messaging.</span> Clean lists, consent-aware
        workflows, and thoughtful cadence help you reach people who expect to hear from you — and respect those
        who politely don't.
      </p>
    </div>
  </div>
);

/* ---------- ANIMATED NODE PIPELINE (shared) ---------- */
const NodePipeline = ({ steps, accent = 'shield' }) => {
  const reduce = useReducedMotion();
  const active = useCyclingIndex(steps.length, 1350);
  const node = (s, i) => {
    const isAgent = accent === 'agent';
    const done = active === -1 ? true : i < active;
    const isActive = active === i;
    return (
      <div key={s} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <motion.div
          animate={{ scale: isActive ? 1.06 : 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'flex items-center gap-1.5 rounded-xl border px-2.5 py-2 transition-colors duration-300',
            isAgent
              ? done ? 'bg-[#25D366]/10 border-[#25D366]/30' : 'border-border/80 bg-background'
              : done ? 'bg-primary/10 border-primary/30' : 'border-border/80 bg-background',
            isActive && (isAgent ? 'shadow-[0_0_14px_rgba(37,211,102,0.35)]' : 'shadow-[0_0_14px_rgba(0,217,126,0.35)]')
          )}
        >
          <span className={cn(
            'w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0',
            isAgent ? 'bg-[#25D366]/15 text-[#1da851]' : 'bg-primary/10 text-primary'
          )}>
            {i + 1}
          </span>
          <span className={cn('text-[11px] font-semibold whitespace-nowrap', done ? 'text-text-primary' : 'text-text-muted')}>{s}</span>
        </motion.div>
        {i < steps.length - 1 && (
          <span className="text-text-muted shrink-0" aria-hidden="true">
            <ArrowRight size={12} className="hidden lg:block" />
            <ArrowDown size={12} className="lg:hidden" />
          </span>
        )}
      </div>
    );
  };
  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-1.5 sm:gap-2">
        {steps.map((s, i) => node(s, i))}
      </div>
      <div className="mt-5 relative h-1.5 rounded-full border border-border/60 bg-surface overflow-hidden">
        {!reduce && active !== -1 && (
          <motion.div
            className={cn(
              'absolute top-0 bottom-0 rounded-full bg-gradient-to-r',
              accent === 'agent' ? 'from-[#25D366] to-secondary' : 'from-primary to-secondary'
            )}
            style={{ width: `${(1 / steps.length) * 100}%` }}
            animate={{ left: `calc(${((active / steps.length) * 100).toFixed(1)}% - ${((1 / steps.length) * 100) / 2}%)` }}
            initial={false}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
          />
        )}
        {reduce && <div className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-primary/40" />}
      </div>
    </div>
  );
};

/* ---------- AUDIENCE SELECTOR ---------- */
export const AudienceSelector = () => {
  const [active, setActive] = useState(0);
  const audience = AUDIENCES[active];
  const ActiveIcon = audience.icon;

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-10">
        {AUDIENCES.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs sm:text-sm font-medium transition-all duration-200',
                active === i
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'border-border bg-surface text-text-secondary hover:border-primary/40'
              )}
            >
              <Icon size={14} />
              {a.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={audience.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <Card className="bg-surface border-border/60">
            <CardContent className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-6 items-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto sm:mx-0">
                <ActiveIcon size={22} className="text-primary" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-display font-bold text-text-primary mb-1">{audience.label}</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{audience.desc}</p>
              </div>
              <div className="sm:col-span-2">
                <div className="rounded-xl border border-border/70 bg-background p-4">
                  <FlowRail steps={audience.steps} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/* ---------- AUTOMATION ---------- */
export const AutomationSection = () => (
  <div>
    <SectionHeading
      eyebrow="Automation"
      badge="Workflow"
      title="Automate the Repetitive Parts of Your Pipeline"
      subtitle="Once leads are validated and organized, the routine steps — detecting, listing, messaging, following up, assigning — become part of a repeatable flow."
    />
    <NodePipeline steps={AUTOMATION_STEPS} accent="shield" />
    <div className="mt-6 max-w-2xl mx-auto flex items-start gap-2.5 rounded-xl border border-border/70 bg-surface p-3.5">
      <Lock size={15} className="text-primary shrink-0 mt-0.5" />
      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
        <span className="font-semibold text-text-primary">You stay in control.</span> What gets automated, when,
        and to whom — those choices live in your workspace and can be switched off at any time.
      </p>
    </div>
  </div>
);

/* ---------- AI ---------- */
export const AiSection = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
      <motion.div variants={fadeUp}>
        <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">AI Assistance</Badge>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2 leading-tight">AI That Helps You Handle More Conversations.</h2>
        <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-6 max-w-xl">
          Useful AI help where it matters — reading replies, drafting answers, and flagging the leads worth your time.
        </p>
      </motion.div>
      <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-6">
        <FlowRail steps={['Lead', 'AI Agent', 'Qualification', 'Response', 'Follow-up']} />
      </motion.div>
      <motion.div variants={fadeUp} className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-surface p-3.5 max-w-xl">
        <ShieldCheck size={15} className="text-primary shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
          AI provider and model settings stay inside the application — they never appear on public pages.
        </p>
      </motion.div>
    </motion.div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {AI_USE_CASES.map((u, i) => {
        const Icon = u.icon;
        return (
          <motion.div
            key={u.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="h-full hover:-translate-y-1 transition-transform duration-300 hover:border-primary/40 hover:shadow-lg">
              <CardContent className="p-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2.5">
                  <Icon size={15} />
                </div>
                <h3 className="text-sm font-bold text-text-primary mb-1">{u.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{u.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  </div>
);

/* ---------- PRODUCT PREVIEW (cinematic, clock-synced preview) ---------- */

const LEGEND = [
  'Discover', 'Validate', 'Qualify', 'Organize',
  'Start Chat', 'AI Assist', 'Follow Up', 'Convert',
];

const shieldStageOf = (t) => (t < 0.09 ? 0 : t < 0.23 ? 1 : t < 0.35 ? 2 : t < 0.47 ? 3 : 4);

const SHIELD_CAPTIONS = [
  'Scanning 1,460 imported contacts…',
  'Verifying WhatsApp presence per contact…',
  'Scoring lead quality across the list…',
  'Organizing verified leads into groups…',
  '960 qualified leads ready for outreach.',
];

const AGENT_CAPTIONS = [
  'Opening chat with Ana Soto — lead from Shield.',
  'Talking with Lukas Berg · AI assist drafting replies.',
  'Lena Vogel · follow-up scheduled · status updated.',
];

const WindowLabel = ({ index, title, hint }) => (
  <div className="flex items-center gap-2.5 mb-2.5">
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-primary/30 bg-primary/10 text-primary text-[11px] font-display font-bold shrink-0">
      {index}
    </span>
    <div className="min-w-0">
      <p className="text-[12px] font-bold text-text-primary leading-tight">{title}</p>
      <p className="text-[9.5px] text-text-muted truncate">{hint}</p>
    </div>
  </div>
);

export const ProductPreview = () => {
  const t = useDemoClock(17000, 0.72);
  const cv = Math.min(1, Math.max(0, t));
  const stage = shieldStageOf(t);
  const agentSeg = t < 0.60 ? 0 : t < 0.84 ? 1 : 2;
  const activePhase = Math.min(LEGEND.length - 1, Math.floor(cv * LEGEND.length));

  return (
    <div>
      <SectionHeading
        eyebrow="Product Preview"
        title="A Real Product, Not Just a Concept."
        subtitle="Watch a validation run feed qualified leads straight into an AI-assisted WhatsApp conversation."
      />

      <div className="relative w-full max-w-[1280px] mx-auto mt-4">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-10 left-1/4 w-64 h-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-12 right-1/4 w-72 h-72 rounded-full bg-secondary/10 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col lg:flex-row lg:items-stretch gap-4 sm:gap-5 lg:gap-4 xl:gap-6">
          <div className="lg:flex-[1] min-w-0">
            <WindowLabel index="01" title="Shield — Discover, Validate & Qualify" hint="Import · scan · check presence · score quality" />
            <ShieldScanDemo clock={t} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`sc-${stage}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="mt-2 text-center text-[10px] text-text-secondary flex items-center justify-center gap-1.5"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', stage >= 4 ? 'bg-success' : 'bg-primary animate-pulse')} />
                {SHIELD_CAPTIONS[stage]}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="lg:flex-none flex items-stretch justify-center py-0.5" aria-hidden="true">
            <div className="relative flex items-center gap-1 lg:gap-0.5 xl:gap-1">
              <span className="hidden lg:block relative h-px w-6 xl:w-10 overflow-hidden bg-primary/25">
                <motion.span
                  className="absolute inset-y-0 w-2.5 rounded-full bg-primary"
                  animate={{ left: ['-30%', '110%'] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </span>
              <motion.span
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-surface/80 text-primary shadow-sm"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ArrowRight size={14} className="hidden lg:block" />
                <ArrowDown size={14} className="lg:hidden" />
              </motion.span>
              <span className="hidden lg:block relative h-px w-6 xl:w-10 overflow-hidden bg-primary/25" style={{ transform: 'scaleX(-1)' }}>
                <motion.span
                  className="absolute inset-y-0 w-2.5 rounded-full bg-primary"
                  animate={{ left: ['-30%', '110%'] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </span>
            </div>
          </div>

          <div className="lg:flex-[1.3] min-w-0">
            <WindowLabel index="02" title="Message Agent — Converse, Assist & Follow Up" hint="AI-assisted replies · follow-ups · clear status" />
            <AgentChatDemo clock={t} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`ac-${agentSeg}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="mt-2 text-center text-[10px] text-text-secondary flex items-center justify-center gap-1.5"
              >
                <Sparkles size={10} className="text-primary" />
                {AGENT_CAPTIONS[agentSeg]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* synchronized workflow legend */}
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-1.5">
          {LEGEND.map((label, i) => {
            const done = i < activePhase;
            const current = i === activePhase;
            return (
              <motion.span
                key={label}
                animate={current ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={{ duration: 1.6, repeat: current ? Infinity : 0 }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold transition-colors duration-300',
                  done && 'border-success/35 bg-success/10 text-success',
                  current && 'border-primary/50 bg-primary/10 text-primary shadow-sm',
                  !done && !current && 'border-border/70 bg-surface text-text-muted'
                )}
              >
                <span className={cn('text-[7.5px] tabular-nums', done ? 'text-success/70' : current ? 'text-primary/70' : 'opacity-50')}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {done ? <Check size={8} /> : null}
                {label}
              </motion.span>
            );
          })}
        </div>
        <p className="mt-1.5 text-center text-[9px] text-text-muted uppercase tracking-widest">
          Discover → Validate → Qualify → Organize → Start Chat → AI Assist → Follow Up → Convert
        </p>
      </div>
    </div>
  );
};

/* ---------- METRICS ---------- */
const METRICS = [
  { icon: Users, label: 'Leads organized', value: 24800 },
  { icon: BadgeCheck, label: 'Contacts validated', value: 196000 },
  { icon: MessageCircle, label: 'Conversations handled', value: 8650 },
  { icon: Database, label: 'Reports exported', value: 1420 },
];

const formatCount = (v) => {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M+';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K+';
  return String(v);
};

const StatNumber = ({ value }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [n, setN] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setN(value); return; }
    let start;
    let raf;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / 1400);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduce]);

  return <span ref={ref}>{formatCount(n)}</span>;
};

export const MetricsSection = () => (
  <div>
    <SectionHeading
      eyebrow="Metrics"
      title="A Pipeline That Keeps Moving"
      subtitle="Leads, validations, and conversations organized in one connected workflow."
    />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {METRICS.map((m, i) => {
        const Icon = m.icon;
        return (
          <motion.div
            key={m.label}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="h-full hover:-translate-y-1 transition-transform duration-300 hover:border-primary/40 hover:shadow-lg">
              <CardContent className="p-4 sm:p-5 text-center">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <Icon size={16} />
                </div>
                <p className="text-2xl sm:text-3xl font-display font-bold text-text-primary tabular-nums">
                  <StatNumber value={m.value} />
                </p>
                <p className="text-[11px] sm:text-xs text-text-muted mt-1">{m.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  </div>
);

/* ---------- TESTIMONIALS (WhatsApp-style customer stories) ---------- */
const REVIEW_AVATARS = [
  'https://i.pravatar.cc/28?img=1',
  'https://i.pravatar.cc/28?img=2',
  'https://i.pravatar.cc/28?img=3',
  'https://i.pravatar.cc/28?img=4',
  'https://i.pravatar.cc/28?img=5',
];

const AvatarStack = ({ className, ariaLabel = 'Reviewed by real users' }) => (
  <div className={cn('wa-avatar-stack', className)} role="img" aria-label={ariaLabel}>
    {REVIEW_AVATARS.map((src, i) => (
      <img
        key={src}
        src={src}
        alt=""
        loading="lazy"
        width={28}
        height={28}
        className="wa-avatar-stack-img"
        style={{ zIndex: i }}
      />
    ))}
  </div>
);

export const TestimonialsSection = () => {
  const [avRef, avSeen] = useInViewOnce(0.4);
  return (
    <div>
      <SectionHeading
        eyebrow="Product Stories"
        title="See the Platform in Action."
        subtitle="Simulated conversations that illustrate how teams discover, qualify, and manage better leads on WhatsApp."
      />
      <div ref={avRef} className={cn('ws-reveal flex items-center justify-center mt-4 mb-7', avSeen && 'ws-in')}>
        <AvatarStack ariaLabel="Rated 4.9 stars from 200+ users" />
        <span className="wa-avatar-meta">4.9★ from 200+ users</span>
      </div>
      <TestimonialsFeed />
    </div>
  );
};

/* ---------- BRANDS / CATEGORY LOGOS ---------- */
export const BrandsSection = () => (
  <div>
    <SectionHeading
      eyebrow="Who It's For"
      title="Built for Businesses That Run on WhatsApp"
      subtitle="Neutral category marks for the teams working on WhatsApp every day."
    />
    <Marquee
      items={CATEGORY_LOGOS}
      trackClass="brand-track"
      className="group/brands"
      duration="36s"
      render={(item) => <CategoryLogoTile item={item} />}
    />
  </div>
);

/* ---------- FAQ ---------- */
const FAQS = [
  {
    q: 'What is WhatsApp Shield?',
    a: 'WhatsApp Shield protects your WhatsApp account from bans and restrictions. It monitors sending patterns, enforces safe limits, and keeps your account healthy automatically.',
    label: 'Protection',
    heading: 'WhatsApp Shield',
    desc: 'Keep your WhatsApp account safe from bans with intelligent pattern monitoring.',
  },
  {
    q: 'What is Message Agent?',
    a: 'Message Agent is your AI-powered messaging assistant. It sends personalized messages, handles replies, and manages conversations on your behalf 24/7.',
    label: 'AI Messaging',
    heading: 'Message Agent',
    desc: 'Let AI handle your WhatsApp outreach while you focus on closing deals.',
  },
  {
    q: 'How does contact validation work?',
    a: 'Before sending, every contact number is validated in real-time to confirm it is an active WhatsApp number. This removes bad numbers and protects your sender reputation.',
    label: 'Validation',
    heading: 'Contact Validation',
    desc: 'Only reach real, active WhatsApp numbers — zero wasted messages.',
  },
  {
    q: 'How do I import contacts?',
    a: 'You can import contacts via CSV file upload or connect directly from your CRM. The system maps your columns automatically and flags any invalid entries before import.',
    label: 'Import',
    heading: 'Easy Contact Import',
    desc: 'Upload CSV or sync your CRM — contacts are ready in minutes.',
  },
  {
    q: 'Can I export reports?',
    a: 'Yes. You can export full campaign reports as CSV or PDF including delivery rates, read rates, reply counts, and failed numbers.',
    label: 'Reports',
    heading: 'Export Reports',
    desc: 'Download detailed campaign analytics in CSV or PDF anytime.',
  },
  {
    q: 'Can I manage multiple campaigns?',
    a: 'Yes. You can run unlimited campaigns simultaneously, each with its own contact list, message template, schedule, and performance dashboard.',
    label: 'Campaigns',
    heading: 'Multi-Campaign Manager',
    desc: 'Run multiple WhatsApp campaigns in parallel with full control.',
  },
  {
    q: 'How does Message Agent work?',
    a: 'Message Agent uses AI to send the right message at the right time. It learns from reply patterns, handles follow-ups automatically, and escalates hot leads to you instantly.',
    label: 'Automation',
    heading: 'How Agent Works',
    desc: 'AI that sends, replies, and follows up — fully on autopilot.',
  },
  {
    q: 'How are conversations organized?',
    a: 'Every conversation is stored in a unified inbox sorted by campaign, status, and reply type. You can filter, tag, and assign conversations to team members.',
    label: 'Inbox',
    heading: 'Organized Conversations',
    desc: 'One inbox for all campaigns — filtered, tagged, and team-ready.',
  },
  {
    q: 'Is my WhatsApp connection secure?',
    a: 'Yes. Your WhatsApp is connected via an encrypted session. We never store your messages on our servers and your account credentials stay on your device only.',
    label: 'Security',
    heading: 'Secure Connection',
    desc: 'Encrypted session, no message storage — your data stays yours.',
  },
  {
    q: 'How do I get started?',
    a: 'Sign up, connect your WhatsApp by scanning a QR code, import your contacts, and launch your first campaign — takes less than 5 minutes.',
    label: 'Onboarding',
    heading: 'Get Started Fast',
    desc: 'From signup to first campaign in under 5 minutes.',
  },
];

const FAQ_ACCORDION_CSS = `
.ws-faq-item {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid var(--faq-item-border);
  background: var(--faq-item-bg);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}
.ws-faq-item--open {
  background: var(--faq-active-bg);
  border-color: rgba(37, 211, 102, 0.45);
}
.ws-faq-border {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  background: #25D366;
  transition: width 0.2s ease;
}
.ws-faq-item--open .ws-faq-border {
  width: 3px;
}
.ws-faq-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.35;
}
@media (min-width: 640px) {
  .ws-faq-trigger {
    padding: 16px 20px;
  }
}
.ws-faq-question {
  color: var(--faq-q-text);
  transition: color 0.2s ease;
}
.ws-faq-item--open .ws-faq-question {
  color: var(--faq-active-q-text);
}
.ws-faq-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  border: 1px solid rgba(37, 211, 102, 0.45);
  color: #25D366;
  transition: transform 0.3s ease, background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.ws-faq-item--open .ws-faq-icon {
  transform: rotate(45deg);
  background: #25D366;
  border-color: #25D366;
  color: #fff;
}
.ws-faq-panel {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 0.35s ease, opacity 0.35s ease;
}
.ws-faq-item--open .ws-faq-panel {
  opacity: 1;
}
.ws-faq-answer {
  padding: 0 16px 16px;
}
@media (min-width: 640px) {
  .ws-faq-answer {
    padding: 0 20px 18px;
  }
}
.ws-faq-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--faq-a-text);
}

/* left card + team */
.ws-faq-left-card {
  background: var(--faq-card-bg);
  border: 1px solid var(--faq-card-border);
}
.ws-faq-visual {
  height: 160px;
  width: 100%;
  border-radius: 8px;
  background: var(--faq-anim-bg);
  box-shadow: inset 0 0 0 1px rgba(37, 211, 102, 0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.ws-faq-visual svg {
  width: 100%;
  height: 100%;
  display: block;
}
.faq1-bg {
  background: radial-gradient(circle at center, rgba(37, 211, 102, 0.28), var(--faq-anim-bg) 66%);
}
.faq9-bg {
  background-color: var(--faq-anim-bg);
  background-image:
    linear-gradient(rgba(37, 211, 102, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 211, 102, 0.06) 1px, transparent 1px);
  background-size: 16px 16px;
}
/* reviews row */
.ws-faq-reviews {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--faq-card-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ws-faq-reviews-row {
  display: flex;
  align-items: center;
  flex-direction: row;
}
.ws-faq-reviews-text {
  margin-left: 8px;
  font-size: 13px;
  color: var(--text-muted);
}
.ws-faq-reviews-stars {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 14px;
  line-height: 1;
  color: #25D366;
}
.ws-faq-reviews-stars .ws-star {
  display: inline-block;
  width: 15px;
  height: 15px;
}
.ws-faq-reviews-stars .ws-star svg {
  display: block;
  width: 100%;
  height: 100%;
}
.ws-faq-reviews .wa-avatar-stack-img {
  animation: wsAvatarIn 0.5s ease-out backwards;
}
.ws-faq-reviews .wa-avatar-stack-img:nth-child(2) { animation-delay: 0.12s; }
.ws-faq-reviews .wa-avatar-stack-img:nth-child(3) { animation-delay: 0.24s; }
.ws-faq-reviews .wa-avatar-stack-img:nth-child(4) { animation-delay: 0.36s; }
.ws-faq-reviews .wa-avatar-stack-img:nth-child(5) { animation-delay: 0.48s; }
.ws-faq-reviews-note {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted);
}

/* FAQ 1 — shield with 3D tilt, radially pulsing rings, breathing lock */
.faq1-ring {
  fill: none;
  stroke: #25D366;
  stroke-width: 1.5;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq1Ring 3.6s ease-out infinite;
}
.faq1-ring--d1 { animation-delay: 0.8s; }
.faq1-ring--d2 { animation-delay: 1.6s; }
@keyframes faq1Ring {
  0% { transform: scale(1); opacity: 0.8; }
  70%, 100% { transform: scale(2); opacity: 0; }
}
.faq1-shield {
  transform-box: fill-box;
  transform-origin: center;
  animation: faq1Tilt 3.6s ease-in-out infinite alternate;
}
@keyframes faq1Tilt {
  0% { transform: perspective(460px) rotateY(-15deg); }
  100% { transform: perspective(460px) rotateY(15deg); }
}
.faq1-lock {
  transform-box: fill-box;
  transform-origin: center;
  animation: faq1Lock 3.6s ease-in-out infinite;
}
@keyframes faq1Lock {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.14); }
}

/* FAQ 2 — brain circuit with travelling dots, pulsing bubbles and spark */
.faq2-path {
  fill: none;
  stroke: #25D366;
  stroke-width: 1.5;
  stroke-linecap: round;
  opacity: 0.5;
  stroke-dasharray: 4 6;
  animation: faq2Flow 2.2s linear infinite;
}
@keyframes faq2Flow {
  to { stroke-dashoffset: -20; }
}
.faq2-dot {
  fill: #25D366;
  opacity: 0;
}
.faq2-dot--d1 { animation: faq2D1 2.2s linear infinite; }
.faq2-dot--d2 { animation: faq2D2 2.2s linear infinite; }
.faq2-dot--d3 { animation: faq2D3 2.2s linear infinite; }
.faq2-dot--d4 { animation: faq2D4 2.2s linear infinite; }
@keyframes faq2D1 {
  0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translate(-56px, -51px) scale(1); opacity: 0; }
}
@keyframes faq2D2 {
  0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translate(54px, -53px) scale(1); opacity: 0; }
}
@keyframes faq2D3 {
  0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translate(48px, 11px) scale(1); opacity: 0; }
}
@keyframes faq2D4 {
  0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
  12% { opacity: 1; }
  100% { transform: translate(0px, -42px) scale(1); opacity: 0; }
}
.faq2-halo {
  fill: none;
  stroke: #25D366;
  stroke-width: 1.5;
  opacity: 0.35;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq2Halo 3s ease-in-out infinite;
}
@keyframes faq2Halo {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.22); opacity: 0.8; }
}
.faq2-spark {
  fill: none;
  stroke: #7ef0ab;
  stroke-width: 1.6;
  stroke-linecap: round;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq2Spark 3s ease-in-out infinite;
}
@keyframes faq2Spark {
  0%, 8% { transform: scale(0.3) rotate(0deg); opacity: 0; }
  16% { transform: scale(1) rotate(35deg); opacity: 1; }
  24%, 100% { transform: scale(1.15) rotate(20deg); opacity: 0; }
}
.faq2-bub {
  opacity: 0;
  animation: faq2Bubble 3s ease-in-out infinite;
}
.faq2-bub--d1 { animation-delay: 0s; }
.faq2-bub--d2 { animation-delay: 0.45s; }
.faq2-bub--d3 { animation-delay: 0.9s; }
.faq2-bub-body {
  fill: var(--surface);
  stroke: #25D366;
  stroke-width: 1.5;
}
@keyframes faq2Bubble {
  0%, 10% { opacity: 0; transform: scale(0.9); }
  45%, 88% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.9); }
}

/* FAQ 3 — phone number rows validated with green checks / red crosses */
.faq3-rowbg {
  fill: var(--surface);
  stroke: rgba(37, 211, 102, 0.18);
  stroke-width: 1;
}
.faq3-line {
  fill: var(--text-muted);
  opacity: 0.4;
}
.faq3-row {
  opacity: 0;
  animation: faq3Row 3.6s ease-in-out infinite;
}
.faq3-row--d1 { animation-delay: 0s; }
.faq3-row--d2 { animation-delay: 0.45s; }
.faq3-row--d3 { animation-delay: 0.9s; }
.faq3-row--d4 { animation-delay: 1.35s; }
.faq3-row--d5 { animation-delay: 1.8s; }
@keyframes faq3Row {
  0% { transform: translateX(72px); opacity: 0; }
  14%, 74% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(72px); opacity: 0; }
}
.faq3-check {
  fill: none;
  stroke: #25D366;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: faq3Mark 3.6s ease-in-out infinite;
}
.faq3-check--d1 { animation-delay: 0s; }
.faq3-check--d2 { animation-delay: 0.45s; }
.faq3-check--d3 { animation-delay: 0.9s; }
.faq3-check--d4 { animation-delay: 1.35s; }
.faq3-check--d5 { animation-delay: 1.8s; }
@keyframes faq3Mark {
  0%, 16% { stroke-dashoffset: 60; }
  38%, 72% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 60; }
}
.faq3-cross {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq3Cross 3.6s ease-in-out infinite;
}
.faq3-cross--d {
  fill: none;
  stroke: #EF4444;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@keyframes faq3Cross {
  0%, 16% { opacity: 0; transform: scale(0.5); }
  38%, 72% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.5); }
}

/* FAQ 4 — CSV file flies into database cylinder, counter ticks */
.faq4-route {
  fill: none;
  stroke: #25D366;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 6 8;
  opacity: 0.55;
  animation: faq4Flow 3s linear infinite;
}
@keyframes faq4Flow {
  to { stroke-dashoffset: -56; }
}
.faq4-file-body {
  fill: var(--surface);
  stroke: #25D366;
  stroke-width: 2;
}
.faq4-file-line {
  stroke: #25D366;
  stroke-width: 1.5;
  stroke-linecap: round;
  opacity: 0.35;
}
.faq4-file-move {
  transform-box: fill-box;
  transform-origin: center;
  animation: faq4Move 3s ease-in-out infinite;
}
@keyframes faq4Move {
  0%, 6% { transform: translate(0, 0); opacity: 1; }
  52%, 64% { transform: translate(-116px, 100px); opacity: 1; }
  72%, 100% { transform: translate(-116px, 100px); opacity: 0; }
}
.faq4-db-body {
  fill: rgba(37, 211, 102, 0.1);
  stroke: #25D366;
  stroke-width: 2;
}
.faq4-db-top {
  fill: rgba(37, 211, 102, 0.22);
  stroke: #25D366;
  stroke-width: 2;
}
.faq4-pulse {
  fill: none;
  stroke: #25D366;
  stroke-width: 2;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq4Pulse 3s ease-out infinite;
}
@keyframes faq4Pulse {
  0%, 50% { transform: scale(1); opacity: 0; }
  56% { transform: scale(1); opacity: 0.8; }
  64%, 100% { transform: scale(1.35); opacity: 0; }
}
.faq4-count {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  fill: #7ef0ab;
  font-size: 15px;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq4Count 3s ease-out infinite;
}
@keyframes faq4Count {
  0%, 50% { opacity: 0; transform: translateY(7px); }
  64% { opacity: 1; transform: translateY(0); }
  88%, 100% { opacity: 1; transform: translateY(0); }
}

/* FAQ 5 — growth bars with 3D tops, drawing line chart, download arrow */
.faq5-grow {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: faq5Grow 4s ease-out infinite;
}
.faq5-grow--d1 { animation-delay: 0s; }
.faq5-grow--d2 { animation-delay: 0.25s; }
.faq5-grow--d3 { animation-delay: 0.5s; }
.faq5-grow--d4 { animation-delay: 0.75s; }
@keyframes faq5Grow {
  0%, 3% { transform: scaleY(0.06); opacity: 0; }
  20%, 76% { transform: scaleY(1); opacity: 1; }
  90%, 100% { transform: scaleY(1); opacity: 0; }
}
.faq5-line {
  fill: none;
  stroke: #d9fbe9;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 170;
  stroke-dashoffset: 170;
  animation: faq5Line 4s ease-in-out infinite;
}
@keyframes faq5Line {
  0%, 26% { stroke-dashoffset: 170; }
  58%, 78% { stroke-dashoffset: 0; }
  92%, 100% { stroke-dashoffset: 0; opacity: 0; }
}
.faq5-dl {
  fill: none;
  stroke: #7ef0ab;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  animation: faq5Dl 4s ease-in-out infinite;
}
@keyframes faq5Dl {
  0%, 56% { opacity: 0; transform: translateY(-8px); }
  68% { opacity: 1; transform: translateY(0); }
  74% { transform: translateY(4px); }
  80% { transform: translateY(0); }
  92%, 100% { opacity: 0; transform: translateY(-8px); }
}

/* FAQ 6 — campaign cards fan outward, progress bars fill */
.faq6-move {
  transform-box: fill-box;
  animation: faq6Spread 4s ease-in-out infinite;
}
.faq6-move--l { --tx: -38px; }
.faq6-move--r { --tx: 38px; }
.faq6-move--c { --tx: 0px; }
@keyframes faq6Spread {
  0%, 10% { transform: translateX(0); }
  34%, 62% { transform: translateX(var(--tx, 0px)); }
  86%, 100% { transform: translateX(0); }
}
.faq6-card {
  fill: rgba(37, 211, 102, 0.08);
  stroke: rgba(37, 211, 102, 0.25);
  stroke-width: 1.5;
}
.faq6-line {
  fill: rgba(37, 211, 102, 0.4);
}
.faq6-card-top {
  fill: rgba(37, 211, 102, 0.16);
  stroke: #25D366;
  stroke-width: 2;
}
.faq6-prog {
  fill: #25D366;
  transform-box: fill-box;
  transform-origin: left center;
  animation: faq6Prog 4s ease-in-out infinite;
}
.faq6-prog--d1 { animation-delay: 0.2s; }
.faq6-prog--d2 { animation-delay: 0.55s; }
.faq6-prog--d3 { animation-delay: 0.9s; }
@keyframes faq6Prog {
  0%, 18% { transform: scaleX(0); }
  48%, 78% { transform: scaleX(1); }
  100% { transform: scaleX(1); }
}

/* FAQ 7 — two-column chat, typing then replies, cycles */
.faq7-msg {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq7Msg 5s ease-in-out infinite;
}
.faq7-msg--d1 { animation-delay: 0s; }
.faq7-msg--d2 { animation-delay: 1.1s; }
.faq7-msg--d3 { animation-delay: 2.1s; }
.faq7-msg--d4 { animation-delay: 3s; }
.faq7-msg--d5 { animation-delay: 3.9s; }
@keyframes faq7Msg {
  0%, 8% { opacity: 0; transform: translateY(8px) scale(0.92); }
  18%, 66% { opacity: 1; transform: translateY(0) scale(1); }
  80%, 100% { opacity: 0; transform: translateY(8px) scale(0.92); }
}
.faq7-bub-u {
  fill: #23313c;
}
.faq7-bub-a {
  fill: #25D366;
}
.faq7-bub-text {
  font-size: 8.5px;
  font-weight: 600;
  fill: #ffffff;
  font-family: 'DM Sans', sans-serif;
}
.faq7-type {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq7Type 5s ease-in-out infinite;
}
.faq7-type--d1 { animation-delay: 0.9s; }
.faq7-type--d2 { animation-delay: 3.7s; }
@keyframes faq7Type {
  0%, 16% { opacity: 0; transform: scale(0.85); }
  28%, 42% { opacity: 1; transform: scale(1); }
  52%, 100% { opacity: 0; transform: scale(0.85); }
}
.faq7-tb {
  fill: #23313c;
}
.faq7-tdot {
  fill: #aebacd;
  opacity: 0.35;
  animation: faq7Tdot 1s ease-in-out infinite;
}
.faq7-tdot--2 { animation-delay: 0.15s; }
.faq7-tdot--3 { animation-delay: 0.3s; }
@keyframes faq7Tdot {
  0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-2px); }
}

/* FAQ 8 — inbox tabs with sliding underline, conversation rows refresh */
.faq8-tab {
  fill: rgba(37, 211, 102, 0.08);
  stroke: rgba(37, 211, 102, 0.25);
  stroke-width: 1.5;
}
.faq8-tab-text {
  font-size: 9px;
  font-weight: 700;
  fill: var(--text-muted);
  font-family: 'DM Sans', sans-serif;
}
.faq8-pill {
  animation: faq8TabOff 5s ease-in-out infinite;
}
.faq8-pill--p1 { animation-name: faq8Tab1; }
.faq8-pill--p2 { animation-name: faq8Tab2; }
.faq8-pill--p3 { animation-name: faq8Tab3; }
@keyframes faq8Tab1 {
  0%, 26% { fill: #25D366; stroke: #25D366; }
  36%, 100% { fill: rgba(37, 211, 102, 0.08); stroke: rgba(37, 211, 102, 0.25); }
}
@keyframes faq8Tab2 {
  0%, 30% { fill: rgba(37, 211, 102, 0.08); stroke: rgba(37, 211, 102, 0.25); }
  36%, 50% { fill: #25D366; stroke: #25D366; }
  62%, 100% { fill: rgba(37, 211, 102, 0.08); stroke: rgba(37, 211, 102, 0.25); }
}
@keyframes faq8Tab3 {
  0%, 56% { fill: rgba(37, 211, 102, 0.08); stroke: rgba(37, 211, 102, 0.25); }
  62%, 76% { fill: #25D366; stroke: #25D366; }
  90%, 100% { fill: rgba(37, 211, 102, 0.08); stroke: rgba(37, 211, 102, 0.25); }
}
.faq8-ul {
  fill: #25D366;
  animation: faq8Slide 5s ease-in-out infinite;
}
@keyframes faq8Slide {
  0%, 24% { transform: translateX(0); opacity: 1; }
  36%, 50% { transform: translateX(66px); opacity: 1; }
  62%, 76% { transform: translateX(132px); opacity: 1; }
  90%, 100% { transform: translateX(132px); opacity: 0; }
}
.faq8-rows {
  animation: faq8Rows 5s ease-in-out infinite;
}
@keyframes faq8Rows {
  0%, 12% { opacity: 1; transform: translateY(0); }
  22% { opacity: 0; transform: translateY(-4px); }
  32% { opacity: 1; transform: translateY(0); }
  48% { opacity: 1; transform: translateY(0); }
  56% { opacity: 0; transform: translateY(-4px); }
  66% { opacity: 1; transform: translateY(0); }
  82% { opacity: 1; transform: translateY(0); }
  90% { opacity: 0; transform: translateY(-4px); }
  100% { opacity: 1; transform: translateY(0); }
}
.faq8-avatar {
  fill: rgba(37, 211, 102, 0.18);
  stroke: #25D366;
  stroke-width: 1.5;
}
.faq8-name {
  fill: var(--text-muted);
  opacity: 0.5;
}
.faq8-preview {
  fill: var(--text-muted);
  opacity: 0.3;
}

/* FAQ 9 — data streams to server and turns encrypted */
.faq9-path {
  fill: none;
  stroke: rgba(37, 211, 102, 0.4);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 3 9;
  animation: faq9Flow 4s linear infinite;
}
@keyframes faq9Flow {
  to { stroke-dashoffset: -24; }
}
.faq9-phone {
  fill: rgba(37, 211, 102, 0.12);
  stroke: #25D366;
  stroke-width: 2;
}
.faq9-srv {
  fill: rgba(37, 211, 102, 0.12);
  stroke: #25D366;
  stroke-width: 2;
}
.faq9-srv-onduty {
  fill: rgba(37, 211, 102, 0.35);
  animation: faq9Server 4s ease-out infinite;
}
@keyframes faq9Server {
  0%, 48% { fill: rgba(37, 211, 102, 0.35); }
  62% { fill: rgba(37, 211, 102, 0.7); }
  80%, 100% { fill: rgba(37, 211, 102, 0.35); }
}
.faq9-packet {
  animation: faq9Packet 4s linear infinite;
}
.faq9-packet--d2 { animation-delay: 1.2s; }
@keyframes faq9Packet {
  0% { transform: translate(0px, 0px); opacity: 0; }
  8% { opacity: 1; }
  50% { transform: translate(56px, -30px); opacity: 1; }
  100% { transform: translate(126px, -2px); opacity: 0; }
}
.faq9-packet-g,
.faq9-packet-e {
  r: 3.5px;
  transform-box: fill-box;
  transform-origin: center;
}
.faq9-packet-g {
  fill: #ffffff;
  animation: faq9White 4s linear infinite;
}
.faq9-packet-e {
  fill: #25D366;
  animation: faq9Green 4s linear infinite;
}
.faq9-packet--d2 .faq9-packet-g,
.faq9-packet--d2 .faq9-packet-e {
  animation-delay: 1.2s;
}
@keyframes faq9White {
  0%, 38% { opacity: 0.9; }
  58%, 100% { opacity: 0; }
}
@keyframes faq9Green {
  0%, 46% { opacity: 0; }
  64%, 100% { opacity: 1; }
}
.faq9-padlock-body {
  fill: rgba(37, 211, 102, 0.14);
  stroke: #25D366;
  stroke-width: 2;
}
.faq9-padlock-key {
  fill: #25D366;
}
.faq9-padlock-shackle {
  fill: none;
  stroke: #25D366;
  stroke-width: 3;
  stroke-linecap: round;
  animation: faq9Lock 3s ease-in-out infinite;
}
@keyframes faq9Lock {
  0%, 24% { transform: translateY(-5px); }
  46%, 100% { transform: translateY(0); }
}

/* FAQ 10 — progress steps, travel dot, final burst */
.faq10-conn {
  stroke: #25D366;
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.18;
}
.faq10-step {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq10Step 4s ease-in-out infinite;
}
.faq10-step--d1 { animation-delay: 0s; }
.faq10-step--d2 { animation-delay: 0.8s; }
.faq10-step--d3 { animation-delay: 1.6s; }
.faq10-step--d4 { animation-delay: 2.4s; }
@keyframes faq10Step {
  0%, 10% { opacity: 0; transform: scale(0.4); }
  30%, 86% { opacity: 1; transform: scale(1); }
  98%, 100% { opacity: 1; transform: scale(1); }
}
.faq10-ring {
  fill: rgba(37, 211, 102, 0.12);
  stroke: #25D366;
  stroke-width: 2;
}
.faq10-check {
  fill: none;
  stroke: #0d1117;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  opacity: 0;
  animation: faq10Check 4s ease-in-out infinite;
}
@keyframes faq10Check {
  0%, 20% { opacity: 0; stroke-dashoffset: 30; }
  24% { opacity: 1; }
  42%, 86% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 1; }
}
.faq10-dot {
  fill: #25D366;
  animation: faq10Dot 4s ease-in-out infinite;
}
@keyframes faq10Dot {
  0%, 8% { transform: translate(-45px, 0); opacity: 0; }
  14%, 26% { transform: translate(-45px, 0); opacity: 1; }
  34%, 46% { transform: translate(-15px, 0); opacity: 1; }
  54%, 66% { transform: translate(15px, 0); opacity: 1; }
  74%, 86% { transform: translate(45px, 0); opacity: 1; }
  94%, 100% { transform: translate(45px, 0); opacity: 0; }
}
.faq10-burst {
  fill: none;
  stroke: #7ef0ab;
  stroke-width: 2;
  stroke-linecap: round;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: faq10Burst 4s ease-in-out infinite;
  animation-delay: 2.4s;
}
@keyframes faq10Burst {
  0%, 66% { opacity: 0; transform: scale(0.45); }
  78% { opacity: 1; transform: scale(1); }
  94%, 100% { opacity: 0; transform: scale(1.3); }
}
.faq10-label {
  font-size: 8.5px;
  font-weight: 600;
  fill: var(--text-muted);
  font-family: 'DM Sans', sans-serif;
}

@media (prefers-reduced-motion: reduce) {
  .ws-faq-item,
  .ws-faq-icon,
  .ws-faq-border,
  .ws-faq-panel,
  .ws-faq-question {
    transition: none !important;
  }
  .ws-faq-panel {
    opacity: 1;
  }
  .ws-faq-item--open .ws-faq-border {
    width: 3px;
  }
  .ws-faq-visual * {
    animation: none !important;
  }
  /* FAQ 1 */
  .ws-faq-visual .faq1-ring {
    opacity: 0.55;
    transform: scale(1.6);
  }
  .ws-faq-visual .faq1-shield,
  .ws-faq-visual .faq1-lock {
    transform: scale(1);
  }
  /* FAQ 2 */
  .ws-faq-visual .faq2-dot {
    opacity: 1;
  }
  .ws-faq-visual .faq2-halo {
    opacity: 0.5;
    transform: scale(1.15);
  }
  .ws-faq-visual .faq2-spark {
    opacity: 0;
  }
  .ws-faq-visual .faq2-bub {
    opacity: 1;
    transform: scale(1);
  }
  /* FAQ 3 */
  .ws-faq-visual .faq3-row {
    opacity: 1;
    transform: translateX(0);
  }
  .ws-faq-visual .faq3-check {
    stroke-dashoffset: 0;
  }
  .ws-faq-visual .faq3-cross {
    opacity: 1;
    transform: scale(1);
  }
  /* FAQ 4 */
  .ws-faq-visual .faq4-file-move,
  .ws-faq-visual .faq4-count {
    opacity: 1;
  }
  .ws-faq-visual .faq4-pulse {
    opacity: 0;
  }
  /* FAQ 5 */
  .ws-faq-visual .faq5-grow {
    opacity: 1;
    transform: scaleY(1);
  }
  .ws-faq-visual .faq5-line {
    stroke-dashoffset: 0;
  }
  .ws-faq-visual .faq5-dl {
    opacity: 0;
  }
  /* FAQ 6 */
  .ws-faq-visual .faq6-move {
    transform: translateX(0);
  }
  .ws-faq-visual .faq6-prog {
    transform: scaleX(1);
  }
  /* FAQ 7 */
  .ws-faq-visual .faq7-msg {
    opacity: 0;
  }
  .ws-faq-visual .faq7-msg--static {
    opacity: 1;
  }
  .ws-faq-visual .faq7-type {
    opacity: 0;
  }
  /* FAQ 8 */
  .ws-faq-visual .faq8-pill--p1 {
    fill: #25D366;
    stroke: #25D366;
  }
  .ws-faq-visual .faq8-pill--p2,
  .ws-faq-visual .faq8-pill--p3 {
    fill: rgba(37, 211, 102, 0.08);
    stroke: rgba(37, 211, 102, 0.25);
  }
  .ws-faq-visual .faq8-ul {
    opacity: 1;
    transform: translateX(0);
  }
  .ws-faq-visual .faq8-rows {
    opacity: 1;
    transform: translateY(0);
  }
  /* FAQ 9 */
  .ws-faq-visual .faq9-packet--d1 .faq9-packet-g {
    opacity: 0.9;
  }
  .ws-faq-visual .faq9-packet-e,
  .ws-faq-visual .faq9-packet--d2 {
    opacity: 0;
  }
  .ws-faq-visual .faq9-padlock-shackle {
    transform: translateY(0);
  }
  .ws-faq-visual .faq9-srv-onduty {
    fill: rgba(37, 211, 102, 0.55);
  }
  /* FAQ 10 */
  .ws-faq-visual .faq10-step {
    opacity: 1;
    transform: scale(1);
  }
  .ws-faq-visual .faq10-check {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  .ws-faq-visual .faq10-dot,
  .ws-faq-visual .faq10-burst {
    opacity: 0;
  }
}
`;

const FaqItem = ({ f, isOpen, onToggle }) => {
  const panelRef = useRef(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const next = panelRef.current.scrollHeight;
      setHeight((prev) => (prev === next ? prev : next));
    }
  }, [isOpen]);
  return (
    <motion.div
      variants={fadeUp}
      className={cn('ws-faq-item', isOpen && 'ws-faq-item--open')}
    >
      <span className="ws-faq-border" aria-hidden="true" />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="ws-faq-trigger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#25D366]/40"
      >
        <span className="ws-faq-question text-sm sm:text-[15px] font-semibold">{f.q}</span>
        <span className="ws-faq-icon" aria-hidden="true">
          <Plus size={14} strokeWidth={2.5} />
        </span>
      </button>
      <div
        ref={panelRef}
        className="ws-faq-panel"
        style={{ maxHeight: isOpen ? height : 0 }}
        aria-hidden={!isOpen}
      >
        <div className="ws-faq-answer">
          <p className="ws-faq-text text-sm">{f.a}</p>
        </div>
      </div>
    </motion.div>
  );
};

const FaqVisual = ({ index }) => {
  switch (index) {
    case 0:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <defs>
            <radialGradient id="faq1Grad" cx="50%" cy="32%" r="72%">
              <stop offset="0%" stopColor="rgba(37, 211, 102, 0.2)" />
              <stop offset="100%" stopColor="rgba(37, 211, 102, 0.05)" />
            </radialGradient>
          </defs>
          <circle className="faq1-ring" cx="100" cy="80" r="40" />
          <circle className="faq1-ring faq1-ring--d1" cx="100" cy="80" r="40" />
          <circle className="faq1-ring faq1-ring--d2" cx="100" cy="80" r="40" />
          <g className="faq1-shield" transform="translate(100 82)">
            <path
              d="M0 -26 C9 -19 19 -16 24 -12 L24 8 C24 19 0 29 0 29 C0 29 -24 19 -24 8 L-24 -12 C-19 -16 -9 -19 0 -26 Z"
              fill="url(#faq1Grad)"
              stroke="#25D366"
              strokeWidth="2"
            />
            <g className="faq1-lock">
              <path d="M-9 -7 V-14 a9 9 0 0 1 18 0 V-7" fill="none" stroke="#25D366" strokeWidth="3" strokeLinecap="round" />
              <rect x="-12" y="-7" width="24" height="21" rx="4.5" fill="rgba(37, 211, 102, 0.12)" stroke="#25D366" strokeWidth="2" />
              <circle cx="0" cy="1.5" r="2.4" fill="#25D366" />
              <path d="M0 1.5 V7.5" stroke="#25D366" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <g className="faq2-bub faq2-bub--d1">
            <rect x="16" y="22" width="56" height="26" rx="8" className="faq2-bub-body" />
            <rect x="27" y="32" width="24" height="4" rx="2" fill="#25D366" opacity="0.35" />
          </g>
          <g className="faq2-bub faq2-bub--d2">
            <rect x="126" y="20" width="56" height="26" rx="8" className="faq2-bub-body" />
            <rect x="137" y="30" width="26" height="4" rx="2" fill="#25D366" opacity="0.35" />
          </g>
          <g className="faq2-bub faq2-bub--d3">
            <rect x="120" y="84" width="56" height="26" rx="8" className="faq2-bub-body" />
            <rect x="131" y="94" width="22" height="4" rx="2" fill="#25D366" opacity="0.35" />
          </g>
          <path className="faq2-path" d="M100 86 C78 80 60 64 50 40" />
          <path className="faq2-path" d="M100 86 C122 80 138 64 148 40" />
          <path className="faq2-path" d="M100 86 C112 90 126 96 142 100" />
          <path className="faq2-path" d="M100 86 C100 74 101 60 100 46" />
          <circle className="faq2-dot faq2-dot--d1" cx="100" cy="86" r="3" />
          <circle className="faq2-dot faq2-dot--d2" cx="100" cy="86" r="3" />
          <circle className="faq2-dot faq2-dot--d3" cx="100" cy="86" r="3" />
          <circle className="faq2-dot faq2-dot--d4" cx="100" cy="86" r="3" />
          <g transform="translate(100 86)">
            <circle className="faq2-halo" r="28" />
            <g transform="translate(-22 -20)">
              <path className="faq2-spark" d="M6 -6 L6 -15 M2 -10 L10 -10" />
            </g>
            <circle r="20" fill="rgba(37, 211, 102, 0.12)" stroke="#25D366" strokeWidth="2" />
            <path d="M-9 -8 L-3 -2 L-11 6" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 -10 L8 -4 L-2 6" fill="none" stroke="#25D366" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <path d="M-6 12 L4 12 L10 8" fill="none" stroke="#25D366" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            <circle cx="-8" cy="-8" r="2.2" fill="#25D366" />
            <circle cx="7" cy="-2" r="2.2" fill="#25D366" />
            <circle cx="-2" cy="10" r="2.2" fill="#25D366" />
          </g>
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          {[
            { valid: true },
            { valid: true },
            { valid: false },
            { valid: true },
            { valid: false },
          ].map((row, i) => (
            <g key={i} className={`faq3-row faq3-row--d${i + 1}`}>
              <rect className="faq3-rowbg" x="20" y={14 + i * 24} width="116" height="18" rx="6" />
              <rect className="faq3-line" x="30" y={21 + i * 24} width="72" height="4" rx="2" />
              {row.valid ? (
                <path className={`faq3-check faq3-check--d${i + 1}`} d={`M144 ${22 + i * 24} L149 ${27 + i * 24} L159 ${16 + i * 24}`} />
              ) : (
                <g className="faq3-cross" style={{ animationDelay: `${i * 0.45}s` }} transform={`translate(151 ${22 + i * 24})`}>
                  <path className="faq3-cross--d" d="M-5 -5 L5 5" />
                  <path className="faq3-cross--d" d="M5 -5 L-5 5" />
                </g>
              )}
            </g>
          ))}
        </svg>
      );
    case 3:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <path className="faq4-route" d="M150 22 C130 46 100 84 60 116" />
          <g className="faq4-file-move">
            <rect className="faq4-file-body" x="142" y="14" width="30" height="38" rx="5" />
            <path className="faq4-file-line" d="M150 24 H164 M150 31 H164 M150 38 H160" />
          </g>
          <g transform="translate(54 132)">
            <ellipse className="faq4-db-top" cx="0" cy="-16" rx="26" ry="7" />
            <path className="faq4-db-body" d="M-26 -16 V16 a26 7 0 0 0 52 0 V-16 a26 7 0 0 0 -52 0 Z" />
            <path className="faq4-db-body" d="M-26 -4 a26 7 0 0 0 52 0" fill="none" />
            <circle className="faq4-pulse" cx="0" cy="-14" r="16" />
          </g>
          <text className="faq4-count" x="54" y="150" textAnchor="middle">847</text>
        </svg>
      );
    case 4:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <g transform="translate(100 146)">
            <g className="faq5-dl" transform="translate(0 -128)">
              <path d="M0 0 V18" />
              <path d="M-6 12 L0 20 L6 12" />
              <path d="M-11 30 H11" />
            </g>
            {[88, 68, 48, 30].map((h, i) => (
              <g key={i} className={`faq5-grow faq5-grow--d${i + 1}`}>
                <rect x={-62 + i * 46} y={-h} width="20" height={h} rx="3" fill="#25D366" fillOpacity={1 - i * 0.18} />
                <path
                  d={`M${-62 + i * 46} ${-h} L${-42 + i * 46} ${-h} L${-39 + i * 46} ${-h - 4} L${-59 + i * 46} ${-h - 4} Z`}
                  fill="#7ef0ab"
                  fillOpacity="0.85"
                />
              </g>
            ))}
            <path className="faq5-line" d="M-52 -88 L-6 -68 L40 -48 L86 -30" />
          </g>
        </svg>
      );
    case 5:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <g transform="translate(100 86)">
            <g className="faq6-move faq6-move--l">
              <rect className="faq6-card" x="-42" y="-26" width="84" height="56" rx="8" />
              <rect className="faq6-line" x="-30" y="-10" width="48" height="5" rx="2.5" />
              <rect className="faq6-card" x="-42" y="6" width="84" height="6" rx="3" opacity="0.6" />
              <rect className="faq6-prog faq6-prog--d1" x="-30" y="18" width="46" height="4" rx="2" />
            </g>
            <g className="faq6-move faq6-move--c">
              <rect className="faq6-card faq6-card-top" x="-42" y="-26" width="84" height="56" rx="8" />
              <rect className="faq6-line" x="-30" y="-10" width="48" height="5" rx="2.5" />
              <rect className="faq6-card" x="-42" y="6" width="84" height="6" rx="3" opacity="0.6" />
              <rect className="faq6-prog faq6-prog--d2" x="-30" y="18" width="58" height="4" rx="2" />
            </g>
            <g className="faq6-move faq6-move--r">
              <rect className="faq6-card" x="-42" y="-26" width="84" height="56" rx="8" />
              <rect className="faq6-line" x="-30" y="-10" width="48" height="5" rx="2.5" />
              <rect className="faq6-card" x="-42" y="6" width="84" height="6" rx="3" opacity="0.6" />
              <rect className="faq6-prog faq6-prog--d3" x="-30" y="18" width="68" height="4" rx="2" />
            </g>
          </g>
        </svg>
      );
    case 6:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <g className="faq7-msg faq7-msg--d1 faq7-msg--static">
            <path d="M14 40 L7 48 L25 41 Z" className="faq7-bub-u" />
            <rect className="faq7-bub-u" x="14" y="16" width="80" height="26" rx="9" />
            <text className="faq7-bub-text" x="26" y="32">Launch today?</text>
          </g>
          <g className="faq7-type faq7-type--d1">
            <rect className="faq7-tb" x="110" y="46" width="42" height="20" rx="10" />
            <circle className="faq7-tdot" cx="120" cy="56" r="2.4" />
            <circle className="faq7-tdot faq7-tdot--2" cx="130" cy="56" r="2.4" />
            <circle className="faq7-tdot faq7-tdot--3" cx="140" cy="56" r="2.4" />
          </g>
          <g className="faq7-msg faq7-msg--d2 faq7-msg--static">
            <path d="M186 92 L194 100 L176 93 Z" className="faq7-bub-a" />
            <rect className="faq7-bub-a" x="100" y="74" width="86" height="26" rx="9" />
            <text className="faq7-bub-text" x="112" y="90">5 leads assigned ⚡</text>
          </g>
          <g className="faq7-msg faq7-msg--d3">
            <path d="M14 106 L7 114 L25 107 Z" className="faq7-bub-u" />
            <rect className="faq7-bub-u" x="14" y="88" width="78" height="26" rx="9" />
            <text className="faq7-bub-text" x="26" y="104">Great! Keep pushing</text>
          </g>
          <g className="faq7-type faq7-type--d2">
            <rect className="faq7-tb" x="110" y="108" width="42" height="20" rx="10" />
            <circle className="faq7-tdot" cx="120" cy="118" r="2.4" />
            <circle className="faq7-tdot faq7-tdot--2" cx="130" cy="118" r="2.4" />
            <circle className="faq7-tdot faq7-tdot--3" cx="140" cy="118" r="2.4" />
          </g>
          <g className="faq7-msg faq7-msg--d4">
            <path d="M186 150 L194 158 L176 151 Z" className="faq7-bub-a" />
            <rect className="faq7-bub-a" x="100" y="132" width="86" height="26" rx="9" />
            <text className="faq7-bub-text" x="112" y="148">Reply rate +38%</text>
          </g>
        </svg>
      );
    case 7:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <g>
            <rect className="faq8-tab faq8-pill--p1" x="16" y="26" width="40" height="22" rx="6" />
            <text className="faq8-tab-text" x="36" y="41" textAnchor="middle">All</text>
            <rect className="faq8-tab faq8-pill--p2" x="70" y="26" width="54" height="22" rx="6" />
            <text className="faq8-tab-text" x="97" y="41" textAnchor="middle">Replied</text>
            <rect className="faq8-tab faq8-pill--p3" x="138" y="26" width="52" height="22" rx="6" />
            <text className="faq8-tab-text" x="164" y="41" textAnchor="middle">Pending</text>
            <rect className="faq8-ul" x="16" y="52" width="40" height="3.5" rx="1.75" />
          </g>
          <g className="faq8-rows" transform="translate(0 64)">
            {[26, 54, 82].map((y) => (
              <g key={y}>
                <circle className="faq8-avatar" cx="26" cy={y} r="6" />
                <rect className="faq8-name" x="38" y={y - 7} width="46" height="5" rx="2.5" />
                <rect className="faq8-preview" x="38" y={y + 2} width="84" height="5" rx="2.5" />
              </g>
            ))}
          </g>
        </svg>
      );
    case 8:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <g transform="translate(16 62)">
            <rect className="faq9-phone" x="0" y="0" width="28" height="46" rx="6" />
            <rect x="10" y="4" width="8" height="4" rx="2" fill="rgba(37, 211, 102, 0.5)" />
            <rect x="6" y="38" width="16" height="4" rx="2" fill="rgba(37, 211, 102, 0.5)" />
          </g>
          <g transform="translate(156 60)">
            <rect className="faq9-srv" x="0" y="0" width="34" height="10" rx="3" />
            <rect className="faq9-srv faq9-srv-onduty" x="0" y="14" width="34" height="10" rx="3" />
            <rect className="faq9-srv" x="0" y="28" width="34" height="10" rx="3" />
          </g>
          <path className="faq9-path" d="M44 72 C70 28 130 28 156 66" />
          <g className="faq9-packet faq9-packet--d1" transform="translate(44 72)">
            <circle className="faq9-packet-g" cx="0" cy="0" r="3.5" />
            <circle className="faq9-packet-e" cx="0" cy="0" r="3.5" />
          </g>
          <g className="faq9-packet faq9-packet--d2" transform="translate(44 72)">
            <circle className="faq9-packet-g" cx="0" cy="0" r="3.5" />
            <circle className="faq9-packet-e" cx="0" cy="0" r="3.5" />
          </g>
          <g transform="translate(100 36)">
            <rect className="faq9-padlock-body" x="-11" y="-6" width="22" height="18" rx="4" />
            <circle className="faq9-padlock-key" cx="0" cy="3" r="2.6" />
            <path className="faq9-padlock-shackle" d="M-8 -6 V-13 a8 8 0 0 1 16 0 V-6" />
          </g>
        </svg>
      );
    case 9:
      return (
        <svg viewBox="0 0 200 120" aria-hidden="true">
          <g transform="translate(100 44)">
            <line className="faq10-conn" x1="-45" y1="0" x2="45" y2="0" />
            {[-45, -15, 15, 45].map((x, i) => (
              <circle key={`o${i}`} className="faq10-conn" cx={x} cy="0" r="13" fill="none" />
            ))}
            {[-45, -15, 15, 45].map((x, i) => (
              <g key={x} className={`faq10-step faq10-step--d${i + 1}`} transform={`translate(${x} 0)`}>
                <circle className="faq10-ring" r="13" />
                <path className="faq10-check" d="M-5 0 L-1 4 L6 -4" />
              </g>
            ))}
            <circle className="faq10-dot" cx="0" cy="0" r="4" />
            <g className="faq10-burst" transform="translate(45 0)" stroke="#7ef0ab">
              <path d="M45 -22 L45 -12 M45 12 L45 22 M28 -20 L32 -13 M58 -20 L54 -13 M28 20 L32 13 M58 20 L54 13" />
            </g>
          </g>
          {['Sign Up', 'Connect', 'Import', 'Launch'].map((label, i) => (
            <text key={label} className="faq10-label" x={100 - 45 + i * 30} y={70} textAnchor="middle">
              {label}
            </text>
          ))}
        </svg>
      );
    default:
      return null;
  }
};

export const FaqSection = () => {
  const [open, setOpen] = useState(0);
  const [active, setActive] = useState(0);
  const card = FAQS[active];
  return (
    <div className="max-w-6xl mx-auto">
      <style>{FAQ_ACCORDION_CSS}</style>
      <SectionHeading eyebrow="FAQ" badge="Questions" title="Common Questions, Straight Answers" />
      <div className="grid grid-cols-1 md:grid-cols-[30%_70%] gap-6 md:gap-8 lg:gap-10 items-start">
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="ws-faq-left-card rounded-xl p-4 sm:p-5 shadow-sm flex flex-col"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
            >
              <div className={cn('ws-faq-visual', active === 0 && 'faq1-bg', active === 9 && 'faq9-bg')}>
                <FaqVisual index={active} />
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1 text-[11px] font-semibold text-[#1da851]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" aria-hidden="true" />
                {card.label}
              </span>
              <h3 className="mt-3 text-xl sm:text-[22px] font-bold leading-tight text-text-primary">
                {card.heading}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary line-clamp-2">
                {card.desc}
              </p>
<div className="ws-faq-reviews">
                <div className="ws-faq-reviews-row">
                  <AvatarStack ariaLabel="Trusted by 200+ teams" />
                  <span className="ws-faq-reviews-text">Trusted by 200+ teams</span>
                </div>
                <div className="ws-faq-reviews-stars" aria-label="5 out of 5 stars" role="img">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="ws-star" style={{ animationDelay: `${i * 0.08}s` }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2l2.9 6.26 6.86.6-5.17 4.58 1.52 6.73L12 16.77 5.89 20.17l1.52-6.73-5.17-4.58 6.86-.6L12 2z" />
                      </svg>
                    </span>
                  ))}
                </div>
                <p className="ws-faq-reviews-note">See why teams love WhatsApp Shield</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.aside>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="flex flex-col gap-2.5 sm:gap-3 min-w-0"
        >
          {FAQS.map((f, i) => (
            <FaqItem
              key={f.q}
              f={f}
              isOpen={open === i}
              onToggle={() => {
                setOpen(open === i ? null : i);
                setActive(i);
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
};

/* ---------- FINAL CTA ---------- */
export const FinalCta = () => (
  <div className="relative">
    <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-[#25D366]/10 blur-2xl" aria-hidden="true" />
    <div className="relative max-w-3xl mx-auto text-center">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
        <motion.div variants={fadeUp}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/5 px-3 py-1 text-xs font-semibold text-[#1da851] mb-5">
            <Sparkles size={12} /> Turn WhatsApp into a growth channel
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-3 leading-tight">
            Your WhatsApp Growth System<br className="hidden sm:block" /> Starts Here.
          </h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto mb-7 leading-relaxed">
            Find better leads. Start better conversations. Follow up faster. Close more customers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link to="/dashboard">Get Started <ArrowRight size={15} className="ml-2" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/message-agent">Explore Message Agent</Link>
            </Button>
          </div>
          <p className="text-[11px] text-text-muted mt-5">
            Connect with a QR code · works with your own WhatsApp number · local-first
          </p>
        </motion.div>
      </motion.div>
    </div>
  </div>
);

/* ---------- HERO ---------- */
export const HeroSection = () => (
  <section className="relative w-full py-14 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
    <div className="absolute inset-0 z-0">
      <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-80" />
    </div>

    <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center">
      <div className="text-center lg:text-left">
        <motion.div initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} className="flex items-center justify-center lg:justify-start gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-primary">
              <Shield size={12} /> WhatsApp Shield
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full border border-[#25D366]/25 bg-[#25D366]/5 px-3 py-1 text-[#1da851]">
              <MessageCircle size={12} /> WhatsApp Message Agent
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight leading-tight mb-4">
            Find Your Next Business Leads.<br className="hidden sm:block" />{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Reach Them Through WhatsApp.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto lg:mx-0 leading-relaxed mb-6">
            Discover, organize, validate, and manage business leads through one modern WhatsApp-focused platform.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
            <Button asChild>
              <Link to="/dashboard">Explore the Platform <ArrowRight size={14} className="ml-2" /></Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/user-guide">View Guide</Link>
            </Button>
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-wrap justify-center lg:justify-start gap-2.5 mt-6 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-primary" /> Shield-validated lists</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles size={13} className="text-primary" /> AI-assisted conversations</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={13} className="text-primary" /> Local-first &amp; private</span>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6 }}
      >
        <HeroWorkflow />
      </motion.div>
    </div>
  </section>
);