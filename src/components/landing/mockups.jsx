import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Database, Shield, BadgeCheck, MessageCircle, Send, HeartHandshake,
  ArrowRight, ArrowDown, Search, Check, X, Download, FileText,
  Sparkles, ChevronDown, Paperclip, ShieldCheck, MoreVertical, Clock, CheckCheck,
} from 'lucide-react';
import { cn } from '../ui/cn';
import { useCyclingIndex } from './shared';

/* ---------- HERO VISUAL: Sources → Shield → Verified → Agent → WhatsApp → CRM ---------- */
const HERO_NODES = [
  { label: 'Lead Sources', icon: Database },
  { label: 'Shield', icon: Shield },
  { label: 'Verified Leads', icon: BadgeCheck },
  { label: 'Message Agent', icon: MessageCircle },
  { label: 'WhatsApp', icon: Send },
  { label: 'CRM', icon: HeartHandshake },
];

export const HeroWorkflow = () => {
  const reduce = useReducedMotion();
  const active = useCyclingIndex(HERO_NODES.length, 1500);

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 blur-2xl" aria-hidden="true" />
      <div className="relative rounded-3xl border border-border bg-surface/80 backdrop-blur-md shadow-2xl p-5 sm:p-7">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-display font-bold text-text-primary">Lead Workflow</p>
            <p className="text-[11px] text-text-muted">Sources → Shield → Agent → WhatsApp → CRM</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-success bg-success/10 border border-success/25 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
          </span>
        </div>

        {/* horizontal flow (lg+) */}
        <div className="hidden md:flex flex-col gap-3">
          <div className="flex items-center">
            {HERO_NODES.map((n, i) => {
              const Icon = n.icon;
              const isActive = active === i;
              const done = active === -1 ? true : i <= active;
              const isAgent = n.label === 'Message Agent';
              return (
                <React.Fragment key={n.label}>
                  <div className="relative flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <motion.div
                      animate={{ scale: isActive ? 1.08 : 1 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        'w-11 h-11 rounded-xl border flex items-center justify-center transition-colors duration-300',
                        isAgent
                          ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#1da851]'
                          : done
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-surface border-border text-text-muted'
                      )}
                    >
                      <Icon size={18} />
                    </motion.div>
                    <span className={cn('text-[10px] font-semibold text-center leading-tight', done ? 'text-text-primary' : 'text-text-muted')}>
                      {n.label}
                    </span>
                  </div>
                  {i < HERO_NODES.length - 1 && (
                    <span className="shrink-0 text-text-muted mb-5" aria-hidden="true">
                      <ArrowRight size={13} />
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="relative h-1.5 rounded-full border border-border/60 bg-surface overflow-hidden">
            {!reduce && active !== -1 && (
              <motion.div
                className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_10px_rgba(0,217,126,0.5)]"
                style={{ width: '16%' }}
                animate={{ left: `calc(${((active / (HERO_NODES.length - 1)) * 100).toFixed(1)}% - 8%)` }}
                initial={false}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            )}
            {reduce && <div className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-primary/40" />}
          </div>
          <div className="flex justify-between text-[9px] text-text-muted">
            <span>Emails · Web · Referrals</span>
            <span>Clean · Validated · Unique</span>
            <span>Reply · Follow up · Close</span>
          </div>
        </div>

        {/* vertical flow (mobile) */}
        <div className="md:hidden flex flex-col gap-2">
          {HERO_NODES.map((n, i) => {
            const Icon = n.icon;
            const isAgent = n.label === 'Message Agent';
            return (
              <div key={n.label} className="flex items-center gap-2">
                <div className={cn(
                  'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0',
                  isAgent ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#1da851]' : 'bg-primary/10 border-primary/30 text-primary'
                )}>
                  <Icon size={16} />
                </div>
                <span className="text-xs font-semibold text-text-primary">{n.label}</span>
                {i < HERO_NODES.length - 1 && (
                  <span className="ml-auto text-text-muted" aria-hidden="true"><ArrowDown size={13} /></span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------- WHATSAPP SHIELD · LIVE SCAN (animated dashboard) ---------- */
const SCAN_ROWS = [
  { name: 'Tariq Haddad', img: '/avatars-funnel/u04.jpg', num: '+971 50 123 4567', country: 'UAE', role: 'Real Estate' },
  { name: 'Leila Mansour', img: '/avatars-funnel/u07.jpg', num: '+966 55 111 2345', country: 'KSA', role: 'Retail' },
  { name: 'Noah Steinberg', img: '/avatars-funnel/u08.jpg', num: '+1 415 555 0132', country: 'USA', role: 'E-commerce' },
  { name: 'Élodie Vasseur', img: '/avatars-funnel/u11.jpg', num: '+44 7700 900123', country: 'UK', role: 'Logistics' },
];
const SCAN_RESULTS = ['valid', 'valid', 'invalid', 'valid'];

export const ShieldScanMock = () => {
  const reduce = useReducedMotion();
  const step = useCyclingIndex(SCAN_ROWS.length + 2, 900); // extra 2 frames for a "completed" hold
  const rowsDone = Math.min(step, SCAN_ROWS.length);
  const completed = step >= SCAN_ROWS.length;
  const progress = Math.round((rowsDone / SCAN_ROWS.length) * 100);
  const validCount = SCAN_RESULTS.slice(0, rowsDone).filter((s) => s === 'valid').length;

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-tr from-primary/10 via-transparent to-secondary/10 blur-2xl" aria-hidden="true" />
      <div className="relative rounded-3xl border border-border bg-surface/90 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/70 bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
              <Shield size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-text-primary leading-tight">Live scan · Campaign A</p>
              <p className="text-[10px] text-text-muted">Region: Middle East &amp; Europe</p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[10px] font-bold rounded-full px-2.5 py-1 border',
              completed
                ? 'text-success bg-success/10 border-success/25'
                : 'text-primary bg-primary/10 border-primary/25'
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', completed ? 'bg-success' : 'bg-primary')} />
            {completed ? 'Completed' : `Scanning · ${progress}%`}
          </span>
        </div>

        {/* progress */}
        <div className="px-4 pt-3">
          <div className="h-1.5 rounded-full bg-surface overflow-hidden border border-border/60">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_8px_rgba(0,217,126,0.6)]"
              animate={{ width: reduce ? '100%' : `${progress}%` }}
              initial={false}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
            />
          </div>
        </div>

        {/* rows */}
        <div className="px-2 py-3 flex flex-col gap-1">
          {SCAN_ROWS.map((row, i) => {
            const done = i < rowsDone;
            const checking = completed ? false : i === rowsDone;
            const result = SCAN_RESULTS[i];
            return (
              <motion.div
                key={row.num}
                initial={{ opacity: 0, x: -6 }}
                animate={done ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-300',
                  checking
                    ? 'border-primary/30 bg-primary/5'
                    : done
                      ? 'border-border/70 bg-surface'
                      : 'border-transparent bg-background/40'
                )}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-border shrink-0">
                  <img src={row.img} alt={row.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-xs font-semibold truncate', done ? 'text-text-primary' : 'text-text-muted')}>{row.name}</p>
                  <p className="text-[10px] text-text-muted font-mono truncate">{row.role} · {row.num} · {row.country}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold">
                  {checking && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      <span className="text-text-muted">Checking</span>
                    </>
                  )}
                  {done && (
                    result === 'valid' ? (
                      <span className="text-success bg-success/10 border border-success/25 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        <Check size={10} /> Valid
                      </span>
                    ) : (
                      <span className="text-error bg-error/10 border border-error/25 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        <X size={10} /> Invalid
                      </span>
                    )
                  )}
                  {!done && !checking && <span className="text-text-muted/60">—</span>}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* footer: stats + exports */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border/70 bg-surface">
          <div className="flex items-center gap-3 text-[10px] font-semibold">
            <span className="text-text-muted">Checked <span className="text-text-primary">{rowsDone}</span></span>
            <span className="text-text-muted">Valid <span className="text-success">{validCount}</span></span>
            <span className="text-text-muted">Invalid <span className="text-error">{rowsDone - validCount}</span></span>
          </div>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {['CSV', 'JSON', 'TXT', 'PDF'].map((f) => (
              <span key={f} className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-1.5 py-1 text-[9px] font-bold text-text-secondary">
                <Download size={9} className="text-primary" /> {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- MESSAGE AGENT · WHATSAPP WEB-STYLE INTERFACE ---------- */
const AGENT_CONTACTS = [
  {
    name: 'Zara Iqbal', img: '/avatars-funnel/u10.jpg', role: 'Import/Export · Dubai',
    status: 'New lead', statusTone: 'primary', time: '09:41', unread: 1,
    color: 'bg-primary/15 text-primary border-primary/30',
    messages: [
      { side: 'them', text: 'Salam! I saw your WhatsApp listing for sourcing agents.' },
      { side: 'ai', text: 'High intent detected. Suggest a short intro call this week.' },
      { side: 'mine', text: 'Hi Zara — happy to walk you through how we work together.' },
    ],
  },
  {
    name: 'Bilal Sheikh', img: '/avatars-funnel/u13.jpg', role: 'Retail · Lahore',
    status: 'Qualified', statusTone: 'success', time: '10:02', unread: 0,
    color: 'bg-success/15 text-success border-success/30',
    messages: [
      { side: 'them', text: 'I need 40+ wholesale contacts for glassware.' },
      { side: 'mine', text: 'We have a validated list ready — sending it now.' },
      { side: 'them', text: 'Perfect, this is exactly what we needed.' },
    ],
  },
  {
    name: 'Mateo Alves', img: '/avatars-funnel/u14.jpg', role: 'Logistics · Lisbon',
    status: 'Follow up', statusTone: 'warning', time: 'Yesterday', unread: 2,
    color: 'bg-warning/15 text-warning border-warning/30',
    messages: [
      { side: 'them', text: 'Are the results from last week ready for review?' },
      { side: 'mine', text: 'Yep — PDF report going out this afternoon.' },
    ],
  },
];

const TEMPLATE_ACTIONS = {
  Welcome: 'Hi {name}! Thanks for reaching out — how can we help?',
  'Follow-up': 'Hi {name}, just checking in on our last message. Still interested?',
  Appointment: 'Hi {name}, shall we lock in a 15-minute call this week?',
  'Product inquiry': 'Hi {name}, I can send full details and pricing if useful.',
};

const TEMPLATE_REPLIES = {
  Welcome: 'Thanks — good to be connected!',
  'Follow-up': 'Yes, still interested. Send the details.',
  Appointment: 'Thursday works for me. 3 PM?',
  'Product inquiry': 'Yes please, pricing would help.',
};

const nick = (name) => name.split(' ')[0];

export const AgentAppMock = () => {
  const reduce = useReducedMotion();
  const [contacts, setContacts] = useState(AGENT_CONTACTS);
  const [activeId, setActiveId] = useState(0);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);
  const active = contacts[activeId];
  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, contacts, typing, reduce]);

  const sendTemplate = (key) => {
    const text = TEMPLATE_ACTIONS[key].replace('{name}', nick(active.name));
    const reply = TEMPLATE_REPLIES[key];
    setContacts((prev) => prev.map((c, i) =>
      i === activeId
        ? { ...c, messages: [...c.messages, { side: 'mine', text }], unread: 0, status: 'Replied' }
        : c
    ));
    setTyping(true);
    window.setTimeout(() => {
      setContacts((prev) => prev.map((c, i) =>
        i === activeId ? { ...c, messages: [...c.messages, { side: 'them', text: reply }], status: 'Responded' } : c
      ));
      setTyping(false);
    }, reduce ? 0 : 1700);
  };

  const select = (id) => {
    setActiveId(id);
    setContacts((prev) => prev.map((c, i) => (i === id ? { ...c, unread: 0 } : c)));
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-[#25D366]/10 via-transparent to-secondary/10 blur-2xl" aria-hidden="true" />
      <div className="relative rounded-3xl border border-border shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--ma-bg-panel)' }}>
        <div className="grid md:grid-cols-[240px_1fr] min-h-[430px]">
          {/* contact list */}
          <div className="hidden md:flex flex-col border-r" style={{ borderColor: 'var(--ma-line-slim)' }}>
            <div className="px-3 py-3 flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: 'var(--ma-list-title)' }}>Chats</p>
              <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--ma-bg-active)', color: 'var(--ma-muted-text)' }}>
                {contacts.length} leads
              </span>
            </div>
            <div className="px-3 pb-3">
              <div
                className="flex items-center gap-2 rounded-full px-3 py-2"
                style={{ backgroundColor: 'var(--ma-bg-elevated)' }}
              >
                <Search size={13} style={{ color: 'var(--ma-muted-text)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search leads…"
                  aria-label="Search leads"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-xs placeholder:opacity-70"
                  style={{ color: 'var(--ma-search-text)' }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto landing-scrollbar">
              {filtered.map((c, i) => {
                const idx = contacts.indexOf(c);
                const isActive = idx === activeId;
                return (
                  <button
                    key={c.name}
                    onClick={() => select(idx)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors duration-200"
                    style={{ backgroundColor: isActive ? 'var(--ma-bg-active)' : 'transparent' }}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-border shrink-0">
                      <img src={c.img} alt={c.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--ma-list-title)' }}>
                          {c.name}
                          {c.unread > 0 && (
                            <span className="ml-1.5 inline-flex w-4 h-4 rounded-full items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: 'var(--ma-accent)' }}>
                              {c.unread}
                            </span>
                          )}
                        </p>
                        <span className="text-[9px] shrink-0" style={{ color: 'var(--ma-muted-text)' }}>{c.time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[10px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{c.role}</p>
                        <span className="text-[9px] font-bold shrink-0" style={{ color: 'var(--ma-accent)' }}>{c.status}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-xs" style={{ color: 'var(--ma-muted-text)' }}>No leads match.</p>
              )}
            </div>
          </div>

          {/* chat window */}
          <div className="flex flex-col min-w-0">
            <div className="px-4 py-2.5 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--ma-line-slim)' }}>
              <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-border shrink-0">
                <img src={active.img} alt={active.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--ma-list-title)' }}>{active.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--ma-muted-text)' }}>{active.role}</p>
              </div>
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5 border"
                style={{ color: 'var(--ma-accent)', borderColor: 'var(--ma-bubble-ai-border)', backgroundColor: 'var(--ma-bubble-ai)' }}
              >
                <ShieldCheck size={10} /> Validated
              </span>
              <MoreVertical size={16} className="shrink-0" style={{ color: 'var(--ma-icon)' }} aria-hidden="true" />
            </div>

            <div
              ref={scrollRef}
className="flex-1 min-h-[300px] max-h-[300px] overflow-y-auto
                          landing-scrollbar px-4 py-4 flex flex-col gap-2"
              style={{ backgroundColor: 'var(--ma-bg-root)' }}
            >
              {(active.messages || []).map((m, i) => {
                if (m.ai) {
                  return (
                    <div key={i} className="flex items-start gap-1.5 max-w-[85%]">
                      <div className="rounded-xl rounded-tl-sm px-3 py-1.5 border" style={{ backgroundColor: 'var(--ma-bubble-ai)', borderColor: 'var(--ma-bubble-ai-border)' }}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Sparkles size={9} style={{ color: 'var(--ma-accent)' }} />
                          <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: 'var(--ma-accent)' }}>AI Agent</span>
                        </div>
                        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ma-list-title)' }}>{m.text}</p>
                      </div>
                    </div>
                  );
                }
                const mine = m.side === 'mine';
                const isLastMine = mine && i === (active.messages || []).length - 1;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28 }}
                    className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                  >
                    <p
                      className="rounded-xl rounded-tr-sm rounded-tl-sm px-3 py-1.5 text-[11px] leading-relaxed max-w-[85%] inline-flex items-end gap-1.5"
                      style={{
                        backgroundColor: mine ? 'var(--ma-bubble-sent)' : 'var(--ma-bubble-received)',
                        color: 'var(--ma-list-title)',
                      }}
                    >
                      <span>{m.text}</span>
                      {mine && (
                        <span className="inline-flex items-center gap-[1px] pb-px" style={{ color: isLastMine && typing ? 'var(--ma-muted-text)' : 'var(--ma-accent)' }} aria-hidden="true">
                          {isLastMine && typing ? <Check size={9} /> : <CheckCheck size={11} strokeWidth={2.4} />}
                        </span>
                      )}
                    </p>
                  </motion.div>
                );
              })}
              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-1.5"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-border shrink-0">
                    <img src={active.img} alt={active.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="rounded-xl rounded-tl-sm px-3.5 py-2 inline-flex items-center gap-1" style={{ backgroundColor: 'var(--ma-bubble-received)' }}>
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: 'var(--ma-muted-text)' }}
                        animate={reduce ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25] }}
                        transition={reduce ? { duration: 0.2 } : { duration: 1, repeat: Infinity, delay: d * 0.18, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* template quick actions */}
            <div className="px-4 pt-2 flex items-center gap-1.5 overflow-x-auto">
              {Object.keys(TEMPLATE_ACTIONS).map((key) => (
                <button
                  key={key}
                  onClick={() => sendTemplate(key)}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors duration-200"
                  style={{ borderColor: 'var(--ma-line)', color: 'var(--ma-filter-text)', backgroundColor: 'var(--ma-bg-elevated)' }}
                >
                  <FileText size={10} style={{ color: 'var(--ma-accent)' }} /> {key}
                </button>
              ))}
            </div>

            {/* input */}
            <div className="px-3 py-2.5 flex items-center gap-2">
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-105"
                style={{ backgroundColor: 'var(--ma-bg-elevated)', color: 'var(--ma-icon)' }}
                aria-label="Attach file"
              >
                <Paperclip size={15} />
              </button>
              <div
                className="flex-1 min-w-0 rounded-full px-3.5 py-2 text-[11px] flex items-center gap-2"
                style={{ backgroundColor: 'var(--ma-bg-elevated)', color: 'var(--ma-muted-text)' }}
              >
                Type a message… <span className="ml-auto hidden sm:flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--ma-bg-active)', color: 'var(--ma-filter-text)' }}>
                  <ChevronDown size={9} /> Template
                </span>
              </div>
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-105"
                style={{ backgroundColor: 'var(--ma-accent)' }}
                aria-label="Send message"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 mt-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold rounded-full border border-border bg-surface px-2.5 py-1 text-text-muted">
          <MessageCircle size={10} className="text-[#25D366]" /> WhatsApp Web-style preview
          <span className="text-primary">·</span>
          <Clock size={9} className="text-primary" /> Select a lead, then send a template
        </span>
      </div>
    </div>
  );
};