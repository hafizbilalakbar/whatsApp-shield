import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Clock,
  Zap,
  Gauge,
  Rabbit,
  Info,
  TriangleAlert,
  CircleCheck,
  CircleHelp,
  Check,
  Coffee,
  Timer,
  Leaf,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { RangeSlider } from '../ui/RangeSlider';
import { cn } from '../ui/cn';
import {
  MAX_DELAY_MS,
  MIN_SHIELD_DELAY_MS,
  MIN_FAST_DELAY_MS,
  COOLDOWN_EVERY,
  LONG_BREAK_EVERY,
  SAFETY_PRESETS,
  clampDelay,
  delayRangeMs,
  estimateTotalMs,
  formatDuration,
  formatSeconds,
  jitterToFraction,
  safetyRisk,
  safetyChecklist,
  riskHeadline,
  paceSentence,
  waitSentence,
  variationSentence,
  whatWillHappenSentence,
} from '../../utils/scanMath';

const PRESET_ICONS = { safe: ShieldCheck, balanced: Gauge, fast: Rabbit };

/* The lowest delay the scan can actually use.
   Shield Mode enforces a 1200ms floor; with it off the floor is 600ms. The
   slider MUST use this as its `min` rather than MIN_DELAY_MS, otherwise it can
   be dragged to a position whose number is never used - the chip would read
   "0.5s" while the scan waited 1.2s. */
const delayFloorFor = (shieldMode) => (shieldMode ? MIN_SHIELD_DELAY_MS : MIN_FAST_DELAY_MS);

/* Zone boundaries are expressed in milliseconds and normalised against the
   slider's own min/max, so changing the floor can never leave a colour band
   pointing at the wrong number. */
const buildDelayZones = (min) =>
  [
    { fromValue: min, toValue: 1500, tone: 'danger' },
    { fromValue: 1500, toValue: 3500, tone: 'warning' },
    { fromValue: 3500, toValue: MAX_DELAY_MS, tone: 'success' },
  ].map((z) => ({
    from: (z.fromValue - min) / (MAX_DELAY_MS - min),
    to: (z.toValue - min) / (MAX_DELAY_MS - min),
    tone: z.tone,
  }));

const JITTER_ZONES = [
  { from: 0, to: 0.2, tone: 'danger' },
  { from: 0.2, to: 0.45, tone: 'warning' },
  { from: 0.45, to: 1, tone: 'success' },
];

const TONE_TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-error',
};

const GAUGE_STEPS = [
  { key: 'low', label: 'Low', tone: 'success' },
  { key: 'medium', label: 'Medium', tone: 'warning' },
  { key: 'high', label: 'High', tone: 'danger' },
];

/* Stable, module-level data so React.memo children never see a new array
   identity and re-render for nothing while a slider is being dragged. */
const GAUGE_SEGMENTS = GAUGE_STEPS.map((s) => ({ label: s.label, tone: s.tone }));

/* -------------------------------------------------------------------------
   Info tooltip: one plain sentence plus a concrete worked example.
   Revealed on hover AND on keyboard focus so it is not mouse-only.
   ------------------------------------------------------------------------- */
const InfoTip = memo(function InfoTip({ text, example }) {
  return (
    <span className="px-tip">
      <button type="button" className="px-tip-btn" aria-label={`More information: ${text}`}>
        <CircleHelp size={11} aria-hidden="true" />
      </button>
      <span className="px-tip-panel" role="tooltip">
        {text}
        {example && <span className="px-tip-example">For example: {example}</span>}
      </span>
    </span>
  );
});

/* -------------------------------------------------------------------------
   Safety gauge: segmented Low / Medium / High bar. The number of lit
   segments carries the level, and the level is always spelled out as text,
   so the state is never communicated by colour alone.
   ------------------------------------------------------------------------- */
const SafetyGauge = memo(function SafetyGauge({ level, label, headline }) {
  const activeIndex = Math.max(0, GAUGE_STEPS.findIndex((s) => s.key === level));
  const active = GAUGE_STEPS[activeIndex];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Safety</span>
        <span className={cn('text-sm font-semibold px-2 py-0.5 rounded-full', TONE_TEXT[active.tone])} role="status" aria-live="polite">
          {label}
        </span>
      </div>
      <div className="px-gauge-track" aria-hidden="true">
        {GAUGE_SEGMENTS.map((seg, i) => (
          <span key={seg.label} className="px-gauge-seg" data-on={i <= activeIndex ? 'true' : 'false'} data-tone={seg.tone} />
        ))}
      </div>
      <div className="flex justify-between mt-1.5" aria-hidden="true">
        {GAUGE_SEGMENTS.map((seg, i) => (
          <span
            key={seg.label}
            className={cn(
              'px-gauge-label text-[10px] font-medium',
              i <= activeIndex ? TONE_TEXT[seg.tone] : 'text-text-muted'
            )}
          >
            {seg.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-text-secondary leading-relaxed mt-2.5">{headline}</p>
    </div>
  );
});

/* -------------------------------------------------------------------------
   Live checklist. Every row is driven by the current slider values, so it
   flips between green and amber as the user drags.
   ------------------------------------------------------------------------- */
const SafetyChecklist = memo(function SafetyChecklist({ items }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5">
          <span
            className={cn(
              'shrink-0 mt-0.5 flex items-center justify-center w-4 h-4 rounded-full',
              item.ok ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning'
            )}
          >
            {item.ok ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : <TriangleAlert size={11} strokeWidth={2.5} aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className={cn('block text-sm leading-snug', item.ok ? 'text-text-primary' : 'font-medium text-warning')}>
              {item.label}
            </span>
            <span className="block text-xs text-text-muted leading-snug">{item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
});

/* -------------------------------------------------------------------------
   Estimated time. Big number, plain-language breakdown, no empty filler
   space - the card sizes to its content.
   ------------------------------------------------------------------------- */
const EstimatePanel = memo(function EstimatePanel({ etaMs, audienceSize, range, shieldMode, sentence }) {
  const gaps = Math.max(0, audienceSize - 1);
  const shortBreaks = shieldMode ? Math.floor(gaps / COOLDOWN_EVERY) : 0;
  const longBreaks = shieldMode ? Math.floor(gaps / LONG_BREAK_EVERY) : 0;

  const stats = [
    { label: 'Shortest wait', value: formatSeconds(range.min) },
    { label: 'Longest wait', value: formatSeconds(range.max) },
    { label: 'Short breaks', value: `${shortBreaks}` },
    { label: 'Long breaks', value: `${longBreaks}` },
  ];

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Clock size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-mono font-bold tabular-nums tracking-tight leading-none" aria-live="polite">
            {formatDuration(etaMs)}
          </div>
          <p className="text-xs text-text-secondary mt-1.5 leading-snug">
            to check {audienceSize.toLocaleString()} number{audienceSize === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-4 pt-3.5 border-t border-border">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wider text-text-muted truncate">{s.label}</dt>
            <dd className="text-sm font-mono font-semibold tabular-nums mt-0.5">{s.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-text-secondary leading-relaxed mt-3.5 pt-3.5 border-t border-border flex items-start gap-2">
        <Leaf size={13} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
        <span>{sentence}</span>
      </p>
    </div>
  );
});

/* -------------------------------------------------------------------------
   Preset cards as a real radio group: one tab stop, arrow keys move and
   select, Space/Enter select. This is the WCAG 2.2 AA "dragging/selection
   is not pointer-only" requirement, applied to the selection control.
   ------------------------------------------------------------------------- */
const PresetCards = memo(function PresetCards({ activeId, shieldMode, onSelect }) {
  const refs = useRef({});

  const move = useCallback(
    (from, delta) => {
      const list = SAFETY_PRESETS;
      const next = list[(from + delta + list.length) % list.length];
      onSelect(next.id);
      const node = refs.current[next.id];
      if (node) node.focus();
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e, index) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        move(index, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        move(index, -1);
      }
    },
    [move]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Choose a starting point">
      {SAFETY_PRESETS.map((preset, index) => {
        const Icon = PRESET_ICONS[preset.id] || Gauge;
        const isActive = activeId === preset.id;
        // The card must promise exactly what the sliders will produce. "Fast"
        // is authored as 1000ms, but Shield Mode has a 1200ms floor, so the
        // chip shows the clamped value - and the slider's own minimum is that
        // same floor, so there is no second, disagreeing number anywhere.
        const effectiveDelay = clampDelay(preset.baseDelay, shieldMode);
        return (
          <button
            key={preset.id}
            ref={(node) => { refs.current[preset.id] = node; }}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(preset.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'group/card relative text-left rounded-xl border-2 p-3.5 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'border-primary bg-primary/[0.07] shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_14%,transparent)]'
                : 'border-border bg-surface hover:border-primary/35 hover:-translate-y-0.5 hover:shadow-sm'
            )}
          >
            <span
              className={cn(
                'absolute top-2.5 right-2.5 flex items-center justify-center w-4 h-4 rounded-full transition-all duration-200',
                isActive ? 'bg-primary text-white scale-100 opacity-100' : 'bg-transparent border border-border opacity-0 scale-75'
              )}
              aria-hidden="true"
            >
              <Check size={10} strokeWidth={3.5} />
            </span>

            <span className="flex items-center gap-2 pr-5">
              <Icon size={16} className={cn('shrink-0', isActive ? 'text-primary' : 'text-text-muted')} aria-hidden="true" />
              <span className="font-semibold text-sm leading-none">{preset.label}</span>
            </span>

            <span className="block text-xs text-text-secondary mt-1.5 leading-snug min-h-[2rem]">
              {preset.description}
            </span>

            <span className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium font-mono px-1.5 py-0.5 rounded bg-background/70 border border-border text-text-secondary">
                <Timer size={10} aria-hidden="true" />
                Wait {(effectiveDelay / 1000).toFixed(1)}s
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium font-mono px-1.5 py-0.5 rounded bg-background/70 border border-border text-text-secondary">
                <Zap size={10} aria-hidden="true" />
                Variation {preset.jitter}%
              </span>
            </span>

            {preset.tag && (
              <span
                className={cn(
                  'absolute -top-2 left-3 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                  preset.tag === 'Recommended'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-warning/12 text-warning border-warning/40'
                )}
              >
                {preset.tag}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

const Step3Safety = ({ onNext, onPrev }) => {
  const [shieldMode, setShieldMode] = useState(true);
  const [baseDelay, setBaseDelay] = useState(3000);
  const [jitterPct, setJitterPct] = useState(50);

  /* The slider's real domain. Dragging can only ever produce a delay the scan
     will actually honour, so the chip, the bubble, the zones and the value
     written to `window.whatsappShieldSettings` can never disagree. */
  const delayMin = delayFloorFor(shieldMode);
  const delayZones = useMemo(() => buildDelayZones(delayMin), [delayMin]);

  // Audience size is passed from Step 2 through a window global. Reading it on
  // every render (not in state) keeps it live without an effect + setState
  // round trip that would briefly render a stale count.
  const audienceSize = window.whatsappShieldAudience ? window.whatsappShieldAudience.length : 0;

  /* Everything below is derived, never stored. The slider's own visual
     movement is handled inside RangeSlider via a CSS variable, so a parent
     re-render here is purely for the summary text and can safely happen once
     per animation frame. */
  const { range, etaMs, risk, checklist, pace, waitLine, variationLine, whatHappens } = useMemo(() => {
    const frac = jitterToFraction(jitterPct);
    const r = delayRangeMs(baseDelay, frac, shieldMode);
    const e = estimateTotalMs({ audienceSize, baseDelay, jitterFraction: frac, shieldMode });
    const k = safetyRisk({ baseDelay, jitterFraction: frac, shieldMode, audienceSize });
    return {
      range: r,
      etaMs: e,
      risk: k,
      checklist: safetyChecklist({ baseDelay, jitterFraction: frac, shieldMode, audienceSize }),
      pace: paceSentence({ range: r, shieldMode }),
      waitLine: waitSentence({ range: r, shieldMode }),
      variationLine: variationSentence({ jitterFraction: frac, shieldMode }),
      whatHappens: whatWillHappenSentence({ audienceSize, etaMs: e, risk: k }),
    };
  }, [baseDelay, jitterPct, shieldMode, audienceSize]);

  // Compare against the CLAMPED preset value. "Fast" is 1000ms but Shield Mode
  // enforces a 1200ms floor, so comparing raw values meant the Fast card could
  // never light up as selected once Shield Mode was on.
  const activePresetId = useMemo(() => {
    const match = SAFETY_PRESETS.find(
      (p) => clampDelay(p.baseDelay, shieldMode) === baseDelay && p.jitter === jitterPct
    );
    return match ? match.id : null;
  }, [baseDelay, jitterPct, shieldMode]);

  const applyPreset = useCallback(
    (presetOrId) => {
      const preset = typeof presetOrId === 'string' ? SAFETY_PRESETS.find((p) => p.id === presetOrId) : presetOrId;
      if (!preset) return;
      setBaseDelay(clampDelay(preset.baseDelay, shieldMode));
      setJitterPct(preset.jitter);
    },
    [shieldMode]
  );
  const handlePresetSelect = useCallback((id) => applyPreset(id), [applyPreset]);

  /* Toggling Shield Mode changes the floor the delay must respect
     (1200ms on, 600ms off). Pull the current delay back into the new domain in
     the same commit, so the thumb can never be parked outside its own track and
     the chip never shows a delay the server would silently override. */
  const handleShieldToggle = useCallback(
    (next) => {
      setShieldMode(next);
      setBaseDelay((current) => clampDelay(current, next));
    },
    []
  );

  // Bubble labels are derived from the value itself so they can never trail
  // the thumb by a frame. Stable identities keep RangeSlider's memoisation
  // effective.
  const formatDelayValue = useCallback((v) => `${(Number(v) / 1000).toFixed(1)}s`, []);
  const formatJitterValue = useCallback((v) => `${Math.round(Number(v))}%`, []);

  // Keep the settings the Live Scan step reads in sync even if the user
  // navigates away with the keyboard (before pressing Continue).
  useEffect(() => {
    window.whatsappShieldSettings = {
      ...(window.whatsappShieldSettings || {}),
      shieldMode,
      delayMs: baseDelay,
      jitter: jitterPct,
    };
  }, [shieldMode, baseDelay, jitterPct]);

  const handleContinue = useCallback(() => {
    window.whatsappShieldSettings = {
      ...(window.whatsappShieldSettings || {}),
      shieldMode,
      delayMs: baseDelay,
      jitter: jitterPct,
    };
    onNext();
  }, [shieldMode, baseDelay, jitterPct, onNext]);

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-5 sm:mb-6">
        <h2 className="text-2xl font-display font-semibold flex items-center gap-2">
          <ShieldCheck className="text-primary" /> Safety
        </h2>
        <p className="text-text-secondary mt-1 max-w-2xl">
          Choose how long to wait between numbers. This is the main thing keeping your WhatsApp number safe.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-grow min-h-0">

        {/* ---------------- Left: settings ---------------- */}
        <div className="lg:col-span-2 flex flex-col gap-5 min-w-0">

          {/* Shield Mode */}
          <Card
            className={cn(
              'transition-colors duration-200',
              shieldMode ? 'border-primary/50 bg-primary/[0.04]' : 'border-border'
            )}
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold flex items-center gap-2 flex-wrap">
                    Shield Mode
                    <span className="text-sm font-normal text-text-muted hidden sm:inline">(Account Protection)</span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-1.5 py-0.5 rounded-full border',
                        shieldMode
                          ? 'bg-success/12 text-success border-success/30'
                          : 'bg-background/70 text-text-muted border-border'
                      )}
                    >
                      {shieldMode ? 'On' : 'Off'}
                    </span>
                  </h3>
                  <p className="text-sm text-text-secondary mt-1 max-w-lg">
                    Adds natural pauses and random waits so your WhatsApp account stays safe.
                  </p>
                </div>
                <div className="shrink-0 pt-0.5">
                  <Switch
                    checked={shieldMode}
                    onCheckedChange={handleShieldToggle}
                    aria-label="Turn Shield Mode on or off"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Presets */}
          <Card>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-3 mb-3.5">
                <h3 className="font-semibold text-sm">Start with a preset</h3>
                {activePresetId === null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/12 text-warning border border-warning/35">
                    Custom
                  </span>
                )}
              </div>
              <PresetCards activeId={activePresetId} shieldMode={shieldMode} onSelect={handlePresetSelect} />
            </CardContent>
          </Card>

          {/* Sliders */}
          <Card>
            <CardContent className="p-4 md:p-5 space-y-8">

              {/* Wait time */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-1">
                  <div className="min-w-0">
                    <label htmlFor="base-delay-slider" className="font-semibold flex items-center gap-2">
                      Wait time between numbers
                      <InfoTip
                        text="How long to wait before checking the next number. Longer is safer."
                        example="3 seconds means it waits 3 seconds, then checks the next one."
                      />
                    </label>
                  </div>
                  <span className="shrink-0 font-mono font-semibold text-sm tabular-nums px-2.5 py-1 rounded-lg bg-primary/8 text-primary border border-primary/20">
                    {(baseDelay / 1000).toFixed(1)}s
                  </span>
                </div>

                <RangeSlider
                  id="base-delay-slider"
                  min={delayMin}
                  max={MAX_DELAY_MS}
                  step={250}
                  value={baseDelay}
                  onChange={setBaseDelay}
                  formatValue={formatDelayValue}
                  bubbleText={`${(baseDelay / 1000).toFixed(1)}s`}
                  label="Wait time between numbers, in seconds"
                  valueText={`${(baseDelay / 1000).toFixed(1)} seconds`}
                  zones={delayZones}
                  zoneLabels={{ left: 'Fast (risky)', right: 'Slow (safest)' }}
                  aria-describedby="wait-time-sentence"
                />

                <p id="wait-time-sentence" className="text-sm text-text-secondary leading-relaxed">
                  {waitLine}
                </p>
              </div>

              {/* Random variation */}
              <div
                className={cn('transition-opacity duration-200', !shieldMode && 'opacity-45')}
                aria-disabled={!shieldMode}
              >
                <div className="flex items-start justify-between gap-4 mb-1">
                  <div className="min-w-0">
                    <label htmlFor="variation-slider" className="font-semibold flex items-center gap-2">
                      Random variation
                      <InfoTip
                        text="Makes each wait a little different, like a real person would."
                        example="3 seconds and 50% means waits land anywhere between 1.5 and 4.5 seconds."
                      />
                    </label>
                  </div>
                  <span className="shrink-0 font-mono font-semibold text-sm tabular-nums px-2.5 py-1 rounded-lg bg-primary/8 text-primary border border-primary/20">
                    {jitterPct}%
                  </span>
                </div>

                <RangeSlider
                  id="variation-slider"
                  min={0}
                  max={100}
                  step={5}
                  value={jitterPct}
                  onChange={setJitterPct}
                  formatValue={formatJitterValue}
                  bubbleText={`${jitterPct}%`}
                  disabled={!shieldMode}
                  label="How much each wait changes, in percent"
                  valueText={`${jitterPct} percent`}
                  zones={JITTER_ZONES}
                  zoneLabels={{ left: 'Same every time', right: 'Very random' }}
                  aria-describedby="variation-sentence"
                />

                <p id="variation-sentence" className="text-sm text-text-secondary leading-relaxed">
                  {variationLine}
                </p>
              </div>

              {/* Full picture */}
              <div className="pt-1 border-t border-border">
                <p className="text-sm text-text-secondary leading-relaxed flex items-start gap-2">
                  <Coffee size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                  <span>{pace}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- Right: summary ---------------- */}
        <div className="flex flex-col gap-4 min-w-0">
          {!shieldMode && (
            <div className="rounded-xl border border-error/25 bg-error/[0.07] p-4 flex gap-3 items-start animate-in fade-in zoom-in-95">
              <ShieldAlert size={18} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-text-secondary leading-relaxed">
                <span className="font-semibold text-error block mb-0.5">Your number is not protected</span>
                Without Shield Mode every check runs at the same speed, which is easy to spot. Your number could be blocked.
              </p>
            </div>
          )}

          <Card>
            <CardContent className="p-4 md:p-5">
              <SafetyGauge level={risk.level} label={risk.label} headline={riskHeadline(risk)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                Before you start
              </h3>
              <SafetyChecklist items={checklist} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-5">
              <EstimatePanel
                etaMs={etaMs}
                audienceSize={audienceSize}
                range={range}
                shieldMode={shieldMode}
                sentence={whatHappens}
              />
            </CardContent>
          </Card>

          {/* Honest, short safety note */}
          <div className="flex gap-2.5 items-start rounded-xl border border-border bg-surface/60 p-3.5">
            <Info size={15} className="shrink-0 mt-0.5 text-text-muted" aria-hidden="true" />
            <p className="text-xs text-text-secondary leading-relaxed">
              No tool can promise your number will never be limited by WhatsApp. Keep Shield Mode on, use smaller batches, and avoid very long runs in one day.
            </p>
          </div>

          <div className="mt-auto flex gap-3 pt-1">
            <Button variant="outline" onClick={onPrev} className="px-3" aria-label="Go back to the previous step">
              <ArrowLeft size={16} />
            </Button>
            <Button className="flex-1" onClick={handleContinue} variant={!shieldMode ? 'destructive' : 'default'}>
              {shieldMode ? (
                <CircleCheck size={16} className="mr-2" aria-hidden="true" />
              ) : (
                <TriangleAlert size={16} className="mr-2" aria-hidden="true" />
              )}
              {shieldMode ? 'Start Validation' : 'Start Without Shield'}
              <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Step3Safety;
