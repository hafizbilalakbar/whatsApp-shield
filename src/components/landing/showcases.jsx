import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, BadgeCheck, MessageCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../ui/cn';
import { SHIELD_HOME, AGENT_HOME } from '../../utils/paths';
import { ShieldScanMock, AgentAppMock } from './mockups';

/* ============================================================
   Sections — copy + CTA on one side, animated mockup on the other
   ============================================================ */

const ShowcaseCopy = ({ eyebrow, badge, title, subtitle, bullets, cta, ctaHref, secondary }) => (
  <motion.div variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09 } } }} className="max-w-xl">
    <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}>
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-text-muted mb-2 flex items-center gap-2">
        {eyebrow}
        <span className="h-px w-8 bg-primary/40 hidden sm:block" />
      </p>
      <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">{badge}</Badge>
      <h2 className="text-2xl sm:text-3xl lg:text-[2.35rem] font-display font-bold mb-4 leading-[1.15] tracking-tight">{title}</h2>
      <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-7">{subtitle}</p>
    </motion.div>

    <motion.ul
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
      className="space-y-2.5 mb-8"
    >
      {bullets.map((b) => (
        <motion.li key={b} variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } } }} className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 mt-px">
            <Check size={10} className="text-primary" />
          </span>
          <span className="text-sm text-text-secondary">{b}</span>
        </motion.li>
      ))}
    </motion.ul>

    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } }} className="flex flex-wrap items-center gap-3">
      <Button asChild size="lg">
        <Link to={ctaHref}>
          {cta} <ArrowRight size={15} />
        </Link>
      </Button>
      {secondary && (
        <Button asChild size="lg" variant="outline">
          <Link to={secondary.href}>{secondary.label}</Link>
        </Button>
      )}
    </motion.div>
  </motion.div>
);

const GlowOrb = ({ className }) => (
  <div className={cn('absolute rounded-full blur-3xl pointer-events-none select-none hidden sm:block', className)} aria-hidden="true" />
);

export const ShieldShowcase = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
      className="order-2 lg:order-1"
    >
      <ShowcaseCopy
        eyebrow="Product 01"
        badge="WhatsApp Shield"
        title="Clean Your WhatsApp Lead Pipeline Before You Reach Out."
        subtitle="Validate, organize, scan, and prepare your contacts with WhatsApp Shield — then move qualified leads directly into your conversations."
        bullets={[
          'Check every number for an active WhatsApp presence before any message goes out',
          'Scan, deduplicate, and organize contacts by country and market',
          'Export clean lists as CSV · JSON · TXT · PDF — with history and reports',
        ]}
        cta="Explore WhatsApp Shield"
        ctaHref={SHIELD_HOME}
        secondary={{ href: '#message-agent', label: 'See the workflow' }}
      />
    </motion.div>

    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, visible: { transition: { delayChildren: 0.15 } } }}
      className="relative order-1 lg:order-2"
    >
      <GlowOrb className="top-8 -right-6 w-64 h-64 bg-primary/20 dark:bg-primary/15" />
      <GlowOrb className="-bottom-10 -left-8 w-56 h-56 bg-[#0891B2]/10" />
      <motion.div
        variants={{ hidden: { opacity: 0, y: 28, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } } }}
        className="relative z-10"
      >
        <ShieldScanMock />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="absolute -bottom-7 right-2 z-20 hidden sm:block"
        aria-hidden="true"
      >
        <div className="rounded-xl border border-border/80 bg-surface/95 backdrop-blur-md shadow-xl px-3 py-2 flex items-center gap-2 animate-float-slow">
          <span className="w-6 h-6 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0"><BadgeCheck size={13} /></span>
          <div>
            <p className="text-[10px] font-bold text-text-primary leading-tight">126 valid contacts</p>
            <p className="text-[8.5px] text-text-muted">ready for Message Agent</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  </div>
);

export const AgentShowcase = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
      className="relative order-1 lg:order-2"
    >
      <GlowOrb className="-top-6 -left-8 w-60 h-60 bg-[#25D366]/15 dark:bg-[#25D366]/10" />
      <motion.div
        variants={{ hidden: { opacity: 0, y: 28, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } } }}
        className="relative z-10"
      >
        <AgentAppMock />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="absolute -bottom-7 left-2 z-20 hidden sm:block"
        aria-hidden="true"
      >
        <div className="rounded-xl border border-[#25D366]/25 bg-surface/95 backdrop-blur-md shadow-xl px-3 py-2 flex items-center gap-2 animate-float">
          <span className="w-6 h-6 rounded-lg bg-[#25D366]/15 text-[#1da851] flex items-center justify-center shrink-0"><MessageCircle size={13} /></span>
          <div>
            <p className="text-[10px] font-bold text-text-primary leading-tight">New lead → conversation</p>
            <p className="text-[8.5px] text-text-muted">catalog sent · qualified</p>
          </div>
        </div>
      </motion.div>
    </motion.div>

    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
      className="order-2 lg:order-1"
    >
      <ShowcaseCopy
        eyebrow="Product 02"
        badge="Message Agent"
        title="Turn Valid Leads Into Real Conversations."
        subtitle="Bring your leads into one focused workspace, manage conversations, follow up faster, and keep every customer interaction organized."
        bullets={[
          'A WhatsApp Web-style inbox with search, filters, and unread tracking',
          'Templates, attachments, and lead status that move a conversation forward',
          'Customer profiles, tags, and activity — so no context ever gets lost',
        ]}
        cta="Explore Message Agent"
        ctaHref={AGENT_HOME}
        secondary={{ href: '#message-agent', label: 'See the workflow' }}
      />
    </motion.div>
  </div>
);