import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { FileText, AlignLeft, Code2, FileDown, MessageCircle, Search, Trash2, Check, Loader2, MapPin, CheckCircle2, XCircle, AlertTriangle, Users, ArrowUpRight } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketProvider';
import { countries } from '../../data/countries';
import { exportFilteredCSV, exportFilteredTXT, exportFilteredJSON, exportFilteredPDF } from '../../utils/exportUtils';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../ui/Dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/AlertDialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip';
import ResultAvatar from '../ResultAvatar';
import { cn } from '../ui/cn';

const CHART_COLORS = ['#00D97E', '#EF4444', '#F59E0B'];

const EXPORT_BTNS = [
  { key: 'csv', label: 'CSV', icon: FileText, color: '#16A34A' },
  { key: 'txt', label: 'TXT', icon: AlignLeft, color: '#2563EB' },
  { key: 'json', label: 'JSON', icon: Code2, color: '#7C3AED' },
  { key: 'pdf', label: 'PDF', icon: FileDown, color: '#DC2626' },
];

const Step5Reports = () => {
  const { resultsList, sessionUser, campaignHistory, finalizedCampaign, sendMessage, deleteCampaign, addLog } = useWebSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showHistory, setShowHistory] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyCountryFilter, setHistoryCountryFilter] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [exportStates, setExportStates] = useState({ csv: 'idle', txt: 'idle', json: 'idle', pdf: 'idle' });
  const tableContainerRef = useRef(null);
  const [transferState, setTransferState] = useState('idle');
  const [transferMsg, setTransferMsg] = useState('');
  const [transferDetail, setTransferDetail] = useState('');

  // ---- Which data set is this report actually about? --------------------------
  // A report must describe what was SAVED, not whatever the live preview stream
  // currently holds. `finalizedCampaign` is the campaign record the backend
  // persisted for the scan that just finished; when its persistence is still in
  // flight (a stub marked `pendingPersist`) the saved record is looked up in
  // campaign history by id. Only if neither exists — i.e. the user opened Reports
  // during a running scan — do we fall back to live results.
  const savedCampaign = useMemo(() => {
    if (!finalizedCampaign) return null;
    // Not a stub: the terminal event/reconcile delivered the persisted campaign.
    if (!finalizedCampaign.pendingPersist) return finalizedCampaign;
    // Stub from the local safety net: the saved record may have landed in history
    // by the time this renders (finalizeScan forces a history refresh).
    const match = (campaignHistory || []).find(c => c?.id === finalizedCampaign.id);
    return match || finalizedCampaign;
  }, [finalizedCampaign, campaignHistory]);

  const reportResults = useMemo(() => {
    if (Array.isArray(savedCampaign?.results) && savedCampaign.results.length > 0) {
      return savedCampaign.results;
    }
    return resultsList;
  }, [savedCampaign, resultsList]);

  const setExportState = (key, state) => {
    setExportStates(prev => ({ ...prev, [key]: state }));
  };

  const handleExport = async (key, fn) => {
    if (exportStates[key] !== 'idle') return;
    setExportState(key, 'loading');
    await new Promise(r => setTimeout(r, 600));
    try {
      await fn();
      setExportState(key, 'done');
    } catch (e) {
      console.error(`Export ${key} failed:`, e);
      setExportState(key, 'idle');
      return;
    }
    await new Promise(r => setTimeout(r, 1200));
    setExportState(key, 'idle');
  };

  const verifiedTransferCount = useMemo(
    () => reportResults.filter(r => r.exists === true && r.isValidFormat !== false).length,
    [reportResults]
  );

  const handleTransferVerified = async () => {
    if (transferState !== 'idle' || verifiedTransferCount === 0) return;
    setTransferState('loading');
    setTransferMsg('');
    setTransferDetail('');
    try {
      let rules = {};
      try {
        const rulesRes = await fetch('/api/message-agent/lead-transfer');
        const rulesData = await rulesRes.json();
        if (rulesData.success && rulesData.rules) rules = rulesData.rules;
      } catch { /* use defaults */ }
      if (rules.enabled === false) {
        setTransferState('done');
        setTransferMsg('Transfer disabled');
        setTransferDetail('Enable it in Message Agent → Settings → Lead Transfer.');
        return;
      }
      const fallbackCampaign = savedCampaign || campaignHistory?.[0] || {};
      const contacts = reportResults
        .filter(r => r.exists === true && r.isValidFormat !== false)
        .map(r => ({
          phone: r.formatted || r.number || r.phone,
          name: r.displayName || r.verifiedName || '',
          country: r.detectedCountry || r.country || fallbackCampaign.countryCode || 'Unknown',
          avatar: r.avatar || null,
          about: r.about || '',
          exists: true,
          isVerified: true,
          isBusiness: r.isBusiness || false,
          isValidFormat: true,
          campaignId: r.campaignId || fallbackCampaign.id || null,
          campaignDate: r.campaignDate || fallbackCampaign.timestamp || null,
          validationDate: new Date().toISOString(),
        }));
      const res = await fetch('/api/message-agent/import-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts,
          mode: 'manual',
          metadata: {
            source: 'whatsapp_shield',
            campaignId: fallbackCampaign.id || null,
            campaignDate: fallbackCampaign.timestamp || null,
            tags: [...(rules.addTags || []), 'shield_verified'],
            validated: true,
            defaultJourney: rules.defaultJourney || 'new_lead',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransferState('done');
        setTransferMsg(`${data.added} lead${data.added === 1 ? '' : 's'} transferred`);
        setTransferDetail(data.skipped > 0 ? `${data.skipped} already in CRM and skipped` : 'Now in your CRM pipeline');
      } else {
        setTransferState('idle');
        window.dispatchEvent(new CustomEvent('ws-toast', {
          detail: { message: data.error || 'Transfer failed', type: 'error' }
        }));
      }
    } catch {
      setTransferState('idle');
      window.dispatchEvent(new CustomEvent('ws-toast', {
        detail: { message: 'Transfer failed. Check connection and try again.', type: 'error' }
      }));
    }
  };

  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [reportResults.length]);

  const loadCampaignHistory = () => {
    const phone = sessionUser?.number?.replace(/\D/g, '');
    if (phone) {
      sendMessage({ type: 'get_history', phone });
    }
  };

  const handleDeleteCampaign = async (id) => {
    const phone = sessionUser?.number?.replace(/\D/g, '');
    try {
      const res = await deleteCampaign(id, phone);
      if (!res?.success) {
        console.error('Delete campaign failed:', res?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Delete campaign failed:', err?.message || err);
    }
    setDeleteConfirm(null);
  };

  const filteredHistory = useMemo(() => {
    let list = [...campaignHistory];
    if (historyDateFilter) {
      list = list.filter(c => c.timestamp.startsWith(historyDateFilter));
    }
    if (historyCountryFilter !== 'all') {
      list = list.filter(c => c.countryCode === historyCountryFilter);
    }
    return list;
  }, [campaignHistory, historyDateFilter, historyCountryFilter]);

  const uniqueCountries = useMemo(() => {
    return [...new Set(campaignHistory.map(c => c.countryCode))].sort();
  }, [campaignHistory]);

  const stats = useMemo(() => {
    const total = reportResults.length;
    const registered = reportResults.filter(r => r.exists === true).length;
    const unregistered = reportResults.filter(r => r.exists === false && r.isValidFormat).length;
    const invalid = reportResults.filter(r => !r.isValidFormat).length;
    const hitRate = total > 0 ? ((registered / total) * 100).toFixed(1) : '0.0';
    return { total, registered, unregistered, invalid, hitRate };
  }, [reportResults]);

  const [chartData, setChartData] = useState([]);
  useEffect(() => {
    const data = [
      { name: 'Registered', value: reportResults.filter(r => r.exists === true).length },
      { name: 'Not Registered', value: reportResults.filter(r => !r.exists && r.isValidFormat).length },
      { name: 'Invalid', value: reportResults.filter(r => !r.isValidFormat).length }
    ].filter(d => d.value > 0);
    setChartData(data);
  }, [reportResults]);

  const filteredResults = useMemo(() => {
    return reportResults.filter(result => {
      const matchesSearch = result.formatted?.includes(searchTerm) ||
                            result.number?.includes(searchTerm) ||
                            (result.displayName && result.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
      let matchesStatus = true;
      if (statusFilter === 'registered') matchesStatus = result.exists === true;
      if (statusFilter === 'unregistered') matchesStatus = result.exists === false && result.isValidFormat;
      if (statusFilter === 'invalid') matchesStatus = !result.isValidFormat;
      return matchesSearch && matchesStatus;
    });
  }, [reportResults, searchTerm, statusFilter]);

  const filterLabel = useMemo(() => {
    const parts = [];
    if (statusFilter === 'registered') parts.push('Registered');
    else if (statusFilter === 'unregistered') parts.push('Not Registered');
    else if (statusFilter === 'invalid') parts.push('Invalid');
    else parts.push('All Results');
    if (searchTerm) parts.push(`matching "${searchTerm}"`);
    return parts.join(' ');
  }, [statusFilter, searchTerm]);

  const detectedCountry = useMemo(() => {
    const counts = {};
    reportResults.forEach(r => {
      if (r.detectedCountry) counts[r.detectedCountry] = (counts[r.detectedCountry] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.length > 0 ? entries[0][0] : 'Unknown';
  }, [reportResults]);

  const scope = useMemo(() => {
    // The saved campaign for THIS report is the authoritative source of scan
    // metadata; history's newest entry is only a fallback (it can belong to a
    // different campaign if the user ran another scan in another tab).
    const src = savedCampaign || (campaignHistory && campaignHistory[0]) || {};
    const fromCampaign = {
      regionName: src.regionName || null,
      regionPrefix: src.regionPrefix || null,
      audienceType: src.audienceType || null,
      jitterPct: src.jitterPct,
      shieldMode: src.shieldMode,
      delayMs: src.delayMs,
      countryIso: src.countryIso || null,
      countryName: src.countryName || null,
    };
    const liveRegion = window.whatsappShieldRegion || {};
    return {
      regionName: fromCampaign.regionName || liveRegion.name || null,
      regionPrefix: fromCampaign.regionPrefix || liveRegion.prefix || null,
      audienceType: fromCampaign.audienceType || window.whatsappShieldAudienceType || null,
      jitterPct: typeof fromCampaign.jitterPct === 'number'
        ? fromCampaign.jitterPct
        : (window.whatsappShieldSettings && window.whatsappShieldSettings.jitter) ?? null,
      shieldMode: fromCampaign.shieldMode,
      delayMs: fromCampaign.delayMs,
      countryIso: fromCampaign.countryIso,
      countryName: fromCampaign.countryName,
    };
  }, [savedCampaign, campaignHistory]);

  const liveScanCampaign = useMemo(() => ({
    // Identity comes from the saved campaign so exports and the PDF header match
    // the record in History rather than a synthetic "current-scan" placeholder.
    id: savedCampaign?.id || 'current-scan',
    timestamp: savedCampaign?.timestamp || new Date().toISOString(),
    status: savedCampaign?.status,
    countryCode: detectedCountry || savedCampaign?.countryCode,
    countryIso: scope.countryIso || null,
    countryName: scope.countryName || null,
    regionName: scope.regionName,
    regionPrefix: scope.regionPrefix,
    audienceType: scope.audienceType || 'manual',
    jitterPct: scope.jitterPct,
    shieldMode: scope.shieldMode !== false,
    delayMs: scope.delayMs ?? 0,
    totalChecked: stats.total,
    registeredCount: stats.registered,
    unregisteredCount: stats.unregistered,
    invalidCount: stats.invalid,
    results: reportResults,
  }), [reportResults, stats, detectedCountry, scope, savedCampaign]);

  const openWhatsApp = (number) => {
    const cleanNumber = number.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanNumber}`, '_blank');
  };

  const exportHandlers = {
    csv: () => exportFilteredCSV(filteredResults, liveScanCampaign, filterLabel),
    txt: () => exportFilteredTXT(filteredResults, liveScanCampaign, filterLabel),
    json: () => exportFilteredJSON(filteredResults, liveScanCampaign, filterLabel),
    pdf: () => exportFilteredPDF(filteredResults, liveScanCampaign, sessionUser, filterLabel),
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 w-full space-y-4">
        
        {/* Top Header & Filters */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-semibold text-text-primary">Audit Reports</h2>
              <p className="text-xs text-text-secondary">Export verified leads and review full validation logs.</p>
            </div>

            {(scope.countryName || scope.regionName) && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
                <MapPin size={12} className="text-primary shrink-0" />
                <span className="truncate max-w-[16rem]">
                  {[scope.countryName, scope.regionName].filter(Boolean).join(' · ')}
                  {scope.regionPrefix ? ` (+${scope.regionPrefix})` : ''}
                </span>
              </span>
            )}

            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 rounded-xl ml-1" onClick={() => { loadCampaignHistory(); setShowHistory(true); }}>
                  <FileText size={13} /> Past History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Campaign History</DialogTitle>
                  <DialogDescription>Past validation campaigns sorted by date.</DialogDescription>
                </DialogHeader>
                <div className="flex gap-2.5 py-2 flex-wrap">
                  <input
                    type="date"
                    value={historyDateFilter}
                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                    className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-mono"
                  />
                  <select
                    value={historyCountryFilter}
                    onChange={(e) => setHistoryCountryFilter(e.target.value)}
                    className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-mono"
                  >
                    <option value="all">All Countries</option>
                    {uniqueCountries.map(cc => (<option key={cc} value={cc}>+{cc}</option>))}
                  </select>
                </div>
                <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                  {filteredHistory.length === 0 && (<p className="text-center text-text-muted py-8 text-sm">No campaigns found.</p>)}
                  {filteredHistory.map((camp) => (
                    <div
                      key={camp.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedCampaign(selectedCampaign?.id === camp.id ? null : camp)}
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-xs text-text-muted font-mono">{new Date(camp.timestamp).toLocaleString()}</span>
                        <span className="text-sm font-semibold">{camp.totalChecked} numbers · {camp.registeredCount} active leads</span>
                        <span className="text-xs text-text-secondary flex items-center gap-1.5 flex-wrap">
                          <span>Country: {camp.countryName || ('+' + camp.countryCode)}</span>
                          {camp.regionName && <span>· Region: {camp.regionName}</span>}
                          <span>· Shield: {camp.shieldMode ? 'ON' : 'OFF'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedCampaign?.id === camp.id && <Badge variant="success">Viewing</Badge>}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(camp.id); }}
                          className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-error/80 transition-colors"
                          title="Delete this campaign"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                        <AlertDesc>This action cannot be undone. The campaign will be permanently removed.</AlertDesc>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl" onClick={() => setDeleteConfirm(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCampaign(deleteConfirm)} className="bg-error hover:bg-error/90 rounded-xl">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <Input
                placeholder="Search phone or name..."
                className="pl-8 py-1.5 text-xs h-9 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="unregistered">Not Registered</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ---------------- KPI Stat Cards ---------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="rounded-xl border-border bg-surface shadow-2xs">
            <CardContent className="p-3.5">
              <span className="text-[11px] uppercase font-semibold text-text-muted tracking-wider">Total Numbers</span>
              <div className="text-xl font-bold font-mono text-text-primary mt-1 tabular-nums">{stats.total.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-success/30 bg-success/[0.04] shadow-2xs">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-semibold text-success tracking-wider">Active Leads</span>
                <CheckCircle2 size={13} className="text-success" />
              </div>
              <div className="text-xl font-bold font-mono text-success mt-1 tabular-nums">{stats.registered.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-surface shadow-2xs">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-semibold text-text-muted tracking-wider">Not Registered</span>
                <XCircle size={13} className="text-error/70" />
              </div>
              <div className="text-xl font-bold font-mono text-error/80 mt-1 tabular-nums">{stats.unregistered.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-surface shadow-2xs">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-semibold text-text-muted tracking-wider">Hit Rate</span>
                <Users size={13} className="text-primary" />
              </div>
              <div className="text-xl font-bold font-mono text-primary mt-1 tabular-nums">{stats.hitRate}%</div>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- Main Content Layout: Sidebar + Results Table ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow min-h-0">
          
          {/* Left Column: Donut Breakdown + Exports + Lead Transfer (4 cols) */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3.5">
            {/* Donut Chart Card */}
            <Card className="rounded-2xl border-border shadow-2xs">
              <CardHeader className="pb-1 px-4 py-3 border-b border-border/70">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-text-muted">Outcome Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col items-center">
                <div className="h-28 w-full mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={3} dataKey="value" stroke="none">
                        {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-1 text-xs">
                  <div className="flex justify-between items-center px-2.5 py-1 bg-background/60 rounded-lg border border-border/40">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#00D97E]" /> Registered</span>
                    <span className="font-bold font-mono">{stats.registered}</span>
                  </div>
                  <div className="flex justify-between items-center px-2.5 py-1 bg-background/60 rounded-lg border border-border/40">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#EF4444]" /> Not Registered</span>
                    <span className="font-bold font-mono">{stats.unregistered}</span>
                  </div>
                  {stats.invalid > 0 && (
                    <div className="flex justify-between items-center px-2.5 py-1 bg-background/60 rounded-lg border border-border/40">
                      <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Invalid</span>
                      <span className="font-bold font-mono">{stats.invalid}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Export Buttons */}
            <Card className="rounded-2xl border-border p-3.5 shadow-2xs space-y-2">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Export Filtered Data</span>
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_BTNS.map(btn => {
                  const Icon = btn.icon;
                  const state = exportStates[btn.key];
                  return (
                    <button
                      key={btn.key}
                      onClick={() => handleExport(btn.key, exportHandlers[btn.key])}
                      disabled={state !== 'idle'}
                      className={cn(
                        "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border",
                        state === 'done' ? 'bg-success/15 border-success/30 text-success' :
                        state === 'loading' ? 'opacity-75 cursor-not-allowed bg-surface border-border' :
                        'border-border bg-surface hover:border-primary/40 hover:bg-primary/[0.04] text-text-primary'
                      )}
                    >
                      {state === 'loading' ? (
                        <Loader2 size={13} className="animate-spin shrink-0" />
                      ) : state === 'done' ? (
                        <Check size={13} className="shrink-0 text-success" />
                      ) : (
                        <Icon size={13} className="shrink-0" style={{ color: btn.color }} />
                      )}
                      <span>{state === 'loading' ? '...' : state === 'done' ? 'Saved' : btn.label}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Verified Lead Transfer to Message Agent */}
            <Card className="rounded-2xl border-primary/25 bg-primary/[0.04] p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-text-primary flex items-center gap-1.5">
                  <MessageCircle size={14} className="text-primary" /> Send to Message Agent
                </span>
                <span className="text-xs font-mono font-bold text-primary">{verifiedTransferCount}</span>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Transfer verified leads straight into your conversation CRM pipeline.
              </p>
              <Button
                size="sm"
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold h-9 shadow-xs"
                disabled={transferState !== 'idle' || verifiedTransferCount === 0}
                onClick={handleTransferVerified}
              >
                {transferState === 'loading' ? (
                  <><Loader2 size={13} className="animate-spin mr-1.5" /> Transferring...</>
                ) : transferState === 'done' ? (
                  <><Check size={13} className="mr-1.5" /> {transferMsg || 'Transferred'}</>
                ) : (
                  <><MessageCircle size={13} className="mr-1.5" /> Transfer {verifiedTransferCount} Leads</>
                )}
              </Button>
            </Card>
          </div>

          {/* Right Column: Full Verified Results Table (8 cols on lg, 9 on xl) */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 bg-surface rounded-2xl border border-border shadow-2xs overflow-hidden h-[460px] lg:h-[clamp(440px,calc(100dvh-320px),620px)]">
            <div className="px-4 py-2.5 border-b border-border bg-background/50 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-text-primary">
                Showing {filteredResults.length} of {reportResults.length} numbers
              </span>
              {filterLabel !== 'All Results' && (
                <span className="text-[11px] text-primary font-medium">{filterLabel}</span>
              )}
            </div>

            <div ref={tableContainerRef} className="flex-1 overflow-y-auto min-h-0">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-surface/95 backdrop-blur-xs border-b border-border">
                  <TableRow>
                    <TableHead className="w-[48px] text-[11px]">Avatar</TableHead>
                    <TableHead className="text-[11px]">Phone Number</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                    <TableHead className="hidden md:table-cell text-[11px]">Type</TableHead>
                    <TableHead className="hidden sm:table-cell text-[11px]">Name</TableHead>
                    <TableHead className="text-right text-[11px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length > 0 ? (
                    filteredResults.map((result, idx) => (
                      <TableRow key={result.cleanNumber || result.number || idx} className="hover:bg-primary/[0.02] transition-colors">
                        <TableCell className="py-2">
                          <ResultAvatar result={result} size={32} />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-text-primary py-2">
                          {result.formatted || result.number}
                        </TableCell>
                        <TableCell className="py-2">
                          {result.exists ? (
                            <Badge variant="success" className="text-[10px] px-2 py-0.5 rounded-full font-semibold">Registered</Badge>
                          ) : result.isValidFormat ? (
                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full font-semibold">Not Registered</Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px] px-2 py-0.5 rounded-full font-semibold">Invalid</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-2">
                          {result.exists ? (
                            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", result.isBusiness ? "bg-primary/10 text-primary border-primary/25" : "bg-background text-text-muted border-border")}>
                              {result.isBusiness ? 'Business' : 'Personal'}
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-text-secondary truncate max-w-[150px] text-xs font-medium py-2">
                          {result.displayName || result.verifiedName || '—'}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!result.exists}
                              onClick={() => openWhatsApp(result.formatted || result.number)}
                              className="text-text-secondary hover:text-primary hover:bg-primary/10 w-7 h-7 rounded-lg"
                              title="Message on WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                const event = new CustomEvent('openMessageAgent', {
                                  detail: {
                                    phone: result.formatted || result.number,
                                    contact: {
                                      name: result.displayName || `+${String(result.formatted || result.number).replace(/\D/g, '')}`,
                                      phone: result.formatted || result.number,
                                      exists: result.exists,
                                      avatar: result.avatar,
                                      country: result.detectedCountry || 'Unknown',
                                      accountType: result.isBusiness ? 'Business' : (result.exists ? 'Personal' : 'N/A'),
                                      displayName: result.displayName || ''
                                    }
                                  }
                                });
                                window.dispatchEvent(event);
                              }} 
                              className="text-text-secondary hover:text-[#25D366] hover:bg-[#25D366]/10 w-7 h-7 rounded-lg" 
                              title="Open in Message Agent"
                            >
                              <ArrowUpRight size={14} className="text-primary" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-text-muted text-xs">
                        No numbers found matching your filter criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
};

export default Step5Reports;
