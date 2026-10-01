import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  X,
  Palette,
  Eraser,
  RotateCcw,
  Image as ImageIcon,
  Video,
  Download,
  Play,
  Pause as PauseIcon,
  Square,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Film,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { cn } from '../ui/cn';
import { IosDeviceFrame } from './mockup/IosDeviceFrame';
import { MockupAppearanceDrawer } from './mockup/MockupAppearanceDrawer';
import { MockupErrorBoundary } from './mockup/MockupErrorBoundary';
import { detectLeadLocation } from '../../utils/geoLookup';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
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
  autoClearDelay: 6000,
  autoStartVideo: true
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

/**
 * Generate safe, sanitized download filename based on real campaign data
 */
function generateVideoFilename(leads = []) {
  const dateStr = new Date().toISOString().split('T')[0];
  if (!leads || leads.length === 0) {
    return `lead-finder_${dateStr}.mp4`;
  }

  const distinctCountries = new Set();
  const distinctLocations = new Set();

  for (const lead of leads) {
    if (!lead) continue;
    const raw = String(lead.number || lead.phone || lead.cleanNumber || '').trim();
    if (raw) {
      try {
        const full = raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
        const parsed = parsePhoneNumberFromString(full);
        if (parsed?.country) {
          distinctCountries.add(parsed.country.toLowerCase());
        }
      } catch (e) {
        /* ignore */
      }
    }
    try {
      const loc = detectLeadLocation(lead);
      if (loc) distinctLocations.add(loc.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    } catch (e) {
      /* ignore */
    }
  }

  let geoPart = 'general';
  if (distinctCountries.size > 1) {
    geoPart = 'multiple-countries';
  } else {
    const country = Array.from(distinctCountries)[0] || 'united-states';
    const countrySlug = country === 'us' ? 'united-states' : country;
    const states = Array.from(distinctLocations);
    if (states.length === 1) {
      geoPart = `${countrySlug}_${states[0]}`;
    } else if (states.length === 2) {
      geoPart = `${countrySlug}_${states[0]}-${states[1]}`;
    } else if (states.length >= 3) {
      geoPart = `${countrySlug}_${states.length}-states`;
    } else {
      geoPart = countrySlug;
    }
  }

  const sanitized = `lead-finder_${geoPart}_${dateStr}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_');

  return `${sanitized}.mp4`;
}

// ── Video Export Sub-panel ──────────────────────────────────────────

function VideoExportPanel({
  videoContent,
  onVideoContent,
  renderState,
  renderProgress,
  stageText,
  videoUrl,
  errorMessage,
  onStartRender,
  onCancelRender,
  onDownload,
  isExpanded,
  onToggle,
  hasPhotoLeads,
  leadCount,
  autoCountdown,
  onCancelAutoCountdown,
  leads = []
}) {
  const isRendering = renderState === 'rendering';
  const isDone = renderState === 'done';
  const isError = renderState === 'error';
  const canRender = leadCount > 0 && !isRendering;

  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setIsPlaying(false);
  };

  const handleReplay = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  };

  return (
    <div
      className="border-t border-white/10 shrink-0"
      style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
    >
      {/* Auto-start 3s Countdown Banner */}
      {autoCountdown !== null && autoCountdown > 0 && renderState === 'idle' && (
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-violet-500/20 border-b border-violet-500/30 text-[10px] text-violet-200 select-none animate-pulse">
          <div className="flex items-center gap-1.5">
            <Film size={12} className="text-violet-300" />
            <span>Generating video in <strong>{autoCountdown}s</strong>…</span>
          </div>
          <button
            type="button"
            onClick={onCancelAutoCountdown}
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-semibold text-[9px] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Collapsible Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-white/[0.03] transition-colors group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-violet-500/15 border border-violet-500/25">
            <Film size={11} className="text-violet-400" />
          </div>
          <span className="text-[11px] font-bold text-white/70 group-hover:text-white/90 transition-colors tracking-wide uppercase">
            Video Export
          </span>
          {isDone && (
            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
              <CheckCircle2 size={8} /> Ready
            </span>
          )}
          {isRendering && (
            <span className="text-[9px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
              {Math.round(renderProgress)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDone && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold hover:bg-emerald-500/30 transition-colors"
              title="Download MP4"
            >
              <Download size={10} /> MP4
            </button>
          )}
          {isExpanded ? (
            <ChevronUp size={13} className="text-white/40" />
          ) : (
            <ChevronDown size={13} className="text-white/40" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3.5 pb-3 space-y-2.5">
          {/* 1. Video Content Choice Card */}
          {renderState !== 'done' && (
            <div>
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                Video Content
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {/* All Leads */}
                <button
                  type="button"
                  onClick={() => onVideoContent('all')}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-xl border text-left transition-all',
                    videoContent === 'all'
                      ? 'bg-violet-500/15 border-violet-500/40 shadow-[0_0_0_1px_rgba(139,92,246,0.2)]'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  )}
                >
                  <div className={cn(
                    'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0',
                    videoContent === 'all' ? 'border-violet-400 bg-violet-400' : 'border-white/30'
                  )}>
                    {videoContent === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className={cn('text-[11px] font-semibold leading-tight', videoContent === 'all' ? 'text-violet-200' : 'text-white/70')}>
                      All Leads
                    </div>
                    <div className="text-[9.5px] text-white/35 mt-0.5 leading-tight">
                      All {leads.length} contacts
                    </div>
                  </div>
                </button>

                {/* Photos Only */}
                <button
                  type="button"
                  onClick={() => hasPhotoLeads && onVideoContent('photos')}
                  disabled={!hasPhotoLeads}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-xl border text-left transition-all',
                    !hasPhotoLeads && 'opacity-40 cursor-not-allowed',
                    videoContent === 'photos' && hasPhotoLeads
                      ? 'bg-violet-500/15 border-violet-500/40 shadow-[0_0_0_1px_rgba(139,92,246,0.2)]'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  )}
                >
                  <div className={cn(
                    'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0',
                    videoContent === 'photos' && hasPhotoLeads ? 'border-violet-400 bg-violet-400' : 'border-white/30'
                  )}>
                    {videoContent === 'photos' && hasPhotoLeads && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className={cn('text-[11px] font-semibold leading-tight', videoContent === 'photos' && hasPhotoLeads ? 'text-violet-200' : 'text-white/70')}>
                      Photos Only
                    </div>
                    <div className="text-[9.5px] text-white/35 mt-0.5 leading-tight">
                      {hasPhotoLeads ? 'With avatar' : 'No photos loaded'}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 2. Render Progress Bar */}
          {(isRendering || isError) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-white/50 truncate max-w-[240px]">
                  {stageText || (isRendering ? 'Rendering video…' : 'Failed')}
                </span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[10px] font-bold tabular-nums',
                    isError ? 'text-red-400' : 'text-violet-300'
                  )}>
                    {isError ? '!' : `${Math.round(renderProgress)}%`}
                  </span>
                  {isRendering && (
                    <button
                      type="button"
                      onClick={onCancelRender}
                      className="text-[9px] text-white/40 hover:text-white px-1.5 py-0.2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    isError ? 'bg-red-500' : 'bg-violet-500'
                  )}
                  style={{ width: `${isRendering ? renderProgress : 0}%` }}
                />
              </div>
              {isError && errorMessage && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-400">
                  <AlertCircle size={10} />
                  <span className="truncate">{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* 3. Preview Player with Controls */}
          {isDone && videoUrl && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black relative group">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  playsInline
                  loop
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full"
                  style={{ maxHeight: '140px', objectFit: 'contain', display: 'block' }}
                />
              </div>

              {/* Player Control Bar: Play / Pause / Stop / Replay */}
              <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-white/70">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="p-1 rounded-lg hover:bg-white/10 text-white transition-colors"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <PauseIcon size={12} /> : <Play size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleStop}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                    title="Stop"
                  >
                    <Square size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={handleReplay}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                    title="Replay"
                  >
                    <RotateCw size={11} />
                  </button>
                </div>

                <span className="text-[9.5px] text-white/40 font-mono">
                  1080x1920 • 30fps • MP4
                </span>
              </div>
            </div>
          )}

          {/* 4. Action Row */}
          <div className="flex items-center gap-2 pt-0.5">
            {renderState === 'done' ? (
              <>
                <button
                  type="button"
                  onClick={onDownload}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-[0_2px_12px_rgba(16,185,129,0.35)] transition-all"
                >
                  <Download size={13} /> Download Video
                </button>
                <button
                  type="button"
                  onClick={onStartRender}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-[11px] font-semibold transition-all"
                  title="Regenerate"
                >
                  <RotateCw size={12} /> Regenerate
                </button>
              </>
            ) : isError ? (
              <button
                type="button"
                onClick={onStartRender}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-all"
              >
                <RotateCw size={12} /> Retry Render
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartRender}
                disabled={!canRender}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all',
                  canRender
                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_2px_12px_rgba(139,92,246,0.35)]'
                    : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
                )}
              >
                {isRendering ? (
                  <>
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Rendering…
                  </>
                ) : (
                  <>
                    <Video size={12} />
                    {leadCount > 0 ? `Create Video (${leadCount} lead${leadCount !== 1 ? 's' : ''})` : 'No leads yet'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main MobileMockupPanel Component ──────────────────────────────────────────

export default function MobileMockupPanel({ isOpen, onClose }) {
  const {
    resultsList = [],
    scanState = 'IDLE',
    progressPercent = 0,
    totalToCheck = 0,
    isConnected,
    isAuthenticated,
    mockupClearedAt,
    clearMockupLeads,
    resetMockupClear
  } = useWebSocket();

  const isOnline = (isConnected && isAuthenticated) || (import.meta.env.DEV && isDevMockEnabled());

  const [settings, setSettings] = useState(loadSavedSettings);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [devMockMode, setDevMockMode] = useState(() => (isDevMockEnabled() ? 'singlestate' : 'off'));

  // Photos Filter Segmented Control ('all' | 'photos')
  const [photoFilter, setPhotoFilter] = useState('all');
  const [loadedPhotosSet, setLoadedPhotosSet] = useState(() => new Set());

  // View Mode & Clear State
  const [viewMode, setViewMode] = useState('app'); // 'app' | 'home'
  const [clearedAt, setClearedAt] = useState(null);

  // Scan Real Timestamps Tracking
  const scanStartedAtRef = useRef(null);
  const scanDurationRef = useRef(0);

  // Frozen snapshot when scan transitions to non-live
  const frozenLeadsRef = useRef(null);
  const frozenProgressRef = useRef(null);
  const frozenCheckedRef = useRef(null);
  const frozenScanStateRef = useRef(null);

  // Video Export State
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [videoContent, setVideoContent] = useState('all');
  const [renderState, setRenderState] = useState('idle');
  const [renderProgress, setRenderProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [autoCountdown, setAutoCountdown] = useState(null);
  const abortControllerRef = useRef(null);
  const autoCountdownTimerRef = useRef(null);
  const panelRef = useRef(null);

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

  // Track decoded photos
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
    const list = Array.isArray(resultsList) ? resultsList : [];
    return list
      .filter((r) => r && r.exists === true)
      .map((r, i) => ({
        ...r,
        discoveredAt: r.discoveredAt || r.timestamp || (Date.now() - (list.length - i) * 1200)
      }))
      .reverse(); // Newest first
  }, [resultsList]);

  // Determine active leads based on live scan vs dev mock test mode
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

  // Apply global & local clearedAt filter without modifying real database data
  const effectiveClearedAt = mockupClearedAt || clearedAt;
  const activeLeads = useMemo(() => {
    if (effectiveClearedAt) {
      return rawActiveLeads.filter((l) => (l?.discoveredAt || 0) > effectiveClearedAt);
    }
    return rawActiveLeads;
  }, [rawActiveLeads, effectiveClearedAt]);

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
    return Array.isArray(resultsList) ? resultsList.length : 0;
  }, [devMockMode, resultsList]);

  const isScanning = scanState === 'SCANNING' || scanState === 'STARTING' || scanState === 'RESUMING';
  const isPaused = scanState === 'PAUSED' || scanState === 'CONNECTIVITY_PAUSED';
  const isTerminal = isPaused || scanState === 'COMPLETED' || scanState === 'STOPPED'
    || scanState === 'ERROR' || scanState === 'ANOMALY_STOP';

  // Track scan timestamps
  useEffect(() => {
    if (isScanning) {
      if (!scanStartedAtRef.current) scanStartedAtRef.current = Date.now();
    } else if (scanState === 'COMPLETED' || scanState === 'STOPPED') {
      if (scanStartedAtRef.current) {
        scanDurationRef.current = Date.now() - scanStartedAtRef.current;
      }
    } else if (scanState === 'IDLE') {
      scanStartedAtRef.current = null;
      scanDurationRef.current = 0;
    }
  }, [isScanning, scanState]);

  // Freeze logic & Resume handling
  useEffect(() => {
    if (isScanning) {
      if (renderState === 'rendering') {
        abortControllerRef.current?.abort();
        setRenderState('idle');
        setRenderProgress(0);
      }
      frozenLeadsRef.current = null;
      frozenProgressRef.current = null;
      frozenCheckedRef.current = null;
      frozenScanStateRef.current = null;
      if (autoCountdownTimerRef.current) {
        clearInterval(autoCountdownTimerRef.current);
        setAutoCountdown(null);
      }
    } else if (isTerminal && frozenLeadsRef.current === null) {
      frozenLeadsRef.current = activeLeads;
      frozenProgressRef.current = activeProgress;
      frozenCheckedRef.current = activeChecked;
      frozenScanStateRef.current = scanState;

      if (settings.autoStartVideo !== false && activeLeads.length > 0 && renderState === 'idle') {
        setIsVideoExpanded(true);
        setAutoCountdown(3);
        let count = 3;
        autoCountdownTimerRef.current = setInterval(() => {
          count -= 1;
          if (count <= 0) {
            clearInterval(autoCountdownTimerRef.current);
            setAutoCountdown(null);
            handleStartRender();
          } else {
            setAutoCountdown(count);
          }
        }, 1000);
      }
    }
  }, [isScanning, isTerminal, scanState, activeLeads, activeProgress, activeChecked, settings.autoStartVideo]);

  const displayLeads     = frozenLeadsRef.current    ?? activeLeads;
  const displayProgress  = frozenProgressRef.current ?? activeProgress;
  const displayChecked   = frozenCheckedRef.current  ?? activeChecked;
  const displayScanState = frozenScanStateRef.current ?? scanState;

  // React to global auto-clear events
  useEffect(() => {
    const handleGlobalClear = () => {
      setViewMode('home');
      frozenLeadsRef.current = null;
      frozenProgressRef.current = null;
      frozenCheckedRef.current = null;
      frozenScanStateRef.current = null;
    };
    window.addEventListener('mockup-leads-cleared', handleGlobalClear);
    return () => window.removeEventListener('mockup-leads-cleared', handleGlobalClear);
  }, []);

  // When a new scan begins, restore app view mode
  useEffect(() => {
    if (isScanning) {
      setViewMode('app');
      setClearedAt(null);
    }
  }, [isScanning]);

  // Keyboard accessibility: Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // Manual Clear Leads Handler (Instant reset mockup + counters + cancel video export)
  const handleClearLeads = useCallback(() => {
    if (isScanning) {
      const confirmed = window.confirm('A scan is currently running. Do you want to clear the Live Phone Preview leads?');
      if (!confirmed) return;
    }
    // Cancel in-flight video export if any
    abortControllerRef.current?.abort();
    setRenderState('idle');
    setRenderProgress(0);
    setVideoUrl(null);
    setVideoError(null);
    if (autoCountdownTimerRef.current) {
      clearInterval(autoCountdownTimerRef.current);
      setAutoCountdown(null);
    }
    frozenLeadsRef.current = null;
    frozenProgressRef.current = null;
    frozenCheckedRef.current = null;
    frozenScanStateRef.current = null;

    setClearedAt(Date.now());
    clearMockupLeads?.();
    setViewMode('home');
  }, [isScanning, clearMockupLeads]);

  // Restore previous view Handler
  const handleRestoreView = useCallback(() => {
    setClearedAt(null);
    resetMockupClear?.();
    setViewMode('app');
  }, [resetMockupClear]);

  // Video Export Handlers
  const handleStartRender = useCallback(async () => {
    if (renderState === 'rendering') return;

    if (autoCountdownTimerRef.current) {
      clearInterval(autoCountdownTimerRef.current);
      setAutoCountdown(null);
    }

    const leadsForVideo = videoContent === 'photos'
      ? displayLeads.filter((l) => loadedPhotosSet.has(l?.cleanNumber || l?.number))
      : displayLeads;

    if (!leadsForVideo || leadsForVideo.length === 0) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setRenderState('rendering');
    setRenderProgress(0);
    setStageText('Initializing renderer…');
    setVideoUrl(null);
    setVideoError(null);
    setIsVideoExpanded(true);

    try {
      const { renderLeadVideo } = await import('./mockup/videoRenderer');
      const url = await renderLeadVideo({
        leads: leadsForVideo,
        scanState: displayScanState,
        progressPercent: displayProgress,
        totalToCheck: activeTotal,
        checkedCount: displayChecked,
        campaignTitle: settings.campaignTitle,
        theme: settings.theme,
        accentColor: settings.accentColor,
        intensity: settings.intensity,
        wallpaper: settings.wallpaper,
        finish: settings.finish,
        startedAt: scanStartedAtRef.current || (Date.now() - 15000),
        scanDuration: scanDurationRef.current > 0 ? scanDurationRef.current : 15000,
        onProgress: (pct, stage) => {
          setRenderProgress(pct);
          if (stage) setStageText(stage);
        },
        signal: controller.signal
      });
      setVideoUrl(url);
      setRenderState('done');
      setRenderProgress(100);
      setStageText('Video ready for download');
    } catch (err) {
      if (controller.signal.aborted) {
        setRenderState('idle');
        setRenderProgress(0);
      } else {
        console.error('[VideoRender] Error:', err);
        setVideoError(err?.message || 'Render failed');
        setRenderState('error');
      }
    }
  }, [
    renderState, videoContent, displayLeads, displayScanState,
    displayProgress, displayChecked, activeTotal, loadedPhotosSet,
    settings.campaignTitle, settings.theme, settings.accentColor,
    settings.intensity, settings.wallpaper, settings.finish
  ]);
  const handleCancelRender = useCallback(() => {
    abortControllerRef.current?.abort();
    setRenderState('idle');
    setRenderProgress(0);
  }, []);

  const handleCancelAutoCountdown = useCallback(() => {
    if (autoCountdownTimerRef.current) {
      clearInterval(autoCountdownTimerRef.current);
      setAutoCountdown(null);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const filename = generateVideoFilename(displayLeads);
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = filename;
    a.click();
  }, [videoUrl, displayLeads]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (autoCountdownTimerRef.current) clearInterval(autoCountdownTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, [videoUrl]);

  const hasPhotoLeads = loadedPhotosSet.size > 0;
  const isTestModeActive = import.meta.env.DEV && devMockMode !== 'off';

  // Do not render anything if user is not authenticated/connected
  if (!isOnline) return null;

  return (
    <MockupErrorBoundary onClose={onClose}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            id="live-mobile-mockup-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Live Phone Preview"
            initial={{
              opacity: 0,
              scale: 0.35,
              y: 40,
              filter: 'blur(10px)'
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              filter: 'blur(0px)'
            }}
            exit={{
              opacity: 0,
              scale: 0.35,
              y: 40,
              filter: 'blur(10px)'
            }}
            transition={{
              type: 'spring',
              damping: 27,
              stiffness: 300,
              mass: 0.85
            }}
            className="fixed left-4 sm:left-6 bottom-20 z-[995] flex flex-col overflow-hidden"
            style={{
              transformOrigin: 'bottom left',
              width: 'min(480px, calc(100vw - 32px))',
              height: 'min(940px, calc(100dvh - 100px))',
              maxHeight: 'calc(100dvh - 100px)',
              borderRadius: 24,
              background: 'linear-gradient(145deg, #101522 0%, #080B12 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
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
                    <span className="text-xs font-bold text-white leading-tight truncate">Live Phone Preview</span>
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
                    {isTerminal && frozenLeadsRef.current !== null && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300/80 border border-amber-500/20 shrink-0">
                        Frozen
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/40 block leading-none mt-0.5 truncate">
                    iPhone 18 Pro Max • {viewMode === 'home' ? 'Home Screen' : settings.finish}
                  </span>
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Segmented Control [ All | Photos ] */}
                <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                  <button
                    type="button"
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
                    type="button"
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

                {/* Clear Leads / Restore View Button */}
                {viewMode === 'app' ? (
                  <button
                    type="button"
                    onClick={handleClearLeads}
                    title="Clear Leads from phone preview & reset video export"
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 border border-white/10 text-white/60 hover:text-red-300 text-[10px] font-semibold flex items-center gap-1 transition-all"
                  >
                    <Eraser size={11} /> Clear Leads
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRestoreView}
                    title="Show last scan results"
                    className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 transition-all"
                  >
                    <RotateCcw size={11} /> Restore
                  </button>
                )}

                {/* Appearance Settings Trigger */}
                <button
                  type="button"
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
                  type="button"
                  onClick={onClose}
                  title="Close Preview Panel"
                  aria-label="Close Preview Panel"
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Dev Test Data Switcher Bar */}
            {import.meta.env.DEV && isDevMockEnabled() && (
              <div className="flex items-center justify-between px-3 py-1 bg-amber-500/10 border-b border-amber-500/20 text-[10px] select-none">
                <span className="font-bold text-amber-300/80">Dev Test Scenarios:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setDevMockMode('singlestate'); setViewMode('app'); }}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                      devMockMode === 'singlestate' ? 'bg-amber-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
                    )}
                  >
                    1-State
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDevMockMode('multistate'); setViewMode('app'); }}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                      devMockMode === 'multistate' ? 'bg-amber-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
                    )}
                  >
                    Multi-State
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDevMockMode('multicountry'); setViewMode('app'); }}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                      devMockMode === 'multicountry' ? 'bg-amber-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
                    )}
                  >
                    Countries
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDevMockMode('nolocation'); setViewMode('app'); }}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                      devMockMode === 'nolocation' ? 'bg-amber-400 text-black' : 'bg-black/30 text-white/60 hover:text-white'
                    )}
                  >
                    No Geo
                  </button>
                  <button
                    type="button"
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
                leads={displayLeads}
                scanState={displayScanState}
                progressPercent={displayProgress}
                totalToCheck={activeTotal}
                checkedCount={displayChecked}
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
              />

              {/* Slide-up Appearance Customizer Drawer */}
              <MockupAppearanceDrawer
                isOpen={isAppearanceOpen}
                onClose={() => setIsAppearanceOpen(false)}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            </div>

            {/* Video Export Panel */}
            <VideoExportPanel
              videoContent={videoContent}
              onVideoContent={setVideoContent}
              renderState={renderState}
              renderProgress={renderProgress}
              stageText={stageText}
              videoUrl={videoUrl}
              errorMessage={videoError}
              onStartRender={handleStartRender}
              onCancelRender={handleCancelRender}
              onDownload={handleDownload}
              isExpanded={isVideoExpanded}
              onToggle={() => setIsVideoExpanded((v) => !v)}
              hasPhotoLeads={hasPhotoLeads}
              leadCount={displayLeads.length}
              autoCountdown={autoCountdown}
              onCancelAutoCountdown={handleCancelAutoCountdown}
              leads={displayLeads}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MockupErrorBoundary>
  );
}

/**
 * Floating trigger button anchored at bottom-LEFT
 */
export function MobileMockupTrigger({ isOpen, onClick, isScanning, leadCount }) {
  const { isConnected, isAuthenticated } = useWebSocket();
  const isOnline = (isConnected && isAuthenticated) || (import.meta.env.DEV && isDevMockEnabled());
  const triggerRef = useRef(null);

  // Return focus to trigger when closing mockup
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  if (!isOnline) return null;

  return (
    <motion.button
      ref={triggerRef}
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-expanded={isOpen}
      aria-controls="live-mobile-mockup-panel"
      aria-label={isOpen ? 'Close Live Mobile Preview' : 'Open Live Phone Preview'}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'fixed bottom-6 left-4 sm:left-6 z-[990]',
        'flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl',
        'border transition-all duration-300 select-none shadow-2xl',
        'backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
        isOpen
          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.25)]'
          : 'bg-[#0e1422]/95 border-white/15 text-white/80 hover:text-white hover:border-white/30 hover:scale-105'
      )}
    >
      <div className="relative flex items-center justify-center">
        <Smartphone size={16} className={isOpen ? 'text-emerald-300' : 'text-emerald-400'} />
        {isScanning && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        )}
      </div>
      <span className="text-xs font-bold tracking-wide whitespace-nowrap">
        {isOpen ? 'Close Preview' : 'Live Phone Preview'}
      </span>
      {leadCount > 0 && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
          {leadCount}
        </span>
      )}
    </motion.button>
  );
}
