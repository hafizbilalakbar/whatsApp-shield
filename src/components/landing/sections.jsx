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
  height: 180px;
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
  margin: 0 14px 6px;
}
@media (min-width: 640px) {
  .ws-faq-inline-anim {
    margin: 0 18px 8px;
  }
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
.waf-move,
.waf-spin,
.waf-breathe,
.waf-dot,
.waf-msg,
.waf-burst,
.waf-card,
.waf-row,
.waf-bar,
.waf-tab,
.waf-step {
  will-change: transform;
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

/* FAQ 1 — Shield: hex shield breathes while 4 threat dots attack and get repelled */
.wa1-glow {
  opacity: 0.45;
  animation: wa1Glow 2s ease-in-out infinite alternate;
}
@keyframes wa1Glow {
  0% { opacity: 0.3; }
  100% { opacity: 0.6; }
}
.wa1-breathe {
  transform-box: fill-box;
  transform-origin: center;
  animation: wa1Breathe 3s ease-in-out infinite alternate;
  will-change: transform;
}
@keyframes wa1Breathe {
  0% { transform: scale(0.95); }
  100% { transform: scale(1.05); }
}
.wa1-shieldflash {
  fill: none;
  stroke: #00ff88;
  stroke-width: 4;
  stroke-linejoin: round;
  opacity: 0;
  animation: wa1ShieldFlash 3.2s ease-out infinite;
}
@keyframes wa1ShieldFlash {
  0%, 16%, 41%, 66%, 91%, 100% { opacity: 0; }
  18% { opacity: 0.8; }
  22% { opacity: 0; }
  43% { opacity: 0.8; }
  47% { opacity: 0; }
  68% { opacity: 0.8; }
  72% { opacity: 0; }
  93% { opacity: 0.8; }
  97% { opacity: 0; }
}
.wa1-shackle {
  transform-box: fill-box;
  transform-origin: center;
  animation: wa1Shackle 4s ease-in-out infinite;
  will-change: transform;
}
@keyframes wa1Shackle {
  0%, 40%, 100% { transform: translateY(0); }
  48%, 60% { transform: translateY(-9px); }
  76% { transform: translateY(0); }
}
.wa1-dotg {
  opacity: 0;
  animation: wa1DotApproach 3.2s ease-in infinite;
  will-change: transform;
}
.wa1-dotg--t { animation-delay: 0s; }
.wa1-dotg--r { animation-delay: 0.8s; }
.wa1-dotg--b { animation-delay: 1.6s; }
.wa1-dotg--l { animation-delay: 2.4s; }
@keyframes wa1DotApproach {
  0% { transform: translate(var(--wa1-sx, 0px), var(--wa1-sy, 0px)); opacity: 0; }
  6% { opacity: 0.9; }
  21% { transform: translate(0, 0); opacity: 1; }
  26%, 100% { opacity: 0; }
}
.wa1-dotg--t { --wa1-sy: -95px; }
.wa1-dotg--r { --wa1-sx: 116px; }
.wa1-dotg--b { --wa1-sy: 62px; }
.wa1-dotg--l { --wa1-sx: -116px; }
.wa1-repel {
  transform-box: fill-box;
  transform-origin: center;
  animation: wa1Repel 3.2s ease-out infinite;
}
.wa1-repel--t { animation-delay: 0s; }
.wa1-repel--r { animation-delay: 0.8s; }
.wa1-repel--b { animation-delay: 1.6s; }
.wa1-repel--l { animation-delay: 2.4s; }
@keyframes wa1Repel {
  0%, 20% { transform: scale(0.3); opacity: 0; }
  24% { transform: scale(1); opacity: 0.9; }
  38%, 100% { transform: scale(1.25); opacity: 0; }
}

/* FAQ 2 — Message Agent: rotating neural node, orbiting satellites, travelling signal dots, wifi burst */
.wa2-core {
  transform-box: fill-box;
  transform-origin: center;
  animation: wa2CoreSpin 12s linear infinite;
  will-change: transform;
}
@keyframes wa2CoreSpin {
  to { transform: rotate(360deg); }
}
.wa2-node {
  transform-box: fill-box;
  transform-origin: center;
  animation: wa2NodePulse 2.4s ease-in-out infinite;
  will-change: transform;
}
@keyframes wa2NodePulse {
  0%, 100% { transform: scale(0.7); }
  50% { transform: scale(1.2); }
}
.wa2-dot {
  opacity: 0;
  animation: wa2DotTravel 1.8s ease-in-out infinite;
  will-change: transform;
}
@keyframes wa2DotTravel {
  0% { transform: translate(0, 0); opacity: 0; }
  12% { opacity: 1; }
  88% { opacity: 1; }
  100% { transform: translate(var(--wa2-sx, 0px), var(--wa2-sy, 0px)); opacity: 0; }
}
.wa2-burst {
  transform-box: fill-box;
  transform-origin: center;
  stroke: #00ff88;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 14 10;
  opacity: 0;
  animation: wa2Burst 3s ease-out infinite;
}
.wa2-burst--d2 { animation-delay: 0.12s; }
.wa2-burst--d3 { animation-delay: 0.24s; }
@keyframes wa2Burst {
  0% { transform: scale(0.7); opacity: 0; }
  10% { opacity: 1; }
  28% { transform: scale(1.7); opacity: 0.9; }
  55%, 100% { opacity: 0; }
}

/* FAQ 3 — phone number rows slide in, get verified (check) or rejected (cross) */
.wa3-row {
  opacity: 0;
  animation: wa3Row 5s ease-in-out infinite;
  will-change: transform;
}
.wa3-row--d2 { animation-delay: 0.3s; }
.wa3-row--d3 { animation-delay: 0.6s; }
.wa3-row--d4 { animation-delay: 0.9s; }
.wa3-row--d5 { animation-delay: 1.2s; }
@keyframes wa3Row {
  0% { transform: translateX(72px); opacity: 0; }
  8% { opacity: 1; }
  62%, 82% { transform: translateX(0); opacity: 1; }
  96%, 100% { transform: translateX(0); opacity: 0; }
}
.wa3-hi {
  animation: wa3ScanHi 5s ease-in-out infinite;
}
.wa3-hi--d2 { animation-delay: 0.3s; }
.wa3-hi--d3 { animation-delay: 0.6s; }
.wa3-hi--d4 { animation-delay: 0.9s; }
.wa3-hi--d5 { animation-delay: 1.2s; }
@keyframes wa3ScanHi {
  0%, 18% { opacity: 0; }
  28%, 46% { opacity: 1; }
  56%, 100% { opacity: 0; }
}
.wa3-mark {
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 16;
  stroke-dashoffset: 16;
  opacity: 0;
  animation: wa3Mark 5s ease-in-out infinite;
}
.wa3-mark--ok { stroke: #25D366; }
.wa3-mark--bad {
  stroke: #ff5a5a;
  stroke-width: 2.5;
}
.wa3-mark--d1 { animation-delay: 0.6s; }
.wa3-mark--d2 { animation-delay: 0.9s; }
.wa3-mark--d3 { animation-delay: 1.2s; }
.wa3-mark--d4 { animation-delay: 1.5s; }
.wa3-mark--d5 { animation-delay: 1.8s; }
@keyframes wa3Mark {
  0%, 45% { stroke-dashoffset: 16; opacity: 0; }
  50% { opacity: 1; }
  60%, 84% { stroke-dashoffset: 0; opacity: 1; }
  96%, 100% { stroke-dashoffset: 0; opacity: 0; }
}
.wa3-count {
  font-family: 'JetBrains Mono', monospace;
  fill: #7ef0ab;
  font-size: 11px;
  letter-spacing: 1px;
  text-anchor: middle;
  opacity: 0;
  animation: wa3Count 5s ease-in-out infinite;
}
@keyframes wa3Count {
  0%, 58% { opacity: 0; transform: translateY(3px); }
  68%, 86% { opacity: 1; transform: translateY(0); }
  96%, 100% { opacity: 0; transform: translateY(3px); }
}

/* FAQ 4 — CSV file floats along path into database cylinder, counter ticks, progress fills */
.wa4-route {
  fill: none;
  stroke: #25D366;
  stroke-width: 1.5;
  stroke-dasharray: 4 6;
  stroke-linecap: round;
  animation: wa4Route 1.6s linear infinite;
}
@keyframes wa4Route {
  to { stroke-dashoffset: -20; }
}
.wa4-file {
  transform-box: fill-box;
  transform-origin: center;
  animation: wa4Float 2s ease-in-out infinite alternate;
  will-change: transform;
}
@keyframes wa4Float {
  0% { transform: translateY(0); }
  100% { transform: translateY(-6px); }
}
.wa4-dot {
  fill: #00ff88;
  offset-path: path('M252 56 C 220 40 170 96 100 130');
  animation: wa4DotMove 2s ease-in-out infinite;
  will-change: transform;
}
@keyframes wa4DotMove {
  0% { offset-distance: 0%; opacity: 0; }
  12% { opacity: 1; }
  88% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
.wa4-dbe {
  animation: wa4DbPulse 1s ease-in-out infinite;
}
@keyframes wa4DbPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.wa4-tick {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  fill: #25D366;
  font-size: 12px;
  text-anchor: middle;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: wa4Tick 1s ease-in-out infinite;
}
@keyframes wa4Tick {
  0% { opacity: 0; transform: scale(0.6); }
  35% { opacity: 1; transform: scale(1.1); }
  60%, 100% { opacity: 0; transform: scale(1); }
}
.wa4-prog {
  transform-box: fill-box;
  transform-origin: left center;
  animation: wa4Prog 4s ease-in-out infinite;
}
@keyframes wa4Prog {
  0%, 6% { transform: scaleX(0); }
  46%, 88% { transform: scaleX(1); }
  96%, 100% { transform: scaleX(1); }
}
.wa4-done {
  font-family: 'JetBrains Mono', monospace;
  fill: #7ef0ab;
  font-size: 11px;
  letter-spacing: 1px;
  opacity: 0;
  animation: wa4Done 4s ease-in-out infinite;
}
@keyframes wa4Done {
  0%, 54% { opacity: 0; }
  66%, 88% { opacity: 1; }
  96%, 100% { opacity: 0; }
}

/* FAQ 5 — growth bars with 3D faces, drawing line chart, download bounce */
.wa5-grid {
  stroke: rgba(255, 255, 255, 0.14);
  stroke-width: 1;
}
.wa5-bar {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: wa5BarGrow 5s ease-out infinite;
  will-change: transform;
}
.wa5-bar--d2 { animation-delay: 0.3s; }
.wa5-bar--d3 { animation-delay: 0.6s; }
.wa5-bar--d4 { animation-delay: 0.9s; }
.wa5-bar--d5 { animation-delay: 1.2s; }
@keyframes wa5BarGrow {
  0%, 2% { transform: scaleY(0.04); opacity: 0; }
  10%, 80% { transform: scaleY(1); opacity: 1; }
  92%, 100% { transform: scaleY(0.04); opacity: 0; }
}
.wa5-face {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: wa5FaceFade 5s ease-out infinite;
}
.wa5-face--d2 { animation-delay: 0.3s; }
.wa5-face--d3 { animation-delay: 0.6s; }
.wa5-face--d4 { animation-delay: 0.9s; }
.wa5-face--d5 { animation-delay: 1.2s; }
@keyframes wa5FaceFade {
  0%, 2% { opacity: 0; }
  10%, 80% { opacity: 1; }
  92%, 100% { opacity: 0; }
}
.wa5-line {
  fill: none;
  stroke: #7ef0ab;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 220;
  stroke-dashoffset: 220;
  animation: wa5LineDraw 5s ease-in-out infinite;
}
@keyframes wa5LineDraw {
  0%, 32% { stroke-dashoffset: 220; opacity: 0; }
  42% { opacity: 1; }
  64%, 86% { stroke-dashoffset: 0; opacity: 1; }
  96%, 100% { stroke-dashoffset: 0; opacity: 0; }
}
.wa5-dl {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: wa5DlBounce 5s ease-in-out infinite;
  will-change: transform;
}
@keyframes wa5DlBounce {
  0%, 70% { opacity: 0; transform: translateY(0); }
  78% { opacity: 1; transform: translateY(0); }
  82% { transform: translateY(-6px); }
  86% { transform: translateY(0); }
  90% { transform: translateY(-3px); }
  94%, 100% { opacity: 0; transform: translateY(0); }
}

/* FAQ 6 — campaign cards fan out, progress bars fill */
.wa6-card {
  stroke-width: 1.5;
}
.wa6-card--back { fill: #0d1f16; stroke: rgba(37, 211, 102, 0.2); }
.wa6-card--mid { fill: #102918; stroke: rgba(37, 211, 102, 0.4); }
.wa6-card--front { fill: #163d22; stroke: #25D366; }
.wa6-line {
  fill: rgba(37, 211, 102, 0.4);
}
.wa6-dot { fill: #25D366; }
.wa6-rot {
  transform-box: fill-box;
  transform-origin: center;
  animation: wa6FanRot 5s ease-in-out infinite;
  will-change: transform;
}
@keyframes wa6FanRot {
  0%, 12% { transform: rotate(-6deg); }
  36%, 64% { transform: rotate(0deg); }
  86%, 100% { transform: rotate(-6deg); }
}
.wa6-rot--c2 { animation-name: wa6FanRotC2; }
.wa6-rot--c3 { animation-name: wa6FanRotC3; }
@keyframes wa6FanRotC2 {
  0%, 12% { transform: rotate(-2deg); }
  36%, 64% { transform: rotate(0deg); }
  86%, 100% { transform: rotate(-2deg); }
}
@keyframes wa6FanRotC3 {
  0%, 12% { transform: rotate(2deg); }
  36%, 64% { transform: rotate(0deg); }
  86%, 100% { transform: rotate(2deg); }
}
.wa6-move {
  animation: wa6Spread 5s ease-in-out infinite;
  will-change: transform;
}
.wa6-move--c1 { --tx0: 16px; --tx: -70px; }
.wa6-move--c2 { --tx0: 0px; --tx: 0px; }
.wa6-move--c3 { --tx0: -16px; --tx: 70px; }
@keyframes wa6Spread {
  0%, 12% { transform: translateX(var(--tx0, 0px)); }
  36%, 64% { transform: translateX(var(--tx, 0px)); }
  86%, 100% { transform: translateX(var(--tx0, 0px)); }
}
.wa6-prog {
  fill: #25D366;
  transform-box: fill-box;
  transform-origin: left center;
  animation: wa6Prog 5s ease-in-out infinite;
}
.wa6-prog--c1 { --prog: 0.6; }
.wa6-prog--c2 { --prog: 0.8; animation-delay: 0.5s; }
.wa6-prog--c3 { --prog: 0.45; animation-delay: 1s; }
@keyframes wa6Prog {
  0%, 34% { transform: scaleX(0); }
  58%, 80% { transform: scaleX(var(--prog, 1)); }
  96%, 100% { transform: scaleX(var(--prog, 1)); }
}
.wa6-glow {
  filter: drop-shadow(0 0 8px rgba(37, 211, 102, 0.4));
}

/* FAQ 7 — two-column live conversation with typing dots */
.wa7-msg {
  opacity: 0;
  transform-box: fill-box;
  animation: wa7Msg 5s ease-in-out infinite;
  will-change: transform;
}
.wa7-msg--d1 { animation-delay: 0s; }
.wa7-msg--d2 { animation-delay: 1.6s; }
.wa7-msg--d3 { animation-delay: 2.4s; }
.wa7-msg--d4 { animation-delay: 3s; }
@keyframes wa7Msg {
  0%, 5% { opacity: 0; transform: translateX(var(--dx, 0px)); }
  16%, 70% { opacity: 1; transform: translateX(0); }
  84%, 100% { opacity: 0; transform: translateX(var(--dx, 0px)); }
}
.wa7-msg--l { --dx: -30px; }
.wa7-msg--r { --dx: 30px; }
.wa7-bub-u { fill: #23313c; }
.wa7-bub-a { fill: #25d366; }
.wa7-bub-text {
  font-size: 9px;
  font-weight: 600;
  fill: #ffffff;
  font-family: 'DM Sans', sans-serif;
}
.wa7-tb { fill: rgba(255, 255, 255, 0.07); }
.wa7-tdot {
  fill: #25d366;
  transform-box: fill-box;
  transform-origin: center;
  animation: wa7Tdot 1s ease-in-out infinite;
}
.wa7-tdot--2 { animation-delay: 0.2s; }
.wa7-tdot--3 { animation-delay: 0.4s; }
@keyframes wa7Tdot {
  0%, 100% { transform: scale(0.6); opacity: 0.5; }
  50% { transform: scale(1); opacity: 1; }
}
.wa7-type {
  opacity: 0;
  animation: wa7Type 5s ease-in-out infinite;
  animation-delay: 0.8s;
}
.wa7-type--d2 { animation-delay: 2.4s; }
@keyframes wa7Type {
  0%, 10% { opacity: 0; transform: scale(0.85); }
  24%, 52% { opacity: 1; transform: scale(1); }
  62%, 100% { opacity: 0; transform: scale(0.9); }
}
.wa7-avatar { fill: #25d366; }

/* FAQ 8 — inbox tabs with sliding active pill + conversation rows */
.wa8-pill {
  fill: rgba(255, 255, 255, 0.06);
  stroke: rgba(37, 211, 102, 0.25);
  stroke-width: 1.5;
  animation: wa8PillOff 4.5s ease-in-out infinite;
}
.wa8-pill--p2 { animation-name: wa8Pill2; }
.wa8-pill--p3 { animation-name: wa8Pill3; }
@keyframes wa8PillOff {
  0%, 24% { fill: #25d366; stroke: #25d366; }
  34%, 100% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
}
@keyframes wa8Pill2 {
  0%, 28% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
  34%, 52% { fill: #25d366; stroke: #25d366; }
  64%, 100% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
}
@keyframes wa8Pill3 {
  0%, 56% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
  64%, 82% { fill: #25d366; stroke: #25d366; }
  94%, 100% { fill: rgba(255, 255, 255, 0.06); stroke: rgba(37, 211, 102, 0.25); }
}
.wa8-tab-text {
  font-size: 9px;
  font-weight: 700;
  fill: #ffffff;
  font-family: 'DM Sans', sans-serif;
  animation: wa8TextOff 4.5s ease-in-out infinite;
}
.wa8-tab-text--t2 { animation-name: wa8Text2; }
.wa8-tab-text--t3 { animation-name: wa8Text3; }
@keyframes wa8TextOff {
  0%, 24% { fill: #ffffff; }
  34%, 100% { fill: rgba(255, 255, 255, 0.4); }
}
@keyframes wa8Text2 {
  0%, 28% { fill: rgba(255, 255, 255, 0.4); }
  34%, 52% { fill: #ffffff; }
  64%, 100% { fill: rgba(255, 255, 255, 0.4); }
}
@keyframes wa8Text3 {
  0%, 56% { fill: rgba(255, 255, 255, 0.4); }
  64%, 82% { fill: #ffffff; }
  94%, 100% { fill: rgba(255, 255, 255, 0.4); }
}
.wa8-badge {
  animation: wa8Badge 1s ease-in-out infinite alternate;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes wa8Badge {
  0% { transform: scale(1); }
  100% { transform: scale(1.2); }
}
.wa8-rows {
  opacity: 0;
  animation: wa8RowsA 4.5s ease-in-out infinite;
}
.wa8-rows--b { animation-name: wa8RowsB; }
.wa8-rows--c { animation-name: wa8RowsC; }
@keyframes wa8RowsA {
  0%, 12% { opacity: 1; transform: translateY(0); }
  18%, 100% { opacity: 0; transform: translateY(-4px); }
}
@keyframes wa8RowsB {
  0%, 24% { opacity: 0; transform: translateY(8px); }
  30%, 44% { opacity: 1; transform: translateY(0); }
  52%, 100% { opacity: 0; transform: translateY(-4px); }
}
@keyframes wa8RowsC {
  0%, 56% { opacity: 0; transform: translateY(8px); }
  62%, 78% { opacity: 1; transform: translateY(0); }
  88%, 100% { opacity: 0; transform: translateY(-4px); }
}
.wa8-avatar {
  fill: rgba(37, 211, 102, 0.18);
  stroke: #25D366;
  stroke-width: 1.5;
}
.wa8-name {
  fill: rgba(255, 255, 255, 0.5);
}
.wa8-preview {
  fill: rgba(255, 255, 255, 0.3);
}

/* FAQ 9 — encryption tunnel: packets turn green past padlock */
.wa9-path {
  fill: none;
  stroke: #25D366;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 3 9;
  opacity: 0.5;
  animation: wa9Flow 2.2s linear infinite;
}
@keyframes wa9Flow {
  to { stroke-dashoffset: -24; }
}
.wa9-phone {
  fill: rgba(37, 211, 102, 0.1);
  stroke: #25D366;
  stroke-width: 2;
}
.wa9-srv {
  fill: rgba(37, 211, 102, 0.1);
  stroke: #25D366;
  stroke-width: 2;
}
.wa9-packet {
  offset-path: path('M56 96 C 110 44 210 44 264 96');
  animation: wa9Packet 2.2s linear infinite;
  will-change: transform;
}
.wa9-packet--e1 { animation-delay: 0.4s; }
.wa9-packet--e2 { animation-delay: 0.8s; }
.wa9-packet--e3 { animation-delay: 1.2s; }
.wa9-packet--e4 { animation-delay: 1.6s; }
@keyframes wa9Packet {
  0% { offset-distance: 0%; opacity: 0; }
  8% { opacity: 1; }
  55% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
.wa9-pw,
.wa9-pe {
  r: 3.5px;
  transform-box: fill-box;
  transform-origin: center;
  animation: wa9White 2.2s linear infinite;
}
.wa9-pe { animation-name: wa9Green; }
.wa9-pw { fill: #ffffff; }
.wa9-pe { fill: #25D366; }
.wa9-packet--e1 .wa9-pw,
.wa9-packet--e1 .wa9-pe { animation-delay: 0.4s; }
.wa9-packet--e2 .wa9-pw,
.wa9-packet--e2 .wa9-pe { animation-delay: 0.8s; }
.wa9-packet--e3 .wa9-pw,
.wa9-packet--e3 .wa9-pe { animation-delay: 1.2s; }
.wa9-packet--e4 .wa9-pw,
.wa9-packet--e4 .wa9-pe { animation-delay: 1.6s; }
@keyframes wa9White {
  0%, 50% { opacity: 0.9; }
  58%, 100% { opacity: 0; }
}
@keyframes wa9Green {
  0%, 50% { opacity: 0; }
  62%, 100% { opacity: 1; }
}
.wa9-lock-burst {
  fill: none;
  stroke: #00ff88;
  stroke-width: 2;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: wa9Burst 3s ease-in-out infinite;
}
@keyframes wa9Burst {
  0%, 30% { opacity: 0; transform: scale(0.4); }
  42% { opacity: 1; }
  62%, 100% { opacity: 0; transform: scale(1.6); }
}
.wa9-padlock-body {
  fill: rgba(37, 211, 102, 0.14);
  stroke: #25D366;
  stroke-width: 2;
}
.wa9-padlock-key {
  fill: #25D366;
}
.wa9-padlock-shackle {
  fill: none;
  stroke: #25D366;
  stroke-width: 3;
  stroke-linecap: round;
  transform-box: fill-box;
  transform-origin: center;
  animation: wa9LockOpen 3s ease-in-out infinite;
}
@keyframes wa9LockOpen {
  0%, 16% { transform: translateY(-6px); }
  34%, 100% { transform: translateY(0); }
}

/* FAQ 10 — onboarding steps, travelling dot, final burst */
.wa10-conn {
  stroke: #25D366;
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.16;
}
.wa10-ring {
  stroke: #25D366;
  stroke-width: 2;
  fill: rgba(37, 211, 102, 0.12);
}
.wa10-step {
  transform-box: fill-box;
  transform-origin: center;
  animation: wa10StepOn 4s ease-in-out infinite;
}
.wa10-step--d2 { animation-delay: 0.8s; }
.wa10-step--d3 { animation-delay: 1.6s; }
.wa10-step--d4 { animation-delay: 2.4s; }
@keyframes wa10StepOn {
  0%, 4% { fill: rgba(37, 211, 102, 0.12); opacity: 0; transform: scale(0.6); }
  16%, 72% { fill: #25d366; opacity: 1; transform: scale(1); }
  84%, 100% { fill: #25d366; opacity: 0; transform: scale(0.9); }
}
.wa10-check {
  fill: none;
  stroke: #060d0a;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  opacity: 0;
  animation: wa10CheckOn 4s ease-in-out infinite;
}
.wa10-check--d2 { animation-delay: 0.9s; }
.wa10-check--d3 { animation-delay: 1.7s; }
.wa10-check--d4 { animation-delay: 2.5s; }
@keyframes wa10CheckOn {
  0%, 12% { opacity: 0; stroke-dashoffset: 30; }
  24%, 76% { opacity: 1; stroke-dashoffset: 0; }
  88%, 100% { opacity: 0; stroke-dashoffset: 0; }
}
.wa10-dot {
  fill: #25D366;
  transform-box: fill-box;
  animation: wa10Dot 4s ease-in-out infinite;
  will-change: transform;
}
@keyframes wa10Dot {
  0%, 6% { transform: translateX(0); opacity: 0; }
  10%, 20% { transform: translateX(0); opacity: 1; }
  28%, 38% { transform: translateX(60px); opacity: 1; }
  46%, 56% { transform: translateX(140px); opacity: 1; }
  64%, 78% { transform: translateX(200px); opacity: 1; }
  88%, 100% { transform: translateX(200px); opacity: 0; }
}
.wa10-burst {
  fill: none;
  stroke: #00ff88;
  stroke-width: 2;
  stroke-linecap: round;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: wa10Burst 4s ease-in-out infinite;
  animation-delay: 2.4s;
}
@keyframes wa10Burst {
  0%, 58% { opacity: 0; transform: scale(0.4); }
  68% { opacity: 1; transform: scale(1); }
  84%, 100% { opacity: 0; transform: scale(1.4); }
}
.wa10-label {
  font-size: 9px;
  letter-spacing: 1px;
  font-weight: 600;
  fill: rgba(255, 255, 255, 0.55);
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
    animation-play-state: paused !important;
  }
  /* FAQ 1 */
  .ws-faq-visual .wa1-glow {
    opacity: 0.5;
  }
  .ws-faq-visual .wa1-breathe {
    transform: scale(1);
  }
  /* FAQ 2 */
  .ws-faq-visual .wa2-dot {
    opacity: 0;
  }
  .ws-faq-visual .wa2-core {
    transform: rotate(0deg);
  }
  /* FAQ 3 */
  .ws-faq-visual .wa3-row {
    opacity: 1;
    transform: translateX(0);
  }
  .ws-faq-visual .wa3-mark {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  .ws-faq-visual .wa3-count {
    opacity: 0;
  }
  /* FAQ 4 */
  .ws-faq-visual .wa4-file {
    opacity: 1;
  }
  .ws-faq-visual .wa4-dot {
    opacity: 0;
  }
  .ws-faq-visual .wa4-prog {
    transform: scaleX(1);
  }
  /* FAQ 5 */
  .ws-faq-visual .wa5-bar,
  .ws-faq-visual .wa5-face {
    opacity: 1;
    transform: scaleY(1);
  }
  .ws-faq-visual .wa5-line {
    stroke-dashoffset: 0;
  }
  .ws-faq-visual .wa5-dl {
    opacity: 0;
  }
  /* FAQ 6 */
  .ws-faq-visual .wa6-move {
    transform: translateX(var(--tx0, 0px));
  }
  .ws-faq-visual .wa6-rot {
    transform: rotate(0deg);
  }
  .ws-faq-visual .wa6-prog {
    transform: scaleX(1);
  }
  /* FAQ 7 */
  .ws-faq-visual .wa7-msg--d1,
  .ws-faq-visual .wa7-msg--d2,
  .ws-faq-visual .wa7-msg--d3,
  .ws-faq-visual .wa7-msg--d4 {
    opacity: 1;
    transform: translateX(0);
  }
  .ws-faq-visual .wa7-type {
    opacity: 0;
  }
  /* FAQ 8 */
  .ws-faq-visual .wa8-pill {
    opacity: 1;
  }
  .ws-faq-visual .wa8-pill--p1 {
    fill: #25d366;
    stroke: #25d366;
  }
  .ws-faq-visual .wa8-pill--p2,
  .ws-faq-visual .wa8-pill--p3 {
    fill: rgba(255, 255, 255, 0.06);
    stroke: rgba(37, 211, 102, 0.25);
  }
  .ws-faq-visual .wa8-rows {
    opacity: 1;
    transform: translateY(0);
  }
  .ws-faq-visual .wa8-rows--b,
  .ws-faq-visual .wa8-rows--c {
    opacity: 0;
    transform: translateY(0);
  }
  /* FAQ 9 */
  .ws-faq-visual .wa9-pw {
    opacity: 0.9;
  }
  .ws-faq-visual .wa9-pe {
    opacity: 0.6;
  }
  .ws-faq-visual .wa9-padlock-shackle {
    transform: translateY(0);
  }
  .ws-faq-visual .wa9-lock-burst {
    opacity: 0;
  }
  /* FAQ 10 */
  .ws-faq-visual .wa10-step {
    opacity: 1;
    transform: scale(1);
  }
  .ws-faq-visual .wa10-check {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  .ws-faq-visual .wa10-dot,
  .ws-faq-visual .wa10-burst {
    opacity: 0;
  }
}
`;

const FaqItem = ({ f, isOpen, onToggle, index }) => {
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
      <div className="ws-faq-inline-anim">
        <div className="ws-faq-visual ws-faq-visual--inline" aria-hidden="true">
          <FaqVisual index={index} mobile />
        </div>
      </div>
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

const FAQ2_SATS = [
  { a: 64, dx: 64, dy: 0 },
  { a: 32, dx: 32, dy: -55 },
  { a: -32, dx: -32, dy: -55 },
  { a: -64, dx: -64, dy: 0 },
  { a: -32, dx: -32, dy: 55 },
  { a: 32, dx: 32, dy: 55 },
];

const FAQ3_ROWS = [
  { x: 70, y: 34, w: 120, valid: true },
  { x: 70, y: 60, w: 100, valid: true },
  { x: 70, y: 86, w: 130, valid: true },
  { x: 70, y: 112, w: 90, valid: false },
  { x: 70, y: 138, w: 110, valid: false },
];

const FAQ5_BARS = [
  { x: 60, h: 100 },
  { x: 100, h: 70 },
  { x: 140, h: 120 },
  { x: 180, h: 50 },
  { x: 220, h: 90 },
];

const FAQ7_MSGS = [
  {
    side: 'l',
    x: 16, y: 16, w: 96,
    tail: 'M16 34 L8 42 L28 35 Z',
    txt: 'Launch today?',
    d: 1,
  },
  {
    side: 'r',
    x: 168, y: 44, w: 116, h: 26,
    tail: 'M276 70 L288 78 L274 71 Z',
    txt: '5 leads assigned',
    d: 2,
  },
  {
    side: 'l',
    x: 16, y: 76, w: 86,
    tail: 'M16 94 L8 102 L28 95 Z',
    txt: 'Great! Keep pushing',
    d: 3,
  },
  {
    side: 'r',
    x: 168, y: 106, w: 116,
    tail: 'M276 132 L288 140 L274 133 Z',
    txt: 'Reply rate +38%',
    d: 4,
  },
];

const FAQ8_SETS = [
  { w: [46, 40, 46], p: [100, 116, 96], badge: true },
  { w: [40, 46, 42], p: [94, 100, 108], badge: false },
  { w: [46, 42, 40], p: [106, 92, 102], badge: true },
];

const FAQ9_DELAYS = [0.4, 0.8, 1.2, 1.6];

const FaqVisual = ({ index, mobile = false }) => {
  const vb = mobile ? '0 0 320 180' : '0 0 320 200';
  switch (index) {
    case 0:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g transform="translate(160 95)">
            <g className="wa1-breathe">
              <path
                d="M0 -56 L40 -28 L40 24 L0 52 L-40 24 L-40 -28 Z"
                fill="rgba(37, 211, 102, 0.12)"
                stroke="#25D366"
                strokeWidth="2"
              />
              <path
                className="wa1-shieldflash"
                d="M0 -56 L40 -28 L40 24 L0 52 L-40 24 L-40 -28 Z"
              />
              <g transform="translate(0 2)">
                <path className="wa1-shackle" d="M-9 -4 V-14 a9 9 0 0 1 18 0 V-4" fill="none" stroke="#25D366" strokeWidth="3" strokeLinecap="round" />
                <rect x="-12" y="-4" width="24" height="20" rx="5" fill="rgba(37, 211, 102, 0.16)" stroke="#25D366" strokeWidth="2" />
                <circle cx="0" cy="4" r="2.4" fill="#25D366" />
                <path d="M0 4 V10" stroke="#25D366" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            </g>
          </g>
          <g className="wa1-dotg wa1-dotg--t" transform="translate(160 42)">
            <g className="wa1-repel wa1-repel--t">
              <path d="M0 -4 V-14 M-4 -2 L-9 -8 M4 -2 L9 -8" fill="none" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle r="4.5" fill="#ff5a5a" />
          </g>
          <g className="wa1-dotg wa1-dotg--r" transform="translate(205 122)">
            <g className="wa1-repel wa1-repel--r">
              <path d="M4 0 H14 M2 -4 L8 -9 M2 4 L8 9" fill="none" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle r="4.5" fill="#ff5a5a" />
          </g>
          <g className="wa1-dotg wa1-dotg--b" transform="translate(160 148)">
            <g className="wa1-repel wa1-repel--b">
              <path d="M0 4 V14 M-4 2 L-9 8 M4 2 L9 8" fill="none" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle r="4.5" fill="#ff5a5a" />
          </g>
          <g className="wa1-dotg wa1-dotg--l" transform="translate(115 68)">
            <g className="wa1-repel wa1-repel--l">
              <path d="M-4 0 H-14 M-2 -4 L-8 -9 M-2 4 L-8 9" fill="none" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle r="4.5" fill="#ff5a5a" />
          </g>
        </svg>
      );
    case 1:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g transform="translate(160 95)">
            {FAQ2_SATS.map((s, i) => (
              <line key={`l${i}`} x1="0" y1="0" x2={s.dx} y2={s.dy} stroke="rgba(37, 211, 102, 0.35)" strokeWidth="1.2" />
            ))}
            <g className="wa2-core">
              <circle r="24" fill="none" stroke="#25D366" strokeWidth="1.2" strokeDasharray="4 6" opacity="0.6" />
              <circle r="14" fill="rgba(37, 211, 102, 0.14)" stroke="#25D366" strokeWidth="2" />
              <path d="M0 -12 V12 M-12 0 H12" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
              <circle cx="0" cy="0" r="2.5" fill="#00ff88" />
            </g>
            <path className="wa2-burst" d="M-12 -26 A30 30 0 0 1 -12 26" />
            <path className="wa2-burst wa2-burst--d2" d="M-18 -38 A40 40 0 0 1 -18 38" />
            <path className="wa2-burst wa2-burst--d3" d="M-24 -48 A50 50 0 0 1 -24 48" />
            {FAQ2_SATS.map((s, i) => (
              <circle
                key={`d${i}`}
                className="wa2-dot"
                cx="0"
                cy="0"
                r="3"
                style={{ ['--wa2-sx']: `${s.dx}px`, ['--wa2-sy']: `${s.dy}px`, animationDelay: `${i * 0.25}s` }}
              />
            ))}
            {FAQ2_SATS.map((s, i) => (
              <circle
                key={`n${i}`}
                className="wa2-node"
                cx={s.dx}
                cy={s.dy}
                r="4"
                fill="rgba(37, 211, 102, 0.16)"
                stroke="#25D366"
                strokeWidth="1.5"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            ))}
          </g>
        </svg>
      );
    case 2:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {FAQ3_ROWS.map((row, i) => (
            <g key={i} className={i === 0 ? 'wa3-row' : `wa3-row wa3-row--d${i + 1}`}>
              <rect x={row.x} y={row.y} width="196" height="18" rx="6" fill="rgba(255, 255, 255, 0.08)" />
              <rect
                className={i === 0 ? 'wa3-hi' : `wa3-hi wa3-hi--d${i + 1}`}
                x={row.x}
                y={row.y}
                width="196"
                height="18"
                rx="6"
                fill="rgba(37, 211, 102, 0.3)"
              />
              <rect x={row.x + 10} y={row.y + 7} width={row.w} height="4" rx="2" fill="rgba(255, 255, 255, 0.45)" />
              {row.valid ? (
                <path
                  d={`M${row.x + 186} ${row.y + 5} L${row.x + 192} ${row.y + 11} L${row.x + 202} ${row.y + 1}`}
                  className={`wa3-mark wa3-mark--ok wa3-mark--d${i + 1}`}
                />
              ) : (
                <path
                  d={`M${row.x + 184} ${row.y + 4} L${row.x + 198} ${row.y + 16} M${row.x + 198} ${row.y + 4} L${row.x + 184} ${row.y + 16}`}
                  className={`wa3-mark wa3-mark--bad wa3-mark--d${i + 1}`}
                />
              )}
            </g>
          ))}
          <text className="wa3-count" x="160" y="172" textAnchor="middle">
            3 / 5 VALID
          </text>
        </svg>
      );
    case 3:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path className="wa4-route" d="M252 56 C 220 40 170 96 100 130" />
          <g className="wa4-file" transform="translate(238 20)">
            <rect width="30" height="40" rx="5" fill="rgba(37, 211, 102, 0.14)" stroke="#25D366" strokeWidth="1.6" />
            <path d="M24 6 L28 10 L24 10 Z" fill="#25D366" />
            <path d="M8 14 H22 M8 21 H22 M8 28 H16" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} className="wa4-dot" cx="0" cy="0" r="4" style={{ animationDelay: `${k * 0.5}s` }} />
          ))}
          <g transform="translate(64 138)">
            <rect x="32" y="-26" width="48" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.14)" />
            <rect className="wa4-prog" x="32" y="-26" width="48" height="5" rx="2.5" />
            <ellipse className="wa4-dbe" cx="0" cy="-18" rx="26" ry="7" />
            <path className="wa4-db" d="M-26 -18 V16 a26 7 0 0 0 52 0 V-18 a26 7 0 0 0 -52 0 Z" />
            <path className="wa4-db" d="M-26 -5 a26 7 0 0 0 52 0" fill="none" />
          </g>
          <text className="wa4-tick" x="64" y="118" textAnchor="middle">+1</text>
          <text className="wa4-done" x="160" y="168" textAnchor="middle">IMPORTED</text>
        </svg>
      );
    case 4:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {[52, 82, 112, 132].map((gy) => (
            <line key={gy} className="wa5-grid" x1="40" y1={gy} x2="280" y2={gy} />
          ))}
          <line x1="40" y1="152" x2="280" y2="152" stroke="rgba(37, 211, 102, 0.45)" strokeWidth="1.5" />
          {FAQ5_BARS.map((b, i) => {
            const top = 152 - b.h;
            return (
              <g key={i} className={i === 0 ? 'wa5-bar' : `wa5-bar wa5-bar--d${i + 1}`}>
                <rect x={b.x} y={top} width="28" height={b.h} rx="3" fill="#25D366" fillOpacity={1 - i * 0.15} />
                <path
                  d={`M${b.x + 28} ${top} L${b.x + 34} ${top - 4} L${b.x + 34} 148 L${b.x + 28} 152 L${b.x + 28} ${top} Z`}
                  fill="#128C7E"
                />
              </g>
            );
          })}
          <path className="wa5-line" d="M74 52 L114 82 L154 32 L194 102 L234 62" />
          <g className="wa5-dl" transform="translate(260 26)">
            <circle r="12" fill="rgba(37, 211, 102, 0.14)" stroke="#25D366" strokeWidth="1.8" />
            <path d="M0 -6 V5 M-4 1 L0 6 L4 1" fill="none" stroke="#25D366" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      );
    case 5:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {[
            { cls: 'wa6-move--c3', rot: 'wa6-rot--c3', card: 'wa6-card--back', prog: 'wa6-prog--c3' },
            { cls: 'wa6-move--c2', rot: 'wa6-rot--c2', card: 'wa6-card--mid', prog: 'wa6-prog--c2' },
            { cls: 'wa6-move--c1', rot: 'wa6-rot', card: 'wa6-card--front', prog: 'wa6-prog--c1' },
          ].map((cfg, ci) => (
            <g key={ci} transform="translate(160 95)">
              <g className={`wa6-move ${cfg.cls}`}>
                <g className={`wa6-rot ${cfg.rot}`}>
                  <rect className={`wa6-card ${cfg.card}`} x="-70" y="-42" width="140" height="84" rx="12" />
                  <rect x="-52" y="-26" width="86" height="7" rx="3.5" fill="rgba(255, 255, 255, 0.22)" />
                  <rect x="-52" y="-13" width="116" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.14)" />
                  <rect x="-52" y="-5" width="96" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.14)" />
                  <rect x="34" y="-13" width="26" height="26" rx="13" fill="rgba(37, 211, 102, 0.2)" stroke="#25D366" strokeWidth="1.4" />
                  <circle cx="47" cy="0" r="3" fill="#25D366" />
                  <rect x="-52" y="18" width="120" height="6" rx="3" fill="rgba(255, 255, 255, 0.1)" />
                  <rect className={`wa6-prog ${cfg.prog}`} x="-52" y="18" width="120" height="6" rx="3" />
                </g>
              </g>
            </g>
          ))}
        </svg>
      );
    case 6:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {FAQ7_MSGS.map((m, i) => {
            const h = m.h || 26;
            const isUser = m.side === 'l';
            const bub = isUser ? 'wa7-bub-u' : 'wa7-bub-a';
            return (
              <g key={i} className={`wa7-msg wa7-msg--d${m.d} ${isUser ? 'wa7-msg--l' : 'wa7-msg--r'}`}>
                <path d={m.tail} className={bub} />
                <rect className={bub} x={m.x} y={m.y} width={m.w} height={h} rx="10" />
                <text className="wa7-bub-text" x={m.x + 12} y={m.y + h - 9}>
                  {m.txt}
                </text>
              </g>
            );
          })}
          <g className="wa7-type wa7-type--d1">
            <rect className="wa7-tb" x="150" y="42" width="46" height="22" rx="11" />
            <circle className="wa7-tdot" cx="159" cy="53" r="2.4" />
            <circle className="wa7-tdot wa7-tdot--2" cx="169" cy="53" r="2.4" />
            <circle className="wa7-tdot wa7-tdot--3" cx="179" cy="53" r="2.4" />
          </g>
          <g className="wa7-type wa7-type--d2">
            <rect className="wa7-tb" x="150" y="102" width="46" height="22" rx="11" />
            <circle className="wa7-tdot" cx="159" cy="113" r="2.4" />
            <circle className="wa7-tdot wa7-tdot--2" cx="169" cy="113" r="2.4" />
            <circle className="wa7-tdot wa7-tdot--3" cx="179" cy="113" r="2.4" />
          </g>
        </svg>
      );
    case 7:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect className="wa8-pill wa8-pill--p1" x="16" y="22" width="40" height="22" rx="6" />
          <text className="wa8-tab-text wa8-tab-text--t1" x="36" y="37" textAnchor="middle">All</text>
          <rect className="wa8-pill wa8-pill--p2" x="70" y="22" width="54" height="22" rx="6" />
          <text className="wa8-tab-text wa8-tab-text--t2" x="97" y="37" textAnchor="middle">Replied</text>
          <rect className="wa8-pill wa8-pill--p3" x="138" y="22" width="52" height="22" rx="6" />
          <text className="wa8-tab-text wa8-tab-text--t3" x="164" y="37" textAnchor="middle">Pending</text>
          <rect className="wa8-ul" x="16" y="48" width="40" height="3.5" rx="1.75" />
          <g transform="translate(0 62)">
            {FAQ8_SETS.map((s, si) => (
              <g key={si} className={si === 0 ? 'wa8-rows' : `wa8-rows ${si === 1 ? 'wa8-rows--b' : 'wa8-rows--c'}`}>
                {[26, 54, 82].map((y, ri) => (
                  <g key={y}>
                    <circle className="wa8-avatar" cx="26" cy={y} r="8" />
                    <rect className="wa8-name" x="42" y={y - 8} width={s.w[ri]} height="5" rx="2.5" />
                    <rect className="wa8-preview" x="42" y={y + 2} width={s.p[ri]} height="5" rx="2.5" />
                    {s.badge && (
                      <circle className="wa8-badge" cx="270" cy={y} r="4.5" fill="#ff5a5a" />
                    )}
                  </g>
                ))}
              </g>
            ))}
          </g>
        </svg>
      );
    case 8:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path className="wa9-path" d="M56 96 C 110 44 210 44 264 96" />
          <g transform="translate(24 76)">
            <rect className="wa9-phone" x="0" y="0" width="30" height="48" rx="7" />
            <rect x="10" y="5" width="10" height="4" rx="2" fill="rgba(37, 211, 102, 0.5)" />
            <rect x="6" y="38" width="18" height="4" rx="2" fill="rgba(37, 211, 102, 0.5)" />
          </g>
          <g transform="translate(272 90)">
            <rect className="wa9-srv" x="0" y="0" width="34" height="11" rx="3" />
            <rect className="wa9-srv" x="0" y="14" width="34" height="11" rx="3" />
            <rect className="wa9-srv" x="0" y="28" width="34" height="11" rx="3" />
          </g>
          {FAQ9_DELAYS.map((d, i) => (
            <g key={i} className={`wa9-packet wa9-packet--e${i + 1}`}>
              <circle className="wa9-pw" cx="0" cy="0" r="4" fill="#ffffff" />
              <circle className="wa9-pe" cx="0" cy="0" r="4" fill="#25D366" />
            </g>
          ))}
          <g transform="translate(160 62)">
            <rect className="wa9-padlock-body" x="-11" y="-8" width="22" height="18" rx="4" />
            <circle className="wa9-padlock-key" cx="0" cy="2" r="2.6" />
            <path className="wa9-padlock-shackle" d="M-8 -8 V-16 a8 8 0 0 1 16 0 V-8" />
            <circle className="wa9-lock-burst" r="16" />
          </g>
        </svg>
      );
    case 9:
      return (
        <svg className="waf-anim" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <line x1="60" y1="95" x2="260" y2="95" stroke="rgba(37, 211, 102, 0.25)" strokeWidth="3" strokeLinecap="round" />
          <line className="wa10-conn" x1="60" y1="95" x2="120" y2="95" />
          <line className="wa10-conn" x1="120" y1="95" x2="200" y2="95" />
          <line className="wa10-conn" x1="200" y1="95" x2="260" y2="95" />
          {[60, 120, 200, 260].map((x, i) => (
            <g key={x} className={`wa10-step wa10-step--d${i + 1}`} transform={`translate(${x} 95)`}>
              <circle className="wa10-ring" r="16" />
              <path className="wa10-check" d="M-7 0 L-1 6 L8 -6" />
            </g>
          ))}
          <circle className="wa10-dot" cx="60" cy="95" r="5" />
          <g className="wa10-burst" transform="translate(260 95)" stroke="#7ef0ab">
            <path d="M0 -22 V-10 M0 10 V22 M-22 -6 L-11 -3 M22 -6 L11 -3 M-22 6 L-11 3 M22 6 L11 3" />
          </g>
          {['Sign Up', 'Connect', 'Import', 'Launch'].map((label, i) => (
            <text key={label} className="wa10-label" x={[60, 120, 200, 260][i]} y="130" textAnchor="middle">
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
          className="flex flex-col gap-2.5 sm:gap-3 min-w-0"
        >
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