import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Kanban,
  GripVertical,
  Phone,
  User,
  Clock,
  Star,
  MessageSquare,
  ArrowRight,
  ChevronRight,
  Filter,
  Search,
  MoreHorizontal,
  Plus,
  Target,
  TrendingUp,
  X,
  Loader2,
  Eye,
} from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useMessageAgent } from '../MessageAgentPage';

const STAGES = [
  {
    key: 'new_lead',
    label: 'New Lead',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    barColor: 'bg-blue-500',
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-400',
  },
  {
    key: 'contacted',
    label: 'Contacted',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    barColor: 'bg-purple-500',
    dotColor: 'bg-purple-500',
    textColor: 'text-purple-400',
  },
  {
    key: 'interested',
    label: 'Interested',
    color: 'bg-success/10 text-success border-success/30',
    barColor: 'bg-success',
    dotColor: 'bg-success',
    textColor: 'text-success',
  },
  {
    key: 'negotiation',
    label: 'In Negotiation',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    barColor: 'bg-yellow-500',
    dotColor: 'bg-yellow-500',
    textColor: 'text-yellow-400',
  },
  {
    key: 'converted',
    label: 'Converted',
    color: 'bg-success/20 text-success border-success/30',
    barColor: 'bg-success',
    dotColor: 'bg-success',
    textColor: 'text-success',
  },
  {
    key: 'closed',
    label: 'Closed',
    color: 'bg-text-muted/10 text-text-muted border-border',
    barColor: 'bg-text-muted',
    dotColor: 'bg-text-muted',
    textColor: 'text-text-muted',
  },
];

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
};

const ContactCard = ({ conversation, onSelect }) => {
  const { contact, messages, starred, journey, lastMessage } = conversation;
  const name = contact?.name || contact?.phone || 'Unknown';
  const phone = contact?.phone || '';
  const lastMsg = lastMessage || messages?.[messages.length - 1];
  const lastMsgPreview = lastMsg?.text || lastMsg?.content || '';
  const lastMsgTime = lastMsg?.timestamp || lastMessage?.timestamp;
  const stage = STAGES.find(s => s.key === journey) || STAGES[0];
  const sentiment = conversation?.crm?.sentiment || conversation?.quality;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      onClick={() => onSelect?.(conversation.id)}
      className={cn(
        'group relative p-2.5 rounded-xl border border-border bg-background hover:bg-surface',
        'hover:border-primary/30 transition-all duration-150 cursor-pointer'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-[11px] font-semibold text-text-secondary">
          {getInitials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{name}</p>
              {starred && (
                <Star size={10} className="shrink-0 text-yellow-500 fill-current" />
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary"
            >
              <MoreHorizontal size={12} />
            </button>
          </div>
          <p className="text-[10px] text-text-muted font-mono mt-0.5 truncate">{phone}</p>
          {lastMsgPreview && (
            <p className="text-[11px] text-text-secondary mt-1 line-clamp-2 leading-relaxed">
              {lastMsgPreview}
            </p>
          )}
          <div className="flex items-center justify-between mt-1.5 gap-1.5">
            <div className="flex items-center gap-1.5">
              {sentiment && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] px-1.5 py-0',
                    sentiment === 'positive' && 'border-success/30 text-success',
                    sentiment === 'negative' && 'border-error/30 text-error',
                    sentiment === 'neutral' && 'border-text-muted/30 text-text-muted'
                  )}
                >
                  {sentiment}
                </Badge>
              )}
            </div>
            {lastMsgTime && (
              <span className="text-[10px] text-text-muted shrink-0">
                {formatRelativeTime(lastMsgTime)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical size={12} className="text-text-muted" />
      </div>
    </motion.div>
  );
};

const CrmPipeline = ({ isOpen, onClose, onSelectContact }) => {
  const { conversations, loadConversations } = useMessageAgent();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      loadConversations().finally(() => setIsLoading(false));
    }
  }, [isOpen, loadConversations]);

  const filteredConversations = useMemo(() => {
    let list = conversations || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.contact?.name?.toLowerCase().includes(q) ||
        c.contact?.phone?.includes(q) ||
        c.lastMessage?.text?.toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'active') {
      list = list.filter(c => c.journey !== 'closed');
    } else if (activeFilter === 'closed') {
      list = list.filter(c => c.journey === 'closed');
    }
    return list;
  }, [conversations, searchQuery, activeFilter]);

  const grouped = useMemo(() => {
    const map = {};
    STAGES.forEach(s => { map[s.key] = []; });
    filteredConversations.forEach(c => {
      const stage = c.journey || 'new_lead';
      if (!map[stage]) map[stage] = [];
      map[stage].push(c);
    });
    return map;
  }, [filteredConversations]);

  const stats = useMemo(() => {
    const total = conversations?.length || 0;
    const active = conversations?.filter(c => c.journey !== 'closed').length || 0;
    const converted = conversations?.filter(c => c.journey === 'converted').length || 0;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    
    let avgPipelineTime = null;
    const withDates = conversations?.filter(c => c.createdAt && c.lastMessage?.timestamp) || [];
    if (withDates.length > 0) {
      const totalDays = withDates.reduce((sum, c) => {
        const start = new Date(c.createdAt).getTime();
        const end = new Date(c.lastMessage.timestamp).getTime();
        return sum + (end - start) / 86400000;
      }, 0);
      avgPipelineTime = Math.round((totalDays / withDates.length) * 10) / 10;
      avgPipelineTime = avgPipelineTime > 0 ? `${avgPipelineTime}d` : null;
    }
    
    return { total, active, converted, conversionRate, avgPipelineTime };
  }, [conversations]);

  const totalInPipeline = filteredConversations.length;

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <Kanban size={14} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-text-primary">CRM Pipeline</h2>
                <p className="text-xs text-text-secondary">
                  Manage your contacts through the sales pipeline
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-background transition-colors"
            >
              <X size={16} className="text-text-muted" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            <div className="p-2.5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2 mb-1">
                <Target size={12} className="text-primary" />
                <span className="text-[11px] text-text-muted">Total Contacts</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{stats.total}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={12} className="text-info" />
                <span className="text-[11px] text-text-muted">Active Conversations</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{stats.active}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={12} className="text-success" />
                <span className="text-[11px] text-text-muted">Conversion Rate</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{stats.conversionRate}%</p>
            </div>
            <div className="p-2.5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={12} className="text-warning" />
                <span className="text-[11px] text-text-muted">Avg. Pipeline Time</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{stats.avgPipelineTime || '--'}</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="pl-9 h-7 text-[11px]"
              />
            </div>
            <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'closed', label: 'Closed' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-medium transition-all',
                    activeFilter === f.key
                      ? 'bg-primary text-white'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Badge variant="outline" className="text-[11px] ml-auto">
              {totalInPipeline} contact{totalInPipeline !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Pipeline Columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="ml-2 text-xs text-text-muted">Loading pipeline...</span>
            </div>
          ) : (
            <div className="flex h-full min-w-max p-3 gap-2">
              {STAGES.map(stage => {
                const stageContacts = grouped[stage.key] || [];
                return (
                  <div
                    key={stage.key}
                    className="flex flex-col w-64 shrink-0 h-full"
                  >
                    {/* Column Header */}
                    <div className={cn('rounded-t-xl border border-b-0 p-2.5', stage.color)}>
                      <div className={cn('h-1 rounded-full mb-1.5', stage.barColor)} />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full', stage.dotColor)} />
                          <span className={cn('text-[11px] font-semibold', stage.textColor)}>
                            {stage.label}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] font-mono', stage.color)}
                        >
                          {stageContacts.length}
                        </Badge>
                      </div>
                    </div>

                    {/* Column Body */}
                    <div className="flex-1 overflow-y-auto border border-border rounded-b-xl bg-background/50 p-1.5 space-y-1.5 custom-scrollbar">
                      <AnimatePresence mode="popLayout">
                        {stageContacts.length > 0 ? (
                          stageContacts.map(conv => (
                            <ContactCard
                              key={conv.id}
                              conversation={conv}
                              onSelect={onSelectContact}
                            />
                          ))
                        ) : (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-28 text-text-muted"
                          >
                            <GripVertical size={16} className="mb-2 opacity-30" />
                            <p className="text-xs">No contacts</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrmPipeline;
