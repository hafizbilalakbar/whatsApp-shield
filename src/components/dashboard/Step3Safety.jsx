import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Clock,
  Gauge,
  Rabbit,
  Check,
  Zap,
  TriangleAlert,
  CircleCheck,
  Sparkles,
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
  SAFETY_PRESETS,
  clampDelay,
  delayRangeMs,
  estimateTotalMs,
  formatDuration,
  jitterToFraction,
  safetyRisk,
  riskHeadline,
  whatWillHappenSentence,
} from '../../utils/scanMath';

const PRESET_ICONS = {
  safe: ShieldCheck,
  balanced: Gauge,
  fast: Zap,
};

const PRESET_DESCRIPTIONS = {
  safe: 'Slowest and safest. Best for your main number.',
  balanced: 'Good speed with natural waits.',
  fast: 'Quick, but a higher chance of being blocked.',
};

const delayFloorFor = (shieldMode) => (shieldMode ? MIN_SHIELD_DELAY_MS : MIN_FAST_DELAY_MS);

const GAUGE_STEPS = [
  { key: 'low', label: 'Low risk', tone: 'success' },
  { key: 'medium', label: 'Medium risk', tone: 'warning' },
  { key: 'high', label: 'High risk', tone: 'danger' },
];

const TONE_TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-error',
};

const TONE_BG = {
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-error/10 text-error border-error/30',
};

/* -------------------------------------------------------------------------
   Safety Gauge: segmented Low / Medium / High meter with clear text & color.
   ------------------------------------------------------------------------- */
const SafetyGauge = memo(function SafetyGauge({ risk }) {
  const activeIndex = Math.max(0, GAUGE_STEPS.findIndex((s) => s.key === risk.level));
  const active = GAUGE_STEPS[activeIndex] || GAUGE_STEPS[0];
  const headline = riskHeadline(risk);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Safety Level</span>
        <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border', TONE_BG[active.tone])}>
          {active.label}
        </span>
      </div>

      {/* Segmented Track */}
      <div className="grid grid-cols-3 gap-1.5 h-2.5 rounded-full bg-border/40 p-0.5" aria-hidden="true">
        {GAUGE_STEPS.map((step, idx) => {
          const isLit = idx <= activeIndex;
          let barBg = 'bg-transparent';
          if (isLit) {
            if (active.tone === 'success') barBg = 'bg-success';
            else if (active.tone === 'warning') barBg = 'bg-warning';
            else barBg = 'bg-error';
          }
          return (
            <div
              key={step.key}
              className={cn(
                'rounded-full transition-all duration-300',
                isLit ? barBg : 'bg-border/60'
              )}
            />
          );
        })}
      </div>

      <p className="text-xs text-text-secondary leading-relaxed pt-1">
        {headline}
      </p>
    </div>
  );
});

/* -------------------------------------------------------------------------
   Preset Cards: radio-group semantics with keyboard support and clear states.
   ------------------------------------------------------------------------- */
const PresetCards = memo(function PresetCards({ activeId, shieldMode, audienceSize, onSelect }) {
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Choose a starting preset">
      {SAFETY_PRESETS.map((preset, index) => {
        const Icon = PRESET_ICONS[preset.id] || Gauge;
        const isActive = activeId === preset.id;
        const effectiveDelay = clampDelay(preset.baseDelay, shieldMode);
        const frac = jitterToFraction(preset.jitter);
        const presetEta = estimateTotalMs({
          audienceSize,
          baseDelay: effectiveDelay,
          jitterFraction: frac,
          shieldMode,
        });

        const tagLabel = preset.id === 'balanced' ? 'Recommended' : preset.id === 'fast' ? 'Risky' : null;

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
              'group/card relative flex flex-col justify-between text-left rounded-2xl border-2 p-4 transition-all duration-200 min-h-[140px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'border-primary bg-primary/[0.08] shadow-sm -translate-y-0.5'
                : 'border-border bg-surface hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-sm'
            )}
          >
            {/* Top pill badge */}
            {tagLabel && (
              <span
                className={cn(
                  'absolute top-3.5 right-3.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                  tagLabel === 'Recommended'
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-warning/15 text-warning border-warning/30'
                )}
              >
                {tagLabel}
              </span>
            )}

            <div>
              {/* Icon & Title */}
              <div className="flex items-center gap-2.5 mb-2 pr-16">
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
                    isActive ? 'bg-primary text-white shadow-sm' : 'bg-primary/10 text-primary group-hover/card:bg-primary/20'
                  )}
                >
                  <Icon size={16} aria-hidden="true" />
                </div>
                <span className="font-semibold text-sm text-text-primary">{preset.label}</span>
              </div>

              {/* Short line */}
              <p className="text-xs text-text-secondary leading-relaxed">
                {PRESET_DESCRIPTIONS[preset.id] || preset.description}
              </p>
            </div>

            {/* Estimated time footer */}
            <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-text-muted flex items-center gap-1">
                <Clock size={12} className="text-text-muted" /> Est. Time
              </span>
              <span className="font-semibold text-text-primary font-mono tabular-nums">
                {audienceSize > 0 ? formatDuration(presetEta) : '—'}
              </span>
            </div>
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

  const delayMin = delayFloorFor(shieldMode);
  const audienceSize = window.whatsappShieldAudience ? window.whatsappShieldAudience.length : 0;

  const { etaMs, risk, whatHappens } = useMemo(() => {
    const frac = jitterToFraction(jitterPct);
    const r = delayRangeMs(baseDelay, frac, shieldMode);
    const e = estimateTotalMs({ audienceSize, baseDelay, jitterFraction: frac, shieldMode });
    const k = safetyRisk({ baseDelay, jitterFraction: frac, shieldMode, audienceSize });
    return {
      range: r,
      etaMs: e,
      risk: k,
      whatHappens: whatWillHappenSentence({ audienceSize, etaMs: e, risk: k }),
    };
  }, [baseDelay, jitterPct, shieldMode, audienceSize]);

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

  const handleShieldToggle = useCallback(
    (next) => {
      setShieldMode(next);
      setBaseDelay((current) => clampDelay(current, next));
    },
    []
  );

  const formatDelayValue = useCallback((v) => `${(Number(v) / 1000).toFixed(1)}s`, []);
  const formatJitterValue = useCallback((v) => `${Math.round(Number(v))}%`, []);

  // Sync settings globally so Step 4 & backend read them cleanly
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

  const waitRiskLabel = baseDelay >= 3500 ? 'Safe' : baseDelay >= 1500 ? 'Balanced' : 'Risky';
  const waitRiskTone = baseDelay >= 3500 ? 'text-success' : baseDelay >= 1500 ? 'text-warning' : 'text-error';

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          Safety
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Choose how careful the scan should be to keep your WhatsApp number safe.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow min-h-0 items-start">
        {/* ---------------- Left / Main Column (7 cols) ---------------- */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5 min-w-0">
          {/* Shield Mode Switch Card */}
          <Card
            className={cn(
              'transition-all duration-200 border rounded-2xl',
              shieldMode ? 'border-primary/40 bg-primary/[0.03]' : 'border-border bg-surface'
            )}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-semibold text-base text-text-primary">Shield Mode</h3>
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full border',
                        shieldMode
                          ? 'bg-success/10 text-success border-success/30'
                          : 'bg-background/80 text-text-muted border-border'
                      )}
                    >
                      {shieldMode ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-text-secondary mt-1">
                    Adds natural pauses so your account stays safe.
                  </p>
                </div>
                <div className="shrink-0">
                  <Switch
                    checked={shieldMode}
                    onCheckedChange={handleShieldToggle}
                    aria-label="Turn Shield Mode on or off"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Presets Card */}
          <Card className="rounded-2xl border-border">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3.5">
                <h3 className="font-semibold text-sm text-text-primary">Choose a preset</h3>
                {activePresetId === null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/35">
                    Custom Settings
                  </span>
                )}
              </div>
              <PresetCards
                activeId={activePresetId}
                shieldMode={shieldMode}
                audienceSize={audienceSize}
                onSelect={applyPreset}
              />
            </CardContent>
          </Card>

          {/* Fine Tuning Sliders Card */}
          <Card className="rounded-2xl border-border">
            <CardContent className="p-4 sm:p-5 space-y-7">
              {/* Wait time slider */}
              <div>
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div>
                    <label htmlFor="base-delay-slider" className="font-semibold text-sm text-text-primary block">
                      Wait time
                    </label>
                    <span className="text-xs text-text-secondary">Longer waits are safer.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold', waitRiskTone)}>
                      {waitRiskLabel}
                    </span>
                    <span className="font-mono font-semibold text-sm tabular-nums px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                      {(baseDelay / 1000).toFixed(1)}s
                    </span>
                  </div>
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
                  label="Wait time between numbers"
                  valueText={`${(baseDelay / 1000).toFixed(1)} seconds`}
                  zoneLabels={{ left: 'Faster', right: 'Safer' }}
                />
              </div>

              {/* Natural variation slider */}
              <div
                className={cn('transition-opacity duration-200', !shieldMode && 'opacity-40 pointer-events-none')}
                aria-disabled={!shieldMode}
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div>
                    <label htmlFor="variation-slider" className="font-semibold text-sm text-text-primary block">
                      Natural variation
                    </label>
                    <span className="text-xs text-text-secondary">
                      Makes each wait a little different, like a real person.
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-sm tabular-nums px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
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
                  label="Natural variation percentage"
                  valueText={`${jitterPct} percent`}
                  zoneLabels={{ left: 'Same', right: 'Varied' }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- Right / Summary Column (5 cols) ---------------- */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 min-w-0">
          {/* Warning Banner (Shown only on real risk) */}
          {!shieldMode ? (
            <div className="rounded-2xl border border-error/30 bg-error/[0.08] p-4 flex gap-3 items-start animate-in fade-in">
              <ShieldAlert size={18} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                <span className="font-semibold text-error block mb-0.5">Shield Mode is turned off</span>
                Every check will run at the exact same speed. Turn Shield Mode on to prevent your account from being flagged.
              </div>
            </div>
          ) : risk.level === 'high' ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/[0.08] p-4 flex gap-3 items-start animate-in fade-in">
              <TriangleAlert size={18} className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                <span className="font-semibold text-warning block mb-0.5">Fast pace selected</span>
                Waits are short. Consider choosing the Safe or Balanced preset for your primary WhatsApp account.
              </div>
            </div>
          ) : null}

          {/* Safety Gauge Card */}
          <Card className="rounded-2xl border-border">
            <CardContent className="p-4 sm:p-5">
              <SafetyGauge risk={risk} />
            </CardContent>
          </Card>

          {/* Estimated Time Card */}
          <Card className="rounded-2xl border-border">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Estimated Time</span>
                <span className="text-xs text-text-muted">
                  for {audienceSize.toLocaleString()} number{audienceSize === 1 ? '' : 's'}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-mono font-bold text-text-primary tracking-tight" aria-live="polite">
                  {formatDuration(etaMs)}
                </div>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed mt-2.5 pt-2.5 border-t border-border flex items-center gap-1.5">
                <Sparkles size={13} className="text-primary shrink-0" />
                <span>{whatHappens || 'Your account stays well protected.'}</span>
              </p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 pt-2">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onPrev}
                className="px-4 h-11 rounded-xl"
                aria-label="Go back to the previous step"
              >
                <ArrowLeft size={16} />
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold shadow-sm"
                onClick={handleContinue}
                variant={!shieldMode ? 'destructive' : 'default'}
              >
                {shieldMode ? (
                  <CircleCheck size={16} className="mr-2" aria-hidden="true" />
                ) : (
                  <TriangleAlert size={16} className="mr-2" aria-hidden="true" />
                )}
                {shieldMode ? 'Start Validation' : 'Start Without Shield'}
                <ArrowRight size={16} className="ml-2" aria-hidden="true" />
              </Button>
            </div>

            {/* Disclaimer line */}
            <p className="text-[11px] text-text-muted text-center px-2 leading-relaxed">
              No tool can fully guarantee account safety. Keep Shield Mode on and avoid very long runs in one day.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3Safety;
