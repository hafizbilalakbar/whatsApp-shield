import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Users, Shuffle, MapPin, Copy, Download, RefreshCw, Check,
  AlertCircle, Info, Globe, ListOrdered, Search, X
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import CountrySelector from '../ui/CountrySelector';
import { SvgFlag } from '../ui/SvgFlag';
import {
  getRandomNumbers,
  getRegionNumbers,
  getRegionTypeLabel,
  callingCodeToIso,
  getCountryGeneratorContext
} from '../../data/numberingPlans';
import { countries, DEFAULT_COUNTRY_CODE, getCountryByCallingCode, getCountryByIso } from '../../data/countries';
import { getDynamicRegionsForCountry } from '../../utils/geoLookup';
import { downloadFile } from '../../utils/exportUtils';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const MAX_QTY = 50000;

export const NumberGenerator = ({ onInsert, defaultCountry = DEFAULT_COUNTRY_CODE }) => {
  const [mode, setMode] = useState('sequential');

  // Sequential mode state
  const [seqCountry, setSeqCountry] = useState(defaultCountry);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Random mode state
  const [randCountry, setRandCountry] = useState(defaultCountry);
  const [randQuantity, setRandQuantity] = useState('');

  // Region-wise state
  const [regionCountry, setRegionCountry] = useState(defaultCountry);
  const [selectedRegionIds, setSelectedRegionIds] = useState([]);
  const [regionSearch, setRegionSearch] = useState('');
  const [regionQuantity, setRegionQuantity] = useState('');
  const [regions, setRegions] = useState([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);

  // Shared results / status
  const [generated, setGenerated] = useState([]);
  const [status, setStatus] = useState({ kind: 'idle', message: null });
  const [generatedRegion, setGeneratedRegion] = useState(null);
  const [requestedQty, setRequestedQty] = useState(0);
  const [droppedCount, setDroppedCount] = useState(0);
  const [report, setReport] = useState(null);

  const regionIso = useMemo(() => (regionCountry ? callingCodeToIso(regionCountry) : null), [regionCountry]);
  const seqIso = useMemo(() => (seqCountry ? callingCodeToIso(seqCountry) : null), [seqCountry]);
  const randIso = useMemo(() => (randCountry ? callingCodeToIso(randCountry) : null), [randCountry]);

  // Sync defaultCountry changes from parent
  const lastDefaultCountry = useRef(defaultCountry);
  useEffect(() => {
    if (!defaultCountry || defaultCountry === lastDefaultCountry.current) return;
    lastDefaultCountry.current = defaultCountry;
    setSeqCountry(defaultCountry);
    setRandCountry(defaultCountry);
    setRegionCountry(defaultCountry);
    setSelectedRegionIds([]);
  }, [defaultCountry]);

  // Load dynamic region data from geocoding metadata
  useEffect(() => {
    let isCurrent = true;
    if (mode !== 'region') return;

    const iso = callingCodeToIso(regionCountry);
    if (!iso) {
      setRegions([]);
      setSelectedRegionIds([]);
      return;
    }

    setIsLoadingRegions(true);
    getDynamicRegionsForCountry(iso, regionCountry)
      .then((list) => {
        if (!isCurrent) return;
        setRegions(list);
        setIsLoadingRegions(false);
        if (list.length > 0) {
          setSelectedRegionIds([list[0].id]);
        } else {
          setSelectedRegionIds([]);
        }
      })
      .catch(() => {
        if (!isCurrent) return;
        setRegions([]);
        setSelectedRegionIds([]);
        setIsLoadingRegions(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [mode, regionCountry]);

  // Filtered regions in search
  const filteredRegions = useMemo(() => {
    const term = regionSearch.toLowerCase().trim();
    if (!term) return regions;
    return regions.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.prefix.includes(term) ||
        (r.prefixes && r.prefixes.some((p) => p.includes(term)))
    );
  }, [regions, regionSearch]);

  // Active selected region objects
  const selectedRegionsList = useMemo(() => {
    return regions.filter((r) => selectedRegionIds.includes(r.id));
  }, [regions, selectedRegionIds]);

  // Aggregated prefixes from all selected regions
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
  const runSequential = () => {
    const startStr = rangeStart.replace(/\D/g, '');
    const endStr = rangeEnd.replace(/\D/g, '');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    if (isNaN(start) || isNaN(end) || start >= end) {
      setStatus({ kind: 'error', message: 'Invalid range. Start must be a smaller number than End.' });
      return;
    }

    const count = end - start + 1;
    if (count > 10000) {
      setStatus({ kind: 'error', message: 'Range too large. Maximum 10,000 sequential numbers per batch.' });
      return;
    }

    const iso = countryIsoForCode(seqCountry);
    const cc = seqCountry.replace(/\D/g, '');
    const validNums = [];
    let invalid = 0;

    for (let i = start; i <= end; i++) {
      const numStr = `+${cc}${i}`;
      const parsed = parsePhoneNumberFromString(numStr, iso);
      if (parsed && (parsed.isValid() || parsed.isPossible())) {
        validNums.push(parsed.number);
      } else {
        invalid++;
      }
    }

    setGenerated(validNums);
    setDroppedCount(invalid);
    setReport({ mode: 'sequential', country: seqCountry, iso, prefix: null, requested: count, produced: validNums.length });
    setStatus({
      kind: 'done',
      message: `${validNums.length.toLocaleString()} valid numbers generated.${invalid > 0 ? ` (${invalid} invalid numbers dropped.)` : ''}`
    });
  };

  // Async Generator Helper
  const generateAsync = (modeName, quantity, genFn, buildReport) => {
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

    setTimeout(() => {
      const { numbers, error } = genFn();
      if (error) {
        setStatus({ kind: 'error', message: error });
        setGenerated([]);
        setReport(null);
        setDroppedCount(0);
        return;
      }
      setGenerated(numbers);
      setReport(buildReport(numbers));
      const removedCount = Math.max(0, requested - numbers.length);
      setDroppedCount(removedCount);
      setStatus({
        kind: 'done',
        message:
          numbers.length > 0
            ? `${numbers.length.toLocaleString()} valid numbers generated. ${
                removedCount > 0 ? `(${removedCount.toLocaleString()} invalid/duplicate dropped.)` : 'All valid & unique.'
              }`
            : 'No valid numbers could be generated for this selection.'
      });
    }, 60);
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
      'random', qty,
      () => getRandomNumbers(iso, qty),
      (numbers) => ({ mode: 'random', country: randCountry, iso, prefix: null, requested: requestedQty, produced: numbers.length })
    );
  };

  // Mode 3: Region-Wise Generation with multi-select prefixes
  const runRegion = () => {
    const qty = regionQuantity;
    if (selectedRegionsList.length === 0) {
      setStatus({ kind: 'error', message: 'Please select at least one region/state first.' });
      return;
    }
    const iso = callingCodeToIso(regionCountry);
    if (!iso) {
      setStatus({ kind: 'error', message: 'Please select a valid country first.' });
      return;
    }

    const firstRegion = selectedRegionsList[0];
    const stateNames = selectedRegionsList.map((r) => r.name).join(', ');
    setGeneratedRegion({ name: stateNames, prefix: selectedPrefixes[0] || firstRegion.prefix });

    // Multi-state generation: distribute target count across all selected prefixes
    const prefixesToUse = selectedPrefixes.length > 0 ? selectedPrefixes : [firstRegion.prefix];

    generateAsync(
      'region', qty,
      () => {
        const perPrefixQty = Math.ceil(Number(qty) / prefixesToUse.length);
        const collected = new Set();

        for (const pfx of prefixesToUse) {
          if (collected.size >= Number(qty)) break;
          const res = getRegionNumbers(iso, pfx, perPrefixQty);
          if (res.numbers && Array.isArray(res.numbers)) {
            res.numbers.forEach((n) => collected.add(n));
          }
        }

        const numbers = Array.from(collected).slice(0, Number(qty));
        return { numbers, error: numbers.length === 0 ? 'Could not produce numbers for these prefixes' : null };
      },
      (numbers) => ({
        mode: 'region',
        country: regionCountry,
        iso,
        prefix: prefixesToUse.slice(0, 3).join(', '),
        requested: requestedQty,
        produced: numbers.length
      })
    );
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
      ? `whatsapp-shield-${report.country}-region-${report.prefix}-numbers.csv`
      : `whatsapp-shield-${(report && report.country) || 'numbers'}.csv`;
    const header = isRegion ? 'country,country_code,region,phone_number\n' : 'phone_number\n';
    const lines = generated.map((n) => {
      if (isRegion) {
        return `${countryName(report.country)},+${report.country},${report.prefix},${n}`;
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
              <CountrySelector selectedCountryCode={seqCountry} onSelect={setSeqCountry} />
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
              <CountrySelector selectedCountryCode={randCountry} onSelect={setRandCountry} />
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
              <label className="block text-sm font-medium mb-1">Target Country</label>
              <CountrySelector selectedCountryCode={regionCountry} onSelect={setRegionCountry} />
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

            {/* Dynamic State/Region Multi-Select Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">
                  State / Region Selection ({selectedRegionsList.length} selected)
                </label>
                {selectedRegionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedRegionIds([])}
                    className="text-xs text-text-muted hover:text-primary transition-colors"
                  >
                    Deselect All
                  </button>
                )}
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
                  </div>

                  {/* Multi-select checkable list */}
                  <div className="max-h-48 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                    {filteredRegions.map((r) => {
                      const isSelected = selectedRegionIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleRegion(r.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all text-left ${
                            isSelected
                              ? 'bg-primary/15 text-primary font-semibold border border-primary/30'
                              : 'hover:bg-background/80 text-text-secondary border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${
                              isSelected ? 'bg-primary border-primary text-white' : 'border-border bg-background'
                            }`}>
                              {isSelected && <Check size={10} />}
                            </span>
                            <span className="truncate">{r.name}</span>
                          </div>
                          <span className="text-[11px] font-mono text-text-muted shrink-0 ml-2">
                            +{regionCountry} {r.prefix} {r.prefixes && r.prefixes.length > 1 ? `(+${r.prefixes.length - 1})` : ''}
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
            <span>Country: <b className="text-text-primary">{countryName(mode === 'sequential' ? seqCountry : mode === 'random' ? randCountry : regionCountry)} (+{mode === 'sequential' ? seqCountry : mode === 'random' ? randCountry : regionCountry})</b></span>
            {mode === 'region' && (
              <span>Selected Regions: <b className="text-text-primary">{selectedRegionsList.length > 0 ? selectedRegionsList.map((r) => r.name).join(', ') : 'None'}</b></span>
            )}
            {mode === 'region' && selectedPrefixes.length > 0 && (
              <span>Prefixes Used: <b className="text-primary font-mono">{selectedPrefixes.length} ({selectedPrefixes.slice(0, 4).join(', ')}{selectedPrefixes.length > 4 ? '…' : ''})</b></span>
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
