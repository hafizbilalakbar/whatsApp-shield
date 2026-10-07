/**
 * Phone chrome spec for the exported lead video.
 *
 * The live mockup (IosDeviceFrame.jsx / IosPhoneScreen.jsx / IosHomeScreen.jsx /
 * IosIcons.jsx) is the design source. Every value below is transcribed 1:1 from
 * those components so the canvas renderer in videoRenderer.js paints the exact
 * same chassis, side buttons, bezel, dynamic island, home indicator, status bar
 * and header as the live DOM. The live components themselves must not change.
 */

export const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, sans-serif";

/** Device outer box + inner bezel + screen viewport (IosDeviceFrame.jsx). */
export const DEVICE = {
  width: 464,
  height: 980,
  chassisRadius: 62,
  chassisPad: 3,
  bezelRadius: 59,
  bezelPad: 9,
  screenWidth: 440,
  screenHeight: 956,
  screenRadius: 50
};

/** Hardware buttons on the chassis edge (IosDeviceFrame.jsx). */
export const SIDE_BUTTONS = [
  { side: 'left', stickOut: 4, top: 140, width: 4, height: 32, radii: [2, 0, 0, 2] },
  { side: 'left', stickOut: 4, top: 190, width: 4, height: 56, radii: [2, 0, 0, 2] },
  { side: 'left', stickOut: 4, top: 260, width: 4, height: 56, radii: [2, 0, 0, 2] },
  { side: 'right', stickOut: 4, top: 210, width: 4, height: 84, radii: [0, 2, 2, 0] }
];

/** Dynamic island pill + camera lens dot (IosDeviceFrame.jsx). */
export const ISLAND = {
  top: 11,
  width: 126,
  height: 37,
  radius: 20,
  padX: 12,
  cameraSize: 11,
  ring: 'rgba(255, 255, 255, 0.05)',
  shadow: 'rgba(0, 0, 0, 0.5)'
};

/** Home indicator bar (IosDeviceFrame.jsx). */
export const HOME_INDICATOR = {
  bottom: 8,
  width: 134,
  height: 5,
  radius: 100,
  dark: 'rgba(255, 255, 255, 0.45)',
  light: 'rgba(0, 0, 0, 0.4)'
};

/** Status bar row (IosPhoneScreen.jsx + IosHomeScreen.jsx, identical markup). */
export const STATUS_BAR = {
  height: 44,
  padX: 28,
  clock: { fontSize: 17, lineHeight: 22, weight: 600, letterSpacing: -0.4 },
  icons: { gap: 7, signal: 17, wifi: 16, battery: 25, batteryLevel: 0.94 }
};

/** Header block: date line, large title, subtitle (IosPhoneScreen.jsx). */
export const HEADER = {
  padTop: 16,
  padX: 28,
  padBottom: 12,
  gap: 2,
  date: { fontSize: 13, lineHeight: 18, weight: 600, letterSpacing: -0.1 },
  title: { fontSize: 34, lineHeight: 41, weight: 700, letterSpacing: 0.4, marginTop: 2 },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    weight: 400,
    letterSpacing: -0.2,
    gap: 6,
    flagWidth: 20,
    flagHeight: Math.round(20 * (2 / 3)),
    sepMargin: 2,
    marqueePadRight: 28,
    marqueeCopies: 3,
    maskFade: 6,
    marqueeSeconds: { subtle: 28, default: 18 }
  },
  summaryCardMarginTop: 4
};

/** Theme tokens (IosPhoneScreen.jsx `colors`). */
export const IOS_COLORS = {
  dark: {
    bg: '#000000',
    transparent: 'rgba(0, 0, 0, 0)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(235, 235, 245, 0.6)',
    textMuted: 'rgba(235, 235, 245, 0.35)'
  },
  light: {
    bg: '#F2F2F7',
    transparent: 'rgba(242, 242, 247, 0)',
    textPrimary: '#000000',
    textSecondary: 'rgba(60, 60, 67, 0.65)',
    textMuted: 'rgba(60, 60, 67, 0.4)'
  }
};

/**
 * Rounded-rect path with per-corner radii (CSS order: tl, tr, br, bl).
 */
export function roundRectPath(ctx, x, y, w, h, radii = 0) {
  const r = Array.isArray(radii) ? radii : [radii, radii, radii, radii];
  const max = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = r.map((v) => Math.max(0, Math.min(v, max)));
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/**
 * Run `draw` inside an SVG viewBox mapping (preserveAspectRatio="xMidYMid meet").
 * Lets canvas use the literal SVG path data and numbers from IosIcons.jsx.
 */
function drawInSvgBox(ctx, x, y, vbW, vbH, outW, outH, draw) {
  const k = Math.min(outW / vbW, outH / vbH);
  ctx.save();
  ctx.translate(x + (outW - vbW * k) / 2, y + (outH - vbH * k) / 2);
  ctx.scale(k, k);
  draw();
  ctx.restore();
}

/** IosSignalIcon — viewBox 0 0 18 12, four rounded bars. */
export function drawSignalIcon(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  drawInSvgBox(ctx, x, y, 18, 12, w, h, () => {
    roundRectPath(ctx, 0.5, 8, 3, 4, 1);
    ctx.fill();
    roundRectPath(ctx, 4.5, 5.5, 3, 6.5, 1);
    ctx.fill();
    roundRectPath(ctx, 8.5, 3, 3, 9, 1);
    ctx.fill();
    roundRectPath(ctx, 12.5, 0.5, 3, 11.5, 1);
    ctx.fill();
  });
  ctx.restore();
}

/** IosWifiIcon — viewBox 0 0 16 12, filled dot + two stroked arcs. */
export function drawWifiIcon(ctx, x, y, w, h, color) {
  ctx.save();
  drawInSvgBox(ctx, x, y, 16, 12, w, h, () => {
    ctx.fillStyle = color;
    ctx.fill(new Path2D(
      'M8 9.5C8.82843 9.5 9.5 8.82843 9.5 8C9.5 7.17157 8.82843 6.5 8 6.5C7.17157 6.5 6.5 7.17157 6.5 8C6.5 8.82843 7.17157 9.5 8 9.5Z'
    ));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.stroke(new Path2D('M4.3 5.4C5.3 4.4 6.6 3.9 8 3.9C9.4 3.9 10.7 4.4 11.7 5.4'));
    ctx.stroke(new Path2D('M1.5 2.6C3.3 0.9 5.6 0 8 0C10.4 0 12.7 0.9 14.5 2.6'));
  });
  ctx.restore();
}

/** IosBatteryIcon — viewBox 0 0 25 12, shell + terminal + inner fill. */
export function drawBatteryIcon(ctx, x, y, w, h, color, level = 0.94) {
  ctx.save();
  drawInSvgBox(ctx, x, y, 25, 12, w, h, () => {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    roundRectPath(ctx, 0.75, 0.75, 20.5, 10.5, 3.25);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fill(new Path2D('M23 4C23.5523 4 24 4.44772 24 5V7C24 7.55228 23.5523 8 23 8V4Z'));

    const fillWidth = Math.max(2, Math.round((25 - 6) * Math.min(1, Math.max(0.1, level))));
    roundRectPath(ctx, 2.5, 2.5, fillWidth, 7, 1.75);
    ctx.fill();
  });
  ctx.restore();
}

function setSpacedFont(ctx, weight, sizePx, letterSpacingPx) {
  ctx.font = `${weight} ${sizePx}px ${FONT_STACK}`;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${letterSpacingPx}px`;
  }
}

function clearSpacing(ctx) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/**
 * Full status bar: left clock + right signal/wifi/battery row.
 * `x, y, w` are the flex box (padding 0 28px, space-between, center aligned).
 */
export function drawStatusBar(ctx, { x, y, w, scale, time, color }) {
  const s = scale;
  const iconH = Math.round(12 * s);
  const icons = STATUS_BAR.icons;
  const rowW = (icons.signal + icons.gap + icons.wifi + icons.gap + icons.battery) * s;
  const centerY = y + (STATUS_BAR.height / 2) * s;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  setSpacedFont(ctx, STATUS_BAR.clock.weight, STATUS_BAR.clock.fontSize * s, STATUS_BAR.clock.letterSpacing * s);
  ctx.fillStyle = color;
  ctx.fillText(time, x + STATUS_BAR.padX * s, centerY);
  clearSpacing(ctx);

  let ix = x + w - rowW;
  const iconY = centerY - iconH / 2;
  drawSignalIcon(ctx, ix, iconY, icons.signal * s, iconH, color);
  ix += (icons.signal + icons.gap) * s;
  drawWifiIcon(ctx, ix, iconY, icons.wifi * s, iconH, color);
  ix += (icons.wifi + icons.gap) * s;
  drawBatteryIcon(ctx, ix, iconY, icons.battery * s, iconH, color, icons.batteryLevel);
  ctx.restore();
}

/**
 * Side hardware buttons, painted on the chassis edge exactly like the DOM.
 */
export function drawSideButtons(ctx, { phoneX, phoneY, phoneW, scale, color }) {
  const s = scale;
  for (const b of SIDE_BUTTONS) {
    const x = b.side === 'left'
      ? phoneX + (b.stickOut * s) * -1
      : phoneX + phoneW - b.width * s + b.stickOut * s;
    const y = phoneY + b.top * s;
    const w = b.width * s;
    const h = b.height * s;

    ctx.save();
    roundRectPath(ctx, x, y, w, h, b.radii.map((r) => r * s));
    ctx.fillStyle = color;
    ctx.fill();

    // inset highlight strip: 1px on the outer edge of the button
    const strip = Math.max(1, 1 * s);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    if (b.side === 'left') {
      ctx.fillRect(x, y + 2 * s, strip, h - 4 * s);
    } else {
      ctx.fillRect(x + w - strip, y + 2 * s, strip, h - 4 * s);
    }
    ctx.restore();
  }
}

/**
 * Fill a CSS `linear-gradient(<deg>deg, <color> <pos>%, ...)` onto a canvas
 * rect using the standard CSS gradient line construction. Falls back to a
 * solid fill when the string cannot be parsed.
 */
export function fillCssLinearGradient(ctx, css, x, y, w, h) {
  const angleMatch = /linear-gradient\(\s*([\d.]+)deg/.exec(css);
  const re = /(#[0-9A-Fa-f]{3,8}|rgba?\([^)]*\))\s*([\d.]+)\s*%/g;
  const stops = [];
  let m = re.exec(css);
  while (m) {
    stops.push({ color: m[1], pos: Math.min(1, Math.max(0, parseFloat(m[2]) / 100)) });
    m = re.exec(css);
  }
  if (!angleMatch || stops.length === 0) {
    ctx.fillStyle = css;
    return;
  }
  const angle = (parseFloat(angleMatch[1]) * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const grad = ctx.createLinearGradient(
    cx - (dx * len) / 2, cy - (dy * len) / 2,
    cx + (dx * len) / 2, cy + (dy * len) / 2
  );
  stops.forEach((s) => grad.addColorStop(s.pos, s.color));
  ctx.fillStyle = grad;
}

/**
 * Dynamic island (126x37 pill, top 11px) with the camera lens reflection dot.
 */
export function drawDynamicIsland(ctx, { screenX, screenY, screenW, scale }) {
  const s = scale;
  const w = ISLAND.width * s;
  const h = ISLAND.height * s;
  const x = screenX + (screenW - w) / 2;
  const y = screenY + ISLAND.top * s;

  ctx.save();
  ctx.shadowColor = ISLAND.shadow;
  ctx.shadowBlur = 8 * s;
  ctx.shadowOffsetY = 2 * s;
  roundRectPath(ctx, x, y, w, h, ISLAND.radius * s);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  // 1px outer ring (box-shadow: 0 0 0 1px)
  const ring = Math.max(1, 1 * s);
  ctx.save();
  ctx.strokeStyle = ISLAND.ring;
  ctx.lineWidth = ring;
  roundRectPath(ctx, x - ring / 2, y - ring / 2, w + ring, h + ring, ISLAND.radius * s + ring / 2);
  ctx.stroke();
  ctx.restore();

  // Camera lens dot, right aligned with 12px inner padding
  const dotR = (ISLAND.cameraSize / 2) * s;
  const cx = x + w - ISLAND.padX * s - dotR;
  const cy = y + h / 2;
  const grad = ctx.createRadialGradient(cx - dotR * 0.3, cy - dotR * 0.3, dotR * 0.05, cx, cy, dotR);
  grad.addColorStop(0, '#18223c');
  grad.addColorStop(1, '#060911');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = Math.max(1, 1 * s);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.5, dotR - ctx.lineWidth / 2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Home indicator: 134x5 pill, 8px from the bottom of the screen. */
export function drawHomeIndicator(ctx, { screenX, screenY, screenW, screenH, scale, isDark }) {
  const s = scale;
  const w = HOME_INDICATOR.width * s;
  const h = HOME_INDICATOR.height * s;
  const x = screenX + (screenW - w) / 2;
  const y = screenY + screenH - HOME_INDICATOR.bottom * s - h;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, Math.min(HOME_INDICATOR.radius * s, h / 2));
  ctx.fillStyle = isDark ? HOME_INDICATOR.dark : HOME_INDICATOR.light;
  ctx.fill();
  ctx.restore();
}

/** CSS-equivalent single-line ellipsis truncation. */
export function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}
