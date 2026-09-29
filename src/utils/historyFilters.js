import { resultHasPhoto } from './resultPhoto';

/* Result filtering for the History table.
   This lives in its own module (rather than inline in the page) for one
   reason: the option list, the row predicate and the label printed on an
   export are all generated from this single table, so a filter can never be
   offered in the dropdown while having no predicate behind it - the classic
   cause of a filter dropdown that appears to do nothing.

   `resultHasPhoto` treats `profilePhotoAvailable: null` as "unknown, worth one
   attempt" and `false` as "definitely none", which is what the backend stores.
*/

export const RESULT_FILTERS = [
  { value: 'all', label: 'All Results', test: () => true },
  { value: 'registered', label: 'Registered', test: (r) => r.exists === true },
  { value: 'unregistered', label: 'Not Registered', test: (r) => r.exists === false && r.isValidFormat },
  { value: 'invalid', label: 'Invalid', test: (r) => !r.isValidFormat },
  // Scoped to existing numbers on purpose. The backend initialises
  // `isBusiness: false` for EVERY result, including ones that do not exist, so
  // an unscoped "Personal" test would list every Not Registered row as a
  // personal account.
  { value: 'personal', label: 'Personal Accounts', test: (r) => r.exists === true && r.isBusiness === false },
  { value: 'business', label: 'Business Accounts', test: (r) => r.isBusiness === true },
  { value: 'avatar', label: 'Profile Picture Available', test: (r) => resultHasPhoto(r) },
];

export const RESULT_FILTER_VALUES = RESULT_FILTERS.map((f) => f.value);

const FILTER_BY_VALUE = new Map(RESULT_FILTERS.map((f) => [f.value, f]));

export const getResultFilter = (value) => FILTER_BY_VALUE.get(value) || FILTER_BY_VALUE.get('all');

/**
 * Filter a full campaign result set.
 * Runs over the WHOLE dataset, before pagination, so a page boundary can
 * never hide rows from an active filter. Sorting is applied here too so that
 * page 1 is the requested end of the list rather than merely the first slice
 * of the default order.
 */
export function filterResults(results, { statusFilter, debouncedSearch, sortOrder } = {}) {
  if (!Array.isArray(results)) return [];
  const term = String(debouncedSearch || '').trim().toLowerCase();
  const active = getResultFilter(statusFilter);

  const matched = results.filter((result) => {
    // Search the same identifiers the rest of the app keys on. `cleanNumber` is
    // included because legacy campaign records predate `formatted`, and a user
    // pasting raw digits must still find the row.
    const haystack = `${result.formatted || ''} ${result.number || ''} ${result.cleanNumber || ''}`.toLowerCase();
    const matchesSearch =
      !term ||
      haystack.includes(term) ||
      (result.displayName && String(result.displayName).toLowerCase().includes(term));
    return matchesSearch && active.test(result);
  });

  return sortOrder === 'oldest' ? matched.slice().reverse() : matched;
}

/** Human-readable description of the active filter, reused by every export. */
export function filterLabel(statusFilter, debouncedSearch, sortOrder) {
  const parts = [getResultFilter(statusFilter).label];
  if (sortOrder === 'oldest') parts.push('Oldest first');
  const term = String(debouncedSearch || '').trim();
  if (term) parts.push(`matching "${term}"`);
  return parts.join(', ');
}
