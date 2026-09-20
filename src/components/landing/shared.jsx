import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, ShieldCheck, Sparkles, Send, ArrowRight, ArrowDown } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../ui/cn';

/* ---------- shared motion variants ---------- */
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export function SectionHeading({ eyebrow, badge, title, subtitle, center = true, className }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={stagger}
      className={cn(center && 'text-center', 'mb-8 sm:mb-10', className)}
    >
      <motion.div variants={fadeUp} className={cn(center && 'mx-auto')}>
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
}

export const SelectChip = ({ active, onClick, children }) => (
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
export const FlowRail = ({ steps, accent = 'shield' }) => (
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

/* WhatsApp-style chat preview. */
export const ChatMock = ({ name, subtitle, messages, reveal = false, revealDelay = 700 }) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? messages.length : 1);

  useEffect(() => {
    if (!reveal || reduce) {
      setShown(messages.length);
      return;
    }
    setShown(1);
    const id = setInterval(() => {
      setShown((s) => {
        if (s >= messages.length) {
          clearInterval(id);
          return s;
        }
        return s + 1;
      });
    }, revealDelay);
    return () => clearInterval(id);
  }, [reveal, reduce, messages.length, revealDelay]);

  const visible = messages.slice(0, shown);

  return (
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

      <div className="h-56 px-3 py-3 flex flex-col justify-end gap-2 overflow-hidden" style={{ backgroundColor: 'var(--ma-bg-root)' }}>
        {visible.map((m, i) => {
          if (m.ai) {
            return (
              <div key={i} className="flex items-start gap-1.5 max-w-[90%]">
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
            <motion.div
              key={i}
              initial={reveal ? { opacity: 0, y: 10 } : false}
              animate={reveal ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.3 }}
              className={cn('flex', mine ? 'justify-end' : 'justify-start')}
            >
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
            </motion.div>
          );
        })}
        {reveal && shown < messages.length && (
          <div className="flex items-center gap-1" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '240ms' }} />
          </div>
        )}
      </div>

      <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--ma-bg-panel)' }}>
        <div className="flex-1 rounded-full px-3 py-1.5 text-[11px]" style={{ backgroundColor: 'var(--ma-bg-elevated)', color: 'var(--ma-muted-text)' }}>
          Type a message…
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--ma-accent)' }}>
          <Send size={12} className="text-white" />
        </div>
      </div>
    </div>
  );
};

/* Cycles 0..total-1 as an active index (paused under prefers-reduced-motion). */
export function useCyclingIndex(total, ms) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce || total < 2) return;
    const id = setInterval(() => setI((p) => (p + 1) % total), ms);
    return () => clearInterval(id);
  }, [reduce, total, ms]);
  return reduce ? -1 : i;
}

/* Fires `true` once the element scrolls into view (paused under prefers-reduced-motion). */
export function useInViewOnce(threshold = 0.25) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const [seen, setSeen] = useState(Boolean(reduce));
  useEffect(() => {
    const node = ref.current;
    if (reduce || !node || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reduce, threshold]);
  return [ref, seen];
}

/* Radar / globe-inspired visual. */
export const RadarVisual = ({ className }) => (
  <div className={cn('relative w-60 h-60 sm:w-72 sm:h-72 mx-auto', className)} aria-hidden="true">
    <div className="absolute inset-0 rounded-full border border-border/70" />
    <div className="absolute inset-6 rounded-full border border-border/50" />
    <div className="absolute inset-12 rounded-full border border-border/30" />
    <div className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,217,126,0.12),transparent_62%)]" />
    <div className="absolute inset-0 rounded-full overflow-hidden">
      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,rgba(0,217,126,0.00),rgba(0,217,126,0.18),rgba(0,217,126,0.00)_120deg)]" />
    </div>
    {[
      ['top-[18%] left-[22%]', 'bg-primary'],
      ['top-[38%] right-[14%]', 'bg-secondary'],
      ['bottom-[22%] left-[32%]', 'bg-[#25D366]'],
      ['bottom-[30%] right-[30%]', 'bg-primary/70'],
      ['top-[52%] left-[12%]', 'bg-secondary/70'],
    ].map(([pos, color], i) => (
      <div key={i} className={cn('absolute', pos)}>
        <span className="relative flex h-2.5 w-2.5">
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', color)} style={{ animationDelay: `${i * 300}ms` }} />
          <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', color)} />
        </span>
      </div>
    ))}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <span className="w-4 h-4 rounded-full bg-primary shadow-[0_0_12px_rgba(0,217,126,0.6)]" />
    </div>
  </div>
);

/* Infinite marquee. Duplicates children once for a seamless -50% loop.
   Pause-on-hover + reduced-motion handled by the existing CSS tracks. */
export const Marquee = ({ items, render, trackClass = 'brand-track', duration = '35s', className, edgeWidth = 'w-12 sm:w-20' }) => (
  <div className={cn('relative overflow-hidden', className)}>
    <div className={cn('absolute inset-y-0 left-0 z-10 pointer-events-none bg-gradient-to-r from-background to-transparent', edgeWidth)} aria-hidden="true" />
    <div className={cn('absolute inset-y-0 right-0 z-10 pointer-events-none bg-gradient-to-l from-background to-transparent', edgeWidth)} aria-hidden="true" />
    <div className={trackClass} style={{ animationDuration: duration }}>
      {[0, 1].map((half) => (
        <div key={half} className="flex shrink-0 items-stretch" aria-hidden={half === 1}>
          {items.map((item, i) => (
            <div key={`${half}-${i}`} className="shrink-0">
              {render(item, i)}
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);