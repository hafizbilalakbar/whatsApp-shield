import React, { useState } from 'react';
import { motion, MotionConfig, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Shield, ShieldCheck, MessageCircle, Search, BadgeCheck, Send, Database,
  Sparkles, ClipboardList, Globe, MapPin, ArrowRight, ArrowDown, Check, RotateCcw,
  Rocket, ShoppingCart, Megaphone, Cpu, Building2, Briefcase, Layers2, Target,
  Lock,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { cn } from '../components/ui/cn';
import { SHIELD_HOME } from '../utils/paths';

/* ---------- shared motion variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

/* ---------- shared helpers ---------- */
const SectionHeading = ({ eyebrow, badge, title, subtitle, className }) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: '-60px' }}
    variants={stagger}
    className={cn('text-center mb-8 sm:mb-10', className)}
  >
    <motion.div variants={fadeUp}>
      {eyebrow && (
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">{eyebrow}</p>
      )}
      {badge && (
        <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">{badge}</Badge>
      )}
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2 leading-tight">{title}</h2>
      {subtitle && (
        <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
      )}
    </motion.div>
  </motion.div>
);

const SelectChip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-3.5 py-2 rounded-full border text-xs sm:text-sm font-medium transition-all duration-200',
      active
        ? 'bg-primary/10 border-primary/50 text-primary shadow-sm'
        : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary'
    )}
  >
    {children}
  </button>
);

/* Numbered pipeline chips joined by arrows. */
const FlowRail = ({ steps, accent = 'shield' }) => (
  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
    {steps.map((s, i) => (
      <div key={s} className="flex items-center gap-1.5 sm:gap-2">
        <div className={cn(
          'flex items-center gap-1.5 rounded-lg border px-2 py-1.5',
          accent === 'agent' ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-border/80 bg-background'
        )}>
          <span className={cn(
            'w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0',
            accent === 'agent' ? 'bg-[#25D366]/10 text-[#1da851]' : 'bg-primary/10 text-primary'
          )}>
            {i + 1}
          </span>
          <span className="text-[11px] font-semibold text-text-primary whitespace-nowrap">{s}</span>
        </div>
        {i < steps.length - 1 && (
          <span className="text-text-muted" aria-hidden="true">
            <ArrowRight size={12} className="hidden sm:block" />
            <ArrowDown size={12} className="sm:hidden" />
          </span>
        )}
      </div>
    ))}
  </div>
);

/* WhatsApp-style chat preview (illustrative). */
const ChatMock = ({ name, subtitle, messages }) => (
  <div className="w-full max-w-sm mx-auto rounded-2xl border border-border shadow-xl overflow-hidden">
    <div
      className="px-3.5 py-2.5 flex items-center gap-2.5 border-b"
      style={{ backgroundColor: 'var(--ma-bg-panel)', borderColor: 'var(--ma-line-slim)' }}
    >
      <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
        <MessageCircle size={15} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{name}</p>
        <p className="text-[10px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{subtitle}</p>
      </div>
      <ShieldCheck size={14} className="shrink-0" style={{ color: 'var(--ma-accent)' }} />
    </div>

    <div className="h-60 px-3 py-3 flex flex-col justify-end gap-2" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
      {messages.map((m, i) => {
        if (m.ai) {
          return (
            <div key={i} className="flex items-start gap-1.5 max-w-[88%]">
              <div
                className="rounded-xl rounded-tl-sm px-3 py-1.5 border"
                style={{ backgroundColor: 'var(--ma-bubble-ai)', borderColor: 'var(--ma-bubble-ai-border)' }}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <Sparkles size={10} style={{ color: 'var(--ma-accent)' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ma-accent)' }}>AI Agent</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ma-list-title)' }}>{m.text}</p>
              </div>
            </div>
          );
        }
        const mine = m.side === 'mine';
        return (
          <div key={i} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <p
              className={cn('rounded-xl px-3 py-1.5 text-xs leading-relaxed', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')}
              style={{
                backgroundColor: mine ? 'var(--ma-bubble-sent)' : 'var(--ma-bubble-received)',
                color: 'var(--ma-list-title)',
                boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
              }}
            >
              {m.text}
            </p>
          </div>
        );
      })}
    </div>

    <div
      className="px-3 py-2 flex items-center gap-2"
      style={{ backgroundColor: 'var(--ma-bg-panel)' }}
    >
      <div className="flex-1 rounded-full px-3 py-1.5 text-[11px]" style={{ backgroundColor: 'var(--ma-bg-elevated)', color: 'var(--ma-muted-text)' }}>
        Type a message…
      </div>
      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--ma-accent)' }}>
        <Send size={12} className="text-white" />
      </div>
    </div>
  </div>
);

/* ---------- interaction data ---------- */
const MARKETS = ['Pakistan', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'United States', 'Australia'];

const CATEGORIES = [
  'Wholesale & Distribution',
  'Retail & Ecommerce',
  'Construction & Contractors',
  'IT & Software Services',
  'Healthcare & Clinics',
  'Education & Training',
];

const REGIONS = ['Capital region', 'Major metro area', 'Port & trade hubs', 'Countrywide'];

const LEAD_FLOW = [
  { icon: Search, label: 'Discover' },
  { icon: ClipboardList, label: 'Organize' },
  { icon: BadgeCheck, label: 'Validate' },
  { icon: Send, label: 'Send to Message Agent' },
  { icon: MessageCircle, label: 'WhatsApp Conversation' },
  { icon: Sparkles, label: 'AI Qualification' },
  { icon: Database, label: 'CRM Follow-up' },
];

const SCENARIOS = [
  {
    id: 'realestate',
    icon: Building2,
    label: 'Real Estate',
    title: 'Property inquiries that become viewings',
    desc: 'A buyer asks about a listing. The agent replies instantly, shares availability, and schedules a viewing.',
    messages: [
      { side: 'them', text: 'Hi — is the 2-bed in Al Barsha still available?' },
      { side: 'mine', text: 'Yes! It is free for viewings this Thursday and Saturday morning.' },
      { ai: true, text: 'Qualified lead: interested in 2-bed rental, free Thursday 10:00. Suggested reply scheduled.' },
      { side: 'them', text: 'Thursday 10:00 works. Please confirm the address.' },
    ],
  },
  {
    id: 'ecommerce',
    icon: ShoppingCart,
    label: 'Ecommerce',
    title: 'Cart recovery and order updates',
    desc: 'Cleaned customer lists reach buyers who already know you — and the agent handles common questions.',
    messages: [
      { side: 'them', text: 'Has my order #4821 shipped yet?' },
      { side: 'mine', text: 'It shipped today with tracking xyz-2041 — arriving in 2 days.' },
      { ai: true, text: 'Shipment status resolved. Suggested: offer size-guide for a future order.' },
      { side: 'them', text: 'Great, thanks! Any discount code for my next order?' },
    ],
  },
  {
    id: 'services',
    icon: Briefcase,
    label: 'Service Business',
    title: 'Appointments booked in chat',
    desc: 'Service leads pick a time without phone tag — the agent gathers details and books the slot.',
    messages: [
      { side: 'them', text: 'I need a website audit for our store.' },
      { side: 'mine', text: 'Happy to help. What is your current stack, and when would you like a call?' },
      { ai: true, text: 'Lead captured: website audit, store built on Shopify. Suggested call times ready.' },
      { side: 'them', text: 'Tuesday 3 PM works. Book it please.' },
    ],
  },
];

const AUDIENCES = [
  {
    icon: Rocket,
    label: 'Startups',
    desc: 'Validate early lead lists and reach warm prospects directly.',
    steps: ['Find contacts', 'Validate numbers', 'Follow up consistently'],
  },
  {
    icon: ShoppingCart,
    label: 'Ecommerce',
    desc: 'Turn browsing into conversations — cart recovery, order updates, post-purchase care.',
    steps: ['Import customer lists', 'Validate WhatsApp reach', 'Engage buyers in chat'],
  },
  {
    icon: Megaphone,
    label: 'Agencies',
    desc: 'Run cleaner campaigns for more clients with validated audiences.',
    steps: ['Import client lists', 'Clean & verify', 'Launch outreach'],
  },
  {
    icon: Layers2,
    label: 'SaaS',
    desc: 'Activate trials, answer product questions, and guide onboarding.',
    steps: ['Find decision-makers', 'Validate contacts', 'Run onboarding chats'],
  },
  {
    icon: Building2,
    label: 'Local Businesses',
    desc: 'Street-level leads near you, ready for personal outreach.',
    steps: ['Build local lists', 'Verify numbers', 'Convert chats to visits'],
  },
  {
    icon: Briefcase,
    label: 'Service Businesses',
    desc: 'Book appointments and answer service questions in one channel.',
    steps: ['Add service leads', 'Validate numbers', 'Schedule & confirm'],
  },
  {
    icon: Cpu,
    label: 'Technology Companies',
    desc: 'Stay ahead of prospects and partners with verified engagement.',
    steps: ['Compile target accounts', 'Validate contacts', 'Nurture conversations'],
  },
  {
    icon: Target,
    label: 'Sales Teams',
    desc: 'Give reps clean lists and pre-qualified conversations.',
    steps: ['Prepare prospect lists', 'Verify reachability', 'Hand to CRM follow-up'],
  },
];

/* ---------- interactive sections ---------- */
const InteractiveDiscovery = () => {
  const [market, setMarket] = useState(null);
  const [category, setCategory] = useState(null);
  const [region, setRegion] = useState(null);
  const complete = market && category;

  const reset = () => {
    setMarket(null);
    setCategory(null);
    setRegion(null);
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-6">
        {[
          { title: '1 · Target market', options: MARKETS, value: market, set: setMarket },
          { title: '2 · Business category', options: CATEGORIES, value: category, set: setCategory },
          { title: '3 · Region focus', options: REGIONS, value: region, set: setRegion },
        ].map((group) => (
          <Card key={group.title} className="bg-surface border-border/60">
            <CardContent className="p-4 sm:p-5">
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
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Search profile</span>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-text-primary leading-snug">
                    {category} leads in {market}
                    {region && <span className="text-text-muted font-medium"> · {region}</span>}
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
            Pick a market and a business category to preview the workflow.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ConversationShowcase = () => {
  const [active, setActive] = useState(0);
  const scenario = SCENARIOS[active];
  const ActiveIcon = scenario.icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
      <div>
        <div className="flex flex-wrap gap-2 mb-5">
          {SCENARIOS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
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
                {s.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={scenario.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                <ActiveIcon size={17} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-display font-bold text-text-primary">{scenario.title}</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed mt-0.5">{scenario.desc}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-start gap-2.5 mt-4 rounded-xl border border-border/70 bg-surface p-3.5">
          <ShieldCheck size={15} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Illustrated conversation preview — your messages, templates, and AI tone are configured inside the app.
          </p>
        </div>
      </div>

      <motion.div
        key={`mock-${scenario.id}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <ChatMock name={scenario.label} subtitle="Conversation · illustrative" messages={scenario.messages} />
      </motion.div>
    </div>
  );
};

const AudienceSelector = () => {
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

/* ---------- page ---------- */
const LandingPage = () => {
  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full flex flex-col items-center">

        {/* 1 · Hero */}
        <section className="relative w-full py-14 sm:py-18 lg:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-80" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
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
                  Find Your Next Business<br className="hidden sm:block" /> Leads —{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Without the Complexity.</span>
                </motion.h1>

                <motion.p variants={fadeUp} className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto lg:mx-0 leading-relaxed mb-6">
                  Discover, clean, and organize business contact numbers — then turn them into real WhatsApp
                  conversations. Two focused tools, one connected workflow.
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
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-primary" /> Shield-validated numbers</span>
                  <span className="inline-flex items-center gap-1.5"><Sparkles size={13} className="text-primary" /> AI-assisted conversations</span>
                  <span className="inline-flex items-center gap-1.5"><Lock size={13} className="text-primary" /> Local-first &amp; private</span>
                </motion.div>
              </motion.div>
            </div>

            {/* floating product preview */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="relative hidden lg:flex flex-col items-center"
              aria-hidden="true"
            >
              <div className="relative">
                <div className="absolute -inset-8 rounded-full bg-primary/5 blur-2xl" />
                {/* lead card */}
                <div className="relative mb-5 animate-float">
                  <div className="w-72 rounded-2xl border border-border bg-surface shadow-2xl p-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield size={17} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">Wholesale leads · Abdul &amp; Sons</p>
                        <p className="text-[10px] text-text-muted">Karachi · Import/Export</p>
                      </div>
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-success bg-success/10 border border-success/25 rounded-full px-2 py-0.5">
                        <Check size={10} /> Validated
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background px-2.5 py-2">
                      <FlowRail steps={['Normalize', 'Verify', 'Ready']} />
                    </div>
                  </div>
                </div>
                {/* chat card */}
                <div className="ml-10 animate-float-delayed">
                  <div className="w-64 rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
                    <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--ma-bg-panel)' }}>
                      <div className="w-6 h-6 rounded-full bg-[#25D366]/15 flex items-center justify-center">
                        <MessageCircle size={12} className="text-[#1da851]" />
                      </div>
                      <p className="text-[11px] font-bold" style={{ color: 'var(--ma-list-title)' }}>Conversation</p>
                    </div>
                    <div className="px-3 py-3 space-y-1.5" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
                      <p className="rounded-lg rounded-tl-sm px-2.5 py-1.5 text-[10px] leading-relaxed max-w-[85%]"
                        style={{ backgroundColor: 'var(--ma-bubble-received)', color: 'var(--ma-list-title)' }}>
                        Your quote for March delivery — can you share prices?
                      </p>
                      <p className="rounded-lg rounded-tr-sm px-2.5 py-1.5 text-[10px] leading-relaxed max-w-[85%] ml-auto"
                        style={{ backgroundColor: 'var(--ma-bubble-sent)', color: 'var(--ma-list-title)' }}>
                        Absolutely — sending a PDF with the full list now.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 2 · Interactive Lead Discovery */}
        <section className="w-full py-10 sm:py-14 bg-surface border-t border-border px-4 sm:px-6 lg:px-8">
          <div className="app-container">
            <SectionHeading
              eyebrow="Interactive Preview"
              title="Still Struggling to Find the Right Business Leads?"
              subtitle="Pick a market, a business category, and a region to see how Shield organizes and validates what you import."
            />
            <InteractiveDiscovery />
          </div>
        </section>

        {/* 3 · Find Leads Internationally */}
        <section className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
          <div className="app-container">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5 }}
                className="relative flex items-center justify-center"
                aria-hidden="true"
              >
                {/* radar visual */}
                <div className="relative w-60 h-60 sm:w-72 sm:h-72">
                  <div className="absolute inset-0 rounded-full border border-border/70" />
                  <div className="absolute inset-6 rounded-full border border-border/50" />
                  <div className="absolute inset-12 rounded-full border border-border/30" />
                  <div className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,217,126,0.12),transparent_62%)]" />
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,rgba(0,217,126,0.00),rgba(0,217,126,0.18),rgba(0,217,126,0.00)_120deg)]" />
                  </div>
                  <div className="absolute top-[18%] left-[22%]">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                    </span>
                  </div>
                  <div className="absolute top-[38%] right-[14%]">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-60 animate-ping" style={{ animationDelay: '600ms' }} />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary" />
                    </span>
                  </div>
                  <div className="absolute bottom-[22%] left-[32%]">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-60 animate-ping" style={{ animationDelay: '1.2s' }} />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#25D366]" />
                    </span>
                  </div>
                  <div className="absolute bottom-[30%] right-[30%]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-60 animate-ping" style={{ animationDelay: '900ms' }} />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/70" />
                    </span>
                  </div>
                  <div className="absolute top-[52%] left-[12%]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-secondary/50 opacity-60 animate-ping" style={{ animationDelay: '1.6s' }} />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary/70" />
                    </span>
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="w-4 h-4 rounded-full bg-primary shadow-[0_0_12px_rgba(0,217,126,0.6)]" />
                  </div>
                </div>
              </motion.div>

              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
                <motion.div variants={fadeUp}>
                  <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">International</Badge>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2 leading-tight">
                    Find Business Opportunities Beyond Your Local Market
                  </h2>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-6 max-w-xl">
                    Build leads across regions your competitors haven't reached — then validate every number
                    before a single message goes out.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { place: 'United Arab Emirates', seg: 'Dubai & Gulf metro business lists' },
                      { place: 'Saudi Arabia', seg: 'Riyadh / Jeddah trade & services' },
                      { place: 'United Kingdom', seg: 'London & regional companies' },
                      { place: 'United States', seg: 'NY · LA · Texas growth sectors' },
                      { place: 'Australia', seg: 'Sydney / Melbourne SMEs' },
                      { place: 'Europe', seg: 'Germany · France · Netherlands' },
                    ].map((m) => (
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
                    Coverage depends on the source lists you import — validate before you reach out.
                  </p>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4 · Lead Flow Visualization */}
        <section className="w-full py-10 sm:py-14 bg-surface border-t border-b border-border px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="app-container relative z-10">
            <SectionHeading
              eyebrow="The Workflow"
              title="From Lead Discovery to Customer Conversation"
              subtitle="Every lead moves through the same connected pipeline — no spreadsheets, no guesswork."
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
              {LEAD_FLOW.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    className="rounded-2xl border border-border/80 bg-background p-3.5 sm:p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Icon size={15} />
                      </span>
                      <span className="text-[10px] font-bold text-text-muted">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <p className="text-xs sm:text-[13px] font-semibold text-text-primary leading-snug">{step.label}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5 · WhatsApp Marketing */}
        <section className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
          <div className="app-container">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
                <motion.div variants={fadeUp}>
                  <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">Marketing</Badge>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2 leading-tight">
                    Turn WhatsApp Into a Business Growth Channel
                  </h2>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4 max-w-xl">
                    WhatsApp is where many customers already chat every day. Meet them there with clean numbers,
                    structured campaigns, and conversations instead of one-way blasts.
                  </p>
                  <ul className="space-y-2.5 mb-6">
                    {[
                      'Reach people where they already chat',
                      'Two-way conversations beat one-way broadcasts',
                      'Built-in business tools — labels, catalogs, greeting messages',
                      'A familiar channel for every business size',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={11} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </motion.div>

              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
                <motion.div variants={fadeUp} className="rounded-2xl border border-[#25D366]/25 bg-[#25D366]/5 p-4 sm:p-5 mb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
                      <MessageCircle size={17} className="text-[#1da851]" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-text-primary">Conversation-first outreach</h3>
                      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                        Use Shield to verify the audience, then let Message Agent run campaigns, handle replies,
                        and qualify interest.
                      </p>
                    </div>
                  </div>
                  <FlowRail accent="agent" steps={['Verified number', 'Greeting', 'Reply', 'Next step']} />
                </motion.div>

                <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex items-start gap-3">
                  <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-text-primary mb-1">Responsible messaging matters</p>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      We help you reach people who expect to hear from you — clean lists, consent-aware workflows,
                      and WhatsApp's policies followed as standard. Respect the conversation and the channel stays
                      open for everyone.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 6 · Product Into Conversations */}
        <section className="w-full py-10 sm:py-14 bg-surface border-t border-border px-4 sm:px-6 lg:px-8">
          <div className="app-container">
            <SectionHeading
              eyebrow="Showcase"
              title="Turn Your Product Into Conversations"
              subtitle="Pick a business type and watch how a product inquiry becomes a qualified conversation."
            />
            <ConversationShowcase />
          </div>
        </section>

        {/* 7 · Audiences */}
        <section className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
          <div className="app-container">
            <SectionHeading
              eyebrow="Built For You"
              title="Built Around the Way You Do Business"
              subtitle="The same workflow adapts to the leads you work with every day."
            />
            <AudienceSelector />
          </div>
        </section>

        {/* 8 · WhatsApp Shield */}
        <section className="w-full py-10 sm:py-14 bg-surface border-t border-border px-4 sm:px-6 lg:px-8">
          <div className="app-container">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 lg:gap-8 items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                          <Shield size={20} className="text-primary" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-display font-bold text-text-primary">WhatsApp Shield</h3>
                          <p className="text-[11px] text-text-muted">Lead discovery &amp; validation</p>
                        </div>
                      </div>
                      <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl mb-4">
                        Import any list and let Shield normalize, deduplicate, validate, and verify each number —
                        so every campaign starts with an audience worth talking to.
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                        <FlowRail steps={['Import', 'Normalize', 'Deduplicate', 'Validate', 'Verify']} />
                      </div>
                    </div>
                    <div className="flex lg:flex-col gap-2.5">
                      <Button asChild>
                        <Link to={SHIELD_HOME}>Open Shield <ArrowRight size={14} className="ml-2" /></Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to="/user-guide">Shield Guide</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* 9 · Message Agent */}
        <section className="w-full py-10 sm:py-14 bg-background px-4 sm:px-6 lg:px-8">
          <div className="app-container">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <Card className="hover:border-[#25D366]/40 transition-colors">
                  <CardContent className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 lg:gap-8 items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 border border-[#25D366]/25 flex items-center justify-center">
                          <MessageCircle size={20} className="text-[#1da851]" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-display font-bold text-text-primary">WhatsApp Message Agent</h3>
                          <p className="text-[11px] text-text-muted">Conversations · CRM · AI assistance</p>
                        </div>
                      </div>
                      <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl mb-4">
                        Turn verified leads into structured conversations — campaigns, in-chat AI help, qualification,
                        and follow-ups that land in your CRM.
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                        <FlowRail accent="agent" steps={['Verified Lead', 'Campaign', 'Conversation', 'AI Agent', 'Follow-up']} />
                      </div>
                    </div>
                    <div className="flex lg:flex-col gap-2.5">
                      <Button asChild>
                        <Link to="/message-agent">Open Message Agent <ArrowRight size={14} className="ml-2" /></Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to="/user-guide">Agent Guide</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* 10 · AI */}
        <section className="w-full py-10 sm:py-14 bg-surface border-t border-border px-4 sm:px-6 lg:px-8">
          <div className="app-container">
            <SectionHeading
              eyebrow="AI Assistance"
              title="AI That Helps You Handle More Conversations"
              subtitle="Practical help where it matters — without noisy automation."
            />
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {[
                { icon: Sparkles, title: 'Instant answers', desc: 'Reply to common questions while you focus on the rest.' },
                { icon: ClipboardList, title: 'Structured follow-ups', desc: 'Next steps organized automatically in your CRM.' },
                { icon: Search, title: 'Smarter qualification', desc: 'Incoming replies summarized and prioritized for your team.' },
                { icon: Database, title: 'Always in context', desc: 'Grounded in your business profile, templates, and sales notes.' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div key={item.title} variants={fadeUp}>
                    <Card className="h-full hover:-translate-y-1 transition-transform duration-300 hover:border-primary/40 hover:shadow-lg">
                      <CardContent className="p-4 sm:p-5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                          <Icon size={17} />
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-text-primary mb-1.5">{item.title}</h3>
                        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{item.desc}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
            <p className="text-center text-[11px] text-text-muted mt-5">
              AI provider and model settings stay inside the application — public pages never expose them.
            </p>
          </div>
        </section>

        {/* 11 · Final CTA */}
        <section className="w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-60" aria-hidden="true" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-3 leading-tight">
                  Your Next Customer Could Start With a Conversation.
                </h2>
                <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto mb-6 leading-relaxed">
                  Verify leads in WhatsApp Shield, then engage them through WhatsApp Message Agent.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild>
                    <Link to="/dashboard">Explore the Platform <ArrowRight size={14} className="ml-2" /></Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/user-guide">View Guide</Link>
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

      </div>
    </MotionConfig>
  );
};

export default LandingPage;