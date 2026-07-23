import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Phone, BarChart3, Shield, Clock, LogOut, Trash2, Smartphone, Award, Globe, Activity, FileText, ExternalLink, MapPin, Wifi, QrCode, RotateCcw, Download, Loader2, Hash, TrendingUp, LocateFixed, LocateOff } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketProvider';
import { showToast } from '../components/ui/ToastNotification';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/AlertDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { countries } from '../data/countries';

const SESSION_KEY = 'whatsapp_shield_sessions';
const EXPORT_KEY = 'whatsapp_shield_exports';
const LAST_METHOD_KEY = 'whatsapp_shield_last_method';

const getSessions = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '[]'); } catch { return []; }
};
const saveSessions = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));

const getExportCounts = () => {
  try { return JSON.parse(localStorage.getItem(EXPORT_KEY) || '{"csv":0,"json":0,"pdf":0,"txt":0}'); } catch { return { csv: 0, json: 0, pdf: 0, txt: 0 }; }
};
const saveExportCounts = (c) => localStorage.setItem(EXPORT_KEY, JSON.stringify(c));

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isConnected, campaignHistory, logout, sendMessage, status, qrCode, lastActiveTime } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [ipData, setIpData] = useState(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [sessionList, setSessionList] = useState([]);
  const [exportCounts, setExportCounts] = useState(getExportCounts);
  const [exportLoading, setExportLoading] = useState(false);
  const [clearHistoryLoading, setClearHistoryLoading] = useState(false);
  const [clearSessionLoading, setClearSessionLoading] = useState(false);
  const prevAuthRef = useRef(isAuthenticated);

  const connectedPhone = sessionUser?.number?.replace(/\D/g, '') || '';

  // Load sessions from localStorage
  useEffect(() => {
    setSessionList(getSessions());
    setExportCounts(getExportCounts());
  }, []);

  // Track authentication to create session entries
  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current) {
      const sessions = getSessions();
      const activeExists = sessions.some(s => !s.logoutTime);
      if (!activeExists) {
        const method = localStorage.getItem(LAST_METHOD_KEY) || 'QR';
        const newSession = {
          id: crypto.randomUUID(),
          loginTime: new Date().toISOString(),
          phone: sessionUser?.number || connectedPhone || 'Unknown',
          method,
          logoutTime: null
        };
        const updated = [...sessions, newSession];
        saveSessions(updated);
        setSessionList(updated);
      }
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, sessionUser, connectedPhone]);

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

  // Session stats
  const sessionStats = useMemo(() => {
    if (!sessionList.length) return { longestMs: 0, totalSessions: 0 };
    let longestMs = 0;
    sessionList.forEach(s => {
      const login = new Date(s.loginTime).getTime();
      const logout = s.logoutTime ? new Date(s.logoutTime).getTime() : Date.now();
      const duration = logout - login;
      if (duration > longestMs) longestMs = duration;
    });
    return { longestMs, totalSessions: sessionList.length };
  }, [sessionList]);

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

  const handleDeleteAllHistory = useCallback(() => {
    if (!connectedPhone) return;
    setClearHistoryLoading(true);
    campaignHistory.forEach(c => {
      sendMessage({ type: 'delete_campaign', id: c.id, phone: connectedPhone });
    });
    setTimeout(() => {
      sendMessage({ type: 'get_history', phone: connectedPhone });
      setClearHistoryLoading(false);
      showToast('Campaign history cleared successfully.', 'success');
    });
  }, [campaignHistory, connectedPhone, sendMessage]);

  const handleClearSessionHistory = useCallback(() => {
    setClearSessionLoading(true);
    setTimeout(() => {
      saveSessions([]);
      setSessionList([]);
      setClearSessionLoading(false);
      showToast('Session history cleared.', 'success');
    }, 500);
  }, []);

  const handleExportAllData = useCallback(() => {
    setExportLoading(true);
    setTimeout(() => {
      const data = {
        exportedAt: new Date().toISOString(),
        sessionUser: sessionUser ? { name: sessionUser.name, number: sessionUser.number } : null,
        campaigns: campaignHistory,
        sessions: getSessions(),
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
    const sessions = getSessions();
    const activeIdx = sessions.findIndex(s => !s.logoutTime);
    if (activeIdx !== -1) {
      sessions[activeIdx].logoutTime = new Date().toISOString();
      saveSessions(sessions);
      setSessionList([...sessions]);
    }
    logout();
  }, [logout]);

  const formatDuration = (ms) => {
    if (ms <= 0) return '0m';
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

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
              {sessionUser?.avatar ? (
                <img src={sessionUser.avatar} alt="Profile" className="w-full h-full object-cover" />
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
            <Clock size={18} className="text-primary mx-auto mb-2" />
            <div className="text-lg font-bold font-mono">{formatDuration(sessionStats.longestMs)}</div>
            <div className="text-xs text-text-muted">Longest Session</div>
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

        {/* Session History Timeline */}
        <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
          <Clock size={18} className="text-primary" /> Session History
        </h2>
        <Card className="mb-8">
          <CardContent className="p-4 md:p-6">
            {sessionList.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-4">No session history recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {[...sessionList].reverse().map((s) => {
                  const loginTime = new Date(s.loginTime);
                  const isActive = !s.logoutTime;
                  const duration = isActive
                    ? Date.now() - loginTime.getTime()
                    : new Date(s.logoutTime).getTime() - loginTime.getTime();
                  return (
                    <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-surface">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          s.method === 'QR' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                        }`}>
                          {s.method === 'QR' ? <QrCode size={16} /> : <RotateCcw size={16} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{loginTime.toLocaleDateString()}</span>
                            <span className="text-xs text-text-muted font-mono">{loginTime.toLocaleTimeString()}</span>
                            {isActive && <Badge variant="success" className="text-[10px] px-1.5 py-0">Active Now</Badge>}
                          </div>
                          <span className="text-xs text-text-muted">
                            {s.method === 'QR' ? 'QR Scan' : 'Session Restore'} &middot; Duration: {formatDuration(duration)}
                          </span>
                        </div>
                      </div>
                      {s.logoutTime && (
                        <span className="text-xs text-text-muted shrink-0">
                          Ended: {new Date(s.logoutTime).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  );
                })}
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
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllHistory} className="bg-error hover:bg-error/90">Clear All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-error hover:text-error hover:bg-error/10 border-error/20 gap-2" disabled={clearSessionLoading}>
                  {clearSessionLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {clearSessionLoading ? 'Clearing...' : 'Clear Session History'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Session History?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove all session login/logout records. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearSessionHistory} className="bg-error hover:bg-error/90">Clear All</AlertDialogAction>
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
