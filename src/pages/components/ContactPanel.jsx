import React, { useState, useEffect } from 'react';
import { Phone, MapPin, Clock, Edit, Star, Archive, MessageSquare, TrendingUp, Briefcase, FileText, Tag, X, Plus, Check, Save, Brain, Loader2, Target, ShieldBan, Bot } from 'lucide-react';
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
      <div className="w-full h-full border-l border-[rgba(255,255,255,0.08)] bg-[#111B21] flex items-center justify-center">
        <p className="text-[#8696A0] text-sm">Select a conversation</p>
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
    <div className="msg-detail-panel w-full shrink-0">
      {/* Contact Header — centered */}
      <div className="msg-detail-section border-b border-[rgba(255,255,255,0.06)] text-center shrink-0">
        <div className="flex items-center justify-end gap-1 mb-2">
          <button 
            onClick={handleToggleStar}
            className={cn("msg-icon-btn w-8 h-8", 
              activeConversation.starred ? "text-[#F5BB45] bg-[#F5BB45]/10" : "text-[#8696A0]"
            )}
            title={activeConversation.starred ? "Unstar" : "Star"}
          >
            <Star size={16} className={activeConversation.starred ? "fill-current" : ""} />
          </button>
          <button 
            onClick={handleToggleArchive}
            className={cn("msg-icon-btn w-8 h-8", 
              activeConversation.archived ? "text-[#F5BB45] bg-[#F5BB45]/10" : "text-[#8696A0]"
            )}
            title={activeConversation.archived ? "Unarchive" : "Archive"}
          >
            <Archive size={16} />
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="msg-icon-btn w-8 h-8 md:hidden"
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex justify-center">
          <ContactAvatar contact={activeConversation.contact} size="lg" />
        </div>
        <div className="mt-3">
          <h2 className="text-[16px] font-bold text-[#E9EDEF] truncate leading-tight">{activeConversation.contact.name}</h2>
          <p className="text-[12px] text-[#8696A0] font-mono mt-1">{activeConversation.contact.phone}</p>
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <MapPin size={12} className="text-[#8696A0] shrink-0" />
            <span className="text-[11px] text-[#8696A0] truncate">{activeConversation.contact.country}</span>
          </div>
        </div>
      </div>

      {/* Contact Action Tabs: WhatsApp / Manual Mode */}
      <div className="flex gap-2 px-4 py-4 border-b border-[rgba(255,255,255,0.06)] shrink-0">
        <button
          onClick={() => updateConversation(activeConversation.id, { mode: 'manual' })}
          className={cn(
            "h-9 flex-1 px-3 text-[12px] font-medium rounded-md cursor-pointer transition-all",
            activeConversation.mode !== 'ai' ? "bg-[#00A884] text-white" : "bg-transparent text-[#8696A0] border border-[rgba(255,255,255,0.08)]"
          )}
        >
          WhatsApp
        </button>
        <button
          onClick={() => updateConversation(activeConversation.id, { mode: 'ai' })}
          className={cn(
            "h-9 flex-1 px-3 text-[12px] font-medium rounded-md cursor-pointer transition-all flex items-center justify-center gap-1",
            activeConversation.mode === 'ai' ? "bg-[#00A884] text-white" : "bg-transparent text-[#8696A0] border border-[rgba(255,255,255,0.08)]"
          )}
        >
          <Bot size={12} />
          Manual Mode
        </button>
      </div>

      {/* Profile Button */}
      <div className="px-4 pt-4 shrink-0">
        <button
          onClick={() => setActiveTab('profile')}
          className="w-full h-10 bg-[#00A884] text-white font-semibold text-[13px] rounded-lg cursor-pointer hover:bg-[#06CF9C] transition-colors"
        >
          Profile
        </button>
      </div>

      {/* Additional Action Tabs: CRM / Notes / Stats */}
      <div className="flex gap-2 px-4 py-4 shrink-0">
        {[
          { key: 'crm', label: 'CRM' },
          { key: 'notes', label: 'Notes' },
          { key: 'stats', label: 'Stats' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 h-9 px-3 text-[12px] font-medium rounded-md cursor-pointer transition-all border",
              activeTab === tab.key
                ? "bg-[#00A884] text-white border-[#00A884]"
                : "bg-transparent border border-[rgba(255,255,255,0.1)] text-[#8696A0] hover:bg-[#202C33]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col min-h-full">
        {activeTab === 'profile' && (
          <>
            {/* Customer Journey */}
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <TrendingUp size={12} className="text-[#00A884]" />
                Customer Journey
              </div>
              <div className="grid grid-cols-2 gap-2">
                {JOURNEY_STAGES.map(stage => (
                  <button
                    key={stage.key}
                    onClick={() => handleJourneyChange(stage.key)}
                    className={cn(
                      "px-3 py-2 text-[11px] font-medium rounded-md border transition-all text-left",
                      activeConversation.journey === stage.key 
                        ? stage.color + " ring-1 ring-[#00A884]/30" 
                        : "bg-[#202C33] border-[rgba(255,255,255,0.08)] text-[#8696A0] hover:bg-[#2A3942]"
                    )}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <Brain size={12} className="text-[#00A884]" />
                AI Insights
              </div>
              {loadingInsights ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 size={12} className="animate-spin text-[#00A884]" />
                  <span className="text-[11px] text-[#8696A0]">Analyzing...</span>
                </div>
              ) : aiInsights ? (
                <div className="space-y-2">
                  {aiInsights.score && (
                    <div className="msg-detail-item">
                      <span className="text-[11px] text-[#8696A0]">Lead Quality</span>
                      <span className="text-[11px] font-medium text-[#E9EDEF]">{aiInsights.score.overall || 0}</span>
                    </div>
                  )}
                  {aiInsights.nextAction && (
                    <div className="p-2 rounded-md bg-[#00A884]/10 border border-[#00A884]/25">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Target size={9} className="text-[#00A884]" />
                        <span className="text-[10px] font-medium text-[#00A884]">Recommended Action</span>
                      </div>
                      <p className="text-[11px] text-[#8696A0]">{aiInsights.nextAction.reason || aiInsights.nextAction.action || 'Follow up'}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-[#8696A0] text-center py-2">No insights available</p>
              )}
            </div>

            {/* About */}
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <FileText size={12} className="text-[#00A884]" />
                About
              </div>
              <p className="text-[11px] text-[#8696A0] leading-relaxed">
                {activeConversation.contact.about || 'No about information available.'}
              </p>
            </div>

            {/* Compliance */}
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <ShieldBan size={12} className={complianceInfo.allowed ? 'text-[#8696A0]' : 'text-[#F15C6D]'} />
                Compliance
              </div>
              {complianceInfo.checking ? (
                <div className="flex items-center gap-1.5 py-1.5">
                  <Loader2 size={10} className="animate-spin text-[#8696A0]" />
                  <span className="text-[11px] text-[#8696A0]">Checking...</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="msg-detail-item">
                    <span className="text-[11px] text-[#8696A0]">Status</span>
                    <span className={cn("px-1.5 py-px text-[10px] font-medium rounded-full border",
                      complianceInfo.allowed ? "bg-[#00A884]/10 text-[#00A884] border-[#00A884]/30" :
                      complianceInfo.isBlocked ? "bg-[#F15C6D]/10 text-[#F15C6D] border-[#F15C6D]/30" :
                      "bg-[#F5BB45]/10 text-[#F5BB45] border-[#F5BB45]/30"
                    )}>
                      {complianceInfo.isBlocked ? 'Blocked' : complianceInfo.isSuppressed ? 'Opted Out' : 'Active'}
                    </span>
                  </div>
                  <div className="msg-detail-item">
                    <span className="text-[11px] text-[#8696A0]">Block</span>
                    {complianceInfo.allowed ? (
                      <button
                        onClick={async () => {
                          await blockContact(activeConversation.id, 'Manual block from contact panel');
                          setComplianceInfo({ allowed: false, isBlocked: true, isSuppressed: false, reason: 'Manual block', checking: false });
                        }}
                        className="px-1.5 py-px text-[10px] font-medium rounded-full bg-[#F15C6D]/10 text-[#F15C6D] border border-[#F15C6D]/30 hover:bg-[#F15C6D]/20 cursor-pointer"
                      >
                        Block
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await unblockContact(activeConversation.id);
                          setComplianceInfo({ allowed: true, isBlocked: false, isSuppressed: false, checking: false });
                        }}
                        className="px-1.5 py-px text-[10px] font-medium rounded-full bg-[#00A884]/10 text-[#00A884] border border-[#00A884]/30 hover:bg-[#00A884]/20 cursor-pointer"
                      >
                        Unblock
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="msg-detail-section">
              <div className="msg-detail-header flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag size={12} className="text-[#00A884]" />
                  Tags
                </div>
                <button 
                  onClick={() => setIsEditingTags(!isEditingTags)}
                  className="text-[11px] text-[#00A884] hover:text-[#06CF9C] font-medium"
                >
                  {isEditingTags ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {editedTags.map((tag, index) => (
                  <span key={index} className="px-1.5 py-0.5 text-[10px] bg-[#202C33] text-[#8696A0] rounded border border-[rgba(255,255,255,0.08)] flex items-center gap-0.5">
                    {tag}
                    {isEditingTags && (
                      <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:text-error">
                        <X size={8} />
                      </button>
                    )}
                  </span>
                ))}
                {editedTags.length === 0 && (
                  <span className="text-[11px] text-[#8696A0]">No tags</span>
                )}
              </div>
              {isEditingTags && (
                <div className="flex gap-1.5 mt-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    className="h-7 text-[11px] flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="icon" className="h-7 w-7 shrink-0" onClick={handleAddTag}>
                    <Plus size={12} />
                  </Button>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="msg-detail-section border-b-0">
              <div className="msg-detail-header">
                <Clock size={12} className="text-[#8696A0]" />
                Details
              </div>
              <div className="space-y-1.5">
                <div className="msg-detail-item">
                  <span className="text-[11px] text-[#8696A0]">WhatsApp Status</span>
                  <span className={cn("px-1.5 py-px text-[10px] font-medium rounded-full border",
                    activeConversation.contact.exists ? "bg-[#00A884]/10 text-[#00A884] border-[#00A884]/30" : "bg-[#F5BB45]/10 text-[#F5BB45] border-[#F5BB45]/30"
                  )}>
                    {activeConversation.contact.exists ? 'Registered' : 'Not Registered'}
                  </span>
                </div>
                <div className="msg-detail-item">
                  <span className="text-[11px] text-[#8696A0]">Added</span>
                  <span className="text-[11px] font-mono text-[#8696A0]">{formatDate(activeConversation.createdAt)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'crm' && (
          <>
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <Briefcase size={12} className="text-[#00A884]" />
                Business Information
              </div>
              {isEditingCrm ? (
                <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-[#8696A0] uppercase tracking-wider mb-0.5 block">Company</label>
                    <Input value={crmData.company || ''} onChange={(e) => setCrmData(prev => ({ ...prev, company: e.target.value }))} placeholder="Company name" className="h-7 text-[11px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8696A0] uppercase tracking-wider mb-0.5 block">Position</label>
                    <Input value={crmData.position || ''} onChange={(e) => setCrmData(prev => ({ ...prev, position: e.target.value }))} placeholder="Job title" className="h-7 text-[11px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8696A0] uppercase tracking-wider mb-0.5 block">Website</label>
                    <Input value={crmData.website || ''} onChange={(e) => setCrmData(prev => ({ ...prev, website: e.target.value }))} placeholder="https://example.com" className="h-7 text-[11px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8696A0] uppercase tracking-wider mb-0.5 block">Email</label>
                    <Input value={crmData.email || ''} onChange={(e) => setCrmData(prev => ({ ...prev, email: e.target.value }))} placeholder="email@example.com" className="h-7 text-[11px]" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveCrm} className="h-8">
                      <Save size={10} className="mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setIsEditingCrm(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {crmData.company && (
                    <div className="msg-detail-item justify-start gap-2">
                      <span className="text-[11px] text-[#8696A0]">Company</span>
                      <span className="text-[11px] font-medium text-[#E9EDEF]">{crmData.company}</span>
                    </div>
                  )}
                  {crmData.position && (
                    <div className="msg-detail-item justify-start gap-2">
                      <span className="text-[11px] text-[#8696A0]">Position</span>
                      <span className="text-[11px] font-medium text-[#E9EDEF]">{crmData.position}</span>
                    </div>
                  )}
                  {!crmData.company && !crmData.position && !crmData.website && !crmData.email && (
                    <p className="text-[11px] text-[#8696A0] text-center py-3">No CRM data yet.</p>
                  )}
                  <Button size="sm" variant="outline" className="h-8 w-full" onClick={() => setIsEditingCrm(true)}>
                    <Edit size={10} className="mr-1" />
                    Edit CRM Data
                  </Button>
                </div>
              )}
            </div>

            {/* Conversation Flow */}
            <div className="msg-detail-section border-b-0">
              <div className="msg-detail-header">
                <MessageSquare size={12} className="text-[#00A884]" />
                Conversation Flow
              </div>
              <div className="space-y-2">
                {JOURNEY_STAGES.map((stage, idx) => {
                  const isActive = activeConversation.journey === stage.key;
                  const isPast = JOURNEY_STAGES.findIndex(s => s.key === activeConversation.journey) > idx;
                  return (
                    <div key={stage.key} className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0",
                        isActive ? "bg-[#00A884] text-white" : isPast ? "bg-[#00A884]/20 text-[#00A884]" : "bg-[#202C33] border border-[rgba(255,255,255,0.08)] text-[#8696A0]"
                      )}>
                        {isPast ? <Check size={10} /> : idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-[11px] font-medium", isActive ? "text-[#E9EDEF]" : "text-[#8696A0]")}>{stage.label}</p>
                      </div>
                      {isActive && <span className="px-1.5 py-px text-[9px] font-medium bg-[#00A884]/10 text-[#00A884] border border-[#00A884]/30 rounded">Current</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'notes' && (
          <div className="msg-detail-section border-b-0">
            <div className="msg-detail-header">
              <MessageSquare size={12} className="text-[#00A884]" />
              Internal Notes
            </div>
            {isEditingNotes ? (
              <textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                className="w-full min-h-[120px] p-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#202C33] resize-none focus:outline-none focus:ring-2 focus:ring-[#00A884]/30 text-[13px] text-[#E9EDEF]"
                placeholder="Add notes about this contact..."
                autoFocus
              />
            ) : (
              <div className="min-h-[80px]">
                {editedNotes ? (
                  <p className="text-[13px] text-[#E9EDEF] leading-relaxed whitespace-pre-wrap">{editedNotes}</p>
                ) : (
                  <p className="text-[12px] text-[#8696A0] text-center py-6">No notes added yet.</p>
                )}
              </div>
            )}
            <button
              onClick={() => {
                if (isEditingNotes) {
                  handleSaveNotes();
                } else {
                  setIsEditingNotes(true);
                }
              }}
              className={cn(
                "mt-3 h-8 w-full text-[12px] font-medium rounded-md transition-colors",
                isEditingNotes ? "bg-[#00A884] text-white hover:bg-[#06CF9C]" : "border border-[rgba(255,255,255,0.08)] text-[#8696A0] hover:bg-[#202C33]"
              )}
            >
              {isEditingNotes ? 'Save Note' : 'Edit Note'}
            </button>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="msg-detail-section border-b-0">
            <div className="msg-detail-header">
              <TrendingUp size={12} className="text-[#00A884]" />
              Engagement Metrics
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-[#202C33] border border-[rgba(255,255,255,0.06)] text-center">
                <p className="text-lg font-bold text-[#E9EDEF]">{messages.length}</p>
                <p className="text-[10px] text-[#8696A0]">Total Messages</p>
              </div>
              <div className="p-2 rounded-md bg-[#202C33] border border-[rgba(255,255,255,0.06)] text-center">
                <p className="text-lg font-bold text-[#00A884]">{sentMessages.length}</p>
                <p className="text-[10px] text-[#8696A0]">Sent</p>
              </div>
              <div className="p-2 rounded-md bg-[#202C33] border border-[rgba(255,255,255,0.06)] text-center">
                <p className="text-lg font-bold text-success">{receivedMessages.length}</p>
                <p className="text-[10px] text-[#8696A0]">Received</p>
              </div>
              <div className="p-2 rounded-md bg-[#202C33] border border-[rgba(255,255,255,0.06)] text-center">
                <p className="text-lg font-bold text-info">{aiMessages.length}</p>
                <p className="text-[10px] text-[#8696A0]">AI Responses</p>
              </div>
            </div>
            <div className="space-y-1.5 pt-3 mt-3 border-t border-[rgba(255,255,255,0.06)]">
              <div className="msg-detail-item">
                <span className="text-[11px] text-[#8696A0]">Response Rate</span>
                <span className="text-[11px] font-medium text-[#00A884]">
                  {sentMessages.length > 0 ? Math.round((receivedMessages.length / sentMessages.length) * 100) : 0}%
                </span>
              </div>
              <div className="msg-detail-item">
                <span className="text-[11px] text-[#8696A0]">AI vs Manual</span>
                <span className="text-[11px] font-medium text-[#E9EDEF]">
                  {aiMessages.length} / {sentMessages.length - aiMessages.length}
                </span>
              </div>
              <div className="msg-detail-item">
                <span className="text-[11px] text-[#8696A0]">Conversation Started</span>
                <span className="text-[11px] font-mono text-[#8696A0]">{formatDate(activeConversation.createdAt)}</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export { ContactPanel };
