import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Upload, Type, AlertCircle, ArrowRight, ArrowLeft, Trash2, X, ChevronRight, ChevronDown, Globe, ExternalLink } from 'lucide-react';
import { parsePhoneNumberFromString, AsYouType, getCountries, getCountryCallingCode } from 'libphonenumber-js';
import { Button } from '../ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import CountrySelector from '../ui/CountrySelector';
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription } from '../ui/Toast';
import { useWebSocket } from '../../context/WebSocketProvider';
import { countries } from '../../data/countries';

const ALL_COUNTRY_CODES = getCountries().map(c => getCountryCallingCode(c)).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b.length - a.length);

const Step2Audience = ({ onNext, onPrev }) => {
  const [selectedCountry, setSelectedCountry] = useState('1');
  const [inputText, setInputText] = useState('');
  const [parsedNumbers, setParsedNumbers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
  const [toastMessage, setToastMessage] = useState(null);
  const [detectedCountries, setDetectedCountries] = useState([]);
  const [correctionsExpanded, setCorrectionsExpanded] = useState(true);
  const [newDatasetConfirmed, setNewDatasetConfirmed] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  
  const { setResultsList, clearScanState } = useWebSocket();

  const getCountryName = (code) => {
    if (!code) return 'Unknown';
    const c = countries.find(c => c.iso.toLowerCase() === code.toLowerCase());
    return c ? c.name : code;
  };

  const countryGroups = useMemo(() => {
    const groups = {};
    parsedNumbers.forEach(p => {
      const key = p.detectedCountry || 'Unknown';
      if (!groups[key]) groups[key] = { code: key, name: getCountryName(key), count: 0, numbers: [] };
      groups[key].count++;
      groups[key].numbers.push(p);
    });
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [parsedNumbers]);

  const countriesDetected = countryGroups.filter(g => g.code !== 'Unknown').length;

  const toggleCountryGroup = (code) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  useEffect(() => {
    window.__whatsappShieldAudience = parsedNumbers;
    return () => { window.__whatsappShieldAudience = []; };
  }, [parsedNumbers]);

  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [corrections, setCorrections] = useState([]);

  const normalizeNumber = useCallback((rawNum, fallbackCountryCode) => {
    // Step 1: Strip all non-numeric chars except leading +
    let cleaned = rawNum.trim();
    const hadPlus = cleaned.startsWith('+');
    
    // Replace common patterns
    cleaned = cleaned
      .replace(/^00/, '+')      // 00 instead of +
      .replace(/[\s\-\.\(\)\[\]]/g, '');

    // If no +, try prepending selected country code
    if (!cleaned.startsWith('+')) {
      const cc = fallbackCountryCode.replace(/\D/g, '');
      cleaned = `+${cc}${cleaned.replace(/^0+/, '')}`;
    }

    // Try parsing as-is
    let parsed = null;
    try { parsed = parsePhoneNumberFromString(cleaned); } catch (e) {}

    // If invalid, try all major country codes as prefix
    if (!parsed || !parsed.isValid()) {
      const digits = cleaned.replace(/\D/g, '');
      for (const code of ALL_COUNTRY_CODES) {
        if (digits.startsWith(code)) {
          try {
            const candidate = parsePhoneNumberFromString('+' + digits);
            if (candidate && candidate.isValid()) {
              parsed = candidate;
              break;
            }
          } catch (e) {}
        }
      }
    }

    // Final fallback: try removing first digit iteratively
    if (!parsed || !parsed.isValid()) {
      const digits = cleaned.replace(/\D/g, '');
      for (let i = 1; i <= 3 && i < digits.length; i++) {
        try {
          const candidate = parsePhoneNumberFromString('+' + digits.substring(i));
          if (candidate && candidate.isValid()) {
            parsed = candidate;
            break;
          }
        } catch (e) {}
      }
    }

    return parsed;
  }, []);

  const parseNumbers = useCallback((text, countryCode) => {
    if (!text.trim()) {
      setParsedNumbers([]);
      setCorrections([]);
      setDetectedCountries([]);
      setSummary({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
      return;
    }

    const rawNumbers = text.split(/[\n,;\t]+/).map(n => n.trim()).filter(n => n.length > 0);
    const results = [];
    const seen = new Set();
    const detectedCorrections = [];
    const countryCounts = {};

    rawNumbers.forEach((rawNum) => {
      let isValid = false;
      let formatted = rawNum;
      let errorMsg = null;
      let correction = null;
      let detectedCountry = null;
      let countryCode = '';
      let originalRaw = rawNum;

      try {
        const parsed = normalizeNumber(rawNum, countryCode);
        
        if (parsed && parsed.isValid()) {
          isValid = true;
          formatted = parsed.format('E.164');
          detectedCountry = parsed.country;
          countryCode = parsed.countryCallingCode;

          if (parsed.country) {
            countryCounts[parsed.country] = (countryCounts[parsed.country] || 0) + 1;
          }

          const rawClean = rawNum.replace(/[\s\-\.\(\)\[\]]/g, '');
          if (rawClean !== formatted && rawClean !== '+' + rawClean.replace(/^\+/, '')) {
            correction = `Corrected to ${formatted}`;
            detectedCorrections.push({ original: rawNum, formatted, correction });
          }
        } else {
          const clean = rawNum.replace(/\D/g, '');
          if (clean.length < 7) errorMsg = 'Number too short';
          else if (clean.length > 15) errorMsg = 'Number too long';
          else errorMsg = 'Could not parse';
        }
      } catch (e) {
        errorMsg = 'Invalid format';
      }

      const dupKey = formatted || rawNum;
      const isDuplicate = seen.has(dupKey);
      if (isValid) seen.add(dupKey);

      results.push({
        original: rawNum,
        formatted: isValid ? formatted : rawNum,
        isValid,
        isDuplicate,
        errorMsg,
        countryCode,
        detectedCountry
      });
    });

    setParsedNumbers(results);
    setCorrections(detectedCorrections);
    
    const countryCards = Object.entries(countryCounts)
      .map(([code, count]) => ({ code, name: getCountryName(code), count }))
      .sort((a, b) => b.count - a.count);
    setDetectedCountries(countryCards);

    setSummary({
      total: results.length,
      valid: results.filter(r => r.isValid && !r.isDuplicate).length,
      invalid: results.filter(r => !r.isValid).length,
      duplicates: results.filter(r => r.isDuplicate).length
    });
  }, [normalizeNumber]);

  useEffect(() => {
    parseNumbers(inputText, selectedCountry);
  }, [inputText, selectedCountry, parseNumbers]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setInputText(event.target.result);
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  const handleGenerateRange = () => {
    const start = parseInt(rangeStart.replace(/\D/g, ''), 10);
    const end = parseInt(rangeEnd.replace(/\D/g, ''), 10);
    if (isNaN(start) || isNaN(end) || start >= end) {
      setToastMessage('Invalid range. Start must be less than end.');
      return;
    }
    if (end - start > 10000) {
      setToastMessage('Range too large. Max 10,000 numbers.');
      return;
    }
    const generated = [];
    for (let i = start; i <= end; i++) {
      generated.push(i.toString());
    }
    setInputText(generated.join('\n'));
    setToastMessage(`Generated ${generated.length} numbers.`);
  };

  const removeDuplicates = () => {
    const unique = [];
    const seen = new Set();
    parsedNumbers.forEach(p => {
      if (!p.isDuplicate && !seen.has(p.formatted)) {
        unique.push(p.original);
        seen.add(p.formatted);
      } else if (p.isDuplicate && !seen.has(p.formatted)) {
        unique.push(p.original);
        seen.add(p.formatted);
      }
    });
    setInputText(unique.join('\n'));
    setToastMessage('Duplicates removed.');
  };

  const removeInvalid = () => {
    const validOnly = parsedNumbers.filter(p => p.isValid).map(p => p.original);
    setInputText(validOnly.join('\n'));
    setToastMessage('Invalid numbers removed.');
  };

  // Cleanup window globals on unmount so stale audience data never leaks across navigation
  useEffect(() => {
    return () => {
      delete window.whatsappShieldAudience;
      delete window.whatsappShieldCountryCode;
      delete window.whatsappShieldInputTimestamp;
    };
  }, []);

  const handleContinue = () => {
    const validNumbers = parsedNumbers.filter(p => p.isValid && !p.isDuplicate).map(p => p.formatted);
    window.whatsappShieldAudience = validNumbers;
    window.whatsappShieldCountryCode = selectedCountry;
    window.whatsappShieldInputTimestamp = Date.now();
    clearScanState();
    setNewDatasetConfirmed(true);
    setTimeout(() => setNewDatasetConfirmed(false), 2000);
    onNext();
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ToastProvider>
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl font-display font-semibold flex items-center gap-2 flex-wrap">
              <Users className="text-primary" /> Audience Setup
            </h2>
            <p className="text-text-secondary mt-1">Import and format the phone numbers you want to validate.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-48 md:w-64">
              <label className="block text-xs font-medium text-text-muted mb-1 uppercase tracking-wider">Target Country</label>
              <CountrySelector selectedCountryCode={selectedCountry} onSelect={setSelectedCountry} />
            </div>
            <a href="/number-formats" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline whitespace-nowrap mt-5 flex items-center gap-1">
              <ExternalLink size={12} /> Format Guide
            </a>
          </div>
        </div>

        {/* Country detection cards */}
        {detectedCountries.length > 1 && (
          <div className="flex flex-wrap gap-3 mb-4">
            {detectedCountries.map((dc, i) => (
              <div
                key={dc.code}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface shadow-sm animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
              >
                <img
                  src={`https://flagcdn.com/w20/${dc.code.toLowerCase()}.png`}
                  width="20"
                  alt={dc.name}
                  className="rounded-sm shadow-sm"
                />
                <span className="text-sm font-medium">+{getCountryCallingCode(dc.code)}</span>
                <span className="text-xs text-text-secondary">{dc.name}</span>
                <Badge variant="outline" className="text-[10px] ml-1">{dc.count}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow min-h-0">
          
          {/* Left/Main Col: Input Methods */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <Tabs defaultValue="manual" className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="manual" className="flex gap-2"><Type size={16} /> Paste List</TabsTrigger>
                <TabsTrigger value="upload" className="flex gap-2"><Upload size={16} /> Upload CSV/TXT</TabsTrigger>
                <TabsTrigger value="range" className="flex gap-2"><Users size={16} /> Range Gen</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual" className="flex-grow flex flex-col mt-0 h-full min-h-[300px]">
                <textarea
                  className="flex-grow w-full rounded-md border border-border bg-surface p-3 md:p-4 text-sm font-mono shadow-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-text-muted/50"
                  placeholder={`Paste phone numbers here...
One per line or comma separated.
Any format works: +92 300 1234567, 0092-300-1234567, (300) 123-4567, 07911 123456...
Spaces, dashes, dots, parens all auto-stripped.`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </TabsContent>
              
              <TabsContent value="upload" className="flex-grow mt-0">
                <Card className="h-full border-dashed border-2 flex flex-col items-center justify-center p-6 md:p-8 bg-surface/50 hover:bg-surface transition-colors">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <Upload size={24} className="md:w-7 md:h-7" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Upload Audience File</h3>
                  <p className="text-text-secondary text-sm text-center max-w-sm mb-6">
                    Accepts .csv or .txt files containing phone numbers. We'll automatically extract valid numbers.
                  </p>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Button asChild><span>Select File</span></Button>
                  </label>
                  <input id="file-upload" type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                </Card>
              </TabsContent>
              
              <TabsContent value="range" className="flex-grow mt-0">
                <Card className="h-full p-6">
                  <h3 className="font-semibold text-lg mb-4">Sequential Number Generator</h3>
                  <p className="text-text-secondary text-sm mb-6">
                    Generate a sequential list of numbers to discover valid accounts in a specific telecom block.
                  </p>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Number (without country code)</label>
                      <Input placeholder="e.g., 3001234500" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">End Number</label>
                      <Input placeholder="e.g., 3001234999" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                    </div>
                    <Button onClick={handleGenerateRange} variant="secondary" className="w-full">Generate Range</Button>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Col: Validation Summary */}
          <div className="flex flex-col gap-4">
            <Card className="bg-background/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Validation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">Total Processed</span>
                  <div className="flex items-center gap-2">
                    {corrections.length > 0 && (
                      <span className="text-xs text-primary font-mono">({corrections.length} corrected)</span>
                    )}
                    <span className="font-mono font-bold text-lg">{summary.total}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span>Valid Format</span>
                  </div>
                  <span className="font-mono font-semibold text-success">{summary.valid}</span>
                </div>

                {/* Country Breakdown */}
                {summary.valid > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="font-semibold text-text-primary flex items-center gap-1.5">
                        <Globe size={12} className="text-primary" />
                        {countriesDetected > 0 ? `${countriesDetected} ${countriesDetected === 1 ? 'country' : 'countries'} detected` : 'Detecting countries...'}
                      </span>
                      <span className="text-text-muted">{summary.valid} numbers</span>
                    </div>
                    <div className="space-y-0.5 px-2 pb-2">
                      {countryGroups.filter(g => g.code !== 'Unknown').map((group) => (
                        <div key={group.code} className="rounded-md border border-border/50 bg-surface/50 overflow-hidden">
                          <button
                            onClick={() => toggleCountryGroup(group.code)}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs hover:bg-surface/80 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={`https://flagcdn.com/w20/${group.code.toLowerCase()}.png`}
                                width="16"
                                alt={group.name}
                                className="rounded-sm shrink-0"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              <span className="font-medium text-text-primary truncate">{group.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-text-muted">{group.count}</span>
                              <ChevronDown size={10} className={`text-text-muted transition-transform ${expandedCountries.has(group.code) ? '' : '-rotate-90'}`} />
                            </div>
                          </button>
                          {expandedCountries.has(group.code) && (
                            <div className="max-h-32 overflow-y-auto custom-scrollbar border-t border-border/30">
                              {group.numbers.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1 text-xs text-text-secondary hover:bg-surface/50">
                                  <img
                                    src={`https://flagcdn.com/w20/${group.code.toLowerCase()}.png`}
                                    width="12"
                                    alt=""
                                    className="rounded-sm shrink-0"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                  <span className="font-mono truncate">{p.formatted}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {countryGroups.filter(g => g.code === 'Unknown').length > 0 && (
                        <div className="rounded-md border border-error/20 bg-error/5 overflow-hidden">
                          <button
                            onClick={() => toggleCountryGroup('Unknown')}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs hover:bg-error/10 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-4 h-4 rounded-sm bg-error/20 flex items-center justify-center shrink-0">
                                <AlertCircle size={10} className="text-error" />
                              </div>
                              <span className="font-medium text-error">Unknown / Invalid Country</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-error/70">{countryGroups.filter(g => g.code === 'Unknown')[0]?.count || 0}</span>
                              <ChevronDown size={10} className={`text-error/50 transition-transform ${expandedCountries.has('Unknown') ? '' : '-rotate-90'}`} />
                            </div>
                          </button>
                          {expandedCountries.has('Unknown') && (
                            <div className="max-h-32 overflow-y-auto custom-scrollbar border-t border-error/20">
                              {countryGroups.filter(g => g.code === 'Unknown')[0]?.numbers.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1 text-xs text-error hover:bg-error/5">
                                  <div className="w-3 h-3 rounded-sm bg-error/10 flex items-center justify-center shrink-0">
                                    <AlertCircle size={8} className="text-error/60" />
                                  </div>
                                  <span className="font-mono truncate">{p.original}</span>
                                  <span className="text-error/50 ml-auto shrink-0">{p.errorMsg || 'Unrecognized'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center py-2 border-b border-border group relative">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    <span>Duplicates</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {summary.duplicates > 0 && (
                      <button onClick={removeDuplicates} className="text-xs text-text-muted hover:text-warning underline decoration-dashed">Remove</button>
                    )}
                    <span className="font-mono font-semibold text-warning">{summary.duplicates}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-error" />
                    <span>Invalid Format</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {summary.invalid > 0 && (
                      <button onClick={removeInvalid} className="text-xs text-text-muted hover:text-error underline decoration-dashed">Remove</button>
                    )}
                    <span className="font-mono font-semibold text-error">{summary.invalid}</span>
                  </div>
                </div>
                
                {corrections.length > 0 && (
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-md text-xs space-y-1">
                    <button
                      onClick={() => setCorrectionsExpanded(!correctionsExpanded)}
                      className="font-semibold text-primary text-xs cursor-pointer flex items-center gap-1 w-full text-left"
                    >
                      <ChevronDown size={12} className={`transition-transform ${correctionsExpanded ? 'rotate-0' : '-rotate-90'}`} />
                      {corrections.length} numbers were auto-formatted
                    </button>
                    {correctionsExpanded && (
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {corrections.map((c, i) => (
                          <p key={i} className="text-text-secondary truncate">
                            <span className="font-mono">{c.original}</span> → <span className="font-mono text-primary">{c.formatted}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {summary.invalid > 0 && (
                  <div className="bg-error/10 border border-error/20 p-3 rounded-md text-xs space-y-1">
                    <p className="font-semibold text-error text-xs flex items-center gap-1">
                      <AlertCircle size={12} /> {summary.invalid} invalid numbers
                    </p>
                    <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                      {parsedNumbers.filter(p => !p.isValid).map((p, i) => (
                        <p key={i} className="text-error truncate flex items-center gap-1" title={p.errorMsg || 'Invalid format'}>
                          <span className="font-mono">{p.original}</span>
                          <span className="text-error/70">— {p.errorMsg || 'Invalid format'}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <a href="/number-formats" target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline text-center mt-2">
                  View supported number formats →
                </a>
              </CardContent>
            </Card>
            
            <div className="mt-auto flex gap-3 pt-4">
              <Button variant="outline" onClick={onPrev} className="px-3">
                <ArrowLeft size={16} />
              </Button>
              <div className="flex-1 flex items-center gap-3">
                {newDatasetConfirmed && (
                  <span className="animate-in fade-in zoom-in-95 duration-200 text-xs font-medium text-success flex items-center gap-1 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    New dataset confirmed
                  </span>
                )}
                <Button className="flex-1" onClick={handleContinue} disabled={summary.valid === 0}>
                  Continue to Safety <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {toastMessage && (
          <Toast open={!!toastMessage} onOpenChange={() => setToastMessage(null)} variant="default">
            <ToastDescription>{toastMessage}</ToastDescription>
          </Toast>
        )}
        <ToastViewport />
      </ToastProvider>
    </div>
  );
};

export default Step2Audience;
