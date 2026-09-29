import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, SearchX } from 'lucide-react';
import { cn } from './cn';

const VIEWPORT_PAD = 8;
const PANEL_GAP = 6;
const MIN_PANEL_WIDTH = 200;

const getOptionValue = (opt) => (typeof opt === 'string' ? opt : (opt?.value ?? opt));
const getOptionLabel = (opt) => (typeof opt === 'string' ? opt : (opt?.label ?? opt?.value ?? ''));

/**
 * Pure geometry for the portaled panel.
 *
 * Decides whether the panel opens below or above the trigger, clamps it inside
 * the viewport horizontally, and returns the size limits the panel should use.
 * Extracted so the collision rules can be tested without a DOM.
 */
export function computeDropdownPosition({ triggerRect, panelWidth, panelHeight, viewport }) {
  const vh = viewport.height;
  const vw = viewport.width;

  const spaceBelow = vh - triggerRect.bottom - PANEL_GAP;
  const spaceAbove = triggerRect.top - PANEL_GAP;

  // Flip above the trigger when the natural panel would overflow the bottom
  // and there is more room above than below.
  const placement = panelHeight > spaceBelow && spaceAbove > spaceBelow ? 'above' : 'below';
  const maxHeight = Math.max(120, placement === 'above' ? spaceAbove : spaceBelow);
  // Height actually used after clamping — required so an "above" panel sits
  // flush against the trigger instead of floating a gap away from it.
  const finalHeight = Math.min(panelHeight, maxHeight);

  const left = Math.min(
    Math.max(VIEWPORT_PAD, triggerRect.left),
    Math.max(VIEWPORT_PAD, vw - panelWidth - VIEWPORT_PAD),
  );
  const top = placement === 'above'
    ? triggerRect.top - finalHeight - PANEL_GAP
    : triggerRect.bottom + PANEL_GAP;

  return { left, top, maxHeight, placement, minWidth: Math.max(triggerRect.width, MIN_PANEL_WIDTH) };
}

/**
 * Accessible custom dropdown rendered in a body-level portal.
 *
 * The panel is portaled so it escapes ancestor `overflow: hidden` / stacking
 * contexts (the history filter bar and the results table both clip content),
 * and it is positioned with fixed coordinates derived from the trigger rect so
 * it flips above the trigger when there is no room below and never overflows
 * the viewport horizontally.
 */
export function CustomDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  searchable = false,
  className = '',
  optionRender,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState(null); // { left, top, minWidth, maxHeight, placement }

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const listboxId = useId();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => getOptionLabel(opt).toLowerCase().includes(term));
  }, [options, search]);

  const close = useCallback(({ restoreFocus = true } = {}) => {
    setOpen(false);
    setSearch('');
    setActiveIndex(-1);
    setCoords(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback((preferredIndex) => {
    setOpen(true);
    // The panel is rendered at its natural height on this first pass (no
    // maxHeight applied) so it can be measured honestly, then clamped to the
    // available space — that is what makes the flip-above decision correct.
    setCoords({ left: 0, top: 0, minWidth: undefined, maxHeight: undefined, placement: 'below' });
    setActiveIndex(typeof preferredIndex === 'number' ? preferredIndex : -1);
  }, []);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const next = computeDropdownPosition({
      triggerRect: trigger.getBoundingClientRect(),
      panelWidth: panel.offsetWidth,
      panelHeight: panel.offsetHeight,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });

    setCoords((prev) => {
      if (
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.minWidth === next.minWidth &&
        prev.maxHeight === next.maxHeight
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  // Measure and place the panel as soon as it is in the DOM, then keep it glued
  // to the trigger while the page scrolls or the viewport resizes.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onViewportChange = () => reposition();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (open && searchable) {
      const t = setTimeout(() => searchRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
    if (open) triggerRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      close({ restoreFocus: false });
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const commit = useCallback(
    (val) => {
      onChange(val);
      close();
    },
    [onChange, close],
  );

  const onPanelKeyDown = (e) => {
    const last = filtered.length - 1;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (last < 0 ? -1 : (i + 1 > last ? 0 : i + 1)));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (last < 0 ? -1 : (i - 1 < 0 ? last : i - 1)));
        return;
      case 'Home':
        if (!searchable) {
          e.preventDefault();
          setActiveIndex(last < 0 ? -1 : 0);
        }
        return;
      case 'End':
        if (!searchable) {
          e.preventDefault();
          setActiveIndex(last);
        }
        return;
      case 'Enter':
      case ' ':
        if (activeIndex >= 0 && activeIndex <= last) {
          e.preventDefault();
          commit(getOptionValue(filtered[activeIndex]));
        }
        return;
      case 'Tab':
        close({ restoreFocus: false });
        return;
      default:
    }
  };

  const selectedLabel = optionRender
    ? optionRender(value)
    : (typeof value === 'string' ? value : (value?.label || value?.value || placeholder));

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className={cn('custom-dropdown-trigger', open && 'open')}
      onClick={() => (open ? close({ restoreFocus: false }) : openMenu(-1))}
      onKeyDown={(e) => {
        // Arrow keys both open the menu and drive the highlighted option, so
        // the list stays fully operable while focus sits on the trigger.
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!open) {
            const current = filtered.findIndex((o) => getOptionValue(o) === value);
            openMenu(e.key === 'ArrowDown' ? current + 1 : Math.max(0, current));
            return;
          }
        }
        if (open) onPanelKeyDown(e);
      }}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-label={ariaLabel}
    >
      <span className="truncate">{selectedLabel || placeholder}</span>
      <ChevronDown className="chevron" size={14} />
    </button>
  );

  return (
    <div className={cn('custom-dropdown relative inline-block', className)}>
      {trigger}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            // `history-page` keeps the existing design language scoped rules
            // applying to the portaled panel; `custom-dropdown-portal` resets
            // the box so fixed coordinates from the trigger rect are used.
            className={cn('history-page custom-dropdown-portal', className)}
            style={{
              position: 'fixed',
              left: coords?.left ?? 0,
              top: coords?.top ?? 0,
              zIndex: 99999,
              // Keep the panel out of the a11y/tab flow until placed.
              visibility: coords ? 'visible' : 'hidden',
            }}
            onKeyDown={onPanelKeyDown}
          >
            <div
              ref={panelRef}
              className="custom-dropdown-panel"
              style={{
                // Never narrower than the trigger, never wider than the
                // viewport, and tall enough for the content until it is clamped
                // to the space actually available in the chosen direction.
                width: 'max-content',
                minWidth: coords?.minWidth,
                maxWidth: 'calc(100vw - 16px)',
                maxHeight: coords?.maxHeight,
              }}
            >
              {searchable && (
                <div className="custom-dropdown-search">
                  <Search className="search-icon" size={14} />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        close();
                      }
                    }}
                    aria-label="Filter options"
                    aria-controls={listboxId}
                    aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
                  />
                </div>
              )}
              <div
                ref={listRef}
                className="custom-dropdown-options"
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel || placeholder}
                aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
                tabIndex={-1}
              >
                {filtered.length === 0 ? (
                  <div className="custom-dropdown-empty">
                    <SearchX size={18} className="text-text-muted" />
                    <span>No matching options</span>
                  </div>
                ) : (
                  filtered.map((opt, idx) => {
                    const val = getOptionValue(opt);
                    const isSelected = val === value;
                    return (
                      <div
                        key={`${val}-${idx}`}
                        id={`${listboxId}-${idx}`}
                        data-index={idx}
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          'custom-dropdown-option',
                          isSelected && 'selected',
                          idx === activeIndex && 'active',
                        )}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => commit(val)}
                      >
                        <Check className="check-icon" size={16} />
                        <span className="option-label">
                          {optionRender ? optionRender(opt) : getOptionLabel(opt)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
