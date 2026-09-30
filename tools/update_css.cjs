const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/index.css');
let css = fs.readFileSync(cssPath, 'utf8');

const fontFace = `/* ── Local Bundled Inter Fonts (Weights 400, 500, 600, 700) ── */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-400.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/inter-500.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-600.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/inter-700.woff2') format('woff2');
}

`;

if (!css.includes("src: url('/fonts/inter-400.woff2')")) {
  css = fontFace + css;
}

const mockupAnim = `
/* ═══════════════════════════════════════════════════════════
   iOS MOBILE MOCKUP PANEL — Animations & Keyframes
   ═══════════════════════════════════════════════════════════ */

@keyframes mockupPanelIn {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes iosRowSlideIn {
  0% {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes iosPillPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.85);
  }
}

@keyframes iosSpinnerFade {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0.2;
  }
}

.animate-ios-row-in {
  animation: iosRowSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}
`;

if (!css.includes('@keyframes iosRowSlideIn')) {
  css += mockupAnim;
}

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Successfully updated src/index.css');
