import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Globe, Shield, Clock, FileText, Search, Filter, 
  Download, FileDown, MessageCircle, TrendingUp, Award, 
  AlertCircle, Database, Trash2, Smartphone, ChevronDown, X,
  Check, Loader2, AlignLeft, Code2
} from 'lucide-react';
import { useWebSocket } from '../context/WebSocketProvider';
import { getCountryName, getCountryFlag, exportFilteredCSV, exportFilteredTXT, exportFilteredJSON, exportFilteredPDF, exportAllHistoryCSV, exportAllHistoryJSON, exportAllHistoryTXT, exportAllHistoryPDF } from '../utils/exportUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../components/ui/Tooltip';
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

export default function CampaignHistoryPage() {
  const { isAuthenticated, sessionUser, sendMessage } = useWebSocket();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStates, setExportStates] = useState({ csv: 'idle', txt: 'idle', json: 'idle', pdf: 'idle' });
  const [allExportStates, setAllExportStates] = useState({ csv: 'idle', txt: 'idle', json: 'idle', pdf: 'idle' });

  const connectedPhone = sessionUser?.number?.replace(/\D/g, '') || '';

  useEffect(() => {
    if (isAuthenticated && connectedPhone) {
      fetchCampaigns();
    } else {
      setLoading(false);
      setCampaigns([]);
    }
  }, [isAuthenticated, connectedPhone]);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns?phone=${connectedPhone}`);
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns);
        if (data.campaigns.length > 0 && !selectedCampaign) {
          setSelectedCampaign(data.campaigns[0]);
        }
      } else {
        setError('Failed to fetch campaign history.');
      }
    } catch (err) {
      setError('Error connecting to backend server.');
    } finally {
      setLoading(false);
    }
  };

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
    return selectedCampaign.results.filter(result => {
      const numString = result.formatted || result.number || '';
      const matchesSearch = numString.includes(searchTerm) || 
                            (result.statusText && result.statusText.toLowerCase().includes(searchTerm.toLowerCase()));
      let matchesStatus = true;
      if (statusFilter === 'registered') matchesStatus = result.exists === true;
      if (statusFilter === 'unregistered') matchesStatus = result.exists === false && result.isValidFormat;
      if (statusFilter === 'invalid') matchesStatus = !result.isValidFormat;
      if (statusFilter === 'business') matchesStatus = result.isBusiness === true;
      return matchesSearch && matchesStatus;
    });
  }, [selectedCampaign, searchTerm, statusFilter]);

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
    else parts.push('All Results');
    if (searchTerm) parts.push(`matching "${searchTerm}"`);
    return parts.join(' ');
  }, [statusFilter, searchTerm]);

  const handleDelete = useCallback((campaignId) => {
    sendMessage({ type: 'delete_campaign', id: campaignId, phone: connectedPhone });
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    if (selectedCampaign?.id === campaignId) {
      setSelectedCampaign(null);
    }
    setDeleteConfirm(null);
  }, [connectedPhone, sendMessage, selectedCampaign]);

  const openWhatsApp = (number) => {
    const cleanNumber = number.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanNumber}`, '_blank');
  };

  const handleExport = async (key, fn, states, setStates) => {
    if (states[key] !== 'idle') return;
    setStates(prev => ({ ...prev, [key]: 'loading' }));
    await new Promise(r => setTimeout(r, 600));
    try {
      fn();
      setStates(prev => ({ ...prev, [key]: 'done' }));
    } catch {
      setStates(prev => ({ ...prev, [key]: 'idle' }));
      return;
    }
    await new Promise(r => setTimeout(r, 1500));
    setStates(prev => ({ ...prev, [key]: 'idle' }));
  };

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col gap-8 mt-6">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col gap-5 pb-12">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Campaign Audit Log</h1>
            <p className="text-text-secondary mt-1 text-sm">
              Access verification reports, download compliance documents, and review audience analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchCampaigns} variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
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
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            <p className="text-text-secondary text-sm">Loading historical verification records...</p>
          </div>
        ) : error ? (
          <Card className="border-error/20 bg-error/5">
            <CardContent className="pt-6 flex flex-col items-center justify-center text-center p-8">
              <AlertCircle className="text-error h-12 w-12 mb-3" />
              <h3 className="font-semibold text-lg text-text-primary">Failed to load history</h3>
              <p className="text-text-secondary text-sm max-w-md mt-1">{error}</p>
              <Button className="mt-4" onClick={fetchCampaigns}>Try Again</Button>
            </CardContent>
          </Card>
        ) : filteredCampaigns.length === 0 ? (
          <Card className="border-border bg-surface/50">
            <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center">
              <Database className="text-text-muted h-16 w-16 mb-4" />
              <h3 className="font-display font-semibold text-xl">No Campaigns Found</h3>
              <p className="text-text-secondary text-sm max-w-md mt-2">
                {campaigns.length > 0 ? 'No campaigns match your filter criteria.' : "You haven't run any validation processes yet. Link your WhatsApp session and run an audience scan to record telemetry logs."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="relative overflow-hidden">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Total Validations</p>
                      <h3 className="text-xl sm:text-2xl font-bold mt-1 font-mono">{aggregatedStats.total}</h3>
                    </div>
                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">Across {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">WA Registered</p>
                      <h3 className="text-xl sm:text-2xl font-bold text-success mt-1 font-mono">{aggregatedStats.registered}</h3>
                    </div>
                    <div className="p-1.5 bg-success/10 rounded-lg text-success">
                      <Award size={16} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">Active messaging audience</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Not Registered</p>
                      <h3 className="text-xl sm:text-2xl font-bold text-error mt-1 font-mono">{aggregatedStats.unregistered}</h3>
                    </div>
                    <div className="p-1.5 bg-error/10 rounded-lg text-error">
                      <AlertCircle size={16} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">Non-WhatsApp / inactive</p>
                </CardContent>
              </Card>

              <Card>
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
            <div className="flex flex-wrap gap-2.5 items-end bg-surface border border-border rounded-xl p-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">From</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-32 sm:w-36 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">To</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-32 sm:w-36 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Country</label>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="h-8 w-36 sm:w-40 text-xs">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {availableCountries.map(cc => (
                      <SelectItem key={cc} value={cc}>{getCountryFlag(cc)} {getCountryName(cc)} (+{cc})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(dateFrom || dateTo || countryFilter !== 'all') && (
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setDateFrom(''); setDateTo(''); setCountryFilter('all'); }}>
                  <X size={12} /> Clear
                </Button>
              )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              
              {/* Left: Campaign List */}
              <div className="lg:col-span-1 flex flex-col gap-2">
                <h2 className="text-[11px] font-display font-semibold px-1 uppercase tracking-wider text-text-muted">Campaign Runs</h2>
                <div className="flex flex-col gap-2 max-h-[580px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredCampaigns.map((camp) => {
                    const isSelected = selectedCampaign?.id === camp.id;
                    const date = new Date(camp.timestamp);
                    const yieldPct = camp.totalChecked > 0 ? Math.round((camp.registeredCount / camp.totalChecked) * 100) : 0;
                    return (
                      <div 
                        key={camp.id}
                        className={cn(
                          "p-3 rounded-xl border transition-all duration-200 cursor-pointer relative group",
                          isSelected 
                            ? 'bg-surface border-primary/50 shadow-sm ring-1 ring-primary/20' 
                            : 'bg-surface border-border hover:border-text-muted/50 hover:shadow-xs'
                        )}
                        onClick={() => { setSelectedCampaign(camp); setSearchTerm(''); setStatusFilter('all'); }}
                      >
                        {/* Delete button - always visible on mobile, hover on desktop */}
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(camp.id); }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 md:opacity-0 md:group-hover:opacity-100 transition-all focus:opacity-100"
                                title="Delete Campaign"
                              >
                                <Trash2 size={13} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={4}>
                              <p>Delete Campaign</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Card content */}
                        <div className="flex items-center gap-2 mb-2 pr-6">
                          <Calendar size={11} className="text-text-muted shrink-0" />
                          <span className="text-[11px] font-medium text-text-secondary truncate">
                            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2.5">
                          <h4 className="font-semibold text-[11px] text-text-primary truncate font-mono">
                            {camp.id ? camp.id.substring(0, 12) + '...' : 'N/A'}
                          </h4>
                          <Badge variant={camp.shieldMode ? 'success' : 'outline'} className="text-[9px] px-1.5 py-0 shrink-0">
                            {camp.shieldMode ? 'Shield' : 'Normal'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] bg-background/50 p-2 rounded-lg border border-border/50">
                          <div>
                            <p className="text-text-muted font-medium uppercase">Total</p>
                            <p className="font-bold text-text-primary text-[11px] font-mono">{camp.totalChecked}</p>
                          </div>
                          <div>
                            <p className="text-success font-medium uppercase">Active</p>
                            <p className="font-bold text-success text-[11px] font-mono">{camp.registeredCount}</p>
                          </div>
                          <div>
                            <p className="text-error font-medium uppercase">Inactive</p>
                            <p className="font-bold text-error text-[11px] font-mono">{camp.unregisteredCount}</p>
                          </div>
                          <div>
                            <p className="text-text-muted font-medium uppercase">Yield</p>
                            <p className="font-bold text-primary text-[11px] font-mono">{yieldPct}%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Campaign Details */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {selectedCampaign ? (
                  <motion.div 
                    key={selectedCampaign.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Campaign Detail Card */}
                    <Card className="border-border">
                      <CardHeader className="pb-2.5 border-b border-border bg-surface/50 px-4 py-2.5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-bold font-display flex items-center gap-2">
                              <FileText size={14} className="text-primary shrink-0" /> Campaign Details
                            </CardTitle>
                            <CardDescription className="text-[10px] mt-0.5 font-mono truncate">
                              Ref: {selectedCampaign.id} &bull; {new Date(selectedCampaign.timestamp).toLocaleString()}
                            </CardDescription>
                          </div>
                          {/* Compact Export Buttons */}
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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-2.5 bg-background border border-border/50 rounded-lg">
                            <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block">Country Scope</span>
                            <span className="text-[11px] font-semibold text-text-primary mt-0.5 flex items-center gap-1">
                              <Globe size={11} className="text-secondary" /> +{selectedCampaign.countryCode}
                            </span>
                          </div>
                          <div className="p-2.5 bg-background border border-border/50 rounded-lg">
                            <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block">Rate Limiting</span>
                            <span className="text-[11px] font-semibold text-text-primary mt-0.5 flex items-center gap-1">
                              <Clock size={11} className="text-warning" /> {selectedCampaign.delayMs}ms
                            </span>
                          </div>
                          <div className="p-2.5 bg-background border border-border/50 rounded-lg">
                            <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block">Shield Mode</span>
                            <span className="text-[11px] font-semibold text-text-primary mt-0.5 flex items-center gap-1">
                              <Shield size={11} className="text-success" /> {selectedCampaign.shieldMode ? 'Activated' : 'Standard'}
                            </span>
                          </div>
                          <div className="p-2.5 bg-background border border-border/50 rounded-lg">
                            <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block">Yield Ratio</span>
                            <span className="text-[11px] font-semibold text-text-primary mt-0.5 font-mono">
                              {selectedCampaign.totalChecked > 0 ? Math.round((selectedCampaign.registeredCount / selectedCampaign.totalChecked) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                        {selectedCampaign.countryBreakdown && Object.keys(selectedCampaign.countryBreakdown).length > 0 && (
                          <div className="mt-2.5 p-2.5 bg-background border border-border/50 rounded-lg">
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
                    <div className="flex flex-col min-h-0 bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
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
                            <SelectTrigger className="w-full sm:w-[150px] bg-surface h-8 text-xs">
                              <SelectValue placeholder="Filter" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Results</SelectItem>
                              <SelectItem value="registered">Registered</SelectItem>
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
                              <TableHead className="w-[40px] text-[11px]">#</TableHead>
                              <TableHead className="text-[11px]">Phone Number</TableHead>
                              <TableHead className="text-[11px]">Status</TableHead>
                              <TableHead className="hidden md:table-cell text-[11px]">Profile Info</TableHead>
                              <TableHead className="text-right text-[11px]">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredResults.length > 0 ? (
                              filteredResults.map((result, idx) => (
                                <TableRow key={idx} className="group/row">
                                  <TableCell className="text-[11px] text-text-muted font-mono">{idx + 1}</TableCell>
                                  <TableCell className="font-mono text-xs">{result.formatted || result.number}</TableCell>
                                  <TableCell>
                                    {result.exists ? (
                                      <Badge variant="success" className="text-[10px] px-1.5 py-0">Registered</Badge>
                                    ) : result.isValidFormat ? (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Not Registered</Badge>
                                    ) : (
                                      <Badge variant="warning" className="text-[10px] px-1.5 py-0">Invalid</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-text-secondary text-[11px] truncate max-w-[160px]" title={result.statusText}>
                                    {result.statusText || '---'}
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
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-text-muted text-xs">
                                  No matching records found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {filteredResults.length > 0 && (
                        <div className="px-3 py-1.5 border-t border-border bg-background/50 flex items-center justify-between">
                          <span className="text-[11px] text-text-muted">
                            Showing {filteredResults.length} of {selectedCampaign.results?.length || 0} results
                            {filterLabel !== 'All Results' && <span className="text-primary ml-1">({filterLabel})</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-border rounded-xl p-12 text-center text-text-muted text-sm">
                    Select a validation campaign from the left panel to view details.
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
              <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(deleteConfirm)} className="bg-error hover:bg-error/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
