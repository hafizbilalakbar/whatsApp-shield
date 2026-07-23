import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Lock, Activity, Server, Globe, BookOpen, ArrowRight, MessageCircle, Palette, Code2, CheckCircle, Github, Twitter, Linkedin, Send, Sparkles, Zap, Eye, FileText, Users, Target, Clock } from 'lucide-react';
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

const VALUES = [
  { icon: Lock, title: 'Privacy First', desc: 'Zero data leaves your machine. Every number, result, and session key stays local. No cloud dependency, no tracking, no third-party exposure.' },
  { icon: Shield, title: 'Account Safety', desc: 'Shield Mode implements algorithmic jitter delays and automatic cooldown breaks that mimic human behavior, protecting your WhatsApp account during bulk operations.' },
  { icon: Eye, title: 'Full Transparency', desc: 'Watch every validation happen in real time through a sandboxed terminal. Every check, every result, every status update is visible instantly.' },
  { icon: Zap, title: 'Performance at Scale', desc: 'Engineered to handle hundreds of thousands of numbers per session with intelligent rate-limiting, memory-efficient processing, and real-time progress tracking.' },
  { icon: FileText, title: 'Multi-Format Export', desc: 'Export clean validated lists to CSV, TXT, JSON, or generate professional PDF reports with country breakdowns and campaign summaries.' },
  { icon: Globe, title: 'Global Compatibility', desc: 'Auto-detection and normalization for phone numbers from 195+ countries. Paste any format and let the engine handle the rest.' },
];

const TECH_STACK = [
  { icon: Server, name: 'Node.js', role: 'Backend Runtime' },
  { icon: Code2, name: 'React', role: 'Frontend Framework' },
  { icon: MessageCircle, name: 'Baileys', role: 'WhatsApp Web API' },
  { icon: Globe, name: 'libphonenumber-js', role: 'Phone Parsing' },
  { icon: Palette, name: 'Tailwind CSS', role: 'Styling & UI' },
];

const METRICS = [
  { value: '195+', label: 'Countries Supported' },
  { value: '100K+', label: 'Numbers per Session' },
  { value: '99.9%', label: 'Local Processing' },
  { value: '0', label: 'Data Uploaded' },
];

const AboutPage = () => {
  return (
    <div className="w-full">

      {/* SEO-friendly meta */}
      <div className="hidden">
        <h1>About WhatsApp Shield — Privacy-First Bulk Number Validation Platform</h1>
        <p>WhatsApp Shield is a local-only, privacy-first platform for validating phone numbers against WhatsApp's network at scale. No cloud dependency, zero data leakage, enterprise-grade account safety.</p>
      </div>

      {/* Hero */}
      <section className="relative w-full py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-60" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="flex justify-center mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Shield size={32} className="sm:size-[40] text-primary" />
              </div>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-tight mb-4">
              Built for Professionals<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Who Move Fast</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-sm sm:text-base lg:text-lg text-text-secondary max-w-2xl mx-auto mb-8 leading-relaxed">
              WhatsApp Shield is the enterprise-grade platform for validating massive phone number lists against WhatsApp's network.
              Engineered with strict anti-ban jitter delays, zero cloud dependency, and complete privacy by design.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/dashboard">Open Dashboard <Activity size={16} className="ml-2 sm:size-[18]" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/user-guide">View User Guide <BookOpen size={16} className="ml-2 sm:size-[18]" /></Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Key Metrics Strip */}
      <section className="w-full py-10 sm:py-14 bg-surface border-t border-b border-border px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {METRICS.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary font-display">{m.value}</p>
                <p className="text-xs sm:text-sm text-text-muted mt-1">{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-14 items-center">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <Badge variant="outline" className="mb-4 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">Our Story</Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-4 leading-tight">
                Why We Built WhatsApp Shield
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4">
                Validating phone numbers against WhatsApp is a routine task for marketers, researchers, and businesses worldwide.
                But every existing solution forced users to choose between speed and safety — either validate quickly and risk getting flagged,
                or go slowly and waste hours on manual work.
              </p>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4">
                We built WhatsApp Shield to eliminate that trade-off. Our platform combines algorithmic jitter delays, 
                intelligent rate-limiting, and humanized checking patterns to deliver both speed and safety at enterprise scale.
                Every validation runs entirely on your local machine — no cloud, no data leakage, no third-party exposure.
              </p>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                Today, WhatsApp Shield is trusted by marketing agencies, CRM managers, data analysts, and engineering teams across 
                six continents to validate millions of numbers while keeping their WhatsApp accounts completely safe.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="grid grid-cols-2 gap-3 sm:gap-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 sm:p-6 text-center">
                  <Target size={22} className="sm:size-[26] text-primary mx-auto mb-2 sm:mb-3" />
                  <h3 className="text-xs sm:text-sm font-bold mb-1">Our Mission</h3>
                  <p className="text-[11px] sm:text-xs text-text-secondary">Make bulk WhatsApp validation safe, fast, and accessible to everyone.</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 sm:p-6 text-center">
                  <Sparkles size={22} className="sm:size-[26] text-primary mx-auto mb-2 sm:mb-3" />
                  <h3 className="text-xs sm:text-sm font-bold mb-1">Our Vision</h3>
                  <p className="text-[11px] sm:text-xs text-text-secondary">A world where data validation is private by default and safety is never optional.</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20 col-span-2">
                <CardContent className="p-4 sm:p-6 flex items-start gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle size={18} className="sm:size-[22] text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold mb-1">Our Commitment</h3>
                    <p className="text-[11px] sm:text-xs text-text-secondary leading-relaxed">
                      We will never store your data, never upload your phone numbers, and never compromise on account safety.
                      WhatsApp Shield is — and always will be — a local-first, privacy-first platform.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="w-full py-16 sm:py-24 bg-surface border-t border-b border-border px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10 sm:mb-14">
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-4 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">Core Values</Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-3">Built on Principles, Not Compromises</h2>
              <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto">Every feature, every decision, every line of code reflects our commitment to privacy, safety, and performance.</p>
            </motion.div>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {VALUES.map((v, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="h-full group hover:border-primary/40 transition-colors">
                  <CardContent className="p-5 sm:p-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-transform">
                      <v.icon size={18} className="sm:size-[22] text-primary" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold mb-1.5 sm:mb-2">{v.title}</h3>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{v.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Anti-Ban Technology */}
      <section className="w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-14 items-center">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="order-2 lg:order-1">
              <Badge variant="outline" className="mb-4 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">Technology</Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-4 leading-tight">Anti-Ban Engineering</h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4">
                WhatsApp's parent company actively monitors for automated behavior. Sending requests at regular intervals or
                at maximum speed triggers detection algorithms that can flag or ban your account permanently.
              </p>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4">
                Shield Mode defeats these detection systems by implementing randomized jitter delays between checks,
                automatic cooldown breaks every 10 validations, typing simulation patterns, and irregular timing that
                closely mimics human browsing behavior.
              </p>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                The result: you can validate thousands of numbers per session with the same account safety profile
                as manual one-by-one checking — but at 50x the speed.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="order-1 lg:order-2">
              <div className="rounded-2xl border border-border bg-surface p-5 sm:p-8 shadow-sm">
                <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-5 flex items-center gap-2">
                  <Shield size={18} className="sm:size-[20] text-primary" />
                  Shield Mode Features
                </h3>
                <ul className="space-y-3 sm:space-y-4">
                  {[
                    { icon: Zap, text: 'Randomized jitter delays between 2–5 seconds per check' },
                    { icon: Clock, text: 'Automatic cooldown break after every 10 validations' },
                    { icon: Users, text: 'Typing simulation and humanized interaction patterns' },
                    { icon: Activity, text: 'Irregular timing that avoids detection algorithms' },
                    { icon: Shield, text: 'Duplicate message filtering to prevent repeated sends' },
                    { icon: Eye, text: 'Real-time terminal showing every action as it happens' },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                        <Icon size={14} className="sm:size-[16] text-primary mt-0.5 shrink-0" />
                        <span className="text-xs sm:text-sm text-text-secondary">{item.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="w-full py-16 sm:py-24 bg-surface border-t border-b border-border px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10 sm:mb-14">
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-4 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">Stack</Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-3">Built on Modern Technology</h2>
              <p className="text-sm sm:text-base text-text-secondary">A robust, battle-tested stack engineered for reliability and performance at scale.</p>
            </motion.div>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            {TECH_STACK.map((tech, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-4 sm:p-5 rounded-xl bg-background border border-border text-center hover:border-primary/50 transition-all hover:-translate-y-0.5"
              >
                <tech.icon size={22} className="sm:size-[28] text-primary mx-auto mb-2 sm:mb-3" />
                <h4 className="font-semibold text-xs sm:text-sm">{tech.name}</h4>
                <p className="text-[10px] sm:text-xs text-text-muted mt-0.5 sm:mt-1">{tech.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Trust */}
      <section className="w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-4 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">Privacy & Trust</Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-4 leading-tight">Your Data Never Leaves Your Machine</h2>
              <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto mb-6 leading-relaxed">
                In an era of constant data breaches and surveillance, WhatsApp Shield takes a different approach.
                Every piece of data — every phone number, every validation result, every session credential —
                stays on your computer. Always.
              </p>
            </motion.div>
            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto mb-8">
              {[
                { icon: Lock, title: 'Zero Cloud Dependency', desc: 'No servers, no databases, no third-party APIs. Everything runs locally.' },
                { icon: Eye, title: 'No Tracking', desc: 'We do not collect usage data, analytics, or telemetry of any kind.' },
                { icon: Shield, title: 'Session Privacy', desc: 'Your WhatsApp session keys stay on your device and are never transmitted.' },
              ].map((item, i) => (
                <Card key={i} className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 sm:p-5 text-center">
                    <item.icon size={20} className="sm:size-[24] text-primary mx-auto mb-2 sm:mb-3" />
                    <h3 className="text-xs sm:text-sm font-bold mb-1">{item.title}</h3>
                    <p className="text-[11px] sm:text-xs text-text-secondary">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/dashboard">Get Started Free <ArrowRight size={16} className="ml-2 sm:size-[18]" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/privacy">Read Privacy Policy <FileText size={16} className="ml-2 sm:size-[18]" /></Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Team / Independence */}
      <section className="w-full py-16 sm:py-24 bg-surface border-t border-b border-border px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-4 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">Independent</Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-4 leading-tight">Independent. Focused. Reliable.</h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto mb-6">
                WhatsApp Shield is an independent tool built for marketers, researchers, and developers who need reliable bulk number validation
                without compromising account safety. No venture capital, no data harvesting, no corporate overlords — just clean, 
                local software that does its job and respects your privacy.
              </p>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto mb-6">
                Our development philosophy is simple: build tools that solve real problems, protect user privacy by default, 
                and never take shortcuts on safety. Every feature is designed with these principles at its core.
              </p>
              <div className="flex items-center justify-center gap-6 sm:gap-8 text-text-secondary text-xs sm:text-sm">
                <div className="flex items-center gap-1.5"><Users size={14} className="sm:size-[16] text-primary" /> Developer-Led</div>
                <div className="flex items-center gap-1.5"><Lock size={14} className="sm:size-[16] text-primary" /> Privacy by Design</div>
                <div className="flex items-center gap-1.5"><Globe size={14} className="sm:size-[16] text-primary" /> Open Standards</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-40" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold mb-3 leading-tight">Ready to Validate at Scale?</h2>
              <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed">
                Start validating phone numbers in minutes. No setup, no configuration — just paste your list and go.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link to="/dashboard">Open Dashboard <Activity size={16} className="ml-2 sm:size-[18]" /></Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/user-guide">Read the Guide <BookOpen size={16} className="ml-2 sm:size-[18]" /></Link>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Social Links */}
      <section className="w-full py-10 sm:py-12 border-t border-border px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 sm:mb-4">Connect With Us</p>
          <div className="flex justify-center gap-3 sm:gap-4">
            {[
              { icon: Github, href: 'https://github.com' },
              { icon: Twitter, href: 'https://twitter.com' },
              { icon: Linkedin, href: 'https://linkedin.com' },
              { icon: Send, href: 'https://t.me' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/50 transition-all hover:-translate-y-0.5">
                  <Icon size={16} className="sm:size-[18]" />
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
