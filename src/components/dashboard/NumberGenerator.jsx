import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Users, Shuffle, MapPin, Copy, Download, Eraser, RefreshCw, Check,
  AlertCircle, Info, ShieldAlert, Globe, ListOrdered,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import CountrySelector from '../ui/CountrySelector';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select';
import {
  getRandomNumbers,
  getRegionNumbers,
  getRegionsForCountry,
  getRegionTypeLabel,
  callingCodeToIso,
} from '../../data/numberingPlans';
import { countries, DEFAULT_COUNTRY_CODE, getCountryByCallingCode } from '../../data/countries';
import { downloadFile } from '../../utils/exportUtils';

const MAX_QTY = 50000;

export const NumberGenerator = ({ onInsert, defaultCountry = DEFAULT_COUNTRY_CODE }) => {
  const [mode, setMode] = useState('sequential');

  // Sequential (existing) state
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Random mode state
  const [randCountry, setRandCountry] = useState(defaultCountry);
  const [randQuantity, setRandQuantity] = useState('');

  // Region-wise state
  const [regionCountry, setRegionCountry] = useState(defaultCountry);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [regionQuantity, setRegionQuantity] = useState('');
  const [regions, setRegions] = useState([]);

  // Shared results / status
  const [generated, setGenerated] = useState([]);
  const [status, setStatus] = useState({ kind: 'idle', message: null });
  const [generatedRegion, setGeneratedRegion] = useState(null);
  const [requestedQty, setRequestedQty] = useState(0);
  const [report, setReport] = useState(null);

  const regionPrefix = useMemo(() => {
    const sel = regions.find((r) => r.id === selectedRegionId);
    return sel ? sel.prefix : '';
  }, [regions, selectedRegionId]);

  const regionIso = useMemo(() => (regionCountry ? callingCodeToIso(regionCountry) : null), [regionCountry]);

  const reloadRegions = useCallback((country) => {
    if (!country) return setRegions([]);
    const iso = callingCodeToIso(country);
    if (!iso) return setRegions([]);
    const list = getRegionsForCountry(iso).map((r, i) => ({ ...r, id: `${r.prefix}::${i}` }));
    const defaultItem = list.find((r) => r.isDefault) || list[0];
    setRegions(list);
    setSelectedRegionId(defaultItem ? defaultItem.id : '');
  }, []);

  useEffect(() => {
    if (mode === 'region') reloadRegions(regionCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, regionCountry]);

  const countryName = useCallback((code) => {
    // Deterministic shared-code resolution: +1 → United States.
    const c = getCountryByCallingCode(code) || countries.find((x) => x.iso.toLowerCase() === String(code).toLowerCase());
    return c ? c.name : code;
  }, []);

  const flagUrl = useCallback((code) => {
    const c = getCountryByCallingCode(code) || countries.find((x) => x.iso.toLowerCase() === String(code).toLowerCase());
    return c ? `https://flagcdn.com/w20/${c.iso}.png` : '';
  }, []);

  const isGenerating = status.kind === 'generating';

  const runSequential = () => {
    const start = parseInt(rangeStart.replace(/\D/g, ''), 10);
    const end = parseInt(rangeEnd.replace(/\D/g, ''), 10);
    if (isNaN(start) || isNaN(end) || start >= end) {
      setStatus({ kind: 'error', message: 'Invalid range. Start must be a smaller number than End.' });
      return;
    }
    if (end - start > 10000) {
      setStatus({ kind: 'error', message: 'Range too large. Maximum 10,000 sequential numbers.' });
      return;
    }
    const nums = [];
    for (let i = start; i <= end; i++) nums.push(i.toString());
    setGenerated(nums);
    setReport({ mode: 'sequential', country: null, prefix: null, requested: nums.length, produced: nums.length });
    setStatus({ kind: 'done', message: `Generated ${nums.length} sequential numbers.` });
  };

  // Async generation so large batches don't block the UI thread.
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
    // Yield to the browser so the spinner paints.
    setTimeout(() => {
      const { numbers, error } = genFn();
      if (error) {
        setStatus({ kind: 'error', message: error });
        setGenerated([]);
        setReport(null);
        return;
      }
      setGenerated(numbers);
      setReport(buildReport(numbers));
      const removedCount = requested - numbers.length;
      setStatus({
        kind: 'done',
        message:
          numbers.length > 0
            ? `${numbers.length === 1 ? '1 number' : numbers.length.toLocaleString() + ' numbers'} generated. ${
                removedCount > 0 ? `(${removedCount.toLocaleString()} duplicate/unavailable removed automatically.)` : 'All unique, no duplicates.'
              }`
            : 'No valid numbers could be generated for this selection.',
      });
    }, 60);
  };

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
      (numbers) => ({ mode: 'random', country: randCountry, iso, prefix: null, requested: requestedQty, produced: numbers.length }),
    );
  };

  const runRegion = () => {
    const qty = regionQuantity;
    if (!regionPrefix) {
      setStatus({ kind: 'error', message: 'Please select a region first.' });
      return;
    }
    const iso = callingCodeToIso(regionCountry);
    if (!iso) {
      setStatus({ kind: 'error', message: 'Please select a valid country first.' });
      return;
    }
    const chosen = regions.find((r) => r.id === selectedRegionId);
    setGeneratedRegion(chosen || null);
    generateAsync(
      'region', qty,
      () => getRegionNumbers(iso, regionPrefix, qty),
      (numbers) => ({ mode: 'region', country: regionCountry, iso, prefix: regionPrefix, requested: requestedQty, produced: numbers.length }),
    );
  };

  const handleGenerate = () => {
    if (mode === 'sequential') runSequential();
    else if (mode === 'random') runRandom();
    else runRegion();
  };

  const handleClear = () => {
    setGenerated([]);
    setReport(null);
    setStatus({ kind: 'idle', message: null });
  };

  const handleRegenerate = () => handleGenerate();

  const handleCopy = async () => {
    if (generated.length === 0) return;
    try {
      await navigator.clipboard.writeText(generated.join('\n'));
      setStatus({ kind: 'success', message: 'Numbers copied to clipboard.' });
    } catch (e) {
      setStatus({ kind: 'error', message: 'Could not copy to clipboard.' });
    }
  };

  const handleDownload = () => {
    if (generated.length === 0) return;
    const isRegion = report && report.mode === 'region';
    const filename = isRegion
      ? `whatsapp-shield-${report.country}-region-${report.prefix}-numbers.${'csv'}`
      : `whatsapp-shield-${(report && report.country) || 'numbers'}-${report && report.mode === 'random' ? 'random' : 'numbers'}.${'csv'}`;
    const header = isRegion ? 'country,country_code,region_prefix,phone_number\n' : 'phone_number\n';
    const lines = generated.map((n) => {
      if (isRegion) {
        const cc = report.country;
        return `${countryName(report.country)},+${cc},${report.prefix},${n}`;
      }
      return n;
    });
    downloadFile('\uFEFF' + header + lines.join('\n'), filename, 'text/csv;charset=utf-8');
    setStatus({ kind: 'success', message: `Downloaded ${generated.length.toLocaleString()} numbers.` });
  };

  const handleUse = () => {
    if (onInsert && generated.length > 0) {
      onInsert(generated.join('\n'));
      setStatus({ kind: 'success', message: 'Generated numbers added to the input list.' });
    }
  };

  const meta = report || { mode, country: null, prefix: null, requested: 0, produced: 0 };
  const reportCountry = meta.country;

  const StatusBadge = ({ statusKind }) => {
    if (!statusKind) return null;
    if (statusKind === 'generating') return <Badge variant="secondary" className="inline-flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Generating…</Badge>;
    if (statusKind === 'done') return <Badge variant="success" className="inline-flex items-center gap-1"><Check size={12} /> Completed</Badge>;
    if (statusKind === 'error') return <Badge variant="destructive" className="inline-flex items-center gap-1"><AlertCircle size={12} /> Error</Badge>;
    return <Badge variant="outline">Idle</Badge>;
  };

  return (
    <Card className="h-full p-4 md:p-6 border-border">
      {/* Mode selector */}
      <div className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            <Users className="text-primary" /> Number Generator
          </h3>
          <span className="text-xs text-text-muted">Synthetic / test numbers for authorized, consent-based lists only.</span>
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
              Generate a sequential list of numbers from a start to an end value.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Start Number (without country code)</label>
              <Input placeholder="e.g., 3001234500" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Number</label>
              <Input placeholder="e.g., 3001234999" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} inputMode="numeric" />
            </div>
          </div>
        )}

        {/* ==================== RANDOM MODE ==================== */}
        {mode === 'random' && (
          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Pick a country, then generate that exact number of random, correctly formatted numbers with the right country code.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <CountrySelector selectedCountryCode={randCountry} onSelect={setRandCountry} />
              {randCountry && (
                <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                  <img src={flagUrl(randCountry)} width="18" alt="" className="rounded-sm border border-border" />
                  <span className="font-medium">{countryName(randCountry)}</span>
                  <span className="text-primary font-mono">+{randCountry}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max={MAX_QTY}
                  placeholder="e.g., 100, 500, 1000"
                  value={randQuantity}
                  onChange={(e) => setRandQuantity(e.target.value)}
                />
              </div>
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

        {/* ==================== REGION MODE ==================== */}
        {mode === 'region' && (
          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Select a country, then choose a region to generate numbers using that region's correct prefix.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <CountrySelector selectedCountryCode={regionCountry} onSelect={setRegionCountry} />
            </div>
            {regionCountry && (
              <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                <img src={flagUrl(regionCountry)} width="18" alt="" className="rounded-sm border border-border" />
                <span className="font-medium">{countryName(regionCountry)}</span>
                <span className="text-primary font-mono">+{regionCountry}</span>
                <Badge variant="outline" className="ml-auto capitalize">{getRegionTypeLabel(regionIso)}</Badge>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">
                Region / {getRegionTypeLabel(regionIso) === 'state' ? 'State' : getRegionTypeLabel(regionIso) === 'province' ? 'Province' : 'Area'}
              </label>
              {regions.length === 0 ? (
                <div className="text-sm text-text-muted">Loading regions…</div>
              ) : (
                <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                  <SelectTrigger><SelectValue placeholder="Select a region" /></SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} · +{regionCountry} {r.prefix}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {regionPrefix && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Globe size={12} className="text-primary" />
                  <span className="text-text-secondary">Selected regional prefix</span>
                  <span className="font-mono text-primary font-semibold">+{regionCountry} {regionPrefix}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max={MAX_QTY}
                  placeholder="e.g., 100, 500, 1000"
                  value={regionQuantity}
                  onChange={(e) => setRegionQuantity(e.target.value)}
                />
              </div>
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

        {/* ==================== GENERATE + ACTIONS ==================== */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button onClick={handleGenerate} loading={isGenerating} disabled={isGenerating} className="flex-1">
            {mode === 'random' ? <Shuffle size={16} className="mr-2" /> : mode === 'region' ? <MapPin size={16} className="mr-2" /> : <ListOrdered size={16} className="mr-2" />}
            {mode === 'sequential' ? 'Generate Range' : 'Generate Numbers'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleCopy} disabled={generated.length === 0 || isGenerating} title="Copy">
              <Copy size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownload} disabled={generated.length === 0 || isGenerating} title="Download CSV">
              <Download size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleClear} disabled={generated.length === 0 && status.kind === 'idle'} title="Clear">
              <Eraser size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleRegenerate} disabled={isGenerating} title="Regenerate">
              <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* ==================== STATUS + SUMMARY ==================== */}
        <div className="rounded-lg border border-border bg-background/50 p-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge statusKind={status.kind} />
              <span className="text-xs text-text-secondary">{status.message}</span>
            </div>
          </div>

          {generated.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-md border border-border bg-surface p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Country</div>
                <div className="text-xs font-semibold truncate flex items-center justify-center gap-1">
                  {reportCountry ? (
                    <>
                      <img src={flagUrl(reportCountry)} width="14" alt="" className="rounded-sm" />
                      {countryName(reportCountry)}
                    </>
                  ) : '—'}
                </div>
              </div>
              <div className="rounded-md border border-border bg-surface p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Country Code</div>
                <div className="text-xs font-mono font-semibold text-primary">
                  {reportCountry ? `+${reportCountry}` : '—'}
                </div>
              </div>
              <div className="rounded-md border border-border bg-surface p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Requested</div>
                <div className="text-xs font-mono font-semibold">{meta.requested ? meta.requested.toLocaleString() : '—'}</div>
              </div>
              <div className="rounded-md border border-border bg-surface p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Generated</div>
                <div className="text-xs font-mono font-semibold text-success">{meta.produced ? meta.produced.toLocaleString() : '—'}</div>
              </div>
            </div>
          )}

          {report && report.mode === 'region' && generated.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-text-muted">Region prefix:</span>
              <Badge variant="outline" className="font-mono">+{report.country} {generatedRegion ? generatedRegion.prefix : report.prefix}</Badge>
              <span className="text-text-muted">·</span>
              <span className="text-text-secondary">{generatedRegion ? generatedRegion.name : ''}</span>
            </div>
          )}

          {/* Generated numbers preview */}
          {generated.length > 0 && (
            <div className="rounded-md border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/60">
                <span className="text-xs font-semibold text-text-secondary">Generated numbers</span>
                <span className="text-xs text-text-muted">{generated.length.toLocaleString()} total</span>
              </div>
              <div className="max-h-44 overflow-y-auto custom-scrollbar p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                {generated.slice(0, 200).map((n, i) => (
                  <code key={n + i} className="text-xs font-mono px-2 py-1 rounded bg-background/60 truncate">{n}</code>
                ))}
                {generated.length > 200 && (
                  <div className="col-span-full text-center text-xs text-text-muted py-2">
                    … and {generated.length - 200} more. Download the full list below.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-text-secondary">
            <ShieldAlert size={14} className="shrink-0 mt-0.5 text-warning" />
            <p>
              Generated numbers are synthetic/test data formatted to the selected country's official numbering plan. The system
              does not verify WhatsApp, Business WhatsApp, or a real client behind any generated number. Only use these against
              authorized, consent-based, or publicly provided contacts, and comply with applicable laws and WhatsApp policies.
            </p>
          </div>

          {generated.length > 0 && onInsert && (
            <Button variant="secondary" className="w-full" onClick={handleUse}>
              <Info size={16} className="mr-2" /> Use in validation list ({generated.length.toLocaleString()})
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default NumberGenerator;
