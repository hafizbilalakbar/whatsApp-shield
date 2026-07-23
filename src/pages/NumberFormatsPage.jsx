import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, FileText, Table2, Check, X, Globe, Sparkles, ArrowRight, Sliders } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { countries } from '../data/countries';

const REGIONS = [
  { name: 'North America', codes: ['US', 'CA', 'MX'] },
  { name: 'Europe', codes: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI', 'PT', 'BE', 'CH', 'AT', 'IE', 'PL', 'CZ', 'GR', 'HU', 'RO', 'RU'] },
  { name: 'Asia', codes: ['PK', 'IN', 'CN', 'JP', 'KR', 'SG', 'HK', 'MY', 'TH', 'VN', 'PH', 'ID', 'BD', 'LK', 'NP'] },
  { name: 'Middle East', codes: ['AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'JO', 'LB', 'IL', 'TR', 'IR'] },
  { name: 'Africa', codes: ['ZA', 'NG', 'KE', 'EG', 'MA', 'DZ', 'TN', 'GH', 'CM'] },
  { name: 'South America', codes: ['BR', 'AR', 'CO', 'CL', 'PE', 'EC', 'UY', 'PY', 'BO'] },
  { name: 'Oceania', codes: ['AU', 'NZ', 'FJ', 'PG'] },
];

const FORMAT_EXAMPLES = [
  { input: '+92 300 1234567', country: 'PK', desc: 'Pakistan mobile with spaces' },
  { input: '0092-300-1234567', country: 'PK', desc: 'Double zero instead of plus' },
  { input: '92300-1234567', country: 'PK', desc: 'Country code without plus' },
  { input: '0300-1234567', country: 'PK', desc: 'Local format with leading zero' },
  { input: '(555) 123-4567', country: 'US', desc: 'Area code in parentheses' },
  { input: '+1 (555) 123-4567', country: 'US', desc: 'US with plus and parens' },
  { input: '300.123.4567', country: 'US', desc: 'Dots as separators' },
  { input: '001-408-555-0101', country: 'US', desc: 'US with 00 prefix' },
  { input: '14085550101', country: 'US', desc: 'Raw digits, no formatting' },
  { input: '07911 123456', country: 'GB', desc: 'UK local mobile format' },
  { input: '+44 7911 123456', country: 'GB', desc: 'UK with country code' },
  { input: '8-800-123-45-67', country: 'RU', desc: 'Russian toll-free format' },
  { input: '+86 138 0013 8000', country: 'CN', desc: 'China mobile with spaces' },
  { input: '91 98765 43210', country: 'IN', desc: 'India mobile with space' },
  { input: '+49 170 1234567', country: 'DE', desc: 'German mobile format' },
  { input: '+33 6 12 34 56 78', country: 'FR', desc: 'French mobile with spaces' },
  { input: '+81 90-1234-5678', country: 'JP', desc: 'Japanese mobile with dash' },
  { input: '+61 4 1234 5678', country: 'AU', desc: 'Australian mobile format' },
  { input: '+55 11 91234-5678', country: 'BR', desc: 'Brazilian mobile format' },
  { input: '+27 82 123 4567', country: 'ZA', desc: 'South African mobile' },
  { input: '+971 50 123 4567', country: 'AE', desc: 'UAE mobile format' },
  { input: '+966 55 123 4567', country: 'SA', desc: 'Saudi Arabia mobile' },
  { input: '+234 803 123 4567', country: 'NG', desc: 'Nigeria mobile format' },
  { input: '+82 10-1234-5678', country: 'KR', desc: 'South Korea mobile' },
];

const COMMON_MISTAKES = [
  { wrong: '+92 300 123456', reason: 'Too few digits (missing last digit)', right: '+92 300 1234567' },
  { wrong: '0300 1234567', reason: 'No country code for international context', right: '+92 300 1234567' },
  { wrong: '3001234567', reason: 'Ambiguous without country selection', right: '+1 3001234567 or +92 3001234567' },
  { wrong: '+1 12345', reason: 'Too short for any valid number', right: '+1 (555) 123-4567' },
  { wrong: '123-456-7890 extra', reason: 'Contains non-numeric text', right: '+1 123-456-7890' },
];

const SAMPLE_CSV = `phone_number
+14085550101
+923001234567
+447911123456
+8613800138000
+919876543210`;

const TABS = ['Formats Explorer', 'CSV / TXT Requirements', 'Range Generator'];

export default function NumberFormatsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [demoInput, setDemoInput] = useState('');
  const [demoOutput, setDemoOutput] = useState('');
  const [demoCountry, setDemoCountry] = useState('');
  const [demoParsed, setDemoParsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [morphText, setMorphText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const inputRef = useRef(null);

  const placeholders = [
    '+92 300 1234567',
    '(555) 123-4567',
    '0092-300-1234567',
    '+44 7911 123456',
    '91 98765 43210',
    '+86 138 0013 8000',
  ];

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    const phInterval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(phInterval);
  }, []);

  const handleDemoChange = (val) => {
    setDemoInput(val);
    if (!val.trim()) {
      setDemoOutput('');
      setDemoCountry('');
      setDemoParsed(false);
      setMorphText('');
      return;
    }
    try {
      const parsed = parsePhoneNumberFromString(val);
      if (parsed && parsed.isValid()) {
        setDemoOutput(parsed.formatInternational());
        setDemoCountry(parsed.country || '');
        setDemoParsed(true);
        setMorphText(parsed.formatInternational());
      } else {
        const cleaned = val.replace(/[\s\-\.\(\)\[\]]/g, '');
        const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/^0+/, '')}`;
        setDemoOutput(formatted);
        setDemoCountry('');
        setDemoParsed(false);
        setMorphText(formatted);
      }
    } catch (e) {
      const cleaned = val.replace(/[\s\-\.\(\)\[\]]/g, '');
      const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/^0+/, '')}`;
      setDemoOutput(formatted);
      setDemoCountry('');
      setDemoParsed(false);
      setMorphText(formatted);
    }
  };

  const getCountryName = (code) => {
    const c = countries.find(cc => cc.iso.toLowerCase() === code.toLowerCase());
    return c ? c.name : code;
  };

  const getRegionForCountry = (code) => {
    for (const region of REGIONS) {
      if (region.codes.includes(code.toUpperCase())) return region.name;
    }
    return 'Other';
  };

  const groupedFormats = useMemo(() => {
    const groups = {};
    FORMAT_EXAMPLES.forEach(f => {
      const region = getRegionForCountry(f.country);
      if (!groups[region]) groups[region] = [];
      groups[region].push(f);
    });
    return groups;
  }, []);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedFormats;
    const q = searchQuery.toLowerCase();
    const result = {};
    Object.entries(groupedFormats).forEach(([region, formats]) => {
      const filtered = formats.filter(f =>
        f.input.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) ||
        f.country.toLowerCase().includes(q) ||
        getCountryName(f.country).toLowerCase().includes(q)
      );
      if (filtered.length > 0) result[region] = filtered;
    });
    return result;
  }, [groupedFormats, searchQuery]);

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-numbers.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isDark = document.querySelector('[data-theme]')?.getAttribute('data-theme') === 'dark';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Globe className="text-primary h-9 w-9" />
          <h1 className="text-3xl md:text-4xl font-display font-bold">Number Format Explorer</h1>
        </div>
        <p className="text-text-secondary max-w-2xl mx-auto text-sm">
          Type any phone number format below and watch it transform in real time.
        </p>
      </motion.div>

      {/* Live Demo Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10"
      >
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-primary" />
              <span className="text-sm font-medium text-text-secondary">Live Demo</span>
            </div>
            <div className="flex flex-col gap-6">
              {/* Input */}
              <div className="relative">
                {!demoInput && (
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1">
                    <span className="text-text-muted font-mono text-base md:text-lg transition-opacity duration-300">
                      {placeholders[placeholderIndex]}
                    </span>
                    <span
                      className={`inline-block w-[2px] h-5 bg-primary transition-opacity ${
                        showCursor ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={demoInput}
                  onChange={(e) => handleDemoChange(e.target.value)}
                  placeholder=""
                  className="w-full rounded-xl border-2 border-border bg-surface p-4 text-base md:text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ArrowRight size={20} className="text-primary" />
                </div>
              </div>

              {/* Output */}
              <div
                className={`w-full rounded-xl border-2 p-4 transition-all duration-300 min-h-[56px] flex items-center font-mono text-base md:text-lg ${
                  demoOutput
                    ? demoParsed
                      ? 'border-success/50 bg-success/5 text-success'
                      : 'border-warning/50 bg-warning/5 text-warning'
                    : 'border-border bg-surface text-text-muted'
                }`}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={morphText || 'empty'}
                    initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                    transition={{ duration: 0.3 }}
                  >
                    {demoOutput || 'Cleaned result appears here...'}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* Status */}
              {demoOutput && (
                <div className="flex items-center gap-3">
                  {demoParsed ? (
                    <>
                      <Badge variant="success" className="gap-1">
                        <Check size={12} /> Valid E.164
                      </Badge>
                      {demoCountry && (
                        <span className="text-xs text-text-secondary font-mono">
                          {getCountryName(demoCountry)} ({demoCountry})
                        </span>
                      )}
                    </>
                  ) : (
                    <Badge variant="warning" className="gap-1">
                      <X size={12} /> Could not validate
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabbed Interface */}
      <div>
        {/* Tab buttons */}
        <div className="flex border-b border-border mb-6 overflow-x-auto">
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {i === 0 && <Table2 size={14} className="inline mr-1.5 -mt-0.5" />}
              {i === 1 && <FileText size={14} className="inline mr-1.5 -mt-0.5" />}
              {i === 2 && <Sliders size={14} className="inline mr-1.5 -mt-0.5" />}
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {/* Tab 1: Formats Explorer */}
              {activeTab === 0 && (
                <div className="space-y-6">
                  {/* Search */}
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by country, format, or pattern..."
                      className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Grouped Tables */}
                  {Object.entries(filteredGroups).length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-text-muted">No formats match your search.</CardContent></Card>
                  ) : (
                    Object.entries(filteredGroups).map(([region, formats]) => (
                      <div key={region}>
                        <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
                          <Globe size={16} className="text-primary" /> {region}
                          <span className="text-xs text-text-muted font-normal">{formats.length} formats</span>
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-border mb-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Example Input</TableHead>
                                <TableHead>What Tool Detects</TableHead>
                                <TableHead>Normalized Output</TableHead>
                                <TableHead>Country</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {formats.map((f, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono text-sm whitespace-nowrap">{f.input}</TableCell>
                                  <TableCell className="text-text-secondary text-sm">{f.desc}</TableCell>
                                  <TableCell className="font-mono text-sm text-success whitespace-nowrap">
                                    {(() => {
                                      const parsed = parsePhoneNumberFromString(f.input);
                                      return parsed ? parsed.formatInternational() : f.input;
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-sm">{getCountryName(f.country)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: CSV / TXT Requirements */}
              {activeTab === 1 && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><FileText size={18} className="text-primary" /> File Format Requirements</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-text-secondary">
                        Upload a <code className="bg-surface px-1 py-0.5 rounded text-primary font-mono text-xs">.csv</code> or{' '}
                        <code className="bg-surface px-1 py-0.5 rounded text-primary font-mono text-xs">.txt</code> file with one phone number per line.
                        A header row (<code className="bg-surface px-1 py-0.5 rounded font-mono text-xs">phone_number</code>) is optional.
                      </p>
                      <div className="bg-[#0A0F1C] border border-[#1F2937] rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1F2937] bg-[#111827]">
                          <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                          <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                          <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                          <span className="text-xs text-text-muted ml-2 font-mono">sample-numbers.csv</span>
                        </div>
                        <pre className="p-4 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
                          <code>
                            <span className="text-slate-400"># WhatsApp Shield - Sample Input File</span>{'\n'}
                            <span className="text-slate-400"># One number per line, any format accepted</span>{'\n'}
                            {'\n'}
                            <span className="text-blue-400">phone_number</span>{'\n'}
                            <span className="text-green-400">+14085550101</span>{'\n'}
                            <span className="text-green-400">+923001234567</span>{'\n'}
                            <span className="text-green-400">+447911123456</span>{'\n'}
                            <span className="text-green-400">(555) 123-4567</span>{'\n'}
                            <span className="text-green-400">0092-300-7654321</span>{'\n'}
                            <span className="text-green-400">+8613800138000</span>
                          </code>
                        </pre>
                      </div>
                      <Button variant="outline" size="sm" onClick={downloadSampleCSV}>
                        <Download size={14} className="mr-2" /> Download Sample CSV
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Common Mistakes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><X size={18} className="text-error" /> Common Formatting Mistakes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {COMMON_MISTAKES.map((m, i) => (
                          <div key={i} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border border-border bg-surface">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm">
                                <X size={14} className="text-error shrink-0" />
                                <span className="font-mono text-error line-through">{m.wrong}</span>
                              </div>
                              <p className="text-xs text-text-secondary mt-1">{m.reason}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm shrink-0">
                              <Check size={14} className="text-success shrink-0" />
                              <span className="font-mono text-success">{m.right}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Tab 3: Range Generator */}
              {activeTab === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sliders size={18} className="text-primary" /> Range Generator Visual Guide</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-sm text-text-secondary">
                      The Range Generator lets you create sequential phone numbers starting from a base number. Specify a start number, an end number, and optionally a step value.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="rounded-xl border border-border bg-surface p-5">
                        <h4 className="text-sm font-semibold mb-3">Configuration Panel</h4>
                        <svg viewBox="0 0 240 120" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="0.5" y="0.5" width="239" height="119" rx="7.5" stroke="#1F2937" fill="#111827" />
                          <text x="16" y="22" fontSize="9" fill="#9CA3AF" fontFamily="monospace">Start Number</text>
                          <rect x="16" y="28" width="208" height="22" rx="4" fill="#0A0F1C" stroke="#374151" />
                          <text x="24" y="44" fontSize="10" fill="#00D97E" fontFamily="monospace">+923001234500</text>
                          <text x="16" y="70" fontSize="9" fill="#9CA3AF" fontFamily="monospace">End Number</text>
                          <rect x="16" y="76" width="208" height="22" rx="4" fill="#0A0F1C" stroke="#374151" />
                          <text x="24" y="92" fontSize="10" fill="#00D97E" fontFamily="monospace">+923001234510</text>
                        </svg>
                      </div>

                      <div className="rounded-xl border border-border bg-surface p-5">
                        <h4 className="text-sm font-semibold mb-3">Generated Output</h4>
                        <svg viewBox="0 0 240 120" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="0.5" y="0.5" width="239" height="119" rx="7.5" stroke="#1F2937" fill="#111827" />
                          <text x="16" y="20" fontSize="9" fill="#00D97E" fontFamily="monospace">+923001234500</text>
                          <text x="16" y="36" fontSize="9" fill="#00D97E" fontFamily="monospace">+923001234501</text>
                          <text x="16" y="52" fontSize="9" fill="#00D97E" fontFamily="monospace">+923001234502</text>
                          <text x="16" y="68" fontSize="9" fill="#6B7280" fontFamily="monospace">...</text>
                          <text x="16" y="84" fontSize="9" fill="#00D97E" fontFamily="monospace">+923001234509</text>
                          <text x="16" y="100" fontSize="9" fill="#00D97E" fontFamily="monospace">+923001234510</text>
                          <text x="120" y="102" fontSize="8" fill="#6B7280" fontFamily="monospace">11 numbers generated</text>
                        </svg>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-4">
                      <h4 className="text-sm font-semibold mb-2">How It Works</h4>
                      <ul className="space-y-2 text-sm text-text-secondary">
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-success shrink-0 mt-0.5" />
                          <span>Enter a starting number in full international format (e.g., <code className="font-mono text-xs bg-background px-1 rounded">+923001234500</code>)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-success shrink-0 mt-0.5" />
                          <span>Enter an ending number in the same format</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-success shrink-0 mt-0.5" />
                          <span>Optionally set a step value (default: 1) to skip numbers</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-success shrink-0 mt-0.5" />
                          <span>Click Generate and the tool creates every number in the range</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
