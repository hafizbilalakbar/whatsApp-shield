import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Users, Shuffle, MapPin, Copy, Download, RefreshCw, Check,
  AlertCircle, Info, ListOrdered, Search, X
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import CountrySelector from '../ui/CountrySelector';
import { SvgFlag } from '../ui/SvgFlag';
import {
  getRandomNumbers,
  getRegionTypeLabel,
  callingCodeToIso,
  getCountryPlan,
  getOperatorsForCountry,
  getRegionPool,
  expandPrefixes,
  generateBucketed,
  typesForPlan,
  validateCandidate
} from '../../data/numberingPlans.js';
import { ensureNumberingDatasets } from '../../data/numberingDatasets.js';
import { countries, DEFAULT_COUNTRY_CODE, getCountryByCallingCode } from '../../data/countries';
import { getDynamicRegionsForCountry } from '../../utils/geoLookup';
import { downloadFile } from '../../utils/exportUtils';

const MAX_QTY = 50000;

export const NumberGenerator = ({ onInsert, defaultCountry = DEFAULT_COUNTRY_CODE }) => {
  const [mode, setMode] = useState('sequential');

  // One shared target country for every mode - the top-level Target Country and
  // the generator can never drift apart.
  const [targetCountry, setTargetCountry] = useState(defaultCountry);
  const seqCountry = targetCountry;
  const randCountry = targetCountry;
  const regionCountry = targetCountry;

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

  const regionIso = useMemo(() => (regionCountry ? callingCodeToIso(regionCountry) : null), [regionCountry]);

  // Reset stale selections whenever the shared country changes.
  useEffect(() => {
    setSelectedRegionIds([]);
    setSelectedOperatorIds([]);
  }, [targetCountry]);

  // Sync defaultCountry changes from parent
  const lastDefaultCountry = useRef(defaultCountry);
  useEffect(() => {
    if (!defaultCountry || defaultCountry === lastDefaultCountry.current) return;
    lastDefaultCountry.current = defaultCountry;
    setTargetCountry(defaultCountry);
  }, [defaultCountry]);

  // Load region data: metadata-verified prefixes plus ISO 3166-2 label-only names
  useEffect(() => {
    let isCurrent = true;
    if (mode !== 'region') return;

    const iso = callingCodeToIso(regionCountry);
    if (!iso) {
      setRegions([]);
      setRegionSource(null);
      setSelectedRegionIds([]);
      return;
    }

    setIsLoadingRegions(true);
    getDynamicRegionsForCountry(iso, regionCountry)
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
        setSelectedRegionIds(list.length ? [list[0].id] : []);
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
  }, [mode, regionCountry]);

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

  const loadedOperators = operatorOptions;

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

  // Combined prefixes from selected regions AND operators
  const combinedPrefixCount = useMemo(() => {
    const set = new Set();
    selectedPrefixes.forEach((p) => set.add(p));
    selectedOperatorPrefixes.forEach((p) => set.add(p));
    return set.size;
  }, [selectedPrefixes, selectedOperatorPrefixes]);

  // Publish audience metadata to window
  useEffect(() => {
    if (!generated.length) {
      window.whatsappShieldAudienceType = null;
      window.whatsappShieldRegion = null;
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
    setGenerated([]);
    setReport(null);
    setGeneratedRegion(null);
    setDroppedCount(0);
    setStatus({ kind: 'idle', message: null });
    window.whatsappShieldAudienceType = null;
    window.whatsappShieldRegion = null;
  }, []);

  const countryName = useCallback((code) => {
    const c = getCountryByCallingCode(code) || countries.find((x) => x.iso.toLowerCase() === String(code).toLowerCase());
    return c ? c.name : code;
  }, []);

  const countryIsoForCode = useCallback((code) => {
    const c = getCountryByCallingCode(code) || countries.find((x) => x.iso.toLowerCase() === String(code).toLowerCase());
    return c ? c.iso.toUpperCase() : 'US';
  }, []);

  const isGenerating = status.kind === 'generating';

  // Mode 1: Sequential / Range Generation with libphonenumber validation
  const runSequential = async () => {
    const startStr = rangeStart.replace(/\D/g, '');
    const endStr = rangeEnd.replace(/\D/g, '');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      setStatus({ kind: 'error', message: 'Invalid range. Start must be a smaller number than End.' });
      return;
    }

    const count = end - start + 1;
    if (count > 10000) {
      setStatus({ kind: 'error', message: 'Range too large. Maximum 10,000 sequential numbers per batch.' });
      return;
    }

    const iso = callingCodeToIso(seqCountry);
    if (!iso) {
      setStatus({ kind: 'error', message: 'Please select a valid country first.' });
      return;
    }

    setStatus({ kind: 'generating', message: `Validating ${count.toLocaleString()} numbers…` });
    setRequestedQty(count);

    const cc = String(seqCountry).replace(/\D/g, '');
    const validNums = [];
    let invalid = 0;

    try {
      await ensureNumberingDatasets();
      const plan = getCountryPlan(iso);
      const types = typesForPlan(plan);
      const validateIso = plan ? plan.sourceIso || iso : iso;

      for (let i = start; i <= end; i += 1) {
        const national = String(i);
        const e164 = validateCandidate(validateIso, cc, national, types);
        if (e164) validNums.push(e164);
        else invalid += 1;
      }
    } catch (err) {
      setStatus({ kind: 'error', message: `Generation failed: ${(err && err.message) || 'unknown error'}` });
      setGenerated([]);
      setReport(null);
      setDroppedCount(0);
      return;
    }

    setGenerated(validNums);
    setDroppedCount(invalid);
    setReport({ mode: 'sequential', country: seqCountry, iso, prefix: null, requested: count, produced: validNums.length });
    setStatus({
      kind: 'done',
      message: `${validNums.length.toLocaleString()} valid numbers generated.${invalid > 0 ? ` (${invalid.toLocaleString()} outside this country's ${'numbering plan'} were dropped.)` : ''}`
    });
  };

  // Async Generator Helper
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
    setStatus({ kind: 'generating', message: `Generating ${requested.toLocaleString()} numbers…` });
    setRequestedQty(requested);

    // Yield once so the spinner paints before the CPU-bound generation loop runs.
    await new Promise((resolve) => setTimeout(resolve, 60));

    let result;
    try {
      result = await genFn(requested);
    } catch (err) {
      setStatus({ kind: 'error', message: `Generation failed: ${(err && err.message) || 'unknown error'}` });
      setGenerated([]);
      setReport(null);
      setDroppedCount(0);
      return;
    }

    const { numbers = [], error, truncated = false, report: extraReport = null } = result || {};
    if (error) {
      setStatus({ kind: 'error', message: error });
      setGenerated([]);
      setReport(null);
      setDroppedCount(0);
      return;
    }

    setGenerated(numbers);
    const merged = buildReport ? { ...buildReport(numbers, requested), ...(extraReport || {}) } : extraReport;
    setReport(merged);
    const removedCount = Math.max(0, requested - numbers.length);
    setDroppedCount(removedCount);

    const planLabel = modeName === 'region'
      ? (selectedRegionsList.length || selectedOperatorsList.length
        ? 'for these regions/operators'
        : 'for this country plan')
      : `for ${countryName(targetCountry)}`;

    setStatus({
      kind: 'done',
      message:
        numbers.length > 0
          ? `${numbers.length.toLocaleString()} valid numbers generated. ${
              removedCount > 0
                ? truncated
                  ? `This numbering plan can only supply ${numbers.length.toLocaleString()} distinct numbers ${planLabel}.`
                  : `(${removedCount.toLocaleString()} invalid/duplicate dropped.)`
                : 'All valid & unique.'
            }`
          : 'No valid numbers could be generated for this selection.'
    });
  };

  // Mode 2: Random Generation
  const runRandom = () => {
    const qty = randQuantity;
    const iso = callingCodeToIso(randCountry);
    if (!iso) {
      setStatus({ kind: 'error', message: 'Please select a valid country first.' });
      return;
    }
    generateAsync(
      'random',
      qty,
      async () => {
        await ensureNumberingDatasets();
        return getRandomNumbers(iso, Number(qty) || 0);
      },
      (numbers, requested) => ({ mode: 'random', country: randCountry, iso, prefix: null, requested, produced: numbers.length })
    );
  };
// Mode 3: Region-Wise Generation with fair multi-region / multi-operator distribution
  const runRegion = () => {
    generateAsync('region', regionQuantity, async () => {
      const totalTarget = Math.min(Math.floor(Number(regionQuantity)) || 0, MAX_QTY);

      const iso = callingCodeToIso(regionCountry);
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
      const cc = String(regionCountry).replace(/\D/g, '');

      const hasRegions = selectedRegionsList.length > 0;
      const hasOperators = selectedOperatorsList.length > 0;

      // Both empty means "All regions, any operator", which is the whole country plan.
      const buckets = [];
      if (hasRegions && hasOperators) {
        selectedRegionsList.forEach((r) => {
          selectedOperatorsList.forEach((o) => buckets.push({ region: r, operator: o }));
        });
      } else if (hasRegions) {
        selectedRegionsList.forEach((r) => buckets.push({ region: r, operator: null }));
      } else {
        selectedOperatorsList.forEach((o) => buckets.push({ region: null, operator: o }));
      }

      if (buckets.length === 0) {
        return { numbers: [], error: 'Select at least one region/state or operator, or leave both unselected to target the whole country.' };
      }

      // Resolve each bucket's prefix pool, then let the engine split the batch fairly.
      const fallbackUsed = [];
      const poolBuckets = buckets.map((bucket) => {
        const opPrefixes = bucket.operator && bucket.operator.prefixes.length ? bucket.operator.prefixes : null;

        // Operator selection narrows the pool; otherwise use the region's own pool.
        let pool = opPrefixes ? expandPrefixes(iso, opPrefixes) : (bucket.region ? getRegionPool(iso, bucket.region) : plan.prefixes);
        if (!pool || !pool.length) {
          if (opPrefixes) fallbackUsed.push(bucket.operator.name);
          pool = bucket.region ? getRegionPool(iso, bucket.region) : plan.prefixes;
        }
        if (!pool || !pool.length) pool = plan.prefixes;

        return { ...bucket, pool };
      });

      const batch = generateBucketed({
        iso,
        sourceIso: validateIso,
        callingCode: cc,
        total: totalTarget,
        buckets: poolBuckets,
        allowedTypes: types,
      });

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
      const labelOnly = usedRegions.size > 0 && Array.from(usedRegions).every((r) => r.labelOnly);

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
        country: regionCountry,
        iso,
        prefix: numbers.length > 0 ? numbers[0].number.prefix : '',
        requested: totalTarget,
        produced: numbers.length,
        regionCount: usedRegions.size,
        operatorCount: usedOperators.size,
        buckets: buckets.length,
        regionSource: regionSource || 'none',
        labelOnly,
        operatorFallback: fallbackUsed.length > 0,
      };

      return {
        numbers: numbers.map(({ number: n }) => n.number),
        truncated: batch.truncated,
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
    const filename = isRegion
      ? `whatsapp-shield-${report.country}-regions-${(selectedRegionsList.map(r => r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('_') || 'custom')}-numbers.csv`
      : `whatsapp-shield-${(report && report.country) || 'numbers'}.csv`;
    const header = isRegion ? 'country,country_code,region,operator,phone_number\n' : 'phone_number\n';
    const lines = generated.map((n) => {
      if (isRegion) {
        const clean = String(n).replace(/\D/g, '');
        const meta = window.__whatsappShieldNumberMetadata?.get(clean) || window.__whatsappShieldNumberMetadata?.get(n);
        const reg = (meta && meta.regionName) || (selectedRegionsList[0] && selectedRegionsList[0].name) || 'All regions';
        const op = (meta && meta.operatorName) || 'Any operator';
        const regMark = meta && meta.regionVerified === false && reg !== 'All regions' ? ' (label only)' : '';
        return `"${countryName(report.country)}",+${report.country},"${reg}${regMark}","${op}",${n}`;
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
              <CountrySelector selectedCountryCode={seqCountry} onSelect={setTargetCountry} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Number (without country code)</label>
              <Input
                placeholder="e.g., 3055581000"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Number</label>
              <Input
                placeholder="e.g., 3055581999"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                inputMode="numeric"
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
              <CountrySelector selectedCountryCode={randCountry} onSelect={setTargetCountry} />
              {randCountry && (
                <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                  <SvgFlag code={countryIsoForCode(randCountry)} width={18} />
                  <span className="font-medium">{countryName(randCountry)}</span>
                  <span className="text-primary font-mono">+{randCountry}</span>
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
              <CountrySelector selectedCountryCode={regionCountry} onSelect={setTargetCountry} />
            </div>

            {regionCountry && (
              <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                <SvgFlag code={countryIsoForCode(regionCountry)} width={18} />
                <span className="font-medium">{countryName(regionCountry)}</span>
                <span className="text-primary font-mono">+{regionCountry}</span>
                <Badge variant="outline" className="ml-auto capitalize">
                  {getRegionTypeLabel(regionIso)}
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
                      No carrier prefix data is published for {countryName(regionCountry)}. Numbers will still be
                      generated from the official {countryName(regionCountry)} numbering plan with any operator.
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
                                <span className="truncate">{op.name}</span>
                              </span>
                              <span className="text-[10px] font-mono text-text-muted shrink-0 ml-2">
                                +{regionCountry} {op.prefixes.slice(0, 3).join(', ')}{op.prefixes.length > 3 ? ` +${op.prefixes.length - 3}` : ''}
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
                        onClick={() => setSelectedRegionIds(regions.map((r) => r.id))}
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
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleRegion(r.id)}
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
                            <span className="truncate">{r.name}</span>
                            {r.labelOnly && (
                              <Badge variant="outline" className="shrink-0 text-[9px] px-1 py-0 font-normal">
                                label only
                              </Badge>
                            )}
                          </span>
                          <span className="text-[11px] font-mono text-text-muted shrink-0 ml-2">
                            {r.verified && r.prefix
                              ? `+${regionCountry} ${r.prefix}${extra ? ` (+${extra})` : ''}`
                              : `+${regionCountry} • any`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
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
            <span>Country: <b className="text-text-primary">{countryName(targetCountry)} (+{targetCountry})</b></span>
            {mode === 'region' && (
              <>
                <span>Selected Regions: <b className="text-text-primary">{selectedRegionsList.length > 0 ? selectedRegionsList.map((r) => r.name).join(', ') : 'All regions'}</b></span>
                <span>Operators: <b className="text-text-primary">{selectedOperatorsList.length > 0 ? selectedOperatorsList.map((o) => o.name).join(', ') : 'Any operator'}</b></span>
                <span>Targets: <b className="text-text-primary tabular-nums">{(report && report.buckets) || (selectedRegionsList.length || selectedOperatorsList.length || 1)}</b></span>
                {report && report.labelOnly && (
                  <span className="text-amber-500">Label-only regions (prefixes not mapped)</span>
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
