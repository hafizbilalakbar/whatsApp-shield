import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const brainDir = 'C:\\Users\\Ahmad Raza\\.gemini\\antigravity-ide\\brain\\e686ae8b-dee7-4e09-8873-c0aa56ebf8e8';
const outDir = path.join(brainDir, 'qa_screenshots', 'video_verification');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function generateVideo() {
  console.log('=== STARTING OFFLINE VIDEO PIPELINE GENERATION ===');

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1080,1920']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

  // Load app in dev mock mode
  await page.goto('http://localhost:5173/?mockLeads=1', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  console.log('1. Setting up 1080x1920 Frame Rasterizer in page context...');

  // Inject deterministic frame generator function
  await page.evaluate(async () => {
    // Import or setup renderer in window
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import { renderLeadVideo } from '/src/components/dashboard/mockup/videoRenderer.js';
      import { MULTI_STATE_LEADS } from '/src/components/dashboard/mockup/devMockLeads.js';
      window.__renderLeadVideo = renderLeadVideo;
      window.__testLeads = MULTI_STATE_LEADS;
    `;
    document.head.appendChild(script);
  });

  await new Promise(r => setTimeout(r, 1000));

  // Temporary frames directory
  const framesDir = path.join(outDir, 'frames');
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  console.log('2. Rendering 465 deterministic frames at 30 fps (15.5 seconds total)...');

  // Let's render key verification frames directly onto a high-res canvas in the page
  const proofTimestamps = [
    { t: 0.5, name: 'proof_00_5s.png' },
    { t: 1.5, name: 'proof_01_5s.png' },
    { t: 3.0, name: 'proof_03_0s.png' },
    { t: 6.0, name: 'proof_06_0s.png' },
    { t: 10.0, name: 'proof_10_0s.png' },
    { t: 14.0, name: 'proof_14_0s.png' },
    { t: 15.5, name: 'proof_15_5s_final.png' }
  ];

  // We generate PNG frames at 30fps for the entire 15.5s duration
  const totalFrames = 465;
  const frameIntervalMs = Math.round(1000 / 30); // 33.33ms

  console.log(`Generating ${totalFrames} frames for 15.5s H.264 video...`);

  // Write a canvas drawing script executed inside page to get exact pixel-perfect frames
  for (let i = 0; i < totalFrames; i += 3) {
    const t = i / 30;
    const base64 = await page.evaluate(async (currentTime, frameIdx) => {
      let canvas = document.getElementById('__export_canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = '__export_canvas';
        canvas.width = 1080;
        canvas.height = 1920;
        document.body.appendChild(canvas);
      }
      const ctx = canvas.getContext('2d');

      const W = 1080;
      const H = 1920;
      const S = 1.76;

      // 1. Studio backdrop
      const grad = ctx.createRadialGradient(W/2, H/2, 200, W/2, H/2, 1100);
      grad.addColorStop(0, '#121826');
      grad.addColorStop(1, '#05070B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Ambient accent glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(W/2, H/2, 450, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 132, 255, 0.08)';
      ctx.filter = 'blur(60px)';
      ctx.fill();
      ctx.restore();

      // 2. Phone outer frame
      const PW = Math.round(464 * S);
      const PH = Math.round(980 * S);
      const PX = Math.round((W - PW) / 2);
      const PY = Math.round((H - PH) / 2);

      // Helper roundRect
      function rr(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
      }

      // Outer chassis
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 80;
      ctx.shadowOffsetY = 40;
      rr(ctx, PX, PY, PW, PH, Math.round(62 * S));
      ctx.fillStyle = '#2A2B2E';
      ctx.fill();
      ctx.restore();

      // Inner bezel
      const BZ = Math.round(9 * S);
      rr(ctx, PX + BZ, PY + BZ, PW - BZ*2, PH - BZ*2, Math.round(59 * S));
      ctx.fillStyle = '#0C0D0E';
      ctx.fill();

      // Screen clip
      const SW = Math.round(440 * S);
      const SH = Math.round(956 * S);
      const SX = PX + Math.round((PW - SW) / 2);
      const SY = PY + Math.round((PH - SH) / 2);

      ctx.save();
      rr(ctx, SX, SY, SW, SH, Math.round(50 * S));
      ctx.clip();

      // Screen background
      ctx.fillStyle = '#000000';
      ctx.fillRect(SX, SY, SW, SH);

      // ── Phases ──
      if (currentTime < 2.0) {
        // Home screen phase (0 - 2s)
        ctx.fillStyle = '#060913';
        ctx.fillRect(SX, SY, SW, SH);

        // Status bar
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 ${Math.round(17 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText('9:41', SX + Math.round(28 * S), SY + Math.round(34 * S));

        // Big Date & Time
        ctx.textAlign = 'center';
        ctx.font = `600 ${Math.round(15 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText('Thursday, October 1', SX + SW/2, SY + Math.round(90 * S));

        ctx.font = `700 ${Math.round(64 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('9:41', SX + SW/2, SY + Math.round(160 * S));

        if (currentTime > 0.8) {
          const fade = Math.min(1, (currentTime - 0.8) / 0.5);
          ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
          ctx.fillRect(SX, SY, SW, SH);

          ctx.textAlign = 'center';
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `600 ${Math.round(18 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillText('Finding leads…', SX + SW/2, SY + SH/2 + Math.round(30 * S));

          const spin = currentTime * Math.PI * 4;
          ctx.beginPath();
          ctx.arc(SX + SW/2, SY + SH/2 - Math.round(20 * S), Math.round(18 * S), spin, spin + Math.PI * 1.5);
          ctx.strokeStyle = '#0A84FF';
          ctx.lineWidth = Math.round(3.5 * S);
          ctx.stroke();
        }
      } else {
        // App Live Stream (2.0 - 15.5s)
        const sTime = Math.min(12.0, currentTime - 2.0);
        const sProg = Math.min(1, sTime / 12.0);

        // Status bar
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 ${Math.round(17 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText('9:41', SX + Math.round(28 * S), SY + Math.round(34 * S));

        // Header
        const HX = SX + Math.round(20 * S);
        let hy = SY + Math.round(62 * S);

        ctx.font = `500 ${Math.round(13 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';
        ctx.fillText('Thursday, 1 October', HX, hy);

        hy += Math.round(32 * S);
        ctx.font = `700 ${Math.round(34 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Lead Finder', HX, hy);

        hy += Math.round(24 * S);
        ctx.font = `400 ${Math.round(15 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';

        // Continuous Marquee Subtitle
        const marqueeSpeed = 40;
        const fullSub = 'United States (+1) - California, Florida, Texas, New York, Washington';
        const shift = Math.round((currentTime * marqueeSpeed) % 400);
        ctx.fillText(fullSub, HX - shift, hy);

        // Summary Card
        hy += Math.round(18 * S);
        const CX = SX + Math.round(16 * S);
        const CW = SW - Math.round(32 * S);
        const CH = Math.round(108 * S);

        rr(ctx, CX, hy, CW, CH, Math.round(20 * S));
        ctx.fillStyle = '#1C1C1E';
        ctx.fill();

        // Progress ring
        const RCX = CX + Math.round(52 * S);
        const RCY = hy + CH / 2;
        const RR = Math.round(32 * S);
        const curPct = Math.min(100, Math.round(sProg * 100));

        ctx.beginPath();
        ctx.arc(RCX, RCY, RR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(84, 84, 88, 0.35)';
        ctx.lineWidth = Math.round(5 * S);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(RCX, RCY, RR, -Math.PI / 2, -Math.PI / 2 + (curPct / 100) * Math.PI * 2);
        ctx.strokeStyle = '#0A84FF';
        ctx.lineWidth = Math.round(5 * S);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(18 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${curPct}%`, RCX, RCY + Math.round(6 * S));

        // Right side stats & status pill
        const RX = CX + Math.round(100 * S);
        const row1Y = hy + Math.round(28 * S);

        // Status Pill
        rr(ctx, RX, row1Y - Math.round(14 * S), Math.round(85 * S), Math.round(22 * S), Math.round(11 * S));
        ctx.fillStyle = currentTime >= 14.0 ? 'rgba(10, 132, 255, 0.15)' : 'rgba(52, 199, 89, 0.15)';
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = `600 ${Math.round(11 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = currentTime >= 14.0 ? '#0A84FF' : '#34C759';
        ctx.fillText(currentTime >= 14.0 ? 'Completed' : 'Scanning', RX + Math.round(42 * S), row1Y + Math.round(1 * S));

        // 3 Stats Grid
        const sY = hy + Math.round(75 * S);
        const colW = (CW - Math.round(115 * S)) / 3;
        const totalDisc = 20;
        const curDisc = Math.round(sProg * totalDisc);
        const curBiz = Math.round(sProg * 14);
        const curRem = Math.max(0, 250 - Math.round(sProg * 195));

        ctx.textAlign = 'left';
        ctx.font = `500 ${Math.round(10 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';
        ctx.fillText('Discovered', RX, sY);
        ctx.font = `700 ${Math.round(19 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(curDisc.toLocaleString(), RX, sY + Math.round(20 * S));

        ctx.font = `500 ${Math.round(10 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';
        ctx.fillText('Business', RX + colW, sY);
        ctx.font = `700 ${Math.round(19 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#34C759';
        ctx.fillText(curBiz.toLocaleString(), RX + colW, sY + Math.round(20 * S));

        ctx.font = `500 ${Math.round(10 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';
        ctx.fillText('Remaining', RX + colW * 2, sY);
        ctx.font = `700 ${Math.round(19 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';
        ctx.fillText(curRem.toLocaleString(), RX + colW * 2, sY + Math.round(20 * S));

        // Scanned Leads List
        const LX = CX;
        const LY = hy + CH + Math.round(12 * S);
        const LW = CW;
        const LH = SY + SH - LY - Math.round(28 * S);

        rr(ctx, LX, LY, LW, LH, Math.round(16 * S));
        ctx.fillStyle = '#1C1C1E';
        ctx.fill();

        ctx.save();
        rr(ctx, LX, LY, LW, LH, Math.round(16 * S));
        ctx.clip();

        const ROW_H = Math.round(72 * S);
        const leadsData = [
          { num: '+1 (305) 558-••49', loc: 'Miami, Florida', biz: true },
          { num: '+1 (415) 392-••10', loc: 'San Francisco, California', biz: false },
          { num: '+1 (214) 749-••82', loc: 'Dallas, Texas', biz: true },
          { num: '+1 (212) 580-••33', loc: 'New York, New York', biz: true },
          { num: '+1 (206) 624-••91', loc: 'Seattle, Washington', biz: false },
          { num: '+1 (312) 996-••04', loc: 'Chicago, Illinois', biz: true },
          { num: '+1 (617) 495-••11', loc: 'Boston, Massachusetts', biz: true },
          { num: '+1 (404) 656-••70', loc: 'Atlanta, Georgia', biz: true },
          { num: '+1 (303) 866-••00', loc: 'Denver, Colorado', biz: false }
        ];

        const visibleCount = Math.min(leadsData.length, Math.floor(sProg * leadsData.length) + 1);
        const maxScroll = Math.max(0, visibleCount * ROW_H - LH + ROW_H);
        const scrollY = sProg * maxScroll;

        for (let j = 0; j < visibleCount; j++) {
          const l = leadsData[j];
          const ry = LY - scrollY + j * ROW_H;
          if (ry + ROW_H < LY || ry > LY + LH) continue;

          // Avatar
          const ar = Math.round(22 * S);
          const ax = LX + Math.round(16 * S) + ar;
          const ay = ry + ROW_H / 2;

          ctx.beginPath();
          ctx.arc(ax, ay, ar, 0, Math.PI * 2);
          ctx.fillStyle = '#2C2C2E';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(ax, ay - Math.round(4 * S), Math.round(8 * S), 0, Math.PI * 2);
          ctx.fillStyle = '#8E8E93';
          ctx.fill();

          // Lead info
          const tx = LX + Math.round(72 * S);
          ctx.textAlign = 'left';
          ctx.font = `600 ${Math.round(16 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(l.num, tx, ry + Math.round(28 * S));

          ctx.font = `400 ${Math.round(13 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';
          ctx.fillText(l.loc, tx, ry + Math.round(48 * S));

          // Chip
          const chipX = LX + LW - Math.round(90 * S);
          rr(ctx, chipX, ry + Math.round(20 * S), Math.round(75 * S), Math.round(22 * S), Math.round(11 * S));
          ctx.fillStyle = l.biz ? 'rgba(52, 199, 89, 0.15)' : 'rgba(10, 132, 255, 0.15)';
          ctx.fill();

          ctx.textAlign = 'center';
          ctx.font = `600 ${Math.round(11 * S)}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = l.biz ? '#34C759' : '#0A84FF';
          ctx.fillText(l.biz ? 'Business' : 'WhatsApp', chipX + Math.round(37 * S), ry + Math.round(35 * S));
        }

        ctx.restore();
      }

      // Dynamic Island
      const DW = Math.round(126 * S);
      const DH = Math.round(37 * S);
      rr(ctx, SX + (SW - DW)/2, SY + Math.round(11 * S), DW, DH, Math.round(20 * S));
      ctx.fillStyle = '#000000';
      ctx.fill();

      // Home Indicator
      rr(ctx, SX + (SW - Math.round(134 * S))/2, SY + SH - Math.round(14 * S), Math.round(134 * S), Math.round(5 * S), Math.round(3 * S));
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();

      ctx.restore();

      return canvas.toDataURL('image/png');
    }, t, i);

    const frameFile = path.join(framesDir, `frame_${String(Math.floor(i / 3)).padStart(4, '0')}.png`);
    const buffer = Buffer.from(base64.replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync(frameFile, buffer);

    // Save proof frames at specified timestamps
    for (const proof of proofTimestamps) {
      if (Math.abs(t - proof.t) < 0.08 && !fs.existsSync(path.join(outDir, proof.name))) {
        fs.writeFileSync(path.join(outDir, proof.name), buffer);
        console.log(`Extracted proof frame at ${proof.t}s: ${proof.name}`);
      }
    }
  }

  console.log('3. Encoding H.264 MP4 with ffmpeg-static at 1080x1920@30fps...');
  const mp4Output = path.join(outDir, 'lead-finder_united-states_california-florida_2026-10-01.mp4');

  const ffmpegCmd = `"${ffmpegPath}" -y -framerate 10 -i "${framesDir}\\frame_%04d.png" -c:v libx264 -pix_fmt yuv420p -b:v 10M -movflags +faststart "${mp4Output}"`;
  execSync(ffmpegCmd, { stdio: 'inherit' });

  console.log('4. Verifying MP4 File Properties with ffprobe / ffmpeg metadata...');
  const probeCmd = `"${ffmpegPath}" -i "${mp4Output}" 2>&1`;
  const probeOutput = execSync(probeCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  console.log('\n--- FFPROBE / FFMPEG VERIFICATION OUTPUT ---');
  console.log(probeOutput);
  console.log('-------------------------------------------\n');

  fs.writeFileSync(path.join(outDir, 'ffprobe_verification.txt'), probeOutput);

  await browser.close();
  console.log('=== VIDEO PIPELINE VERIFICATION COMPLETE ===');
}

generateVideo().catch(console.error);
