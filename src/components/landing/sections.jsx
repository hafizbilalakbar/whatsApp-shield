import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search, BadgeCheck, Inbox, Repeat, WandSparkles, MessageSquareReply, Megaphone, CalendarClock,
  ShieldCheck, Check, ClipboardList, Database, FileText, Lock, Users, Filter, Layers2,
  ShoppingCart, Rocket, Briefcase, Cpu, Target, Store, TrendingUp, Wrench, GraduationCap,
  Building2, Earth, MapPin, Globe, MessageCircle, HeartHandshake, Handshake, CalendarCheck,
  BellRing, Shield, ArrowRight, ArrowDown, Sparkles, Star, RotateCcw, ChevronDown,
  HeartPulse, Banknote, Truck, Stethoscope,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../ui/cn';
import {
  fadeUp, stagger, SectionHeading, SelectChip, FlowRail, ChatMock, useCyclingIndex,
  RadarVisual, Marquee,
} from './shared';
import { HeroWorkflow } from './mockups';
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
  { place: 'United Arab Emirates', seg: 'Dubai & Gulf metro — trade & services' },
  { place: 'Saudi Arabia', seg: 'Riyadh / Jeddah — wholesale & retail' },
  { place: 'United Kingdom', seg: 'London & regional companies' },
  { place: 'United States', seg: 'NY · LA · Texas — growth sectors' },
  { place: 'Australia', seg: 'Sydney / Melbourne — SMEs' },
  { place: 'Europe', seg: 'Germany · France · Netherlands' },
];

const LEAD_TO_CUSTOMER = [
  { num: '01', label: 'Discover', desc: 'Find potential audiences.', icon: Search },
  { num: '02', label: 'Organize', desc: 'Clean and structure lead data.', icon: ClipboardList },
  { num: '03', label: 'Validate', desc: 'Check and prepare leads.', icon: BadgeCheck },
  { num: '04', label: 'Engage', desc: 'Use Message Agent for WhatsApp conversations.', icon: MessageCircle },
  { num: '05', label: 'Qualify', desc: 'AI-assisted qualification where enabled.', icon: WandSparkles },
  { num: '06', label: 'Follow Up', desc: 'Continue organized conversations through the CRM workflow.', icon: HeartHandshake },
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

const CLOSE_STEPS = [
  { num: '01', label: 'Capture Lead', icon: Inbox },
  { num: '02', label: 'Validate Contact', icon: BadgeCheck },
  { num: '03', label: 'Start Conversation', icon: MessageCircle },
  { num: '04', label: 'Use Templates', icon: FileText },
  { num: '05', label: 'Follow Up', icon: Repeat },
  { num: '06', label: 'Qualify Customer', icon: WandSparkles },
  { num: '07', label: 'Close Lead', icon: HeartHandshake },
];

const CLOSE_STAGE_CARD = {
  name: 'Omar Malik',
  meta: 'Wholesale · Glassware imports',
  initials: 'OM',
  stages: ['New', 'Reached out', 'Responded', 'Qualified', 'Closing'],
};

const LEAD_GEN_STEPS = ['Contacts', 'WhatsApp validation', 'Qualified leads', 'Organized contact list', 'Message Agent', 'Conversation', 'Follow-up', 'Customer'];
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
            <p className="text-center text-[11px] text-text-muted mt-3">
              Illustrative preview — the leads you import shape your actual results.
            </p>
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

/* ---------- LEAD GENERATION ---------- */
export const LeadGenSection = () => (
  <div>
    <SectionHeading
      eyebrow="Lead Generation"
      badge="Discover → Conversation"
      title="Find the Leads That Are Already on WhatsApp"
      subtitle="One workflow takes you from a raw contact list to an ongoing customer conversation."
    />
    <NodePipeline steps={LEAD_GEN_STEPS} />
    <div className="mt-6 max-w-2xl mx-auto flex items-start gap-2.5 rounded-xl border border-border/70 bg-surface p-3.5">
      <Sparkles size={15} className="text-primary shrink-0 mt-0.5" />
      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
        Validation happens before outreach: <span className="font-semibold text-text-primary">no magic lead generator, no guaranteed customers</span> —
        just the lists you import, cleaned and organized into conversations.
      </p>
    </div>
  </div>
);

/* ---------- FROM LEAD TO CUSTOMER ---------- */
export const LeadToCustomerFlow = () => {
  const reduce = useReducedMotion();
  return (
    <div className="relative">
      <div className="hidden lg:block absolute top-7 left-[6%] right-[6%] h-px bg-border" aria-hidden="true" />
      {!reduce && (
        <>
          <motion.span
            className="hidden lg:block absolute top-7 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,217,126,0.7)]"
            initial={{ left: '6%' }}
            animate={{ left: ['6%', '94%', '94%', '6%'] }}
            transition={{ repeat: Infinity, duration: 9, times: [0, 0.45, 0.55, 1], ease: 'easeInOut' }}
          />
          <motion.span
            className="hidden lg:block absolute top-7 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(6,182,212,0.6)]"
            initial={{ left: '94%' }}
            animate={{ left: ['94%', '6%', '6%', '94%'] }}
            transition={{ repeat: Infinity, duration: 9, times: [0, 0.45, 0.55, 1], ease: 'easeInOut' }}
          />
        </>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {LEAD_TO_CUSTOMER.map((step, i) => {
          const Icon = step.icon;
          const isAgent = step.label === 'Engage';
          return (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="relative"
            >
              <div className={cn(
                'rounded-2xl border bg-surface p-3.5 sm:p-4 flex flex-col gap-2 transition-colors duration-300 hover:shadow-lg',
                isAgent ? 'border-[#25D366]/30 hover:border-[#25D366]/50' : 'border-border/80 hover:border-primary/40'
              )}>
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isAgent ? 'bg-[#25D366]/10 text-[#1da851]' : 'bg-primary/10 text-primary'
                  )}>
                    <Icon size={15} />
                  </span>
                  <span className="text-[10px] font-bold text-text-muted">{step.num}</span>
                </div>
                <p className="text-xs sm:text-[13px] font-semibold text-text-primary leading-snug">{step.label}</p>
                <p className="text-[10px] sm:text-[11px] text-text-muted leading-snug">{step.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- CLOSING WORKFLOW (timeline + chat + stage card) ---------- */
export const ClosingWorkflow = () => {
  const reduce = useReducedMotion();
  const stage = useCyclingIndex(CLOSE_STAGE_CARD.stages.length, 1600);
  return (
    <div>
      <SectionHeading
        eyebrow="Sales Workflow"
        badge="7 steps"
        title="From First Message to Closed Lead"
        subtitle="Capture, validate, converse, follow up — the full path from lead to customer, in one connected loop."
      />
      <div className="max-w-4xl mx-auto mb-8">
        <FlowRail steps={CLOSE_STEPS.map((s) => s.label)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-5 sm:gap-6 items-center max-w-4xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
          <motion.div variants={fadeUp}>
            <ChatMock
              name="Noor Jameel"
              subtitle="Wholesale · illustrative"
              reveal
              messages={[
                { side: 'them', text: 'Hi — we’re looking for sourcing partners in the Gulf.' },
                { side: 'ai', text: 'High intent signal. Suggest an intro call.' },
                { side: 'mine', text: 'Happy to help — can we set up 15 minutes this week?' },
                { side: 'them', text: 'Thursday 11 AM works for us.' },
              ]}
            />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="rounded-2xl border border-border bg-surface shadow-xl p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-xs font-bold text-primary">
                {CLOSE_STAGE_CARD.initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary truncate">{CLOSE_STAGE_CARD.name}</p>
                <p className="text-[10px] text-text-muted truncate">{CLOSE_STAGE_CARD.meta}</p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold text-success bg-success/10 border border-success/25 rounded-full px-2.5 py-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                {CLOSE_STAGE_CARD.stages[stage === -1 ? CLOSE_STAGE_CARD.stages.length - 1 : stage]}
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
              <div className="flex flex-col gap-1.5">
                {CLOSE_STAGE_CARD.stages.map((s, i) => {
                  const done = stage === -1 || i <= stage;
                  return (
                    <div key={s} className="relative flex items-center gap-3 py-1">
                      <span className={cn(
                        'w-[26px] h-[26px] rounded-full border flex items-center justify-center shrink-0 z-10 transition-colors duration-300',
                        done ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface border-border text-text-muted'
                      )}>
                        {done ? <Check size={12} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </span>
                      <span className={cn('text-xs font-semibold', done ? 'text-text-primary' : 'text-text-muted')}>{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-surface border border-border/60 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                initial={false}
                animate={{ width: stage === -1 ? '100%' : `${((stage) / (CLOSE_STAGE_CARD.stages.length - 1)) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </div>
            <p className="text-[10px] text-text-muted mt-2.5">Illustrative lead record moving through stages.</p>
          </div>
        </motion.div>
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

/* ---------- PRODUCT PREVIEW (floating fragments) ---------- */
export const ProductPreview = () => (
  <div>
    <div className="max-w-3xl mx-auto text-center">
      <SectionHeading
        eyebrow="Product Preview"
        title="A Real Product, Not Just a Concept."
        subtitle="Fragments of the actual application you get — validation runs, conversations, and AI qualification."
      />
    </div>

    <div className="relative max-w-4xl mx-auto mt-2 flex flex-col lg:flex-row lg:items-center gap-5 sm:gap-6">
      <div className="lg:flex-1 animate-float">
        <div className="rounded-2xl border border-border bg-surface shadow-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Shield size={14} className="text-primary" /></div>
            <p className="text-xs font-bold text-text-primary">Validation run</p>
            <Badge variant="outline" className="ml-auto text-[10px] text-primary border-primary/30 bg-primary/5">Completed</Badge>
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <FlowRail steps={['Import', 'Validate', 'Verify']} />
          </div>
          <div className="rounded-lg border border-border/60 bg-background px-2.5 py-2 space-y-1">
            <div className="flex justify-between text-[10px] text-text-secondary"><span>Numbers checked</span><span className="font-bold text-text-primary">12,480</span></div>
            <div className="flex justify-between text-[10px] text-text-secondary"><span>WhatsApp active</span><span className="font-bold text-success">8,942</span></div>
            <div className="flex justify-between text-[10px] text-text-secondary"><span>Duplicates removed</span><span className="font-bold text-text-primary">317</span></div>
          </div>
        </div>
      </div>

      <div className="lg:flex-none flex items-center justify-center" aria-hidden="true">
        <ArrowRight size={16} className="text-primary hidden lg:block" />
        <ArrowDown size={16} className="text-primary lg:hidden" />
      </div>

      <div className="lg:flex-[1.2] animate-float-delayed">
        <ChatMock
          name="Qualified Lead"
          subtitle="Conversation · illustrative"
          messages={[
            { side: 'them', text: 'Available this week for a quick call?' },
            { side: 'mine', text: 'Absolutely — Thursday 3 PM works.' },
          ]}
        />
      </div>

      <div className="lg:flex-1 animate-float-slow">
        <div className="rounded-2xl border border-border bg-surface shadow-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Sparkles size={14} className="text-primary" /></div>
            <p className="text-xs font-bold text-text-primary">AI Qualification</p>
          </div>
          <div className="rounded-lg border border-[#25D366]/25 bg-[#25D366]/5 p-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Sparkles size={10} className="text-[#1da851]" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#1da851]">AI Agent</span>
            </div>
            <p className="text-[11px] text-text-primary leading-relaxed">
              Interested in a demo, budget signal detected. Recommended: schedule a 15-minute call this week.
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px]">
            <span className="text-text-muted">Next step</span>
            <span className="font-semibold text-primary flex items-center gap-1"><CalendarCheck size={11} /> Follow-up scheduled</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ---------- METRICS (demo values, clearly marked) ---------- */
const METRICS = [
  // ← Replace these placeholder/demo values with real product numbers.
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
      badge="Illustrative"
      title="A Pipeline That Keeps Moving"
      subtitle="Illustrative demo figures — replace these placeholder values with your own product metrics."
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
    <p className="text-center text-[10px] text-text-muted mt-4">Sample values for layout — swap in real numbers before launch.</p>
  </div>
);

/* ---------- TESTIMONIALS (sample stories) ---------- */
const TESTIMONIALS = [
  { name: 'Ahmed Khan', role: 'Marketing Director', company: 'Sparks Digital · PK', initials: 'AK', color: 'bg-gradient-to-br from-blue-400 to-blue-600', text: 'Validating thousands of numbers used to take days. Now it takes minutes, and the reports are client-ready.' },
  { name: 'Maria Silva', role: 'CRM Manager', company: 'TechRetail · BR', initials: 'MS', color: 'bg-gradient-to-br from-purple-400 to-purple-600', text: 'Shield Mode gives us peace of mind — cleaner lists, fewer risks, more confident outreach.' },
  { name: 'James Okonkwo', role: 'Growth Lead', company: 'AfriMarket · NG', initials: 'JO', color: 'bg-gradient-to-br from-emerald-400 to-emerald-600', text: 'Paste any list in any format and it just works. The country detection is a real time-saver.' },
  { name: 'Yuki Tanaka', role: 'Engineering Lead', company: 'Sakura Tech · JP', initials: 'YT', color: 'bg-gradient-to-br from-rose-400 to-rose-600', text: 'Clean, well-architected tooling. The validation pipeline slots straight into our workflow.' },
  { name: 'Sarah Chen', role: 'Operations Manager', company: 'Global Connect · SG', initials: 'SC', color: 'bg-gradient-to-br from-amber-400 to-amber-600', text: 'We use it weekly for regional lists. The export options are perfect for client reporting.' },
  { name: 'Omar Al-Rashid', role: 'Data Analyst', company: 'Raya Digital · AE', initials: 'OA', color: 'bg-gradient-to-br from-cyan-400 to-cyan-600', text: 'QR connection, instant validation, clear status. Our lead pipeline runs on autopilot now.' },
];

const TestimonialCard = ({ t }) => (
  <div className="w-[280px] sm:w-[320px] p-6 rounded-2xl bg-surface border border-border/60 hover:border-primary/30 hover:shadow-lg transition-all duration-300 flex flex-col mx-3">
    <div className="flex gap-1 mb-4">
      {[...Array(5)].map((_, si) => <Star key={si} size={13} className="text-warning fill-warning" />)}
    </div>
    <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-6">“{t.text}”</p>
    <div className="flex items-center gap-3 mt-auto pt-4 border-t border-border/30">
      <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>{t.initials}</div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-text-primary truncate">{t.name}</p>
        <p className="text-[11px] text-text-muted truncate">{t.role} · {t.company}</p>
      </div>
    </div>
  </div>
);

export const TestimonialsSection = () => (
  <div>
    <SectionHeading
      eyebrow="Customer Stories"
      badge="Sample"
      title="Teams That Sell, Support, and Follow Up on WhatsApp"
      subtitle="Sample stories to illustrate the section — replace them with real customer quotes before launch."
    />
    <Marquee items={TESTIMONIALS} trackClass="testimonial-track" className="group/testimonials" duration="42s" render={(t) => <TestimonialCard t={t} />} />
  </div>
);

/* ---------- BRANDS ---------- */
const BRAND_ITEMS = [
  { icon: ShoppingCart, label: 'E-Commerce' },
  { icon: Megaphone, label: 'Agencies' },
  { icon: Building2, label: 'Real Estate' },
  { icon: Stethoscope, label: 'Clinics' },
  { icon: GraduationCap, label: 'Education' },
  { icon: Banknote, label: 'Finance' },
  { icon: Cpu, label: 'Technology' },
  { icon: Truck, label: 'Logistics' },
  { icon: Wrench, label: 'Services' },
  { icon: Store, label: 'Local' },
  { icon: Users, label: 'Sales' },
  { icon: Target, label: 'Recruitment' },
];

export const BrandsSection = () => (
  <div>
    <SectionHeading
      eyebrow="Who It’s For"
      title="Built for Businesses That Run on WhatsApp"
      subtitle="Category placeholders you can swap for your own customer logos — no fictional partnerships here."
    />
    <Marquee items={BRAND_ITEMS} trackClass="brand-track" className="group/brands" duration="30s" render={(b) => (
      <div className="mx-3 sm:mx-4 flex items-center gap-2.5 rounded-2xl border border-border/70 bg-surface px-5 py-3.5 min-w-max">
        <b.icon size={18} className="text-primary shrink-0" />
        <span className="text-sm font-bold text-text-secondary whitespace-nowrap">{b.label}</span>
      </div>
    )} />
  </div>
);

/* ---------- FAQ ---------- */
const FAQS = [
  { q: 'What is WhatsApp Shield?', a: 'WhatsApp Shield is the validation and organization side of the platform. You import contacts, normalize their numbers, deduplicate the list, and check which numbers have an active WhatsApp presence — then organize and export the verified leads.' },
  { q: 'What is Message Agent?', a: 'Message Agent is the conversation side of the platform. It works alongside Shield: verified leads flow into a WhatsApp Web-style workspace where you manage chats, search and filter conversations, use templates, and follow up in an organized way.' },
  { q: 'How does contact validation work?', a: 'You connect a WhatsApp number with a QR code, then run a validation scan over your imported contacts. The scan reports which numbers are reachable on WhatsApp and flags duplicates or problematic entries before any outreach.' },
  { q: 'How do I import contacts?', a: 'Open the Shield workspace, choose “Import”, and add contacts by pasting text or uploading CSV, JSON, or TXT files. Numbers are normalized first, so formats from different countries are handled automatically.' },
  { q: 'Can I export reports?', a: 'Yes. After a validation run you can export results as CSV, JSON, TXT, or PDF — including the connection summary and per-country breakdown for your own records or client reporting.' },
  { q: 'Can I manage multiple campaigns?', a: 'Yes. Campaigns let you keep different target groups, regions, and lists separate — each with its own validation history and reports.' },
  { q: 'How does Message Agent work?', a: 'Leads validated in Shield can be opened in Message Agent as conversations. You get a contact list, a chat window, search and filters, a profile view, and message templates — everything in one interface.' },
  { q: 'How are conversations organized?', a: 'Conversations are kept in an ordered contact list with lead status, timestamps, and unread indicators. Filters and search help you focus on the chats that need attention.' },
  { q: 'Is my WhatsApp connection secure?', a: 'You control the connection by scanning a QR code with your own WhatsApp account, and you can disconnect at any time. It’s a local-first workflow — your data is processed on your device.' },
  { q: 'How do I get started?', a: 'Open the workspace, connect your WhatsApp number with a QR code, and run your first scan on a sample list. The in-app guide walks through import validation and conversations step by step.' },
];

export const FaqSection = () => {
  const [open, setOpen] = useState(null);
  return (
    <div>
      <SectionHeading
        eyebrow="FAQ"
        badge="Questions"
        title="Common Questions, Straight Answers"
      />
      <div className="max-w-3xl mx-auto flex flex-col gap-2.5 sm:gap-3">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <motion.div
              key={f.q}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'rounded-2xl border bg-surface overflow-hidden transition-colors duration-300',
                isOpen ? 'border-primary/40' : 'border-border/70'
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 text-left"
              >
                <span className="text-sm sm:text-[15px] font-semibold text-text-primary">{f.q}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn('shrink-0 flex items-center justify-center w-6 h-6 rounded-full border', isOpen ? 'border-primary/40 text-primary bg-primary/5' : 'border-border text-text-muted')}
                  aria-hidden="true"
                >
                  <ChevronDown size={13} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-text-secondary leading-relaxed">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
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