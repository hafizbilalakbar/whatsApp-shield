import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Check, BadgeCheck, ArrowRight, ShieldCheck, Building2, Cpu,
  ShoppingCart, Wrench, HeartPulse, GraduationCap, Car, Globe, Send, MessageCircle,
  Users, Target, Sparkles, RefreshCw, Radio, CheckCircle2,
  TrendingUp, Layers2, Clock,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../ui/cn';
import { SHIELD_HOME, AGENT_HOME } from '../../utils/paths';
import { useCyclingIndex } from './shared';

/* ============================================================
   Animation clock + easing helpers
   ============================================================ */

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
const phase = (t, a, b) => easeOut(clamp01((t - a) / (b - a)));

function useDemoClock(total) {
  const reduce = useReducedMotion();
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduce) { setT(0.72); return undefined; }
    let raf;
    let start = null;
    let prev = 0;
    const frame = (now) => {
      if (start === null) start = now;
      const el = now - start;
      if (el - prev >= 40) {
        prev = el;
        setT((el % total) / total);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduce, total]);

  return t;
}

function Counter({ value, className, duration = 900 }) {
  const [disp, setDisp] = useState(0);
  const pv = useRef(0);
  useEffect(() => {
    const from = pv.current;
    const to = value;
    pv.current = to;
    if (to === from) return undefined;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{disp}</span>;
}

/* ============================================================
   Markets, categories & leads (layout data)
   ============================================================ */

const CATEGORIES = [
  { id: 'real-estate', label: 'Real Estate', icon: Building2, hue: '#0D9488' },
  { id: 'cybersecurity', label: 'Cybersecurity', icon: ShieldCheck, hue: '#0891B2' },
  { id: 'it', label: 'IT & SaaS', icon: Cpu, hue: '#14B8A6' },
  { id: 'ecommerce', label: 'E-commerce', icon: ShoppingCart, hue: '#00B86E' },
  { id: 'construction', label: 'Construction', icon: Wrench, hue: '#059669' },
  { id: 'healthcare', label: 'Healthcare', icon: HeartPulse, hue: '#10B981' },
  { id: 'education', label: 'Education', icon: GraduationCap, hue: '#06B6D4' },
  { id: 'automotive', label: 'Automotive', icon: Car, hue: '#00A884' },
];

const MARKETS = [
  {
    id: 'uae', name: 'UAE', flag: '🇦🇪', lat: 24.3, lon: 54.4,
    zone: 'Dubai · Abu Dhabi · Sharjah',
    audiences: ['Real-estate sellers', 'E-commerce brands', 'Logistics & trade'],
    leads: [
      { name: 'Gulf Marina Estates', type: 'Real Estate', loc: 'Dubai Marina', industry: 'Real Estate', contact: true, valid: true },
      { name: 'SecureNet ME', type: 'Cybersecurity', loc: 'Business Bay', industry: 'Cybersecurity', contact: true, valid: true },
      { name: 'Novae Retail', type: 'E-commerce', loc: 'Jumeirah', industry: 'E-commerce', contact: false, valid: true },
      { name: 'Apex Builders', type: 'Construction', loc: 'Deira', industry: 'Construction', contact: true, valid: false },
    ],
  },
  {
    id: 'ksa', name: 'Saudi Arabia', flag: '🇸🇦', lat: 24.7, lon: 46.7,
    zone: 'Riyadh · Jeddah · Dammam',
    audiences: ['Property developers', 'Healthcare clinics', 'Retail chains'],
    leads: [
      { name: 'Riyadh Heights', type: 'Real Estate', loc: 'Olaya', industry: 'Real Estate', contact: true, valid: true },
      { name: 'DentCare KSA', type: 'Healthcare', loc: 'Jeddah', industry: 'Healthcare', contact: true, valid: true },
      { name: 'Bazar International', type: 'E-commerce', loc: 'Dammam', industry: 'E-commerce', contact: false, valid: true },
      { name: 'Saudia Logistics', type: 'Logistics', loc: 'Riyadh', industry: 'Logistics', contact: true, valid: false },
    ],
  },
  {
    id: 'uk', name: 'United Kingdom', flag: '🇬🇧', lat: 51.5, lon: -0.1,
    zone: 'London · Manchester · Birmingham',
    audiences: ['Fintech & SaaS', 'D2C e-commerce', 'Recruiting & HR'],
    leads: [
      { name: 'Britsh Cloud Ltd', type: 'IT & SaaS', loc: 'Shoreditch', industry: 'IT & SaaS', contact: true, valid: true },
      { name: 'LumenPay', type: 'Fintech', loc: 'Canary Wharf', industry: 'Finance', contact: true, valid: true },
      { name: 'DTC Supply Co', type: 'E-commerce', loc: 'Manchester', industry: 'E-commerce', contact: false, valid: true },
      { name: 'UK Compliance Hub', type: 'Services', loc: 'Birmingham', industry: 'Services', contact: true, valid: true },
    ],
  },
  {
    id: 'us', name: 'United States', flag: '🇺🇸', lat: 40.7, lon: -74.0,
    zone: 'New York · San Francisco · Miami',
    audiences: ['SaaS founders', 'Local service pros', 'Franchise owners'],
    leads: [
      { name: 'Vertex Systems', type: 'IT & SaaS', loc: 'NYC', industry: 'IT & SaaS', contact: true, valid: true },
      { name: 'Pacific Auto Group', type: 'Automotive', loc: 'San Francisco', industry: 'Automotive', contact: true, valid: true },
      { name: 'BlueDoor Realty', type: 'Real Estate', loc: 'Miami', industry: 'Real Estate', contact: false, valid: true },
      { name: 'NovaLearn', type: 'Education', loc: 'Austin', industry: 'Education', contact: true, valid: false },
    ],
  },
  {
    id: 'au', name: 'Australia', flag: '🇦🇺', lat: -33.9, lon: 151.2,
    zone: 'Sydney · Melbourne · Brisbane',
    audiences: ['Construction firms', 'Healthcare providers', 'Retail & local'],
    leads: [
      { name: 'Harbour View Const.', type: 'Construction', loc: 'Sydney', industry: 'Construction', contact: true, valid: true },
      { name: 'MediCare AU', type: 'Healthcare', loc: 'Melbourne', industry: 'Healthcare', contact: true, valid: true },
      { name: 'Coastal Homes', type: 'Real Estate', loc: 'Brisbane', industry: 'Real Estate', contact: true, valid: true },
      { name: 'OzCart', type: 'E-commerce', loc: 'Sydney', industry: 'E-commerce', contact: false, valid: true },
    ],
  },
  {
    id: 'eu', name: 'Europe', flag: '🇪🇺', lat: 48.7, lon: 9.1,
    zone: 'Germany · France · Netherlands · Spain',
    audiences: ['Manufacturing & Industry 4.0', 'Marketplace sellers', 'SaaS & deep tech'],
    leads: [
      { name: 'Muenchen Maschinen', type: 'Construction', loc: 'Munich', industry: 'Industrial', contact: true, valid: true },
      { name: 'Atelier Digital', type: 'Cybersecurity', loc: 'Berlin', industry: 'Cybersecurity', contact: true, valid: true },
      { name: 'Madrid Market Hub', type: 'E-commerce', loc: 'Madrid', industry: 'E-commerce', contact: false, valid: true },
      { name: 'Ams Edu Group', type: 'Education', loc: 'Amsterdam', industry: 'Education', contact: true, valid: true },
    ],
  },
];

const INDUSTRY_ICON = {
  'Real Estate': Building2,
  'Cybersecurity': ShieldCheck,
  'IT & SaaS': Cpu,
  'E-commerce': ShoppingCart,
  'Construction': Wrench,
  'Healthcare': HeartPulse,
  'Education': GraduationCap,
  'Automotive': Car,
  'Finance': TrendingUp,
  'Logistics': Layers2,
  'Industrial': Wrench,
  'Services': Users,
};

const ICON_TINT = {
  'Real Estate': '#0D9488', 'Cybersecurity': '#0891B2', 'IT & SaaS': '#14B8A6',
  'E-commerce': '#00B86E', 'Construction': '#059669', 'Healthcare': '#10B981',
  'Education': '#06B6D4', 'Automotive': '#00A884', 'Finance': '#0EA5E9',
  'Logistics': '#2DD4BF', 'Industrial': '#14B8A6', 'Services': '#10B981',
};

const FLOW_STEPS = ['Discover', 'Filter', 'Validate', 'Organize', 'Target'];

/* Contacts surfaced after qualification — dedicated faces from avatars-funnel */
const DISCOVERY_CONTACTS = [
  { img: '/avatars-funnel/u15.jpg', name: 'Noura Salim', role: 'Procurement Lead', loc: 'Dubai' },
  { img: '/avatars-funnel/u16.jpg', name: 'Yassine Belkadi', role: 'Operations Director', loc: 'Riyadh' },
  { img: '/avatars-funnel/u17.jpg', name: 'Amelia Grant', role: 'Head of Growth', loc: 'London' },
];

/* ============================================================
   Globe — orthographic dotted world projection
   ============================================================ */

const RAD = Math.PI / 180;

const LAND = [
  [-105, 50, 32, 26], [-128, 56, 13, 10], [-97, 38, 25, 14], [-72, 20, 24, 14],
  [-58, -8, 17, 30], [-70, -14, 7, 14],
  [17, 50, 24, 11], [10, 45, 9, 5],
  [20, 6, 27, 32], [8, 12, 10, 16], [37, 10, 8, 12],
  [75, 48, 55, 30], [55, 24, 12, 10], [112, 22, 55, 22], [152, 45, 26, 14], [105, 70, 38, 12],
  [135, -25, 12, 8],
  [-42, 72, 10, 8],
];

const insideLand = (lat, lon) => {
  for (const [cx, cy, rx, ry] of LAND) {
    const dx = (lon - cx) / rx;
    const dy = (lat - cy) / ry;
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
};

const WORLD = (() => {
  const out = [];
  for (let lat = -72; lat <= 84; lat += 4) {
    for (let lon = -178; lon <= 182; lon += 4) {
      if (insideLand(lat, lon)) out.push([lat, lon]);
    }
  }
  return out;
})();

function projectPoint(lat, lon, focusLat, focusLon, R) {
  const phi = lon * RAD;
  const theta = lat * RAD;
  const fx = focusLon * RAD;
  const fy = focusLat * RAD;
  const vx = Math.cos(theta) * Math.sin(phi);
  const vy = Math.sin(theta);
  const vz = Math.cos(theta) * Math.cos(phi);
  const cA = Math.cos(fx);
  const sA = Math.sin(fx);
  const rx = vx * cA - vz * sA;
  const rz = vx * sA + vz * cA;
  const cB = Math.cos(fy);
  const sB = Math.sin(fy);
  const tx = rx;
  const ty = vy * cB + rz * sB;
  const tz = -vy * sB + rz * cB;
  return { x: tx * R, y: -ty * R, z: tz };
}

const R = 148;

function WorldDots({ focusLat, focusLon }) {
  const dots = useMemo(() => {
    const res = [];
    for (const [la, lo] of WORLD) {
      const p = projectPoint(la, lo, focusLat, focusLon, R);
      if (p.z < 0.06) continue;
      res.push([p.x, p.y, Math.min(0.9, 0.18 + p.z * 0.8)]);
    }
    return res;
  }, [focusLat, focusLon]);
  return (
    <g>
      {dots.map(([x, y, o], i) => (
        <circle key={i} cx={x} cy={y} r={1.15} fill="var(--g-dot)" opacity={o * 0.7} />
      ))}
    </g>
  );
}

function Graticule() {
  const meridians = [];
  for (let k = -2; k <= 2; k += 1) {
    const a = k * 30 * RAD;
    meridians.push(Math.abs(Math.cos(a)) * R);
  }
  return (
    <g fill="none" stroke="var(--g-grid)" strokeWidth={0.7} opacity={0.7}>
      {meridians.map((rx, i) => <ellipse key={`m-${i}`} cx={0} cy={0} rx={rx} ry={R} />)}
      {[-60, -30, 30, 60].map((la) => (
        <circle key={`p-${la}`} r={Math.abs(Math.cos(la * RAD)) * R} />
      ))}
    </g>
  );
}

function BillboardMarkers({ focus }) {
  return (
    <>
      {MARKETS.filter((m) => m.id !== focus.id).map((m) => {
        const p = projectPoint(m.lat, m.lon, focus.lat, focus.lon, R);
        if (p.z < 0.12) return null;
        const xp = ((p.x + 165) / 330) * 100;
        const yp = ((p.y + 165) / 330) * 100;
        return (
          <span key={m.id} className="absolute z-10" style={{ left: `${xp}%`, top: `${yp}%`, transform: 'translate(-50%,-50%)' }} aria-hidden="true">
            <span className="relative flex w-3.5 h-3.5 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-primary/40 gdisco-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/80" />
            </span>
          </span>
        );
      })}
    </>
  );
}

function HubArcs({ focus }) {
  const arcs = useMemo(() => {
    const pts = MARKETS
      .filter((m) => m.id !== focus.id)
      .map((m) => projectPoint(m.lat, m.lon, focus.lat, focus.lon, R))
      .filter((p) => p.z > 0.12)
      .sort((a, b) => b.z - a.z)
      .slice(0, 3);
    return pts.map((p) => {
      const len = Math.hypot(p.x, p.y);
      const ox = p.x / len;
      const oy = p.y / len;
      const mx = p.x * 0.5 + ox * (14 + len * 0.06);
      const my = p.y * 0.5 + oy * (14 + len * 0.06);
      return { d: `M 0 0 Q ${mx} ${my} ${p.x} ${p.y}`, x: p.x, y: p.y };
    });
  }, [focus]);
  return (
    <g fill="none" stroke="var(--g-radar-line)" strokeWidth={1.1} opacity={0.55}>
      {arcs.map((a, i) => (
        <path key={i} d={a.d} strokeDasharray="4 9" className="gdisco-arc" />
      ))}
    </g>
  );
}

function GlobeBlock({ focus, uid }) {
  return (
    <div className="relative mx-auto w-full aspect-square max-w-[380px] sm:max-w-[420px] select-none">
      <motion.div
        key={focus.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0"
      >
        {/* rotating orbit ring */}
        <div className="absolute inset-0 rounded-full border border-dashed border-[var(--g-ring)] opacity-40 gdisco-orbit" aria-hidden="true" />
        {/* secondary orbit */}
        <div className="absolute inset-[7%] rounded-full border border-[var(--g-ring)] opacity-20" aria-hidden="true" />

        <svg viewBox="-165 -165 330 330" className="absolute inset-0 w-full h-full" aria-hidden="true">
          <defs>
            <radialGradient id={`g-ocean-${uid}`} cx="36%" cy="30%" r="74%">
              <stop offset="0%" style={{ stopColor: 'var(--g-ocean-hi)' }} />
              <stop offset="58%" style={{ stopColor: 'var(--g-ocean-mid)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--g-ocean-edge)' }} />
            </radialGradient>
            <clipPath id={`g-clip-${uid}`}>
              <circle r={R} />
            </clipPath>
          </defs>

          <circle r={R} fill={`url(#g-ocean-${uid})`} />
          <circle r={R} fill="none" stroke="var(--g-ring)" strokeOpacity={0.45} strokeWidth={1.2} />

          <g clipPath={`url(#g-clip-${uid})`}>
            <Graticule />
            <WorldDots focusLat={focus.lat} focusLon={focus.lon} />
          </g>

          <HubArcs focus={focus} />

          {/* focus core */}
          <circle cx={0} cy={0} r={3.2} fill="var(--primary)" />
          <circle cx={0} cy={0} r={5.5} fill="none" stroke="var(--primary)" strokeOpacity={0.7} strokeWidth={1} />
        </svg>

        {/* radar sweep */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none gdisco-sweep"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, transparent 6deg, var(--g-radar-line) 8deg, var(--g-radar) 42deg, transparent 95deg)',
            WebkitMaskImage: 'radial-gradient(circle, #000 48%, transparent 76%)',
            maskImage: 'radial-gradient(circle, #000 48%, transparent 76%)',
          }}
          aria-hidden="true"
        />

        {/* focus targeting ring at center */}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10" aria-hidden="true">
          <span className="relative flex w-16 h-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-primary/50" />
            <span className="absolute inset-0 rounded-full border border-primary/40 gdisco-pulse" />
            <span className="absolute inset-2 rounded-full bg-primary/10" />
            <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,217,126,0.8)]" />
          </span>
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-primary">
            Target · {focus.name}
          </span>
        </span>

        {/* other-market markers */}
        <BillboardMarkers focus={focus} />
      </motion.div>
    </div>
  );
}

/* ============================================================
   Shared UI bits
   ============================================================ */

const WindowBar = ({ title, note }) => (
  <div className="flex items-center gap-2.5 px-4 h-10 border-b border-border/70 shrink-0" style={{ backgroundColor: 'var(--ma-bg-panel)' }}>
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
    </div>
    <span className="ml-2 text-[11px] font-semibold truncate" style={{ color: 'var(--ma-list-title)' }}>{title}</span>
    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[9px] font-bold text-primary shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> {note}
    </span>
  </div>
);

function StepRail({ steps, active }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map((s, i) => {
        const done = active > i;
        const current = active === i;
        return (
          <React.Fragment key={s}>
            {i > 0 && <span className="text-[10px] text-text-muted/70 shrink-0" aria-hidden="true">→</span>}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide transition-colors duration-300',
                done && 'border-success/35 bg-success/10 text-success',
                current && 'border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(0,184,110,0.25)]',
                !done && !current && 'border-border/70 bg-surface text-text-muted'
              )}
            >
              {done ? <Check size={10} /> : <span className="text-[8px]">{i + 1}</span>}
              {s}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function LeadRow({ lead, show, qualified, delay }) {
  const Icon = INDUSTRY_ICON[lead.industry] || Building2;
  const tint = ICON_TINT[lead.industry] || '#00B86E';
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : 14, scale: show ? 1 : 0.97, x: qualified ? 10 : 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: show ? delay : 0 }}
      className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors duration-300', qualified ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-surface')}
    >
      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${tint}1f`, color: tint }}>
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-text-primary truncate leading-tight">{lead.name}</p>
        <p className="text-[9.5px] text-text-muted truncate"><MapPin size={9} className="inline -mt-px mr-0.5" />{lead.loc} · {lead.industry}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold', lead.contact ? 'border-success/30 bg-success/10 text-success' : 'border-border/70 bg-background text-text-muted')}
          title="Contact availability"
        >
          <span className={cn('w-1 h-1 rounded-full', lead.contact ? 'bg-success' : 'bg-text-muted/50')} />
          {lead.contact ? 'WhatsApp' : 'No number'}
        </span>
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.8 }}
          transition={{ delay: delay + 0.28 }}
          className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold', lead.valid ? 'border-success/35 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning')}
        >
          {lead.valid ? <><BadgeCheck size={9} /> Valid</> : <><RefreshCw size={9} /> Re-check</>}
        </motion.span>
      </div>
    </motion.div>
  );
}

/* ============================================================
   Section 6 · Find Your Next Business Opportunity
   ============================================================ */

function DiscoveryBody({ market, q, setQ, onPick }) {
  const reduce = useReducedMotion();
  const t = useDemoClock(9800);
  const catIdx = useCyclingIndex(CATEGORIES.length, 880);
  const category = CATEGORIES[Math.max(0, catIdx) % CATEGORIES.length];

  const stageIdx =
    t < 0.24 ? 0 : t < 0.44 ? 1 : t < 0.66 ? 2 : t < 0.84 ? 3 : 4;

  const leadShow = (i) => t >= 0.46 + i * 0.055;
  const qualified = t >= 0.86;

  const discovered = Math.round(84 * phase(t, 0.10, 0.38));
  const validCount = Math.round(discovered * 0.82 * phase(t, 0.46, 0.72));
  const qualifiedCount = Math.round(validCount * 0.9 * phase(t, 0.84, 0.99));
  const zonePct = Math.round(phase(t, 0.60, 0.84) * 100);

  const statusText = [
    `Scanning the globe for ${market.name}…`,
    `Filtering by ${category.label}…`,
    `Validating contacts for WhatsApp presence…`,
    'Organizing & deduplicating…',
    'Moving qualified leads to Message Agent…',
  ][stageIdx];

  const filtered = MARKETS.filter((m) => (m.flag + ' ' + m.name).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr]">
      {/* -------- globe panel -------- */}
      <div className="relative p-4 sm:p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1 flex items-center gap-2">
              <Radio size={10} className="text-primary" /> Current target market
            </p>
            <h3 className="text-base sm:text-lg font-display font-bold text-text-primary leading-tight">
              {market.flag} {market.name} <span className="text-text-muted font-medium text-sm">· {market.zone}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-2.5 py-1.5 text-xs text-text-muted min-w-[160px]">
            <Search size={12} className="text-primary shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search market…"
              aria-label="Search market"
              className="w-full bg-transparent outline-none text-[11px] placeholder:opacity-70 placeholder:text-text-muted/70"
              style={{ color: 'var(--ma-search-text)' }}
            />
          </div>
        </div>

        <GlobeBlock focus={market} uid={market.id} />

        {/* market chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-200',
                m.id === market.id
                  ? 'border-primary/50 bg-primary/10 text-primary shadow-[0_0_14px_rgba(0,184,110,0.35)]'
                  : 'border-border/70 bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary'
              )}
            >
              <span className="text-[13px] leading-none">{m.flag}</span>
              {m.name}
              {m.id === market.id && <Check size={11} className="text-primary" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <span className="text-[11px] text-text-muted">No market matches “{q}”.</span>
          )}
        </div>

        {/* category chips */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto landing-scrollbar pb-1 -mx-1 px-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted shrink-0">Categories</span>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = c.id === category.id && stageIdx === 1;
            return (
              <span
                key={c.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9.5px] font-semibold whitespace-nowrap transition-colors duration-200',
                  active ? 'border-primary/45 bg-primary/10 text-primary' : 'border-border/70 bg-surface text-text-muted'
                )}
              >
                <Icon size={10} style={{ color: active ? undefined : c.hue }} />
                {c.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* -------- workflow panel -------- */}
      <div className="border-t lg:border-l lg:border-t-0 border-border/70 p-4 sm:p-5 bg-background/40 flex flex-col gap-4">
        {/* status */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0">
                <Target size={12} />
              </span>
              <p className="text-xs font-bold text-text-primary uppercase tracking-widest">Workflow</p>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={stageIdx + market.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-[11px] text-text-secondary leading-relaxed"
            >
              {statusText}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* counters */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Discovered', value: discovered, tone: 'text-text-primary' },
            { label: 'Valid', value: validCount, tone: 'text-success' },
            { label: 'Qualified', value: qualifiedCount, tone: 'text-primary' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border/70 bg-surface px-2.5 py-2 text-center">
              <p className={cn('text-lg font-display font-bold tabular-nums leading-none', c.tone)}>
                <Counter value={c.value} />
              </p>
              <p className="mt-1 text-[8.5px] font-semibold uppercase tracking-widest text-text-muted">{c.label}</p>
            </div>
          ))}
        </div>

        {/* lead list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Leads · {market.name}</p>
            <span className="text-[9px] text-text-muted">validate to qualify</span>
          </div>
          {market.leads.map((lead, i) => (
            <LeadRow key={lead.name} lead={lead} show={leadShow(i)} qualified={qualified} delay={i * 0.02} />
          ))}
        </div>

        {/* qualified tray */}
        <motion.div
          animate={{ opacity: qualified ? 1 : 0.55, scale: qualified ? 1 : 0.985 }}
          className={cn('rounded-xl border p-3 transition-colors duration-300', qualified ? 'border-primary/35 bg-primary/5' : 'border-border/70 bg-surface')}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0">
                <BadgeCheck size={12} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-text-primary truncate">Qualified Leads</p>
                <p className="text-[9px] text-text-muted truncate">ready for Message Agent</p>
              </div>
            </div>
            <span className="text-lg font-display font-bold text-primary tabular-nums"><Counter value={qualifiedCount} /></span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-background overflow-hidden border border-border/60">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
              style={{ width: `${zonePct}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="mt-1.5 text-[9px] text-text-muted">Organized · validated · {zonePct}% moved to pipeline</p>
          <div>
            {(qualified || reduce) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="mt-2.5 space-y-1.5"
              >
                {DISCOVERY_CONTACTS.map((c, i) => (
                  <motion.div
                    key={c.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.06, duration: 0.35 }}
                    className="flex items-center gap-2 rounded-lg border border-primary/25 bg-surface px-2 py-1.5"
                  >
                    <span className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-primary/30 shrink-0">
                      <img src={c.img} alt={c.name} className="h-full w-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-bold text-text-primary">{c.name}</span>
                      <span className="block truncate text-[9px] text-text-muted">{c.role} · {c.loc}</span>
                    </span>
                    <Check size={11} className="text-primary shrink-0" />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-2 pt-1 mt-auto border-t border-border/60">
          <Button size="sm" asChild>
            <Link to={SHIELD_HOME}>Open WhatsApp Shield <ArrowRight size={13} /></Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={AGENT_HOME}><MessageCircle size={13} /> Open Message Agent</Link>
          </Button>
        </div>
      </div>
    </div>

    <div className="px-4 py-3 border-t border-border/70" style={{ backgroundColor: 'var(--ma-bg-panel)' }}>
      <StepRail steps={FLOW_STEPS} active={stageIdx} />
    </div>
    </>
  );
}

export const GlobalDiscovery = () => {
  const [marketIdx, setMarketIdx] = useState(0);
  const [q, setQ] = useState('');

  useEffect(() => {
    const id = setInterval(() => setMarketIdx((i) => (i + 1) % MARKETS.length), 9800);
    return () => clearInterval(id);
  }, []);

  const market = MARKETS[marketIdx % MARKETS.length];

  return (
    <div className="gdisco relative rounded-3xl border border-border/80 bg-surface shadow-2xl shadow-primary/5 overflow-hidden">
      <WindowBar title="Global Lead Discovery" note="Live scan" />
      <DiscoveryBody key={market.id} market={market} q={q} setQ={setQ} onPick={(id) => setMarketIdx(MARKETS.findIndex((m) => m.id === id))} />
    </div>
  );
};

/* ============================================================
   Section 7 · International — beyond your local market
   ============================================================ */

const PIPELINE_NODES = [
  { label: 'Qualified Leads', icon: BadgeCheck },
  { label: 'Message Agent', icon: MessageCircle },
  { label: 'Personalized Pitch', icon: Sparkles },
  { label: 'Conversation', icon: Send },
  { label: 'Follow-up', icon: Clock },
  { label: 'Potential Customer', icon: CheckCircle2 },
];

function InternationalBody({ market }) {
  const t = useDemoClock(6200);
  const n = PIPELINE_NODES.length;
  const step = Math.min(n - 1, Math.floor((t + 0.05) * n));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
      {/* globe */}
      <div className="relative p-4 sm:p-6">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
          <Globe size={10} className="text-primary" /> Switch markets around the globe
        </p>
        <GlobeBlock focus={market} uid={`int-${market.id}`} />
      </div>

      {/* right: audience + pipeline */}
      <div className="border-t lg:border-l lg:border-t-0 border-border/70 p-4 sm:p-5 bg-background/40 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{market.flag}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text-primary uppercase tracking-widest">Audience in {market.name}</p>
            <p className="text-[11px] text-text-muted truncate mt-0.5">{market.zone}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
            <Users size={10} className="text-primary" /> Audiences in {market.name}
          </p>
          <AnimatePresence mode="wait">
            <motion.div key={market.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-2">
              {market.audiences.map((a, i) => (
                <motion.div
                  key={a}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.08, duration: 0.35 }}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface px-3 py-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-[11px] font-semibold text-text-primary">{a}</span>
                </motion.div>
              ))}
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <MapPin size={11} className="text-primary shrink-0" />
                <span className="text-[11px] font-semibold text-primary">Number validated for outreach</span>
                <Check size={11} className="ml-auto text-primary shrink-0" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* pipeline funnel */}
        <div className="mt-auto">
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2 flex items-center gap-1.5">
            <MessageCircle size={10} className="text-primary" /> Qualified Leads → Customer
          </p>
          <div className="flex flex-wrap items-center gap-y-2 gap-x-1">
            {PIPELINE_NODES.map((node, i) => {
              const Icon = node.icon;
              const done = i < step;
              const current = i === step;
              return (
                <React.Fragment key={node.label}>
                  {i > 0 && <span className="text-[9px] text-text-muted/60 shrink-0" aria-hidden="true">→</span>}
                  <motion.div
                    animate={current ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: 1.1, repeat: Infinity }}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold transition-colors duration-300',
                      done && 'border-success/35 bg-success/10 text-success',
                      current && 'border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(0,184,110,0.3)]',
                      !done && !current && 'border-border/70 bg-surface text-text-muted'
                    )}
                  >
                    {done ? <Check size={9} /> : <Icon size={9} />}
                    {node.label}
                  </motion.div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" asChild>
            <Link to={AGENT_HOME}><Send size={13} /> Open Message Agent</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={SHIELD_HOME}>Open WhatsApp Shield</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const InternationalMarkets = () => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => setIdx((i) => (i + 1) % MARKETS.length), 4600);
    return () => clearInterval(id);
  }, [paused]);

  const market = MARKETS[idx % MARKETS.length];
  const pick = (i) => {
    setIdx(i);
    setPaused(true);
    window.setTimeout(() => setPaused(false), 6200);
  };

  return (
    <div>
      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
        <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">International</Badge>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2 leading-tight">Find Business Opportunities Beyond Your Local Market</h2>
        <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
          Switch between global markets, discover their audiences, and move qualified leads into outreach.
        </p>
      </div>

      <div className="gdisco relative rounded-3xl border border-border/80 bg-surface shadow-2xl shadow-primary/5 overflow-hidden">
        <WindowBar title="International Market Switcher" note="Live" />
        <InternationalBody key={market.id} market={market} />

        {/* market switcher */}
        <div className="flex flex-wrap justify-center gap-2 px-4 py-3 border-t border-border/70" style={{ backgroundColor: 'var(--ma-bg-panel)' }}>
          {MARKETS.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(i)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200',
                m.id === market.id
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/70 bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary'
              )}
            >
              <span className="text-[13px] leading-none">{m.flag}</span>
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-text-muted mt-4">
        Switch between markets to explore each audience, or import your own contact lists to run a real scan.
      </p>
    </div>
  );
};

export const LeadDiscoveryExplorer = GlobalDiscovery;