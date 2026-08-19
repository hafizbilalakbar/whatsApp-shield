import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Phone, BarChart3, Shield, Clock, LogOut, Trash2, Smartphone, Award, Globe, Activity, FileText, ExternalLink, MapPin, Wifi, Download, Loader2, Hash, TrendingUp, LocateFixed, LocateOff } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketProvider';
import { useUserAvatar } from '../hooks/useUserAvatar';
import { showToast } from '../components/ui/ToastNotification';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/AlertDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { countries } from '../data/countries';

const EXPORT_KEY = 'whatsapp_shield_exports';

const getExportCounts = () => {
  try { return JSON.parse(localStorage.getItem(EXPORT_KEY) || '{"csv":0,"json":0,"pdf":0,"txt":0}'); } catch { return { csv: 0, json: 0, pdf: 0, txt: 0 }; }
};
const saveExportCounts = (c) => localStorage.setItem(EXPORT_KEY, JSON.stringify(c));

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isConnected, campaignHistory, logout, sendMessage, deleteCampaign, status, qrCode, lastActiveTime } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [ipData, setIpData] = useState(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [exportCounts, setExportCounts] = useState(getExportCounts);
  const [exportLoading, setExportLoading] = useState(false);
  const [clearHistoryLoading, setClearHistoryLoading] = useState(false);

  const connectedPhone = sessionUser?.number?.replace(/\D/g, '') || '';

  const { src: avatarSrc, showImage: avatarOk, onLoad: avatarOnLoad, onError: avatarOnError } = useUserAvatar(sessionUser);

  // Load export counts from localStorage
  useEffect(() => {
    setExportCounts(getExportCounts());
  }, []);

  // Browser Geolocation + IP fallback + locale
  useEffect(() => {
    if (!isAuthenticated) { setIpLoading(false); return; }

    const locale = navigator.language || navigator.languages?.[0] || 'en-US';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';

    // Try browser Geolocation API first
    if ('geolocation' in navigator && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(permResult => {
        if (permResult.state === 'granted' || permResult.state === 'prompt') {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              // Reverse geocode via free API, or just use coordinates
              fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`)
                .then(r => r.json())
                .then(geo => {
                  setIpData({
                    city: geo.city || geo.locality || 'Unknown',
                    region: geo.principalSubdivision || '',
                    country_name: geo.countryName || 'Unknown',
                    countryCode: geo.countryCode || '',
                    org: 'Browser Geolocation',
                    timezone: tz,
                    locale,
                    source: 'browser'
                  });
                  setIpLoading(false);
                })
                .catch(() => {
                  setIpData({
                    city: `~${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
                    region: '',
                    country_name: 'Unknown',
                    countryCode: '',
                    org: 'Browser Geolocation',
                    timezone: tz,
                    locale,
                    source: 'browser'
                  });
                  setIpLoading(false);
                });
            },
            () => {
              // Geolocation denied or unavailable — fall back to IP
              fallbackToIp();
            },
            { timeout: 10000, enableHighAccuracy: false }
          );
        } else {
          fallbackToIp();
        }
      }).catch(() => fallbackToIp());
    } else if ('geolocation' in navigator) {
      // Permissions API unavailable — try geolocation directly
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`)
            .then(r => r.json())
            .then(geo => {
              setIpData({
                city: geo.city || geo.locality || 'Unknown',
                region: geo.principalSubdivision || '',
                country_name: geo.countryName || 'Unknown',
                countryCode: geo.countryCode || '',
                org: 'Browser Geolocation',
                timezone: tz,
                locale,
                source: 'browser'
              });
              setIpLoading(false);
            })
            .catch(() => fallbackToIp());
        },
        () => fallbackToIp(),
        { timeout: 10000, enableHighAccuracy: false }
      );
    } else {
      fallbackToIp();
    }

    function fallbackToIp() {
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then(data => {
          setIpData({ ...data, timezone: tz, locale, source: 'ip' });
          setIpLoading(false);
        })
        .catch(() => {
          setIpData({
            city: 'Unknown',
            region: '',
            country_name: 'Unknown',
            countryCode: '',
            org: 'Unknown',
            timezone: tz,
            locale,
            source: null
          });
          setIpLoading(false);
        });
    }
  }, [isAuthenticated]);

  // Load campaign history on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && connectedPhone) {
      sendMessage({ type: 'get_history', phone: connectedPhone });
      setLoading(false);
    } else if (!isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated, connectedPhone, sendMessage]);

  const getCountryName = (code) => {
    if (!code) return 'Unknown';
    const c = countries.find(c => c.iso.toLowerCase() === code.toLowerCase());
    return c ? c.name : code;
  };

  const getCountryFlag = (code) => {
    if (!code || code === 'N/A' || code === 'Unknown') return null;
    const c = countries.find(c => c.iso.toLowerCase() === code.toLowerCase());
    return c ? c.iso.toUpperCase() : null;
  };

  const stats = useMemo(() => {
    if (!campaignHistory.length) return { totalCampaigns: 0, totalNumbers: 0, totalRegistered: 0, totalUnregistered: 0, totalInvalid: 0, favCountry: 'N/A', lastActive: null, avgPerCampaign: 0 };
    let totalNumbers = 0, totalRegistered = 0, totalUnregistered = 0, totalInvalid = 0;
    const countryCounts = {};
    let lastActive = null;
    campaignHistory.forEach(c => {
      totalNumbers += c.totalChecked || 0;
      totalRegistered += c.registeredCount || 0;
      totalUnregistered += c.unregisteredCount || 0;
      totalInvalid += c.invalidCount || 0;
      if (c.countryBreakdown) {
        Object.entries(c.countryBreakdown).forEach(([cc, count]) => {
          countryCounts[cc] = (countryCounts[cc] || 0) + count;
        });
      }
      if (!lastActive || new Date(c.timestamp) > new Date(lastActive)) {
        lastActive = c.timestamp;
      }
    });
    const favEntry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];
    const favCountry = favEntry ? favEntry[0] : 'N/A';
    return {
      totalCampaigns: campaignHistory.length,
      totalNumbers,
      totalRegistered,
      totalUnregistered,
      totalInvalid,
      favCountry,
      favFlag: getCountryFlag(favCountry),
      lastActive,
      avgPerCampaign: campaignHistory.length > 0 ? Math.round(totalNumbers / campaignHistory.length) : 0
    };
  }, [campaignHistory]);

  // Activity chart data - campaigns per day for last 14 days
  const chartData = useMemo(() => {
    const last14 = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const count = campaignHistory.filter(c => c.timestamp.startsWith(key)).length;
      last14.push({
        date: key.slice(5),
        count
      });
    }
    return last14;
  }, [campaignHistory]);

  const handleDeleteAllHistory = useCallback(async () => {
    if (!connectedPhone) return;
    setClearHistoryLoading(true);
    // Delete every campaign owned by this session and wait for each backend
    // result so the UI can never claim success while disk/cache still holds data.
    let allOk = true;
    try {
      const results = await Promise.all(
        campaignHistory.map(c => deleteCampaign(c.id, connectedPhone).catch(() => null))
      );
      allOk = results.every(r => r?.success);
    } catch (_) {
      allOk = false;
    }
    // Re-sync from the authoritative source.
    sendMessage({ type: 'get_history', phone: connectedPhone });
    setClearHistoryLoading(false);
    showToast(
      allOk ? 'Campaign history cleared successfully.' : 'Some campaigns could not be deleted. Please try again.',
      allOk ? 'success' : 'error'
    );
  }, [campaignHistory, connectedPhone, deleteCampaign, sendMessage]);

  const handleExportAllData = useCallback(() => {
    setExportLoading(true);
    setTimeout(() => {
      const data = {
        exportedAt: new Date().toISOString(),
        sessionUser: sessionUser ? { name: sessionUser.name, number: sessionUser.number } : null,
        campaigns: campaignHistory,
        ipLocation: ipData || null
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whatsapp-shield-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportLoading(false);
      showToast('All data exported successfully.', 'success');
    }, 600);
  }, [sessionUser, campaignHistory, ipData]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center mb-6">
            <Smartphone size={36} className="text-text-muted" />
          </div>
          <h2 className="text-2xl font-display font-bold text-text-primary mb-2">Connect Your WhatsApp</h2>
          <p className="text-text-secondary text-sm max-w-md">Connect your WhatsApp to view your profile.</p>
          <Button className="mt-6" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 relative">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8 p-6 md:p-8 rounded-2xl bg-surface border border-border">
          <div className="relative">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-primary/20 overflow-hidden">
              {avatarOk && avatarSrc ? (
                <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" loading="lazy" decoding="async" onLoad={avatarOnLoad} onError={avatarOnError} />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold">
                  {sessionUser?.name ? sessionUser.name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
            </div>
            <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-surface ${isConnected ? 'bg-success' : 'bg-gray-400'}`} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold">{sessionUser?.name || 'WhatsApp Session'}</h1>
            <p className="text-text-secondary font-mono text-sm mt-1 flex items-center justify-center md:justify-start gap-2">
              <Phone size={14} /> {sessionUser?.number ? `+${sessionUser.number.replace(/\D/g, '')}` : 'Unknown'}
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start mt-2">
              <Badge variant={isConnected ? 'success' : 'outline'}>
                {isConnected ? 'Active Session' : 'Disconnected'}
              </Badge>
              {lastActiveTime && (
                <span className="text-xs text-text-muted">
                  Last active: {Math.floor((Date.now() - lastActiveTime) / 60000)}m ago
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Current Session Card (IP-based location) */}
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin size={16} className="text-primary" /> Current Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ipLoading ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 size={14} className="animate-spin" /> Detecting location...
              </div>
            ) : ipData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <MapPin size={18} className="text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted">Location</p>
                    <p className="text-sm font-medium">{ipData.city || 'Unknown'}{ipData.region ? `, ${ipData.region}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <Globe size={18} className="text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted">Country</p>
                    <p className="text-sm font-medium">{ipData.country_name || 'Unknown'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <Clock size={18} className="text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted">Timezone</p>
                    <p className="text-sm font-medium">{ipData.timezone || 'Unknown'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <Globe size={18} className="text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted">Locale</p>
                    <p className="text-sm font-medium">{ipData.locale || 'Unknown'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-sm">Could not detect location. Check your network connection.</p>
            )}
            {ipData && (
              <p className="text-xs text-text-muted mt-3 flex items-center gap-2">
                {ipData.source === 'browser' ? (
                  <><LocateFixed size={10} className="text-success" /> Precise location (browser)</>
                ) : ipData.source === 'ip' ? (
                  <><Wifi size={10} /> Approximate location (IP-based)</>
                ) : (
                  <><LocateOff size={10} /> Location unavailable</>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="p-4 text-center">
            <BarChart3 size={20} className="text-primary mx-auto mb-2" />
            <div className="text-xl sm:text-2xl font-bold font-mono">{stats.totalCampaigns}</div>
            <div className="text-xs text-text-muted">Total Campaigns</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Activity size={20} className="text-primary mx-auto mb-2" />
            <div className="text-xl sm:text-2xl font-bold font-mono">{stats.totalNumbers}</div>
            <div className="text-xs text-text-muted">Numbers Validated</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Award size={20} className="text-success mx-auto mb-2" />
            <div className="text-xl sm:text-2xl font-bold font-mono text-success">{stats.totalRegistered}</div>
            <div className="text-xs text-text-muted">Registered Found</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Globe size={20} className="text-secondary mx-auto mb-2" />
            <div className="text-lg font-bold font-mono">{stats.favCountry !== 'N/A' ? getCountryName(stats.favCountry) : 'N/A'}</div>
            <div className="text-xs text-text-muted">Most Used Country</div>
          </CardContent></Card>
        </div>

        {/* Extended Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="p-4 text-center">
            <Hash size={18} className="text-primary mx-auto mb-2" />
            <div className="text-xl font-bold font-mono">{stats.avgPerCampaign}</div>
            <div className="text-xs text-text-muted">Avg Numbers/Campaign</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <TrendingUp size={18} className="text-primary mx-auto mb-2" />
            <div className="text-xl font-bold font-mono">{stats.totalNumbers > 0 ? Math.round((stats.totalRegistered / stats.totalNumbers) * 100) : 0}%</div>
            <div className="text-xs text-text-muted">Registration Rate</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <FileText size={18} className="text-primary mx-auto mb-2" />
            <div className="text-lg font-mono font-bold">
              {exportCounts.pdf + exportCounts.csv + exportCounts.json + exportCounts.txt}
            </div>
            <div className="text-xs text-text-muted">Total Exports</div>
          </CardContent></Card>
        </div>

        {/* Account Activity Chart */}
        <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" /> Account Activity (Last 14 Days)
        </h2>
        <Card className="mb-8">
          <CardContent className="p-4 md:p-6">
            {chartData.every(d => d.count === 0) ? (
              <div className="h-48 flex items-center justify-center text-text-muted text-sm">No campaign activity in the last 14 days.</div>
            ) : (
              <div className="h-48 md:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#00D97E' }}
                      labelStyle={{ color: '#9CA3AF' }}
                    />
                    <Bar dataKey="count" fill="#00D97E" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign Timeline */}
        <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
          <FileText size={18} className="text-primary" /> Campaign History
        </h2>
        {campaignHistory.length === 0 ? (
          <Card className="mb-8"><CardContent className="p-8 text-center text-text-muted">No campaigns run yet.</CardContent></Card>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 mb-8">
            {campaignHistory.map((camp) => (
              <div key={camp.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors">
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="text-xs text-text-muted font-mono">{new Date(camp.timestamp).toLocaleString()}</span>
                  <span className="text-sm font-medium">
                    {camp.totalChecked} numbers &middot; {camp.registeredCount} registered &middot; {camp.unregisteredCount} unregistered
                  </span>
                  <span className="text-xs text-text-secondary">Shield: {camp.shieldMode ? 'ON' : 'OFF'} &middot; Delay: {camp.delayMs}ms</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/history')} className="shrink-0">
                  <ExternalLink size={14} className="mr-1" /> View
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Export Counts Breakdown */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <FileText size={12} /> CSV: {exportCounts.csv}
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <FileText size={12} /> TXT: {exportCounts.txt}
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <FileText size={12} /> JSON: {exportCounts.json}
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <FileText size={12} /> PDF: {exportCounts.pdf}
          </Badge>
        </div>

        {/* Data Management */}
        <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
          <Shield size={18} className="text-primary" /> Data Management
        </h2>
        <Card className="mb-8">
          <CardContent className="p-4 md:p-6 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleExportAllData} disabled={exportLoading} className="gap-2">
              {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exportLoading ? 'Exporting...' : 'Export All My Data'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-error hover:text-error hover:bg-error/10 border-error/20 gap-2" disabled={clearHistoryLoading}>
                  {clearHistoryLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {clearHistoryLoading ? 'Clearing...' : 'Clear Campaign History'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Campaign History?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete all campaign history. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={clearHistoryLoading}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllHistory} disabled={clearHistoryLoading} className="bg-error hover:bg-error/90">
                    {clearHistoryLoading ? 'Clearing...' : 'Clear All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="text-error hover:text-error hover:bg-error/10 border-error/20" onClick={handleLogout}>
            <LogOut size={16} className="mr-2" /> Logout
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
