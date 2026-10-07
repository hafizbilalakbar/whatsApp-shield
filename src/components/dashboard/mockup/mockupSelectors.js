import { getRawLeadPhone } from '../../../utils/phoneFormatter';

/**
 * The single source of truth for the leads held by the Live Phone Preview.
 * Mirrors the WebSocket results store 1:1 and applies the clear timestamp at
 * read time, so the panel, the floating pill badge and the video export all
 * derive from the same live list instead of holding their own snapshots.
 *
 * Newest first (same order the mockup renders). `discoveredAt` is synthesized
 * only when the result carries no real timestamp, keeping arrival order stable.
 */
export function derivePreviewLeads(resultsList, clearedAt) {
  const list = Array.isArray(resultsList) ? resultsList : [];
  const base = list
    .filter((r) => r && r.exists === true)
    .map((r, i) => ({
      ...r,
      discoveredAt: r.discoveredAt || r.timestamp || (Date.now() - (list.length - i) * 1200)
    }))
    .reverse(); // Newest first

  if (!clearedAt) return base;
  return base.filter((l) => (l?.discoveredAt || 0) > clearedAt);
}

/**
 * Stable per-lead photo identity used to key the decoded-photos set. Must be
 * identical everywhere a lead's photo is looked up (row render, filter, video).
 */
export function getLeadPhotoKey(lead) {
  if (!lead) return null;
  const id = lead.cleanNumber || lead.number;
  return id != null && id !== '' ? String(id) : null;
}

/**
 * Resolve the best avatar URL for a lead, exactly as the row renders it.
 * Returns null when the lead is known to have no profile photo.
 */
export function resolveLeadAvatarUrl(lead) {
  if (!lead) return null;
  if (lead.profilePhotoAvailable === false || lead.avatar === null) return null;
  if (lead.avatar) return lead.avatar;
  const rawPhone = getRawLeadPhone(lead);
  const digits = String(lead.cleanNumber || rawPhone || '').replace(/\D/g, '');
  if (digits && digits.length >= 6) {
    return `/api/profile-picture?phone=${digits}`;
  }
  return null;
}
