import React from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Shield, MessageCircle, Search, BadgeCheck, Send, Database, Clock,
  ArrowRight, ArrowDown, Target, BookOpen,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { cn } from '../components/ui/cn';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

/* Small numbered pipeline used as a clean product preview. */
const MiniFlow = ({ steps, accent = 'primary' }) => (
  <div className="flex flex-wrap items-center gap-2 justify-center">
    {steps.map((s, i) => (
      <div key={s} className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1.5">
          <span className={cn(
            'w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0',
            accent === 'agent' ? 'bg-[#25D366]/10 text-[#1da851]' : 'bg-primary/10 text-primary'
          )}>
            {i + 1}
          </span>
          <span className="text-[11px] font-semibold text-text-primary">{s}</span>
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

const SectionHeading = ({ badge, title, subtitle, className }) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: '-60px' }}
    variants={stagger}
    className={cn('text-center mb-8 sm:mb-10', className)}
  >
    <motion.div variants={fadeUp}>
      <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">{badge}</Badge>
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2">{title}</h2>
      {subtitle && <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
    </motion.div>
  </motion.div>
);

const AboutPage = () => {
  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full">

        {/* 1 · Hero */}
        <section className="relative w-full py-14 sm:py-18 lg:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-60" aria-hidden="true" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-primary">
                  <Shield size={12} /> WhatsApp Shield
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full border border-[#25D366]/25 bg-[#25D366]/5 px-3 py-1 text-[#1da851]">
                  <MessageCircle size={12} /> WhatsApp Message Agent
                </span>
              </motion.div>
              <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight leading-tight mb-4">
                Find leads you can trust.<br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Turn them into conversations.</span>
              </motion.h1>
              <motion.p variants={fadeUp} className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto mb-6 leading-relaxed">
                WhatsApp Shield and WhatsApp Message Agent bring lead discovery, validation, and WhatsApp engagement
                together in one connected workflow — so you spend less time fixing lists and more time talking to customers.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild>
                  <Link to="/dashboard">Explore the Platform <ArrowRight size={14} className="ml-2" /></Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/user-guide">View Guide <BookOpen size={14} className="ml-2" /></Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* 2 · Why We Built It */}
        <section className="w-full py-10 sm:py-14 bg-surface border-t border-b border-border px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 sm:gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">Why We Built It</Badge>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-3 leading-tight">
                Lead work is fragmented. It shouldn't be.
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-3">
                Finding, organizing, validating, and engaging potential business leads usually means jumping between
                spreadsheets, scraping tools, and scattered chats. That slows teams down and sends messy data into campaigns.
              </p>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                We built one platform that brings the whole lead workflow together: discover and clean contacts in WhatsApp
                Shield, then engage them through WhatsApp Message Agent.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 lg:gap-4 lg:min-w-[240px]">
              {[
                { icon: Search, label: 'Discover leads' },
                { icon: BadgeCheck, label: 'Validate numbers' },
                { icon: MessageCircle, label: 'Engage on WhatsApp' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background px-3.5 py-2.5"
                  >
                    <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon size={14} /></span>
                    <span className="text-sm font-semibold text-text-primary">{item.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3 · Two Core Products */}
        <section className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <SectionHeading
              badge="Two Core Products"
              title="One platform, two focused tools"
              subtitle="Shield prepares the numbers. Message Agent turns them into conversations."
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {/* WhatsApp Shield */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}>
                <Card className="h-full flex flex-col hover:border-primary/40 transition-colors">
                  <CardContent className="p-5 sm:p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Shield size={20} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-display font-bold text-text-primary">WhatsApp Shield</h3>
                        <p className="text-[11px] text-text-muted">Lead discovery &amp; validation</p>
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-5">
                      Import, normalize, deduplicate, validate, and verify WhatsApp contact numbers — so you only reach
                      out to clean, real leads.
                    </p>
                    <div className="mt-auto">
                      <MiniFlow steps={['Import', 'Normalize', 'Deduplicate', 'Validate', 'Verify', 'Ready']} />
                      <div className="mt-4 pt-4 border-t border-border/70 flex items-center justify-between gap-3">
                        <span className="text-[11px] sm:text-xs text-text-muted">Ready for Message Agent</span>
                        <Button size="sm" asChild><Link to="/dashboard">Open Shield <ArrowRight size={13} className="ml-1.5" /></Link></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Message Agent */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: 0.1, duration: 0.5 }}>
                <Card className="h-full flex flex-col hover:border-[#25D366]/40 transition-colors">
                  <CardContent className="p-5 sm:p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 border border-[#25D366]/25 flex items-center justify-center">
                        <MessageCircle size={20} className="text-[#1da851]" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-display font-bold text-text-primary">WhatsApp Message Agent</h3>
                        <p className="text-[11px] text-text-muted">Conversations, CRM &amp; follow-ups</p>
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-5">
                      Manage WhatsApp conversations, run structured campaigns, and follow up with qualified leads — with AI
                      assistance where it helps.
                    </p>
                    <div className="mt-auto">
                      <MiniFlow accent="agent" steps={['Verified Lead', 'Campaign', 'Reply', 'AI Agent', 'Qualification', 'Follow-up']} />
                      <div className="mt-4 pt-4 border-t border-border/70 flex items-center justify-between gap-3">
                        <span className="text-[11px] sm:text-xs text-text-muted">Structured follow-up workflows</span>
                        <Button size="sm" asChild><Link to="/message-agent">Open Message Agent <ArrowRight size={13} className="ml-1.5" /></Link></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4 · Simple Lead Workflow */}
        <section className="w-full py-10 sm:py-14 bg-surface border-t border-b border-border px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <SectionHeading
              badge="The Workflow"
              title="From discovery to follow-up"
            />
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 justify-center">
              {[
                { label: 'Lead Discovery', icon: Search },
                { label: 'Validation', icon: BadgeCheck },
                { label: 'WhatsApp Outreach', icon: Send },
                { label: 'AI & CRM', icon: Database },
                { label: 'Follow-up', icon: Clock },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.07, duration: 0.4 }}
                    className="flex flex-col lg:flex-row lg:items-center gap-2"
                  >
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 shadow-sm">
                      <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon size={14} /></span>
                      <span className="text-xs font-semibold text-text-primary">{s.label}</span>
                      <span className="ml-1 text-[10px] text-text-muted hidden sm:inline">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    {i < 4 && (
                      <span className="flex justify-center text-text-muted" aria-hidden="true">
                        <ArrowRight size={14} className="hidden lg:block" />
                        <ArrowDown size={14} className="lg:hidden" />
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5 · Our Mission */}
        <section className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <Target size={20} className="text-primary mx-auto mb-3" />
                <h2 className="text-xl sm:text-2xl font-display font-bold mb-3 leading-tight">Our Mission</h2>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                  We make business lead generation and WhatsApp customer engagement simpler and more accessible — so any
                  business can find the right people, start the right conversations, and follow up with care.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* 6 · CTA */}
        <section className="w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-40" aria-hidden="true" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-3 leading-tight">
                  Ready to build your lead workflow?
                </h2>
                <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto mb-6 leading-relaxed">
                  Start with verified numbers in WhatsApp Shield, then engage them in WhatsApp Message Agent.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild><Link to="/dashboard">Explore the Platform <ArrowRight size={14} className="ml-2" /></Link></Button>
                  <Button variant="outline" asChild><Link to="/user-guide">View Guide <BookOpen size={14} className="ml-2" /></Link></Button>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

      </div>
    </MotionConfig>
  );
};

export default AboutPage;