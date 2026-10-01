import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import * as flagSvgStrings from 'country-flag-icons/string/3x2';
import { detectLeadLocation } from '../../../utils/geoLookup';
import { getCountryMetadata, resolveCountryIso } from '../../ui/SvgFlag';
import { FINISH_PROFILES } from './IosDeviceFrame';
import { WALLPAPER_PRESETS } from './IosHomeScreen';

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
 * Format seconds to MM:SS
 */
function formatElapsedSec(totalSec) {
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
 * Render lead video frame-by-frame
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
  const displayLeads = validLeads.slice(0, 50); // up to 50 leads in list replay

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

  // Subtitle text
  const countryText = `${countryMeta.name} (${countryMeta.dialCode})`;
  let statesSubtitle = '';
  if (uniqueStateNames.length === 1) {
    statesSubtitle = uniqueStateNames[0];
  } else if (uniqueStateNames.length === 2) {
    statesSubtitle = `${uniqueStateNames[0]}, ${uniqueStateNames[1]}`;
  } else if (uniqueStateNames.length >= 3) {
    statesSubtitle = uniqueStateNames.join(', ');
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
        bitrate: 4_000_000,
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
    bitrate: 4_000_000,
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

  // Phone geometry scaled for 720x1280 canvas
  const PHONE_SCALE = 1.18;
  const PHONE_W = Math.round(464 * PHONE_SCALE); // ~548px
  const PHONE_H = Math.round(956 * PHONE_SCALE); // ~1128px
  const PHONE_X = Math.round((WIDTH - PHONE_W) / 2);
  const PHONE_Y = Math.round((HEIGHT - PHONE_H) / 2);

  const SCREEN_W = Math.round(440 * PHONE_SCALE); // ~519px
  const SCREEN_H = Math.round(932 * PHONE_SCALE); // ~1100px
  const SCREEN_X = PHONE_X + Math.round((PHONE_W - SCREEN_W) / 2);
  const SCREEN_Y = PHONE_Y + Math.round((PHONE_H - SCREEN_H) / 2);

  const totalLeadsCount = displayLeads.length;
  const streamDuration = 11.5; // seconds dedicated to scan stream (from t=1.5s to 13.0s)
  const leadRevealInterval = totalLeadsCount > 0 ? (streamDuration / totalLeadsCount) : 1.0;

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

    // ── 2. Outer Phone Shadow & Chassis ──
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 18;

    roundRect(ctx, PHONE_X, PHONE_Y, PHONE_W, PHONE_H, Math.round(52 * PHONE_SCALE));
    ctx.fillStyle = finishProfile.buttonColor || '#2A2B2E';
    ctx.fill();
    ctx.restore();

    // Inner bezel
    const BEZEL_PAD = Math.round(7 * PHONE_SCALE);
    roundRect(ctx, PHONE_X + BEZEL_PAD, PHONE_Y + BEZEL_PAD, PHONE_W - BEZEL_PAD * 2, PHONE_H - BEZEL_PAD * 2, Math.round(48 * PHONE_SCALE));
    ctx.fillStyle = '#0B0C0E';
    ctx.fill();

    // ── 3. Screen Viewport ──
    ctx.save();
    roundRect(ctx, SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H, Math.round(42 * PHONE_SCALE));
    ctx.clip();

    ctx.fillStyle = isDark ? '#000000' : '#F2F2F7';
    ctx.fillRect(SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H);

    // ── Phase 1: Home Screen / Launch (0.0s - 1.5s) ──
    if (t < 1.5) {
      ctx.fillStyle = isDark ? '#0A0E1A' : '#E5E9F0';
      ctx.fillRect(SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H);

      // Status Bar
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 ${Math.round(15 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('9:41', SCREEN_X + Math.round(28 * PHONE_SCALE), SCREEN_Y + Math.round(32 * PHONE_SCALE));

      // Home Screen Date & Time Widget
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.round(14 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('Thursday, October 1', SCREEN_X + SCREEN_W / 2, SCREEN_Y + Math.round(80 * PHONE_SCALE));

      ctx.font = `700 ${Math.round(58 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('9:41', SCREEN_X + SCREEN_W / 2, SCREEN_Y + Math.round(145 * PHONE_SCALE));

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
      const streamTime = Math.min(streamDuration, t - 1.5);
      const streamProgress = Math.min(1, streamTime / streamDuration);
      const isScanFinished = t >= 13.0;

      // Stats interpolation
      const visibleCount = Math.min(totalLeadsCount, Math.max(1, Math.floor(streamTime / leadRevealInterval) + 1));
      const targetPct = progressPercent || 100;
      const curPct = isScanFinished ? targetPct : Math.min(targetPct, Math.max(1, Math.round(streamProgress * targetPct)));
      const curDiscovered = isScanFinished ? validLeads.filter(l => l.exists).length : Math.max(1, Math.round(streamProgress * validLeads.filter(l => l.exists).length));
      const curBusiness = isScanFinished ? validLeads.filter(l => l.isBusiness).length : Math.round(streamProgress * validLeads.filter(l => l.isBusiness).length);
      const curRemaining = totalToCheck > 0 ? (isScanFinished ? 0 : Math.max(0, totalToCheck - Math.round(streamProgress * checkedCount))) : null;

      // Status Bar
      ctx.textAlign = 'left';
      ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.font = `600 ${Math.round(15 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText('9:41', SCREEN_X + Math.round(28 * PHONE_SCALE), SCREEN_Y + Math.round(30 * PHONE_SCALE));

      // Right Status Bar Icons (Signal, Wifi, Battery)
      const STAT_R = SCREEN_X + SCREEN_W - Math.round(28 * PHONE_SCALE);
      const ICON_Y = SCREEN_Y + Math.round(20 * PHONE_SCALE);
      // Battery
      ctx.strokeStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.lineWidth = 1;
      roundRect(ctx, STAT_R - 22, ICON_Y, 20, 11, 3);
      ctx.stroke();
      ctx.fillStyle = isDark ? '#34C759' : '#34C759';
      roundRect(ctx, STAT_R - 20, ICON_Y + 2, 16, 7, 2);
      ctx.fill();

      // ── Header (Date + Title + Subtitle with Flag) ──
      const HDR_X = SCREEN_X + Math.round(20 * PHONE_SCALE);
      let curY = SCREEN_Y + Math.round(56 * PHONE_SCALE);

      // Date Line
      ctx.font = `600 ${Math.round(12 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)';
      ctx.fillText('THURSDAY, 1 OCTOBER', HDR_X, curY);

      // Title
      curY += Math.round(28 * PHONE_SCALE);
      ctx.font = `700 ${Math.round(30 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.fillText(campaignTitle || 'Lead Finder', HDR_X, curY);

      // Subtitle line (Flag + Country + State)
      curY += Math.round(22 * PHONE_SCALE);
      const SUB_Y = curY;
      let subX = HDR_X;

      // Draw Flag
      if (flagImg) {
        const flagW = Math.round(18 * PHONE_SCALE);
        const flagH = Math.round(12 * PHONE_SCALE);
        ctx.drawImage(flagImg, subX, SUB_Y - flagH + 2, flagW, flagH);
        subX += flagW + Math.round(6 * PHONE_SCALE);
      }

      ctx.font = `400 ${Math.round(14 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.65)' : 'rgba(60, 60, 67, 0.65)';
      const subFull = `${countryText}${statesSubtitle ? ` - ${statesSubtitle}` : ''}`;
      ctx.fillText(subFull, subX, SUB_Y);

      // ── Summary Card ──
      curY += Math.round(16 * PHONE_SCALE);
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
      ctx.font = `700 ${Math.round(16 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.fillText(`${curPct}%`, RING_CX, RING_CY + Math.round(5 * PHONE_SCALE));

      // Right Top: Status Pill + Elapsed Timer
      const RIGHT_X = CARD_X + Math.round(92 * PHONE_SCALE);
      const row1Y = curY + Math.round(24 * PHONE_SCALE);

      // Status Pill
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
      const elapsedSec = Math.floor(t);
      ctx.textAlign = 'right';
      ctx.font = `600 ${Math.round(10 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.5)' : 'rgba(60, 60, 67, 0.55)';
      ctx.fillText('ELAPSED', CARD_X + CARD_W - Math.round(52 * PHONE_SCALE), row1Y);

      ctx.font = `700 ${Math.round(13 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.fillText(formatElapsedSec(elapsedSec), CARD_X + CARD_W - Math.round(10 * PHONE_SCALE), row1Y);

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
      ctx.fillStyle = '#34C759';
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

      const ROW_H = Math.round(66 * PHONE_SCALE);
      const maxScroll = Math.max(0, visibleCount * ROW_H - LIST_H + ROW_H);
      const scrollY = streamProgress * maxScroll;

      for (let i = 0; i < visibleCount; i++) {
        const lead = displayLeads[i];
        if (!lead) continue;
        const rowY = LIST_Y - scrollY + i * ROW_H;
        if (rowY + ROW_H < LIST_Y || rowY > LIST_Y + LIST_H) continue;

        const id = lead.cleanNumber || lead.number;
        const avatarImg = avatarImages.get(id);

        // 40px Avatar Circle
        const AV_R = Math.round(20 * PHONE_SCALE);
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
          ctx.arc(AV_X, AV_Y - Math.round(3 * PHONE_SCALE), Math.round(7 * PHONE_SCALE), 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(AV_X, AV_Y + Math.round(16 * PHONE_SCALE), Math.round(12 * PHONE_SCALE), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Phone Number / Contact Name & Location
        const TEXT_X = LIST_X + Math.round(62 * PHONE_SCALE);
        const name = lead?.displayName || lead?.verifiedName || null;
        const maskedNum = formatMaskedPhoneNumber(lead.number || lead.phone || lead.cleanNumber, lead.detectedCountry || countryIso);
        const leadLoc = leadLocations[i] || '';

        ctx.textAlign = 'left';
        ctx.font = `600 ${Math.round(15 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
        ctx.fillText(name || maskedNum, TEXT_X, rowY + Math.round(26 * PHONE_SCALE));

        // Subtext: Location or masked number
        const subLineText = name ? (leadLoc ? `${maskedNum} · ${leadLoc}` : maskedNum) : (leadLoc || 'WhatsApp Lead');
        ctx.font = `400 ${Math.round(12 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.65)';
        ctx.fillText(subLineText, TEXT_X, rowY + Math.round(44 * PHONE_SCALE));

        // Chips (Business / WhatsApp)
        const chipLabel = lead.isBusiness ? 'Business' : 'WhatsApp';
        const chipColor = lead.isBusiness ? '#34C759' : '#0A84FF';
        const chipBg = lead.isBusiness ? 'rgba(52, 199, 89, 0.16)' : 'rgba(10, 132, 255, 0.16)';
        const CHIP_W = Math.round(68 * PHONE_SCALE);
        const CHIP_H = Math.round(20 * PHONE_SCALE);
        const CHIP_X = LIST_X + LIST_W - CHIP_W - Math.round(12 * PHONE_SCALE);

        roundRect(ctx, CHIP_X, rowY + Math.round(18 * PHONE_SCALE), CHIP_W, CHIP_H, Math.round(10 * PHONE_SCALE));
        ctx.fillStyle = chipBg;
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = `600 ${Math.round(10 * PHONE_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = chipColor;
        ctx.fillText(chipLabel, CHIP_X + CHIP_W / 2, rowY + Math.round(32 * PHONE_SCALE));

        // Separator
        if (i < visibleCount - 1) {
          ctx.fillStyle = isDark ? 'rgba(84, 84, 88, 0.35)' : 'rgba(60, 60, 67, 0.15)';
          ctx.fillRect(TEXT_X, rowY + ROW_H - 1, LIST_W - Math.round(72 * PHONE_SCALE), 1);
        }
      }

      ctx.restore(); // end list clip
    }

    // Dynamic Island
    const DI_W = Math.round(112 * PHONE_SCALE);
    const DI_H = Math.round(32 * PHONE_SCALE);
    const DI_X = SCREEN_X + (SCREEN_W - DI_W) / 2;
    const DI_Y = SCREEN_Y + Math.round(10 * PHONE_SCALE);

    roundRect(ctx, DI_X, DI_Y, DI_W, DI_H, Math.round(16 * PHONE_SCALE));
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Home Indicator Bar
    const HI_W = Math.round(120 * PHONE_SCALE);
    const HI_H = Math.round(4 * PHONE_SCALE);
    const HI_X = SCREEN_X + (SCREEN_W - HI_W) / 2;
    const HI_Y = SCREEN_Y + SCREEN_H - Math.round(12 * PHONE_SCALE);

    roundRect(ctx, HI_X, HI_Y, HI_W, HI_H, Math.round(2 * PHONE_SCALE));
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
    ctx.fill();

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
