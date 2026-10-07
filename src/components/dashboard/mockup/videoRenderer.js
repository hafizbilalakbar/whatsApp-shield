import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import * as flagSvgStrings from 'country-flag-icons/string/3x2';
import { detectLeadLocation } from '../../../utils/geoLookup';
import { getCountryMetadata, resolveCountryIso } from '../../ui/SvgFlag';
import { FINISH_PROFILES } from './IosDeviceFrame';
import {
  DEVICE,
  FONT_STACK,
  HEADER,
  IOS_COLORS,
  STATUS_BAR,
  drawStatusBar,
  drawSideButtons,
  drawDynamicIsland,
  drawHomeIndicator,
  fillCssLinearGradient,
  roundRectPath,
  truncateToWidth
} from './phoneFrameSpec';

/**
 * Format masked phone number: e.g., +1 (305) 558-••49
 */
export function formatMaskedPhoneNumber(rawNumber, countryHint) {
  if (!rawNumber) return '';
  const clean = String(rawNumber).trim();
  const full = clean.startsWith('+') ? clean : `+${clean.replace(/\D/g, '')}`;
  try {
    const parsed = parsePhoneNumberFromString(full, countryHint || undefined);
    if (parsed && parsed.isValid()) {
      const formatted = parsed.formatInternational();
      const parts = formatted.split(' ');
      if (parts.length >= 3) {
        const lastPart = parts[parts.length - 1];
        const maskedLast = lastPart.length > 2
          ? '••' + lastPart.slice(-2)
          : '••' + lastPart;
        parts[parts.length - 1] = maskedLast;
        return parts.join(' ');
      }
      if (formatted.length > 4) {
        return formatted.slice(0, -4) + '••' + formatted.slice(-2);
      }
      return formatted;
    }
  } catch (e) {
    /* fallback */
  }
  if (clean.length > 6) {
    return clean.slice(0, clean.length - 4) + '••' + clean.slice(-2);
  }
  return clean;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatElapsedSec(totalSec) {
  if (totalSec < 0) totalSec = 0;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Compute real dynamic relative timestamp against the mapped scan clock
 */
function formatRelativeTime(timestamp, currentScanTime) {
  if (!timestamp) return null;
  const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(ts)) return null;

  const diffSeconds = Math.max(0, Math.floor((currentScanTime - ts) / 1000));
  if (diffSeconds >= 3600) {
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  }
  if (diffSeconds >= 60) {
    return `${Math.floor(diffSeconds / 60)}m ago`;
  }
  if (diffSeconds >= 5) {
    return `${diffSeconds}s ago`;
  }
  return 'Just now';
}

/**
 * Preload an image URL into an HTMLImageElement
 */
async function preloadImage(url) {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Preload SVG flag for an ISO code
 */
async function preloadFlagImage(isoCode) {
  const iso = resolveCountryIso(isoCode);
  const svgStr = flagSvgStrings[iso] || flagSvgStrings.US;
  if (!svgStr) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  });
}

/**
 * Helper to round-rect path in 2D canvas
 */
function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Render lead video frame-by-frame with 1:1 Live Mockup Fidelity
 */
export async function renderLeadVideo({
  leads = [],
  scanState = 'COMPLETED',
  progressPercent = 100,
  totalToCheck = 0,
  checkedCount = 0,
  campaignTitle = 'Lead Finder',
  theme = 'dark',
  accentColor = '#0A84FF',
  intensity = 'balanced',
  wallpaper = 'aurora',
  finish = 'graphite',
  startedAt = Date.now() - 15000,
  scanDuration = 15000,
  onProgress,
  signal
}) {
  const WIDTH = 720;
  const HEIGHT = 1280;
  const FPS = 30;
  const DURATION_SEC = 15.0;
  const TOTAL_FRAMES = Math.round(DURATION_SEC * FPS); // 450 frames

  onProgress?.(2, 'Preloading assets & photos…');

  if (typeof window === 'undefined' || typeof window.VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not supported in this browser. Please use Chrome or Edge.');
  }

  // Filter valid leads
  const validLeads = (Array.isArray(leads) ? leads : []).filter(Boolean);
  const displayLeads = validLeads.slice(0, 60); // up to 60 leads in list replay

  // Preload avatars
  const avatarImages = new Map();
  await Promise.all(
    displayLeads.map(async (lead) => {
      const id = lead.cleanNumber || lead.number;
      const photoUrl = lead.avatar || lead.pictureUrl || lead.avatarUrl || lead.photoUrl ||
        (lead.profilePhotoAvailable !== false && id ? `/api/profile-picture?phone=${String(id).replace(/\D/g, '')}` : null);
      if (photoUrl) {
        const img = await preloadImage(photoUrl);
        if (img) avatarImages.set(id, img);
      }
    })
  );

  // Pre-calculate locations & country
  const leadLocations = displayLeads.map((lead) => detectLeadLocation(lead) || '');
  const distinctStates = Array.from(new Set(leadLocations.filter(Boolean)));
  const stateNames = distinctStates.map((loc) => (loc.includes(',') ? loc.split(',')[1].trim() : loc));
  const uniqueStateNames = Array.from(new Set(stateNames));

  // Determine Country ISO & metadata
  const distinctCountries = new Set();
  displayLeads.forEach((lead) => {
    const raw = String(lead.number || lead.phone || lead.cleanNumber || '').trim();
    if (raw) {
      try {
        const full = raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
        const parsed = parsePhoneNumberFromString(full, lead.detectedCountry || undefined);
        if (parsed?.country) distinctCountries.add(parsed.country);
      } catch (e) {}
    }
  });

  const countryIso = distinctCountries.size === 1 ? Array.from(distinctCountries)[0] : 'US';
  const countryMeta = getCountryMetadata(countryIso);
  const flagImg = await preloadFlagImage(countryIso);

  // Subtitle text construction with middle-dot separator
  const countryText = `${countryMeta.name} (${countryMeta.dialCode})`;
  let statesSubtitle = '';
  let isMultiRegion = false;
  if (uniqueStateNames.length === 1) {
    statesSubtitle = uniqueStateNames[0];
  } else if (uniqueStateNames.length >= 2) {
    statesSubtitle = uniqueStateNames.join(' · ');
    isMultiRegion = true;
  }

  // Setup Muxer with standard MP4 config (plays everywhere including VLC)
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: WIDTH,
      height: HEIGHT
    },
    fastStart: 'in-memory'
  });

  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e;
      console.error('[VideoEncoder Error]', e);
    }
  });

  // Select codec profile with universal playback support
  const codecCandidates = [
    'avc1.420028', // Baseline Profile Level 4.0 (Universal VLC / iOS / Web compatibility)
    'avc1.4d0028', // Main Profile Level 4.0
    'avc1.640028', // High Profile Level 4.0
    'avc1.42001f'  // Baseline Profile Level 3.1
  ];

  let selectedCodec = 'avc1.420028';
  for (const candidate of codecCandidates) {
    try {
      const isSupp = await VideoEncoder.isConfigSupported({
        codec: candidate,
        width: WIDTH,
        height: HEIGHT,
        bitrate: 5_000_000,
        framerate: FPS
      });
      if (isSupp.supported) {
        selectedCodec = candidate;
        break;
      }
    } catch (e) {}
  }

  encoder.configure({
    codec: selectedCodec,
    width: WIDTH,
    height: HEIGHT,
    bitrate: 5_000_000,
    framerate: FPS,
    avc: { format: 'avc' }
  });

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false });

  const isDark = theme !== 'light';
  const finishProfile = FINISH_PROFILES[finish] || FINISH_PROFILES['graphite'];

  // Phone geometry scaled for 720x1280 canvas (live device is 464x980)
  const PHONE_SCALE = 1.18;
  const U = (v) => Math.round(v * PHONE_SCALE);
  const PHONE_W = U(DEVICE.width);
  const PHONE_H = U(DEVICE.height);
  const PHONE_X = Math.round((WIDTH - PHONE_W) / 2);
  const PHONE_Y = Math.round((HEIGHT - PHONE_H) / 2);

  // Screen is inset by chassis pad (3px) + bezel pad (9px) on every side,
  // exactly like the live border-box stack in IosDeviceFrame.jsx.
  const SCREEN_PAD = U(DEVICE.chassisPad + DEVICE.bezelPad);
  const SCREEN_X = PHONE_X + SCREEN_PAD;
  const SCREEN_Y = PHONE_Y + SCREEN_PAD;
  const SCREEN_W = PHONE_W - SCREEN_PAD * 2;
  const SCREEN_H = PHONE_H - SCREEN_PAD * 2;
  const themeColors = isDark ? IOS_COLORS.dark : IOS_COLORS.light;
  const BEZEL_PAD = SCREEN_PAD - U(DEVICE.bezelPad);
  const CHASSIS_RADIUS = DEVICE.chassisRadius * PHONE_SCALE;
  const BEZEL_RADIUS = DEVICE.bezelRadius * PHONE_SCALE;
  const SCREEN_RADIUS = DEVICE.screenRadius * PHONE_SCALE;

  const totalLeadsCount = displayLeads.length;
  const streamDuration = 11.5; // seconds dedicated to scan stream (from t=1.5s to 13.0s)
  const leadRevealInterval = totalLeadsCount > 0 ? (streamDuration / totalLeadsCount) : 1.0;
  const actualScanDurationMs = Math.max(5000, scanDuration || 15000);
  const baseStartedAt = startedAt || (Date.now() - actualScanDurationMs);

  // Render loop
  for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex++) {
    if (signal?.aborted) {
      encoder.close();
      throw new Error('Video render cancelled');
    }
    if (encoderError) {
      throw encoderError;
    }

    const t = frameIndex / FPS; // 0.0 to 15.0s

    // ── 1. Studio Backdrop ──
    const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 100, WIDTH / 2, HEIGHT / 2, 700);
    bgGrad.addColorStop(0, isDark ? '#141824' : '#E8EEF8');
    bgGrad.addColorStop(1, isDark ? '#080A10' : '#BAC4D4');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Ambient glow
    ctx.save();
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2, 320, 0, Math.PI * 2);
    ctx.fillStyle = `${accentColor}12`;
    ctx.fill();
    ctx.restore();

    // ── 2. Outer Phone Shadow, Chassis, Rings, Side Buttons & Bezel ──
    ctx.save();
    ctx.shadowColor = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 18;

    roundRectPath(ctx, PHONE_X, PHONE_Y, PHONE_W, PHONE_H, CHASSIS_RADIUS);
    fillCssLinearGradient(ctx, finishProfile.outerEdge, PHONE_X, PHONE_Y, PHONE_W, PHONE_H);
    ctx.fill();
    ctx.restore();

    // DOM box-shadow rings: 0 0 0 2px (outer) then 0 0 0 1px (inner, on top)
    const chassisRing = (offsetOut, lineWidth, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      roundRectPath(
        ctx,
        PHONE_X - offsetOut, PHONE_Y - offsetOut,
        PHONE_W + offsetOut * 2, PHONE_H + offsetOut * 2,
        CHASSIS_RADIUS + offsetOut
      );
      ctx.stroke();
    };
    ctx.save();
    chassisRing(1.5 * PHONE_SCALE, PHONE_SCALE, isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.08)');
    chassisRing(0.5 * PHONE_SCALE, PHONE_SCALE, isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)');
    ctx.restore();

    // Side hardware buttons (Action / Volume Up / Volume Down / Power)
    drawSideButtons(ctx, {
      phoneX: PHONE_X,
      phoneY: PHONE_Y,
      phoneW: PHONE_W,
      scale: PHONE_SCALE,
      color: finishProfile.buttonColor
    });

    // Inner black bezel
    roundRectPath(
      ctx,
      PHONE_X + BEZEL_PAD, PHONE_Y + BEZEL_PAD,
      PHONE_W - BEZEL_PAD * 2, PHONE_H - BEZEL_PAD * 2,
      BEZEL_RADIUS
    );
    ctx.fillStyle = finishProfile.innerBezel;
    ctx.fill();

    // ── 3. Screen Viewport ──
    ctx.save();
    roundRectPath(ctx, SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H, SCREEN_RADIUS);
    ctx.clip();

    ctx.fillStyle = isDark ? '#000000' : '#F2F2F7';
    ctx.fillRect(SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H);

    // Dynamic mapped scan clock
    const streamTime = Math.max(0, Math.min(streamDuration, t - 1.5));
    const streamProgress = Math.min(1, streamTime / streamDuration);
    const mappedScanTime = baseStartedAt + Math.round(streamProgress * actualScanDurationMs);
    const mappedDate = new Date(mappedScanTime);
    const mappedTimeString = mappedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const mappedDateLine = mappedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

    // ── Phase 1: Home Screen / Launch (0.0s - 1.5s) ──
    if (t < 1.5) {
      ctx.fillStyle = isDark ? '#0A0E1A' : '#E5E9F0';
      ctx.fillRect(SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H);

      // Status Bar (identical markup to IosHomeScreen.jsx)
      drawStatusBar(ctx, {
        x: SCREEN_X,
        y: SCREEN_Y,
        w: SCREEN_W,
        scale: PHONE_SCALE,
        time: mappedTimeString,
        color: '#FFFFFF'
      });

      // Home Screen Date & Time Widget
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.round(14 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(mappedDateLine, SCREEN_X + SCREEN_W / 2, SCREEN_Y + Math.round(80 * PHONE_SCALE));

      ctx.font = `700 ${Math.round(58 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(mappedTimeString, SCREEN_X + SCREEN_W / 2, SCREEN_Y + Math.round(145 * PHONE_SCALE));

      if (t > 0.6) {
        const fade = Math.min(1, (t - 0.6) / 0.6);
        ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
        ctx.fillRect(SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 ${Math.round(16 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText('Launching Lead Finder…', SCREEN_X + SCREEN_W / 2, SCREEN_Y + SCREEN_H / 2 + Math.round(26 * PHONE_SCALE));

        const spinAngle = t * Math.PI * 4;
        ctx.beginPath();
        ctx.arc(SCREEN_X + SCREEN_W / 2, SCREEN_Y + SCREEN_H / 2 - Math.round(16 * PHONE_SCALE), Math.round(16 * PHONE_SCALE), spinAngle, spinAngle + Math.PI * 1.5);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = Math.round(3 * PHONE_SCALE);
        ctx.stroke();
      }
    } else {
      // ── Phase 2 & 3: Scan Replay & Completion (1.5s - 15.0s) ──
      const isScanFinished = t >= 13.0;

      // Stats interpolation
      const visibleCount = Math.min(totalLeadsCount, Math.max(1, Math.floor(streamTime / leadRevealInterval) + 1));
      const targetPct = progressPercent || 100;
      const curPct = isScanFinished ? targetPct : Math.min(targetPct, Math.max(1, Math.round(streamProgress * targetPct)));
      const curDiscovered = isScanFinished ? validLeads.filter(l => l.exists).length : Math.max(1, Math.round(streamProgress * validLeads.filter(l => l.exists).length));
      const curBusiness = isScanFinished ? validLeads.filter(l => l.isBusiness).length : Math.round(streamProgress * validLeads.filter(l => l.isBusiness).length);
      const curRemaining = totalToCheck > 0 ? (isScanFinished ? 0 : Math.max(0, totalToCheck - Math.round(streamProgress * checkedCount))) : null;

      // Real mapped elapsed scan seconds (reaches real scan total at 13.0s)
      const mappedElapsedSec = Math.floor((streamProgress * actualScanDurationMs) / 1000);

      // ── Status Bar (44px, padding 0 28px, space-between, center) ──
      const statusTextColor = themeColors.textPrimary;
      drawStatusBar(ctx, {
        x: SCREEN_X,
        y: SCREEN_Y,
        w: SCREEN_W,
        scale: PHONE_SCALE,
        time: mappedTimeString,
        color: statusTextColor
      });

      // ── Header (Date + Title + Subtitle with Flag & Marquee) ──
      const HDR_X = SCREEN_X + U(HEADER.padX);
      const HDR_RIGHT = SCREEN_X + SCREEN_W - U(HEADER.padX);
      const hdrSub = HEADER.subtitle;
      // Exact live flex stack offsets (status 44 + pad 16 + date 18 + gap 2
      // + title margin 2 + title 41 + gap 2 + subtitle 20 + card margin 4)
      const DATE_CY = SCREEN_Y + U(STATUS_BAR.height + HEADER.padTop + HEADER.date.lineHeight / 2);
      const TITLE_CY = SCREEN_Y + U(
        STATUS_BAR.height + HEADER.padTop + HEADER.date.lineHeight + HEADER.gap
        + HEADER.title.marginTop + HEADER.title.lineHeight / 2
      );
      const SUB_TOP = SCREEN_Y + U(
        STATUS_BAR.height + HEADER.padTop + HEADER.date.lineHeight + HEADER.gap
        + HEADER.title.marginTop + HEADER.title.lineHeight + HEADER.gap
      );
      const SUB_CY = SUB_TOP + U(hdrSub.lineHeight / 2);
      const SUB_H = U(hdrSub.lineHeight);

      // Date Line (text-transform: uppercase)
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${HEADER.date.letterSpacing * PHONE_SCALE}px`;
      ctx.font = `600 ${U(HEADER.date.fontSize)}px ${FONT_STACK}`;
      ctx.fillStyle = themeColors.textSecondary;
      ctx.fillText(mappedDateLine, HDR_X, DATE_CY);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();

      // Large Title (34/41 bold with ellipsis)
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${HEADER.title.letterSpacing * PHONE_SCALE}px`;
      ctx.font = `700 ${U(HEADER.title.fontSize)}px ${FONT_STACK}`;
      ctx.fillStyle = themeColors.textPrimary;
      ctx.fillText(truncateToWidth(ctx, campaignTitle || 'Lead Finder', HDR_RIGHT - HDR_X), HDR_X, TITLE_CY);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();

      // Subtitle line: fixed flag + country (+code) fixed + separator + states
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${hdrSub.letterSpacing * PHONE_SCALE}px`;
      ctx.font = `400 ${U(hdrSub.fontSize)}px ${FONT_STACK}`;
      let subX = HDR_X;

      if (flagImg) {
        const flagW = U(hdrSub.flagWidth);
        const flagH = U(hdrSub.flagHeight);
        ctx.drawImage(flagImg, subX, SUB_CY - flagH / 2, flagW, flagH);
        subX += flagW + U(hdrSub.gap);
      }

      ctx.fillStyle = themeColors.textSecondary;
      ctx.fillText(countryText, subX, SUB_CY);
      subX += ctx.measureText(countryText).width;

      if (statesSubtitle) {
        // Fixed separator span (margin: 0 2px, muted color)
        const sepMargin = U(hdrSub.sepMargin);
        ctx.fillStyle = themeColors.textMuted;
        const sepWidth = ctx.measureText('·').width;
        ctx.fillText('·', subX + sepMargin, SUB_CY);
        subX += sepMargin * 2 + sepWidth;

        const statesBoxW = Math.max(U(10), HDR_RIGHT - subX);
        ctx.fillStyle = themeColors.textSecondary;

        if (!isMultiRegion) {
          ctx.fillText(truncateToWidth(ctx, statesSubtitle, statesBoxW), subX, SUB_CY);
        } else {
          // Live marquee: 3 copies each with 28px right padding, track scrolls
          // exactly one copy per loop (-33.3333% of track width) over 18s
          // (28s when intensity is 'subtle').
          const textW = ctx.measureText(statesSubtitle).width;
          const copyW = textW + U(hdrSub.marqueePadRight);
          const loopSec = intensity === 'subtle' ? hdrSub.marqueeSeconds.subtle : hdrSub.marqueeSeconds.default;
          const offset = copyW * ((t % loopSec) / loopSec);

          ctx.save();
          ctx.beginPath();
          ctx.rect(subX, SUB_TOP, statesBoxW, SUB_H);
          ctx.clip();
          for (let i = -1; i <= hdrSub.marqueeCopies; i++) {
            const gx = subX - offset + i * copyW;
            if (gx > subX + statesBoxW || gx + textW < subX) continue;
            ctx.fillText(statesSubtitle, gx, SUB_CY);
          }
          ctx.restore();

          // 6px edge fades (live: mask-image linear-gradient on the marquee box)
          const fade = U(hdrSub.maskFade);
          if (fade > 0) {
            const fadeLeft = ctx.createLinearGradient(subX, 0, subX + fade, 0);
            fadeLeft.addColorStop(0, themeColors.bg);
            fadeLeft.addColorStop(1, themeColors.transparent);
            ctx.fillStyle = fadeLeft;
            ctx.fillRect(subX, SUB_TOP, fade, SUB_H);

            const fadeRight = ctx.createLinearGradient(subX + statesBoxW - fade, 0, subX + statesBoxW, 0);
            fadeRight.addColorStop(0, themeColors.transparent);
            fadeRight.addColorStop(1, themeColors.bg);
            ctx.fillStyle = fadeRight;
            ctx.fillRect(subX + statesBoxW - fade, SUB_TOP, fade, SUB_H);
          }
        }
      }
      ctx.restore();

      // ── Summary Card ──
      const curY = SCREEN_Y + U(
        STATUS_BAR.height + HEADER.padTop + HEADER.date.lineHeight + HEADER.gap
        + HEADER.title.marginTop + HEADER.title.lineHeight + HEADER.gap
        + hdrSub.lineHeight + HEADER.summaryCardMarginTop
      );
      const CARD_X = SCREEN_X + Math.round(16 * PHONE_SCALE);
      const CARD_W = SCREEN_W - Math.round(32 * PHONE_SCALE);
      const CARD_H = Math.round(98 * PHONE_SCALE);

      roundRect(ctx, CARD_X, curY, CARD_W, CARD_H, Math.round(16 * PHONE_SCALE));
      ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
      ctx.fill();

      // Progress Ring
      const RING_CX = CARD_X + Math.round(48 * PHONE_SCALE);
      const RING_CY = curY + CARD_H / 2;
      const RING_R = Math.round(28 * PHONE_SCALE);

      ctx.beginPath();
      ctx.arc(RING_CX, RING_CY, RING_R, 0, Math.PI * 2);
      ctx.strokeStyle = isDark ? 'rgba(84, 84, 88, 0.35)' : 'rgba(60, 60, 67, 0.15)';
      ctx.lineWidth = Math.round(5 * PHONE_SCALE);
      ctx.stroke();

      const ringSweep = (curPct / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(RING_CX, RING_CY, RING_R, -Math.PI / 2, -Math.PI / 2 + ringSweep);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = Math.round(5 * PHONE_SCALE);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(16 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif`;
      ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.fillText(`${curPct}%`, RING_CX, RING_CY + Math.round(5 * PHONE_SCALE));

      // Right Top: Status Pill + Elapsed Timer
      const RIGHT_X = CARD_X + Math.round(92 * PHONE_SCALE);
      const row1Y = curY + Math.round(24 * PHONE_SCALE);

      // Status Pill: Completed (Blue) vs Scanning (Green)
      const pillColor = isScanFinished ? '#0A84FF' : '#34C759';
      const pillBg = isScanFinished ? 'rgba(10, 132, 255, 0.16)' : 'rgba(52, 199, 89, 0.16)';
      const pillText = isScanFinished ? 'Completed' : 'Scanning';

      roundRect(ctx, RIGHT_X, row1Y - Math.round(12 * PHONE_SCALE), Math.round(80 * PHONE_SCALE), Math.round(20 * PHONE_SCALE), Math.round(10 * PHONE_SCALE));
      ctx.fillStyle = pillBg;
      ctx.fill();

      // Live pulsing green dot for scanning
      if (!isScanFinished) {
        ctx.beginPath();
        ctx.arc(RIGHT_X + Math.round(10 * PHONE_SCALE), row1Y - Math.round(2 * PHONE_SCALE), Math.round(3 * PHONE_SCALE), 0, Math.PI * 2);
        ctx.fillStyle = '#34C759';
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.round(11 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = pillColor;
      ctx.fillText(pillText, RIGHT_X + Math.round(44 * PHONE_SCALE), row1Y + Math.round(1 * PHONE_SCALE));

      // Elapsed Timer
      ctx.textAlign = 'right';
      ctx.font = `600 ${Math.round(10 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.5)' : 'rgba(60, 60, 67, 0.55)';
      ctx.fillText('ELAPSED', CARD_X + CARD_W - Math.round(52 * PHONE_SCALE), row1Y);

      ctx.font = `700 ${Math.round(13 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.fillText(formatElapsedSec(mappedElapsedSec), CARD_X + CARD_W - Math.round(10 * PHONE_SCALE), row1Y);

      // Card Divider
      ctx.fillStyle = isDark ? 'rgba(84, 84, 88, 0.5)' : 'rgba(60, 60, 67, 0.2)';
      ctx.fillRect(RIGHT_X, curY + Math.round(40 * PHONE_SCALE), CARD_W - Math.round(102 * PHONE_SCALE), 1);

      // Card 3 Stats Grid
      const statY = curY + Math.round(68 * PHONE_SCALE);
      const colW = (CARD_W - Math.round(102 * PHONE_SCALE)) / 3;

      // Col 1: Discovered
      ctx.textAlign = 'left';
      ctx.font = `500 ${Math.round(10 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)';
      ctx.fillText('Discovered', RIGHT_X, statY);
      ctx.font = `700 ${Math.round(18 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.fillText(curDiscovered.toLocaleString(), RIGHT_X, statY + Math.round(18 * PHONE_SCALE));

      // Col 2: Business
      ctx.font = `500 ${Math.round(10 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)';
      ctx.fillText('Business', RIGHT_X + colW, statY);
      ctx.font = `700 ${Math.round(18 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = '#409CFF';
      ctx.fillText(curBusiness.toLocaleString(), RIGHT_X + colW, statY + Math.round(18 * PHONE_SCALE));

      // Col 3: Remaining
      ctx.font = `500 ${Math.round(10 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)';
      ctx.fillText('Remaining', RIGHT_X + colW * 2, statY);
      ctx.font = `700 ${Math.round(18 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)';
      ctx.fillText(curRemaining !== null ? curRemaining.toLocaleString() : '0', RIGHT_X + colW * 2, statY + Math.round(18 * PHONE_SCALE));

      // ── Scanned Leads List ──
      const LIST_X = CARD_X;
      const LIST_Y = curY + CARD_H + Math.round(12 * PHONE_SCALE);
      const LIST_W = CARD_W;
      const LIST_H = SCREEN_Y + SCREEN_H - LIST_Y - Math.round(24 * PHONE_SCALE);

      roundRect(ctx, LIST_X, LIST_Y, LIST_W, LIST_H, Math.round(16 * PHONE_SCALE));
      ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
      ctx.fill();

      // List Clip
      ctx.save();
      roundRect(ctx, LIST_X, LIST_Y, LIST_W, LIST_H, Math.round(16 * PHONE_SCALE));
      ctx.clip();

      const ROW_H = Math.round(72 * PHONE_SCALE);
      const maxScroll = Math.max(0, visibleCount * ROW_H - LIST_H + ROW_H);
      const scrollY = streamProgress * maxScroll;

      for (let i = 0; i < visibleCount; i++) {
        const lead = displayLeads[i];
        if (!lead) continue;
        const rowY = LIST_Y - scrollY + i * ROW_H;
        if (rowY + ROW_H < LIST_Y || rowY > LIST_Y + LIST_H) continue;

        const id = lead.cleanNumber || lead.number;
        const avatarImg = avatarImages.get(id);

        // 44px Avatar Circle
        const AV_R = Math.round(22 * PHONE_SCALE);
        const AV_X = LIST_X + Math.round(14 * PHONE_SCALE) + AV_R;
        const AV_Y = rowY + ROW_H / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(AV_X, AV_Y, AV_R, 0, Math.PI * 2);
        ctx.clip();

        if (avatarImg) {
          ctx.drawImage(avatarImg, AV_X - AV_R, AV_Y - AV_R, AV_R * 2, AV_R * 2);
        } else {
          // Monogram / stylish avatar
          ctx.fillStyle = isDark ? '#2C2C2E' : '#E5E5EA';
          ctx.fillRect(AV_X - AV_R, AV_Y - AV_R, AV_R * 2, AV_R * 2);
          ctx.fillStyle = isDark ? '#8E8E93' : '#AEAEB2';
          ctx.beginPath();
          ctx.arc(AV_X, AV_Y - Math.round(3 * PHONE_SCALE), Math.round(8 * PHONE_SCALE), 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(AV_X, AV_Y + Math.round(18 * PHONE_SCALE), Math.round(14 * PHONE_SCALE), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Phone Number / Contact Name & Location
        const TEXT_X = LIST_X + Math.round(68 * PHONE_SCALE);
        const name = lead?.displayName || lead?.verifiedName || null;
        const maskedNum = formatMaskedPhoneNumber(lead.number || lead.phone || lead.cleanNumber, lead.detectedCountry || countryIso);
        const leadLoc = leadLocations[i] || lead.regionName || '';

        // Line 1: Name or Masked Phone
        ctx.textAlign = 'left';
        ctx.font = `600 ${Math.round(15 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`;
        ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
        ctx.fillText(name || maskedNum, TEXT_X, rowY + Math.round(28 * PHONE_SCALE));

        // Line 1 Right: Dynamic Relative Timestamp calculated against mapped clock
        const leadFoundTime = lead.discoveredAt || lead.timestamp || (baseStartedAt + (i * leadRevealInterval * 1000));
        const relTimeStr = formatRelativeTime(leadFoundTime, mappedScanTime);
        if (relTimeStr) {
          ctx.textAlign = 'right';
          ctx.font = `400 ${Math.round(12 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.45)' : 'rgba(60, 60, 67, 0.5)';
          ctx.fillText(relTimeStr, LIST_X + LIST_W - Math.round(14 * PHONE_SCALE), rowY + Math.round(28 * PHONE_SCALE));
        }

        // Line 2: Location or Masked Number
        const subLineText = name ? (leadLoc ? `${maskedNum} · ${leadLoc}` : maskedNum) : (leadLoc || 'WhatsApp Lead');
        ctx.textAlign = 'left';
        ctx.font = `400 ${Math.round(13 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`;
        ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)';
        ctx.fillText(subLineText, TEXT_X, rowY + Math.round(48 * PHONE_SCALE));

        // Line 2 Right: Badges (WhatsApp = Green, Business = Blue; business shows both!)
        // Render chips from right to left
        let chipRightX = LIST_X + LIST_W - Math.round(14 * PHONE_SCALE);
        const CHIP_H = Math.round(18 * PHONE_SCALE);
        const CHIP_Y = rowY + Math.round(36 * PHONE_SCALE);

        const leadChips = [];
        if (lead.isVerified) {
          leadChips.push({ label: 'Verified', color: '#5AC8FA', bg: isDark ? 'rgba(48, 176, 199, 0.16)' : 'rgba(48, 176, 199, 0.12)', border: isDark ? 'rgba(90, 200, 250, 0.25)' : 'rgba(0, 122, 255, 0.2)' });
        }
        if (lead.isBusiness) {
          leadChips.push({ label: 'Business', color: '#409CFF', bg: isDark ? 'rgba(10, 132, 255, 0.16)' : 'rgba(10, 132, 255, 0.1)', border: isDark ? 'rgba(10, 132, 255, 0.25)' : 'rgba(10, 132, 255, 0.18)' });
        }
        if (lead.exists !== false && leadChips.length < 2) {
          leadChips.push({ label: 'WhatsApp', color: '#34C759', bg: isDark ? 'rgba(52, 199, 89, 0.16)' : 'rgba(52, 199, 89, 0.12)', border: isDark ? 'rgba(52, 199, 89, 0.25)' : 'rgba(52, 199, 89, 0.2)' });
        }

        ctx.font = `600 ${Math.round(10 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        for (let c = leadChips.length - 1; c >= 0; c--) {
          const chip = leadChips[c];
          const chipTextW = ctx.measureText(chip.label).width;
          const chipW = chipTextW + Math.round(12 * PHONE_SCALE);
          const chipX = chipRightX - chipW;

          roundRect(ctx, chipX, CHIP_Y, chipW, CHIP_H, Math.round(9 * PHONE_SCALE));
          ctx.fillStyle = chip.bg;
          ctx.fill();
          ctx.strokeStyle = chip.border;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.fillStyle = chip.color;
          ctx.fillText(chip.label, chipX + chipW / 2, CHIP_Y + Math.round(12.5 * PHONE_SCALE));

          chipRightX = chipX - Math.round(4 * PHONE_SCALE);
        }

        // Separator
        if (i < visibleCount - 1) {
          ctx.fillStyle = isDark ? 'rgba(84, 84, 88, 0.35)' : 'rgba(60, 60, 67, 0.15)';
          ctx.fillRect(TEXT_X, rowY + ROW_H - 1, LIST_W - Math.round(78 * PHONE_SCALE), 1);
        }
      }

      // Soft top fade mask
      const topFade = ctx.createLinearGradient(0, LIST_Y, 0, LIST_Y + Math.round(20 * PHONE_SCALE));
      topFade.addColorStop(0, isDark ? '#1C1C1E' : '#FFFFFF');
      topFade.addColorStop(1, isDark ? 'rgba(28, 28, 30, 0)' : 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = topFade;
      ctx.fillRect(LIST_X, LIST_Y, LIST_W, Math.round(20 * PHONE_SCALE));

      ctx.restore(); // end list clip
    }

    // Dynamic Island + camera lens dot (painted above screen content)
    drawDynamicIsland(ctx, { screenX: SCREEN_X, screenY: SCREEN_Y, screenW: SCREEN_W, scale: PHONE_SCALE });

    // Home Indicator
    drawHomeIndicator(ctx, {
      screenX: SCREEN_X,
      screenY: SCREEN_Y,
      screenW: SCREEN_W,
      screenH: SCREEN_H,
      scale: PHONE_SCALE,
      isDark
    });

    ctx.restore(); // end screen clip

    // Encode frame
    const vFrame = new VideoFrame(canvas, {
      timestamp: Math.round((frameIndex / FPS) * 1_000_000)
    });
    encoder.encode(vFrame, { keyFrame: frameIndex % 30 === 0 });
    vFrame.close();

    // Progress update and main-thread yield
    if (frameIndex % 5 === 0 || frameIndex === TOTAL_FRAMES - 1) {
      const pct = Math.round((frameIndex / TOTAL_FRAMES) * 95);
      onProgress?.(pct, `Rendering video frame ${frameIndex + 1}/${TOTAL_FRAMES}…`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  onProgress?.(96, 'Finalizing MP4 file…');
  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buffer = muxer.target.buffer;
  const blob = new Blob([buffer], { type: 'video/mp4' });
  const objectUrl = URL.createObjectURL(blob);

  onProgress?.(100, 'Video ready');
  return objectUrl;
}
