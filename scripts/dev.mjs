import { spawn } from 'node:child_process';
import process from 'node:process';

/**
 * Dev orchestrator: starts the backend AND the Vite frontend together and keeps
 * the backend alive if it ever dies.
 *
 * Why this exists: `npm run dev` used to spawn the backend once. Any crash
 * (syntax error, unhandled rejection, OOM) left Vite running while every
 * /api call and the WebSocket proxy target returned ECONNREFUSED, so Live Scan
 * looked broken with no way back except restarting the terminal by hand.
 *
 * There is deliberately NO file watcher here. The backend is restarted only when
 * the process itself exits, so the WhatsApp session folder, scan results,
 * backend/cache media and any temp folder can never trigger a restart (and can
 * never interrupt a running scan).
 */

const BACKEND_MAX_RESTARTS = 10;
const BACKEND_RESTART_DELAY_MS = 2000;

let shuttingDown = false;
let restarts = 0;
let backend = null;
let frontend = null;

const stop = (signal, code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of [backend, frontend]) {
    if (child && child.exitCode === null) {
      try { child.kill(signal); } catch { /* already gone */ }
    }
  }
  setTimeout(() => process.exit(code), 300).unref();
};

const startFrontend = () => {
  frontend = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });
  frontend.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal === 'SIGINT' || signal === 'SIGTERM') return;
    console.error(`[dev] frontend exited (code ${code}) — shutting down.`);
    stop('SIGTERM', code ?? 0);
  });
};

const startBackend = () => {
  backend = spawn(process.execPath, ['backend/server.js'], { stdio: 'inherit', shell: false });

  backend.on('exit', (code, signal) => {
    if (shuttingDown) return;
    // Ctrl+C / explicit stop: honour it instead of fighting the user.
    if (signal === 'SIGINT' || signal === 'SIGTERM' || code === 0) {
      stop('SIGTERM', typeof code === 'number' ? code : 0);
      return;
    }
    restarts += 1;
    if (restarts > BACKEND_MAX_RESTARTS) {
      console.error(`[dev] backend crashed ${restarts} times — giving up. Fix the error above, then run npm run dev again.`);
      stop('SIGTERM', 1);
      return;
    }
    console.error(`[dev] backend exited unexpectedly (code ${code}, signal ${signal || 'none'}) — restarting in ${BACKEND_RESTART_DELAY_MS / 1000}s.`);
    setTimeout(() => {
      if (!shuttingDown) startBackend();
    }, BACKEND_RESTART_DELAY_MS).unref();
  });
};

process.on('SIGINT', () => stop('SIGINT', 0));
process.on('SIGTERM', () => stop('SIGTERM', 0));

startBackend();
startFrontend();
