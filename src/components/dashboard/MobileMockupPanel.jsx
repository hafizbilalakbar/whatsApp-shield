/**
 * MobileMockupPanel.jsx
 *
 * Rebuilt Live Lead Preview & iPhone Pro Max Mockup:
 * - Fixed 440 x 956 px design size with auto-scaling container (never reflows).
 * - Authentic iOS dark & light design system with titanium frame presets.
 * - Parses and masks phone numbers using libphonenumber-js (+1 (305) 558-••49).
 * - Real data only: displays Discovered, Business, Remaining stats, real chips,
 *   real profile photos with 1.5s decode timeout and iOS silhouette fallback.
 * - Local SVG country flag in header subtitle (country shown once).
 * - Full appearance customization: Finish, Theme, Accent, Intensity, Campaign Title.
 * - Test fixture integration (?mockLeads=1) for dev testing with 1 vs 20+ leads.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Smartphone, X, Palette, Sparkles, Database, Check } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { cn } from '../ui/cn';
import { IosDeviceFrame } from './mockup/IosDeviceFrame';
import { MockupAppearanceDrawer } from './mockup/MockupAppearanceDrawer';
import { DEV_MOCK_LEADS, isDevMockEnabled } from './mockup/devMockLeads';

const SETTINGS_KEY = 'whatsapp-shield-mockup-settings';

const DEFAULT_SETTINGS = {
  finish: 'graphite',
  theme: 'dark',
  accentColor: '#0A84FF',
  intensity: 'balanced',
  campaignTitle: 'Lead Finder'
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
  const [devMockMode, setDevMockMode] = useState(() => isDevMockEnabled() ? 'all' : 'off'); // 'off' | 'single' | 'all'
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

  // Determine active leads based on live scan vs dev mock test mode
  const activeLeads = useMemo(() => {
    if (import.meta.env.DEV && devMockMode !== 'off') {
      if (devMockMode === 'single') {
        return [DEV_MOCK_LEADS[0]];
      }
      return DEV_MOCK_LEADS;
    }
    return liveRegisteredLeads;
  }, [devMockMode, liveRegisteredLeads]);

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

  if (!isOpen) return null;

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
          '0 0 0 1px rgba(255, 255, 255, 0.06)',
          'inset 0 1px 0 rgba(255, 255, 255, 0.08)'
        ].join(', '),
        animation: 'mockupPanelIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both'
      }}
    >
      {/* Panel Top Navigation Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-black/40 backdrop-blur-md shrink-0 z-20">
        {/* Title & Live Status */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <Smartphone size={13} className="text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white leading-tight">Live Mobile Preview</span>
              {isScanning && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                  title="Scanning active"
                />
              )}
            </div>
            <span className="text-[10px] text-white/40 block leading-none mt-0.5">
              iPhone 18 Pro Max • {settings.finish}
            </span>
          </div>
        </div>

        {/* Toolbar Actions (Dev Switcher, Appearance, Close) */}
        <div className="flex items-center gap-1.5">
          {/* Dev Test Data Switcher (Only in DEV) */}
          {import.meta.env.DEV && (
            <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5 mr-1">
              <button
                onClick={() => setDevMockMode('off')}
                title="Use real live scan data"
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                  devMockMode === 'off' ? 'bg-emerald-500/25 text-emerald-300' : 'text-white/40 hover:text-white'
                )}
              >
                Live
              </button>
              <button
                onClick={() => setDevMockMode('single')}
                title="Test with 1 lead fixture"
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                  devMockMode === 'single' ? 'bg-emerald-500/25 text-emerald-300' : 'text-white/40 hover:text-white'
                )}
              >
                1 Lead
              </button>
              <button
                onClick={() => setDevMockMode('all')}
                title="Test with 20+ leads fixture"
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                  devMockMode === 'all' ? 'bg-emerald-500/25 text-emerald-300' : 'text-white/40 hover:text-white'
                )}
              >
                20+ Leads
              </button>
            </div>
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
          accentColor={settings.accentColor}
          intensity={settings.intensity}
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
