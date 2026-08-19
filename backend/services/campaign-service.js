'use strict';
// Centralized campaign storage + deletion service.
//
// Every campaign-deletion path in the app (History page, Profile page,
// Step-5 reports, "clear all shield contacts") must go through this module so
// the removal of history metadata and the cleanup of campaign-owned resources
// (cached profile pictures) always behave identically and safely.
//
// Ownership model
// ---------------
// The backend hosts one authenticated WhatsApp session at a time, but campaigns
// persist on disk across sessions. Campaigns are tagged with the owner number in
// one of two ways (both supported here):
//   - bulk-check campaigns: `phone` holds the owner's digits (no ownerPhone)
//   - message-agent conversations: `ownerPhone` holds the owner's digits and
//     `phone` holds the other party's number
// A delete request only ever removes campaigns that belong to the CURRENT
// session owner; anything else is refused and left untouched.
//
// Profile-picture cache safety
// ----------------------------
// Cached avatars under backend/cache/profile-pictures are keyed by phone digits
// and are SHARED across sessions/campaigns. A picture is removed only when no
// remaining campaign or contact still references that number, so deleting one
// user's campaign can never destroy a picture another user still needs.

const fs = require('fs');
const path = require('path');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

const createCampaignService = (deps = {}) => {
  const {
    loadCampaignHistory,
    saveCampaignHistory,
    loadContacts,
    profilePicCache,
    profilePicCachePath,
    profilePicInFlight,
    log = console.log.bind(console),
  } = deps;

  const profilePicCacheDir = () => {
    try {
      return path.dirname(profilePicCachePath('0'));
    } catch (_) {
      return null;
    }
  };

  // Extract every phone number referenced by a campaign's results, as digits.
  // These are the numbers whose cached profile pictures belong to the campaign.
  const campaignPhoneNumbers = (campaign) => {
    const nums = new Set();
    if (!campaign || !Array.isArray(campaign.results)) return nums;
    for (const r of campaign.results) {
      if (!r) continue;
      for (const field of ['number', 'cleanNumber', 'formatted', 'whatsappId', 'jid']) {
        const raw = r[field];
        if (!raw) continue;
        const digits = String(raw).split('@')[0].replace(/\D/g, '');
        if (digits) { nums.add(digits); break; }
      }
    }
    return nums;
  };

  // Global reference index: every number still referenced by ANY campaign or
  // contact on disk. Shared pictures are only safe to delete when no remaining
  // resource references them, across all sessions/users.
  const collectReferencedProfilePicNumbers = () => {
    const referenced = new Set();
    for (const c of loadCampaignHistory()) {
      for (const num of campaignPhoneNumbers(c)) referenced.add(num);
    }
    for (const c of loadContacts()) {
      const digits = normalizeDigits(c.phone || c.number);
      if (digits) referenced.add(digits);
    }
    return referenced;
  };

  const deleteProfilePicCacheEntry = (phone) => {
    const digits = normalizeDigits(phone);
    if (!digits) return;
    if (profilePicCache) profilePicCache.delete(digits);
    if (profilePicInFlight) profilePicInFlight.delete(digits);
    const filePath = profilePicCachePath(digits);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        log(`Failed to delete cached profile picture for ${digits}:`, err.message);
      }
    }
  };

  const sweepOrphanedProfilePicFiles = (referenced, options = {}) => {
    const { minAgeMs = 0 } = options;
    const dir = profilePicCacheDir();
    if (!dir) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        log('Failed to list profile-picture cache directory:', err.message);
      }
      return;
    }
    const now = Date.now();
    for (const file of entries) {
      const match = /^(\d+)\.jpg$/.exec(file);
      if (!match || referenced.has(match[1])) continue;
      const filePath = path.join(dir, file);
      if (minAgeMs > 0) {
        try {
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs < minAgeMs) continue;
        } catch (_) {
          continue;
        }
      }
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        log(`Failed to delete orphaned cached profile picture ${file}:`, err.message);
      }
    }
  };

  // Best-effort cleanup invoked after campaign deletion. Removes cached avatars
  // for the deleted campaigns' numbers when no remaining campaign or contact
  // still references them, then sweeps any leftover orphaned cache files.
  // Never throws.
  const cleanupProfilePicCacheAfterCampaignDeletion = (deletedCampaigns) => {
    try {
      const referenced = collectReferencedProfilePicNumbers();
      const list = Array.isArray(deletedCampaigns) ? deletedCampaigns : (deletedCampaigns ? [deletedCampaigns] : []);
      for (const campaign of list) {
        for (const num of campaignPhoneNumbers(campaign)) {
          if (!referenced.has(num)) deleteProfilePicCacheEntry(num);
        }
      }
      sweepOrphanedProfilePicFiles(referenced);
    } catch (err) {
      log('Profile-picture cache cleanup failed:', err.message);
    }
  };

  // Full maintenance sweep. Removes unreferenced cache files older than
  // minAgeMs, then enforces a hard ceiling so the cache directory can never
  // accumulate thousands of obsolete images over time. Only unreferenced files
  // are ever evicted by the ceiling — referenced pictures are always kept.
  const sweepProfilePicCache = (options = {}) => {
    const { minAgeMs = 15 * 60 * 1000, maxFiles = 10000 } = options;
    try {
      const referenced = collectReferencedProfilePicNumbers();
      sweepOrphanedProfilePicFiles(referenced, { minAgeMs });
      const dir = profilePicCacheDir();
      if (!dir) return;
      let entries = [];
      try {
        entries = fs.readdirSync(dir);
      } catch (_) {
        return;
      }
      const orphans = entries
        .filter((f) => /^\d+\.jpg$/.test(f) && !referenced.has(f.replace(/\.jpg$/, '')))
        .map((f) => {
          const p = path.join(dir, f);
          try { return { file: f, p, mtimeMs: fs.statSync(p).mtimeMs }; }
          catch (_) { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => a.mtimeMs - b.mtimeMs);
      let excess = entries.length - maxFiles;
      for (const o of orphans) {
        if (excess <= 0) break;
        try {
          fs.unlinkSync(o.p);
          excess -= 1;
        } catch (err) {
          log(`Failed to evict cached profile picture ${o.file}:`, err.message);
        }
      }
    } catch (err) {
      log('Profile-picture cache sweep failed:', err.message);
    }
  };

  // Campaigns owned by a given user, supporting both ownership conventions
  // (phone-as-owner for bulk-check runs, ownerPhone-as-owner for conversations).
  const campaignsForOwnerPhone = (ownerDigits) => {
    if (!ownerDigits) return [];
    return loadCampaignHistory().filter((c) =>
      normalizeDigits(c.ownerPhone) === ownerDigits || normalizeDigits(c.phone) === ownerDigits
    );
  };

  // Remove exactly the campaigns whose ids are in `ids` AND belong to
  // `ownerDigits`. Never deletes another user's campaigns. Persists the new
  // history and runs profile-picture cache cleanup for what was removed.
  // Returns { deleted, kept, notFound, denied }.
  const deleteCampaignsById = (ids, ownerDigits) => {
    if (!ownerDigits) {
      // Fail closed: no authenticated session, nothing may be deleted.
      return { deleted: [], kept: loadCampaignHistory(), notFound: ids.slice(), denied: true };
    }
    const idSet = new Set(ids.map((id) => String(id)));
    const allCampaigns = loadCampaignHistory();
    const deleted = [];
    const kept = [];
    const notFound = [];
    for (const c of allCampaigns) {
      if (!idSet.has(c.id)) {
        kept.push(c);
        continue;
      }
      const owned = normalizeDigits(c.ownerPhone) === ownerDigits || normalizeDigits(c.phone) === ownerDigits;
      if (owned) deleted.push(c);
      else notFound.push(c.id);
    }
    if (deleted.length > 0) {
      saveCampaignHistory(kept);
      cleanupProfilePicCacheAfterCampaignDeletion(deleted);
    }
    return { deleted, kept, notFound, denied: false };
  };

  return {
    normalizeDigits,
    campaignPhoneNumbers,
    collectReferencedProfilePicNumbers,
    deleteProfilePicCacheEntry,
    sweepOrphanedProfilePicFiles,
    cleanupProfilePicCacheAfterCampaignDeletion,
    sweepProfilePicCache,
    campaignsForOwnerPhone,
    deleteCampaignsById,
  };
};

module.exports = createCampaignService;