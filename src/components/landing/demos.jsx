import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  CheckCheck,
  Check,
  Bot,
  Clock,
  Wifi,
  QrCode,
  Sparkles,
  Send,
  MessageCircle,
  Star,
  CalendarCheck,
  CircleCheck,
  CircleAlert,
  EllipsisVertical,
  Landmark,
  Building2,
  Stethoscope,
  GraduationCap,
  Cpu,
  ShoppingCart,
  Megaphone,
  Wrench,
  Store,
  Truck,
  Handshake,
  MapPin,
  Phone,
  Video,
  ArrowRight,
  Search,
  Smile,
  Paperclip,
  Mic,
  UserCheck,
  ClipboardList,
  Tags,
  CalendarClock,
  Zap,
  LayoutDashboard,
  Upload,
  ScanLine,
  Target,
  FolderCheck,
  ChartNoAxesCombined,
  Settings,
  Download,
  X,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Activity,
  BadgeCheck,
  Gauge,
  Timer,
  Reply,
  Signal,
  Users,
  ArrowLeft,
  Camera,
  MoreVertical,
  Heart,
  BellOff,
  Plus,
  Lock,
} from "lucide-react";
import { cn } from "../ui/cn";

/* ============================================================
   Design tokens — WhatsApp Dark Mode
   ============================================================ */
const WA = {
  bg: "#0B141A",
  surface: "#111B21",
  surfaceElevated: "#1F2C34",
  bubbleIn: "#202C33",
  bubbleOut: "#005C4B",
  bubbleOutText: "#E9EDEF",
  bubbleInText: "#E9EDEF",
  textPrimary: "#E9EDEF",
  textSecondary: "#8696A0",
  textMuted: "#667781",
  accent: "#25D366",
  accentDim: "#128C7E",
  border: "rgba(255,255,255,0.06)",
  borderStronger: "rgba(255,255,255,0.12)",
  online: "#25D366",
  onlineRing: "#111B21",
  systemPill: "#202C33",
  inputBg: "#202C33",
  inputBorder: "rgba(255,255,255,0.08)",
  shadow: "0 4px 24px rgba(0,0,0,0.45)",
  shadowSoft: "0 2px 12px rgba(0,0,0,0.3)",
  radius: "12px",
  radiusFull: "9999px",
  radiusBubble: "8px",
  radiusBubbleSmall: "6px",
  transition: "150ms ease-out",
};

/* ============================================================
   Motion / timing helpers
   ============================================================ */

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
const phase = (t, a, b) => easeOut(clamp01((t - a) / (b - a)));

/* Looping rAF clock (0..1), frozen at a representative frame for reduced motion. */
export function useDemoClock(total, freezeAt = 0.62) {
  const reduce = useReducedMotion();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduce) {
      setT(freezeAt);
      return undefined;
    }
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
  }, [reduce, total, freezeAt]);
  return t;
}

/* Discrete step sequence that runs ONCE per card — no infinite loop.
   Steps through sequence, holds final frame. Reduced motion = fully revealed. */
function useSharedDemoClock(total, ms = 1500, delay = 0, hold = 2600) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const rafRef = useRef(null);
  const startAtRef = useRef(null);
  useEffect(() => {
    if (reduce) return undefined;
    const cycle = Math.max(1, ms * total + hold);
    startAtRef.current = Date.now() + delay;
    const tick = (now) => {
      const el = now - startAtRef.current;
      if (el < 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const nextStep = Math.min(total - 1, Math.floor(el / Math.max(1, ms)));
      setStep(nextStep);
      if (nextStep < total - 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reduce, total, ms, delay, hold]);
  return reduce ? total - 1 : step;
}

/* Animated integer that eases from its previous value. */
const Counter = ({ value, className, duration = 700 }) => {
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
};

/* ============================================================
   Shared primitives
   ============================================================ */

const PHOTO_SIZES = {
  xs: "w-5 h-5",
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-11 h-11",
  xl: "w-14 h-14",
};

/* Licensed stock profile photos cached locally under public/avatars/ so the
   page never depends on remote URLs. Replace with authorized photos when
   verified customer images are available. */
const ProfilePhoto = ({
  img,
  initials,
  tint = "from-primary to-secondary",
  size = "md",
  online = false,
  ping = false,
  className,
}) => {
  const [err, setErr] = useState(false);
  const sz = PHOTO_SIZES[size] || PHOTO_SIZES.md;
  const txtSize =
    size === "xs"
      ? "text-[8px]"
      : size === "sm"
        ? "text-[10px]"
        : size === "md"
          ? "text-xs"
          : size === "lg"
            ? "text-sm"
            : "text-base";
  return (
    <span
      className={cn("relative shrink-0 inline-block align-middle", className)}
    >
      {img && !err ? (
        <img
          src={`/avatars/${img}.jpg`}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setErr(true)}
          className={cn(
            "rounded-full object-cover ring-1 ring-white/10 bg-[#1F2C34] shadow-sm",
            sz,
          )}
        />
      ) : (
        <span
          className={cn(
            "rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br",
            sz,
            txtSize,
            tint,
          )}
        >
          {initials}
        </span>
      )}
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#25D366] border-2"
          style={{ borderColor: WA.surface }}
        />
      )}
      {ping && (
        <span
          className="absolute inset-0 rounded-full border-2 border-[#25D366]/70 animate-ping"
          aria-hidden="true"
        />
      )}
    </span>
  );
};

const TypingDots = ({ className }) => (
  <span
    className={cn("flex items-center gap-0.5", className)}
    aria-hidden="true"
  >
    {[0, 120, 240].map((d) => (
      <span
        key={d}
        className="w-1.5 h-1.5 rounded-full bg-[#8696A0]/60 animate-bounce"
        style={{ animationDelay: `${d}ms` }}
      />
    ))}
  </span>
);

/* Micro chart bars — grow independently as the conversation progresses */
const MiniChart = ({
  heights,
  progress = 1,
  delay = 0,
  accent = WA.accent,
  barW = 3,
  gap = 2,
  max = 16,
  className,
}) => {
  const reduce = useReducedMotion();
  return (
    <span
      className={cn("flex items-end shrink-0", className)}
      style={{ height: max, gap }}
      aria-hidden="true"
    >
      {heights.map((h, i) => {
        const p = reduce ? 1 : clamp01(progress * 1.75 - i * 0.07);
        const px = Math.max(2, Math.round((h / 100) * max));
        return (
          <motion.span
            key={i}
            className="origin-bottom rounded-[1px]"
            style={{ width: barW, height: px, backgroundColor: accent }}
            animate={{ scaleY: Math.max(0.14, p), opacity: 0.3 + 0.7 * p }}
            transition={{ duration: 0.5, delay: delay + i * 0.05, ease: "easeOut" }}
          />
        );
      })}
    </span>
  );
};

const StarsRow = () => (
  <motion.div
    key="stars"
    initial={{ opacity: 0, scale: 0.85, y: 4 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="flex items-center justify-center gap-0.5 py-0.5"
  >
    {[...Array(5)].map((_, si) => (
      <motion.span
        key={si}
        initial={{ opacity: 0, scale: 0.4, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, delay: si * 0.08 }}
      >
        <Star size={11} className="text-warning fill-warning" />
      </motion.span>
    ))}
  </motion.div>
);

const CheckMark = ({ read }) =>
  read ? (
    <CheckCheck size={11} style={{ color: WA.accent }} className="shrink-0" />
  ) : (
    <Check size={11} style={{ color: WA.textMuted }} className="shrink-0" />
  );

/* Centered system/date pill inside the thread */
const ThreadPill = ({ children }) => (
  <div className="flex justify-center py-0.5">
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[7.5px] font-medium leading-none"
      style={{ backgroundColor: WA.systemPill, color: WA.textSecondary }}
    >
      {children}
    </span>
  </div>
);

/* Small "reacted" pill that appears once the customer rates the flow */
const ReactionPill = () => (
  <motion.div
    key="reaction"
    initial={{ opacity: 0, scale: 0.9, y: 4 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="flex justify-center pb-0.5"
  >
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[7.5px] font-medium"
      style={{ backgroundColor: WA.systemPill, color: WA.textSecondary }}
    >
      <Heart size={9} style={{ color: WA.accent }} className="fill-current" />
      reacted · thanks!
    </span>
  </motion.div>
);

/* ============================================================
   Category logo tiles (neutral — no brand/partnership implied)
   ============================================================ */

const CHAT_PATTERN = {
  backgroundImage:
    "radial-gradient(circle, var(--ma-line-slim) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

const DemoWindow = ({
  icon: Icon,
  title,
  subtitle,
  right,
  children,
  className,
}) => (
  <div
    className={cn(
      "rounded-2xl border border-border bg-surface shadow-xl overflow-hidden",
      className,
    )}
  >
    <div
      className="flex items-center gap-2 px-3.5 sm:px-4 h-11 border-b shrink-0"
      style={{
        backgroundColor: "var(--ma-bg-panel)",
        borderColor: "var(--ma-line-slim)",
      }}
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
      </div>
      <span className="ml-1.5 w-6 h-6 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
        <Icon size={13} className="text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-[12px] font-bold truncate leading-tight"
          style={{ color: "var(--ma-list-title)" }}
        >
          {title}
        </p>
        {subtitle && (
          <p
            className="text-[9px] truncate leading-tight"
            style={{ color: "var(--ma-muted-text)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
    {children}
  </div>
);

/* ============================================================
   Category logo tiles (neutral — no brand/partnership implied)
   ============================================================ */

export const CATEGORY_LOGOS = [
  {
    name: "E-Commerce",
    desc: "Online stores",
    icon: ShoppingCart,
    tint: "from-emerald-400 to-teal-600",
  },
  {
    name: "Marketing",
    desc: "Agencies & growth",
    icon: Megaphone,
    tint: "from-violet-400 to-purple-600",
  },
  {
    name: "Real Estate",
    desc: "Property & brokers",
    icon: Building2,
    tint: "from-sky-400 to-blue-600",
  },
  {
    name: "Healthcare",
    desc: "Clinics & care",
    icon: Stethoscope,
    tint: "from-rose-400 to-pink-600",
  },
  {
    name: "Education",
    desc: "Schools & training",
    icon: GraduationCap,
    tint: "from-amber-400 to-orange-600",
  },
  {
    name: "Finance",
    desc: "Banking & fintech",
    icon: Landmark,
    tint: "from-teal-400 to-cyan-600",
  },
  {
    name: "Technology",
    desc: "Software & IT",
    icon: Cpu,
    tint: "from-cyan-400 to-indigo-600",
  },
  {
    name: "Logistics",
    desc: "Freight & delivery",
    icon: Truck,
    tint: "from-orange-400 to-amber-600",
  },
  {
    name: "Services",
    desc: "Field & trade",
    icon: Wrench,
    tint: "from-slate-400 to-slate-600",
  },
  {
    name: "Local Business",
    desc: "Shops & venues",
    icon: Store,
    tint: "from-lime-400 to-green-600",
  },
  {
    name: "Sales Teams",
    desc: "Pipeline & outreach",
    icon: Handshake,
    tint: "from-green-400 to-emerald-600",
  },
];

export const CategoryLogoTile = ({ item }) => (
  <div className="mx-2.5 sm:mx-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-sm px-4 py-3 min-w-max shadow-sm transition-colors duration-300 hover:border-primary/30">
    <span
      className={cn(
        "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm shrink-0",
        item.tint,
      )}
    >
      <item.icon size={16} className="text-white" />
    </span>
    <span className="flex flex-col leading-tight">
      <span className="text-[13px] font-bold text-text-primary tracking-tight whitespace-nowrap">
        {item.name}
      </span>
      <span className="text-[10px] text-text-muted whitespace-nowrap">
        {item.desc}
      </span>
    </span>
  </div>
);

/* ============================================================
   WhatsApp Shield — desktop SaaS dashboard
   ============================================================ */

const SHIELD_STEPS = ["Scan", "Verify", "Quality", "Organize", "Ready"];
const SHIELD_STAGE_LABELS = [
  {
    label: "Scanning contacts",
    tone: "text-text-muted border-border/70 bg-background",
  },
  {
    label: "Verifying presence",
    tone: "text-primary border-primary/30 bg-primary/5",
  },
  {
    label: "Checking quality",
    tone: "text-primary border-primary/30 bg-primary/5",
  },
  { label: "Organizing", tone: "text-primary border-primary/30 bg-primary/5" },
  { label: "Ready", tone: "text-success border-success/30 bg-success/10" },
];

const SHIELD_NAV = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: Upload, label: "Import data" },
  { icon: ScanLine, label: "Validation", active: true, badge: "5" },
  { icon: Target, label: "Quality" },
  { icon: FolderCheck, label: "Organized", badge: "4" },
  { icon: MessageCircle, label: "Agent inbox" },
  { icon: ChartNoAxesCombined, label: "Reports" },
  { icon: Settings, label: "Settings" },
];

/* Sample personas for layout — swap in authorized data before going live. */
const SHIELD_LEADS = [
  {
    img: "aisha",
    initials: "AR",
    tint: "from-rose-400 to-pink-600",
    name: "Aisha Rahman",
    business: "Online store",
    location: "Dubai, AE",
    wa: true,
    score: 96,
  },
  {
    img: "daniel",
    initials: "DM",
    tint: "from-sky-400 to-blue-600",
    name: "Daniel Moreau",
    business: "Property agency",
    location: "Lyon, FR",
    wa: true,
    score: 88,
  },
  {
    img: "priya",
    initials: "PS",
    tint: "from-violet-400 to-purple-600",
    name: "Priya Sharma",
    business: "Marketing agency",
    location: "Mumbai, IN",
    wa: true,
    score: 74,
  },
  {
    img: "luis",
    initials: "LF",
    tint: "from-green-400 to-emerald-600",
    name: "Luis Ferreira",
    business: "Dealership",
    location: "Lisbon, PT",
    wa: true,
    score: 91,
  },
  {
    img: "hana",
    initials: "HY",
    tint: "from-orange-400 to-amber-600",
    name: "Hana Yoo",
    business: "Freight line",
    location: "Busan, KR",
    wa: false,
    score: 0,
  },
  {
    img: "marco",
    initials: "MB",
    tint: "from-cyan-400 to-teal-600",
    name: "Marco Bellini",
    business: "Local services",
    location: "Milan, IT",
    wa: true,
    score: 52,
  },
];

const shieldStage = (t) =>
  t < 0.09 ? 0 : t < 0.23 ? 1 : t < 0.35 ? 2 : t < 0.47 ? 3 : 4;

const QualityChip = ({ score, active }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8.5px] font-bold tabular-nums whitespace-nowrap",
      active && score >= 85
        ? "border-success/35 bg-success/10 text-success"
        : active && score >= 60
          ? "border-primary/35 bg-primary/10 text-primary"
          : active
            ? "border-warning/40 bg-warning/10 text-warning"
            : "border-border/70 bg-background text-text-muted",
    )}
  >
    <Zap size={9} /> {active ? `${score}%` : "Quality"}
  </span>
);

const ShieldLeadRow = ({ lead, t, stage, i }) => {
  const shown = t >= 0.04 + i * 0.03;
  const presenceKnown = t >= 0.24 + i * 0.04;
  const qualityKnown = t >= 0.4 + i * 0.035;
  const active = shown && stage >= 1;
  const ready = stage >= 4 && lead.wa && active;

  return (
    <motion.div
      animate={{ opacity: shown ? 1 : 0.35, y: shown ? 0 : 5 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_104px_minmax(0,1.1fr)] items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors duration-300",
        ready
          ? "border-primary/40 bg-primary/5"
          : shown
            ? "border-border/60 bg-surface"
            : "border-transparent bg-surface/30",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <ProfilePhoto
          img={lead.img}
          initials={lead.initials}
          tint={lead.tint}
          size="sm"
          online={active && lead.wa}
          ping={shown && stage === 0}
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-text-primary truncate">
            {lead.name}
          </p>
          <p className="text-[9px] text-text-muted truncate">{lead.business}</p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1 text-[9px] text-text-muted truncate">
        <MapPin size={9} className="shrink-0" />{" "}
        <span className="truncate">{lead.location}</span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
        {stage === 0 && shown && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-text-muted whitespace-nowrap">
            <span className="w-3 h-3 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
            Scanning
          </span>
        )}
        {stage >= 1 && presenceKnown && !lead.wa && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-1.5 py-0.5 text-[8.5px] font-bold text-text-muted whitespace-nowrap">
            <CircleAlert size={9} /> No WhatsApp
          </span>
        )}
        {stage >= 1 && presenceKnown && lead.wa && (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[8.5px] font-bold text-success whitespace-nowrap">
            <Wifi size={9} /> WhatsApp
          </span>
        )}
        {stage >= 2 && (
          <QualityChip score={lead.score} active={lead.wa && qualityKnown} />
        )}
        {stage >= 3 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[8.5px] font-bold whitespace-nowrap",
              lead.wa ? "text-primary" : "text-text-muted",
            )}
          >
            <Check size={9} /> {lead.wa ? "Organized" : "Excluded"}
          </span>
        )}
        {ready && (
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-bold text-primary whitespace-nowrap"
          >
            <MessageCircle size={9} /> Ready for Agent
          </motion.span>
        )}
      </div>
    </motion.div>
  );
};

const ShieldStat = ({ label, icon: Icon, value, pct }) => (
  <div className="rounded-xl border border-border/70 bg-surface px-2.5 py-2.5 min-w-0">
    <div className="flex items-center justify-between gap-1">
      <span className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted truncate">
        {label}
      </span>
      <Icon size={11} className="text-primary/70 shrink-0" />
    </div>
    <p className="mt-1 text-[17px] font-display font-bold text-text-primary tabular-nums leading-none">
      <Counter value={value} />
    </p>
    <div className="mt-1.5 h-1 rounded-full bg-background border border-border/50 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-200 ease-out"
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  </div>
);

export const ShieldScanDemo = ({ clock = null }) => {
  const t = clock ?? useDemoClock(11000, 0.66);
  const stage = shieldStage(t);
  const stageInfo = SHIELD_STAGE_LABELS[stage];

  const scanned = Math.round(1460 * phase(t, 0.02, 0.24));
  const present = Math.round(1108 * phase(t, 0.22, 0.4));
  const valid = Math.round(960 * phase(t, 0.4, 0.54));
  const ready = Math.round(960 * phase(t, 0.52, 0.64));

  const stats = [
    {
      label: "Scanned",
      icon: ScanLine,
      value: scanned,
      pct: phase(t, 0.02, 0.26),
    },
    {
      label: "WhatsApp",
      icon: Wifi,
      value: present,
      pct: phase(t, 0.22, 0.42),
    },
    {
      label: "Valid",
      icon: ShieldCheck,
      value: valid,
      pct: phase(t, 0.4, 0.55),
    },
    {
      label: "Ready",
      icon: MessageCircle,
      value: ready,
      pct: phase(t, 0.52, 0.66),
    },
  ];

  return (
    <DemoWindow
      icon={ShieldCheck}
      title="WhatsApp Shield"
      subtitle="Discover · Validate · Qualify · Organize"
      right={
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold shrink-0",
            stageInfo.tone,
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              stage >= 4 ? "bg-success" : "bg-primary animate-pulse",
            )}
          />
          {stageInfo.label}
        </span>
      }
    >
      <div className="flex h-[520px] overflow-hidden">
        {/* left navigation */}
        <nav
          className="hidden md:flex flex-col w-[150px] shrink-0 border-r p-2 gap-0.5"
          style={{
            backgroundColor: "var(--ma-bg-panel)",
            borderColor: "var(--ma-line-slim)",
          }}
        >
          <div
            className="flex items-center gap-1.5 px-1.5 pt-1 pb-2 mb-1 border-b"
            style={{ borderColor: "var(--ma-line-slim)" }}
          >
            <span className="w-5 h-5 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
              <ShieldCheck size={11} className="text-primary" />
            </span>
            <span
              className="text-[10px] font-bold truncate"
              style={{ color: "var(--ma-list-title)" }}
            >
              Workspace
            </span>
          </div>
          {SHIELD_NAV.map((n) => (
            <div
              key={n.label}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-colors duration-200",
                n.active
                  ? "bg-primary/10 text-primary border border-primary/25"
                  : "text-text-muted hover:bg-background/70 border border-transparent",
              )}
            >
              <n.icon size={12} className="shrink-0" />
              <span className="truncate">{n.label}</span>
              {n.badge && (
                <span className="ml-auto w-4 h-4 rounded-full bg-primary/15 text-primary text-[7.5px] font-bold flex items-center justify-center shrink-0">
                  {n.badge}
                </span>
              )}
            </div>
          ))}
          <div className="mt-auto px-1.5 pt-2">
            <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-1.5">
              <span className="flex items-center gap-1 text-[8.5px] font-semibold text-success">
                <QrCode size={9} /> Connected
              </span>
              <p className="text-[8px] text-text-muted mt-0.5 truncate">
                WhatsApp #4812-9C
              </p>
            </div>
          </div>
        </nav>

        {/* main workspace */}
        <main className="flex-1 min-w-0 flex flex-col p-3 sm:p-4 gap-2.5 overflow-hidden">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="text-[12px] font-bold leading-tight truncate"
                style={{ color: "var(--ma-list-title)" }}
              >
                Validation run #4821
              </p>
              <p className="text-[9px] text-text-muted truncate">
                CSV imported · 1,460 contacts · normalized
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {SHIELD_STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors duration-300 whitespace-nowrap",
                    i < stage && "border-success/35 bg-success/10 text-success",
                    i === stage &&
                      "border-primary/50 bg-primary/10 text-primary",
                    i > stage && "border-border/70 bg-surface text-text-muted",
                  )}
                >
                  {i < stage ? (
                    <Check size={8} />
                  ) : (
                    <span className="text-[7.5px]">{i + 1}</span>
                  )}
                  {s}
                </span>
              ))}
            </div>
            <span
              className={cn(
                "hidden lg:inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold",
                stage >= 4
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-border/70 bg-background text-text-muted",
              )}
            >
              <Download size={10} /> Export
            </span>
          </div>

          {/* statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stats.map((s) => (
              <ShieldStat key={s.label} {...s} />
            ))}
          </div>

          {/* lead table */}
          <div className="flex-1 min-h-[220px] rounded-xl border border-border/70 bg-background/40 flex flex-col overflow-hidden">
            <div
              className="px-2.5 py-1.5 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_104px_minmax(0,1.1fr)] items-center gap-2 border-b"
              style={{ borderColor: "var(--ma-line-slim)" }}
            >
              <span className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted">
                Lead
              </span>
              <span className="hidden sm:block text-[8.5px] font-bold uppercase tracking-widest text-text-muted">
                Location
              </span>
              <span className="text-right text-[8.5px] font-bold uppercase tracking-widest text-text-muted">
                Status
              </span>
            </div>
            <div className="relative flex-1 min-h-0 overflow-y-auto landing-scrollbar p-1.5 space-y-1.5">
              {stage < 4 && (
                <div
                  className="ma-scan pointer-events-none absolute inset-x-0 top-0 h-16 opacity-40"
                  aria-hidden="true"
                />
              )}
              {SHIELD_LEADS.map((lead, i) => (
                <ShieldLeadRow
                  key={lead.name}
                  lead={lead}
                  t={t}
                  stage={stage}
                  i={i}
                />
              ))}
            </div>
          </div>

          {/* hand-off */}
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors duration-300",
              stage >= 4
                ? "border-primary/35 bg-primary/5"
                : "border-border/60 bg-surface",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                <MessageCircle size={13} className="text-primary" />
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[10px] font-bold leading-tight truncate",
                    stage >= 4 ? "text-primary" : "text-text-muted",
                  )}
                >
                  {stage >= 4
                    ? "960 qualified leads ready"
                    : "Preparing qualified leads…"}
                </p>
                <p className="text-[8.5px] text-text-muted truncate">
                  Valid · organized · reachable on WhatsApp
                </p>
              </div>
            </div>
            <motion.span
              animate={stage >= 4 ? { x: [0, 4, 0] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="shrink-0"
            >
              <ArrowRight
                size={15}
                className={stage >= 4 ? "text-primary" : "text-text-muted"}
              />
            </motion.span>
          </div>

          <p className="text-[9px] text-text-muted flex items-center gap-1.5">
            <QrCode size={10} className="shrink-0" /> Connected via QR ·
            validation running
          </p>
        </main>
      </div>
    </DemoWindow>
  );
};

/* ============================================================
   Message Agent — WhatsApp-style 3-pane business inbox
   ============================================================ */

const AGENT_CONVOS = [
  {
    id: "aisha",
    name: "Aisha Rahman",
    img: "aisha",
    initials: "AR",
    tint: "from-rose-400 to-pink-600",
    business: "Boutique Retail",
    industry: "E-Commerce",
    location: "Madrid, ES",
    online: true,
    lastSeen: "online",
    unread: 2,
    lastTime: "09:05",
    statusSteps: [
      "Qualified lead",
      "Messaged",
      "AI qualified",
      "Replied",
      "Follow-up scheduled",
    ],
    qualification: "AI qualified · interest + ready to meet",
    interest: ["Interest", "Budget", "Timing"],
    suggestion: {
      title: "Suggested reply",
      text: "Offer a 15-minute walkthrough call this week.",
    },
    followUp: "Thu · 3:00 PM",
    activity: [
      { icon: ShieldCheck, text: "Validated via Shield", time: "09:01" },
      { icon: Sparkles, text: "AI qualification passed", time: "09:02" },
      { icon: CalendarCheck, text: "Follow-up scheduled", time: "Thu 3 PM" },
    ],
    msgs: [
      {
        k: "u",
        t: "09:01",
        text: "Hi Aisha! Thanks for connecting through WhatsApp Shield.",
      },
      {
        k: "u",
        t: "09:01",
        text: "Would you like a quick overview of Message Agent?",
      },
      {
        k: "c",
        t: "09:02",
        text: "Hi! Yes — we're looking for a simpler way to handle inbound leads.",
      },
      { k: "ai", t: "09:02", text: "Interest detected · budget signal noted." },
      {
        k: "u",
        t: "09:03",
        text: "Perfect, sending a short overview and pricing now. Is Thursday around 3 PM good for a 15-minute call?",
      },
      { k: "c", t: "09:05", text: "Yes, Thursday at 3 PM works for me." },
    ],
  },
  {
    id: "lena",
    name: "Lena Vogel",
    img: "lena",
    initials: "LV",
    tint: "from-violet-400 to-purple-600",
    business: "Clinic Network",
    industry: "Healthcare",
    location: "Hamburg, DE",
    online: true,
    lastSeen: "online",
    unread: 3,
    lastTime: "11:24",
    statusSteps: [
      "Qualified lead",
      "Consulting",
      "AI qualified",
      "Replied",
      "Follow-up scheduled",
    ],
    qualification: "AI qualified · appointment intent",
    interest: ["Consent", "Opt-in", "Timing"],
    suggestion: {
      title: "Suggested reply",
      text: "Send appointment message now.",
    },
    followUp: "Mon · 10:00 AM",
    activity: [
      { icon: ShieldCheck, text: "Validated via Shield", time: "11:20" },
      { icon: Sparkles, text: "Opt-in confirmed", time: "11:21" },
      { icon: CalendarCheck, text: "Appointment slot held", time: "Mon 10 AM" },
    ],
    msgs: [
      {
        k: "c",
        t: "11:20",
        text: "We need to reach patients who actually opted in.",
      },
      {
        k: "u",
        t: "11:21",
        text: "Shield already validated the list — everyone here is reachable.",
      },
      {
        k: "ai",
        t: "11:21",
        text: "Consent confirmed · appointment question detected.",
      },
      {
        k: "c",
        t: "11:23",
        text: "Perfect. When can you send the appointment message?",
      },
      {
        k: "u",
        t: "11:24",
        text: "Sending it now — you will see it in your Sent folder.",
      },
    ],
  },
  {
    id: "omar",
    name: "Omar Farouk",
    img: "omar",
    initials: "OF",
    tint: "from-teal-400 to-cyan-600",
    business: "Growth Team",
    industry: "Sales Teams",
    location: "Cairo, EG",
    online: false,
    lastSeen: "last seen 21:40",
    unread: 1,
    lastTime: "12:06",
    statusSteps: [
      "Qualified lead",
      "Consulting",
      "AI qualified",
      "Replied",
      "Follow-up scheduled",
    ],
    qualification: "AI qualified · warm pipeline lead",
    interest: ["Pipeline", "Owner", "Timing"],
    suggestion: {
      title: "Suggested reply",
      text: "Send a quick walkthrough of lead statuses.",
    },
    followUp: "Tomorrow · 9:30 AM",
    activity: [
      { icon: ShieldCheck, text: "Validated via Shield", time: "12:00" },
      { icon: Sparkles, text: "Pipeline intent detected", time: "12:02" },
      { icon: CalendarCheck, text: "Status review set", time: "9:30 AM" },
    ],
    msgs: [
      {
        k: "ai",
        t: "12:00",
        text: "Quality lead from Shield · wants a cleaner follow-up flow.",
      },
      {
        k: "c",
        t: "12:01",
        text: "We need every rep to keep warm leads moving without endless standups.",
      },
      {
        k: "u",
        t: "12:03",
        text: "Message Agent gives each lead a status and an owner — exactly that.",
      },
      {
        k: "c",
        t: "12:05",
        text: "Nice. Can you show how statuses update after a reply?",
      },
      {
        k: "u",
        t: "12:06",
        text: "Sure — statuses move automatically as conversations progress.",
      },
    ],
  },
];

const AGENT_EXTRA = [
  {
    img: "daniel",
    initials: "DM",
    name: "Daniel Moreau",
    business: "Property agency",
    lastTime: "10:12",
    unread: 0,
    muted: true,
    text: "You: Let me send you the listing batch.",
  },
  {
    img: "priya",
    initials: "PS",
    name: "Priya Sharma",
    business: "Marketing agency",
    lastTime: "Wed",
    unread: 1,
    text: "Reporting template looks great — thanks!",
  },
];

const threadReveals = (n, i) => ((i + 1) / (n + 1)) * 0.8;

const ThreadBubble = ({ m, groupTop, groupBottom, read, finalMine }) => {
  const mine = m.k === "u";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
      className={cn("flex", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[86%] sm:max-w-[82%] rounded-xl px-2.5 py-1.5 shadow-sm",
          mine ? "rounded-tr-sm" : "rounded-tl-sm",
          groupTop && "rounded-t-md",
          groupBottom && "rounded-b-md",
          m.k === "ai" && "border",
        )}
        style={{
          backgroundColor:
            m.k === "ai"
              ? "var(--ma-bubble-ai)"
              : mine
                ? "var(--ma-bubble-sent)"
                : "var(--ma-bubble-received)",
          borderColor: m.k === "ai" ? "var(--ma-bubble-ai-border)" : undefined,
          color: "var(--ma-list-title)",
        }}
      >
        {m.k === "ai" && (
          <div className="flex items-center gap-1 mb-0.5">
            <Bot size={10} style={{ color: "var(--ma-accent)" }} />
            <span
              className="text-[8.5px] font-bold uppercase tracking-wide"
              style={{ color: "var(--ma-accent)" }}
            >
              AI Agent
            </span>
          </div>
        )}
        <p className="text-[11px] leading-relaxed">{m.text}</p>
        {m.t && (
          <div
            className="flex items-center justify-end gap-1 mt-0.5"
            style={{ color: "var(--ma-muted-text)" }}
          >
            <span className="text-[8px]">{m.t}</span>
            {mine &&
              (read && finalMine ? (
                <CheckCheck size={10} style={{ color: "var(--ma-accent)" }} />
              ) : (
                <Check size={10} />
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const AgentThread = ({ convo, local }) => {
  const reduce = useReducedMotion();
  const scrollRef = useRef(null);
  const n = convo.msgs.length;
  const shown = convo.msgs.filter(
    (_, i) => local >= threadReveals(n, i),
  ).length;
  const read = shown >= n;
  const pending = shown < n ? convo.msgs[shown] : null;
  const typing = !!pending && pending.k !== "u";
  const aiSuggested =
    !read &&
    convo.msgs.some(
      (m, i) =>
        m.k === "ai" &&
        i < shown &&
        !(convo.msgs[i + 1] && convo.msgs[i + 1].k === "u" && i + 1 < shown),
    );
  const lastMineIdx = convo.msgs.reduce(
    (acc, m, i) => (m.k === "u" && i < shown ? i : acc),
    -1,
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, reduce]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-y-auto landing-scrollbar"
      style={{ ...CHAT_PATTERN, backgroundColor: "var(--ma-bg-root)" }}
    >
      <div className="min-h-full flex flex-col justify-end gap-1 px-3 py-3">
        <AnimatePresence initial={false}>
          {convo.msgs.slice(0, shown).map((m, i) => {
            const prev = i > 0 ? convo.msgs[i - 1] : null;
            const next = i + 1 < shown ? convo.msgs[i + 1] : null;
            const sameAsPrev = prev && prev.k === m.k;
            const sameAsNext = next && next.k === m.k;
            return (
              <ThreadBubble
                key={`${m.k}-${i}`}
                m={m}
                groupTop={sameAsPrev}
                groupBottom={sameAsNext}
                read={read}
                finalMine={i === lastMineIdx}
              />
            );
          })}
          {typing && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div
                className="rounded-xl rounded-tl-sm px-3 py-2 shadow-sm"
                style={{ backgroundColor: "var(--ma-bubble-received)" }}
              >
                <TypingDots />
              </div>
            </motion.div>
          )}
          {aiSuggested && (
            <motion.div
              key="suggest"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center"
            >
              <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 max-w-[92%]">
                <Sparkles size={10} className="text-primary shrink-0" />
                <span className="text-[9px] font-semibold text-text-primary truncate">
                  {convo.suggestion.title}: {convo.suggestion.text}
                </span>
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center ml-1 shrink-0"
                  style={{ backgroundColor: "var(--ma-accent)" }}
                >
                  <Send size={8} className="text-white" />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const AgentListRow = ({ convo, active, local, onSelect }) => {
  const n = convo.msgs.length;
  const shown = convo.msgs.filter(
    (_, i) => local >= threadReveals(n, i),
  ).length;
  const preview =
    shown > 0 ? convo.msgs[shown - 1] : convo.msgs[convo.msgs.length - 1];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-2 rounded-lg border text-left transition-colors duration-200",
        active
          ? "border-primary/30 bg-primary/5"
          : "border-transparent hover:bg-background/60",
      )}
    >
      <ProfilePhoto
        img={convo.img}
        initials={convo.initials}
        tint={convo.tint}
        size="sm"
        online={convo.online}
        ping={active}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] font-bold text-text-primary truncate">
            {convo.name}
          </p>
          <span className="text-[8px] text-text-muted shrink-0 tabular-nums">
            {convo.lastTime}
          </span>
        </div>
        <p className="text-[9px] text-text-secondary truncate leading-snug">
          {shown > 0
            ? `${preview.k === "u" ? "You: " : ""}${preview.text}`
            : "New from Shield…"}
        </p>
      </div>
      {active ? (
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
          style={{ backgroundColor: "var(--ma-accent)" }}
        >
          <Check size={10} className="text-white" />
        </span>
      ) : convo.unread > 0 ? (
        <span
          className="h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
          style={{ backgroundColor: "var(--ma-accent)" }}
        >
          {convo.unread}
        </span>
      ) : (
        <EllipsisVertical size={13} className="text-text-muted shrink-0" />
      )}
    </button>
  );
};

const AgentChatList = ({ locals, activeIndex }) => (
  <div className="flex-1 min-h-0 overflow-y-auto landing-scrollbar px-1.5 py-1.5 space-y-0.5">
    {AGENT_CONVOS.map((c, i) => (
      <AgentListRow
        key={c.id}
        convo={c}
        active={i === activeIndex}
        local={locals[i]}
      />
    ))}
    {AGENT_EXTRA.map((c) => (
      <button
        type="button"
        key={c.name}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-2 rounded-lg border text-left",
          c.muted ? "opacity-55" : "border-transparent hover:bg-background/60",
        )}
      >
        <ProfilePhoto img={c.img} initials={c.initials} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] font-semibold text-text-primary truncate">
              {c.name}
            </p>
            <span className="text-[8px] text-text-muted shrink-0 tabular-nums">
              {c.lastTime}
            </span>
          </div>
          <p className="text-[9px] text-text-secondary truncate leading-snug">
            {c.text}
          </p>
        </div>
        {c.unread > 0 && (
          <span
            className="h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
            style={{ backgroundColor: "var(--ma-accent)" }}
          >
            {c.unread}
          </span>
        )}
      </button>
    ))}
  </div>
);

const AgentInfoPanel = ({ convo, local, statusIdx, isDone }) => (
  <div className="flex-1 min-h-0 overflow-y-auto landing-scrollbar">
    <div
      className="px-3 py-2.5 border-b flex items-center gap-2.5"
      style={{ borderColor: "var(--ma-line-slim)" }}
    >
      <ProfilePhoto
        img={convo.img}
        initials={convo.initials}
        tint={convo.tint}
        size="lg"
        online={convo.online}
      />
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-text-primary truncate">
          {convo.name}
        </p>
        <p className="text-[9px] text-text-muted truncate">{convo.business}</p>
      </div>
    </div>
    <div
      className="px-3 py-2.5 border-b space-y-2.5"
      style={{ borderColor: "var(--ma-line-slim)" }}
    >
      <div>
        <p className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted mb-1">
          Lead status
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />{" "}
          {convo.statusSteps[statusIdx]}
        </span>
      </div>
      {[
        [UserCheck, "Qualification", convo.qualification],
        [Tags, "Industry", convo.industry],
        [MapPin, "Location", convo.location],
      ].map(([Icon, label, value]) => (
        <div key={label} className="flex items-start gap-1.5">
          <Icon size={11} className="mt-0.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted">
              {label}
            </p>
            <p className="text-[9.5px] text-text-primary leading-tight">
              {value}
            </p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={11} className="text-primary shrink-0" />
        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[8px] font-bold text-success">
          Source: Shield
        </span>
      </div>
    </div>
    <div
      className="px-3 py-2.5 border-b"
      style={{ borderColor: "var(--ma-line-slim)" }}
    >
      <p className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
        Interest signals
      </p>
      <div className="flex flex-wrap gap-1">
        {convo.interest.map((tag) => (
          <motion.span
            key={tag}
            animate={{
              opacity: local >= 0.2 ? 1 : 0.35,
              scale: local >= 0.2 ? 1 : 0.95,
            }}
            transition={{ duration: 0.3 }}
            className="rounded-full border border-primary/25 bg-primary/5 px-1.5 py-0.5 text-[8.5px] font-semibold text-primary"
          >
            {tag}
          </motion.span>
        ))}
      </div>
    </div>
    <div
      className="px-3 py-2.5 border-b"
      style={{ borderColor: "var(--ma-line-slim)" }}
    >
      <p className="text-[8.5px] font-bold uppercase tracking-widest flex items-center gap-1 text-text-muted mb-1.5">
        <CalendarClock size={10} /> Follow-up
      </p>
      <p className="text-[10px] text-text-primary font-semibold">
        {convo.followUp}
      </p>
    </div>
    <div className="px-3 py-2.5">
      <p className="text-[8.5px] font-bold uppercase tracking-widest flex items-center gap-1 text-text-muted mb-1.5">
        <ClipboardList size={10} /> Notes / activity
      </p>
      <div className="space-y-1.5">
        {convo.activity.map((row, i) => {
          const on = local >= 0.12 + i * 0.24;
          return (
            <motion.div
              key={row.text}
              animate={{ opacity: on ? 1 : 0.3, x: on ? 0 : -4 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-1.5"
            >
              <row.icon size={10} className="text-primary shrink-0" />
              <span className="text-[9px] text-text-secondary truncate min-w-0">
                {row.text}
              </span>
              <span
                className="ml-auto text-[8px] tabular-nums shrink-0"
                style={{ color: "var(--ma-muted-text)" }}
              >
                {row.time}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-2">
        <p className="text-[8.5px] font-bold uppercase tracking-widest text-text-muted mb-1">
          {isDone ? "Status updated" : "Next action"}
        </p>
        <p className="text-[9px] text-text-secondary leading-snug">
          {isDone
            ? "Lead marked as follow-up scheduled."
            : "Draft the first response to qualify faster."}
        </p>
      </div>
    </div>
  </div>
);

export const AgentChatDemo = ({ clock = null }) => {
  const t = clock ?? useDemoClock(17000, 0.72);
  const [drawer, setDrawer] = useState(null);
  const locals = [
    clamp01(phase(t, 0.34, 0.6)),
    clamp01(phase(t, 0.6, 0.84)),
    clamp01(phase(t, 0.82, 1.06)),
  ];
  const activeIndex = t < 0.6 ? 0 : t < 0.84 ? 1 : 2;
  const active = AGENT_CONVOS[activeIndex];
  const local = locals[activeIndex];
  const statusIdx = Math.min(
    active.statusSteps.length - 1,
    Math.floor(clamp01(local) * active.statusSteps.length),
  );
  const isDone = local >= 1;

  return (
    <DemoWindow
      icon={MessageCircle}
      title="Message Agent"
      subtitle="Conversation workspace"
      right={
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[9px] font-bold text-primary shrink-0">
          <Sparkles size={9} /> {active.statusSteps[statusIdx]}
        </span>
      }
    >
      <div className="relative flex h-[520px] overflow-hidden">
        {/* LEFT — chat sidebar */}
        <aside
          className="hidden sm:flex flex-col w-[170px] lg:w-[186px] shrink-0 border-r min-w-0"
          style={{
            backgroundColor: "var(--ma-bg-panel)",
            borderColor: "var(--ma-line-slim)",
          }}
        >
          <div className="px-2 pt-2 pb-1.5 flex items-center justify-between gap-1 shrink-0">
            <span
              className="flex items-center gap-1.5 text-[10px] font-bold truncate"
              style={{ color: "var(--ma-list-title)" }}
            >
              <MessageCircle size={12} className="text-primary shrink-0" />{" "}
              Inbox
            </span>
            <span className="rounded-full bg-primary/15 text-primary text-[8px] font-bold px-1.5 py-0.5 shrink-0">
              3
            </span>
          </div>
          <div className="px-2 pb-1.5 shrink-0">
            <div
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 border"
              style={{
                backgroundColor: "var(--ma-bg-elevated)",
                borderColor: "var(--ma-line-slim)",
              }}
            >
              <Search size={11} style={{ color: "var(--ma-muted-text)" }} />
              <span
                className="text-[9.5px] truncate"
                style={{ color: "var(--ma-muted-text)" }}
              >
                Search or start chat
              </span>
            </div>
          </div>
          <AgentChatList locals={locals} activeIndex={activeIndex} />
          <div
            className="px-2 py-2 border-t shrink-0"
            style={{ borderColor: "var(--ma-line-slim)" }}
          >
            <span className="flex items-center gap-1.5 text-[8.5px] font-semibold text-primary">
              <ShieldCheck size={10} /> Synced with Shield
            </span>
          </div>
        </aside>

        {/* CENTER — conversation */}
        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* mobile action bar */}
          <div
            className="flex sm:hidden items-center justify-between gap-2 px-2 py-1.5 border-b shrink-0"
            style={{
              backgroundColor: "var(--ma-bg-panel)",
              borderColor: "var(--ma-line-slim)",
            }}
          >
            <button
              type="button"
              onClick={() => setDrawer(drawer === "list" ? null : "list")}
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[9.5px] font-bold text-text-muted"
            >
              <Search size={10} /> Contacts
            </button>
            <span className="text-[10px] font-bold text-text-primary truncate">
              {active.name}
            </span>
            <button
              type="button"
              onClick={() => setDrawer(drawer === "info" ? null : "info")}
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[9.5px] font-bold text-text-muted"
            >
              Info
            </button>
          </div>

          {/* conversation header */}
          <div
            className="flex items-center gap-2.5 px-3 py-2 border-b shrink-0"
            style={{
              backgroundColor: "var(--ma-bg-panel)",
              borderColor: "var(--ma-line-slim)",
            }}
          >
            <ProfilePhoto
              img={active.img}
              initials={active.initials}
              tint={active.tint}
              size="md"
              online={active.online}
              ping={local < 0.25}
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[12px] font-bold truncate leading-tight"
                style={{ color: "var(--ma-list-title)" }}
              >
                {active.name}
              </p>
              <p className="text-[9.5px] truncate leading-tight text-success">
                {active.lastSeen}
              </p>
            </div>
            <span
              className="hidden sm:flex items-center gap-2.5 shrink-0"
              style={{ color: "var(--ma-muted-text)" }}
            >
              <Phone size={13} />
              <Video size={13} />
              <EllipsisVertical size={14} />
            </span>
          </div>

          <motion.div
            key={active.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <AgentThread convo={active} local={local} />

            {/* follow-up strip */}
            <div
              className="px-3 py-1.5 border-t flex items-center gap-2 shrink-0"
              style={{ borderColor: "var(--ma-line-slim)" }}
            >
              <AnimatePresence initial={false}>
                {isDone ? (
                  <motion.span
                    key="followup"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[9.5px] font-bold text-primary"
                  >
                    <CalendarCheck size={11} /> Follow-up scheduled ·{" "}
                    {active.followUp}
                  </motion.span>
                ) : (
                  <span
                    key="hint"
                    className="inline-flex items-center gap-1.5 text-[9.5px] text-text-muted"
                  >
                    <Clock size={11} /> Status updates as the conversation moves
                  </span>
                )}
              </AnimatePresence>
            </div>

            {/* composer */}
            <div
              className="px-3 py-2 flex items-center gap-2 border-t shrink-0"
              style={{
                backgroundColor: "var(--ma-bg-panel)",
                borderColor: "var(--ma-line-slim)",
              }}
            >
              <span
                className="shrink-0"
                style={{ color: "var(--ma-muted-text)" }}
              >
                <Paperclip size={14} />
              </span>
              <div
                className="flex-1 flex items-center justify-between rounded-full px-3 py-1.5 min-w-0"
                style={{ backgroundColor: "var(--ma-bg-elevated)" }}
              >
                <span
                  className="text-[10.5px] truncate"
                  style={{ color: "var(--ma-muted-text)" }}
                >
                  {isDone ? "Type a message…" : "Reading conversation…"}
                </span>
                <Smile
                  size={13}
                  className="shrink-0"
                  style={{ color: "var(--ma-muted-text)" }}
                />
              </div>
              <span
                className="shrink-0"
                style={{ color: "var(--ma-muted-text)" }}
              >
                <Mic size={14} />
              </span>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--ma-accent)" }}
              >
                <Send size={12} className="text-white" />
              </span>
            </div>
          </motion.div>
        </section>

        {/* RIGHT — lead info */}
        <aside
          className="hidden lg:flex flex-col w-[196px] shrink-0 border-l min-w-0"
          style={{
            backgroundColor: "var(--ma-bg-panel)",
            borderColor: "var(--ma-line-slim)",
          }}
        >
          <AgentInfoPanel
            key={active.id}
            convo={active}
            local={local}
            statusIdx={statusIdx}
            isDone={isDone}
          />
        </aside>

        {/* mobile drawers */}
        <AnimatePresence initial={false}>
          {drawer && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-20 bg-black/45 sm:hidden"
                onClick={() => setDrawer(null)}
              />
              <motion.aside
                key={`panel-${drawer}`}
                initial={{ x: drawer === "list" ? "-100%" : "100%" }}
                animate={{ x: 0 }}
                exit={{ x: drawer === "list" ? "-100%" : "100%" }}
                transition={{ type: "tween", duration: 0.24 }}
                className={cn(
                  "absolute top-0 bottom-0 z-30 w-[80%] max-w-[300px] sm:hidden flex flex-col",
                  drawer === "list" ? "left-0 border-r" : "right-0 border-l",
                )}
                style={{ backgroundColor: "var(--ma-bg-panel)" }}
              >
                <div
                  className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
                  style={{ borderColor: "var(--ma-line-slim)" }}
                >
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: "var(--ma-list-title)" }}
                  >
                    {drawer === "list" ? "Conversations" : "Lead info"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawer(null)}
                    className="rounded-full border border-border/60 p-1"
                    aria-label="Close panel"
                  >
                    <X size={12} className="text-text-muted" />
                  </button>
                </div>
                {drawer === "list" ? (
                  <AgentChatList locals={locals} activeIndex={activeIndex} />
                ) : (
                  <AgentInfoPanel
                    convo={active}
                    local={local}
                    statusIdx={statusIdx}
                    isDone={isDone}
                  />
                )}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </DemoWindow>
  );
};

/* ============================================================
   WhatsApp-style product stories
   ------------------------------------------------------------
   Conversations are SIMULATED demos (demo: true, evidence: null).
   Replace any record with a real transcript + consent when
   verified testimonials are available: set demo: false and fill
   evidence with the approved strings. Flow tokens: 'c' customer
   message · 'u' our reply · 'typing' indicator · 'stars' rating.
   Read receipts are derived from message order automatically.
   Each card runs its own independent, self-timed reveal loop.
   ============================================================ */

export const TESTIMONIAL_CHATS = [
  {
    id: "ecommerce-leads",
    category: "E-Commerce",
    name: "Aisha Rahman",
    role: "Online store owner",
    img: "aisha",
    initials: "AR",
    tint: "from-rose-400 to-pink-600",
    outcome: "bigger weeks on a cleaner list",
    verified: false,
    demo: true,
    evidence: null,
    pace: 840,
    flow: [
      { k: "c", t: "11:03", text: "Hey, our WhatsApp is basically the storefront now and half the messages never turn into orders." },
      { k: "typing" },
      { k: "u", t: "11:05", text: "That's exactly the problem Shield solves. Run your contact list through it and only real buyers stay on the line." },
      { k: "c", t: "11:06", text: "We validated 900 numbers yesterday. Only 61 were dead which genuinely surprised me." },
      { k: "typing" },
      { k: "u", t: "11:08", text: "Nice that's a healthy list. You can launch a campaign today and hear back from people who can actually respond." },
      { k: "c", t: "11:09", text: "Did that this morning. Replies rolled in before lunch and two orders were confirmed by evening. Best week we've had in months." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "clinic-bookings",
    category: "Healthcare",
    name: "Lena Vogel",
    role: "Practice manager",
    img: "lena",
    initials: "LV",
    tint: "from-fuchsia-400 to-purple-600",
    outcome: "fuller calendars without extra staff",
    verified: false,
    demo: true,
    evidence: null,
    pace: 900,
    flow: [
      { k: "c", t: "09:30", text: "Morning bookings used to eat up my whole day with the same questions over and over." },
      { k: "typing" },
      { k: "u", t: "09:32", text: "That's the routine Message Agent takes over. Patients book right in chat and you just confirm." },
      { k: "c", t: "09:35", text: "Our front desk confirmed seven new patient bookings yesterday, all through the chat." },
      { k: "typing" },
      { k: "u", t: "09:37", text: "Seven new patients is a strong week. Anything you want it to handle next?" },
      { k: "c", t: "09:38", text: "Reminders maybe. The no show rate would drop fast with a gentle nudge the night before." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "agency-replyrate",
    category: "Marketing Agency",
    name: "Priya Sharma",
    role: "Agency founder",
    img: "priya",
    initials: "PS",
    tint: "from-violet-400 to-purple-600",
    outcome: "reply rate up from 18 to 41 percent",
    verified: false,
    demo: true,
    evidence: null,
    pace: 870,
    flow: [
      { k: "c", t: "11:20", text: "We pitch our services over WhatsApp and half the numbers on file were stored wrong." },
      { k: "typing" },
      { k: "u", t: "11:22", text: "Clean it once with Shield and the list stays healthy. Good numbers make good sends." },
      { k: "c", t: "11:24", text: "Ran it last week and our reply rate jumped from 18 percent to 41." },
      { k: "typing" },
      { k: "u", t: "11:26", text: "That's a huge move. You didn't change the offer at all right?" },
      { k: "c", t: "11:27", text: "Same offer actually. We just stopped burning sends on people who can never receive them." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "clients-auto-replies",
    category: "Consulting",
    name: "Sofia Reyes",
    role: "Strategy consultant",
    img: "sofia",
    initials: "SR",
    tint: "from-teal-400 to-emerald-600",
    outcome: "demo bookings doubled in two weeks",
    verified: false,
    demo: true,
    evidence: null,
    pace: 920,
    flow: [
      { k: "c", t: "14:01", text: "I was scared automation would sound robotic to our clients." },
      { k: "typing" },
      { k: "u", t: "14:03", text: "Message Agent keeps your tone. It drafts the reply, you approve it, then it sends." },
      { k: "c", t: "14:05", text: "That approval step won my trust. Every incoming lead gets a reply within minutes now." },
      { k: "typing" },
      { k: "u", t: "14:07", text: "Fast replies on WhatsApp are a superpower. Speed is what makes people believe you exist." },
      { k: "c", t: "14:08", text: "Our demo bookings doubled in two weeks. I actually had to make the calendar bigger." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "realestate-recovery",
    category: "Real Estate",
    name: "Hana Yamamoto",
    role: "Property agency",
    img: "hana",
    initials: "HY",
    tint: "from-sky-400 to-indigo-600",
    outcome: "two deals from leads we had given up on",
    verified: false,
    demo: true,
    evidence: null,
    pace: 890,
    flow: [
      { k: "c", t: "13:02", text: "We had a spreadsheet of property leads that nobody wanted to call anymore." },
      { k: "typing" },
      { k: "u", t: "13:04", text: "Shield turns that spreadsheet useful. It keeps the reachable buyers and flags the rest." },
      { k: "c", t: "13:06", text: "Filtered it in ten minutes. The calls that followed actually started picking up." },
      { k: "typing" },
      { k: "u", t: "13:08", text: "That's the shift we hear the most. Fewer dead numbers, more real conversations." },
      { k: "c", t: "13:09", text: "We closed two listings last month from leads we had already written off." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "spam-cleanup",
    category: "Coaching",
    name: "Marco Silva",
    role: "Business coach",
    img: "marco",
    initials: "MS",
    tint: "from-emerald-400 to-teal-600",
    outcome: "cleaner inbox and two old clients back",
    verified: false,
    demo: true,
    evidence: null,
    pace: 860,
    flow: [
      { k: "c", t: "08:12", text: "My WhatsApp is a mix of clients, prospects, and pure spam." },
      { k: "typing" },
      { k: "u", t: "08:14", text: "Run it through Shield and only the people worth your time stay in view." },
      { k: "c", t: "08:16", text: "The spam disappeared and I found two old clients I had lost track of." },
      { k: "typing" },
      { k: "u", t: "08:18", text: "Recoveries are the best part honestly. Reconnecting beats finding new every time." },
      { k: "c", t: "08:20", text: "Both signed up for a fresh coaching block. That's growth I didn't pay a cent for." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "qualified-buyers",
    category: "Real Estate",
    name: "Daniel Moreau",
    role: "Team lead",
    img: "daniel",
    initials: "DM",
    tint: "from-blue-400 to-indigo-600",
    outcome: "fourteen qualified buyers in one week",
    verified: false,
    demo: true,
    evidence: null,
    pace: 910,
    flow: [
      { k: "c", t: "16:20", text: "Following up with every interested buyer was flattening our whole team." },
      { k: "typing" },
      { k: "u", t: "16:22", text: "Message Agent runs the first round of follow up and loops you in only for the hot ones." },
      { k: "c", t: "16:24", text: "It ran for a week and qualified fourteen buyers. Four came to viewings on Saturday." },
      { k: "typing" },
      { k: "u", t: "16:26", text: "Four weekend viewings is real momentum. What did it ask that people actually answered?" },
      { k: "c", t: "16:28", text: "Budget and timeline mostly. It kept the conversation natural so nobody felt interviewed." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "b2b-clean-base",
    category: "B2B Services",
    name: "Omar Haddad",
    role: "Sales director",
    img: "omar",
    initials: "OH",
    tint: "from-amber-400 to-orange-600",
    outcome: "three demos booked from old leads",
    verified: false,
    demo: true,
    evidence: null,
    pace: 880,
    flow: [
      { k: "c", t: "12:00", text: "Our salespeople were calling numbers that had been dead for years." },
      { k: "typing" },
      { k: "u", t: "12:02", text: "That's money down the drain. Let Shield recheck the whole base for accuracy." },
      { k: "c", t: "12:04", text: "It came back 88 percent reachable. We stopped wasting half the day on dead ends." },
      { k: "typing" },
      { k: "u", t: "12:06", text: "Strong number for a business list. Reachable contacts mean more meetings booked." },
      { k: "c", t: "12:07", text: "Three demos booked this week from leads we had written off." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "afterhours-courses",
    category: "Education",
    name: "Farah Noor",
    role: "Course founder",
    img: "farah",
    initials: "FN",
    tint: "from-pink-400 to-rose-600",
    outcome: "three students enrolled through chat",
    verified: false,
    demo: true,
    evidence: null,
    pace: 930,
    flow: [
      { k: "c", t: "23:40", text: "Students message us late at night about prices and deadlines." },
      { k: "typing" },
      { k: "u", t: "23:42", text: "Message Agent answers after hours so nobody waits till morning. You keep the real conversations." },
      { k: "c", t: "23:45", text: "It answered the price question thirty times last night and stayed polite every single time." },
      { k: "typing" },
      { k: "u", t: "23:47", text: "That steadiness is what builds trust. Nobody wants to feel like a ticket number." },
      { k: "c", t: "23:49", text: "Three students enrolled this morning and said the chat sold them. Not the ad." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "expansion-launch",
    category: "Retail",
    name: "Luis Ferreira",
    role: "Franchise founder",
    img: "luis",
    initials: "LF",
    tint: "from-orange-400 to-red-600",
    outcome: "second shop launched without the chaos",
    verified: false,
    demo: true,
    evidence: null,
    pace: 850,
    flow: [
      { k: "c", t: "10:58", text: "We're opening a second shop and need working WhatsApp contacts from day one." },
      { k: "typing" },
      { k: "u", t: "11:00", text: "Shield preps the local list and Message Agent greets every new contact before you wake up." },
      { k: "c", t: "11:02", text: "First week both stores ran on a clean contact base and automatic welcome replies." },
      { k: "typing" },
      { k: "u", t: "11:04", text: "That's a smooth launch. What's the opening number you're proudest of?" },
      { k: "c", t: "11:05", text: "Every customer got an answer in under a minute and I wasn't even there for it." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "support-to-sales",
    category: "E-Commerce",
    name: "Adeyemi Okafor",
    role: "Operations lead",
    img: "adeyemi",
    initials: "AO",
    tint: "from-green-400 to-emerald-600",
    outcome: "repeat orders jumped within the month",
    verified: false,
    demo: true,
    evidence: null,
    pace: 905,
    flow: [
      { k: "c", t: "21:05", text: "Support messages were drowning out the actual sales chats." },
      { k: "typing" },
      { k: "u", t: "21:07", text: "Move the repeat questions to Message Agent and keep the sales conversation front and center." },
      { k: "c", t: "21:09", text: "Did exactly that. Support got quieter and the order follow ups stopped slipping." },
      { k: "typing" },
      { k: "u", t: "21:11", text: "Quieter support and no missed follow ups usually shows up as revenue." },
      { k: "c", t: "21:12", text: "It did. Repeat orders jumped within the month. Best change we made this year." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
  {
    id: "distribution-base",
    category: "Distribution",
    name: "Tomas Novak",
    role: "Wholesale manager",
    img: "tomas",
    initials: "TN",
    tint: "from-slate-400 to-blue-600",
    outcome: "reached more coverage per call",
    verified: false,
    demo: true,
    evidence: null,
    pace: 895,
    flow: [
      { k: "c", t: "15:15", text: "Our route reps were wasting hours on contacts that never picked up." },
      { k: "typing" },
      { k: "u", t: "15:17", text: "Shield keeps the working numbers and quietly drops the rest. Your reps only call people who answer." },
      { k: "c", t: "15:19", text: "After one cleanup everyone covered more ground in the same day." },
      { k: "typing" },
      { k: "u", t: "15:21", text: "That's the goal. Same hours, more stores reached, better numbers at the end of the month." },
      { k: "c", t: "15:22", text: "We hit our coverage target for the first time this quarter and it wasn't even our best week." },
      { k: "typing" },
      { k: "stars" },
    ],
  },
];
/* ============================================================
   WhatsApp-style rotating testimonial pool
   ============================================================ */

const TESTIMONIAL_PERSONAS = [
  ...TESTIMONIAL_CHATS.map(
    ({ id, name, role, category, img, initials, tint }) => ({
      id,
      name,
      role,
      category,
      img,
      initials,
      tint,
    }),
  ),
  {
    id: "lena",
    name: "Lena Vogel",
    role: "Practice manager",
    category: "Healthcare",
    img: "lena",
    initials: "LV",
    tint: "from-fuchsia-400 to-purple-600",
  },
  {
    id: "aisha2",
    name: "Aisha Patel",
    role: "Growth lead",
    category: "SaaS",
    img: "aisha",
    initials: "AP",
    tint: "from-rose-400 to-pink-600",
  },
  {
    id: "aisha3",
    name: "Aisha Kim",
    role: "Brand manager",
    category: "Marketing",
    img: "aisha",
    initials: "AK",
    tint: "from-rose-400 to-pink-600",
  },
  {
    id: "daniel2",
    name: "Daniel Okafor",
    role: "Sales director",
    category: "Sales",
    img: "daniel",
    initials: "DO",
    tint: "from-sky-400 to-blue-600",
  },
  {
    id: "daniel3",
    name: "Daniel Cruz",
    role: "Consultant",
    category: "Professional Services",
    img: "daniel",
    initials: "DC",
    tint: "from-sky-400 to-blue-600",
  },
  {
    id: "priya2",
    name: "Priya Nair",
    role: "Product lead",
    category: "Product",
    img: "priya",
    initials: "PN",
    tint: "from-violet-400 to-purple-600",
  },
  {
    id: "priya3",
    name: "Priya Singh",
    role: "Content strategist",
    category: "Media",
    img: "priya",
    initials: "PS",
    tint: "from-violet-400 to-purple-600",
  },
  {
    id: "tomas2",
    name: "Tomas Weber",
    role: "CTO",
    category: "Engineering",
    img: "tomas",
    initials: "TW",
    tint: "from-cyan-400 to-indigo-600",
  },
  {
    id: "tomas3",
    name: "Tomas Berg",
    role: "Founder",
    category: "Startup",
    img: "tomas",
    initials: "TB",
    tint: "from-cyan-400 to-indigo-600",
  },
  {
    id: "farah2",
    name: "Farah Amin",
    role: "Operations head",
    category: "Healthcare",
    img: "farah",
    initials: "FA",
    tint: "from-emerald-400 to-teal-600",
  },
  {
    id: "farah3",
    name: "Farah Yusuf",
    role: "Patient advocate",
    category: "Healthcare",
    img: "farah",
    initials: "FY",
    tint: "from-emerald-400 to-teal-600",
  },
  {
    id: "adeyemi2",
    name: "Adeyemi Cole",
    role: "Training lead",
    category: "EdTech",
    img: "adeyemi",
    initials: "AC",
    tint: "from-amber-400 to-orange-600",
  },
  {
    id: "adeyemi3",
    name: "Adeyemi Banks",
    role: "Curriculum designer",
    category: "Education",
    img: "adeyemi",
    initials: "AB",
    tint: "from-amber-400 to-orange-600",
  },
  {
    id: "luis2",
    name: "Luis Santos",
    role: "Fleet manager",
    category: "Logistics",
    img: "luis",
    initials: "LS",
    tint: "from-green-400 to-emerald-600",
  },
  {
    id: "luis3",
    name: "Luis Oliveira",
    role: "Service director",
    category: "Automotive",
    img: "luis",
    initials: "LO",
    tint: "from-green-400 to-emerald-600",
  },
  {
    id: "hana2",
    name: "Hana Park",
    role: "Supply lead",
    category: "Logistics",
    img: "hana",
    initials: "HP",
    tint: "from-orange-400 to-amber-600",
  },
  {
    id: "hana3",
    name: "Hana Cho",
    role: "Warehouse ops",
    category: "Supply Chain",
    img: "hana",
    initials: "HC",
    tint: "from-orange-400 to-amber-600",
  },
  {
    id: "marco2",
    name: "Marco Rossi",
    role: "Franchise owner",
    category: "Retail",
    img: "marco",
    initials: "MR",
    tint: "from-lime-400 to-green-600",
  },
  {
    id: "marco3",
    name: "Marco Bianchi",
    role: "Event organizer",
    category: "Hospitality",
    img: "marco",
    initials: "MB",
    tint: "from-lime-400 to-green-600",
  },
  {
    id: "sofia2",
    name: "Sofia Muller",
    role: "Account director",
    category: "Sales",
    img: "sofia",
    initials: "SM",
    tint: "from-slate-400 to-slate-600",
  },
  {
    id: "sofia3",
    name: "Sofia Werner",
    role: "Project lead",
    category: "Professional Services",
    img: "sofia",
    initials: "SW",
    tint: "from-slate-400 to-slate-600",
  },
  {
    id: "omar2",
    name: "Omar Hassan",
    role: "RevOps manager",
    category: "Operations",
    img: "omar",
    initials: "OH",
    tint: "from-teal-400 to-cyan-600",
  },
  {
    id: "omar3",
    name: "Omar Khalil",
    role: "Enablement lead",
    category: "Sales",
    img: "omar",
    initials: "OK",
    tint: "from-teal-400 to-cyan-600",
  },
  {
    id: "lena2",
    name: "Lena Krause",
    role: "Clinic director",
    category: "Healthcare",
    img: "lena",
    initials: "LK",
    tint: "from-fuchsia-400 to-purple-600",
  },
  {
    id: "lena3",
    name: "Lena Fischer",
    role: "Compliance lead",
    category: "Healthcare",
    img: "lena",
    initials: "LF",
    tint: "from-fuchsia-400 to-purple-600",
  },
  {
    id: "aisha4",
    name: "Aisha Costa",
    role: "Health coach",
    category: "Wellness",
    img: "aisha",
    initials: "AC",
    tint: "from-rose-400 to-pink-600",
  },
  {
    id: "daniel4",
    name: "Daniel Reid",
    role: "Investor",
    category: "Real Estate",
    img: "daniel",
    initials: "DR",
    tint: "from-sky-400 to-blue-600",
  },
  {
    id: "tomas4",
    name: "Tomas Park",
    role: "Product manager",
    category: "Tech",
    img: "tomas",
    initials: "TP",
    tint: "from-cyan-400 to-indigo-600",
  },
  {
    id: "sofia4",
    name: "Sofia Ali",
    role: "HR director",
    category: "People",
    img: "sofia",
    initials: "SA",
    tint: "from-slate-400 to-slate-600",
  },
  {
    id: "omar4",
    name: "Omar Wells",
    role: "Marketing VP",
    category: "Growth",
    img: "omar",
    initials: "OW",
    tint: "from-teal-400 to-cyan-600",
  },
  {
    id: "nina2",
    name: "Nina Torres",
    role: "Fitness coach",
    category: "Fitness",
    img: "aisha",
    initials: "NT",
    tint: "from-pink-400 to-rose-500",
  },
  {
    id: "carlos2",
    name: "Carlos Rivera",
    role: "Chef",
    category: "Food",
    img: "daniel",
    initials: "CR",
    tint: "from-amber-400 to-orange-500",
  },
  {
    id: "emma2",
    name: "Emma Larsson",
    role: "Hotelier",
    category: "Travel",
    img: "priya",
    initials: "EL",
    tint: "from-sky-400 to-blue-500",
  },
  {
    id: "rachel2",
    name: "Rachel Stone",
    role: "Attorney",
    category: "Legal",
    img: "tomas",
    initials: "RS",
    tint: "from-violet-400 to-indigo-500",
  },
  {
    id: "grace2",
    name: "Grace Park",
    role: "Realtor",
    category: "Real Estate",
    img: "luis",
    initials: "GP",
    tint: "from-teal-400 to-emerald-500",
  },
  {
    id: "ahmed2",
    name: "Ahmed Mansour",
    role: "Engineer",
    category: "Construction",
    img: "farah",
    initials: "AM",
    tint: "from-stone-400 to-amber-500",
  },
  {
    id: "isabella2",
    name: "Isabella Cruz",
    role: "Designer",
    category: "Fashion",
    img: "omar",
    initials: "IC",
    tint: "from-fuchsia-400 to-pink-500",
  },
  {
    id: "thomas2",
    name: "Thomas Wright",
    role: "Developer",
    category: "Real Estate",
    img: "daniel",
    initials: "TW",
    tint: "from-cyan-400 to-blue-500",
  },
  {
    id: "maria2",
    name: "Maria Lopez",
    role: "Director",
    category: "Nonprofit",
    img: "priya",
    initials: "ML",
    tint: "from-lime-400 to-green-500",
  },
  {
    id: "james2",
    name: "James Chen",
    role: "Founder",
    category: "Tech",
    img: "daniel",
    initials: "JC",
    tint: "from-indigo-400 to-violet-500",
  },
];

const TESTIMONIAL_CONVERSATIONS = TESTIMONIAL_CHATS.map(
  ({ flow, pace, demo, evidence }) => ({ flow, pace, demo, evidence }),
);

const TESTIMONIAL_TIMES = [
  "just now",
  "8m ago",
  "24m ago",
  "1h ago",
  "2h ago",
  "Today",
  "Yesterday",
  "2 days ago",
  "3 days ago",
  "This week",
  "Last week",
  "2 weeks ago",
];

const TESTIMONIAL_OUTCOMES = [
  "more qualified inquiries",
  "better lead quality",
  "a more organized pipeline",
  "faster follow-ups",
  "reachable contacts only",
  "cleaner handoffs",
  "warmer conversations",
  "no follow-ups missed",
  "clearer lead status",
  "less time on dead numbers",
  "steadier reply flow",
  "a tidier contact list",
  "higher reply rates",
  "more showroom visits",
  "faster reporting",
  "warmer enrollment leads",
  "smoother team handoffs",
  "stronger local reach",
];

const TESTIMONIAL_BADGES = [
  { icon: ShieldCheck, label: "Validated" },
  { icon: BadgeCheck, label: "WhatsApp active" },
  { icon: Zap, label: "Fast follow-up" },
  { icon: Activity, label: "Live thread" },
  { icon: CheckCheck, label: "Read" },
  { icon: TrendingUp, label: "High intent" },
  { icon: CircleCheck, label: "Verified" },
  { icon: Clock, label: "Timely" },
  { icon: Reply, label: "Responsive" },
  { icon: Sparkles, label: "Top performer" },
];

const TESTIMONIAL_METRICS = [
  { icon: TrendingUp, value: "96%", label: "reply rate" },
  { icon: Timer, value: "4m", label: "avg reply" },
  { icon: Gauge, value: "92", label: "lead score" },
  { icon: CheckCheck, value: "100%", label: "read" },
  { icon: Activity, value: "18", label: "threads" },
  { icon: BadgeCheck, value: "1,240", label: "validated" },
  { icon: Reply, value: "same day", label: "response" },
  { icon: Signal, value: "online", label: "WhatsApp" },
  { icon: MessageCircle, value: "42", label: "conversations" },
  { icon: Users, value: "12", label: "team members" },
  { icon: Target, value: "89", label: "on target" },
  { icon: Zap, value: "3x", label: "faster" },
];

const TESTIMONIAL_CHARTS = [
  [42, 68, 54, 86, 64, 92, 74],
  [58, 44, 78, 60, 90, 70, 96],
  [34, 62, 50, 74, 92, 66, 84],
  [70, 52, 66, 46, 84, 60, 90],
  [48, 76, 58, 88, 56, 80, 68],
  [62, 40, 72, 56, 86, 64, 94],
  [38, 55, 72, 64, 78, 82, 70],
  [80, 60, 45, 70, 55, 90, 65],
  [45, 70, 62, 80, 72, 66, 88],
  [55, 48, 82, 68, 74, 60, 92],
];

const TESTIMONIAL_INSIGHTS = [
  { icon: TrendingUp, label: "Lead quality trend", value: "+32%", note: "this week" },
  { icon: UserCheck, label: "Qualified leads", value: "128", note: "from run #4821" },
  { icon: Activity, label: "Response activity", value: "4m", note: "avg reply" },
  { icon: Gauge, label: "Conversation progress", value: "6/8", note: "qualify steps" },
  { icon: Target, label: "Conversion signal", value: "High", note: "score 92" },
  { icon: CalendarClock, label: "Follow-ups set", value: "3", note: "this week" },
  { icon: Sparkles, label: "Engagement trend", value: "+54%", note: "reply rate" },
  { icon: Reply, label: "Responsiveness", value: "2m", note: "avg first reply" },
];

const TESTIMONIAL_PREVIEWS = [
  "You: Sending the validated lead list now.",
  "Thanks — the follow-up reminder helped a lot.",
  "Import complete · 1,240 contacts validated.",
  "Follow-up scheduled for Thursday.",
  "Your report export is ready.",
  "New message from a qualified lead.",
  "Let us know if you need more seats.",
  "Validated · organized · ready to follow up.",
  "Reply rate is holding steady this month.",
  "Another batch of clean leads is ready.",
];

const CARD_SLOTS = 20;

let testimonialUid = 0;

const shuffleList = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const takeFromQueue = (queue, length) => {
  if (!queue.current.length)
    queue.current = shuffleList([...Array(length).keys()]);
  return queue.current.shift();
};

const makeTestimonial = (personaId, convoId, seq) => {
  const persona = TESTIMONIAL_PERSONAS[personaId];
  const convo = TESTIMONIAL_CONVERSATIONS[convoId];
  return {
    uid: `ts-${(testimonialUid += 1)}`,
    mode: "chat",
    ...persona,
    flow: convo.flow,
    pace: convo.pace,
    demo: convo.demo ?? true,
    evidence: convo.evidence ?? null,
    when: TESTIMONIAL_TIMES[seq % TESTIMONIAL_TIMES.length],
    outcome: TESTIMONIAL_OUTCOMES[seq % TESTIMONIAL_OUTCOMES.length],
    badge: TESTIMONIAL_BADGES[seq % TESTIMONIAL_BADGES.length],
    metric: TESTIMONIAL_METRICS[seq % TESTIMONIAL_METRICS.length],
    chart: TESTIMONIAL_CHARTS[seq % TESTIMONIAL_CHARTS.length],
    insight: TESTIMONIAL_INSIGHTS[seq % TESTIMONIAL_INSIGHTS.length],
  };
};

const makeListCard = (personaId, seq) => {
  const persona = TESTIMONIAL_PERSONAS[personaId];
  const rows = Array.from({ length: 5 }, (_, k) => {
    const p = TESTIMONIAL_PERSONAS[(personaId + k + 1) % TESTIMONIAL_PERSONAS.length];
    return {
      uid: `row-${k}`,
      ...p,
      time: TESTIMONIAL_TIMES[(seq + k) % TESTIMONIAL_TIMES.length],
      text: TESTIMONIAL_PREVIEWS[(seq + k * 3) % TESTIMONIAL_PREVIEWS.length],
      unread: k % 4 === 1 ? 1 + ((seq + k) % 4) : 0,
      muted: k === 3,
    };
  });
  return {
    uid: `tl-${(testimonialUid += 1)}`,
    mode: "list",
    ...persona,
    rows,
  };
}

/* ============================================================
   WhatsApp-style testimonial phone mockup — animated demo chats
   Each card replays its scripted conversation like a live thread:
   typing indicator → message sends in → receipt ticks advance to
   blue read marks. Conversations are simulated demos with an
   `evidence` slot ready for verified customer transcripts.
   ============================================================ */

const useChatProgress = ({ sequence, reduce, unit, delay, holdAtEnd }) => {
  const [step, setStep] = useState(() => (reduce ? sequence.length : 0));
  const rafRef = useRef(null);
  useEffect(() => {
    if (reduce) {
      setStep(sequence.length);
      return undefined;
    }
    setStep(0);
    const total = sequence.length;
    if (total === 0) return undefined;
    const t0 = performance.now() + delay;
    const finish = t0 + unit * total + holdAtEnd;
    const tick = (now) => {
      const el = now - t0;
      let next;
      if (el < 0) next = 0;
      else if (el >= finish) next = total;
      else next = Math.min(total, Math.max(1, Math.ceil(el / unit)));
      setStep((prev) => (prev === next ? prev : next));
      if (next < total) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reduce, sequence, unit, delay, holdAtEnd]);
  return step;
};

const WhatsAppTestimonialCard = React.memo(({ t, index = 0 }) => {
  const reduce = useReducedMotion();
  const flow = useMemo(() => t.flow || [], [t.flow]);
  const unit = t.pace || 880;
  const delay = (index % 5) * 760;
  const step = useChatProgress({
    sequence: flow,
    reduce,
    unit,
    delay,
    holdAtEnd: 1800,
  });
  const total = flow.length;
  const MetricIcon = t.metric.icon;
  const BadgeIcon = t.badge.icon;

  const tickFor = (i) => {
    const revealedAfter = flow.slice(i + 1, step);
    if (revealedAfter.some((x) => x.k === "c")) return "read";
    if (i + 1 < step) return "delivered";
    return "sent";
  };

  return (
    <div className="wa-phone w-full" style={{ aspectRatio: "0.6" }}>
      <div className="wa-screen">
        {/* ── Chat Header ── */}
        <div className="wa-header">
          <ArrowLeft size={21} className="text-[#8696A0] shrink-0" aria-hidden="true" />
          <ProfilePhoto
            img={t.img}
            initials={t.initials}
            tint={t.tint}
            size="md"
            online
            className="wa-avatar"
          />
          <div className="min-w-0 flex-1">
            <p className="wa-name truncate">{t.name}</p>
            <p className="wa-sub truncate">
              <span className="wa-online-dot" aria-hidden="true" /> Business Account · online
            </p>
          </div>
          <Video size={20} className="text-[#8696A0] shrink-0 wa-ic" aria-hidden="true" />
          <Phone size={20} className="text-[#8696A0] shrink-0 wa-ic" aria-hidden="true" />
          <MoreVertical size={20} className="text-[#8696A0] shrink-0 wa-ic -mr-1" aria-hidden="true" />
        </div>

        {/* ── End-to-end encrypted banner ── */}
        <div className="wa-banner">
          <Lock size={10} style={{ color: "#25D366" }} className="shrink-0" aria-hidden="true" />
          <span>Messages are end-to-end encrypted</span>
        </div>

        {/* ── Status chips ── */}
        <div className="wa-chips">
          <span className="wa-chip wa-chip-green">
            <MetricIcon size={10} className="shrink-0" aria-hidden="true" />
            {t.metric.value} {t.metric.label}
          </span>
          <span className="wa-chip wa-chip-grey">
            <BadgeIcon size={10} className="shrink-0" aria-hidden="true" />
            {t.badge.label}
          </span>
          <span className="wa-chip wa-chip-demo">Demo</span>
        </div>

        <ThreadPill>Today</ThreadPill>

        {/* ── Chat body ── */}
        <div className="wa-chat">
          {Array.from({ length: total }).map((_, i) => {
            const f = flow[i];
            if (i >= step) return null;

            if (f.k === "typing") {
              if (i !== step - 1) return null;
              return (
                <div key={`tp-${i}`} className="flex items-end gap-1.5 max-w-[80%] self-start">
                  <ProfilePhoto img={t.img} initials={t.initials} tint={t.tint} size="xs" />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.82, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="wa-bubble wa-bubble-in"
                  >
                    <TypingDots />
                  </motion.div>
                </div>
              );
            }

            if (f.k === "stars") {
              return (
                <div key={`st-${i}`} className="flex justify-start pl-1.5">
                  <StarsRow />
                </div>
              );
            }

            const mine = f.k === "u";
            const tick = mine ? tickFor(i) : null;
            return (
              <div
                key={mine ? `out-${i}` : `in-${i}`}
                className={cn(
                  "flex items-end gap-1.5",
                  mine ? "justify-end" : "",
                )}
              >
                {!mine && (
                  <ProfilePhoto img={t.img} initials={t.initials} tint={t.tint} size="xs" />
                )}
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className={cn("wa-bubble", mine ? "wa-bubble-out" : "wa-bubble-in")}
                >
                  <p className="wa-bubble-text">{f.text}</p>
                  <span className="wa-bubble-meta">
                    {f.t}
                    {tick === "sent" && (
                      <Check size={11} style={{ color: "#8696A0" }} className="shrink-0" aria-hidden="true" />
                    )}
                    {tick === "delivered" && (
                      <CheckCheck size={11} style={{ color: "#8696A0" }} className="shrink-0" aria-hidden="true" />
                    )}
                    {tick === "read" && (
                      <CheckCheck size={11} style={{ color: "#53BDEB" }} className="shrink-0" aria-hidden="true" />
                    )}
                  </span>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* ── Input bar (decorative) ── */}
        <div className="wa-input">
          <Smile size={21} className="text-[#8696A0] shrink-0 wa-ic" aria-hidden="true" />
          <Paperclip size={21} className="text-[#8696A0] shrink-0 wa-ic" aria-hidden="true" />
          <div className="wa-input-pill">
            <span className="truncate">Message</span>
          </div>
          <Camera size={21} className="text-[#8696A0] shrink-0 wa-ic" aria-hidden="true" />
          <span className="wa-mic shrink-0" aria-hidden="true">
            <Mic size={20} />
          </span>
        </div>
      </div>
    </div>
  );
});
WhatsAppTestimonialCard.displayName = "WhatsAppTestimonialCard";

const TESTIMONIAL_CARD_COUNT = 12;
const TESTIMONIAL_GAP = 20;
const AUTO_PX_PER_FRAME = 0.6;

const getPerView = (w) => {
  if (w >= 1536) return 5;
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 768) return 2;
  return 1;
};

const useViewportWidth = () => {
  const [vw, setVw] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setVw(window.innerWidth);
        raf = 0;
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return vw;
};

export const TestimonialsFeed = () => {
  const reduce = useReducedMotion();
  const perView = getPerView(useViewportWidth());
  const trackRef = useRef(null);
  const ioRef = useRef(null);
  const autoRafRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);

  const [cards] = useState(() => {
    const personas = shuffleList([
      ...Array(TESTIMONIAL_PERSONAS.length).keys(),
    ]);
    const convos = shuffleList([
      ...Array(TESTIMONIAL_CONVERSATIONS.length).keys(),
    ]);
    return Array.from({ length: TESTIMONIAL_CARD_COUNT }, (_, i) =>
      makeTestimonial(
        personas[i % personas.length],
        convos[i % convos.length],
        i,
      ),
    );
  });
  const [mounted, setMounted] = useState(() => (
    typeof IntersectionObserver === "undefined"
      ? new Set(Array.from({ length: TESTIMONIAL_CARD_COUNT }, (_, n) => n))
      : new Set([0, 1, 2])
  ));

  const pauseFor = useCallback((ms) => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    if (ms > 0) {
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
      }, ms);
    }
  }, []);

  const resumeAfter = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, 500);
  }, []);

  /* Infinite auto-scroll. One rAF loop, paused on hover or touch. */
  useEffect(() => {
    if (reduce) return undefined;
    let raf = 0;
    const tick = () => {
      const el = trackRef.current;
      if (el && !pausedRef.current && el.scrollWidth > el.clientWidth) {
        const half = (el.scrollWidth - el.clientWidth) / 2;
        el.scrollLeft += AUTO_PX_PER_FRAME;
        if (half > 0 && el.scrollLeft >= half) {
          el.scrollLeft -= half;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  /* Lazy-mount slides near the viewport; far ones stay placeholders. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return undefined;
    ioRef.current = new IntersectionObserver(
      (entries) => {
        setMounted((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const i = Number(e.target.getAttribute("data-i"));
            if (!next.has(i)) {
              next.add(i);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { root: track, rootMargin: "100% 150% 100% 150%", threshold: 0 },
    );
    track.querySelectorAll("[data-i]").forEach((el) => ioRef.current.observe(el));
    return () => {
      if (ioRef.current) ioRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    setMounted((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (let i = 0; i <= perView + 1; i++) {
        if (!next.has(i)) {
          next.add(i);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [perView]);

  const nudge = useCallback((dir) => {
    const el = trackRef.current;
    if (!el || el.children.length < 2) return;
    const slide = el.children[1].offsetLeft - el.children[0].offsetLeft;
    if (slide <= 0) return;
    pauseFor(1100);
    el.scrollBy({ left: dir * slide, behavior: "smooth" });
  }, [pauseFor]);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={resumeAfter}
    >
      {/* Demo notice */}
      <div className="flex justify-center pb-5 -mt-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-wide"
          style={{
            color: "#8696A0",
            borderColor: "rgba(255,255,255,0.1)",
            backgroundColor: "rgba(255,255,255,0.03)",
          }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning/80" aria-hidden="true" />
          Simulated demo conversations · swap in verified reviews anytime
        </span>
      </div>

      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 md:w-14 xl:w-20 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 md:w-14 xl:w-20 bg-gradient-to-l from-background to-transparent" />

      {/* Prev / Next */}
      <button
        type="button"
        className="wa-arrow wa-arrow-left"
        onClick={() => nudge(-1)}
        aria-label="Previous conversations"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        className="wa-arrow wa-arrow-right"
        onClick={() => nudge(1)}
        aria-label="Next conversations"
      >
        <ChevronRight size={22} />
      </button>

      <div
        ref={trackRef}
        role="region"
        aria-label="Simulated product conversations"
        className="wa-track no-scrollbar"
        style={{ touchAction: "pan-x" }}
        onTouchStart={() => pauseFor(0)}
        onTouchEnd={(e) => {
          if (e.cancelable) e.preventDefault();
          resumeAfter();
        }}
        onTouchCancel={resumeAfter}
      >
        {[0, 1].map((copyIdx) =>
          cards.map((card, i) => (
            <div key={`${card.uid}-${copyIdx}`} data-i={i} className="wa-slide">
              {mounted.has(i) ? (
                <WhatsAppTestimonialCard t={card} index={i} />
              ) : (
                <div className="wa-phone wa-skeleton" style={{ aspectRatio: "0.6" }} />
              )}
            </div>
          )),
        )}
      </div>

      <style jsx>{`
        .wa-phone {
          width: 100%;
          border-radius: 32px;
          background: #111111;
          padding: 8px;
          box-shadow:
            0 18px 40px rgba(0, 0, 0, 0.35),
            0 2px 8px rgba(0, 0, 0, 0.4);
          display: flex;
        }
        .wa-screen {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 23px;
          background: #0b141a;
        }
        .wa-header {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 10px;
          min-height: 54px;
          background: #1f2c34;
        }
        .wa-avatar { box-shadow: 0 0 0 2px #1f2c34; }
        .wa-name {
          color: #e9edef;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.2;
        }
        .wa-sub {
          color: #8696a0;
          font-size: 11px;
          line-height: 1.4;
          margin-top: 2px;
        }
        .wa-online-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #25d366;
          margin-right: 5px;
          vertical-align: 1px;
        }
        .wa-ic { opacity: 0.92; }
        .wa-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px 3px;
          color: #8696a0;
          font-size: 10px;
          line-height: 1.3;
          text-align: center;
        }
        .wa-chips {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 5px 12px 7px;
        }
        .wa-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 9999px;
          padding: 3px 9px;
          font-size: 9.5px;
          font-weight: 600;
          line-height: 1.2;
          max-width: 100%;
          white-space: nowrap;
        }
        .wa-chip svg { flex-shrink: 0; }
        .wa-chip-green {
          background: #25d366;
          color: #062d1b;
        }
        .wa-chip-grey {
          background: #182229;
          color: #cbd5da;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .wa-chip-demo {
          background: rgba(37, 211, 102, 0.12);
          color: #7ef0ab;
          border: 1px solid rgba(37, 211, 102, 0.35);
        }
        .wa-chat {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 4px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wa-chat::-webkit-scrollbar { width: 0; height: 0; }
        .wa-bubble {
          position: relative;
          max-width: 82%;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 6px 9px 5px;
          border-radius: 10px;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.18);
        }
        .wa-bubble-in {
          background: #202c33;
          border-bottom-left-radius: 3px;
        }
        .wa-bubble-out {
          background: #005c4b;
          border-bottom-right-radius: 3px;
        }
        .wa-bubble-text {
          font-size: 12.5px;
          line-height: 1.4;
          color: #e9edef;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .wa-bubble-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 3px;
          font-size: 9.5px;
          font-weight: 500;
          color: rgba(233, 237, 239, 0.62);
        }
        .wa-input {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: #1f2c34;
          min-height: 52px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .wa-input-pill {
          flex: 1;
          min-width: 0;
          height: 36px;
          border-radius: 9999px;
          background: #2a3942;
          display: flex;
          align-items: center;
          padding: 0 15px;
          color: #8696a0;
          font-size: 12.5px;
        }
        .wa-mic {
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          background: #00a884;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
        }
        .wa-track {
          display: flex;
          gap: ${TESTIMONIAL_GAP}px;
          overflow-x: auto;
          padding: 8px 12px 4px;
          overscroll-behavior-x: contain;
          scroll-snap-type: none;
          scroll-behavior: auto;
          -webkit-overflow-scrolling: touch;
          user-select: none;
        }
        .wa-slide {
          flex: 0 0 100%;
          min-width: 0;
        }
        @media (max-width: 767px) {
          .wa-phone {
            max-width: 360px;
            margin-inline: auto;
            box-shadow:
              0 10px 20px rgba(0, 0, 0, 0.26),
              0 1px 4px rgba(0, 0, 0, 0.22);
          }
        }
        @media (min-width: 768px) and (max-width: 1279px) {
          .wa-phone {
            box-shadow:
              0 13px 26px rgba(0, 0, 0, 0.28),
              0 2px 5px rgba(0, 0, 0, 0.26);
          }
        }
        @media (min-width: 768px) {
          .wa-slide {
            flex-basis: calc((100% - ${TESTIMONIAL_GAP}px) / 2);
          }
        }
        @media (min-width: 1024px) {
          .wa-slide {
            flex-basis: calc((100% - ${TESTIMONIAL_GAP * 2}px) / 3);
          }
        }
        @media (min-width: 1280px) {
          .wa-slide {
            flex-basis: calc((100% - ${TESTIMONIAL_GAP * 3}px) / 4);
          }
          .wa-bubble-text { font-size: 13px; }
        }
        @media (min-width: 1536px) {
          .wa-slide {
            flex-basis: calc((100% - ${TESTIMONIAL_GAP * 4}px) / 5);
          }
          .wa-bubble-text { font-size: 13px; }
        }
        .wa-skeleton {
          border-radius: 32px;
          background: linear-gradient(110deg, #141414 45%, #1c1c1c 50%, #141414 55%);
          background-size: 200% 100%;
          animation: wa-shimmer 1.6s linear infinite;
        }
        @keyframes wa-shimmer {
          to { background-position: -200% 0; }
        }
        .wa-arrow {
          position: absolute;
          top: 46%;
          transform: translateY(-50%);
          z-index: 20;
          width: 42px;
          height: 42px;
          border-radius: 9999px;
          background: #1f2c34;
          color: #e9edef;
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 150ms ease-out, opacity 150ms ease-out;
        }
        .wa-arrow:hover {
          background: #2a3942;
        }
        .wa-arrow-left { left: 6px; }
        .wa-arrow-right { right: 6px; }
        @media (max-width: 767px) {
          .wa-arrow { display: none; }
        }
        @media (min-width: 768px) {
          .wa-arrow { width: 46px; height: 46px; }
          .wa-arrow-left { left: -8px; }
          .wa-arrow-right { right: -8px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wa-track { scroll-behavior: auto; }
          .wa-skeleton { animation: none; }
        }
      `}</style>
    </div>
  );
};