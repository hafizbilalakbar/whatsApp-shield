import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Smartphone,
  X,
  Palette,
  Eraser,
  RotateCcw,
  Sparkles,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { cn } from '../ui/cn';
import { IosDeviceFrame } from './mockup/IosDeviceFrame';
import { MockupAppearanceDrawer } from './mockup/MockupAppearanceDrawer';
import {
  DEV_MOCK_LEADS,
  SINGLE_STATE_LEADS,
  MULTI_STATE_LEADS,
  MULTI_COUNTRY_LEADS,
  NO_LOCATION_LEADS,
  isDevMockEnabled
} from './mockup/devMockLeads';

const SETTINGS_KEY = 'whatsapp-shield-mockup-settings';

const DEFAULT_SETTINGS = {
  finish: 'graphite',
  wallpaper: 'aurora',
  theme: 'dark',
  accentColor: '#0A84FF',
  intensity: 'balanced',
  campaignTitle: 'Lead Finder',
  autoClearDelay: 6000
};

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export default function MobileMockupPanel({ isOpen, onClose }) {
  const { resultsList, scanState, progressPercent, totalToCheck } = useWebSocket();
  const [settings, setSettings] = useState(loadSavedSettings);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [devMockMode, setDevMockMode] = useState(() => (isDevMockEnabled() ? 'singlestate' : 'off'));
  
  // Task 2: Photos Filter Segmented Control ('all' | 'photos')
  const [photoFilter, setPhotoFilter] = useState('all');
  const [loadedPhotosSet, setLoadedPhotosSet] = useState(() => new Set());

  // Task 4 & 5: View Mode & Clear State
  const [viewMode, setViewMode] = useState('app'); // 'app' | 'home'
  const [clearedAt, setClearedAt] = useState(null);
  const autoClearTimerRef = useRef(null);

  const frameRef = useRef(null);

  // Synchronize settings with localStorage
  const handleUpdateSettings = useCallback((newSettings) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch (e) {
        /* ignore */
      }
      return updated;
    });
  }, []);

  // Track decoded photos (Task 2)
  const handlePhotoLoaded = useCallback((id, success) => {
    setLoadedPhotosSet((prev) => {
      const next = new Set(prev);
      if (success) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  // Map real scanned leads from WebSocket resultsList
  const liveRegisteredLeads = useMemo(() => {
    return resultsList
      .filter((r) => r.exists === true)
      .map((r, i) => ({
        ...r,
        discoveredAt: r.discoveredAt || r.timestamp || (Date.now() - (resultsList.length - i) * 1200)
      }))
      .reverse(); // Newest first
  }, [resultsList]);

  // Determine active leads based on live scan vs dev mock test mode & clear filter
  const rawActiveLeads = useMemo(() => {
    if (import.meta.env.DEV && devMockMode !== 'off') {
      if (devMockMode === 'singlestate') return SINGLE_STATE_LEADS;
      if (devMockMode === 'multistate') return MULTI_STATE_LEADS;
      if (devMockMode === 'multicountry') return MULTI_COUNTRY_LEADS;
      if (devMockMode === 'nolocation') return NO_LOCATION_LEADS;
      if (devMockMode === 'single') return [SINGLE_STATE_LEADS[0]];
      return DEV_MOCK_LEADS;
    }
    return liveRegisteredLeads;
  }, [devMockMode, liveRegisteredLeads]);

  // Apply clearedAt filter without modifying real data
  const activeLeads = useMemo(() => {
    if (clearedAt && viewMode === 'app') {
      return rawActiveLeads.filter((l) => (l.discoveredAt || 0) > clearedAt);
    }
    return rawActiveLeads;
  }, [rawActiveLeads, clearedAt, viewMode]);

  const activeProgress = useMemo(() => {
    if (import.meta.env.DEV && devMockMode !== 'off') {
      return devMockMode === 'single' ? 12 : 78;
    }
    return progressPercent || 0;
  }, [devMockMode, progressPercent]);

  const activeTotal = useMemo(() => {
    if (import.meta.env.DEV && devMockMode !== 'off') {
      return devMockMode === 'single' ? 50 : 250;
    }
    return totalToCheck || 0;
  }, [devMockMode, totalToCheck]);

  const activeChecked = useMemo(() => {
    if (import.meta.env.DEV && devMockMode !== 'off') {
      return devMockMode === 'single' ? 6 : 195;
    }
    return resultsList.length;
  }, [devMockMode, resultsList.length]);

  const isScanning = scanState === 'SCANNING' || scanState === 'STARTING' || scanState === 'RESUMING';

  // Task 4: Auto-Clear and Launch triggers
  // 1. When a new scan starts, auto-launch into app screen and clear marker
  useEffect(() => {
    if (isScanning) {
      setViewMode('app');
      setClearedAt(null);
      if (autoClearTimerRef.current) {
        clearTimeout(autoClearTimerRef.current);
        autoClearTimerRef.current = null;
      }
    }
  }, [isScanning]);

  // 2. When scan completes, hold for autoClearDelay, then transition to Home Screen
  useEffect(() => {
    if (scanState === 'COMPLETED') {
      const delay = settings.autoClearDelay ?? 6000;
      if (delay > 0) {
        autoClearTimerRef.current = setTimeout(() => {
          setViewMode('home');
        }, delay);
      }
    } else {
      if (autoClearTimerRef.current) {
        clearTimeout(autoClearTimerRef.current);
        autoClearTimerRef.current = null;
      }
    }
    return () => {
      if (autoClearTimerRef.current) {
        clearTimeout(autoClearTimerRef.current);
      }
    };
  }, [scanState, settings.autoClearDelay]);

  // Manual Clear Handler
  const handleManualClear = useCallback(() => {
    setClearedAt(Date.now());
    setViewMode('home');
  }, []);

  // Restore previous view Handler
  const handleRestoreView = useCallback(() => {
    setClearedAt(null);
    setViewMode('app');
  }, []);

  if (!isOpen) return null;

  const isTestModeActive = import.meta.env.DEV && devMockMode !== 'off';

  return (
    <div
      className="fixed right-4 bottom-20 z-[9999] flex flex-col overflow-hidden"
      style={{
        width: 'min(480px, calc(100vw - 32px))',
        height: 'min(940px, calc(100dvh - 100px))',
        borderRadius: 24,
        background: 'linear-gradient(145deg, #101522 0%, #080B12 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: [
          '0 30px 90px rgba(0, 0, 0, 0.85)',
          '0 0 0 1px rgba(255, 255, 255, 0.08)',
          '0 12px 36px rgba(0, 217, 126, 0.08)'
        ].join(', ')
      }}
    >
      {/* Panel Top Navigation Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.02] shrink-0 select-none gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <Smartphone size={13} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white leading-tight truncate">Live Mobile Preview</span>
              {isTestModeActive && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider shrink-0">
                  TEST DATA
                </span>
              )}
              {isScanning && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                  title="Scanning active"
                />
              )}
            </div>
            <span className="text-[10px] text-white/40 block leading-none mt-0.5 truncate">
              iPhone 18 Pro Max • {viewMode === 'home' ? 'Home Screen' : settings.finish}
            </span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Task 2: Segmented Control [ All | Photos ] */}
          <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
            <button
              onClick={() => setPhotoFilter('all')}
              title="Show all discovered leads"
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-semibold transition-all',
                photoFilter === 'all'
                  ? 'bg-emerald-500/25 text-emerald-300 shadow-sm'
                  : 'text-white/50 hover:text-white'
              )}
            >
              All
            </button>
            <button
              onClick={() => setPhotoFilter('photos')}
              title="Show only leads with decoded profile photos"
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1',
                photoFilter === 'photos'
                  ? 'bg-emerald-500/25 text-emerald-300 shadow-sm'
                  : 'text-white/50 hover:text-white'
              )}
            >
              <ImageIcon size={10} /> Photos
            </button>
          </div>

          {/* Task 4: Clear / Restore View Button */}
          {viewMode === 'app' ? (
            <button
              onClick={handleManualClear}
              title="Clear phone screen to Home Screen"
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[10px] font-semibold flex items-center gap-1 transition-all"
            >
              <Eraser size={11} /> Clear
            </button>
          ) : (
            <button
              onClick={handleRestoreView}
              title="Show last scan results"
              className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 transition-all"
            >
              <RotateCcw size={11} /> Restore
            </button>
          )}

          {/* Appearance Settings Trigger */}
          <button
            onClick={() => setIsAppearanceOpen((prev) => !prev)}
            title="Appearance & Theme Settings"
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center border transition-all',
              isAppearanceOpen
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            )}
          >
            <Palette size={13} />
          </button>

          {/* Close Panel Button */}
          <button
            onClick={onClose}
            title="Close Preview Panel"
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Dev Test Data Switcher Bar (Task 3: Dev-only, ?mockLeads=1) */}
      {import.meta.env.DEV && isDevMockEnabled() && (
        <div className="flex items-center justify-between px-3 py-1 bg-amber-500/10 border-b border-amber-500/20 text-[10px] select-none">
          <span className="font-bold text-amber-300/80">Dev Test Scenarios:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setDevMockMode('singlestate'); setViewMode('app'); }}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                devMockMode === 'singlestate' ? 'bg-amber-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
              )}
            >
              1-State
            </button>
            <button
              onClick={() => { setDevMockMode('multistate'); setViewMode('app'); }}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                devMockMode === 'multistate' ? 'bg-amber-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
              )}
            >
              Multi-State
            </button>
            <button
              onClick={() => { setDevMockMode('multicountry'); setViewMode('app'); }}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                devMockMode === 'multicountry' ? 'bg-amber-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
              )}
            >
              Countries
            </button>
            <button
              onClick={() => { setDevMockMode('nolocation'); setViewMode('app'); }}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                devMockMode === 'nolocation' ? 'bg-amber-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
              )}
            >
              No Geo
            </button>
            <button
              onClick={() => { setDevMockMode('off'); }}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                devMockMode === 'off' ? 'bg-emerald-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
              )}
            >
              Live
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport: Autoscaling iPhone Container */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 relative bg-gradient-to-b from-black/20 to-black/60 overflow-hidden">
        <IosDeviceFrame
          leads={activeLeads}
          scanState={scanState}
          progressPercent={activeProgress}
          totalToCheck={activeTotal}
          checkedCount={activeChecked}
          campaignTitle={settings.campaignTitle}
          theme={settings.theme}
          finish={settings.finish}
          wallpaper={settings.wallpaper}
          accentColor={settings.accentColor}
          intensity={settings.intensity}
          viewMode={viewMode}
          onLaunchApp={() => setViewMode('app')}
          photoFilter={photoFilter}
          loadedPhotosSet={loadedPhotosSet}
          onPhotoLoaded={handlePhotoLoaded}
          frameRef={frameRef}
        />

        {/* Slide-up Appearance Customizer Drawer */}
        <MockupAppearanceDrawer
          isOpen={isAppearanceOpen}
          onClose={() => setIsAppearanceOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      </div>
    </div>
  );
}

/**
 * Floating trigger button (Outside layout, anchored at bottom-right)
 */
export function MobileMockupTrigger({ isOpen, onClick, isScanning, leadCount }) {
  return (
    <button
      onClick={onClick}
      title={isOpen ? 'Close Live Mobile Preview' : 'Open Live Mobile Preview'}
      aria-label={isOpen ? 'Close Live Mobile Preview' : 'Open Live Mobile Preview'}
      className={cn(
        'fixed bottom-6 right-6 z-[9998]',
        'flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl',
        'border transition-all duration-300 select-none shadow-2xl',
        'backdrop-blur-xl',
        isOpen
          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.25)]'
          : 'bg-[#0e1422]/95 border-white/15 text-white/75 hover:text-white hover:border-white/30 hover:scale-105'
      )}
    >
      <div className="relative flex items-center justify-center">
        <Smartphone size={16} className={isOpen ? 'text-emerald-300' : 'text-white/80'} />
        {isScanning && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        )}
      </div>
      <span className="text-xs font-bold tracking-wide whitespace-nowrap">
        {isOpen ? 'Close Preview' : 'Live Phone Preview'}
      </span>
      {leadCount > 0 && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          {leadCount}
        </span>
      )}
    </button>
  );
}
