import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, Activity, Bell, RefreshCw, X, Loader2, ArrowUpRight, ArrowDownRight, Minus, AlertCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { useMessageAgent } from '../MessageAgentPage';

const HEALTH_COLORS = {
  excellent: '#00D97E',
  good: '#00D97E',
  fair: '#F59E0B',
  poor: '#EF4444',
  critical: '#EF4444',
};

const PRIORITY_COLORS = {
  critical: { bg: 'bg-error/10', border: 'border-error/20', text: 'text-error', badge: 'destructive' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-500', badge: 'warning' },
  medium: { bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', badge: 'warning' },
  low: { bg: 'bg-success/10', border: 'border-success/20', text: 'text-success', badge: 'success' },
};

const StatCard = ({ icon: Icon, label, value, trend, trendValue, color }) => (
  <div className="p-3 rounded-xl bg-background border border-border">
    <div className="flex items-center justify-between mb-2">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
        <Icon size={14} className="text-white" />
      </div>
      {trend && (
        <div className={cn("flex items-center gap-0.5 text-[11px] font-medium",
          trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-text-muted'
        )}>
          {trend === 'up' ? <ArrowUpRight size={10} /> : trend === 'down' ? <ArrowDownRight size={10} /> : <Minus size={10} />}
          {trendValue || ''}
        </div>
      )}
    </div>
    <p className="text-xl font-bold text-text-primary">{value}</p>
    <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
  </div>
);

const ScoreGauge = ({ score }) => {
  const getColor = (s) => {
    if (s >= 70) return HEALTH_COLORS.excellent;
    if (s >= 40) return HEALTH_COLORS.fair;
    return HEALTH_COLORS.poor;
  };

  const getLabel = (s) => {
    if (s >= 80) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 40) return 'Fair';
    if (s >= 20) return 'Poor';
    return 'Critical';
  };

  const color = getColor(score);
  const label = getLabel(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="var(--border)"
            strokeWidth="6"
          />
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-[11px] text-text-muted">out of 100</span>
        </div>
      </div>
      <Badge
        variant={score >= 70 ? 'success' : score >= 40 ? 'warning' : 'destructive'}
        className="mt-2"
      >
        {label}
      </Badge>
    </div>
  );
};

const HealthFactorBar = ({ label, value, max = 100, color }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-xs font-mono text-text-muted">{value}/{max}</span>
    </div>
    <div className="h-1.5 rounded-full bg-border overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      />
    </div>
  </div>
);

const AccountHealthDashboard = ({ isOpen, onClose }) => {
  const { safetySettings } = useMessageAgent();
  const [healthData, setHealthData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [scanPhase, setScanPhase] = useState(null);

  const fetchAllData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
      setScanPhase('scanning');
      await new Promise(r => setTimeout(r, 600));
      setScanPhase('analyzing');
      await new Promise(r => setTimeout(r, 500));
      setScanPhase('optimizing');
      await new Promise(r => setTimeout(r, 400));
    } else {
      setIsLoading(true);
    }

    try {
      const [healthRes, recsRes, schedRes, reportRes] = await Promise.allSettled([
        fetch('/api/message-agent/health'),
        fetch('/api/message-agent/health/recommendations'),
        fetch('/api/message-agent/health/schedule'),
        fetch('/api/message-agent/health/daily-report'),
      ]);

      if (healthRes.status === 'fulfilled') {
        const data = await healthRes.value.json();
        if (data.success) setHealthData(data.health || data);
      }
      if (recsRes.status === 'fulfilled') {
        const data = await recsRes.value.json();
        if (data.success) setRecommendations(data.recommendations || []);
      }
      if (schedRes.status === 'fulfilled') {
        const data = await schedRes.value.json();
        if (data.success) setSchedule(data.schedule || data);
      }
      if (reportRes.status === 'fulfilled') {
        const data = await reportRes.value.json();
        if (data.success) setDailyReport(data.report || data);
      }

      if (showRefresh) {
        setScanPhase('complete');
        await new Promise(r => setTimeout(r, 800));
        setScanPhase(null);
      }
    } catch (err) {
      console.error('Error fetching health data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      if (!showRefresh) setScanPhase(null);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchAllData();
  }, [isOpen, fetchAllData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [onClose]);

  if (!isOpen) return null;

  const score = healthData?.score ?? 0;
  const stats = healthData?.stats || {};
  const factors = healthData?.factors || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-success/10 flex items-center justify-center">
                <Heart size={16} className="text-success" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-text-primary">Account Health</h2>
                <p className="text-xs text-text-secondary">Monitor your account safety and performance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAllData(true)}
                disabled={isRefreshing}
                className="gap-1.5 text-xs"
              >
                <RefreshCw size={12} className={cn(isRefreshing && "animate-spin")} />
                Refresh
              </Button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-background transition-colors">
                <X size={16} className="text-text-muted" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-xs text-text-muted">Loading health data...</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="daily-report">Daily Report</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Score Gauge */}
                  <Card className="md:col-span-1">
                    <CardContent className="pt-4 flex justify-center">
                      <ScoreGauge score={score} />
                    </CardContent>
                  </Card>

                  {/* Stats */}
                  <div className="md:col-span-2 grid grid-cols-2 gap-3">
                    <StatCard
                      icon={Activity}
                      label="Messages Today"
                      value={stats.messages_today ?? 0}
                      trend={stats.messages_today_trend}
                      trendValue={stats.messages_today_change}
                      color="bg-primary"
                    />
                    <StatCard
                      icon={TrendingUp}
                      label="Messages This Week"
                      value={stats.messages_this_week ?? 0}
                      trend={stats.messages_this_week_trend}
                      trendValue={stats.messages_this_week_change}
                      color="bg-info"
                    />
                    <StatCard
                      icon={Heart}
                      label="Conversations Today"
                      value={stats.conversations_today ?? 0}
                      trend={stats.conversations_today_trend}
                      trendValue={stats.conversations_today_change}
                      color="bg-success"
                    />
                    <StatCard
                      icon={Clock}
                      label="Active Conversations"
                      value={stats.active_conversations ?? 0}
                      trend={stats.active_conversations_trend}
                      trendValue={stats.active_conversations_change}
                      color="bg-warning"
                    />
                  </div>
                </div>

                {/* Health Factors */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Shield size={14} className="text-primary" />
                      Health Factors Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {factors.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {factors.map((factor, idx) => (
                          <HealthFactorBar
                            key={idx}
                            label={factor.label || factor.name}
                            value={factor.value ?? factor.score ?? 0}
                            max={factor.max ?? 100}
                            color={
                              (factor.value ?? factor.score ?? 0) >= 70
                                ? 'bg-success'
                                : (factor.value ?? factor.score ?? 0) >= 40
                                ? 'bg-warning'
                                : 'bg-error'
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-text-muted">
                        <p className="text-xs">No health factors available yet</p>
                        <p className="text-[11px] mt-1">Data will appear after sending messages</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Activity Trend */}
                {healthData?.trend && healthData.trend.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold">Health Trend (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={healthData.trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="score"
                              stroke="#00D97E"
                              strokeWidth={2}
                              dot={{ fill: '#00D97E', r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", healthData?.status === 'healthy' ? 'bg-success' : healthData?.status === 'warning' ? 'bg-warning' : 'bg-error')} />
                    <div>
                      <p className="text-xs font-medium text-text-primary">Account Status</p>
                      <p className="text-[11px] text-text-muted capitalize">{healthData?.status || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", safetySettings?.antiBan?.enabled ? 'bg-success' : 'bg-error')} />
                    <div>
                      <p className="text-xs font-medium text-text-primary">Anti-Ban Protection</p>
                      <p className="text-[11px] text-text-muted">{safetySettings?.antiBan?.enabled ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", safetySettings?.rateLimiting?.enabled ? 'bg-success' : 'bg-warning')} />
                    <div>
                      <p className="text-xs font-medium text-text-primary">Rate Limiting</p>
                      <p className="text-[11px] text-text-muted">{safetySettings?.rateLimiting?.enabled ? `${safetySettings.rateLimiting.maxPerDay}/day limit` : 'Disabled'}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Recommendations Tab */}
              <TabsContent value="recommendations" className="space-y-4">
                {recommendations.length > 0 ? (
                  recommendations.map((rec, idx) => {
                    const priority = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.medium;
                    return (
                      <Card key={idx} className={cn("border", priority.border)}>
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", priority.bg)}>
                              {rec.priority === 'critical' ? (
                                <AlertCircle size={16} className={priority.text} />
                              ) : rec.priority === 'high' ? (
                                <AlertTriangle size={16} className={priority.text} />
                              ) : rec.priority === 'medium' ? (
                                <Info size={16} className={priority.text} />
                              ) : (
                                <CheckCircle size={16} className={priority.text} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-xs font-semibold text-text-primary">{rec.title || rec.category}</h4>
                                <Badge variant={priority.badge} className="text-[10px]">
                                  {rec.priority}
                                </Badge>
                                {rec.category && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {rec.category}
                                  </Badge>
                                )}
                              </div>
                              {rec.issue && (
                                <p className="text-[11px] text-text-secondary mb-2">{rec.issue}</p>
                              )}
                              {rec.description && !rec.issue && (
                                <p className="text-[11px] text-text-secondary mb-2">{rec.description}</p>
                              )}
                              {rec.action && (
                                <div className="p-2 rounded-lg bg-background border border-border">
                                  <p className="text-[11px] font-medium text-text-primary mb-1">Suggested Action</p>
                                  <p className="text-[11px] text-text-secondary">{rec.action}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mb-3">
                          <CheckCircle size={20} className="text-success" />
                        </div>
                        <h3 className="text-xs font-semibold text-text-primary mb-1">All Clear</h3>
                        <p className="text-[11px] text-text-muted max-w-sm">
                          No recommendations at this time. Your account health looks good!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="space-y-4">
                {/* Optimal Hours Grid */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Clock size={14} className="text-primary" />
                      Optimal Messaging Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {schedule?.optimalHours ? (
                      <div className="grid grid-cols-6 md:grid-cols-12 gap-1.5">
                        {schedule.optimalHours.map((hour, idx) => {
                          const intensity = hour.score ?? hour.intensity ?? 0;
                          const opacity = Math.max(0.15, intensity / 100);
                          return (
                            <div
                              key={idx}
                              className="aspect-square rounded-lg flex flex-col items-center justify-center text-center"
                              style={{
                                backgroundColor: `rgba(0, 217, 126, ${opacity})`,
                              }}
                              title={`${hour.hour ?? idx}:00 - Score: ${intensity}`}
                            >
                              <span className="text-[10px] font-medium text-text-primary">{hour.hour ?? `${idx}`}</span>
                              <span className="text-[8px] text-text-muted">{intensity}%</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-text-muted">
                        <p className="text-xs">No schedule data available</p>
                        <p className="text-[11px] mt-1">Messaging schedule will appear after activity</p>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(0, 217, 126, 0.15)' }} />
                        <span className="text-[10px] text-text-muted">Low</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(0, 217, 126, 0.45)' }} />
                        <span className="text-[10px] text-text-muted">Optimal</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(0, 217, 126, 0.8)' }} />
                        <span className="text-[10px] text-text-muted">Peak</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Daily Limits */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2">
                        <Bell size={14} className="text-warning" />
                        Daily Limits
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                          <div>
                            <p className="text-xs font-medium text-text-primary">Messages per Day</p>
                            <p className="text-[11px] text-text-muted">Recommended safe limit</p>
                          </div>
                          <p className="text-base font-bold text-text-primary">
                            {schedule?.dailyLimit ?? safetySettings?.rateLimiting?.maxPerDay ?? 200}
                          </p>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                          <div>
                            <p className="text-xs font-medium text-text-primary">Messages per Hour</p>
                            <p className="text-[11px] text-text-muted">Burst limit</p>
                          </div>
                          <p className="text-base font-bold text-text-primary">
                            {schedule?.hourlyLimit ?? safetySettings?.rateLimiting?.maxPerHour ?? 30}
                          </p>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                          <div>
                            <p className="text-xs font-medium text-text-primary">Cooldown After Burst</p>
                            <p className="text-[11px] text-text-muted">Pause duration</p>
                          </div>
                          <p className="text-base font-bold text-text-primary">
                            {safetySettings?.rateLimiting?.cooldownAfterBurst?.pauseMinutes ?? 5}m
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Current Status */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2">
                        <Activity size={14} className="text-info" />
                        Current Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border">
                          <div className={cn("w-3 h-3 rounded-full", schedule?.status === 'active' ? 'bg-success' : schedule?.status === 'paused' ? 'bg-warning' : 'bg-text-muted')} />
                          <div>
                            <p className="text-xs font-medium text-text-primary">Messaging Status</p>
                            <p className="text-[11px] text-text-muted capitalize">{schedule?.status || 'Active'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border">
                          <div className={cn("w-3 h-3 rounded-full", schedule?.inBusinessHours ? 'bg-success' : 'bg-text-muted')} />
                          <div>
                            <p className="text-xs font-medium text-text-primary">Business Hours</p>
                            <p className="text-[11px] text-text-muted">
                              {schedule?.inBusinessHours ? 'Within hours' : 'Outside hours'}
                              {schedule?.businessHours && ` (${schedule.businessHours.start}-${schedule.businessHours.end})`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border">
                          <div className={cn("w-3 h-3 rounded-full", schedule?.underLimit ? 'bg-success' : 'bg-error')} />
                          <div>
                            <p className="text-xs font-medium text-text-primary">Daily Quota</p>
                            <p className="text-[11px] text-text-muted">
                              {schedule?.messagesSent ?? 0} / {schedule?.dailyLimit ?? safetySettings?.rateLimiting?.maxPerDay ?? 200} sent today
                            </p>
                          </div>
                        </div>
                        {safetySettings?.sessionSafety?.businessHoursOnly && (
                          <div className="p-2 rounded-lg bg-info/10 border border-info/20">
                            <div className="flex items-center gap-2">
                              <Info size={12} className="text-info" />
                              <p className="text-[11px] text-info">Business hours mode is enabled. Messages will only be sent during configured hours.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Daily Report Tab */}
              <TabsContent value="daily-report" className="space-y-4">
                {dailyReport ? (
                  <>
                    {/* Report Header */}
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="text-xs font-semibold text-text-primary">Daily Health Report</h3>
                            <p className="text-[11px] text-text-muted">{dailyReport.date || new Date().toLocaleDateString()}</p>
                          </div>
                          <Badge variant={dailyReport.health?.score >= 70 ? 'success' : dailyReport.health?.score >= 40 ? 'warning' : 'destructive'}>
                            {dailyReport.health?.score >= 70 ? 'Healthy' : dailyReport.health?.score >= 40 ? 'Warning' : 'Critical'}
                          </Badge>
                        </div>
                        {dailyReport.summary && (
                          <p className="text-[11px] text-text-secondary leading-relaxed">
                            {dailyReport.summary.messagesSentToday || 0} messages sent, {dailyReport.summary.messagesReceivedToday || 0} received today.
                            {dailyReport.summary.volumeChangeFromYesterday !== 0 && ` Volume ${dailyReport.summary.volumeChangeFromYesterday > 0 ? 'up' : 'down'} ${Math.abs(dailyReport.summary.volumeChangeFromYesterday)}% from yesterday.`}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Report Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-background border border-border text-center">
                        <p className="text-lg font-bold text-primary">{dailyReport.summary?.messagesSentToday ?? 0}</p>
                        <p className="text-[11px] text-text-muted">Messages Sent</p>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border text-center">
                        <p className="text-lg font-bold text-success">{dailyReport.summary?.deliveryRateToday ?? 0}%</p>
                        <p className="text-[11px] text-text-muted">Delivery Rate</p>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border text-center">
                        <p className="text-lg font-bold text-info">{dailyReport.summary?.replyRateToday ?? 0}%</p>
                        <p className="text-[11px] text-text-muted">Reply Rate</p>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border text-center">
                        <p className="text-lg font-bold text-warning">{dailyReport.summary?.uniqueContactsMessaged ?? 0}</p>
                        <p className="text-[11px] text-text-muted">Contacts Messaged</p>
                      </div>
                    </div>

                    {/* Recommendations */}
                    {dailyReport.recommendations && dailyReport.recommendations.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold">Recommendations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {dailyReport.recommendations.map((rec, idx) => (
                              <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-background border border-border">
                                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                                  rec.priority === 'critical' ? 'bg-error' :
                                  rec.priority === 'high' ? 'bg-warning' :
                                  rec.priority === 'medium' ? 'bg-info' : 'bg-success'
                                )} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-text-primary">{rec.issue || rec.message || rec.action}</p>
                                  {rec.action && rec.action !== rec.issue && (
                                    <p className="text-[11px] text-text-muted mt-0.5">{rec.action}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Journey Breakdown */}
                    {dailyReport.journeyBreakdown && Object.keys(dailyReport.journeyBreakdown).length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold">Contact Pipeline</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-3">
                            {Object.entries(dailyReport.journeyBreakdown).map(([stage, count]) => (
                              <div key={stage} className="p-2 rounded-lg bg-background border border-border text-center">
                                <p className="text-base font-bold text-text-primary">{count}</p>
                                <p className="text-[10px] text-text-muted capitalize">{stage.replace(/_/g, ' ')}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center mb-3">
                          <Clock size={20} className="text-text-muted" />
                        </div>
                        <h3 className="text-xs font-semibold text-text-primary mb-1">No Report Available</h3>
                        <p className="text-[11px] text-text-muted max-w-sm">
                          Daily reports are generated at the end of each day. Check back later for your account health summary.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AccountHealthDashboard;
