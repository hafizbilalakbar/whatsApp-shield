import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Lightbulb, Target, Clock, TrendingUp, AlertCircle, CheckCircle, MessageSquare, ArrowRight, X, Loader2, Sparkles, BarChart3 } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { useMessageAgent } from '../MessageAgentPage';

const ACTION_TYPE_CONFIG = {
  follow_up: { label: 'Follow Up', color: 'bg-primary' },
  close: { label: 'Close Deal', color: 'bg-success' },
  nurture: { label: 'Nurture', color: 'bg-info' },
  re_engage: { label: 'Re-engage', color: 'bg-warning' },
  escalate: { label: 'Escalate', color: 'bg-error' },
  custom: { label: 'Custom', color: 'bg-text-muted' },
};

const STAGE_COLORS = {
  new_lead: 'bg-info',
  contacted: 'bg-primary',
  qualified: 'bg-success',
  proposal: 'bg-warning',
  negotiation: 'bg-primary',
  closed_won: 'bg-success',
  closed_lost: 'bg-error',
};

const LEAD_STAGES = ['new_lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won'];

const getScoreColor = (score) => {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-info';
  if (score >= 40) return 'text-warning';
  return 'text-error';
};

const getScoreBg = (score) => {
  if (score >= 80) return 'bg-success';
  if (score >= 60) return 'bg-info';
  if (score >= 40) return 'bg-warning';
  return 'bg-error';
};

const RadialGauge = ({ value, size = 100, stroke = 6 }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--info)' : value >= 40 ? 'var(--warning)' : 'var(--error)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-xl font-bold", getScoreColor(value))}>{value}</span>
        <span className="text-[10px] text-text-muted">Score</span>
      </div>
    </div>
  );
};

const ProgressBar = ({ value, color = 'bg-primary' }) => (
  <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
    <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

const InsightCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="p-3 rounded-xl bg-background border border-border">
    <div className="flex items-center gap-1.5 mb-1.5">
      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", color)}>
        <Icon size={12} className="text-white" />
      </div>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
    </div>
    <p className="text-base font-bold text-text-primary">{value}</p>
    {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
  </div>
);

const ConversationIntelligence = ({ isOpen, onClose, conversationId }) => {
  const { activeConversation } = useMessageAgent();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [leadScoreData, setLeadScoreData] = useState(null);
  const [nextActionData, setNextActionData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);

  const fetchIntelligence = useCallback(async () => {
    if (!conversationId || !activeConversation?.messages?.length) return;
    setLoading(true);
    setError(null);
    try {
      const conversationHistory = activeConversation.messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text || m.content || '',
      }));

      const [leadRes, actionRes, summaryRes] = await Promise.allSettled([
        fetch('/api/message-agent/intelligence/lead-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, messages: conversationHistory }),
        }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/message-agent/intelligence/next-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, messages: conversationHistory }),
        }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/message-agent/intelligence/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, messages: conversationHistory }),
        }).then((r) => (r.ok ? r.json() : null)),
      ]);

      if (leadRes.status === 'fulfilled' && leadRes.value) setLeadScoreData(leadRes.value);
      if (actionRes.status === 'fulfilled' && actionRes.value) setNextActionData(actionRes.value);
      if (summaryRes.status === 'fulfilled' && summaryRes.value) setSummaryData(summaryRes.value);
    } catch (err) {
      setError(err.message || 'Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  }, [conversationId, activeConversation?.messages]);

  useEffect(() => {
    if (isOpen) fetchIntelligence();
  }, [isOpen, fetchIntelligence]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const leadScore = leadScoreData?.score || 0;
  const sentiment = leadScoreData?.sentiment || {};
  const engagement = leadScoreData?.engagement || {};
  const intent = leadScoreData?.intent || {};
  const leadStage = leadScoreData?.stage || 'new_lead';
  const stageIndex = LEAD_STAGES.indexOf(leadStage);
  const stageProgress = stageIndex >= 0 ? ((stageIndex + 1) / LEAD_STAGES.length) * 100 : 0;

  const radarData = sentiment?.radar || (
    sentiment.positive || sentiment.negative || sentiment.urgency || engagement.score || sentiment.trust || sentiment.interest
  ) ? [
    { metric: 'Sentiment +', value: sentiment.positive || 0 },
    { metric: 'Sentiment -', value: sentiment.negative || 0 },
    { metric: 'Urgency', value: sentiment.urgency || 0 },
    { metric: 'Engagement', value: engagement.score || 0 },
    { metric: 'Trust', value: sentiment.trust || 0 },
    { metric: 'Interest', value: sentiment.interest || 0 },
  ] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-text-primary">Conversation Intelligence</h2>
                <p className="text-xs text-text-secondary">AI-powered insights and recommendations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fetchIntelligence} disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              </Button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-background transition-colors">
                <X size={16} className="text-text-muted" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && !leadScoreData && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary mb-2" />
              <p className="text-xs text-text-secondary">Analyzing conversation...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs">
              <AlertCircle size={14} />
              <span>{error}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={fetchIntelligence}>Retry</Button>
            </div>
          )}

          {!loading && !error && (
            <Tabs defaultValue="insights" className="w-full">
              <TabsList className="w-full justify-start mb-3">
                <TabsTrigger value="insights" className="gap-1.5">
                  <Brain size={12} /> Insights
                </TabsTrigger>
                <TabsTrigger value="sentiment" className="gap-1.5">
                  <BarChart3 size={12} /> Sentiment
                </TabsTrigger>
                <TabsTrigger value="actions" className="gap-1.5">
                  <Target size={12} /> Next Actions
                </TabsTrigger>
                <TabsTrigger value="summary" className="gap-1.5">
                  <MessageSquare size={12} /> Summary
                </TabsTrigger>
              </TabsList>

              {/* INSIGHTS TAB */}
              <TabsContent value="insights" className="space-y-3 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="md:col-span-1 flex flex-col items-center p-3 rounded-xl bg-background border border-border">
                    <RadialGauge value={leadScore} />
                    <p className="mt-2 text-xs font-medium text-text-secondary">Lead Quality Score</p>
                    <Badge className={cn("mt-1.5", getScoreBg(leadScore), "text-white border-0")}>
                      {leadScore >= 80 ? 'Hot Lead' : leadScore >= 60 ? 'Warm Lead' : leadScore >= 40 ? 'Lukewarm' : 'Cold Lead'}
                    </Badge>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-text-secondary">Lead Stage</span>
                        <Badge className={cn(STAGE_COLORS[leadStage] || 'bg-text-muted', "text-white border-0 text-[10px]")}>
                          {leadStage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </div>
                      <ProgressBar value={stageProgress} color={STAGE_COLORS[leadStage] || 'bg-primary'} />
                      <div className="flex justify-between mt-1.5">
                        {LEAD_STAGES.map((s, i) => (
                          <span key={s} className={cn("text-[9px]", i <= stageIndex ? 'text-text-primary font-medium' : 'text-text-muted')}>
                            {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <InsightCard
                        icon={TrendingUp}
                        label="Sentiment"
                        value={`${sentiment.positive || 0}%`}
                        sub={`Positive / ${sentiment.neutral || 0}% Neutral`}
                        color="bg-success"
                      />
                      <InsightCard
                        icon={MessageSquare}
                        label="Engagement"
                        value={`${engagement.score || 0}%`}
                        sub={engagement.level || 'Unknown'}
                        color="bg-info"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div className="p-2.5 rounded-xl bg-background border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target size={10} className="text-primary" />
                      <span className="text-[11px] font-medium text-text-secondary">Intent</span>
                    </div>
                    <p className="text-xs font-bold text-text-primary">{intent.primary || 'N/A'}</p>
                    {intent.confidence && (
                      <p className="text-[10px] text-text-muted">{intent.confidence}% confidence</p>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock size={10} className="text-warning" />
                      <span className="text-[11px] font-medium text-text-secondary">Response Time</span>
                    </div>
                    <p className="text-xs font-bold text-text-primary">{engagement.avgResponseTime || 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertCircle size={10} className="text-error" />
                      <span className="text-[11px] font-medium text-text-secondary">Negative</span>
                    </div>
                    <p className="text-xs font-bold text-error">{sentiment.negative || 0}%</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-background border border-border">
                  <p className="text-xs font-medium text-text-secondary mb-2">Sentiment Breakdown</p>
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                    <div className="bg-success rounded-l-full" style={{ width: `${sentiment.positive || 0}%` }} />
                    <div className="bg-info" style={{ width: `${sentiment.neutral || 0}%` }} />
                    <div className="bg-error rounded-r-full" style={{ width: `${sentiment.negative || 0}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-text-muted">
                    <span>Positive {sentiment.positive || 0}%</span>
                    <span>Neutral {sentiment.neutral || 0}%</span>
                    <span>Negative {sentiment.negative || 0}%</span>
                  </div>
                </div>
              </TabsContent>

              {/* SENTIMENT TAB */}
              <TabsContent value="sentiment" className="space-y-3 mt-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold">Sentiment Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {radarData ? (
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="var(--border)" />
                            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                            <Radar name="Sentiment" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-36 flex items-center justify-center text-text-muted">
                        <p className="text-xs">No sentiment data available yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {sentiment.trends && sentiment.trends.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold">Sentiment Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {sentiment.trends.map((trend, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[11px] text-text-muted w-16 shrink-0">{trend.label || trend.time}</span>
                            <div className="flex-1">
                              <ProgressBar
                                value={trend.value}
                                color={trend.value >= 60 ? 'bg-success' : trend.value >= 40 ? 'bg-info' : 'bg-error'}
                              />
                            </div>
                            <span className={cn("text-xs font-medium w-8 text-right", trend.value >= 60 ? 'text-success' : trend.value >= 40 ? 'text-info' : 'text-error')}>
                              {trend.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {sentiment.keyPhrases && sentiment.keyPhrases.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold">Key Phrases Detected</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {sentiment.keyPhrases.map((phrase, i) => (
                          <Badge key={i} variant="outline" className="text-[11px]">
                            {phrase}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* NEXT ACTIONS TAB */}
              <TabsContent value="actions" className="space-y-3 mt-0">
                {nextActionData?.recommended && (
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                          <Sparkles size={12} className="text-primary" />
                          Recommended Action
                        </CardTitle>
                        {nextActionData.recommended.priority && (
                          <Badge className={cn(
                            nextActionData.recommended.priority === 'high' ? 'bg-error' :
                            nextActionData.recommended.priority === 'medium' ? 'bg-warning' : 'bg-info',
                            "text-white border-0"
                          )}>
                            {nextActionData.recommended.priority} priority
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div className="flex items-center gap-1.5">
                        {ACTION_TYPE_CONFIG[nextActionData.recommended.type] && (
                          <Badge className={cn(ACTION_TYPE_CONFIG[nextActionData.recommended.type].color, "text-white border-0")}>
                            {ACTION_TYPE_CONFIG[nextActionData.recommended.type].label}
                          </Badge>
                        )}
                        {nextActionData.recommended.confidence !== undefined && (
                          <span className="text-[11px] text-text-muted">
                            {nextActionData.recommended.confidence}% confidence
                          </span>
                        )}
                      </div>
                      {nextActionData.recommended.reason && (
                        <div className="p-3 rounded-lg bg-background border border-border">
                          <div className="flex items-start gap-2">
                            <Lightbulb size={12} className="text-warning mt-0.5 shrink-0" />
                            <p className="text-xs text-text-secondary">{nextActionData.recommended.reason}</p>
                          </div>
                        </div>
                      )}
                      {nextActionData.recommended.timing && (
                        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                          <Clock size={10} />
                          <span>Best time: {nextActionData.recommended.timing}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {nextActionData?.alternatives && nextActionData.alternatives.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold">Alternative Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1.5">
                      {nextActionData.alternatives.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border hover:border-border/60 transition-colors">
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            ACTION_TYPE_CONFIG[action.type]?.color || 'bg-text-muted'
                          )}>
                            <ArrowRight size={12} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-text-primary">
                                {ACTION_TYPE_CONFIG[action.type]?.label || action.type}
                              </span>
                              {action.confidence !== undefined && (
                                <span className="text-[10px] text-text-muted">{action.confidence}%</span>
                              )}
                            </div>
                            {action.reason && (
                              <p className="text-[11px] text-text-secondary truncate">{action.reason}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {!nextActionData && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Target size={28} className="text-text-muted mb-2" />
                    <p className="text-xs text-text-secondary">No action recommendations available</p>
                    <p className="text-[11px] text-text-muted mt-1">More conversation data needed</p>
                  </div>
                )}
              </TabsContent>

              {/* SUMMARY TAB */}
              <TabsContent value="summary" className="space-y-3 mt-0">
                {summaryData?.summary && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2">
                        <MessageSquare size={12} className="text-primary" />
                        Conversation Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{summaryData.summary}</p>
                    </CardContent>
                  </Card>
                )}

                {summaryData?.keyTopics && summaryData.keyTopics.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold">Key Topics Discussed</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {summaryData.keyTopics.map((topic, i) => (
                          <Badge key={i} variant="outline" className="text-[11px] gap-1">
                            <CheckCircle size={8} />
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {summaryData?.optimalSendTime && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2">
                        <Clock size={12} className="text-info" />
                        Optimal Send Time
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-text-secondary">{summaryData.optimalSendTime}</p>
                      {summaryData.sendTimeReason && (
                        <p className="text-[11px] text-text-muted mt-1">{summaryData.sendTimeReason}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {summaryData?.progressionHistory && summaryData.progressionHistory.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold">Lead Progression</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="relative">
                        <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                        <div className="space-y-2">
                          {summaryData.progressionHistory.map((step, i) => (
                            <div key={i} className="flex items-start gap-2 relative">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-surface",
                                i === summaryData.progressionHistory.length - 1 ? 'bg-primary' : 'bg-background'
                              )}>
                                {i === summaryData.progressionHistory.length - 1 ? (
                                  <CheckCircle size={12} className="text-white" />
                                ) : (
                                  <span className="text-[10px] font-bold text-text-muted">{i + 1}</span>
                                )}
                              </div>
                              <div className="flex-1 pb-1">
                                <p className="text-xs font-medium text-text-primary">{step.stage || step.label}</p>
                                {step.note && <p className="text-[11px] text-text-muted mt-0.5">{step.note}</p>}
                                {step.date && <p className="text-[10px] text-text-muted mt-0.5">{step.date}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!summaryData && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MessageSquare size={28} className="text-text-muted mb-2" />
                    <p className="text-xs text-text-secondary">No summary available</p>
                    <p className="text-[11px] text-text-muted mt-1">Insufficient conversation data</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationIntelligence;
