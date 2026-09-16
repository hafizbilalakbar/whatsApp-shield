import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  CalendarDays, Shield, Clock, FileText, Search, Filter, 
  Download, FileDown, MessageCircle, TrendingUp, Award, 
  AlertCircle, Database, Trash2, Smartphone, ChevronDown, ChevronLeft, ChevronRight, X,
  Check, Loader2, AlignLeft, Code2, Eye, History, Layers, MapPin, Camera
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketProvider';
import { showToast } from '../components/ui/ToastNotification';
import { getCountryName, getCountryFlag, exportFilteredCSV, exportFilteredTXT, exportFilteredJSON, exportFilteredPDF, exportAllHistoryCSV, exportAllHistoryJSON, exportAllHistoryTXT, exportAllHistoryPDF } from '../utils/exportUtils';
import { countries } from '../data/countries';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../components/ui/Tooltip';
import { SkeletonCard, SkeletonStatCard } from '../components/ui/SkeletonCard';
import { SkeletonTable } from '../components/ui/SkeletonTable';
import ResultAvatar from '../components/ResultAvatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/AlertDialog';
import { cn } from '../components/ui/cn';

const EXPORT_BTN_CONFIG = [
  { key: 'csv', label: 'CSV', icon: FileText, tooltip: 'Spreadsheet with headers' },
  { key: 'txt', label: 'TXT', icon: AlignLeft, tooltip: 'Formatted text report' },
  { key: 'json', label: 'JSON', icon: Code2, tooltip: 'Structured data export' },
  { key: 'pdf', label: 'PDF', icon: FileDown, tooltip: 'Professional PDF report' },
];

const ALL_EXPORT_CONFIG = [
  { key: 'csv', label: 'All History (CSV)', icon: FileText },
  { key: 'txt', label: 'All History (TXT)', icon: AlignLeft },
  { key: 'json', label: 'All History (JSON)', icon: Code2 },
  { key: 'pdf', label: 'All History (PDF)', icon: FileDown },
];

// Bounded rows per page so large campaigns stay smooth while filtering/paging.
const RESULTS_PER_PAGE = 50;

// Resolve a campaign's Country Scope to a display name, flag and dial code.
// Prefers the actual country the user selected (countryIso/countryName, stored
// per campaign) and only falls back to the shared calling-code default (e.g.
// +1 → United States) for legacy campaigns that predate scope capture.
const campaignCountry = (camp) => {
  const iso = camp.countryIso;
  const code = camp.countryCode;
  // When the campaign's detected country (iso) is known, its real dial code
  // comes from that country's record — never from a stale/legacy "+1" field.
  const resolved = iso ? countries.find(c => c.iso.toLowerCase() === String(iso).toLowerCase()) : null;
  const name = camp.countryName || (resolved ? resolved.name : getCountryName(iso || code || ''));
  const dial = resolved?.code || (code && code !== 'Unknown' ? code : '');
  return {
    name,
    flag: getCountryFlag(iso || code || ''),
    code: dial ? `+${dial}` : '',
  };
};

// Clean, human-friendly campaign label. Campaign names are date-free now, but
// legacy runs stored ` · Aug 19, 2026, 8:03 AM · #refId` inside the name. Date,
// time and ref are rendered as their own separate metadata fields, so strip them
// out of the title and keep only the meaningful audience label.
const campaignLabel = (camp) => {
  if (!camp) return 'Campaign';
  if (camp.name) {
    const cleaned = camp.name
      .replace(/\s*·\s*#[A-Za-z0-9_-]+$/i, '')
      .replace(/\s*·\s*[A-Za-z]{3,9}\s+\d{1,2}\s*,?\s+\d{4}.+$/i, '')
      .replace(/\s*[,·]\s*$/, '')
      .trim();
    if (cleaned) return cleaned;
  }
  const cc = campaignCountry(camp);
  return `${cc.name && cc.name !== 'Unknown' ? cc.name : 'Audience'} Scan`;
};

// True when a result's profile picture was successfully captured (recorded URL
// or explicit availability flag from the authorized WhatsApp session).
const resultHasPhoto = (result) =>
  !!result && (result.profilePhotoAvailable === true || !!result.avatar);

const campaignStatus = (camp) => {
  const s = camp?.status;
  if (s === 'STOPPED') return { label: 'Stopped', variant: 'warning' };
  if (s === 'RUNNING') return { label: 'In Progress', variant: 'warning' };
  return { label: 'Completed', variant: 'success' };
};

// Human-friendly age since the campaign ran, e.g. "3h 12m ago", "2 days ago".
const formatAge = (ts) => {
  const start = new Date(ts).getTime();
  if (!start || isNaN(start)) return '—';
  const diffMs = Date.now() - start;
  if (diffMs < 0) return '—';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
};

// Compact labelled stat used in the campaign detail panel.
const DetailStat = ({ label, icon, children }) => (
  <div className="p-2.5 bg-background border border-border/60 rounded-lg min-w-0">
    <span className="flex items-center gap-1.5 text-[9px] text-text-muted font-bold uppercase tracking-wider">
      {icon}
      <span className="truncate">{label}</span>
    </span>
    <div className="text-[11.5px] font-semibold text-text-primary mt-1 flex items-center gap-1.5 leading-snug break-words">
      {children}
    </div>
  </div>
);

export default function CampaignHistoryPage() {
  const { isAuthenticated, sessionUser, deleteCampaign } = useWebSocket();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStates, setExportStates] = useState({ csv: 'idle', txt: 'idle', json: 'idle', pdf: 'idle' });
  const [allExportStates, setAllExportStates] = useState({ csv: 'idle', txt: 'idle', json: 'idle', pdf: 'idle' });
  const [syncRefreshing, setSyncRefreshing] = useState(false);
  const [resultsPage, setResultsPage] = useState(1);
  const fetchSeqRef = useRef(0);

  const connectedPhone = sessionUser?.number?.replace(/\D/g, '') || '';

  // Debounce the search box so filtering large result sets stays fluid.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset pagination whenever the visible result set changes.
  useEffect(() => {
    setResultsPage(1);
  }, [selectedCampaign?.id, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (isAuthenticated && connectedPhone) {
      fetchCampaigns(false);
    } else {
      setLoading(false);
      setCampaigns([]);
    }
  }, [isAuthenticated, connectedPhone]);

  const fetchCampaigns = useCallback(async (silent = false) => {
    const seq = ++fetchSeqRef.current;
    if (silent) {
      setSyncRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`/api/campaigns?phone=${connectedPhone}`);
      const data = await res.json();
      // Ignore stale responses if a newer fetch started meanwhile.
      if (seq !== fetchSeqRef.current) return;
      if (data.success) {
        setCampaigns(data.campaigns);
        if (data.campaigns.length > 0 && !selectedCampaign) {
          setSelectedCampaign(data.campaigns[0]);
        }
      } else {
        setError('Failed to fetch campaign history.');
      }
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError('Error connecting to backend server.');
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setSyncRefreshing(false);
      }
    }
  }, [connectedPhone, selectedCampaign]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const d = new Date(c.timestamp);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      if (countryFilter !== 'all') {
        const hasCountry = c.countryBreakdown && c.countryBreakdown[countryFilter];
        if (!hasCountry) return false;
      }
      return true;
    });
  }, [campaigns, dateFrom, dateTo, countryFilter]);

  const filteredResults = useMemo(() => {
    if (!selectedCampaign || !selectedCampaign.results) return [];
    const term = debouncedSearch.trim().toLowerCase();
    return selectedCampaign.results.filter(result => {
      const numString = result.formatted || result.number || '';
      const matchesSearch = !term ||
                            numString.toLowerCase().includes(term) ||
                            (result.displayName && result.displayName.toLowerCase().includes(term));
      let matchesStatus = true;
      if (statusFilter === 'registered') matchesStatus = result.exists === true;
      if (statusFilter === 'unregistered') matchesStatus = result.exists === false && result.isValidFormat;
      if (statusFilter === 'invalid') matchesStatus = !result.isValidFormat;
      if (statusFilter === 'business') matchesStatus = result.isBusiness === true;
      if (statusFilter === 'avatar') matchesStatus = result.exists === true && resultHasPhoto(result);
      return matchesSearch && matchesStatus;
    });
  }, [selectedCampaign, debouncedSearch, statusFilter]);

  const paginatedResults = useMemo(() => {
    const page = Math.min(resultsPage, Math.max(1, Math.ceil(filteredResults.length / RESULTS_PER_PAGE)));
    const start = (page - 1) * RESULTS_PER_PAGE;
    return filteredResults.slice(start, start + RESULTS_PER_PAGE);
  }, [filteredResults, resultsPage]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredResults.length / RESULTS_PER_PAGE)), [filteredResults.length]);

  const availableCountries = useMemo(() => {
    const countrySet = new Set();
    campaigns.forEach(c => {
      if (c.countryBreakdown) {
        Object.keys(c.countryBreakdown).forEach(cc => countrySet.add(cc));
      }
    });
    return Array.from(countrySet).sort();
  }, [campaigns]);

  const aggregatedStats = useMemo(() => {
    if (filteredCampaigns.length === 0) return { total: 0, registered: 0, unregistered: 0, invalid: 0, avgSuccess: 0 };
    const total = filteredCampaigns.reduce((acc, c) => acc + (c.totalChecked || 0), 0);
    const registered = filteredCampaigns.reduce((acc, c) => acc + (c.registeredCount || 0), 0);
    const unregistered = filteredCampaigns.reduce((acc, c) => acc + (c.unregisteredCount || 0), 0);
    const invalid = filteredCampaigns.reduce((acc, c) => acc + (c.invalidCount || 0), 0);
    const avgSuccess = total > 0 ? Math.round((registered / total) * 100) : 0;
    return { total, registered, unregistered, invalid, avgSuccess };
  }, [filteredCampaigns]);

  const filterLabel = useMemo(() => {
    const parts = [];
    if (statusFilter === 'registered') parts.push('Registered');
    else if (statusFilter === 'unregistered') parts.push('Not Registered');
    else if (statusFilter === 'invalid') parts.push('Invalid');
    else if (statusFilter === 'business') parts.push('Business Accounts');
    else if (statusFilter === 'avatar') parts.push('Profile Picture Available');
    else parts.push('All Results');
    if (debouncedSearch.trim()) parts.push(`matching "${debouncedSearch.trim()}"`);
    return parts.join(' ');
  }, [statusFilter, debouncedSearch]);

  const selCountry = selectedCampaign ? campaignCountry(selectedCampaign) : null;

  const handleDelete = useCallback((campaignId) => {
    // Optimistic + async: remove the campaign immediately so the UI never
    // freezes waiting on the backend round-trip, then sync with the
    // authoritative list (or restore the row on failure).
    const target = campaigns.find(c => c.id === campaignId) || null;
    setDeleteConfirm(null);
    setDeletingId(campaignId);
    setCampaigns(prev => prev.some(c => c.id === campaignId) ? prev.filter(c => c.id !== campaignId) : prev);
    if (selectedCampaign?.id === campaignId) setSelectedCampaign(null);
    deleteCampaign(campaignId, connectedPhone)
      .then((res) => {
        if (res?.success) {
          // Use the backend's authoritative campaign list so the UI is never out
          // of sync with disk (the backend may keep campaigns it cannot verify
          // ownership of, e.g. a conversation whose owner field is missing).
          if (Array.isArray(res.campaigns)) setCampaigns(res.campaigns);
          showToast('Campaign deleted.', 'success');
          return;
        }
        if (target) {
          setCampaigns(prev => prev.some(c => c.id === campaignId) ? prev : [target, ...prev]);
          if (selectedCampaign?.id === campaignId) setSelectedCampaign(target);
        }
        showToast(res?.error || 'Failed to delete campaign. Please try again.', 'error');
      })
      .catch((err) => {
        if (target) {
          setCampaigns(prev => prev.some(c => c.id === campaignId) ? prev : [target, ...prev]);
          if (selectedCampaign?.id === campaignId) setSelectedCampaign(target);
        }
        showToast(err?.message || 'Failed to delete campaign. Please try again.', 'error');
      })
      .finally(() => setDeletingId(null));
  }, [campaigns, connectedPhone, deleteCampaign, selectedCampaign]);

  const openWhatsApp = (number) => {
    const cleanNumber = number.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanNumber}`, '_blank');
  };

  const handleExport = async (key, fn, states, setStates) => {
    if (states[key] !== 'idle') return;
    setStates(prev => ({ ...prev, [key]: 'loading' }));
    try {
      await fn();
      setStates(prev => ({ ...prev, [key]: 'done' }));
    } catch {
      setStates(prev => ({ ...prev, [key]: 'idle' }));
      return;
    }
    // Brief success confirmation, then reset so the button is ready again.
    await new Promise(r => setTimeout(r, 1000));
    setStates(prev => ({ ...prev, [key]: 'idle' }));
  };

  // Export a single campaign's records. Used by the detail panel only — the
  // sidebar cards intentionally keep export actions in the central report area.
  const getExportIcon = (key, state) => {
    const cfg = EXPORT_BTN_CONFIG.find(b => b.key === key);
    if (!cfg) return null;
    const Icon = cfg.icon;
    if (state === 'loading') return <Loader2 size={12} className="animate-spin shrink-0" />;
    if (state === 'done') return <Check size={12} className="shrink-0 text-success" />;
    return <Icon size={12} className="shrink-0" />;
  };

  const getAllExportIcon = (key, state) => {
    const cfg = ALL_EXPORT_CONFIG.find(b => b.key === key);
    if (!cfg) return null;
    const Icon = cfg.icon;
    if (state === 'loading') return <Loader2 size={13} className="animate-spin shrink-0" />;
    if (state === 'done') return <Check size={13} className="shrink-0 text-success" />;
    return <Icon size={13} className="shrink-0" />;
  };

  const exportHandlers = useMemo(() => ({
    csv: () => exportFilteredCSV(filteredResults, selectedCampaign, filterLabel),
    txt: () => exportFilteredTXT(filteredResults, selectedCampaign, filterLabel),
    json: () => exportFilteredJSON(filteredResults, selectedCampaign, filterLabel),
    pdf: () => exportFilteredPDF(filteredResults, selectedCampaign, sessionUser, filterLabel),
  }), [filteredResults, selectedCampaign, filterLabel, sessionUser]);

  const allExportHandlers = useMemo(() => ({
    csv: () => exportAllHistoryCSV(campaigns, connectedPhone),
    txt: () => exportAllHistoryTXT(campaigns, connectedPhone),
    json: () => exportAllHistoryJSON(campaigns, connectedPhone),
    pdf: () => exportAllHistoryPDF(campaigns, connectedPhone, sessionUser),
  }), [campaigns, connectedPhone, sessionUser]);

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-8 mt-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center mb-6">
            <Smartphone size={36} className="text-text-muted" />
          </div>
          <h2 className="text-2xl font-display font-bold text-text-primary mb-2">Connect Your Account</h2>
          <p className="text-text-secondary text-sm max-w-md">Connect your WhatsApp account to view your history.</p>
          <Button className="mt-6" onClick={() => window.location.href = '/dashboard'}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      {/* Full-width layout: same side padding as the app header, no width cap, so
          the History page uses the available screen width (including smaller
          laptops) instead of collapsing into a narrow centered column. */}
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-5 pb-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-6">
          <div className="flex items-start gap-3 min-w-0">
            <div className="hidden sm:flex w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center text-primary shrink-0">
              <History size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-bold">Campaign History</h1>
              <p className="text-text-secondary mt-1 text-sm">
                Access verification reports, download compliance documents, and review audience analytics.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={() => fetchCampaigns(true)} variant="outline" size="sm" className="h-8 gap-1.5 text-xs" loading={syncRefreshing} disabled={loading}>
              <Download size={13} /> Sync
            </Button>
            {campaigns.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  <FileDown size={13} /> Export All <ChevronDown size={11} />
                </Button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl py-1 min-w-[200px]">
                      <div className="px-3 py-1.5 border-b border-border">
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Export Entire History</p>
                      </div>
                      {ALL_EXPORT_CONFIG.map(cfg => {
                        const Icon = cfg.icon;
                        const st = allExportStates[cfg.key];
                        return (
                          <button
                            key={cfg.key}
                            onClick={() => { handleExport(cfg.key, allExportHandlers[cfg.key], allExportStates, setAllExportStates); }}
                            disabled={st === 'loading'}
                            className={cn(
                              "w-full text-left px-3 py-2 text-sm hover:bg-background transition-colors flex items-center gap-2.5",
                              st === 'done' && "bg-success/5"
                            )}
                          >
                            {getAllExportIcon(cfg.key, st)}
                            <span className="text-text-primary">{cfg.label}</span>
                            {st === 'done' && <span className="text-[10px] text-success ml-auto">Saved</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading campaign history">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(i => <SkeletonStatCard key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1 flex flex-col gap-2">
                {[0, 1, 2].map(i => <SkeletonCard key={i} icon={false} lines={3} className="h-[112px]" />)}
              </div>
              <div className="lg:col-span-2">
                <SkeletonTable rows={6} cols={6} />
              </div>
            </div>
          </div>
        ) : error ? (
          <Card className="border-error/20 bg-error/5">
            <CardContent className="pt-6 flex flex-col items-center justify-center text-center p-8">
              <AlertCircle className="text-error h-12 w-12 mb-3" />
              <h3 className="font-semibold text-lg text-text-primary">Failed to load history</h3>
              <p className="text-text-secondary text-sm max-w-md mt-1">{error}</p>
              <Button className="mt-4" onClick={() => fetchCampaigns(false)}>Try Again</Button>
            </CardContent>
          </Card>
        ) : filteredCampaigns.length === 0 ? (
          <Card className="border-border bg-surface/50">
            <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Database className="text-primary h-7 w-7" />
              </div>
              <h3 className="font-display font-semibold text-xl">No Campaigns Found</h3>
              <p className="text-text-secondary text-sm max-w-md mt-2">
                {campaigns.length > 0 ? 'No campaigns match your filter criteria.' : "You haven't run any validation processes yet. Link your WhatsApp session and run an audience scan to record telemetry logs."}
              </p>
              {campaigns.length > 0 && (
                <Button variant="ghost" size="sm" className="gap-1.5 mt-4 text-xs" onClick={() => { setDateFrom(''); setDateTo(''); setCountryFilter('all'); }}>
                  <X size={12} /> Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="relative overflow-hidden border-border/80 shadow-sm">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 to-primary/20" aria-hidden="true" />
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Total Validations</p>
                      <h3 className="text-xl sm:text-2xl font-bold mt-1 font-mono">{aggregatedStats.total.toLocaleString()}</h3>
                    </div>
                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">Across {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-border/80 shadow-sm">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-success/70 to-success/20" aria-hidden="true" />
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">WA Registered</p>
                      <h3 className="text-xl sm:text-2xl font-bold text-success mt-1 font-mono">{aggregatedStats.registered.toLocaleString()}</h3>
                    </div>
                    <div className="p-1.5 bg-success/10 rounded-lg text-success">
                      <Award size={16} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">Active messaging audience</p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-border/80 shadow-sm">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-error/70 to-error/20" aria-hidden="true" />
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Not Registered</p>
                      <h3 className="text-xl sm:text-2xl font-bold text-error mt-1 font-mono">{aggregatedStats.unregistered.toLocaleString()}</h3>
                    </div>
                    <div className="p-1.5 bg-error/10 rounded-lg text-error">
                      <AlertCircle size={16} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">Non-WhatsApp / inactive</p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-border/80 shadow-sm">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 to-secondary/20" aria-hidden="true" />
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Average Yield</p>
                      <h3 className="text-xl sm:text-2xl font-bold mt-1 text-primary font-mono">{aggregatedStats.avgSuccess}%</h3>
                    </div>
                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                      <Shield size={16} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">Success rate average</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5 bg-surface border border-border rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 pr-1 mb-0.5">
                <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Filter size={13} />
                </span>
                <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-text-muted">Filters</span>
              </div>
              <div className="flex items-end gap-1.5 bg-background/60 border border-border/70 rounded-lg px-2 py-1.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">From</label>
                  <div className="relative">
                    <CalendarDays size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36 sm:w-40 text-xs pl-7 bg-transparent border-border/70" />
                  </div>
                </div>
                <span className="text-text-muted text-xs pb-2 px-0.5" aria-hidden="true">–</span>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">To</label>
                  <div className="relative">
                    <CalendarDays size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36 sm:w-40 text-xs pl-7 bg-transparent border-border/70" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider px-1">Country</label>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="h-8 w-44 sm:w-52 text-xs bg-background/60 border-border/70">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {availableCountries.map(cc => (
                      <SelectItem key={cc} value={cc}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-sm leading-none">{getCountryFlag(cc)}</span>
                          <span>{getCountryName(cc)}</span>
                          <span className="text-text-muted text-[10px]">(+{cc})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(dateFrom || dateTo || countryFilter !== 'all') && (
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-text-muted hover:text-error" onClick={() => { setDateFrom(''); setDateTo(''); setCountryFilter('all'); }}>
                  <X size={12} /> Clear
                </Button>
              )}
              <div className="ml-auto hidden md:flex items-center gap-1.5 text-[11px] text-text-muted bg-background/50 border border-border/60 rounded-lg px-2.5 py-1.5">
                <Layers size={12} className="text-primary" /> {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''} in view
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-4 xl:gap-5">

              {/* Left: Campaign List */}
              <div className="min-w-0 flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[11px] font-display font-semibold uppercase tracking-wider text-text-muted">Campaign Runs</h2>
                  <span className="text-[10px] font-mono text-text-muted bg-background/60 border border-border/60 rounded-md px-1.5 py-0.5">
                    {filteredCampaigns.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 max-h-[calc(100vh-330px)] min-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredCampaigns.map((camp) => {
                    const isSelected = selectedCampaign?.id === camp.id;
                    const cc = campaignCountry(camp);
                    const st = campaignStatus(camp);
                    const dateObj = new Date(camp.timestamp);
                    const dateValid = !isNaN(dateObj.getTime());
                    const yieldPct = camp.totalChecked > 0 ? Math.round((camp.registeredCount / camp.totalChecked) * 100) : 0;
                    const photoCount = (camp.results || []).filter(resultHasPhoto).length;
                    return (
                      <div
                        key={camp.id}
                        className={cn(
                          "rounded-xl border transition-all duration-200 cursor-pointer relative group overflow-hidden",
                          isSelected
                            ? 'bg-surface border-primary/50 shadow-md ring-1 ring-primary/15'
                            : 'bg-surface border-border hover:border-primary/40 hover:shadow-md hover:-translate-y-px'
                        )}
                        onClick={() => { setSelectedCampaign(camp); setSearchTerm(''); setStatusFilter('all'); }}
                      >
                        {isSelected && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />}
                        {/* Delete button - always visible on mobile, hover on desktop */}
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(camp.id); }}
                                disabled={deletingId === camp.id}
                                className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 md:opacity-0 md:group-hover:opacity-100 transition-all focus:opacity-100 disabled:opacity-40 disabled:pointer-events-none"
                                title="Delete Campaign"
                              >
                                {deletingId === camp.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={4}>
                              <p>Delete Campaign</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Card content */}
                        <div className="p-3.5">
                          {/* Header: clean campaign name + status chips */}
                          <div className="mb-2 pr-7 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-display font-semibold text-[13px] leading-snug text-text-primary truncate min-w-0">
                                {campaignLabel(camp)}
                              </h4>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <Badge variant={st.variant} className="text-[9px] px-1.5 py-0 shrink-0">
                                {st.label}
                              </Badge>
                              <Badge variant={camp.shieldMode ? 'success' : 'outline'} className="text-[9px] px-1.5 py-0 shrink-0">
                                {camp.shieldMode ? 'Shield Mode' : 'Standard'}
                              </Badge>
                              <span className={cn(
                                "ml-auto inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0",
                                photoCount > 0
                                  ? "bg-primary/5 text-primary border-primary/20"
                                  : "text-text-muted border-border/60"
                              )}>
                                <Camera size={9} /> {photoCount}
                              </span>
                            </div>
                          </div>

                          {/* Country: full name + dial code, flag tile */}
                          <div className="flex items-center gap-2.5 bg-background/50 border border-border/60 rounded-lg p-2 min-w-0">
                            <div className="w-9 h-9 shrink-0 rounded-lg bg-surface border border-border/70 flex items-center justify-center text-lg leading-none overflow-hidden">
                              {cc.flag || <MapPin size={15} className="text-text-muted" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Target Country</p>
                              <p className="truncate text-xs font-semibold text-text-primary leading-tight">
                                {cc.name || '—'}{cc.code ? <span className="text-text-muted font-normal ml-1.5">{cc.code}</span> : null}
                              </p>
                            </div>
                          </div>

                          {/* Date & time as separate, beautiful info with relative age */}
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="flex items-center gap-1.5 bg-background/50 border border-border/60 rounded-lg px-2 py-1.5 min-w-0">
                              <CalendarDays size={11} className="text-text-muted shrink-0" />
                              <span className="text-[11px] text-text-secondary font-medium truncate">
                                {dateValid ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-background/50 border border-border/60 rounded-lg px-2 py-1.5 min-w-0">
                              <Clock size={11} className="text-text-muted shrink-0" />
                              <span className="text-[11px] text-text-secondary font-medium truncate">
                                {dateValid ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </div>
                          </div>
                          {dateValid && (
                            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-primary font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                              Ran {formatAge(camp.timestamp)}
                            </div>
                          )}

                          {/* Stats */}
                          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center bg-background/50 p-2 rounded-lg border border-border/60">
                            <div>
                              <p className="text-[9px] text-text-muted font-semibold uppercase tracking-wide">Total</p>
                              <p className="font-bold text-text-primary text-[11px] font-mono">{camp.totalChecked}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-success font-semibold uppercase tracking-wide">Active</p>
                              <p className="font-bold text-success text-[11px] font-mono">{camp.registeredCount}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-error font-semibold uppercase tracking-wide">Inactive</p>
                              <p className="font-bold text-error text-[11px] font-mono">{camp.unregisteredCount}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-primary font-semibold uppercase tracking-wide">Yield</p>
                              <p className="font-bold text-primary text-[11px] font-mono">{yieldPct}%</p>
                            </div>
                          </div>

                          {/* Single action: exports live in the detail area only */}
                          <div className="mt-2.5 flex items-center border-t border-border/70 pt-2.5">
                            <Button
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              className="h-7 px-2.5 text-[11px] gap-1.5 w-full"
                              onClick={(e) => { e.preventDefault(); setSelectedCampaign(camp); setSearchTerm(''); setStatusFilter('all'); }}
                            >
                              <Eye size={12} /> {isSelected ? 'Viewing Report' : 'View Details'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Campaign Details */}
              <div className="min-w-0 flex flex-col gap-4">
                {selectedCampaign ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Campaign Detail Card */}
                    <Card className="border-border overflow-hidden">
                      <CardHeader className="pb-3 border-b border-border bg-gradient-to-br from-primary/[0.04] to-transparent px-4 py-3">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
                          <div className="min-w-0">
                            {/* Campaign name + status — date/time are separate metadata */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 shrink-0 rounded-xl bg-surface border border-border/70 flex items-center justify-center text-lg leading-none overflow-hidden">
                                {selCountry?.flag || <MapPin size={15} className="text-text-muted" />}
                              </div>
                              <div className="min-w-0">
                                <CardTitle className="text-sm font-bold font-display truncate min-w-0">
                                  {campaignLabel(selectedCampaign)}
                                </CardTitle>
                                <p className="text-[11px] text-text-secondary font-medium truncate">
                                  {selCountry ? `${selCountry.name}${selCountry.code ? ` · ${selCountry.code}` : ''}` : '—'}
                                </p>
                              </div>
                              <Badge variant={campaignStatus(selectedCampaign).variant} className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                                {campaignStatus(selectedCampaign).label}
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 bg-background/60 border border-border/60 rounded-md px-1.5 py-0.5 text-[10px] text-text-secondary font-medium">
                                <CalendarDays size={10} className="text-text-muted" />
                                {new Date(selectedCampaign.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              <span className="inline-flex items-center gap-1 bg-background/60 border border-border/60 rounded-md px-1.5 py-0.5 text-[10px] text-text-secondary font-medium">
                                <Clock size={10} className="text-text-muted" />
                                {new Date(selectedCampaign.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-primary font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                                Ran {formatAge(selectedCampaign.timestamp)}
                              </span>
                            </div>
                          </div>
                          {/* Compact Export Buttons — kept in the central detail area */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {EXPORT_BTN_CONFIG.map(cfg => {
                              const st = exportStates[cfg.key];
                              return (
                                <Tooltip key={cfg.key}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleExport(cfg.key, exportHandlers[cfg.key], exportStates, setExportStates)}
                                      disabled={st === 'loading'}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all border",
                                        st === 'done'
                                          ? 'border-success/30 bg-success/5 text-success'
                                          : st === 'loading'
                                          ? 'border-border bg-surface opacity-70 cursor-not-allowed'
                                          : 'border-border bg-surface hover:bg-background text-text-secondary hover:text-primary'
                                      )}
                                    >
                                      {getExportIcon(cfg.key, st)}
                                      {cfg.label}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>{cfg.tooltip}</TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-3 px-4 pb-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                          <DetailStat label="Country Scope">
                            {selCountry?.flag && <span className="text-sm leading-none">{selCountry.flag}</span>}
                            <span className="truncate">{selCountry ? `${selCountry.name}${selCountry.code ? ' ' + selCountry.code : ''}` : '—'}</span>
                          </DetailStat>
                          <DetailStat label="Run Date" icon={<CalendarDays size={11} className="text-text-muted shrink-0" />}>
                            <span className="truncate">{new Date(selectedCampaign.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </DetailStat>
                          <DetailStat label="Run Time" icon={<Clock size={11} className="text-text-muted shrink-0" />}>
                            <span className="truncate">
                              {new Date(selectedCampaign.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-text-muted font-normal">{formatAge(selectedCampaign.timestamp)}</span>
                          </DetailStat>
                          <DetailStat label="Numbers Checked">
                            <span className="font-mono">{selectedCampaign.totalChecked?.toLocaleString?.() ?? selectedCampaign.totalChecked}</span>
                          </DetailStat>
                          <DetailStat label="Yield Ratio" icon={<Shield size={11} className="text-primary shrink-0" />}>
                            <span className="font-mono">
                              {selectedCampaign.totalChecked > 0 ? Math.round((selectedCampaign.registeredCount / selectedCampaign.totalChecked) * 100) : 0}%
                            </span>
                            <span className="text-text-muted font-normal">{selectedCampaign.registeredCount}/{selectedCampaign.totalChecked}</span>
                          </DetailStat>
                          <DetailStat label="Profile Photos" icon={<Camera size={11} className="text-primary shrink-0" />}>
                            <span className="font-mono">{(selectedCampaign.results || []).filter(resultHasPhoto).length}</span>
                            <span className="text-text-muted font-normal">captured</span>
                          </DetailStat>
                          <DetailStat label="Shield Mode" icon={<Shield size={11} className="text-success shrink-0" />}>
                            {selectedCampaign.shieldMode ? 'Activated' : 'Standard'}
                          </DetailStat>
                          <DetailStat label="Rate Limiting" icon={<Clock size={11} className="text-warning shrink-0" />}>
                            {selectedCampaign.delayMs}ms
                          </DetailStat>
                          <DetailStat label="Status">
                            <Badge variant={campaignStatus(selectedCampaign).variant} className="text-[10px] px-1.5 py-0 h-4">
                              {campaignStatus(selectedCampaign).label}
                            </Badge>
                          </DetailStat>
                          <DetailStat label="Audience Type">
                            {selectedCampaign.shieldMode ? 'Protected scan' : 'Standard scan'}
                          </DetailStat>
                        </div>
                        {selectedCampaign.countryBreakdown && Object.keys(selectedCampaign.countryBreakdown).length > 0 && (
                          <div className="mt-2.5 p-2.5 bg-background border border-border/60 rounded-lg">
                            <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block mb-1.5">Country Breakdown</span>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(selectedCampaign.countryBreakdown).map(([cc, count]) => (
                                <span key={cc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface border border-border/50 rounded-md text-[11px]">
                                  <span className="font-medium">{getCountryFlag(cc)} {getCountryName(cc)}</span>
                                  <span className="text-text-muted">({count})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Number Table */}
                    <div className="flex flex-col min-h-0 bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                      <div className="p-2.5 border-b border-border bg-background/50 flex flex-col sm:flex-row gap-2 justify-between items-center">
                        <div className="relative w-full sm:w-52">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                          <Input
                            placeholder="Search numbers..."
                            className="pl-8 bg-surface h-8 text-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Filter className="h-3.5 w-3.5 text-text-muted hidden sm:block" />
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-48 bg-surface h-8 text-xs">
                              <SelectValue placeholder="Filter" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Results</SelectItem>
                              <SelectItem value="registered">Registered</SelectItem>
                              <SelectItem value="avatar">Profile Picture Available</SelectItem>
                              <SelectItem value="unregistered">Not Registered</SelectItem>
                              <SelectItem value="invalid">Invalid</SelectItem>
                              <SelectItem value="business">Business Accounts</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="max-h-[400px] overflow-x-auto overflow-y-auto custom-scrollbar">
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-surface shadow-xs">
                            <TableRow>
                              <TableHead className="w-[40px] text-[11px]">Profile</TableHead>
                              <TableHead className="w-[40px] text-[11px]">#</TableHead>
                              <TableHead className="text-[11px]">Phone Number</TableHead>
                              <TableHead className="text-[11px]">Status</TableHead>
                              <TableHead className="hidden md:table-cell text-[11px]">Type</TableHead>
                              <TableHead className="hidden lg:table-cell text-[11px]">Display Name</TableHead>
                              <TableHead className="text-right text-[11px]">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedResults.length > 0 ? (
                              paginatedResults.map((result, idx) => {
                                const absIndex = (resultsPage - 1) * RESULTS_PER_PAGE + idx;
                                return (
                                <TableRow key={`${selectedCampaign.id}-${absIndex}`} className="group/row">
                                  <TableCell className="align-middle">
                                    <ResultAvatar result={result} size={30} />
                                  </TableCell>
                                  <TableCell className="text-[11px] text-text-muted font-mono">{absIndex + 1}</TableCell>
                                  <TableCell className="font-mono text-xs">{result.formatted || result.number}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {result.exists ? (
                                        <Badge variant="success" className="text-[10px] px-1.5 py-0">Registered</Badge>
                                      ) : result.isValidFormat ? (
                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Not Registered</Badge>
                                      ) : (
                                        <Badge variant="warning" className="text-[10px] px-1.5 py-0">Invalid</Badge>
                                      )}
                                      {result.exists && resultHasPhoto(result) && (
                                        <span
                                          className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-primary/5 text-primary border border-primary/20"
                                          title="Profile picture captured"
                                        >
                                          <Camera size={8} /> Photo
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {result.exists ? (
                                      <Badge variant={result.isBusiness ? "default" : "outline"} className={cn("text-[10px] px-1.5 py-0", result.isBusiness && "bg-primary/10 text-primary border-primary/30")}>
                                        {result.isBusiness ? 'Business' : 'Personal'}
                                      </Badge>
                                    ) : (
                                      <span className="text-text-muted text-[11px]">N/A</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden lg:table-cell text-text-secondary text-[11px] truncate max-w-[140px]" title={result.displayName || result.verifiedName}>
                                    {result.displayName || result.verifiedName || '---'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          disabled={!result.exists}
                                          onClick={() => openWhatsApp(result.formatted || result.number)}
                                          className="text-text-secondary hover:text-primary h-7 w-7"
                                        >
                                          <MessageCircle size={13} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Message on WhatsApp</TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                                );
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-text-muted text-xs">
                                  No matching records found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {filteredResults.length > 0 && (
                        <div className="px-3 py-2 border-t border-border bg-background/50 flex flex-col sm:flex-row items-center justify-between gap-2">
                          <span className="text-[11px] text-text-muted">
                            Showing {((resultsPage - 1) * RESULTS_PER_PAGE) + 1}–{Math.min(resultsPage * RESULTS_PER_PAGE, filteredResults.length)} of {filteredResults.length} results
                            {filterLabel !== 'All Results' && <span className="text-primary ml-1">({filterLabel})</span>}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={resultsPage <= 1}
                              onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                              aria-label="Previous page"
                            >
                              <ChevronLeft size={13} />
                            </Button>
                            <span className="text-[11px] text-text-muted font-mono px-1">
                              Page {resultsPage} of {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={resultsPage >= totalPages}
                              onClick={() => setResultsPage(p => Math.min(totalPages, p + 1))}
                              aria-label="Next page"
                            >
                              <ChevronRight size={13} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-12 text-center text-text-muted text-sm gap-2">
                    <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center mb-1">
                      <Layers size={22} className="text-text-muted" />
                    </div>
                    Select a validation campaign from the left panel to view its report and downloads.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
              <AlertDesc>This action cannot be undone. The campaign and all its results will be permanently removed.</AlertDesc>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirm(null)} disabled={!!deletingId}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(deleteConfirm)} disabled={!!deletingId} className="bg-error hover:bg-error/90">
                {deletingId === deleteConfirm ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}