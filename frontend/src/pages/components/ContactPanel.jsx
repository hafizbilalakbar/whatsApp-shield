import React, { useState, useEffect } from 'react';
import { Phone, MapPin, Clock, Edit, Star, Archive, MessageSquare, TrendingUp, Briefcase, FileText, Tag, X, Plus, Check, Save, Brain, Lightbulb, Loader2, Target, Sparkles, ShieldBan, ShieldCheck } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { Input } from '../../components/ui/Input';
import { useMessageAgent } from '../MessageAgentPage';
import { ContactAvatar } from './ContactAvatar';

const JOURNEY_STAGES = [
  { key: 'new_lead', label: 'New Lead', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { key: 'contacted', label: 'Contacted', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { key: 'interested', label: 'Interested', color: 'bg-success/10 text-success border-success/30' },
  { key: 'negotiation', label: 'In Negotiation', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { key: 'converted', label: 'Converted', color: 'bg-success/20 text-success border-success/30' },
  { key: 'closed', label: 'Closed', color: 'bg-text-muted/10 text-text-muted border-border' },
];

const ContactPanel = ({ onClose }) => {
  const { activeConversation, updateConversation, checkCompliance, blockContact, unblockContact } = useMessageAgent();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editedTags, setEditedTags] = useState([]);
  const [isEditingCrm, setIsEditingCrm] = useState(false);
  const [crmData, setCrmData] = useState({});

  const [complianceInfo, setComplianceInfo] = useState({ allowed: true, isBlocked: false, isSuppressed: false, checking: false });
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    if (activeConversation) {
      setEditedNotes(activeConversation.notes || '');
      setEditedTags(activeConversation.tags || []);
      setCrmData(activeConversation.crm || {});
    }
  }, [activeConversation?.id, activeConversation?.notes, activeConversation?.tags, activeConversation?.crm]);

  useEffect(() => {
    if (activeConversation && activeTab === 'profile') {
      fetchAiInsights();
    }
  }, [activeConversation?.id, activeTab]);

  useEffect(() => {
    if (!activeConversation?.id) return;
    setComplianceInfo(prev => ({ ...prev, checking: true }));
    checkCompliance(activeConversation.id).then(data => {
      setComplianceInfo({
        allowed: data.allowed !== false,
        isBlocked: data.isBlocked === true,
        isSuppressed: data.isSuppressed === true,
        reason: data.reason || null,
        checking: false
      });
    }).catch(() => setComplianceInfo(prev => ({ ...prev, allowed: true, checking: false })));
  }, [activeConversation?.id, checkCompliance]);

  const fetchAiInsights = async () => {
    if (!activeConversation || loadingInsights) return;
    setLoadingInsights(true);
    try {
      const [scoreRes, actionRes] = await Promise.all([
        fetch('/api/message-agent/intelligence/lead-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationHistory: (activeConversation.messages || []).slice(-20),
            contact: activeConversation.contact
          })
        }),
        fetch('/api/message-agent/intelligence/next-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationState: {
              stage: activeConversation.journey || 'contacted',
              messageCount: (activeConversation.messages || []).length,
              lastMessage: activeConversation.messages?.slice(-1)[0]?.text || '',
              sentiment: 'neutral'
            }
          })
        })
      ]);
      const scoreData = await scoreRes.json();
      const actionData = await actionRes.json();
      setAiInsights({
        score: scoreData.success ? scoreData.score : null,
        nextAction: actionData.success ? actionData.action : null
      });
    } catch (err) {
    }
    setLoadingInsights(false);
  };

  if (!activeConversation) {
    return (
      <div className="w-full md:w-72 shrink-0 border-l border-border bg-surface flex items-center justify-center">
        <p className="text-text-muted text-sm">Select a conversation</p>
      </div>
    );
  }

  const handleSaveNotes = async () => {
    await updateConversation(activeConversation.id, { notes: editedNotes });
    setIsEditingNotes(false);
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    const tags = [...editedTags, newTag.trim()];
    setEditedTags(tags);
    setNewTag('');
    await updateConversation(activeConversation.id, { tags });
  };

  const handleRemoveTag = async (tagToRemove) => {
    const tags = editedTags.filter(t => t !== tagToRemove);
    setEditedTags(tags);
    await updateConversation(activeConversation.id, { tags });
  };

  const handleJourneyChange = async (journey) => {
    await updateConversation(activeConversation.id, { journey });
  };

  const handleSaveCrm = async () => {
    await updateConversation(activeConversation.id, { crm: crmData });
    setIsEditingCrm(false);
  };

  const handleToggleStar = async () => {
    await updateConversation(activeConversation.id, { starred: !activeConversation.starred });
  };

  const handleToggleArchive = async () => {
    await updateConversation(activeConversation.id, { archived: !activeConversation.archived });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '---';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const messages = activeConversation.messages || [];
  const sentMessages = messages.filter(m => m.from === 'me' || m.from === 'ai');
  const receivedMessages = messages.filter(m => m.from === 'them');
  const aiMessages = messages.filter(m => m.from === 'ai');

  return (
    <div className="w-full md:w-72 shrink-0 border-l border-border bg-surface flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between mb-3">
          <ContactAvatar contact={activeConversation.contact} size="md" />
          <div className="flex items-center gap-0.5">
            <button 
              onClick={handleToggleStar}
              className={cn("p-1.5 rounded-lg transition-colors", 
                activeConversation.starred ? "text-yellow-500 bg-yellow-500/10" : "text-text-muted hover:text-yellow-500 hover:bg-yellow-500/10"
              )}
              title={activeConversation.starred ? "Unstar" : "Star"}
            >
              <Star size={14} className={activeConversation.starred ? "fill-current" : ""} />
            </button>
            <button 
              onClick={handleToggleArchive}
              className={cn("p-1.5 rounded-lg transition-colors", 
                activeConversation.archived ? "text-warning bg-warning/10" : "text-text-muted hover:text-warning hover:bg-warning/10"
              )}
              title={activeConversation.archived ? "Unarchive" : "Archive"}
            >
              <Archive size={14} />
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden"
                title="Close"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        
        <h2 className="text-base font-display font-semibold text-text-primary mb-0.5 truncate">{activeConversation.contact.name}</h2>
        <p className="text-text-secondary font-mono text-xs mb-2">{activeConversation.contact.phone}</p>
        
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin size={12} className="text-text-muted shrink-0" />
          <span className="text-xs text-text-secondary truncate">{activeConversation.contact.country}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Badge variant={activeConversation.contact.exists ? 'success' : 'warning'} className="text-[10px]">
            {activeConversation.contact.exists ? 'WhatsApp' : 'Not on WhatsApp'}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {activeConversation.mode === 'ai' ? 'AI Mode' : 'Manual Mode'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 mx-3 mb-1.5 mt-1.5">
          <TabsTrigger value="profile" className="px-2 py-1 text-[11px]">Profile</TabsTrigger>
          <TabsTrigger value="crm" className="px-2 py-1 text-[11px]">CRM</TabsTrigger>
          <TabsTrigger value="notes" className="px-2 py-1 text-[11px]">Notes</TabsTrigger>
          <TabsTrigger value="stats" className="px-2 py-1 text-[11px]">Stats</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-3 mt-2">
            {/* Journey Stage */}
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-primary" />
                  Customer Journey
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-1">
                  {JOURNEY_STAGES.map(stage => (
                    <button
                      key={stage.key}
                      onClick={() => handleJourneyChange(stage.key)}
                      className={cn(
                        "px-1.5 py-1 rounded text-[10px] font-medium border transition-all text-left",
                        activeConversation.journey === stage.key 
                          ? stage.color + " ring-1 ring-primary/30" 
                          : "bg-background border-border text-text-muted hover:bg-surface"
                      )}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Brain size={12} className="text-primary" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {loadingInsights ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    <span className="text-[11px] text-text-muted ml-2">Analyzing...</span>
                  </div>
                ) : aiInsights ? (
                  <>
                    {aiInsights.score && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">Lead Quality</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-14 h-1 rounded-full bg-background overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all",
                                aiInsights.score.overall >= 70 ? 'bg-success' :
                                aiInsights.score.overall >= 40 ? 'bg-warning' : 'bg-error'
                              )}
                              style={{ width: `${aiInsights.score.overall || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium">{aiInsights.score.overall || 0}</span>
                        </div>
                      </div>
                    )}
                    {aiInsights.nextAction && (
                      <div className="p-1.5 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Target size={9} className="text-primary" />
                          <span className="text-[9px] font-medium text-primary">Recommended Action</span>
                        </div>
                        <p className="text-[11px] text-text-secondary">{aiInsights.nextAction.reason || aiInsights.nextAction.action || 'Follow up'}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-text-muted text-center py-1.5">No insights available</p>
                )}
              </CardContent>
            </Card>

            {/* About */}
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText size={12} className="text-primary" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-text-secondary leading-relaxed">
                  {activeConversation.contact.about || 'No about information available.'}
                </p>
              </CardContent>
            </Card>

            {/* Compliance */}
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <ShieldBan size={12} className={complianceInfo.allowed ? 'text-text-muted' : 'text-error'} />
                  Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {complianceInfo.checking ? (
                  <div className="flex items-center gap-1.5 py-1.5">
                    <Loader2 size={10} className="animate-spin text-text-muted" />
                    <span className="text-[11px] text-text-muted">Checking...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">Status</span>
                      <Badge variant={complianceInfo.allowed ? 'success' : 'destructive'} className="text-[9px]">
                        {complianceInfo.isBlocked ? 'Blocked' : complianceInfo.isSuppressed ? 'Opted Out' : 'Active'}
                      </Badge>
                    </div>
                    {!complianceInfo.allowed && (
                      <div className="p-1.5 rounded-lg bg-error/5 border border-error/20">
                        <p className="text-[10px] text-error/90">
                          {complianceInfo.isBlocked
                            ? 'This contact has been blocked and cannot receive messages.'
                            : 'This contact has opted out from receiving communications.'}
                        </p>
                        {complianceInfo.isBlocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-6 px-1.5 text-[11px] text-error hover:bg-error/10"
                            onClick={async () => {
                              await unblockContact(activeConversation.id);
                              setComplianceInfo({ allowed: true, isBlocked: false, isSuppressed: false, checking: false });
                            }}
                          >
                            <ShieldCheck size={10} className="mr-0.5" />
                            Unblock
                          </Button>
                        )}
                      </div>
                    )}
                    {complianceInfo.allowed && !complianceInfo.checking && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-6 text-[11px] text-error hover:bg-error/10"
                        onClick={async () => {
                          await blockContact(activeConversation.id, 'Manual block from contact panel');
                          setComplianceInfo({ allowed: false, isBlocked: true, isSuppressed: false, reason: 'Manual block', checking: false });
                        }}
                      >
                        <ShieldBan size={10} className="mr-0.5" />
                        Block
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Tag size={12} className="text-primary" />
                  Tags
                </CardTitle>
                <button 
                  onClick={() => setIsEditingTags(!isEditingTags)}
                  className="text-[11px] text-primary hover:text-primary/80"
                >
                  {isEditingTags ? 'Done' : 'Edit'}
                </button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {editedTags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-[10px] gap-0.5 pr-0.5">
                      {tag}
                      {isEditingTags && (
                        <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:text-error">
                          <X size={8} />
                        </button>
                      )}
                    </Badge>
                  ))}
                  {editedTags.length === 0 && (
                    <span className="text-[11px] text-text-muted">No tags</span>
                  )}
                </div>
                {isEditingTags && (
                  <div className="flex gap-1">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add tag..."
                      className="h-6 text-[11px] flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <Button size="icon" className="h-6 w-6 shrink-0" onClick={handleAddTag}>
                      <Plus size={10} />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Details */}
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock size={12} className="text-text-muted" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">WhatsApp Status</span>
                  <Badge variant={activeConversation.contact.exists ? 'success' : 'warning'} className="text-[9px]">
                    {activeConversation.contact.exists ? 'Registered' : 'Not Registered'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Added</span>
                  <span className="text-[10px] font-mono">{formatDate(activeConversation.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Last Active</span>
                  <span className="text-[10px] font-mono">{formatDate(activeConversation.lastMessage?.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Total Messages</span>
                  <span className="text-[10px] font-mono">{messages.length}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CRM Tab */}
          <TabsContent value="crm" className="space-y-3 mt-2">
            <Card>
              <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Briefcase size={12} className="text-success" />
                  Business Information
                </CardTitle>
                <button 
                  onClick={() => setIsEditingCrm(!isEditingCrm)}
                  className="text-[11px] text-primary hover:text-primary/80"
                >
                  {isEditingCrm ? 'Done' : 'Edit'}
                </button>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {isEditingCrm ? (
                  <>
                    <div>
                      <label className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5 block">Company</label>
                      <Input
                        value={crmData.company || ''}
                        onChange={(e) => setCrmData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="Company name"
                        className="h-7 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5 block">Position</label>
                      <Input
                        value={crmData.position || ''}
                        onChange={(e) => setCrmData(prev => ({ ...prev, position: e.target.value }))}
                        placeholder="Job title"
                        className="h-7 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5 block">Website</label>
                      <Input
                        value={crmData.website || ''}
                        onChange={(e) => setCrmData(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://example.com"
                        className="h-7 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5 block">Email</label>
                      <Input
                        value={crmData.email || ''}
                        onChange={(e) => setCrmData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@example.com"
                        className="h-7 text-[11px]"
                      />
                    </div>
                    <Button size="sm" onClick={handleSaveCrm} className="w-full">
                      <Save size={10} className="mr-1" />
                      Save CRM Data
                    </Button>
                  </>
                ) : (
                  <>
                    {crmData.company && (
                      <div>
                        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">Company</p>
                        <p className="text-xs font-medium">{crmData.company}</p>
                      </div>
                    )}
                    {crmData.position && (
                      <div>
                        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">Position</p>
                        <p className="text-xs font-medium">{crmData.position}</p>
                      </div>
                    )}
                    {crmData.website && (
                      <div>
                        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">Website</p>
                        <p className="text-xs font-mono text-primary hover:underline cursor-pointer">{crmData.website}</p>
                      </div>
                    )}
                    {crmData.email && (
                      <div>
                        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">Email</p>
                        <p className="text-xs font-mono text-primary">{crmData.email}</p>
                      </div>
                    )}
                    {!crmData.company && !crmData.position && !crmData.website && !crmData.email && (
                      <p className="text-xs text-text-muted text-center py-3">No CRM data yet. Click Edit to add business information.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Conversation Flow */}
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <MessageSquare size={12} className="text-primary" />
                  Conversation Flow
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {JOURNEY_STAGES.map((stage, idx) => {
                    const isActive = activeConversation.journey === stage.key;
                    const isPast = JOURNEY_STAGES.findIndex(s => s.key === activeConversation.journey) > idx;
                    return (
                      <div key={stage.key} className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0",
                          isActive ? "bg-primary text-white" : isPast ? "bg-success/20 text-success" : "bg-surface border border-border text-text-muted"
                        )}>
                          {isPast ? <Check size={10} /> : idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className={cn("text-[11px] font-medium", isActive ? "text-text-primary" : "text-text-secondary")}>{stage.label}</p>
                        </div>
                        {isActive && <Badge variant="success" className="text-[9px]">Current</Badge>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-3 mt-2">
            <Card>
              <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Edit size={12} className="text-text-muted" />
                  Internal Notes
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isEditingNotes) {
                      handleSaveNotes();
                    } else {
                      setIsEditingNotes(true);
                    }
                  }}
                  className="text-[11px] h-5 px-1.5"
                >
                  {isEditingNotes ? <><Check size={10} className="mr-0.5" /> Save</> : 'Edit'}
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {isEditingNotes ? (
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    className="w-full min-h-[120px] p-2 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-xs"
                    placeholder="Add notes about this contact..."
                    autoFocus
                  />
                ) : (
                  <div className="min-h-[80px]">
                    {editedNotes ? (
                      <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{editedNotes}</p>
                    ) : (
                      <p className="text-xs text-text-muted text-center py-6">No notes added yet. Click Edit to add internal notes.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-3 mt-2">
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-success" />
                  Engagement Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="p-2 rounded-lg bg-background border border-border text-center">
                    <p className="text-base font-bold text-text-primary">{messages.length}</p>
                    <p className="text-[9px] text-text-muted">Total Messages</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border text-center">
                    <p className="text-base font-bold text-primary">{sentMessages.length}</p>
                    <p className="text-[9px] text-text-muted">Sent</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border text-center">
                    <p className="text-base font-bold text-success">{receivedMessages.length}</p>
                    <p className="text-[9px] text-text-muted">Received</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border text-center">
                    <p className="text-base font-bold text-info">{aiMessages.length}</p>
                    <p className="text-[9px] text-text-muted">AI Responses</p>
                  </div>
                </div>
                
                <div className="space-y-1.5 pt-1.5 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted">Response Rate</span>
                    <span className="text-[10px] font-medium text-success">
                      {sentMessages.length > 0 ? Math.round((receivedMessages.length / sentMessages.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted">AI vs Manual</span>
                    <span className="text-[10px] font-medium">
                      {aiMessages.length} / {sentMessages.length - aiMessages.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted">Conversation Started</span>
                    <span className="text-[10px] font-mono">{formatDate(activeConversation.createdAt)}</span>
                  </div>
                </div>

                {aiInsights?.score && (
                  <div className="pt-1.5 border-t border-border space-y-1.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Sparkles size={9} className="text-primary" />
                      <span className="text-[9px] font-medium text-text-muted uppercase">AI Quality Metrics</span>
                    </div>
                    {aiInsights.score.factors && Object.entries(aiInsights.score.factors).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted capitalize">{key.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1 rounded-full bg-background overflow-hidden">
                            <div
                              className={cn("h-full rounded-full",
                                value >= 70 ? 'bg-success' : value >= 40 ? 'bg-warning' : 'bg-error'
                              )}
                              style={{ width: `${value}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-text-muted">{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export { ContactPanel };
