import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from './cn';

/**
 * Premium range slider.
 *
 * ---------------------------------------------------------------------------
 * Why this is not `<input type="range" accent-primary>`
 * ---------------------------------------------------------------------------
 * The native control draws its own track and its own thumb. Styling them
 * independently is what produced the two visible bugs this replaces:
 *
 *   1. The thumb floated above the track. The native thumb is centred inside
 *      the input's content box while a decorative track div was absolutely
 *      positioned at the top of the wrapper - two different coordinate
 *      systems, so the thumb sat several pixels off the bar.
 *   2. The fill never lined up with the thumb. A thumb of width H travels from
 *      H/2 to (trackWidth - H/2), but a gradient drawn across `0% -> 100%` of
 *      the track reaches its full width at the edges. The two only agree at
 *      the two extremes.
 *
 * The fix is to make the fill and the thumb derive from ONE expression, so
 * they cannot drift apart at any track width, zoom level or value:
 *
 *     position = thumb/2 + t * (100% - thumb)
 *
 * Both `.px-slider-fill` (as `width`) and `.px-slider-thumb` (as `left`) use
 * that identical calc(), and both are positioned inside the same track box.
 * Alignment is therefore correct by construction rather than by tuning.
 *
 * ---------------------------------------------------------------------------
 * Why dragging does not lag
 * ---------------------------------------------------------------------------
 * A native `input` event fires faster than the display refreshes, and each one
 * used to call setState on the parent, re-rendering the whole step. The fix
 * separates *visual movement* from *state propagation*:
 *
 *   - The thumb/fill/bubble are driven by a single CSS custom property
 *     (`--t`) written straight to the DOM node inside the event handler. The
 *     browser paints it immediately, so movement is never gated on a React
 *     commit, no matter how heavy the parent is.
 *   - The parent's onChange is coalesced through one requestAnimationFrame, so
 *     a consumer re-renders at most once per frame instead of once per event.
 *   - The style object handed to React is a single stable ref, so React never
 *     writes to `style` and can never clobber the imperative `--t` update
 *     with a stale value mid-drag. This is what would otherwise cause the
 *     thumb to snap backwards.
 *
 * The `input` itself is kept (transparent, on top) because it is the most
 * reliable way to retain native keyboard, touch and assistive-technology
 * behaviour - WCAG 2.2 AA requires a non-drag alternative, which the arrow /
 * Home / End / PageUp / PageDown keys provide.
 *
 * ---------------------------------------------------------------------------
 * Why the mouse works at all (previous critical bug)
 * ---------------------------------------------------------------------------
 * The transparent input MUST be a child of `.px-slider-track`, which is the
 * `position: relative` element. It used to be a *sibling* of the track, and
 * `.px-slider` never set a position, so `position: absolute; top: 0` resolved
 * against some distant positioned ancestor. The invisible 32px bar that
 * actually receives the click therefore sat ~14px above the painted track and
 * over unrelated controls - the slider looked correct and did nothing.
 *
 * Two rules make that class of bug impossible again:
 *
 *   1. The input is the first child of the track, so it inherits the track's
 *      box. `left: 0; top: 50%; width: 100%` is now expressed in the *same*
 *      coordinates as the rail, the fill and the thumb.
 *   2. The native thumb is sized to `var(--thumb)` - the exact width of the
 *      custom thumb - so the browser's own value->x mapping travels from
 *      `thumb/2` to `100% - thumb/2`, which is precisely the expression the
 *      custom thumb uses. If these ever diverged the thumb would lag the
 *      pointer; sharing one variable makes that impossible.
 *
 * Rendering the input first also repairs every `~` selector below: a general
 * sibling combinator only matches FOLLOWING siblings, so
 * `.px-slider-input:focus-visible ~ .px-slider-thumb` was dead code while the
 * track came first in the DOM.
 */

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const ZONE_COLOR = {
  danger: 'var(--error)',
  warning: 'var(--warning)',
  success: 'var(--success)',
  neutral: 'var(--border)',
};

const RangeSlider = React.forwardRef(function RangeSlider(
  {
    className,
    value,
    min = 0,
    max = 100,
    step = 1,
    onChange,
    onValueCommit,
    disabled = false,
    label,
    valueText,
    id,
    // --- presentation ---
    bubbleText = '',
    formatValue,
    thumbSize = 20,
    trackHeight = 10,
    zones,
    zoneLabels,
    'aria-describedby': ariaDescribedBy,
    ...props
  },
  ref
) {
  const trackRef = useRef(null);
  const inputRef = useRef(null);
  const bubbleRef = useRef(null);
  const rafRef = useRef(0);
  const pendingRef = useRef(null);
  const dragValueRef = useRef(null);
  const gestureRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  // Merge the forwarded ref with our internal handle on the input.
  const setInputRef = useCallback(
    (node) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const span = max - min;
  const toT = useCallback(
    (v) => {
      if (!span) return 0;
      return Math.min(1, Math.max(0, (Number(v) - min) / span));
    },
    [span, min]
  );

  /* One stable object, created once. React compares style by reference, so
     after mount it never writes to `style` again and the imperative `--t`
     updates below are never overwritten by a stale re-render. */
  const styleRef = useRef(null);
  if (styleRef.current === null) {
    styleRef.current = { '--t': String(toT(value)), '--thumb': `${thumbSize}px`, '--track-h': `${trackHeight}px` };
  }

  /* --- visual layer: pure DOM, no React, runs synchronously on move --- */
  const paint = useCallback(
    (nextValue) => {
      const t = toT(nextValue);
      const node = trackRef.current;
      if (node) node.style.setProperty('--t', String(t));
      const bubble = bubbleRef.current;
      if (bubble) {
        // Derived from the value being painted, never from a prop that is a
        // frame behind - otherwise the bubble trails the thumb while dragging.
        const text = formatValue ? formatValue(nextValue) : bubbleText;
        if (text) bubble.textContent = text;
      }
    },
    [toT, formatValue, bubbleText]
  );

  /* --- state propagation: coalesced to one call per frame --- */
  const flush = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending !== null && typeof onChange === 'function') onChange(pending);
  }, [onChange]);

  const notify = useCallback(
    (next) => {
      pendingRef.current = next;
      if (rafRef.current) return; // already scheduled this frame
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const v = pendingRef.current;
        pendingRef.current = null;
        if (v !== null && typeof onChange === 'function') onChange(v);
      });
    },
    [onChange]
  );

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Seed / re-sync the visual whenever the value arrives from outside (presets,
  // keyboard steps, parent resets). Skipped mid-drag so the pointer owns it.
  useIsomorphicLayoutEffect(() => {
    if (dragValueRef.current === null) paint(value);
  }, [value, paint]);

  const commit = useCallback(
    (next) => {
      flush();
      if (typeof onValueCommit === 'function') onValueCommit(next);
    },
    [flush, onValueCommit]
  );

  const handleInput = useCallback(
    (e) => {
      const next = Number(e.target.value);
      paint(next);   // instant - this is what makes dragging feel immediate
      notify(next);  // at most one parent update per frame
    },
    [paint, notify]
  );

  const endDrag = useCallback(
    (e) => {
      // A single release fires twice: once on the input's own pointerup and
      // again on the window listener (React state updates are async, so the
      // listener is still attached for the same event). The gesture flag makes
      // the second call a no-op so the commit cannot run twice.
      if (!gestureRef.current) return;
      gestureRef.current = false;
      const next = e && e.target && e.target.value !== undefined ? Number(e.target.value) : Number(inputRef.current?.value ?? value);
      dragValueRef.current = null;
      setDragging(false);
      commit(next);
    },
    [commit, value]
  );

  const handlePointerDown = useCallback(() => {
    if (disabled) return;
    gestureRef.current = true;
    dragValueRef.current = Number(inputRef.current?.value ?? value);
    setDragging(true);
  }, [disabled, value]);

  // Arrow keys, Home/End and PageUp/PageDown arrive from the native input and
  // never start a pointer gesture, so they must commit independently of the
  // gesture flag. This is the keyboard path WCAG 2.2 AA requires alongside
  // dragging.
  const handleKeyUp = useCallback(
    (e) => {
      if (gestureRef.current) return;
      commit(Number(e.target.value));
    },
    [commit]
  );

  // If the pointer is released anywhere (outside the slider, or the window
  // loses focus mid-drag) the visual must not be left stuck in drag state.
  useEffect(() => {
    if (!dragging) return undefined;
    const release = () => endDrag();
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [dragging, endDrag]);

  useEffect(() => {
    if (disabled && dragging) {
      gestureRef.current = false;
      dragValueRef.current = null;
      setDragging(false);
      flush();
    }
  }, [disabled, dragging, flush]);

  const zoneBackground = useMemo(() => {
    if (!zones || !zones.length) return null;
    const stops = [];
    zones.forEach((z) => {
      const c = ZONE_COLOR[z.tone] || ZONE_COLOR.neutral;
      stops.push(`${c} ${Math.round(z.from * 100)}%`, `${c} ${Math.round(z.to * 100)}%`);
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [zones]);

  const ticks = useMemo(() => {
    if (!zones || zones.length < 2) return [];
    return zones.slice(1).map((z) => z.from).filter((f) => f > 0.01 && f < 0.99);
  }, [zones]);

  // Which safety zone the current value sits in, so the thumb can adopt the
  // zone's tone (red = fast/risky, amber = balanced, green = slow/safest).
  const activeTone = useMemo(() => {
    if (!zones || !zones.length) return null;
    const t = toT(value);
    const hit = zones.find((z) => t >= z.from && t <= z.to);
    return (hit && hit.tone) || null;
  }, [zones, value, toT]);

  return (
    <div className={cn('px-slider group w-full', className)}>
      {/* One positioning context for the entire control.
          `.px-slider-track` is `position: relative`, so the input, the rail, the
          fill, the thumb and the bubble are all measured against the SAME box.
          That is what makes a click land on the painted track. */}
      <div
        ref={trackRef}
        className="px-slider-track"
        data-dragging={dragging ? 'true' : 'false'}
        data-disabled={disabled ? 'true' : 'false'}
        data-zone={activeTone || undefined}
        style={styleRef.current}
      >
        {/* Interaction + accessibility layer FIRST, so the `~` selectors that
            style focus/drag state on the visual layers actually resolve.
            Transparent, but real: retains native pointer capture, touch and
            screen-reader behaviour. */}
        <input
          ref={setInputRef}
          id={id}
          type="range"
          className="px-slider-input"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleInput}
          onPointerDown={handlePointerDown}
          onPointerUp={endDrag}
          onKeyUp={handleKeyUp}
          onBlur={() => { if (dragValueRef.current !== null) endDrag(); }}
          aria-label={label}
          aria-valuetext={valueText}
          aria-describedby={ariaDescribedBy}
          {...props}
        />

        <div className="px-slider-rail" />
        <div className="px-slider-fill" />
        {zoneBackground && <div className="px-slider-zones" style={{ background: zoneBackground }} aria-hidden="true" />}
        {ticks.map((t) => (
          <span key={t} className="px-slider-tick" style={{ left: `${t * 100}%` }} aria-hidden="true" />
        ))}
        <div className="px-slider-thumb" aria-hidden="true" />
        <div className="px-slider-bubble" aria-hidden="true">
          <span ref={bubbleRef}>{bubbleText}</span>
        </div>
      </div>

      {zoneLabels && (
        <div className="px-slider-legend">
          <span className="px-slider-legend-end">{zoneLabels.left}</span>
          <span className="px-slider-legend-end">{zoneLabels.right}</span>
        </div>
      )}
    </div>
  );
});

export { RangeSlider };
