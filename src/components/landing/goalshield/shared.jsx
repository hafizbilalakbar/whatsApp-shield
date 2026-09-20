import React from 'react';
import { motion, useTransform } from 'framer-motion';
import { cn } from '../../ui/cn';

/* ------------------------------------------------------------------
   Motion math helpers (must be called inside components)
   ------------------------------------------------------------------ */

export const clamp01 = (n) => Math.min(1, Math.max(0, n));
export const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);

const _norm = (v, a, b) => clamp01((v - a) / (b - a));

export const inRange = (mv, a, b) => (
  useTransform(mv, (v) => easeOut(_norm(v, a, b)))
);

export const fade = (mv, inA, inB, outA, outB) => (
  useTransform(mv, (v) => {
    if (v < inA || v > outB) return 0;
    if (v < inB) return easeOut(_norm(v, inA, inB));
    if (v > outA) return 1 - easeOut(_norm(v, outA, outB));
    return 1;
  })
);

/* ------------------------------------------------------------------
   UI atoms
   ------------------------------------------------------------------ */

const TONES = {
  success: 'border-primary/30 bg-success/10 text-primary',
  muted: 'border-line bg-p-chip-strong text-p-mut',
  primary: 'border-primary/25 bg-primary/10 text-primary',
  danger: 'border-red-500/25 bg-red-500/10 text-error',
  warn: 'border-amber-500/30 bg-amber-500/10 text-warning',
};

export function StatusBadge({ tone = 'muted', className, children, pill }) {
  return (
    <span className={cn(pill ? 'rounded-md' : 'rounded-full', 'inline-flex items-center gap-1 border px-1.5 py-[3px] text-[7.5px] font-semibold leading-none whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StepNumber({ n, className }) {
  return (
    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-[10px] font-extrabold text-primary lg:h-6 lg:w-6 lg:text-[11px]', className)}>
      {n}
    </span>
  );
}

export function SceneHeader({ n, icon: Icon, iconTone = 'text-primary', title, sub, pill, pillIcon: PIcon, className }) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2.5 border-b border-line/80 px-3 py-2 sm:px-4', className)}>
      <StepNumber n={n} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[11.5px] font-bold text-p-title">
          <Icon size={11} strokeWidth={2.2} className={cn('shrink-0', iconTone)} />
          <span className="truncate">{title}</span>
        </p>
        <p className="truncate text-[8.5px] font-medium text-p-mut">{sub}</p>
      </div>
      <StatusBadge tone="muted" className="hidden sm:inline-flex">
        <PIcon size={8} className="text-primary" />
        {pill}
      </StatusBadge>
    </div>
  );
}

export function Avatar({ img, initials, tint = 200, size = 36, online, className }) {
  const dims = { width: size, height: size };
  return (
    <div className={cn('relative shrink-0', className)} style={dims}>
      {img ? (
        <img src={img} alt={initials || 'avatar'} loading="lazy" className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full border border-p-line-strong text-p-title font-semibold"
          style={{ background: `linear-gradient(135deg, hsla(${tint}, 72%, 46%, 0.92), hsla(${(tint + 170) % 360}, 70%, 28%, 0.92))` }}
        >
          <span style={{ fontSize: Math.max(7, Math.round(size * 0.34)) }}>{initials}</span>
        </div>
      )}
      {online && <motion.span className="absolute right-0 bottom-0 min-h-[7px] min-w-[7px] rounded-full border-2 border-p-ring bg-[#22c55e]" style={{ width: size * 0.28, height: size * 0.28 }} />}
    </div>
  );
}

export function Pop({ mv, a, b, className, y = 10, scaleT = 0.92, children }) {
  const op = inRange(mv, a, b);
  const move = useTransform(mv, (v) => (1 - easeOut(_norm(v, a, b))) * y);
  const sc = useTransform(mv, (v) => (1 - easeOut(_norm(v, a, b))) * (1 - scaleT) + scaleT);
  return (
    <motion.div style={{ opacity: op, y: move, scale: sc }} className={className}>
      {children}
    </motion.div>
  );
}

export function CountUp({ mv, a, b, to, suffix = '', className }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    return mv.on('change', (val) => {
      setV(Math.round(easeOut(_norm(val, a, b)) * to));
    });
  }, [mv, a, b, to]);
  return <span className={className}>{v.toLocaleString('en-US')}{suffix}</span>;
}

export function Caret({ className }) {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
      className={cn('inline-block h-[9px] w-[5px] shrink-0 rounded-[1px] bg-primary', className)}
    />
  );
}

export function MiniBar({ pct, className }) {
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-p-chip-strong', className)}>
      <motion.div
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
      />
    </div>
  );
}

export function FooterStrip({ mv, left, right, className }) {
  const op = inRange(mv, 0.05, 0.11);
  return (
    <motion.div
      style={{ opacity: op }}
      className={cn('mt-2 flex shrink-0 items-center justify-between px-1 text-[8.5px] font-semibold', className)}
    >
      <span className="flex items-center gap-1 whitespace-nowrap text-p-mut">{left}</span>
      <span className="flex items-center gap-1 whitespace-nowrap text-primary/90">{right}</span>
    </motion.div>
  );
}