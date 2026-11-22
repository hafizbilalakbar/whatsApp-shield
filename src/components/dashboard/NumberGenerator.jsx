import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Users, Shuffle, MapPin, Copy, Download, RefreshCw, Check,
  AlertCircle, Info, ListOrdered, Search, X
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { OperatorIcon } from '../ui/OperatorIcon';
import { RegionIcon } from '../ui/RegionIcon';
import CountrySelector from '../ui/CountrySelector';
import { SvgFlag } from '../ui/SvgFlag';
import {
  getRandomNumbers,
  getRegionTypeLabel,
  isoToCallingCode,
  getCountryPlan,
  getOperatorsForCountry,
  generateBucketedAsync,
  generateSequentialNumbers,
  typesForPlan,
  parseNumberInput,
  buildScopeBuckets
} from '../../data/numberingPlans.js';
import { ensureNumberingDatasets } from '../../data/numberingDatasets.js';
import { UI_MAX_QTY, SEQUENTIAL_RANGE_LIMIT, DATASET_INFO } from '../../data/numberingConstants.js';
import { countries, DEFAULT_COUNTRY_CODE, getCountryByIso, getCountryByCallingCode } from '../../data/countries';
import { getDynamicRegionsForCountry } from '../../utils/geoLookup';
import { downloadFile } from '../../utils/exportUtils';

const MAX_QTY = UI_MAX_QTY;

export const NumberGenerator = ({ onInsert, defaultCountry = DEFAULT_COUNTRY_CODE }) => {
  const [mode, setMode] = useState('sequential');

  // One shared target country for every mode - the top-level Target Country and
  // the generator can never drift apart.
  // Now stores ISO code (e.g., "US", "CA", "JM") instead of calling code
  const [targetCountryIso, setTargetCountryIso] = useState(() => {
    const c = getCountryByIso(defaultCountry) || getCountryByCallingCode(defaultCountry);
    return c ? c.iso.toUpperCase() : 'US';
  });
  const seqCountryIso = targetCountryIso;
  const randCountryIso = targetCountryIso;
  const regionCountryIso = targetCountryIso;

  // Sequential mode state
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Random mode state
  const [randQuantity, setRandQuantity] = useState('');

  // Region-wise state
  const [selectedRegionIds, setSelectedRegionIds] = useState([]);
  const [regionSearch, setRegionSearch] = useState('');
  const [regionQuantity, setRegionQuantity] = useState('');
  const [regions, setRegions] = useState([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [regionSource, setRegionSource] = useState(null);
  const [countryPlan, setCountryPlan] = useState(null);

  // Operator / SIM provider selection state
  const [selectedOperatorIds, setSelectedOperatorIds] = useState([]);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [hasOperatorData, setHasOperatorData] = useState(true);

  // Shared results / status
  const [generated, setGenerated] = useState([]);
  const [status, setStatus] = useState({ kind: 'idle', message: null });
  const [generatedRegion, setGeneratedRegion] = useState(null);
  const [requestedQty, setRequestedQty] = useState(0);
  const [droppedCount, setDroppedCount] = useState(0);
  const [report, setReport] = useState(null);
  const [progress, setProgress] = useState(0);

  // Label-only regions can only be used after the user explicitly accepts that
  // they are targeting labels, not verified locations.
  const [labelOnlyConfirmed, setLabelOnlyConfirmed] = useState(false);

  // Cancellation + race guards. Each run gets an id; a newer run or a cancel
  // request invalidates older ones so two fills can never interleave.
  const cancelRef = useRef(false);
  const runIdRef = useRef(0);

  const isGenerating = status.kind === 'generating';

  /**
   * Clear every piece of generation state, INCLUDING the cross-step window
   * contracts. Leaving stale `__whatsappShieldNumberMetadata` around made Step 4
   * describe newly generated numbers using the previous batch's region/operator.
   */
  const clearGenerationState = useCallback(() => {
    setGenerated([]);
    setReport(null);
    setGeneratedRegion(null);
    setDroppedCount(0);
    setProgress(0);
    setRequestedQty(0);
    setStatus({ kind: 'idle', message: null });
    if (typeof window !== 'undefined') {
      window.__whatsappShieldNumberMetadata = null;
      window.whatsappShieldAudienceType = null;
      window.whatsappShieldRegion = null;
    }
  }, []);

  // The region ISO is the same as the selected country ISO
  const regionIso = regionCountryIso;

  // Reset stale selections whenever the shared country changes.
  useEffect(() => {
    setSelectedRegionIds([]);
    setSelectedOperatorIds([]);
    setLabelOnlyConfirmed(false);
  }, [targetCountryIso]);

  // The plan is the single metadata source for the preview and the generator.
  // Reload it whenever the country changes so no stale prefixes survive.
  useEffect(() => {
    let isCurrent = true;
    ensureNumberingDatasets()
      .then(() => {
        if (isCurrent) setCountryPlan(getCountryPlan(targetCountryIso) || null);
      })
      .catch(() => {
        if (isCurrent) setCountryPlan(null);
      });
    return () => { isCurrent = false; };
  }, [targetCountryIso]);

  // Sync defaultCountry changes from parent
  const lastDefaultCountry = useRef(defaultCountry);
  useEffect(() => {
    if (!defaultCountry || defaultCountry === lastDefaultCountry.current) return;
    lastDefaultCountry.current = defaultCountry;
    const c = getCountryByIso(defaultCountry) || getCountryByCallingCode(defaultCountry);
    setTargetCountryIso(c ? c.iso.toUpperCase() : 'US');
  }, [defaultCountry]);

  // Load region data: metadata-verified prefixes plus ISO 3166-2 label-only names
  useEffect(() => {
    let isCurrent = true;
    if (mode !== 'region') return;

    const iso = regionCountryIso;
    if (!iso) {
      setRegions([]);
      setRegionSource(null);
      setSelectedRegionIds([]);
      return;
    }

    setIsLoadingRegions(true);
    getDynamicRegionsForCountry(iso, isoToCallingCode(iso))
      .then((result) => {
        if (!isCurrent) return;
        const source = Array.isArray(result) ? 'prefix' : result.source;
        const loaded = Array.isArray(result) ? result : result.regions;

        // Countries with no subdivision metadata still need a selectable entry so
        // generation targets the whole country plan instead of dead-ending.
        const list = loaded.length
          ? loaded
          : [{ id: '__all__', name: 'All regions', code: null, prefix: '', prefixes: [], verified: false, labelOnly: false }];

        setRegions(list);
        setRegionSource(source);
        setIsLoadingRegions(false);
        // Auto-select the first VERIFIED region when one exists. Label-only
        // regions are never auto-selected: they require an explicit choice plus
        // the label-only acknowledgement.
        const firstVerified = list.find((r) => r.verified);
        setSelectedRegionIds(firstVerified ? [firstVerified.id] : []);
      })
      .catch(() => {
        if (!isCurrent) return;
        setRegions([]);
        setRegionSource(null);
        setSelectedRegionIds([]);
        setIsLoadingRegions(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [mode, regionCountryIso]);

  // Load operators for the shared country
  useEffect(() => {
    let isCurrent = true;
    if (mode !== 'region') return;
    if (!regionIso) {
      setOperatorOptions([]);
      return;
    }

    setIsLoadingOperators(true);
    ensureNumberingDatasets()
      .then(() => {
        if (!isCurrent) return;
        const list = getOperatorsForCountry(regionIso);
        setOperatorOptions(list);
        setHasOperatorData(list.length > 0);
      })
      .catch(() => {
        if (!isCurrent) return;
        setOperatorOptions([]);
        setHasOperatorData(false);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingOperators(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [mode, regionIso]);

  // Filtered regions in search
  const filteredRegions = useMemo(() => {
    const term = regionSearch.toLowerCase().trim();
    if (!term) return regions;
    return regions.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.code && String(r.code).toLowerCase().includes(term)) ||
        (r.prefix && r.prefix.includes(term)) ||
        (r.prefixes && r.prefixes.some((p) => p.includes(term)))
    );
  }, [regions, regionSearch]);

  // Active selected region objects
  const selectedRegionsList = useMemo(() => {
    return regions.filter((r) => selectedRegionIds.includes(r.id));
  }, [regions, selectedRegionIds]);

  // Aggregated prefixes from all selected regions (prefix-based regions only)
  const selectedPrefixes = useMemo(() => {
    const set = new Set();
    selectedRegionsList.forEach((r) => {
      if (r.prefixes && r.prefixes.length > 0) {
        r.prefixes.forEach((p) => set.add(p));
      } else if (r.prefix) {
        set.add(r.prefix);
      }
    });
    return Array.from(set);
  }, [selectedRegionsList]);

  // Operators are only offered when their verified prefixes can actually
  // overlap the selected region scope. This keeps Country + Region + Operator
  // honest: an incompatible carrier is never offered, let alone generated from.
  const loadedOperators = useMemo(() => {
    if (!selectedRegionsList.length) return operatorOptions;
    const regionPrefixes = new Set();
    selectedRegionsList.forEach((r) => {
      (r.prefixes || []).forEach((p) => {
        const clean = String(p).replace(/\D/g, '');
        if (clean) regionPrefixes.add(clean);
      });
    });
    if (!regionPrefixes.size) return operatorOptions;
    return operatorOptions.filter((op) => op.prefixes.some((p) => {
      const clean = String(p).replace(/\D/g, '');
      return Array.from(regionPrefixes).some((rp) => clean === rp || clean.startsWith(rp) || rp.startsWith(clean));
    }));
  }, [operatorOptions, selectedRegionsList]);

  // Drop operator selections that became incompatible after a region/country
  // change so a stale operator can never silently widen the generation scope.
  useEffect(() => {
    if (!selectedOperatorIds.length) return;
    const valid = new Set(loadedOperators.map((o) => o.id));
    setSelectedOperatorIds((prev) => prev.filter((id) => valid.has(id)));
  }, [loadedOperators]);

  // Filtered operators in search
  const filteredOperators = useMemo(() => {
    const term = operatorSearch.toLowerCase().trim();
    if (!term) return loadedOperators;
    return loadedOperators.filter(
      (op) =>
        op.name.toLowerCase().includes(term) ||
        op.prefixes.some((p) => p.toString().includes(term))
    );
  }, [loadedOperators, operatorSearch]);

  // Active selected operator objects
  const selectedOperatorsList = useMemo(() => {
    return loadedOperators.filter((op) => selectedOperatorIds.includes(op.id));
  }, [loadedOperators, selectedOperatorIds]);

  // Aggregated prefixes from all selected operators
  const selectedOperatorPrefixes = useMemo(() => {
    const set = new Set();
    selectedOperatorsList.forEach((op) => {
      op.prefixes.forEach((p) => set.add(p));
    });
    return Array.from(set);
  }, [selectedOperatorsList]);

  // Parse both range endpoints with the SAME rules: national input uses the
  // selected country; a leading +country code resolves the country itself.
  const seqParsed = useMemo(() => {
    const start = parseNumberInput(rangeStart, targetCountryIso);
    const end = parseNumberInput(rangeEnd, targetCountryIso);
    let error = null;
    let iso = targetCountryIso;
    if (start.ok && end.ok) {
      if (start.iso !== end.iso || start.callingCode !== end.callingCode) {
        error = 'Start and End must resolve to the same country / calling code.';
      } else {
        iso = start.iso;
      }
    }
    return { start, end, iso, error, ready: start.ok && end.ok && !error };
  }, [rangeStart, rangeEnd, targetCountryIso]);

  // The preview and the generator share this exact bucket/pool calculation.
  const scope = useMemo(() => buildScopeBuckets({
    iso: targetCountryIso,
    regions: selectedRegionsList,
    operators: selectedOperatorsList,
    plan: countryPlan,
    allowLabelOnly: labelOnlyConfirmed,
  }), [targetCountryIso, selectedRegionsList, selectedOperatorsList, countryPlan, labelOnlyConfirmed]);

  // Distinct concrete (prefix, length) pairs the generator will actually use.
  const combinedPrefixCount = scope.prefixCount;

  // Requested quantity, computed with the same range rules as the engine.
  const previewTargets = useMemo(() => {
    if (mode === 'sequential') {
      if (!seqParsed.ready) return 0;
      const startBig = BigInt(seqParsed.start.national);
      const endBig = BigInt(seqParsed.end.national);
      if (endBig < startBig) return 0;
      const span = endBig - startBig + 1n;
      const cap = BigInt(SEQUENTIAL_RANGE_LIMIT);
      return Number(span > cap ? cap : span);
    }
    const qty = mode === 'random' ? randQuantity : regionQuantity;
    return Math.max(0, Math.floor(Number(qty) || 0));
  }, [mode, seqParsed, randQuantity, regionQuantity]);

  const previewIso = mode === 'sequential' && seqParsed.ready ? seqParsed.iso : targetCountryIso;

  // Publish audience metadata to window. When there is nothing generated we
  // clear EVERY contract (including the per-number metadata map) so no later
  // step can read a stale region/operator mapping.
  useEffect(() => {
    if (!generated.length) {
      if (typeof window !== 'undefined') {
        window.whatsappShieldAudienceType = null;
        window.whatsappShieldRegion = null;
        window.__whatsappShieldNumberMetadata = null;
      }
      return;
    }
    const isRegion = report && report.mode === 'region';
    window.whatsappShieldAudienceType = (report && report.mode) || mode;
    window.whatsappShieldRegion = isRegion
      ? {
          name: (generatedRegion && generatedRegion.name) || null,
          prefix: (generatedRegion && generatedRegion.prefix) || (report.prefix || null)
        }
      : null;
  }, [generated.length, report, generatedRegion, mode]);

  const handleClear = useCallback(() => {
    cancelRef.current = true;
    clearGenerationState();
  }, [clearGenerationState]);

  const countryName = useCallback((iso) => {
    const c = getCountryByIso(iso);
    return c ? c.name : iso;
  }, []);

  const countryCallingCode = useCallback((iso) => {
    return isoToCallingCode(iso) || '';
  }, []);

  const countReason = (stats, key) => (stats && stats.reasons && stats.reasons[key]) || 0;

  const reasonSummary = (stats) => {
    if (!stats) return '';
    const parts = [];
    const add = (n, label) => { if (n > 0) parts.push(`${n.toLocaleString()} ${label}`); };
    add(countReason(stats, 'prefix'), 'outside the mobile prefixes');
    add(countReason(stats, 'length'), 'wrong length');
    add(countReason(stats, 'type'), 'wrong line type');
    add(countReason(stats, 'country'), 'wrong country');
    add(countReason(stats, 'invalid'), 'not valid');
    add(countReason(stats, 'degenerate'), 'implausible pattern');
    add(countReason(stats, 'duplicate'), 'duplicates');
    return parts.join(', ');
  };

  // Mode 1: Sequential / Range generation. Parsing, ordering and validation all
  // live in the engine (BigInt range, plan-prefix rule, counted drop reasons).
  const runSequential = async () => {
    if (isGenerating) return;
    if (!seqParsed.ready) {
      setStatus({
        kind: 'error',
        message: seqParsed.error
          || seqParsed.start.error
          || seqParsed.end.error
          || 'Enter both a Start and an End number.',
      });
      return;
    }
    const iso = seqParsed.iso;
    if (seqParsed.start.international || seqParsed.end.international) {
      // Keep the selector in sync with the country inferred from the input.
      setTargetCountryIso(iso);
    }

    const runId = ++runIdRef.current;
    cancelRef.current = false;
    if (typeof window !== 'undefined') window.__whatsappShieldNumberMetadata = null;
    setStatus({ kind: 'generating', message: 'Validating range…' });
    setProgress(0);

    try {
      await ensureNumberingDatasets();
      if (runId !== runIdRef.current) return;
      const plan = getCountryPlan(iso);
      const types = typesForPlan(plan);
      const pool = plan ? plan.prefixes : [];
      const res = generateSequentialNumbers({
        iso,
        sourceIso: plan ? plan.sourceIso : iso,
        callingCode: seqParsed.start.callingCode,
        pool,
        start: seqParsed.start.national,
        end: seqParsed.end.national,
        allowedTypes: types,
      });
      if (runId !== runIdRef.current) return;

      const numbers = res.numbers.map((n) => n.number);
      const attempted = res.stats.attempts;
      setGenerated(numbers);
      setProgress(numbers.length);
      setRequestedQty(attempted);
      setDroppedCount(Math.max(0, attempted - numbers.length));

      const notes = [];
      if (res.truncated) notes.push(`range capped at ${SEQUENTIAL_RANGE_LIMIT.toLocaleString()}`);
      const reasons = reasonSummary(res.stats);
      if (reasons) notes.push(`dropped: ${reasons}`);

      setReport({
        mode: 'sequential', country: iso, iso, prefix: null,
        requested: attempted, produced: numbers.length, stats: res.stats, truncated: res.truncated,
      });

      if (numbers.length === 0) {
        setStatus({ kind: 'error', message: res.error || 'No valid numbers in this range for the selected country.' });
      } else {
        setStatus({ kind: 'done', message: `${numbers.length.toLocaleString()} valid numbers generated.${notes.length ? ` (${notes.join('; ')})` : ''}` });
      }
    } catch (err) {
      if (runId !== runIdRef.current) return;
      clearGenerationState();
      setStatus({ kind: 'error', message: `Generation failed: ${(err && err.message) || 'unknown error'}` });
    }
  };

  // Async generation helper with progress, cancellation and race protection.
  const generateAsync = async (modeName, quantity, genFn, buildReport) => {
    if (isGenerating) return;
    const requested = Math.floor(Number(quantity)) || 0;
    if (requested < 1) {
      setStatus({ kind: 'error', message: 'Please enter a valid quantity (at least 1).' });
      return;
    }
    if (requested > MAX_QTY) {
      setStatus({ kind: 'error', message: `Quantity too large. Maximum ${MAX_QTY.toLocaleString()} numbers per batch.` });
      return;
    }

    const runId = ++runIdRef.current;
    cancelRef.current = false;
    if (typeof window !== 'undefined') window.__whatsappShieldNumberMetadata = null;
    setStatus({ kind: 'generating', message: `Generating ${requested.toLocaleString()} numbers…` });
    setRequestedQty(requested);
    setProgress(0);

    await new Promise((resolve) => setTimeout(resolve, 30));

    const shouldCancel = () => cancelRef.current || runId !== runIdRef.current;
    const onProgress = (n) => { if (runId === runIdRef.current) setProgress(n); };

    let result;
    try {
      result = await genFn(requested, { onProgress, shouldCancel });
    } catch (err) {
      if (runId !== runIdRef.current) return;
      clearGenerationState();
      setStatus({ kind: 'error', message: `Generation failed: ${(err && err.message) || 'unknown error'}` });
      return;
    }
    if (runId !== runIdRef.current) return;

    const {
      numbers = [], error, truncated = false, report: extraReport = null,
      cancelled = false, stats = null, capacity = null,
      capacityExhausted = false, timedOut = false,
    } = result || {};

    if (cancelled) {
      setStatus({ kind: 'idle', message: 'Generation cancelled.' });
      setProgress(0);
      return;
    }
    if (error) {
      setGenerated([]);
      setReport(null);
      setDroppedCount(0);
      setStatus({ kind: 'error', message: error });
      return;
    }

    setGenerated(numbers);
    setProgress(numbers.length);
    const base = buildReport ? buildReport(numbers, requested) : {};
    setReport({ ...base, ...(extraReport || {}), stats });
    const removedCount = Math.max(0, requested - numbers.length);
    setDroppedCount(removedCount);

    const planLabel = modeName === 'region'
      ? (selectedRegionsList.length || selectedOperatorsList.length
        ? 'for these regions/operators'
        : 'for this country plan')
      : `for ${countryName(targetCountryIso)}`;

    const reasons = reasonSummary(stats);
    let message;
    if (numbers.length > 0 && removedCount > 0) {
      if (truncated && capacityExhausted && Number.isFinite(capacity) && capacity > 0 && capacity <= requested) {
        message = `${numbers.length.toLocaleString()} valid numbers generated. This plan can supply at most ${capacity.toLocaleString()} distinct numbers ${planLabel}.`;
      } else if (truncated && timedOut) {
        const availability = Number.isFinite(capacity) && capacity > 0
          ? `${capacity.toLocaleString()} distinct numbers are available ${planLabel}.`
          : 'Try a smaller quantity.';
        message = `${numbers.length.toLocaleString()} valid numbers generated. Generation stopped at the safety time limit. ${availability}`;
      } else if (truncated) {
        message = `${numbers.length.toLocaleString()} valid numbers generated. This numbering plan can only supply ${numbers.length.toLocaleString()} distinct numbers ${planLabel}.`;
      } else {
        message = `${numbers.length.toLocaleString()} valid numbers generated. (${removedCount.toLocaleString()} dropped${reasons ? `: ${reasons}` : ''}.)`;
      }
    } else if (numbers.length > 0) {
      message = `${numbers.length.toLocaleString()} valid numbers generated. All valid & unique.`;
    } else {
      message = `No valid numbers could be generated for this selection.${reasons ? ` Dropped: ${reasons}.` : ''}`;
    }
    setStatus({ kind: 'done', message });
  };

  // Mode 2: Random Generation
  const runRandom = () => {
    const qty = randQuantity;
    const iso = randCountryIso;
    if (!iso) {
      setStatus({ kind: 'error', message: 'Please select a valid country first.' });
      return;
    }
    generateAsync(
      'random',
      qty,
      async (requested, options) => {
        await ensureNumberingDatasets();
        return getRandomNumbers(iso, requested, options);
      },
      (numbers, requested) => ({ mode: 'random', country: iso, iso, prefix: null, requested, produced: numbers.length })
    );
  };
// Mode 3: Region-Wise Generation with fair multi-region / multi-operator distribution
  const runRegion = () => {
    generateAsync('region', regionQuantity, async (requested, options) => {
      const totalTarget = Math.min(requested, MAX_QTY);

      const iso = regionCountryIso;
      if (!iso) {
        return { numbers: [], error: 'Please select a valid country first.' };
      }

      await ensureNumberingDatasets();

      const plan = getCountryPlan(iso);
      if (!plan || !plan.prefixes.length) {
        return { numbers: [], error: `No verified numbering plan is available for ${iso}. Try another country.` };
      }

      const types = typesForPlan(plan);
      const validateIso = plan.sourceIso || iso;
      const cc = countryCallingCode(iso);

      // Use the SAME resolved scope that produced the live preview. No silent
      // fallbacks: a label-only region needs an explicit acknowledgement, and a
      // region+operator pair with no overlapping verified prefixes is reported.
      const labelOnlyNeedsConfirm = scope.buckets.some((b) => b.skipped && b.labelOnly);
      if (labelOnlyNeedsConfirm) {
        return {
          numbers: [],
          error: 'The selected region(s) have no verified mobile prefixes. Tick “Generate under label-only regions” to generate country-wide numbers clearly labelled as that region.',
        };
      }
      if (scope.blocked.length > 0) {
        return {
          numbers: [],
          error: `No verified prefixes for: ${scope.blocked.join('; ')}. Remove or change that filter.`,
        };
      }

      const buckets = scope.activeBuckets;
      if (buckets.length === 0) {
        return { numbers: [], error: 'Select at least one region/state or operator, or leave both unselected to target the whole country.' };
      }

      const batch = await generateBucketedAsync(
        {
          iso,
          sourceIso: validateIso,
          callingCode: cc,
          total: totalTarget,
          buckets,
          allowedTypes: types,
        },
        options
      );

      const numbers = batch.numbers;

      const metadataMap = new Map();
      numbers.forEach(({ number: n, bucketIndex }) => {
        const { region, operator } = buckets[bucketIndex];
        const meta = {
          number: n.number,
          cleanNumber: String(n.number).replace(/\D/g, ''),
          country: iso,
          countryCode: cc,
          regionId: region ? region.id : null,
          regionName: region && region.id !== '__all__' ? region.name : 'All regions',
          regionVerified: Boolean(region && region.verified),
          operatorName: operator ? operator.name : 'Any operator',
          prefix: n.prefix,
          generationIndex: bucketIndex,
        };
        n.meta = meta;
        metadataMap.set(meta.cleanNumber, meta);
        metadataMap.set(meta.number, meta);
      });

      if (typeof window !== 'undefined') {
        window.__whatsappShieldNumberMetadata = metadataMap;
      }

      const usedRegions = new Set(buckets.map((b) => b.region).filter(Boolean));
      const usedOperators = new Set(buckets.map((b) => b.operator).filter(Boolean));
      const labelOnly = scope.labelOnly;

      // The header marquee shows ONLY the selected state/region names, in the
      // order they were selected and de-duplicated (operator names, combination
      // counts and prefixes stay internal to generation/report data). When no
      // specific region was selected (the "__all__" pseudo-region) we publish no
      // region name so the header shows just the country and its dial code.
      const selectedRegionNames = Array.from(new Set(
        buckets
          .map((b) => b.region)
          .filter((r) => r && r.id !== '__all__')
          .map((r) => String(r.name || '').trim())
          .filter(Boolean)
      ));

      setGeneratedRegion({
        name: selectedRegionNames.length > 0
          ? selectedRegionNames.join(' · ')
          : null,
        prefix: numbers.length > 0 ? numbers[0].number.prefix : null,
      });

      const report = {
        mode: 'region',
        country: iso,
        iso,
        prefix: numbers.length > 0 ? numbers[0].number.prefix : '',
        requested: totalTarget,
        produced: numbers.length,
        regionCount: usedRegions.size,
        operatorCount: usedOperators.size,
        buckets: buckets.length,
        regionSource: regionSource || 'none',
        labelOnly,
        labelOnlyRegions: scope.labelOnlyRegions,
        operatorFallback: scope.operatorFallback,
        distinctPrefixes: scope.prefixCount,
      };

      return {
        numbers: numbers.map(({ number: n }) => n.number),
        truncated: batch.truncated,
        cancelled: batch.cancelled,
        stats: batch.stats,
        capacity: batch.capacity,
        capacityExhausted: batch.capacityExhausted,
        timedOut: batch.timedOut,
        error: numbers.length === 0 ? 'Could not produce numbers for these selections. Try a larger quantity or fewer filters.' : null,
        report,
      };
    });
  };

  const handleGenerate = () => {
    if (mode === 'sequential') runSequential();
    else if (mode === 'random') runRandom();
    else runRegion();
  };

  const handleCopy = async () => {
    if (generated.length === 0) return;
    try {
      await navigator.clipboard.writeText(generated.join('\n'));
      setStatus({ kind: 'success', message: 'Numbers copied to clipboard.' });
    } catch {
      setStatus({ kind: 'error', message: 'Could not copy to clipboard.' });
    }
  };

  const handleDownload = () => {
    if (generated.length === 0) return;
    const isRegion = report && report.mode === 'region';
    const reportIso = report && report.iso;
    const filename = isRegion
      ? `whatsapp-shield-${reportIso}-regions-${(selectedRegionsList.map(r => r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('_') || 'custom')}-numbers.csv`
      : `whatsapp-shield-${(reportIso) || 'numbers'}.csv`;
    const header = isRegion ? 'country,country_code,region,region_verified,operator,phone_number\n' : 'phone_number\n';
    const lines = generated.map((n) => {
      if (isRegion) {
        const clean = String(n).replace(/\D/g, '');
        const meta = window.__whatsappShieldNumberMetadata?.get(clean) || window.__whatsappShieldNumberMetadata?.get(n);
        const reg = (meta && meta.regionName) || (selectedRegionsList[0] && selectedRegionsList[0].name) || 'All regions';
        const op = (meta && meta.operatorName) || 'Any operator';
        const verified = !!(meta && meta.regionVerified);
        return `"${countryName(reportIso)}",+${countryCallingCode(reportIso)},"${reg}",${verified ? 'yes' : 'no'},"${op}",${n}`;
      }
      return n;
    });
    downloadFile('\uFEFF' + header + lines.join('\n'), filename, 'text/csv;charset=utf-8');
    setStatus({ kind: 'success', message: `Downloaded ${generated.length.toLocaleString()} numbers.` });
  };

  const handleUse = () => {
    if (onInsert && generated.length > 0) {
      onInsert(generated.join('\n'));
      setStatus({ kind: 'success', message: 'Generated numbers added to the audience input list.' });
    }
  };

  // Toggle multi-select region
  const toggleRegion = (id) => {
    setSelectedRegionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  // Toggle multi-select operator
  const toggleOperator = (id) => {
    setSelectedOperatorIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  return (
    <Card className="h-full p-4 md:p-6 border-border">
      {/* Mode selector */}
      <div className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            <Users className="text-primary" /> Number Generator
          </h3>
          <span className="text-xs text-text-muted">Synthetic / test numbers validated with libphonenumber.</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            variant={mode === 'sequential' ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => setMode('sequential')}
          >
            <ListOrdered size={16} className="mr-2" /> Sequential / Range
          </Button>
          <Button
            variant={mode === 'random' ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => setMode('random')}
          >
            <Shuffle size={16} className="mr-2" /> Random
          </Button>
          <Button
            variant={mode === 'region' ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => setMode('region')}
          >
            <MapPin size={16} className="mr-2" /> Region-Wise
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        {/* ==================== SEQUENTIAL MODE ==================== */}
        {mode === 'sequential' && (
          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Generate sequential numbers from a start to an end value. Validated with libphonenumber.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <CountrySelector selectedCountryIso={seqCountryIso} onSelect={setTargetCountryIso} />
            </div>
            <div className="p-2.5 rounded-lg border border-border/80 bg-surface/60 text-[11px] text-text-secondary flex items-start gap-2">
              <Info size={14} className="text-primary shrink-0 mt-0.5" />
              <span>
                Enter national numbers (e.g. 2025550100) or complete international numbers
                (e.g. +12025550100, +442071234567, +923001234567). Spaces, hyphens and parentheses are accepted.
                A +country code resolves the country automatically; without it the Country field is used.
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Number (national or +country code)</label>
              <Input
                placeholder="e.g., 2025550100 or +12025550100"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Number (national or +country code)</label>
              <Input
                placeholder="e.g., 2025550200 or +12025550200"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ==================== RANDOM MODE ==================== */}
        {mode === 'random' && (
          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Generate random, verified format phone numbers using official mobile numbering plans.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <CountrySelector selectedCountryIso={randCountryIso} onSelect={setTargetCountryIso} />
              {randCountryIso && (
                <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                  <SvgFlag code={randCountryIso} width={18} />
                  <span className="font-medium">{countryName(randCountryIso)}</span>
                  <span className="text-primary font-mono">+{countryCallingCode(randCountryIso)}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <Input
                type="number"
                min="1"
                max={MAX_QTY}
                placeholder="e.g., 100, 500, 1000"
                value={randQuantity}
                onChange={(e) => setRandQuantity(e.target.value)}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[100, 500, 1000, 5000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRandQuantity(String(n))}
                    className="text-xs px-2 py-1 rounded-md border border-border bg-surface hover:bg-background transition-colors"
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== REGION-WISE MODE ==================== */}
        {mode === 'region' && (
          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Select a country, then choose one or multiple states/regions to generate numbers strictly from their prefixes.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <CountrySelector selectedCountryIso={regionCountryIso} onSelect={setTargetCountryIso} />
            </div>

            {regionCountryIso && (
              <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                <SvgFlag code={regionCountryIso} width={18} />
                <span className="font-medium">{countryName(regionCountryIso)}</span>
                <span className="text-primary font-mono">+{countryCallingCode(regionCountryIso)}</span>
                <Badge variant="outline" className="ml-auto capitalize">
                  {getRegionTypeLabel(regionCountryIso)}
                </Badge>
              </div>
            )}

{/* Operator / SIM Provider Selection Panel */}
            {regionIso && (
              <div className="mt-4 p-3 rounded-lg border border-border/80 bg-surface/50">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h4 className="text-xs font-semibold text-text-primary">Operator / SIM Provider Selection</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-secondary tabular-nums">
                      {selectedOperatorsList.length > 0
                        ? `${selectedOperatorsList.length} selected`
                        : 'Any operator'}
                    </span>
                    {loadedOperators.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedOperatorIds(loadedOperators.map((o) => o.id))}
                          className="text-[11px] text-text-muted hover:text-primary transition-colors"
                        >
                          Select All
                        </button>
                        {selectedOperatorIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedOperatorIds([])}
                            className="text-[11px] text-text-muted hover:text-primary transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {isLoadingOperators ? (
                  <div className="p-2 rounded-lg border border-border bg-surface/50 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-primary" /> Loading operator metadata…
                  </div>
                ) : !hasOperatorData ? (
                  <div className="p-2.5 rounded-lg border border-dashed border-border bg-surface/30 text-[11px] text-text-secondary flex items-start gap-2">
                    <Info size={14} className="text-primary shrink-0 mt-0.5" />
                    <span>
                      No carrier prefix data is published for {countryName(regionCountryIso)}. Numbers will still be
                      generated from the official {countryName(regionCountryIso)} numbering plan with any operator.
                    </span>
                  </div>
                ) : filteredOperators.length === 0 ? (
                  <div className="p-2 rounded-lg border border-dashed border-border bg-surface/30 text-center text-sm text-text-muted">
                    No operators match “{operatorSearch}”.
                  </div>
                ) : (
                  <>
                    {selectedOperatorsList.length === 0 && (
                      <div className="mb-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-[11px] text-primary">
                        Any operator — no carrier filter applied. Select operators to narrow results.
                      </div>
                    )}
                    <div className="max-h-64 overflow-y-auto border border-border rounded-lg bg-surface/40">
                      {/* Search filter for operators */}
                      <div className="flex items-center px-3 py-1.5 border-b border-border bg-background/50 sticky top-0 z-10">
                        <Search size={13} className="text-text-muted mr-2 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search operator or prefix…"
                          value={operatorSearch}
                          onChange={(e) => setOperatorSearch(e.target.value)}
                          className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                        />
                        {operatorSearch && (
                          <button type="button" onClick={() => setOperatorSearch('')} className="text-text-muted hover:text-primary shrink-0">
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Multi-select checkable list */}
                      <div className="p-1.5 space-y-1">
                        {filteredOperators.map((op) => {
                          const isSelected = selectedOperatorIds.includes(op.id);
                          return (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => toggleOperator(op.id)}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all text-left ${
                                isSelected
                                  ? 'bg-primary/15 text-primary font-semibold border border-primary/30'
                                  : 'hover:bg-background/80 text-text-secondary border border-transparent'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                                  isSelected ? 'bg-primary border-primary text-white' : 'border-border bg-background'
                                }`}>
                                  {isSelected && <Check size={10} />}
                                </span>
                                <OperatorIcon name={op.name} size={12} />
                                <span className="truncate">{op.name}</span>
                              </span>
                              <span className="text-[10px] font-mono text-text-muted shrink-0 ml-2">
                                +{countryCallingCode(regionIso)} {op.prefixes.slice(0, 3).join(', ')}{op.prefixes.length > 3 ? ` +${op.prefixes.length - 3}` : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {regionIso && regionSource === 'iso' && (
              <div className="p-2.5 rounded-lg border border-border/80 bg-surface/60 text-[11px] text-text-secondary flex items-start gap-2">
                <Info size={14} className="text-primary shrink-0 mt-0.5" />
                <span>
                  Official subdivision names are available for this country, but mobile prefixes are not mapped to
                  individual regions. Treat these as targeting labels, not verified locations.
                </span>
              </div>
            )}

            {/* Dynamic State/Region Multi-Select Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className="text-sm font-medium">
                  State / Region Selection
                  <span className="ml-1.5 text-xs text-text-secondary tabular-nums">
                    ({selectedRegionsList.length} of {regions.length} selected)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  {regions.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedRegionIds(regions.filter((r) => labelOnlyConfirmed || !r.labelOnly).map((r) => r.id))}
                        className="text-xs text-text-muted hover:text-primary transition-colors"
                      >
                        Select All
                      </button>
                      {selectedRegionIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedRegionIds([])}
                          className="text-xs text-text-muted hover:text-primary transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {isLoadingRegions ? (
                <div className="p-4 rounded-lg border border-border bg-surface/50 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-primary" /> Loading regional metadata…
                </div>
              ) : regions.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-border bg-surface/30 text-center text-sm text-text-muted">
                  No state/regional data available for this country. Country-wide generation applies.
                </div>
              ) : (
                <div className="border border-border rounded-lg bg-surface/40 overflow-hidden">
                  {/* Search filter for states */}
                  <div className="flex items-center px-3 py-1.5 border-b border-border bg-background/50">
                    <Search size={13} className="text-text-muted mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search state, province or area code…"
                      value={regionSearch}
                      onChange={(e) => setRegionSearch(e.target.value)}
                      className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                    {regionSearch && (
                      <button type="button" onClick={() => setRegionSearch('')} className="text-text-muted hover:text-primary shrink-0">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Multi-select checkable list */}
                  <div className="max-h-48 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                    {filteredRegions.map((r) => {
                      const isSelected = selectedRegionIds.includes(r.id);
                      const extra = r.prefixes && r.prefixes.length > 1 ? r.prefixes.length - 1 : 0;
                      const disabled = r.labelOnly && !labelOnlyConfirmed;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { if (!disabled) toggleRegion(r.id); }}
                          disabled={disabled}
                          title={disabled ? 'Tick “Generate under label-only regions” to select this region.' : undefined}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all text-left ${
                            disabled
                              ? 'opacity-50 cursor-not-allowed border border-transparent text-text-muted'
                              : isSelected
                                ? 'bg-primary/15 text-primary font-semibold border border-primary/30'
                                : 'hover:bg-background/80 text-text-secondary border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                              isSelected ? 'bg-primary border-primary text-white' : 'border-border bg-background'
                            }`}>
                              {isSelected && <Check size={10} />}
                            </span>
                            <RegionIcon verified={r.verified} labelOnly={Boolean(r.labelOnly)} size={13} />
                            <span className="truncate">{r.name}</span>
                            {r.labelOnly && (
                              <Badge variant="outline" className="shrink-0 text-[9px] px-1 py-0 font-normal">
                                label only
                              </Badge>
                            )}
                          </span>
                          <span className="text-[11px] font-mono text-text-muted shrink-0 ml-2">
                            {r.verified && r.prefix
                              ? `+${countryCallingCode(regionIso)} ${r.prefix}${extra ? ` (+${extra})` : ''}`
                              : `+${countryCallingCode(regionIso)} • any`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {regions.some((r) => r.labelOnly) && (
              <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-2">
                <Info size={14} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Some regions are label-only</p>
                  <p className="mt-0.5 text-amber-600/80 dark:text-amber-400/80">
                    These names have no verified mobile prefixes. Enabling this generates country-wide numbers
                    labelled with the region name — useful for reporting, not for true geo-targeting.
                  </p>
                  <label className="mt-1.5 inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={labelOnlyConfirmed}
                      onChange={(e) => {
                        setLabelOnlyConfirmed(e.target.checked);
                        if (!e.target.checked) {
                          setSelectedRegionIds((prev) => prev.filter((id) => {
                            const r = regions.find((x) => x.id === id);
                            return r && !r.labelOnly;
                          }));
                        }
                      }}
                      className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="font-medium">Generate under label-only regions</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <Input
                type="number"
                min="1"
                max={MAX_QTY}
                placeholder="e.g., 100, 500, 1000"
                value={regionQuantity}
                onChange={(e) => setRegionQuantity(e.target.value)}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[100, 500, 1000, 5000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRegionQuantity(String(n))}
                    className="text-xs px-2 py-1 rounded-md border border-border bg-surface hover:bg-background transition-colors"
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live Preview Box before generating */}
        <div className="p-3 rounded-lg border border-border/80 bg-surface/50 text-xs space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-text-primary">
            <span className="flex items-center gap-1.5">
              <Info size={13} className="text-primary" /> Generation Plan Preview
            </span>
            <Badge variant="outline" className="text-[10px] capitalize font-mono">
              {mode}
            </Badge>
          </div>
          <div className="text-text-secondary flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span>Country: <b className="text-text-primary">{countryName(previewIso)} (+{countryCallingCode(previewIso)})</b></span>
            {mode === 'sequential' && seqParsed.ready && seqParsed.iso !== targetCountryIso && (
              <span className="text-primary">Country auto-detected from the number's calling code</span>
            )}
            {mode === 'sequential' && !seqParsed.ready && (seqParsed.start.error || seqParsed.end.error || seqParsed.error) && (
              <span className="text-amber-500">{seqParsed.error || seqParsed.start.error || seqParsed.end.error}</span>
            )}
            {mode !== 'region' && (
              <span>Targets: <b className="text-text-primary tabular-nums">{previewTargets.toLocaleString()}</b></span>
            )}
            {mode === 'region' && (
              <>
                <span>Selected Regions: <b className="text-text-primary">{selectedRegionsList.length > 0 ? selectedRegionsList.map((r) => r.name).join(', ') : 'All regions'}</b></span>
                <span>Operators: <b className="text-text-primary">{selectedOperatorsList.length > 0 ? selectedOperatorsList.map((o) => o.name).join(', ') : 'Any operator'}</b></span>
                <span>Targets: <b className="text-text-primary tabular-nums">{previewTargets.toLocaleString()}</b></span>
                {scope.labelOnly && (
                  <span className="text-amber-500">Label-only regions (no verified geographic prefixes)</span>
                )}
                {scope.blocked.length > 0 && (
                  <span className="text-destructive">No verified prefixes for: {scope.blocked.join('; ')}</span>
                )}
              </>
            )}
            {mode === 'region' && selectedPrefixes.length > 0 && (
              <span>Region Prefixes: <b className="text-primary font-mono">{selectedPrefixes.length} ({selectedPrefixes.slice(0, 4).join(', ')}{selectedPrefixes.length > 4 ? '…' : ''})</b></span>
            )}
            {mode === 'region' && selectedOperatorPrefixes.length > 0 && (
              <span>Operator Prefixes: <b className="text-primary font-mono">{selectedOperatorPrefixes.length} ({selectedOperatorPrefixes.slice(0, 4).join(', ')}{selectedOperatorPrefixes.length > 4 ? '…' : ''})</b></span>
            )}
            {mode === 'region' && (
              <span>Distinct Prefixes In Scope: <b className="text-text-primary font-mono tabular-nums">{combinedPrefixCount}</b></span>
            )}
            {mode === 'region' && (selectedRegionsList.length > 0 || selectedOperatorsList.length > 0) && scope.labelOnly && (
              <span className="text-amber-500">Label-only scope uses the country plan; numbers are NOT verified to belong to that region</span>
            )}
            {(selectedOperatorsList.length > 0 || (mode === 'region' && hasOperatorData)) && (
              <span className="text-text-muted">Carrier prefixes reflect historical assignments; number portability means the current operator cannot be verified.</span>
            )}
            {generated.length > 0 && (
              <span>Result: <b className="text-text-primary tabular-nums">{generated.length.toLocaleString()} produced</b>
                {droppedCount > 0 && <> · <b className="tabular-nums">{droppedCount.toLocaleString()} dropped</b></>}
                {requestedQty > 0 && <> · requested <b className="tabular-nums">{requestedQty.toLocaleString()}</b></>}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button onClick={handleGenerate} disabled={isGenerating} className="min-w-[140px]">
            {isGenerating ? (
              <>
                <RefreshCw size={15} className="mr-2 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <RefreshCw size={15} className="mr-2" /> Generate Numbers
              </>
            )}
          </Button>

          {isGenerating && (
            <Button variant="outline" onClick={() => { cancelRef.current = true; }} className="min-w-[100px]">
              <X size={15} className="mr-2" /> Cancel
            </Button>
          )}

          {isGenerating && requestedQty > 0 && (
            <div className="flex items-center gap-2 text-xs text-text-secondary tabular-nums min-w-[160px]">
              <div className="h-1.5 w-24 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.round((progress / requestedQty) * 100))}%` }}
                />
              </div>
              <span>{Math.min(progress, requestedQty).toLocaleString()} / {requestedQty.toLocaleString()}</span>
            </div>
          )}

          {generated.length > 0 && (
            <>
              <Button variant="default" onClick={handleUse} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                <Check size={15} className="mr-2" /> Use {generated.length.toLocaleString()} Numbers
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                <Copy size={15} className="mr-2" /> Copy
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download size={15} className="mr-2" /> Export CSV
              </Button>
              <Button variant="ghost" onClick={handleClear} className="text-text-muted hover:text-destructive">
                Clear
              </Button>
            </>
          )}
        </div>

        {/* Status Message */}
        {status.message && (
          <div className={`p-2.5 rounded-md text-xs flex items-center gap-2 ${
            status.kind === 'error' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
            status.kind === 'done' || status.kind === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            'bg-surface text-text-secondary border border-border'
          }`}>
            {status.kind === 'error' ? <AlertCircle size={14} className="shrink-0" /> : <Check size={14} className="shrink-0 text-emerald-400" />}
            <span>{status.message}</span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default NumberGenerator;
