'use strict';

// Single-instance guard for the WhatsApp session directory.
//
// Why this exists
// ---------------
// Baileys stores Signal pre-keys and per-contact sessions in
// backend/session_auth_info. Two backend processes pointed at the same folder
// both write creds.json and the pre-key files, and both hold a live WhatsApp
// socket for the SAME phone number. WhatsApp then sees two concurrent
// connections from one device, which drops one of them (status 440
// connectionReplaced) and — worse — leaves the shared key store written by
// whichever process flushed last. That produces exactly the symptoms this
// module prevents: "Failed to decrypt message with any known session" /
// "Bad MAC", because the Signal session that the other process had (and
// overwrote) is the only one able to decrypt queued messages.
//
// The guard is deliberately fail-safe:
//   - a lock file records the owning PID
//   - if the recorded PID is alive AND is a different process, startup aborts
//   - a stale lock (dead PID) is reclaimed automatically
//   - the lock is released on exit so a normal restart is never blocked

const fs = require('fs');
const path = require('path');

const LOCK_FILE = '.whatsapp-session.lock';

const isProcessAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    // Signal 0 performs the permission/existence check without delivering.
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but is owned by another user.
    if (err && err.code === 'EPERM') return true;
    return false;
  }
};

const readLock = (lockPath) => {
  try {
    if (!fs.existsSync(lockPath)) return null;
    const raw = fs.readFileSync(lockPath, 'utf8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { pid: Number(parsed.pid), startedAt: parsed.startedAt || null };
  } catch (_) {
    // A corrupt lock file is treated as "no lock" and reclaimed below.
    return null;
  }
};

/**
 * Claim exclusive ownership of the session directory.
 *
 * @param {string} sessionDir Absolute path to the Baileys auth folder.
 * @returns {{ lockPath: string, release: () => void, acquired: boolean, holder?: object }}
 */
const acquireSessionLock = (sessionDir) => {
  const lockPath = path.join(sessionDir, LOCK_FILE);

  fs.mkdirSync(sessionDir, { recursive: true });

  const existing = readLock(lockPath);

  if (existing && existing.pid !== process.pid && isProcessAlive(existing.pid)) {
    return { acquired: false, lockPath, release: () => {}, holder: existing };
  }

  if (existing && existing.pid === process.pid) {
    // Re-entrant call inside the same process (e.g. a reconnect probe) — the
    // existing lock is already ours, so do not fail.
    return { acquired: true, lockPath, release: () => {} };
  }

  if (existing) {
    console.warn(
      `[INSTANCE] Reclaiming stale session lock from PID ${existing.pid} (process is no longer running).`
    );
  }

  const payload = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() });

  try {
    // 'wx' fails if the file already exists — this is the atomic claim.
    fs.writeFileSync(lockPath, payload, { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    // Lost a race against a concurrent starter: re-read and report the holder.
    const nowHolder = readLock(lockPath);
    if (nowHolder && nowHolder.pid !== process.pid && isProcessAlive(nowHolder.pid)) {
      return { acquired: false, lockPath, release: () => {}, holder: nowHolder };
    }
    try { fs.writeFileSync(lockPath, payload, 'utf8'); } catch (_) {}
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      const current = readLock(lockPath);
      // Only remove the lock if we still own it.
      if (!current || current.pid === process.pid) {
        fs.unlinkSync(lockPath);
      }
    } catch (_) {}
  };

  process.once('exit', release);

  return { acquired: true, lockPath, release };
};

module.exports = { acquireSessionLock, isProcessAlive, LOCK_FILE };