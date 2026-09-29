/* Single definition of "this number has a public profile picture".
   Shared by the History table filter, the run-detail photo count, the results
   rows and the Live Scan feed, so the badge, the filter and the exported flag
   can never disagree about the same result.

   `profilePhotoAvailable` is deliberately tri-state on the backend:
     true  - a public picture was seen
     false - the number has no public picture
     null  - unknown (the check could not tell), still worth one attempt
   A "confirmed photo" is `true`; "worth trying" also includes `null`. */
export const resultHasPhoto = (result) =>
  !!result && (result.profilePhotoAvailable === true || !!result.avatar);

/** True when the backend could not determine the answer, so a fetch may help. */
export const resultPhotoUnknown = (result) =>
  !!result && result.exists === true && result.profilePhotoAvailable === null && !result.avatar;

/**
 * Decide, per result, whether it is worth asking the backend for picture bytes.
 * Kept separate from the fetching so the rule is testable on its own and so the
 * only thing that actually hits the network is the fetching.
 *
 * Only a definite `profilePhotoAvailable === false` is skipped. `null` means
 * the check could not tell, so it is still worth one attempt - skipping those
 * would silently blank out photos that simply were not resolved during the run.
 * Numbers that do not exist, and rows with no digits to key on, are never
 * queried: the endpoint is authorized-only and must not be widened here.
 */
export const planAvatarFetches = (results) => {
  if (!Array.isArray(results)) return [];
  return results.map((r) => {
    if (!r || !r.exists) return false;
    const digits = String(r.cleanNumber || r.number || '').replace(/\D/g, '');
    if (!digits) return false;
    if (r.profilePhotoAvailable === false && !r.avatar && !r.profileImageUrl) return false;
    return true;
  });
};
