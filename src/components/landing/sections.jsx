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

/* ============================================================
   FAQ animation boxes — clean, self-contained.
   Desktop left card: 200px. Mobile accordion inline: 180px.
   The SVG animation IS the visual; nothing is layered on top.
   ============================================================ */
.ws-faq-visual {
  position: relative;
  width: 100%;
  height: 200px;
  border-radius: 12px;
  background: #060d0a;
  overflow: hidden;
}
.ws-faq-visual--inline {
  height: 160px;
  border-radius: 8px;
}
.ws-faq-visual svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  overflow: hidden;
}
.ws-faq-visual--inline svg {
  width: 100%;
  height: 100%;
}
.ws-faq-inline-anim {
  margin: 12px 0 8px;
}
@media (min-width: 768px) {
  .ws-faq-inline-anim {
    display: none;
  }
}

/* performance: pause while closed, run while open */
.ws-faq-visual:not(.ws-faq-visual--running) .waf-anim *, 
.ws-faq-item:not(.ws-faq-item--open) .ws-faq-inline-anim .waf-anim * {
  animation-play-state: paused;
}
.waf-anim .q-anim {
  will-change: transform;
}

/* mobile FAQ cards — compact, no animation when closed */
@media (max-width: 767px) {
  .ws-faq-item {
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
  }
  .ws-faq-item--open {
    background: rgba(37, 211, 102, 0.05);
    border: 1px solid rgba(37, 211, 102, 0.3);
    border-left: 3px solid #25D366;
  }
  .ws-faq-border {
    display: none;
  }
  .ws-faq-trigger {
    padding: 14px 16px;
  }
  .ws-faq-answer {
    padding: 0 0 4px;
  }
  .ws-faq-panel {
    transition: max-height 0.4s ease, opacity 0.4s ease;
  }
  .ws-faq-inline-anim {
    margin: 12px 0 8px;
  }
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

/* ============================================================
   FAQ animations — business-product UI mockups in motion.
   Desktop: 320x200 canvas. Mobile: 320x160 (content scaled 0.8).
   Calm, smooth, dashboard aesthetic.
   ============================================================ */

/* FAQ 1 — WhatsApp Shield: account status dashboard */
.q1-badge {
  transform-box: fill-box;
  transform-origin: center;
  animation: q1Badge 2s ease-in-out infinite;
  will-change: transform;
}
@keyframes q1Badge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
.q1-row {
  opacity: 0;
  animation: q1Row 8s ease-in-out infinite;
  will-change: transform;
}
.q1-row--d2 { animation-delay: 0.3s; }
.q1-row--d3 { animation-delay: 0.6s; }
@keyframes q1Row {
  0% { transform: translateX(-28px); opacity: 0; }
  8% { opacity: 1; }
  14%, 88% { transform: translateX(0); opacity: 1; }
  96%, 100% { transform: translateX(-28px); opacity: 0; }
}
.q1-bar {
  transform-box: fill-box;
  transform-origin: left center;
  animation: q1Bar 8s ease-out infinite;
  animation-delay: 0.9s;
}
@keyframes q1Bar {
  0%, 12% { transform: scaleX(0); }
  30%, 88% { transform: scaleX(1); }
  96%, 100% { transform: scaleX(0); }
}

/* FAQ 2 — Message Agent: AI typing a message in a chat composer */
.q2-mask {
  animation: q2Mask 5s linear infinite;
}
@keyframes q2Mask {
  0%, 8% { clip-path: inset(0 100% 0 0); }
  42%, 100% { clip-path: inset(0 0 0 0); }
}
.q2-cursor {
  transform-box: fill-box;
  animation: q2Cur 0.8s steps(1) infinite;
}
@keyframes q2Cur {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.q2-send {
  transform-box: fill-box;
  transform-origin: center;
  animation: q2Send 5s ease-in-out infinite;
}
@keyframes q2Send {
  0%, 22% { opacity: 0.85; transform: scale(1); }
  36% { opacity: 1; transform: scale(1.12); }
  48%, 100% { opacity: 1; transform: scale(1); }
}
.q2-out {
  opacity: 0;
  animation: q2Out 5s ease-in-out infinite;
  will-change: transform;
}
@keyframes q2Out {
  0%, 26% { opacity: 0; transform: translateY(10px) scale(0.94); }
  40% { opacity: 1; transform: translateY(0) scale(1); }
  88% { opacity: 1; transform: translateY(0) scale(1); }
  96%, 100% { opacity: 0; transform: translateY(0) scale(1); }
}
.q2-in {
  opacity: 0;
  animation: q2In 5s ease-in-out infinite;
  will-change: transform;
}
@keyframes q2In {
  0%, 52% { opacity: 0; transform: translateY(10px) scale(0.94); }
  64% { opacity: 1; transform: translateY(0) scale(1); }
  88% { opacity: 1; transform: translateY(0) scale(1); }
  96%, 100% { opacity: 0; transform: translateY(0) scale(1); }
}
.q2-composer {
  opacity: 0;
  animation: q2Composer 5s ease-in-out infinite;
}
@keyframes q2Composer {
  0%, 44% { opacity: 1; }
  48%, 100% { opacity: 0.4; }
}

/* FAQ 3 — contact validation: spreadsheet list, row selection, status badges */
.q3-row {
  opacity: 0;
  animation: q3Row 5s ease-in-out infinite;
  will-change: transform;
}
@keyframes q3Row {
  0% { transform: translateX(-24px); opacity: 0; }
  10%, 88% { transform: translateX(0); opacity: 1; }
  96%, 100% { transform: translateX(-24px); opacity: 0; }
}
.q3-hi {
  opacity: 0;
  animation: q3Hi 5s ease-in-out infinite;
}
@keyframes q3Hi {
  0%, 20% { opacity: 0; }
  26%, 44% { opacity: 1; }
  48%, 100% { opacity: 0; }
}
.q3-badge {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: q3Badge 5s ease-in-out infinite;
}
@keyframes q3Badge {
  0%, 22% { opacity: 0; transform: scale(0.9); }
  30%, 88% { opacity: 1; transform: scale(1); }
  96%, 100% { opacity: 0; transform: scale(1); }
}
.q3-count {
  opacity: 0;
  animation: q3Count 5s ease-in-out infinite;
  animation-delay: 2.6s;
}
@keyframes q3Count {
  0%, 10% { opacity: 0; }
  24%, 90% { opacity: 1; }
  96%, 100% { opacity: 0; }
}

/* FAQ 4 — contacts import: CSV upload into a dropzone, progress, success, rows */
.q4-file {
  transform-box: fill-box;
  transform-origin: center;
  animation: q4File 5s ease-in-out infinite;
  will-change: transform;
}
@keyframes q4File {
  0%, 14% { transform: translateY(0); opacity: 1; }
  26% { transform: translateY(38px); opacity: 1; }
  34%, 100% { transform: translateY(38px); opacity: 0; }
}
.q4-drop {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: q4Drop 5s ease-in-out infinite;
}
@keyframes q4Drop {
  0%, 20% { opacity: 0; transform: translateY(-6px); }
  32% { opacity: 1; transform: translateY(0); }
  44%, 100% { opacity: 0; transform: translateY(0); }
}
.q4-fill {
  transform-box: fill-box;
  transform-origin: left center;
  animation: q4Fill 5s ease-out infinite;
}
@keyframes q4Fill {
  0%, 30% { transform: scaleX(0); }
  56%, 88% { transform: scaleX(1); }
  96%, 100% { transform: scaleX(1); }
}
.q4-ok {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: q4Ok 5s ease-out infinite;
}
@keyframes q4Ok {
  0%, 56% { opacity: 0; transform: scale(0.8); }
  66%, 88% { opacity: 1; transform: scale(1); }
  96%, 100% { opacity: 1; transform: scale(1); }
}
.q4-row {
  opacity: 0;
  animation: q4Row 5s ease-in-out infinite;
}
@keyframes q4Row {
  0%, 60% { opacity: 0; transform: translateY(6px); }
  74%, 88% { opacity: 1; transform: translateY(0); }
  96%, 100% { opacity: 1; transform: translateY(0); }
}

/* FAQ 5 — analytics dashboard: metric cards, bars, export action */
.q5-card {
  opacity: 0;
  animation: q5Card 5s ease-in-out infinite;
  will-change: transform;
}
.q5-card--d2 { animation-delay: 0.18s; }
.q5-card--d3 { animation-delay: 0.36s; }
@keyframes q5Card {
  0% { opacity: 0; transform: translateY(8px); }
  14%, 88% { opacity: 1; transform: translateY(0); }
  96%, 100% { opacity: 0; transform: translateY(0); }
}
.q5-bar {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: q5Bar 5s ease-out infinite;
  will-change: transform;
}
.q5-bar--d2 { animation-delay: 0.3s; }
.q5-bar--d3 { animation-delay: 0.6s; }
@keyframes q5Bar {
  0%, 16% { transform: scaleY(0); opacity: 0; }
  24%, 82% { transform: scaleY(1); opacity: 1; }
  92%, 100% { transform: scaleY(0); opacity: 0; }
}
.q5-col {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.5px;
  fill: rgba(255, 255, 255, 0.4);
  animation: q5Col 5s ease-in-out infinite;
}
.q5-col--d2 { animation-delay: 0.3s; }
.q5-col--d3 { animation-delay: 0.6s; }
@keyframes q5Col {
  0%, 16% { opacity: 0; }
  24%, 82% { opacity: 1; }
  92%, 100% { opacity: 0; }
}
.q5-exp {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: q5Exp 5s ease-in-out infinite;
  animation-delay: 2.2s;
}
@keyframes q5Exp {
  0%, 44% { opacity: 0; transform: scale(1); }
  48% { opacity: 1; transform: scale(1); }
  54% { transform: scale(1.1); }
  60%, 88% { opacity: 1; transform: scale(1); }
  96%, 100% { opacity: 0; transform: scale(1); }
}
.q5-arrow {
  opacity: 0;
  animation: q5Arr 5s ease-in-out infinite;
  animation-delay: 2.6s;
}
@keyframes q5Arr {
  0%, 50% { opacity: 0; transform: translateY(-8px); }
  60%, 84% { opacity: 1; transform: translateY(0); }
  94%, 100% { opacity: 0; transform: translateY(0); }
}
.q5-report {
  opacity: 0;
  animation: q5Rep 5s ease-in-out infinite;
  animation-delay: 3s;
  will-change: transform;
}
@keyframes q5Rep {
  0%, 56% { opacity: 0; transform: translateY(26px); }
  66%, 88% { opacity: 1; transform: translateY(0); }
  96%, 100% { opacity: 0; transform: translateY(0); }
}

/* FAQ 6 — campaign manager: campaign rows, active badges, independent progress */
.q6-row {
  opacity: 0;
  animation: q6Row 5s ease-in-out infinite;
  will-change: transform;
}
.q6-row--d2 { animation-delay: 0.25s; }
.q6-row--d3 { animation-delay: 0.5s; }
@keyframes q6Row {
  0% { transform: translateX(28px); opacity: 0; }
  10%, 88% { transform: translateX(0); opacity: 1; }
  96%, 100% { transform: translateX(28px); opacity: 0; }
}
.q6-bar {
  transform-box: fill-box;
  transform-origin: left center;
  animation: q6Bar 5s ease-in-out infinite;
}
.q6-bar--c2 { --q6-prog: 0.45; }
.q6-bar--c3 { --q6-prog: 0.78; }
@keyframes q6Bar {
  0%, 14% { transform: scaleX(0); }
  30%, 82% { transform: scaleX(var(--q6-prog, 0.45)); }
  92%, 100% { transform: scaleX(0); }
}
.q6-badge {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: q6Badge 5s ease-in-out infinite;
}
.q6-badge--d2 { animation-delay: 0.35s; }
.q6-badge--d3 { animation-delay: 0.7s; }
@keyframes q6Badge {
  0%, 16% { opacity: 0; transform: scale(0.9); }
  24%, 82% { opacity: 1; transform: scale(1); }
  92%, 100% { opacity: 0; transform: scale(1); }
}
.q6-pill {
  opacity: 0;
  animation: q6Pill 1.6s ease-in-out infinite;
}
@keyframes q6Pill {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
.q6-add {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: q6Add 5s ease-in-out infinite;
  animation-delay: 3.6s;
}
@keyframes q6Add {
  0%, 70% { opacity: 0; transform: scale(0.92); }
  76% { opacity: 1; transform: scale(1); }
  80% { transform: scale(1.05); }
  84% { transform: scale(1); }
  90%, 100% { opacity: 0; transform: scale(1); }
}

/* FAQ 7 — Message Agent handling a conversation: persisted thread */
.q7-m1 { animation: q7Persist 6s 0s infinite; }
.q7-m2 { animation: q7Persist 6s 1.3s infinite; }
.q7-m3 { animation: q7Persist 6s 2.8s infinite; }
.q7-m4 { animation: q7Persist 6s 4.2s infinite; }
.q7-msg {
  will-change: transform;
}
@keyframes q7Persist {
  0%, 4% { opacity: 0; transform: translateY(12px); }
  12%, 86% { opacity: 1; transform: translateY(0); }
  96%, 100% { opacity: 0; transform: translateY(0); }
}
.q7-ty1 { animation: q7Typ 6s infinite; animation-delay: 1.85s; }
.q7-ty2 { animation: q7Typ 6s infinite; animation-delay: 5.3s; }
@keyframes q7Typ {
  0%, 14% { opacity: 0; }
  26%, 52% { opacity: 1; }
  68%, 100% { opacity: 0; }
}
.q7-dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: q7Dot 1s ease-in-out infinite;
}
.q7-dot--2 { animation-delay: 0.2s; }
.q7-dot--3 { animation-delay: 0.4s; }
@keyframes q7Dot {
  0%, 100% { transform: scale(0.6); opacity: 0.5; }
  50% { transform: scale(1); opacity: 1; }
}
.q7-label {
  font-size: 9px;
  font-weight: 600;
  fill: rgba(37, 211, 102, 0.85);
}
.q7-avatar { fill: rgba(37, 211, 102, 0.3); }
.q7-meta {
  font-size: 9px;
  fill: rgba(255, 255, 255, 0.45);
}

/* FAQ 8 — inbox: pill tabs with switching active state + conversation rows */
.q8-tab--t1 { animation: q8Tab1 6s ease-in-out infinite; }
.q8-tab--t2 { animation: q8Tab2 6s ease-in-out infinite; }
.q8-tab--t3 { animation: q8Tab3 6s ease-in-out infinite; }
@keyframes q8Tab1 {
  0%, 30% { fill: #25D366; stroke: #25D366; }
  38%, 100% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
}
@keyframes q8Tab2 {
  0%, 36% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
  42%, 64% { fill: #25D366; stroke: #25D366; }
  72%, 100% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
}
@keyframes q8Tab3 {
  0%, 68% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
  74%, 96% { fill: #25D366; stroke: #25D366; }
  100% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
}
.q8-tab-text--t1 { animation: q8Text1 6s ease-in-out infinite; }
.q8-tab-text--t2 { animation: q8Text2 6s ease-in-out infinite; }
.q8-tab-text--t3 { animation: q8Text3 6s ease-in-out infinite; }
@keyframes q8Text1 {
  0%, 30% { fill: #ffffff; }
  38%, 100% { fill: rgba(255, 255, 255, 0.45); }
}
@keyframes q8Text2 {
  0%, 36% { fill: rgba(255, 255, 255, 0.45); }
  42%, 64% { fill: #ffffff; }
  72%, 100% { fill: rgba(255, 255, 255, 0.45); }
}
@keyframes q8Text3 {
  0%, 68% { fill: rgba(255, 255, 255, 0.45); }
  74%, 96% { fill: #ffffff; }
  100% { fill: rgba(255, 255, 255, 0.45); }
}
.q8-rows--a { animation: q8RowsA 6s ease-in-out infinite; }
.q8-rows--b { animation: q8RowsB 6s ease-in-out infinite; }
.q8-rows--c { animation: q8RowsC 6s ease-in-out infinite; }
@keyframes q8RowsA {
  0%, 14% { opacity: 1; transform: translateY(0); }
  22%, 100% { opacity: 0; transform: translateY(-6px); }
}
@keyframes q8RowsB {
  0%, 24% { opacity: 0; transform: translateY(8px); }
  30%, 52% { opacity: 1; transform: translateY(0); }
  60%, 100% { opacity: 0; transform: translateY(-6px); }
}
@keyframes q8RowsC {
  0%, 62% { opacity: 0; transform: translateY(8px); }
  68%, 92% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-6px); }
}
.q8-badge {
  opacity: 0;
  animation: q8Badge 6s ease-in-out infinite;
}
@keyframes q8Badge {
  0%, 68% { opacity: 0; transform: scale(1); }
  74% { opacity: 1; transform: scale(1); }
  78% { transform: scale(1.15); }
  82% { transform: scale(1); }
  86% { transform: scale(1.08); }
  90% { transform: scale(1); }
  98%, 100% { opacity: 0; transform: scale(1); }
}
.q8-avatar { fill: rgba(37, 211, 102, 0.18); stroke: #25D366; stroke-width: 1.4; }
.q8-name { font-size: 10px; font-weight: 600; fill: rgba(255, 255, 255, 0.95); }
.q8-preview { font-size: 9px; fill: rgba(255, 255, 255, 0.5); }
.q8-time { font-size: 9px; fill: rgba(255, 255, 255, 0.35); }

/* FAQ 9 — security status dashboard: locked card, detail rows, chip */
.q9-glow {
  opacity: 0.5;
  animation: q9Glow 2s ease-in-out infinite;
  will-change: transform;
}
@keyframes q9Glow {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.7; }
}
.q9-lock {
  transform-box: fill-box;
  transform-origin: center;
  animation: q9Lock 2s ease-in-out infinite;
  will-change: transform;
}
@keyframes q9Lock {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
.q9-row {
  opacity: 0;
  animation: q9Row 5s ease-in-out infinite;
  will-change: transform;
}
.q9-row--d2 { animation-delay: 0.3s; }
.q9-row--d3 { animation-delay: 0.6s; }
@keyframes q9Row {
  0% { opacity: 0; transform: translateX(-18px); }
  10%, 88% { opacity: 1; transform: translateX(0); }
  96%, 100% { opacity: 0; transform: translateX(-18px); }
}
.q9-dot { animation: q9Dot 2s ease-in-out infinite; }
@keyframes q9Dot {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.q9-chip {
  opacity: 0;
  animation: q9Chip 5s ease-in-out infinite;
  animation-delay: 1s;
}
@keyframes q9Chip {
  0%, 18% { opacity: 0; }
  28%, 88% { opacity: 1; }
  96%, 100% { opacity: 0; }
}
.q9-head { font-size: 13px; font-weight: 700; fill: #ffffff; }
.q9-sub { font-size: 9.5px; fill: rgba(255, 255, 255, 0.55); }
.q9-label { font-size: 10px; fill: rgba(255, 255, 255, 0.9); }
.q9-chip-text { font-size: 9px; font-weight: 600; fill: #4ade80; }

/* FAQ 10 — onboarding checklist: steps complete in sequence, bar fills, ready */
.q10-title { font-size: 13px; font-weight: 700; fill: #ffffff; }
.q10-sub { font-size: 9px; fill: rgba(255, 255, 255, 0.5); }
.q10-prog {
  transform-box: fill-box;
  transform-origin: left center;
  animation: q10Prog 5s ease-in-out infinite;
}
@keyframes q10Prog {
  0% { transform: scaleX(0); }
  18%, 30% { transform: scaleX(0.25); }
  32%, 44% { transform: scaleX(0.5); }
  46%, 58% { transform: scaleX(0.75); }
  60%, 88% { transform: scaleX(1); }
  96%, 100% { transform: scaleX(0); }
}
.q10-step {
  opacity: 0;
  animation: q10Step1 5s ease-in-out infinite;
  will-change: transform, opacity;
}
.q10-step--e2 { animation-name: q10Step2; }
.q10-step--e3 { animation-name: q10Step3; }
.q10-step--e4 { animation-name: q10Step4; }
@keyframes q10Step1 {
  0%, 10% { opacity: 0; transform: translateY(8px); }
  16%, 84% { opacity: 1; transform: translateY(0); }
  92%, 100% { opacity: 0; transform: translateY(4px); }
}
@keyframes q10Step2 {
  0%, 24% { opacity: 0; transform: translateY(8px); }
  30%, 84% { opacity: 1; transform: translateY(0); }
  92%, 100% { opacity: 0; transform: translateY(4px); }
}
@keyframes q10Step3 {
  0%, 38% { opacity: 0; transform: translateY(8px); }
  44%, 84% { opacity: 1; transform: translateY(0); }
  92%, 100% { opacity: 0; transform: translateY(4px); }
}
@keyframes q10Step4 {
  0%, 52% { opacity: 0; transform: translateY(8px); }
  58%, 84% { opacity: 1; transform: translateY(0); }
  92%, 100% { opacity: 0; transform: translateY(4px); }
}
.q10-box {
  fill: rgba(37, 211, 102, 0.14);
  stroke: rgba(37, 211, 102, 0.65);
  stroke-width: 1.6;
  animation: q10Box 5s ease-in-out infinite;
}
@keyframes q10Box {
  0%, 12% { fill: rgba(37, 211, 102, 0.14); stroke: rgba(37, 211, 102, 0.65); }
  22%, 84% { fill: #25d366; stroke: #25d366; }
  96%, 100% { fill: #25d366; stroke: #25d366; }
}
.q10-tick {
  fill: none;
  stroke: #060d0a;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 18;
  stroke-dashoffset: 18;
  opacity: 0;
  animation: q10Tick 5s ease-in-out infinite;
}
@keyframes q10Tick {
  0%, 22% { opacity: 0; stroke-dashoffset: 18; }
  32%, 84% { opacity: 1; stroke-dashoffset: 0; }
  96%, 100% { opacity: 0; stroke-dashoffset: 0; }
}
.q10-label {
  fill: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  font-weight: 500;
  animation: q10Label 5s ease-in-out infinite;
}
@keyframes q10Label {
  0%, 30% { fill: rgba(255, 255, 255, 0.6); }
  40%, 84% { fill: #ffffff; }
  96%, 100% { fill: #ffffff; }
}
.q10-done {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: q10Done 5s ease-in-out infinite;
}
@keyframes q10Done {
  0%, 36% { opacity: 0; transform: scale(0.85); }
  46%, 84% { opacity: 1; transform: scale(1); }
  96%, 100% { opacity: 0; transform: scale(1); }
}
.q10-ready {
  opacity: 0;
  animation: q10Ready 5s ease-in-out infinite;
  will-change: transform, opacity;
}
@keyframes q10Ready {
  0%, 76% { opacity: 0; transform: scale(0.94); }
  82%, 88% { opacity: 1; transform: scale(1); }
  94%, 100% { opacity: 0; transform: scale(1); }
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
    animation-play-state: paused !important;
  }
  /* FAQ 1 */
  .ws-faq-visual .q1-badge {
    transform: scale(1);
  }
  .ws-faq-visual .q1-row {
    opacity: 1;
    transform: translateX(0);
  }
  .ws-faq-visual .q1-bar {
    transform: scaleX(1);
  }
  /* FAQ 2 */
  .ws-faq-visual .q2-mask {
    clip-path: inset(0 0 0 0);
  }
  .ws-faq-visual .q2-composer {
    opacity: 1;
  }
  /* FAQ 3 */
  .ws-faq-visual .q3-row {
    opacity: 1;
    transform: translateX(0);
  }
  .ws-faq-visual .q3-hi {
    opacity: 0;
  }
  .ws-faq-visual .q3-badge {
    opacity: 1;
    transform: scale(1);
  }
  .ws-faq-visual .q3-count {
    opacity: 1;
  }
  /* FAQ 4 */
  .ws-faq-visual .q4-file {
    opacity: 1;
    transform: translateY(0);
  }
  .ws-faq-visual .q4-fill {
    transform: scaleX(1);
  }
  .ws-faq-visual .q4-ok,
  .ws-faq-visual .q4-row {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  /* FAQ 5 */
  .ws-faq-visual .q5-card {
    opacity: 1;
    transform: translateY(0);
  }
  .ws-faq-visual .q5-bar {
    opacity: 1;
    transform: scaleY(1);
  }
  .ws-faq-visual .q5-exp,
  .ws-faq-visual .q5-arrow,
  .ws-faq-visual .q5-report {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  /* FAQ 6 */
  .ws-faq-visual .q6-row {
    opacity: 1;
    transform: translateX(0);
  }
  .ws-faq-visual .q6-bar {
    transform: scaleX(var(--q6-prog, 1));
  }
  .ws-faq-visual .q6-badge,
  .ws-faq-visual .q6-add {
    opacity: 1;
    transform: scale(1);
  }
  /* FAQ 7 */
  .ws-faq-visual .q7-msg {
    opacity: 1;
    transform: translateY(0);
  }
  .ws-faq-visual .q7-ty1 {
    opacity: 1;
  }
  /* FAQ 8 */
  .ws-faq-visual .q8-tab--t1 {
    fill: #25D366;
  }
  .ws-faq-visual .q8-tab-text--t1 {
    fill: #ffffff;
  }
  .ws-faq-visual .q8-rows--a {
    opacity: 1;
    transform: translateY(0);
  }
  .ws-faq-visual .q8-rows--b,
  .ws-faq-visual .q8-rows--c,
  .ws-faq-visual .q8-badge {
    opacity: 0;
  }
  /* FAQ 9 */
  .ws-faq-visual .q9-row {
    opacity: 1;
    transform: translateX(0);
  }
  .ws-faq-visual .q9-chip {
    opacity: 1;
  }
  .ws-faq-visual .q9-glow {
    opacity: 0.5;
  }
  .ws-faq-visual .q9-lock {
    transform: scale(1);
  }
  /* FAQ 10 */
  .ws-faq-visual .q10-prog {
    transform: scaleX(1);
  }
  .ws-faq-visual .q10-step {
    opacity: 1;
    transform: translateY(0);
  }
  .ws-faq-visual .q10-box {
    fill: #25d366;
    stroke: #25d366;
  }
  .ws-faq-visual .q10-tick {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  .ws-faq-visual .q10-label {
    fill: #ffffff;
  }
  .ws-faq-visual .q10-done {
    opacity: 1;
    transform: scale(1);
  }
  .ws-faq-visual .q10-ready {
    opacity: 0;
  }
}
`;

const FaqItem = ({ f, isOpen, onToggle, index }) => {
  const panelRef = useRef(null);
  const itemRef = useRef(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const next = panelRef.current.scrollHeight;
      setHeight((prev) => (prev === next ? prev : next));
    }
  }, [isOpen]);
  useEffect(() => {
    if (isOpen && window.matchMedia('(max-width: 767px)').matches) {
      const t = setTimeout(() => {
        itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 160);
      return () => clearTimeout(t);
    }
  }, [isOpen]);
  return (
    <motion.div
      variants={fadeUp}
      ref={itemRef}
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
        <div className="ws-faq-inline-anim">
          <div className="ws-faq-visual ws-faq-visual--inline" aria-hidden="true">
            <FaqVisual index={index} mobile />
          </div>
        </div>
        <div className="ws-faq-answer">
          <p className="ws-faq-text text-sm">{f.a}</p>
        </div>
      </div>
    </motion.div>
  );
};

const VALIDATION_ROWS = [
  { n: '+971 50 111 2233', valid: true },
  { n: '+966 55 4321 098', valid: true },
  { n: '+971 52 987 6543', valid: true },
  { n: '+20 100 555 0199', valid: false },
  { n: '+1 415 555 8721', valid: false },
];

const INBOX_SETS = [
  [
    { name: 'Ola N.', preview: 'Great, thanks!', time: '12:04' },
    { name: 'Elias M.', preview: 'Where is my order?', time: '11:58' },
    { name: 'Zara K.', preview: 'Perfect timing', time: '11:40' },
  ],
  [
    { name: 'Ola N.', preview: 'Replied · thanks', time: '12:05' },
    { name: 'Elias M.', preview: 'Replied · on your email', time: '12:00' },
    { name: 'Zara K.', preview: 'Replied · workflow updated', time: '11:42' },
  ],
  [
    { name: 'Aisha R.', preview: 'Is this still available?', time: '12:11' },
    { name: 'Sami T.', preview: 'Can you send pricing?', time: '12:09' },
    { name: 'Dana H.', preview: 'Interested in bulk deal', time: '12:01' },
  ],
];

const AGENT_MSGS = [
  { cls: 'q7-m1', d: 0, right: false, x: 16, y: 42, w: 172, h: 22, txt: 'Is this still available?' },
  { cls: 'q7-m2', d: 2.6, right: true, x: 116, y: 96, w: 188, h: 28, txt: 'Yes! Would you like to place an order?', agent: true },
  { cls: 'q7-m3', d: 3.9, right: false, x: 16, y: 136, w: 88, h: 22, txt: 'Yes please' },
  { cls: 'q7-m4', d: 4.6, right: true, x: 132, y: 162, w: 172, h: 24, txt: "Order noted. We'll follow up.", agent: true },
];

const CAMPAIGNS = [
  { name: 'Ramadan Offer', state: 'Active', prog: 0.78 },
  { name: 'New Users', state: 'Active', prog: 0.45 },
  { name: 'Re-engage', state: 'Scheduled', prog: 0 },
];

const ONBOARD_STEPS = ['Create your account', 'Connect WhatsApp', 'Import contacts', 'Launch campaign'];

const FaqVisual = ({ index, mobile = false }) => {
  const vb = mobile ? '0 0 320 160' : '0 0 320 200';
  const wrap = (node) => (
    <svg
      className="waf-anim"
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
    >
      {mobile ? <g transform="translate(32 0) scale(0.8)">{node}</g> : node}
    </svg>
  );
  switch (index) {
    case 0:
      return wrap(
        <>
          {/* Account status dashboard */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <line x1="24" y1="78" x2="296" y2="78" stroke="rgba(255, 255, 255, 0.06)" />
          <line x1="24" y1="104" x2="296" y2="104" stroke="rgba(255, 255, 255, 0.06)" />
          <g className="q1-badge">
            <circle cx="30" cy="34" r="11" fill="rgba(37, 211, 102, 0.15)" stroke="#25D366" strokeWidth="1.6" />
            <path d="M25 34 l4 4 l7 -9" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <text x="48" y="38" fontSize="12.5" fontWeight="700" fill="#ffffff">Account Shield</text>
          <text x="296" y="38" textAnchor="end" fontSize="10" fontWeight="600" fill="#4ade80">Protected</text>
          <g className="q1-row">
            <circle cx="28" cy="64" r="4" fill="#25D366" />
            <text x="40" y="68" fontSize="10.5" fill="#e9f7ee">Account Active</text>
            <text x="296" y="68" textAnchor="end" fontSize="9.5" fontWeight="600" fill="#4ade80">Active</text>
          </g>
          <g className="q1-row q1-row--d2">
            <circle cx="28" cy="90" r="4" fill="#fbbf24" />
            <text x="40" y="94" fontSize="10.5" fill="#e9f7ee">Ban Risk</text>
            <text x="296" y="94" textAnchor="end" fontSize="9.5" fontWeight="600" fill="#fbbf24">Low</text>
          </g>
          <g className="q1-row q1-row--d3">
            <circle cx="28" cy="116" r="4" fill="rgba(255, 255, 255, 0.35)" />
            <text x="40" y="120" fontSize="10.5" fill="#e9f7ee">Last checked</text>
            <text x="296" y="120" textAnchor="end" fontSize="9.5" fill="rgba(255, 255, 255, 0.45)">Just now</text>
          </g>
          <text x="24" y="150" fontSize="9.5" fill="rgba(255, 255, 255, 0.5)">Protection Score</text>
          <text x="296" y="150" textAnchor="end" fontSize="10.5" fontWeight="700" fill="#4ade80" fontFamily="'JetBrains Mono', monospace">94%</text>
          <rect x="24" y="158" width="272" height="7" rx="3.5" fill="rgba(255, 255, 255, 0.08)" />
          <rect className="q1-bar" x="24" y="158" width="272" height="7" rx="3.5" fill="#25D366" />
        </>
      );
    case 1:
      return wrap(
        <>
          {/* Chat: agent types then a reply arrives */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <circle cx="28" cy="28" r="10" fill="#25D366" />
          <text x="28" y="32" textAnchor="middle" fontSize="10" fontWeight="700" fill="#08120d">A</text>
          <circle cx="37" cy="37" r="3" fill="#4ade80" stroke="#08120d" strokeWidth="1.5" />
          <text x="46" y="32" fontSize="12" fontWeight="700" fill="#ffffff">Ahmed K.</text>
          <text x="296" y="32" textAnchor="end" fontSize="9.5" fill="rgba(255, 255, 255, 0.5)">Online</text>
          <line x1="16" y1="44" x2="304" y2="44" stroke="rgba(255, 255, 255, 0.06)" />
          <g className="q2-mask">
            <rect x="192" y="50" width="112" height="26" rx="13" fill="#25D366" />
            <text x="200" y="67" fontSize="9.5" fontWeight="600" fill="#08120d">Hi! Order is ready</text>
            <rect className="q2-cursor" x="286" y="58" width="6" height="9" rx="1.5" fill="#08120d" />
          </g>
          <g className="q2-out">
            <path d="M274 86 l4 4 l9 -10 M261 86 l4 4 l9 -10" fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g className="q2-in">
            <rect x="16" y="104" width="150" height="26" rx="13" fill="#1c2b23" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
            <text x="26" y="120" fontSize="9.5" fill="#e9f7ee">Thanks! When can I pick up?</text>
          </g>
          <g className="q2-composer">
            <rect x="16" y="144" width="288" height="32" rx="16" fill="#0d1712" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
            <rect x="30" y="160" width="120" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.14)" />
            <circle cx="292" cy="160" r="3.2" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.4" />
            <circle className="q2-send" cx="258" cy="160" r="11" fill="#25D366" />
            <path d="M253 157l6-8 6 9-6 2-6-3Z" fill="#08120d" />
          </g>
        </>
      );
    case 2:
      return wrap(
        <>
          {/* Contact validation list */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <text x="20" y="30" fontSize="12.5" fontWeight="700" fill="#ffffff">Phone Validation</text>
          <text x="20" y="42" fontSize="9" fill="rgba(255, 255, 255, 0.5)">5 numbers checked</text>
          <text className="q3-count" x="300" y="36" textAnchor="end" fontSize="9.5" fontWeight="600" fontFamily="'JetBrains Mono', monospace" fill="#4ade80">3 Valid · 2 Invalid</text>
          {VALIDATION_ROWS.map((row, i) => {
            const y = 58 + i * 21;
            const delay = `${2 + i * 1.1}s`;
            return (
              <g key={i} className="q3-row">
                <rect x="16" y={y - 7} width="288" height="16" rx="8" fill="rgba(255, 255, 255, 0.07)" />
                <rect className="q3-hi" x="16" y={y - 7} width="288" height="16" rx="8" fill="rgba(37, 211, 102, 0.28)" style={{ animationDelay: delay }} />
                <text x="26" y={y + 4} fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fill="#d7f3e1">{row.n}</text>
                {row.valid ? (
                  <g className="q3-badge" style={{ animationDelay: delay }}>
                    <rect x="266" y={y - 5} width="34" height="12" rx="6" fill="#25D366" />
                    <text x="283" y={y + 4} textAnchor="middle" fontSize="8" fontWeight="600" fill="#08120d">Valid</text>
                  </g>
                ) : (
                  <g className="q3-badge" style={{ animationDelay: delay }}>
                    <rect x="254" y={y - 5} width="46" height="12" rx="6" fill="rgba(255, 90, 90, 0.18)" stroke="#ff5a5a" strokeWidth="1" />
                    <text x="277" y={y + 4} textAnchor="middle" fontSize="8" fontWeight="600" fill="#ff7b7b">Invalid</text>
                  </g>
                )}
              </g>
            );
          })}
        </>
      );
    case 3:
      return wrap(
        <>
          {/* CSV import: file into dropzone, progress, success, rows */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <g className="q4-file">
            <rect x="16" y="14" width="100" height="26" rx="13" fill="#0d1f16" stroke="rgba(37, 211, 102, 0.4)" strokeWidth="1.4" />
            <path d="M36 27 V19 l7 0 l6 6 l0 -6" fill="none" stroke="#25D366" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <text x="52" y="31" fontSize="9.5" fill="#d7f3e1">contacts.csv</text>
          </g>
          <path className="q4-drop" d="M170 68 v22 m-8 -9 l8 9 l8 -9" fill="none" stroke="#25D366" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="104" y="52" width="132" height="58" rx="14" fill="rgba(37, 211, 102, 0.05)" stroke="#25D366" strokeWidth="1.6" strokeDasharray="5 5" />
          <text x="170" y="80" textAnchor="middle" fontSize="9.5" fill="rgba(255, 255, 255, 0.4)">Drop contacts.csv here</text>
          <text x="16" y="142" fontSize="9.5" fill="rgba(255, 255, 255, 0.5)">Uploading</text>
          <text x="304" y="142" textAnchor="end" fontSize="9.5" fontWeight="700" fontFamily="'JetBrains Mono', monospace" fill="#4ade80">100%</text>
          <rect x="98" y="136" width="206" height="6" rx="3" fill="rgba(255, 255, 255, 0.1)" />
          <rect className="q4-fill" x="98" y="136" width="206" height="6" rx="3" fill="#25D366" />
          <g className="q4-ok">
            <circle cx="150" cy="88" r="15" fill="rgba(37, 211, 102, 0.16)" stroke="#25D366" strokeWidth="1.8" />
            <path d="M141 88 l6 6 l12 -13" fill="none" stroke="#25D366" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="178" y="93" fontSize="10.5" fontWeight="600" fill="#ffffff">847 contacts imported</text>
          </g>
          {[0, 1, 2].map((i) => (
            <g key={i} className="q4-row" style={{ animationDelay: `${3 + i * 0.15}s` }}>
              <circle cx="28" cy={158 + i * 10} r="4" fill="rgba(37, 211, 102, 0.5)" />
              <rect x="38" y={158 + i * 10 - 2.5} width={[112, 96, 124][i]} height="5" rx="2.5" fill="rgba(255, 255, 255, 0.16)" />
            </g>
          ))}
        </>
      );
    case 4:
      return wrap(
        <>
          {/* Reports dashboard: metric cards, bars, export tray */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <text x="20" y="30" fontSize="12.5" fontWeight="700" fill="#ffffff">Reports</text>
          <text x="20" y="42" fontSize="9" fill="rgba(255, 255, 255, 0.5)">May 2026 · Overview</text>
          {[
            { l: 'Messages Sent', v: '1,240' },
            { l: 'Delivered', v: '98%', d: '--d2' },
            { l: 'Replied', v: '34%', d: '--d3' },
          ].map((c, i) => (
            <g key={i} className={i === 0 ? 'q5-card' : `q5-card q5-card${c.d}`}>
              <rect x={20 + i * 96} y="52" width="88" height="44" rx="9" fill="#0d1712" stroke="rgba(255, 255, 255, 0.09)" strokeWidth="1" />
              <text x={30 + i * 96} y="68" fontSize="8.5" letterSpacing="0.5" fill="rgba(255, 255, 255, 0.5)">{c.l}</text>
              <text x={30 + i * 96} y="87" fontSize="15" fontWeight="700" fontFamily="'JetBrains Mono', monospace" fill="#ffffff">{c.v}</text>
            </g>
          ))}
          <line x1="24" y1="168" x2="216" y2="168" stroke="rgba(37, 211, 102, 0.35)" strokeWidth="1.5" />
          {[
            { x: 56, h: 66 },
            { x: 120, h: 92 },
            { x: 184, h: 48 },
          ].map((b, i) => (
            <g key={i} className={i === 0 ? 'q5-bar' : `q5-bar q5-bar--d${i + 1}`}>
              <rect x={b.x} y={168 - b.h} width="32" height={b.h} rx="4" fill="#25D366" opacity="0.9" />
            </g>
          ))}
          {[
            { x: 72, v: '1.2k' },
            { x: 136, v: '2.4k' },
            { x: 200, v: '860' },
          ].map((b, i) => (
            <text key={i} x={b.x} y="182" textAnchor="middle" className={i === 0 ? 'q5-col' : `q5-col q5-col--d${i + 1}`}>{b.v}</text>
          ))}
          <g className="q5-exp">
            <rect x="228" y="118" width="76" height="28" rx="14" fill="rgba(37, 211, 102, 0.9)" />
            <text x="266" y="136" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#08120d">Export PDF</text>
          </g>
          <path className="q5-arrow" d="M266 148 v20 m-7 -8 l7 8 l7 -8" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="228" y="176" width="76" height="12" rx="6" fill="rgba(255, 255, 255, 0.07)" stroke="rgba(37, 211, 102, 0.25)" strokeWidth="1" />
          <g className="q5-report">
            <rect x="230" y="172" width="72" height="14" rx="7" fill="#0d1f16" stroke="#25D366" strokeWidth="1" />
            <path d="M238 179 V174 l5 0 l5 5 l0 -5" fill="none" stroke="#25D366" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            <text x="246" y="182.5" fontSize="7" fill="#d7f3e1">report_oct.pdf</text>
          </g>
        </>
      );
    case 5:
      return wrap(
        <>
          {/* Campaign monitor: rows slide in, bars fill */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <text x="20" y="30" fontSize="12.5" fontWeight="700" fill="#ffffff">Campaigns</text>
          <text x="20" y="42" fontSize="9" fill="rgba(255, 255, 255, 0.5)">Broadcast monitor</text>
          <g className="q6-add">
            <rect x="220" y="18" width="84" height="26" rx="13" fill="rgba(37, 211, 102, 0.9)" />
            <text x="262" y="35" textAnchor="middle" fontSize="10" fontWeight="600" fill="#08120d">+ Add Campaign</text>
          </g>
          {CAMPAIGNS.map((c, i) => {
            const top = 50 + i * 36;
            const active = c.state === 'Active';
            const bw = active ? 52 : 70;
            return (
              <g key={i} className={`q6-row ${i === 1 ? 'q6-row--d2' : ''} ${i === 2 ? 'q6-row--d3' : ''}`}>
                <circle cx="28" cy={top + 13} r="9" fill={active ? 'rgba(37, 211, 102, 0.12)' : 'rgba(255, 255, 255, 0.08)'} stroke={active ? '#25D366' : 'rgba(255, 255, 255, 0.25)'} strokeWidth="1.4" />
                <circle cx="28" cy={top + 13} r="3" fill={active ? '#25D366' : 'rgba(255, 255, 255, 0.4)'} />
                <text x="44" y={top + 17} fontSize="10.5" fontWeight="600" fill="#ffffff">{c.name}</text>
                <g className={`q6-badge ${i === 1 ? 'q6-badge--d2' : ''} ${i === 2 ? 'q6-badge--d3' : ''}`}>
                  <g className={active ? 'q6-pill' : ''}>
                    <rect x={300 - bw} y={top + 2} width={bw} height="16" rx="8" fill={active ? '#25D366' : 'rgba(255, 255, 255, 0.1)'} stroke={active ? 'none' : 'rgba(255, 255, 255, 0.22)'} strokeWidth="1" />
                    <text x={300 - bw / 2} y={top + 13} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={active ? '#08120d' : 'rgba(255, 255, 255, 0.55)'}>{c.state}</text>
                  </g>
                </g>
                <rect x="44" y={top + 27} width="240" height="6" rx="3" fill="rgba(255, 255, 255, 0.09)" />
                <rect className="q6-bar" x="44" y={top + 27} width="240" height="6" rx="3" fill="#25D366" opacity="0.9" style={{ ['--q6-prog']: c.prog, animationDelay: `${i * 0.25}s` }} />
              </g>
            );
          })}
        </>
      );
    case 6:
      return wrap(
        <>
          {/* Agent handling a real conversation */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <circle cx="10" cy="28" r="3" fill="#25D366" />
          <text x="24" y="32" fontSize="12.5" fontWeight="700" fill="#ffffff">Sales support</text>
          <rect x="240" y="20" width="64" height="20" rx="10" fill="rgba(37, 211, 102, 0.12)" stroke="rgba(37, 211, 102, 0.45)" strokeWidth="1" />
          <text x="272" y="33" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#4ade80">Agent</text>
          <line x1="16" y1="44" x2="304" y2="44" stroke="rgba(255, 255, 255, 0.06)" />
          <g className="q7-ty1" style={{ animationDelay: '0.15s' }}>
            <rect x="16" y="72" width="54" height="20" rx="10" fill="#1c2b23" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
            <circle className="q7-dot" cx="27" cy="82" r="2.6" fill="rgba(255, 255, 255, 0.7)" />
            <circle className="q7-dot q7-dot--2" cx="37" cy="82" r="2.6" fill="rgba(255, 255, 255, 0.7)" />
            <circle className="q7-dot q7-dot--3" cx="47" cy="82" r="2.6" fill="rgba(255, 255, 255, 0.7)" />
          </g>
          {AGENT_MSGS.map((m, i) => (
            <g key={i} className={`q7-msg ${m.cls}`} style={{ animationDelay: `${m.d}s` }}>
              {m.agent && <text x={m.x + m.w} y={m.y - 6} textAnchor="end" className="q7-label">Agent</text>}
              <rect x={m.x} y={m.y} width={m.w} height={m.h} rx={m.h / 2} fill={m.right ? '#25D366' : '#1c2b23'} stroke={m.right ? 'none' : 'rgba(255, 255, 255, 0.08)'} strokeWidth="1" />
              <text x={m.x + 12} y={m.y + m.h - 8} fontSize="9.5" fontWeight={m.right ? 600 : 500} fill={m.right ? '#08120d' : '#e9f7ee'}>{m.txt}</text>
            </g>
          ))}
        </>
      );
    case 7:
      return wrap(
        <>
          {/* Inbox with switching tab sets */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <rect className="q8-tab--t1" x="16" y="18" width="64" height="20" rx="6" />
          <text className="q8-tab-text--t1" x="48" y="32" textAnchor="middle" fontSize="9.5" fontWeight="700">All (24)</text>
          <rect className="q8-tab--t2" x="88" y="18" width="92" height="20" rx="6" />
          <text className="q8-tab-text--t2" x="134" y="32" textAnchor="middle" fontSize="9.5" fontWeight="700">Replied (18)</text>
          <rect className="q8-tab--t3" x="188" y="18" width="88" height="20" rx="6" />
          <text className="q8-tab-text--t3" x="232" y="32" textAnchor="middle" fontSize="9.5" fontWeight="700">Pending (6)</text>
          <g className="q8-badge">
            <circle cx="270" cy="28" r="8" fill="#ff5a5a" />
            <text x="270" y="31.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#ffffff">6</text>
          </g>
          <line x1="16" y1="46" x2="304" y2="46" stroke="rgba(255, 255, 255, 0.06)" />
          <g transform="translate(0 56)">
            {INBOX_SETS.map((set, si) => (
              <g key={si} className={si === 0 ? 'q8-rows--a' : si === 1 ? 'q8-rows--b' : 'q8-rows--c'}>
                {set.map((row, ri) => {
                  const off = 4 + ri * 32;
                  return (
                    <g key={ri}>
                      <circle className="q8-avatar" cx="28" cy={off} r="9" />
                      <text className="q8-name" x="44" y={off + 3}>{row.name}</text>
                      <text className="q8-time" x="296" y={off + 3} textAnchor="end">{row.time}</text>
                      <text className="q8-preview" x="44" y={off + 15}>{row.preview}</text>
                      {si === 2 && ri < 2 && <circle cx="300" cy={off - 2} r="4" fill="#ff5a5a" />}
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
          <line x1="16" y1="150" x2="304" y2="150" stroke="rgba(255, 255, 255, 0.06)" />
          <text x="20" y="170" fontSize="9" fill="rgba(255, 255, 255, 0.45)">24 conversations · 6 waiting</text>
        </>
      );
    case 8:
      return wrap(
        <>
          {/* Security status card */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <circle className="q9-glow" cx="48" cy="50" r="24" fill="rgba(37, 211, 102, 0.14)" />
          <g className="q9-lock">
            <rect x="36" y="44" width="24" height="20" rx="4" fill="#25D366" />
            <circle cx="48" cy="53" r="2.8" fill="#08120d" />
            <path d="M40 44 V37 a8 8 0 0 1 16 0 V44" fill="none" stroke="#25D366" strokeWidth="3" strokeLinecap="round" />
          </g>
          <text className="q9-head" x="86" y="46">Connection Secure</text>
          <text className="q9-sub" x="86" y="61">End-to-end encrypted</text>
          <line x1="20" y1="74" x2="300" y2="74" stroke="rgba(255, 255, 255, 0.06)" />
          {[
            { l: 'Session', v: 'Active' },
            { l: 'Data Storage', v: 'None' },
            { l: 'Last verified', v: '2 min ago' },
          ].map((r, i) => {
            const y = 94 + i * 26;
            return (
              <g key={i} className={i === 0 ? 'q9-row' : `q9-row q9-row--d${i + 1}`}>
                <circle className="q9-dot" cx="24" cy={y} r="4" fill="#4ade80" />
                <text className="q9-label" x="40" y={y + 4}>{r.l}</text>
                <text x="296" y={y + 4} textAnchor="end" fontSize="9.5" fontWeight="600" fill={i === 0 ? '#4ade80' : 'rgba(255, 255, 255, 0.45)'}>{r.v}</text>
              </g>
            );
          })}
          <g className="q9-chip">
            <rect x="20" y="166" width="152" height="22" rx="11" fill="rgba(37, 211, 102, 0.1)" stroke="rgba(37, 211, 102, 0.35)" strokeWidth="1" />
            <path d="M36 175 V168 l4 0 l4 4 l4 -4 l4 0 v7" fill="none" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <text className="q9-chip-text" x="48" y="181">256-bit encryption</text>
          </g>
          <circle cx="280" cy="88" r="15" fill="none" stroke="rgba(37, 211, 102, 0.4)" strokeWidth="1.2" strokeDasharray="3 3" />
          <path d="M272 88 l6 6 l12 -13" fill="none" stroke="#25D366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 9:
      return wrap(
        <>
          {/* Onboarding checklist */}
          <rect x="10" y="10" width="300" height="180" rx="14" fill="#08120d" stroke="rgba(37, 211, 102, 0.18)" />
          <text x="20" y="26" fontSize="12.5" fontWeight="700" fill="#ffffff">Onboarding</text>
          <text className="q10-sub" x="300" y="26" textAnchor="end">4 steps</text>
          <rect x="20" y="34" width="280" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.08)" />
          <rect className="q10-prog" x="20" y="34" width="280" height="5" rx="2.5" fill="#25D366" />
          <line x1="28" y1="72" x2="28" y2="140" stroke="rgba(37, 211, 102, 0.25)" strokeDasharray="2 5" strokeWidth="1" />
          {ONBOARD_STEPS.map((s, i) => {
            const y = 48 + i * 28;
            return (
              <g key={i} className={`q10-step q10-step--e${i + 1}`}>
                <circle className="q10-box" cx="28" cy={y + 12} r="10" style={{ animationDelay: `${0.35 + i * 0.75}s` }} />
                <path className="q10-tick" d={`M23 ${y + 12} l4 4 l7 -9`} style={{ animationDelay: `${0.55 + i * 0.75}s` }} />
                <text className="q10-label" x="48" y={y + 16} style={{ animationDelay: `${0.6 + i * 0.75}s` }}>{s}</text>
                <g className="q10-done" style={{ animationDelay: `${0.75 + i * 0.75}s` }}>
                  <rect x="246" y={y + 4} width="50" height="16" rx="8" fill="rgba(37, 211, 102, 0.14)" stroke="rgba(37, 211, 102, 0.4)" strokeWidth="1" />
                  <text x="271" y={y + 16} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#4ade80">Done</text>
                </g>
              </g>
            );
          })}
          <g className="q10-ready">
            <rect x="84" y="164" width="156" height="22" rx="11" fill="rgba(37, 211, 102, 0.12)" stroke="rgba(37, 211, 102, 0.4)" strokeWidth="1" />
            <circle cx="118" cy="175" r="6" fill="#25D366" />
            <path d="M114.5 175 l3 3 l5 -6" fill="none" stroke="#08120d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <text x="132" y="180" fontSize="10" fontWeight="700" fill="#ffffff">You're ready!</text>
          </g>
        </>
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
          className="ws-faq-left-card hidden md:flex rounded-xl p-4 sm:p-5 shadow-sm flex-col"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
            >
              <div className={cn('ws-faq-visual hidden md:block', open !== null && 'ws-faq-visual--running')}>
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
          className="flex flex-col gap-2 sm:gap-3 min-w-0"
        >
          <div className="md:hidden mb-5 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-text-primary">Common Questions</h3>
            <div className="mt-2.5 flex items-center justify-center gap-1.5">
              <AvatarStack ariaLabel="Trusted by 200+ teams" />
              <span className="text-xs font-semibold text-text-secondary">Trusted by 200+ teams</span>
            </div>
          </div>
          {FAQS.map((f, i) => (
            <FaqItem
              key={f.q}
              index={i}
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