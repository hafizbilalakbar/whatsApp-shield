/**
 * MobileMockupPanel.jsx
 *
 * Premium iPhone 18 Pro Max-style floating side panel.
 * - Displays actual leads from the existing scanning engine in real time.
 * - Masks phone numbers for privacy (never modifies original data).
 * - Canvas-based video recording via MediaRecorder → downloadable WebM/MP4.
 * - Fully isolated; uses only existing WebSocket context.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from 'react';
import {
  Smartphone, X, Video, Square, Pause, Play, Download,
  Wifi, Signal, Battery, Scan, CircleDot,
  CheckCircle2, AlertCircle, ChevronRight, Zap
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { cn } from '../ui/cn';
import { FlagIcon } from '../ui/FlagIcon';

/* ─────────────────────────────────────────────
   UTILITY: Phone number masking
   Applied at render — original data never touched.
   ───────────────────────────────────────────── */
function maskPhone(raw) {
  const str = String(raw || '').trim();
  if (!str) return '—';
  const plus = str.startsWith('+') ? '+' : '';
  const digits = str.replace(/\D/g, '');
  if (digits.length < 4) return str;
  const prefix = digits.slice(0, Math.min(3, digits.length - 2));
  const suffix = digits.slice(-2);
  const hiddenLen = digits.length - prefix.length - suffix.length;
  const dots = '•'.repeat(Math.max(4, hiddenLen));
  return `${plus}${prefix} ${dots} ${suffix}`;
}

function getRawPhone(result) {
  return (
    result?.formatted ||
    result?.cleanNumber ||
    result?.number ||
    result?.jid?.replace('@s.whatsapp.net', '') ||
    ''
  );
}

function fmtClock(ms) {
  if (!ms || ms < 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ─────────────────────────────────────────────
   CANVAS HELPER
   ───────────────────────────────────────────── */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCanvasFrame(ctx, cW, cH, leadCount, scanState) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, cW, cH);
  bg.addColorStop(0, '#070d1a');
  bg.addColorStop(1, '#030709');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cW, cH);

  // Grid
  ctx.strokeStyle = 'rgba(0,217,126,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < cW; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,cH); ctx.stroke(); }
  for (let y = 0; y < cH; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cW,y); ctx.stroke(); }

  const pW = cW * 0.78, pH = cH * 0.75;
  const pX = (cW - pW) / 2, pY = (cH - pH) / 2;
  const r = 36;

  // Phone shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,217,126,0.15)';
  ctx.shadowBlur = 36;
  const pg = ctx.createLinearGradient(pX, pY, pX + pW, pY + pH);
  pg.addColorStop(0, '#1e2535'); pg.addColorStop(1, '#111827');
  roundRectPath(ctx, pX, pY, pW, pH, r);
  ctx.fillStyle = pg; ctx.fill();
  ctx.restore();

  // Phone border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
  roundRectPath(ctx, pX, pY, pW, pH, r); ctx.stroke();

  // Screen
  const sx = pX + 6, sy = pY + 6 + 28, sw = pW - 12, sh = pH - 12 - 28;
  const sg = ctx.createLinearGradient(sx, sy, sx, sy + sh);
  sg.addColorStop(0, '#0f1521'); sg.addColorStop(1, '#080d18');
  roundRectPath(ctx, sx, sy, sw, sh, r - 6);
  ctx.fillStyle = sg; ctx.fill();

  // Dynamic Island
  const diW = 80, diH = 22;
  roundRectPath(ctx, pX + (pW - diW)/2, pY + 12, diW, diH, 12);
  ctx.fillStyle = '#000'; ctx.fill();

  // Time
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 9px system-ui';
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(t, sx + 10, sy + 14);

  // Scanning header
  const hY = sy + 20;
  ctx.fillStyle = 'rgba(0,217,126,0.12)';
  roundRectPath(ctx, sx + 6, hY, sw - 12, 24, 6); ctx.fill();
  ctx.fillStyle = '#00D97E'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
  const lbl = scanState === 'scanning' ? '● DISCOVERING LEADS...' : '● WHATSAPP SHIELD';
  ctx.fillText(lbl, sx + sw / 2, hY + 16);
  ctx.textAlign = 'left';

  // Lead count
  if (leadCount > 0) {
    ctx.fillStyle = '#00D97E'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(String(leadCount), sx + sw / 2, hY + 64);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px system-ui';
    ctx.fillText('active leads found', sx + sw / 2, hY + 78);
    ctx.textAlign = 'left';
  }

  // Scan beam
  if (scanState === 'scanning') {
    const t2 = (Date.now() / 1200) % 1;
    const ly = sy + 24 + (sh - 32) * t2;
    const lg = ctx.createLinearGradient(sx, ly, sx + sw, ly);
    lg.addColorStop(0, 'rgba(0,217,126,0)');
    lg.addColorStop(0.5, 'rgba(0,217,126,0.5)');
    lg.addColorStop(1, 'rgba(0,217,126,0)');
    ctx.strokeStyle = lg; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx, ly); ctx.lineTo(sx + sw, ly); ctx.stroke();
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.font = '8px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('WhatsApp Shield • Lead Discovery Tool', cW / 2, cH - 14);
  ctx.textAlign = 'left';
}

/* ─────────────────────────────────────────────
   RECORDING HOOK
   ───────────────────────────────────────────── */
function useCanvasRecorder(frameRef) {
  const [recState, setRecState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [error, setError] = useState(null);

  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const pauseAccRef = useRef(0);
  const pauseAtRef = useRef(null);
  const recStateRef = useRef('idle');

  useEffect(() => { recStateRef.current = recState; }, [recState]);

  const drawLoop = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    const el = frameRef.current;
    if (ctx && canvas) {
      const lc = parseInt(el?.dataset?.leadCount || '0', 10);
      const ss = el?.dataset?.scanState || 'idle';
      drawCanvasFrame(ctx, canvas.width, canvas.height, lc, ss);
    }
    rafRef.current = requestAnimationFrame(drawLoop);
  }, [frameRef]);

  const startRecording = useCallback(() => {
    if (recStateRef.current === 'recording') return;
    setError(null);
    chunksRef.current = [];
    if (videoUrl) { URL.revokeObjectURL(videoUrl); }
    setVideoUrl(null); setVideoBlob(null);

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 540;
      canvasRef.current.height = 960;
    }
    ctxRef.current = canvasRef.current.getContext('2d');

    let stream;
    try { stream = canvasRef.current.captureStream(30); }
    catch (e) { setError('Canvas stream not supported.'); return; }

    const mimes = [
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4',
    ];
    const mime = mimes.find(m => MediaRecorder.isTypeSupported(m)) || '';

    let mr;
    try { mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 }); }
    catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { setError('MediaRecorder not supported.'); return; } }

    mr.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoBlob(blob); setVideoUrl(url); setRecState('stopped');
    };
    mr.onerror = (e) => setError(`Recording error: ${e.error?.message || 'unknown'}`);

    mr.start(250);
    mrRef.current = mr;
    startRef.current = Date.now();
    pauseAccRef.current = 0; pauseAtRef.current = null;
    setRecState('recording'); setElapsed(0);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawLoop);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const pausedMs = pauseAtRef.current ? (Date.now() - pauseAtRef.current) : 0;
      setElapsed(Date.now() - startRef.current - pauseAccRef.current - pausedMs);
    }, 1000);
  }, [drawLoop, videoUrl]);

  const pauseRecording = useCallback(() => {
    if (recStateRef.current !== 'recording') return;
    try { mrRef.current?.pause(); } catch (e) { /* ok */ }
    pauseAtRef.current = Date.now();
    setRecState('paused');
  }, []);

  const resumeRecording = useCallback(() => {
    if (recStateRef.current !== 'paused') return;
    if (pauseAtRef.current) { pauseAccRef.current += Date.now() - pauseAtRef.current; pauseAtRef.current = null; }
    try { mrRef.current?.resume(); } catch (e) { /* ok */ }
    setRecState('recording');
  }, []);

  const stopRecording = useCallback(() => {
    const s = recStateRef.current;
    if (s === 'idle' || s === 'stopped') return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { mrRef.current?.stop(); } catch (e) { /* ok */ }
    mrRef.current = null;
  }, []);

  const resetRecording = useCallback(() => {
    stopRecording();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null); setVideoBlob(null); setElapsed(0); setError(null); setRecState('idle');
  }, [stopRecording, videoUrl]);

  const downloadVideo = useCallback((filename) => {
    if (!videoUrl) return;
    const ext = videoBlob?.type?.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = videoUrl; a.download = `${filename || 'LeadScan_Recording'}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [videoUrl, videoBlob]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    try { mrRef.current?.stop(); } catch (e) { /* ok */ }
  }, []);

  return { recState, elapsed, videoUrl, videoBlob, error, startRecording, pauseRecording, resumeRecording, stopRecording, resetRecording, downloadVideo };
}

/* ─────────────────────────────────────────────
   LEAD CARD (mobile screen)
   ───────────────────────────────────────────── */
const MobileLeadCard = memo(function MobileLeadCard({ lead, isNewest }) {
  const raw = getRawPhone(lead);
  const masked = maskPhone(raw);
  const name = lead.displayName || lead.verifiedName || null;
  const isBiz = lead.isBusiness === true;
  const iso = lead.countryIso || lead.country || '';
  const locParts = [lead.city, lead.state || lead.region, lead.countryName || lead.country].filter(Boolean);
  const loc = locParts.join(', ');
  const digits = String(lead.cleanNumber || lead.number || '').replace(/\D/g, '');
  const avatarSrc = digits ? `/api/profile-picture?phone=${digits}` : null;
  const [imgOk, setImgOk] = useState(false);

  return (
    <div className={cn(
      'flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all duration-300',
      isNewest
        ? 'bg-emerald-500/10 border-emerald-500/30 animate-mockup-lead-in shadow-[0_0_10px_rgba(52,211,153,0.12)]'
        : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06]'
    )}>
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/8 border border-white/15 flex items-center justify-center">
          {avatarSrc && (
            <img src={avatarSrc} alt="" loading="lazy" decoding="async"
              className={cn('w-full h-full object-cover transition-opacity duration-300', imgOk ? 'opacity-100' : 'opacity-0')}
              onLoad={() => setImgOk(true)} onError={() => setImgOk(false)}
            />
          )}
          {!imgOk && (
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white/30">
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" opacity=".4" />
            </svg>
          )}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0f1521] shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono text-[10px] font-semibold text-white/85 tracking-wide">{masked}</span>
          <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded-full border uppercase tracking-wider',
            isBiz ? 'bg-blue-500/15 text-blue-300 border-blue-400/20' : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20')}>
            {isBiz ? 'Biz' : 'Active'}
          </span>
        </div>
        {name && <p className="text-[10px] text-white/55 truncate mt-0.5 font-medium">{name}</p>}
        {(iso || loc) && (
          <div className="flex items-center gap-1 mt-0.5">
            {iso && <FlagIcon code={iso} size={9} className="shrink-0" />}
            {loc && <span className="text-[9px] text-white/35 truncate">{loc}</span>}
          </div>
        )}
      </div>
      <ChevronRight size={10} className="text-white/15 shrink-0" />
    </div>
  );
});

/* ─────────────────────────────────────────────
   RECORDING CONTROLS
   ───────────────────────────────────────────── */
function RecordingControls({ rec, onAutoFilename }) {
  const { recState, elapsed, videoUrl, error, startRecording, pauseRecording, resumeRecording, stopRecording, resetRecording, downloadVideo } = rec;

  return (
    <div className="shrink-0 border-t border-white/[0.05] bg-black/30 px-3 py-2 flex flex-col gap-1.5">
      {error && (
        <div className="flex items-center gap-1.5 text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5">
          <AlertCircle size={9} className="shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* State badge */}
        <div className={cn(
          'flex items-center gap-1 text-[9px] font-mono font-bold rounded-full px-2 py-0.5 border shrink-0',
          recState === 'recording' ? 'bg-red-500/15 text-red-400 border-red-500/25'
            : recState === 'paused' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
            : recState === 'stopped' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
            : 'bg-white/5 text-white/25 border-white/10'
        )}>
          <span className={cn('w-1 h-1 rounded-full',
            recState === 'recording' ? 'bg-red-400 animate-pulse' : 'bg-current')} />
          {recState === 'recording' ? 'REC' : recState === 'paused' ? 'PAUSED' : recState === 'stopped' ? 'DONE' : 'READY'}
        </div>

        {(recState === 'recording' || recState === 'paused') && (
          <span className="font-mono text-[9px] text-white/40">{fmtClock(elapsed)}</span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {recState === 'idle' && (
            <button onClick={startRecording}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25 text-[9px] font-semibold transition-all">
              <Video size={9} /> Record
            </button>
          )}
          {recState === 'recording' && (<>
            <button onClick={pauseRecording} className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 transition-all" title="Pause"><Pause size={9} /></button>
            <button onClick={stopRecording} className="p-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25 transition-all" title="Stop"><Square size={9} /></button>
          </>)}
          {recState === 'paused' && (<>
            <button onClick={resumeRecording} className="p-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 transition-all" title="Resume"><Play size={9} /></button>
            <button onClick={stopRecording} className="p-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25 transition-all" title="Stop"><Square size={9} /></button>
          </>)}
          {recState === 'stopped' && videoUrl && (<>
            <button onClick={() => downloadVideo(onAutoFilename())}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 text-[9px] font-semibold transition-all">
              <Download size={9} /> Download
            </button>
            <button onClick={resetRecording} className="px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/35 border border-white/10 text-[9px] transition-all" title="New recording">
              New
            </button>
          </>)}
        </div>
      </div>

      {recState === 'stopped' && videoUrl && (
        <video src={videoUrl} controls preload="metadata"
          className="w-full rounded-lg max-h-20 bg-black border border-white/10 mt-0.5" />
      )}

      {recState === 'idle' && (
        <p className="text-[8px] text-white/20 text-center">9:16 canvas · Instagram Reels ready</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PHONE FRAME (mockup DOM element)
   ───────────────────────────────────────────── */
const MAX_LEADS = 50;

function PhoneFrame({ leads, scanState, progressPercent, leadCount, frameRef }) {
  const listEndRef = useRef(null);
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [leads.length]);

  const isScanning = scanState === 'SCANNING' || scanState === 'STARTING';
  const isComplete = scanState === 'COMPLETED';
  const isPaused = scanState === 'PAUSED';
  const isStopped = scanState === 'STOPPED';
  const isDone = isComplete || isStopped;
  const isCooling = scanState === 'COOLING';

  const statusText = isScanning ? 'Discovering Leads...'
    : isPaused ? 'Scan Paused'
    : isComplete ? 'Scan Complete!'
    : isStopped ? 'Scan Stopped'
    : isCooling ? 'Cooling Down...'
    : 'Ready';

  const statusColor = isScanning ? 'text-emerald-400'
    : isPaused ? 'text-amber-400'
    : isComplete ? 'text-cyan-400'
    : isStopped ? 'text-red-400'
    : isCooling ? 'text-yellow-400'
    : 'text-white/40';

  return (
    <div
      ref={frameRef}
      data-lead-count={leadCount}
      data-scan-state={isScanning ? 'scanning' : 'idle'}
      className="relative mx-auto select-none"
      style={{
        width: 248,
        height: 506,
        borderRadius: 42,
        background: 'linear-gradient(145deg, #2a3346 0%, #1a2235 40%, #111827 100%)',
        boxShadow: [
          '0 0 0 1px rgba(255,255,255,0.09)',
          '0 0 0 3px #0d1320',
          '0 0 0 4px rgba(255,255,255,0.05)',
          '0 24px 60px rgba(0,0,0,0.75)',
          isScanning ? '0 0 50px rgba(0,217,126,0.10)' : '0 0 24px rgba(0,0,0,0.4)',
        ].join(', '),
        padding: 3,
        transition: 'box-shadow 0.5s ease',
      }}
    >
      {/* Volume / power buttons */}
      {[88, 128, 170].map((t, i) => (
        <div key={i} className="absolute -left-[3px] h-7 w-[3px] rounded-l-sm bg-white/10"
          style={{ top: t }} />
      ))}
      <div className="absolute -right-[3px] top-[114px] h-11 w-[3px] rounded-r-sm bg-white/10" />

      {/* Screen */}
      <div className="flex flex-col overflow-hidden relative h-full"
        style={{ borderRadius: 39, background: 'linear-gradient(180deg, #0f1521 0%, #080d18 100%)' }}>

        {/* Dynamic Island */}
        <div className="absolute z-20 top-3 left-1/2 -translate-x-1/2"
          style={{ width: 100, height: 28, borderRadius: 18, background: '#000', boxShadow: '0 0 0 1px rgba(255,255,255,0.03)' }}>
          {isScanning && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Recording active" />
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-0.5 shrink-0">
          <span className="text-[9px] font-semibold text-white/60 font-mono">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex items-center gap-1">
            <Signal size={9} className="text-white/55" />
            <Wifi size={9} className="text-white/55" />
            <Battery size={9} className="text-white/55" />
          </div>
        </div>

        {/* App header */}
        <div className="px-3 pt-1.5 pb-1 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center">
                <Zap size={11} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-[9.5px] font-bold text-white/85 leading-none">Shield Scanner</p>
                <p className={cn('text-[8.5px] leading-none mt-0.5', statusColor)}>{statusText}</p>
              </div>
            </div>
            {isScanning && (
              <span className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                <span className="w-1 h-1 rounded-full bg-red-400 animate-ping" />LIVE
              </span>
            )}
          </div>
        </div>

        {/* Scanning beam */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-[39px]">
            <div className="mockup-scan-beam" aria-hidden="true" />
          </div>
        )}

        {/* Progress */}
        {(isScanning || (progressPercent > 0 && !isDone)) && (
          <div className="px-3 mb-1 shrink-0">
            <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        {/* Leads counter strip */}
        {leadCount > 0 && (
          <div className="mx-2.5 mb-1.5 shrink-0 flex items-center justify-between px-2 py-1 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
            <div className="flex items-center gap-1">
              <CircleDot size={9} className="text-emerald-400" />
              <span className="text-[9px] text-emerald-400 font-semibold">Leads Found</span>
            </div>
            <span className="font-mono font-bold text-emerald-300 text-xs">{leadCount}</span>
          </div>
        )}

        {/* Lead list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1"
          style={{ scrollbarWidth: 'none' }}>
          {leads.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 min-h-[150px]">
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center mb-2',
                isScanning ? 'bg-emerald-500/12' : 'bg-white/4')}>
                <Scan size={16} className={cn(isScanning ? 'text-emerald-400 animate-pulse' : 'text-white/15')} />
              </div>
              <p className="text-[10px] font-semibold text-white/40">
                {isScanning ? 'Scanning for leads...' : isDone ? 'No leads found' : 'Waiting to start'}
              </p>
              <p className="text-[9px] text-white/20 mt-0.5">
                {isScanning ? 'Results appear here as discovered' : 'Start a scan to see live results'}
              </p>
            </div>
          ) : (
            leads.map((lead, i) => (
              <MobileLeadCard
                key={lead.cleanNumber || lead.number || lead.jid || i}
                lead={lead}
                isNewest={i === leads.length - 1 && isScanning}
              />
            ))
          )}
          <div ref={listEndRef} />
        </div>

        {/* Complete overlay */}
        {isComplete && (
          <div className="absolute inset-0 flex items-center justify-center z-20 rounded-[39px]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="text-center px-6">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto mb-2 animate-bounce" />
              <p className="text-sm font-bold text-white">Scan Complete!</p>
              <p className="text-[10px] text-emerald-400 mt-1">{leadCount} leads discovered</p>
            </div>
          </div>
        )}

        {/* Home indicator */}
        <div className="shrink-0 flex justify-center pb-2 pt-1">
          <div className="w-16 h-1 rounded-full bg-white/18" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PANEL
   ───────────────────────────────────────────── */
export default function MobileMockupPanel({ isOpen, onClose }) {
  const { resultsList, scanState, progressPercent } = useWebSocket();
  const frameRef = useRef(null);
  const rec = useCanvasRecorder(frameRef);

  const registeredLeads = useMemo(() => resultsList.filter(r => r.exists === true), [resultsList]);
  const visibleLeads = useMemo(() => registeredLeads.slice(-MAX_LEADS), [registeredLeads]);
  const leadCount = registeredLeads.length;
  const isScanning = scanState === 'SCANNING' || scanState === 'STARTING';

  // Auto-start recording when scan begins and panel is open
  useEffect(() => {
    if (isOpen && isScanning && rec.recState === 'idle') {
      rec.startRecording();
    }
  }, [isOpen, isScanning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-stop recording on scan end
  useEffect(() => {
    const isDone = scanState === 'COMPLETED' || scanState === 'STOPPED';
    if (isDone && (rec.recState === 'recording' || rec.recState === 'paused')) {
      const t = setTimeout(() => rec.stopRecording(), 1500);
      return () => clearTimeout(t);
    }
  }, [scanState]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAutoFilename = useCallback(() => {
    const country = window.whatsappShieldCountryName || 'Unknown';
    const region = window.whatsappShieldRegion?.name || '';
    const date = new Date().toISOString().slice(0, 10);
    return ['LeadScan', country, region, date].filter(Boolean).join('_').replace(/\s+/g, '-');
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed right-4 bottom-24 z-[9999] flex flex-col"
      style={{
        width: 284,
        maxHeight: 'calc(100dvh - 120px)',
        borderRadius: 18,
        background: 'linear-gradient(135deg, #0d1420 0%, #080e1a 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,217,126,0.07), inset 0 1px 0 rgba(255,255,255,0.04)',
        animation: 'mockupPanelIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <Smartphone size={11} className="text-emerald-400" />
          </div>
          <span className="text-[11px] font-bold text-white/75">Live Mobile Preview</span>
          {isScanning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
        </div>
        <button onClick={onClose}
          className="w-5 h-5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/35 hover:text-white/60 transition-all">
          <X size={10} />
        </button>
      </div>

      {/* Phone */}
      <div className="flex-1 min-h-0 flex items-center justify-center py-3 px-2 overflow-y-auto">
        <PhoneFrame
          leads={visibleLeads}
          scanState={scanState}
          progressPercent={progressPercent}
          leadCount={leadCount}
          frameRef={frameRef}
        />
      </div>

      {/* Controls */}
      <RecordingControls rec={rec} onAutoFilename={getAutoFilename} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   TRIGGER BUTTON (floating, LinkedIn-style)
   ───────────────────────────────────────────── */
export function MobileMockupTrigger({ isOpen, onClick, isScanning, leadCount }) {
  return (
    <button
      onClick={onClick}
      title={isOpen ? 'Close Live Preview' : 'Open Live Mobile Preview'}
      aria-label={isOpen ? 'Close Live Preview' : 'Open Live Mobile Preview'}
      className={cn(
        'fixed bottom-6 right-6 z-[9998]',
        'flex items-center gap-2 px-3 py-2 rounded-2xl',
        'border transition-all duration-300',
        'backdrop-blur-xl',
        isOpen
          ? 'bg-emerald-500/20 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/30'
          : 'bg-[#0d1420]/92 border-white/10 text-white/65 hover:text-white/85 hover:border-white/18'
      )}
      style={{
        boxShadow: isScanning
          ? '0 0 0 1px rgba(0,217,126,0.25), 0 8px 28px rgba(0,0,0,0.5), 0 0 20px rgba(0,217,126,0.12)'
          : '0 8px 28px rgba(0,0,0,0.35)',
      }}
    >
      <div className="relative">
        <Smartphone size={14} className="shrink-0" />
        {isScanning && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
        )}
      </div>
      <span className="text-[10px] font-bold whitespace-nowrap">
        {isOpen ? 'Close Preview' : 'Live Preview'}
      </span>
      {leadCount > 0 && (
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/25">
          {leadCount}
        </span>
      )}
    </button>
  );
}
