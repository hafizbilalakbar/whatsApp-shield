import React, { useEffect, useMemo } from 'react';
import { X, BarChart3, MessageSquare, Users, Bot, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { useMessageAgent } from '../MessageAgentPage';

const CHART_COLORS = ['#00D97E', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const StatCard = ({ icon: Icon, label, value, change, changeType, color }) => (
  <div className="p-3 rounded-xl bg-background border border-border">
    <div className="flex items-center justify-between mb-2">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}>
        <Icon size={14} className="text-white" />
      </div>
      {change !== undefined && (
        <div className={cn("flex items-center gap-0.5 text-[10px] font-medium",
          changeType === 'up' ? 'text-success' : 'text-error'
        )}>
          {changeType === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {change}%
        </div>
      )}
    </div>
    <p className="text-xl font-bold text-text-primary">{value}</p>
    <p className="text-[10px] text-text-muted mt-0.5">{label}</p>
  </div>
);

const AnalyticsDashboard = ({ isOpen, onClose }) => {
  const { analytics, loadAnalytics } = useMessageAgent();

  useEffect(() => {
    if (isOpen) loadAnalytics();
  }, [isOpen, loadAnalytics]);

  const journeyData = useMemo(() => {
    if (!analytics?.journeyStats) return [];
    return Object.entries(analytics.journeyStats).map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value,
    }));
  }, [analytics]);

  if (!isOpen) return null;
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-text-primary">Analytics Dashboard</h2>
                <p className="text-xs text-text-secondary">Communication performance and insights</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {analytics ? (
            <div className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Users} label="Total Conversations" value={analytics.totalConversations} color="bg-primary" />
                <StatCard icon={MessageSquare} label="Total Messages" value={analytics.totalMessages} color="bg-info" />
                <StatCard icon={Bot} label="AI Responses" value={analytics.aiMessages} color="bg-success" />
                <StatCard icon={TrendingUp} label="Response Rate" value={`${analytics.responseRate}%`} color="bg-warning" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Daily Activity Chart */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold">Daily Activity (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.dailyStats || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} />
                          <YAxis stroke="var(--text-muted)" fontSize={11} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                            itemStyle={{ color: 'var(--text-primary)' }}
                          />
                          <Bar dataKey="messages" fill="#00D97E" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Journey Funnel */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold">Customer Journey Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {journeyData.length > 0 ? (
                      <div className="h-48 flex items-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={journeyData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={65}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {journeyData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                              itemStyle={{ color: 'var(--text-primary)' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-text-muted text-xs">
                        No journey data available
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {journeyData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                          <span className="text-text-secondary truncate">{item.name}</span>
                          <span className="font-mono text-text-muted ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Message Breakdown */}
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold">Message Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="p-2 rounded-lg bg-background border border-border text-center">
                      <p className="text-lg font-bold text-primary">{analytics.sentMessages}</p>
                      <p className="text-[10px] text-text-muted">Sent Messages</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border text-center">
                      <p className="text-lg font-bold text-success">{analytics.receivedMessages}</p>
                      <p className="text-[10px] text-text-muted">Received Messages</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border text-center">
                      <p className="text-lg font-bold text-info">{analytics.aiMessages}</p>
                      <p className="text-[10px] text-text-muted">AI Responses</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border text-center">
                      <p className="text-lg font-bold text-warning">{analytics.manualMessages}</p>
                      <p className="text-[10px] text-text-muted">Manual Responses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Provider Status */}
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold">AI Provider Status</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-background border border-border flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", analytics.aiProviderStatus?.primary === 'configured' ? 'bg-success' : 'bg-text-muted')} />
                      <div>
                        <p className="text-[11px] font-medium">Primary Provider</p>
                        <p className="text-[10px] text-text-muted capitalize">{analytics.aiProviderStatus?.primary || 'Not configured'}</p>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", analytics.aiProviderStatus?.backup1 === 'configured' ? 'bg-success' : 'bg-text-muted')} />
                      <div>
                        <p className="text-[11px] font-medium">Backup #1</p>
                        <p className="text-[10px] text-text-muted capitalize">{analytics.aiProviderStatus?.backup1 || 'Not configured'}</p>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", analytics.aiProviderStatus?.backup2 === 'configured' ? 'bg-success' : 'bg-text-muted')} />
                      <div>
                        <p className="text-[11px] font-medium">Backup #2</p>
                        <p className="text-[10px] text-text-muted capitalize">{analytics.aiProviderStatus?.backup2 || 'Not configured'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-text-muted text-xs">Loading analytics...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { AnalyticsDashboard };
