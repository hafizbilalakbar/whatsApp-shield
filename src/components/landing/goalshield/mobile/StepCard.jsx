import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../../../ui/cn';
import { useInView, useSequence, useSettled } from './motionHooks';

function StepTracker({ funnel, current, inView, reduce }) {
  const lit = useSequence(current + 1, { start: inView, stepMs: 220, reduce });

  return (
    <div className="mt-3 flex flex-wrap items-start justify-center gap-x-1 gap-y-1.5 sm:flex-nowrap">
      {funnel.map((s, i) => {
        const done = i < lit;
        const active = i === lit && lit <= current;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.label}>
            {i > 0 && <span className={cn('mt-[9px] hidden h-px w-3 bg-white/12 sm:inline-block sm:w-4 lg:w-6', i <= lit && 'bg-primary/50')} />}
            <div className="flex w-8 flex-col items-center gap-[3px] sm:w-auto">
              <motion.span
                animate={active && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={active && !reduce ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                className={cn(
                  'flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors duration-300',
                  done && 'border-primary bg-primary text-[#04140f]',
                  active && 'border-primary bg-primary/15 text-primary ring-2 ring-primary/25',
                  !done && !active && 'border-white/12 bg-white/[0.03] text-white/30',
                )}
              >
                {done ? <Check size={10} strokeWidth={3.2} /> : <Icon size={9} strokeWidth={2.4} />}
              </motion.span>
              <span className={cn('hidden whitespace-nowrap text-[8px] font-semibold leading-none sm:block sm:text-[8.5px]', done || active ? 'text-white/70' : 'text-white/30')}>
                {s.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FloatingBadge({ text, icon: Icon, show, reduce }) {
  return (
    <div className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2">
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 8 }}
        animate={show ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.6, y: 8 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        <div className="origin-center scale-[0.88] sm:scale-100">
          <motion.span
            animate={show && !reduce ? { scale: [1, 1.035, 1] } : { scale: 1 }}
            transition={show && !reduce ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 } : { duration: 0.2 }}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/30 bg-[#0b1310] px-3 py-1.5 text-[9.5px] font-bold text-primary shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:text-[10px]"
          >
            {Icon ? <Icon size={11} strokeWidth={2.6} /> : <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {text}
          </motion.span>
        </div>
      </motion.div>
    </div>
  );
}

export default function StepCard({ n, title, subtitle, funnel, current, badge, badgeIcon, Phone, Desktop, reduce }) {
  const [ref, inView] = useInView(0.3);
  const showBadge = useSettled(inView, 1900, reduce);
  const hiddenState = { opacity: 0, y: reduce ? 0 : 28 };

  return (
    <motion.article
      ref={ref}
      initial={reduce ? false : hiddenState}
      animate={reduce || inView ? { opacity: 1, y: 0 } : hiddenState}
      transition={{ duration: reduce ? 0 : 0.42, ease: 'easeOut' }}
      className="relative mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 pb-9 sm:p-5 sm:pb-10"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-[13px] font-extrabold text-primary">{n}</span>
        <div className="min-w-0">
          <h3 className="text-[17px] font-extrabold leading-snug tracking-tight text-white sm:text-[19px]">{title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-white/50 sm:text-[13.5px]">{subtitle}</p>
        </div>
      </div>

      <StepTracker funnel={funnel} current={current} inView={inView} reduce={reduce} />

      <div className="mt-4">
        {Desktop && (
          <div className="mb-4 hidden md:block">
            <Desktop inView={inView} reduce={reduce} />
          </div>
        )}
        <Phone inView={inView} reduce={reduce} />
      </div>

      <FloatingBadge text={badge} icon={badgeIcon} show={showBadge} reduce={reduce} />
    </motion.article>
  );
}
