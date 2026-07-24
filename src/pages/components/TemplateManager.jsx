import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Search, Edit3, Trash2, Copy, Star, Filter, X, Loader2,
  Tag, Clock, Eye, CheckCircle, MessageSquare, Wand2, ChevronDown, ChevronRight, Save, Bell,
  AlertTriangle, Shield, ArrowLeft
} from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { useMessageAgent } from '../MessageAgentPage';

const CATEGORIES = [
  { id: 'low_ticket', label: 'Low Ticket', icon: MessageSquare, color: 'bg-primary' },
  { id: 'medium_ticket', label: 'Medium Ticket', icon: Star, color: 'bg-success' },
  { id: 'high_ticket', label: 'High Ticket', icon: Eye, color: 'bg-warning' },
  { id: 'smart_follow_up', label: 'Smart Follow-Up', icon: Clock, color: 'bg-info' },
  { id: 'utility', label: 'Utility', icon: Shield, color: 'bg-secondary' },
  { id: 'sales', label: 'Sales', icon: Tag, color: 'bg-error' },
  { id: 'marketing', label: 'Marketing', icon: FileText, color: 'bg-primary' },
  { id: 'ai_outreach', label: 'AI Outreach', icon: Wand2, color: 'bg-info' },
];

const TRIGGER_STATES = [
  'Cold Outreach - Touchpoint 1',
  'Follow-Up - Nudge 1 (48 Hours)',
  'Follow-Up - Nudge 2 (Breakup)',
  'Long-Term Nurturing (30 Days)',
  'Customer Support',
  'Payment Follow-Up',
  'Feedback Request',
  'Post-Demo Follow-Up',
  'Objection Handling',
  'Closing',
  'Re-engagement',
];

const ACTION_TAGS = [
  { value: 'HOT_LEAD_AI_ENGAGE', label: 'Hot Lead - AI Engage', color: 'bg-success' },
  { value: 'SOFT_REJECTION', label: 'Soft Rejection', color: 'bg-warning' },
  { value: 'BLACKLIST_OPTOUT', label: 'Opt-Out / Blacklist', color: 'bg-error' },
  { value: 'ARCHIVE_CONVERSATION', label: 'Archive', color: 'bg-secondary' },
];

const getCategoryInfo = (id) => CATEGORIES.find(c => c.id === id);

const highlightVariables = (text) => {
  if (!text) return text;
  return text.split(/(\{\{\d+\}\}|\{[^}]+\})/g).map((part, i) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return (
        <span key={i} className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-xs">
          {part}
        </span>
      );
    }
    if (part.startsWith('{') && part.endsWith('}') && !part.startsWith('{{')) {
      return (
        <span key={i} className="px-1.5 py-0.5 rounded bg-info/15 text-info font-mono text-xs">
          {part}
        </span>
      );
    }
    return part;
  });
};

const ButtonBadge = ({ button }) => {
  const actionInfo = ACTION_TAGS.find(a => a.value === button.action_tag);
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
      button.action_tag === 'BLACKLIST_OPTOUT' ? 'bg-error/10 text-error' :
      button.action_tag === 'HOT_LEAD_AI_ENGAGE' ? 'bg-success/10 text-success' :
      button.action_tag === 'SOFT_REJECTION' ? 'bg-warning/10 text-warning' :
      button.action_tag === 'ARCHIVE_CONVERSATION' ? 'bg-secondary/10 text-text-secondary' :
      'bg-background text-text-muted'
    )}>
      {button.text}
      {button.type === 'CTA' && <span className="text-[8px] opacity-70">(CTA)</span>}
    </span>
  );
};

const TemplateCard = ({ template, onSelect, onDelete, onCopy, onDuplicate, onEdit, isExpanded, onToggle }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    onCopy(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(template.id);
  };

  const handleDuplicate = (e) => {
    e.stopPropagation();
    onDuplicate(template.id);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(template);
  };

  const categoryInfo = getCategoryInfo(template.category);
  const hasCompliance = template.body && template.body.length <= 1024 &&
    !/^\{\{\d+\}\}/.test(template.body.trim()) &&
    !/\{\{\d+\}\}$/.test(template.body.trim()) &&
    template.buttons && template.buttons.some(b => b.action_tag === 'BLACKLIST_OPTOUT');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "cursor-pointer transition-all hover:border-primary/30 hover:shadow-md",
          isExpanded && "border-primary/40 shadow-md"
        )}
        onClick={() => onToggle(template.id)}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <h3 className="text-xs font-semibold text-text-primary truncate">{template.name}</h3>
                {categoryInfo && (
                  <Badge variant="default" className="text-[10px] shrink-0">
                    {categoryInfo.label}
                  </Badge>
                )}
                {template.trigger_state && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {template.trigger_state}
                  </Badge>
                )}
                {!template.isDefault && (
                  <Badge variant="outline" className="text-[10px] shrink-0">Custom</Badge>
                )}
                {!hasCompliance && (
                  <span className="text-[10px] text-error flex items-center gap-0.5 shrink-0">
                    <AlertTriangle size={10} />
                    Compliance
                  </span>
                )}
              </div>
              {template.description && (
                <p className="text-[11px] text-text-secondary mb-1 line-clamp-1">{template.description}</p>
              )}
              <p className="text-[11px] text-text-muted line-clamp-2">
                {highlightVariables(template.body?.substring(0, 100) + (template.body?.length > 100 ? '...' : ''))}
              </p>
              {template.buttons && template.buttons.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {template.buttons.map((btn, i) => (
                    <ButtonBadge key={i} button={btn} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {template.isFavorite && (
                <Star size={12} className="text-warning fill-warning" />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(template.id); }}
                className="p-1 rounded-lg hover:bg-background transition-colors"
              >
                {isExpanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 pt-2 border-t border-border space-y-2">
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Template Body</p>
                    <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                      {highlightVariables(template.body)}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1.5">{template.body?.length || 0}/1024 chars</p>
                  </div>

                  {(!hasCompliance) && (
                    <div className="p-2 rounded-lg bg-error/5 border border-error/20">
                      <p className="text-[10px] text-error flex items-center gap-1 font-medium">
                        <AlertTriangle size={10} />
                        Compliance Issues
                      </p>
                      <ul className="text-[10px] text-error/80 mt-1 space-y-0.5">
                        {template.body && template.body.length > 1024 && <li>- Body exceeds 1024 characters</li>}
                        {template.body && /^\{\{\d+\}\}/.test(template.body.trim()) && <li>- Body starts with a variable placeholder</li>}
                        {template.body && /\{\{\d+\}\}$/.test(template.body.trim()) && <li>- Body ends with a variable placeholder</li>}
                        {(!template.buttons || !template.buttons.some(b => b.action_tag === 'BLACKLIST_OPTOUT')) && <li>- Missing opt-out button (BLACKLIST_OPTOUT)</li>}
                      </ul>
                    </div>
                  )}

                  {template.buttons && template.buttons.length > 0 && (
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Buttons</p>
                      <div className="flex flex-wrap gap-1">
                        {template.buttons.map((btn, i) => (
                          <span key={i} className={cn(
                            "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs border",
                            btn.action_tag === 'BLACKLIST_OPTOUT' ? 'border-error/20 bg-error/5 text-error' :
                            btn.action_tag === 'HOT_LEAD_AI_ENGAGE' ? 'border-success/20 bg-success/5 text-success' :
                            btn.action_tag === 'SOFT_REJECTION' ? 'border-warning/20 bg-warning/5 text-warning' :
                            'border-border bg-background text-text-secondary'
                          )}>
                            {btn.text}
                            <span className="text-[8px] opacity-60">({btn.action_tag})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {template.trigger_state && (
                    <div className="flex items-center gap-1">
                      <Tag size={10} className="text-text-muted" />
                      <span className="text-[10px] text-text-muted">Pipeline: {template.trigger_state}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? <CheckCircle size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleEdit}>
                      <Edit3 size={12} className="mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDuplicate}>
                      <Copy size={12} className="mr-1" />
                      Duplicate
                    </Button>
                    {!template.isDefault && (
                      <Button size="sm" variant="outline" onClick={handleDelete} className="text-error hover:bg-error/10">
                        <Trash2 size={12} className="mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const TemplateForm = ({ template, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState({
    name: template?.name || '',
    category: template?.category || 'low_ticket',
    trigger_state: template?.trigger_state || 'Cold Outreach - Touchpoint 1',
    body: template?.body || '',
    description: template?.description || '',
    best_for: template?.best_for || '',
    buttons: template?.buttons || [{ type: 'QUICK_REPLY', text: '', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: '', action_tag: 'BLACKLIST_OPTOUT' }],
  });
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const validate = () => {
    const errs = [];
    if (!form.name.trim()) errs.push('Template name is required');
    if (!form.category) errs.push('Category is required');
    if (!form.body.trim()) errs.push('Template body is required');
    if (form.body.length > 1024) errs.push('Body exceeds 1024 characters');
    if (/^\{\{\d+\}\}/.test(form.body.trim())) errs.push('Body cannot start with a variable placeholder');
    if (/\{\{\d+\}\}$/.test(form.body.trim())) errs.push('Body cannot end with a variable placeholder');
    if (!form.buttons.some(b => b.action_tag === 'BLACKLIST_OPTOUT')) errs.push('Must include an opt-out button (BLACKLIST_OPTOUT)');
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    setSaveSuccess(false);
    const result = await onSave({
      ...form,
      id: template?.id,
      isDefault: template?.isDefault || false,
    });
    if (result) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const updateButton = (index, field, value) => {
    setForm(prev => {
      const buttons = [...prev.buttons];
      buttons[index] = { ...buttons[index], [field]: value };
      return { ...prev, buttons };
    });
  };

  const addButton = () => {
    setForm(prev => ({
      ...prev,
      buttons: [...prev.buttons, { type: 'QUICK_REPLY', text: '', action_tag: 'HOT_LEAD_AI_ENGAGE' }],
    }));
  };

  const removeButton = (index) => {
    setForm(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  };

  const charCount = form.body?.length || 0;
  const charWarning = charCount > 900;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {errors.length > 0 && (
        <div className="p-3 rounded-lg bg-error/5 border border-error/20">
          <p className="text-xs font-medium text-error flex items-center gap-1 mb-1">
            <AlertTriangle size={12} />
            Validation Errors
          </p>
          <ul className="text-[10px] text-error/80 space-y-0.5">
            {errors.map((err, i) => <li key={i}>- {err}</li>)}
          </ul>
        </div>
      )}

      {saveSuccess && (
        <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-xs text-success flex items-center gap-1">
          <CheckCircle size={12} />
          Template saved successfully
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Template Name *</label>
          <Input
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Social Media Design Overhaul"
          />
        </div>
        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
            className="w-full h-8 px-3 rounded-md border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Pipeline Trigger State</label>
        <select
          value={form.trigger_state}
          onChange={(e) => setForm(prev => ({ ...prev, trigger_state: e.target.value }))}
          className="w-full h-8 px-3 rounded-md border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {TRIGGER_STATES.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">
          Template Body *
          <span className={cn("ml-2 font-normal", charWarning ? 'text-warning' : 'text-text-muted')}>
            ({charCount}/1024)
          </span>
        </label>
        <textarea
          value={form.body}
          onChange={(e) => setForm(prev => ({ ...prev, body: e.target.value }))}
          placeholder="Write your template... Use {{1}} for first_name, {{2}} for company, {{3}} for custom fields"
          className={cn(
            "w-full min-h-[100px] p-2 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-xs",
            charWarning ? 'border-warning/50' : 'border-border'
          )}
          rows={5}
        />
        {charWarning && (
          <p className="text-[10px] text-warning mt-0.5">Approaching 1024 character limit</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Description</label>
          <Input
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of this template"
          />
        </div>
        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Best For</label>
          <Input
            value={form.best_for}
            onChange={(e) => setForm(prev => ({ ...prev, best_for: e.target.value }))}
            placeholder="e.g., Cold outreach for social media services"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] text-text-muted uppercase tracking-wider">Buttons</label>
          <Button type="button" size="sm" variant="ghost" onClick={addButton} className="text-xs">
            <Plus size={12} className="mr-1" />
            Add Button
          </Button>
        </div>
        <div className="space-y-2">
          {form.buttons.map((btn, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
              <span className="text-[10px] text-text-muted w-4">{i + 1}</span>
              <select
                value={btn.type}
                onChange={(e) => updateButton(i, 'type', e.target.value)}
                className="h-8 px-2 rounded border border-border bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="QUICK_REPLY">Quick Reply</option>
                <option value="CTA">CTA</option>
              </select>
              <Input
                value={btn.text}
                onChange={(e) => updateButton(i, 'text', e.target.value)}
                placeholder="Button text"
                className="flex-1 h-8 text-xs"
              />
              {btn.type === 'CTA' && (
                <Input
                  value={btn.url_param || ''}
                  onChange={(e) => updateButton(i, 'url_param', e.target.value)}
                  placeholder="URL param (e.g. {{3}})"
                  className="w-24 h-8 text-xs"
                />
              )}
              <select
                value={btn.action_tag}
                onChange={(e) => updateButton(i, 'action_tag', e.target.value)}
                className="h-8 px-2 rounded border border-border bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {ACTION_TAGS.map(at => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
              {form.buttons.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeButton(i)}
                  className="p-1 rounded hover:bg-error/10 text-text-muted hover:text-error"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!form.buttons.some(b => b.action_tag === 'BLACKLIST_OPTOUT') && (
          <p className="text-[10px] text-error mt-1">At least one button must have Opt-Out action tag</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-border">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || !form.name.trim() || !form.body.trim()} className="bg-primary hover:bg-primary/90 text-white">
          {isSaving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
          {template?.id ? 'Update Template' : 'Save Template'}
        </Button>
      </div>
    </form>
  );
};

const TemplateManager = ({ isOpen, onClose }) => {
  const { conversations, activeConversationId } = useMessageAgent();

  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isSaving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/message-agent/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || data || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/message-agent/templates/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      fetchCategories();
    }
  }, [isOpen, fetchTemplates, fetchCategories]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/message-agent/templates/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.templates || data || []);
        }
      } catch (err) {
        console.error('Error searching templates:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredTemplates = useMemo(() => {
    const source = searchResults || templates;
    if (selectedCategory) {
      return source.filter(t => t.category === selectedCategory);
    }
    return source;
  }, [templates, searchResults, selectedCategory]);

  const myTemplates = useMemo(() => {
    return templates.filter(t => !t.isDefault);
  }, [templates]);

  const toggleExpanded = (id) => {
    setExpandedTemplateId(prev => prev === id ? null : id);
  };

  const handleCopy = async (template) => {
    const activeConversation = conversations?.find(c => c.id === activeConversationId);
    let content = template.body || '';

    if (activeConversation?.contact) {
      const contact = activeConversation.contact;
      content = content
        .replace(/\{\{1\}\}/g, contact.name || 'there')
        .replace(/\{name\}/g, contact.name || 'there')
        .replace(/\{business_name\}/g, 'Your Business');
    }

    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/message-agent/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await fetch(`/api/message-agent/templates/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(prev => [...prev, data.template]);
      }
    } catch (err) {
      console.error('Error duplicating template:', err);
    }
  };

  const handleSave = async (templateData) => {
    setSaving(true);
    try {
      const url = templateData.id
        ? `/api/message-agent/templates/${templateData.id}`
        : '/api/message-agent/templates';
      const method = templateData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });
      if (res.ok) {
        const data = await res.json();
        if (templateData.id) {
          setTemplates(prev => prev.map(t => t.id === data.template.id ? data.template : t));
        } else {
          setTemplates(prev => [...prev, data.template || data]);
        }
        setEditingTemplate(null);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        return true;
      } else {
        const errData = await res.json();
        console.error('Save error:', errData.error);
        return false;
      }
    } catch (err) {
      console.error('Error saving template:', err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleGetRecommendation = async () => {
    setIsRecommending(true);
    setRecommendation(null);
    try {
      const activeConversation = conversations?.find(c => c.id === activeConversationId);
      const res = await fetch('/api/message-agent/templates/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationState: {
            contactName: activeConversation?.contact?.name || '',
            industry: activeConversation?.contact?.industry || '',
            service: activeConversation?.contact?.service || '',
            stage: activeConversation?.stage || 'cold',
            leadQuality: activeConversation?.leadQuality || 'medium',
            lastInteractionDays: activeConversation?.lastInteractionDays || 1,
            useAI: true,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendation(data.recommended || data.recommendation || data);
      }
    } catch (err) {
      console.error('Error getting recommendation:', err);
    } finally {
      setIsRecommending(false);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
  };

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
        <div className="p-4 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-text-primary">
                  {editingTemplate ? 'Edit Template' : 'Template Manager'}
                </h2>
                <p className="text-xs text-text-secondary">
                  {editingTemplate ? `Editing: ${editingTemplate.name}` : 'Manage and personalize message templates'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
              <X size={14} className="text-text-muted" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {editingTemplate ? (
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setEditingTemplate(null)}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mb-3 transition-colors"
              >
                <ArrowLeft size={12} />
                Back to templates
              </button>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Edit3 size={14} className="text-primary" />
                    {editingTemplate.id ? 'Edit Template' : 'Create New Template'}
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Fill in the details below. All templates must include an opt-out button and follow compliance rules.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TemplateForm
                    template={editingTemplate}
                    onSave={handleSave}
                    onCancel={() => setEditingTemplate(null)}
                    isSaving={isSaving}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Tabs defaultValue="all" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="gap-1 px-2 py-0.5 text-xs">
                    <FileText size={12} />
                    All Templates
                  </TabsTrigger>
                  <TabsTrigger value="category" className="gap-1 px-2 py-0.5 text-xs">
                    <Tag size={12} />
                    By Category
                  </TabsTrigger>
                  <TabsTrigger value="mine" className="gap-1 px-2 py-0.5 text-xs">
                    <Edit3 size={12} />
                    My Templates
                  </TabsTrigger>
                  <TabsTrigger value="create" className="gap-1 px-2 py-0.5 text-xs">
                    <Plus size={12} />
                    Create New
                  </TabsTrigger>
                </TabsList>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGetRecommendation}
                  disabled={isRecommending}
                  className="gap-1.5"
                >
                  {isRecommending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Wand2 size={12} />
                  )}
                  {isRecommending ? 'Getting...' : 'AI Recommend'}
                </Button>
              </div>

              <AnimatePresence>
                {recommendation && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 rounded-xl bg-primary/5 border border-primary/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Wand2 size={12} className="text-primary" />
                          <p className="text-[11px] font-semibold text-primary">AI Recommended</p>
                          {recommendation.source === 'ai' && (
                            <Badge variant="success" className="text-[9px]">AI Generated</Badge>
                          )}
                          {recommendation.source === 'rule' && (
                            <Badge variant="secondary" className="text-[9px]">Rule-Based</Badge>
                          )}
                        </div>
                        {Array.isArray(recommendation) ? (
                          <div className="space-y-2 mt-2">
                            {recommendation.map((rec, i) => (
                              <div key={i} className="p-2 rounded-lg bg-background border border-border">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs font-semibold text-text-primary">
                                    {rec.template?.name || rec.name}
                                  </p>
                                  <Badge variant="default" className="text-[9px]">
                                    {rec.template?.category || rec.category}
                                  </Badge>
                                  <span className="text-[10px] text-primary font-medium">
                                    {rec.score}% match
                                  </span>
                                </div>
                                <p className="text-[11px] text-text-muted whitespace-pre-wrap line-clamp-2">
                                  {highlightVariables(rec.template?.body || rec.body)}
                                </p>
                                {rec.reason && (
                                  <p className="text-[10px] text-text-secondary italic mt-1">{rec.reason}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-text-primary mb-1">
                              {recommendation.template?.name || recommendation.name}
                            </p>
                            <p className="text-[11px] text-text-muted whitespace-pre-wrap line-clamp-2">
                              {highlightVariables(recommendation.template?.body || recommendation.body)}
                            </p>
                            {recommendation.reason && (
                              <p className="text-[10px] text-text-secondary italic mt-1">{recommendation.reason}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRecommendation(null)}
                        className="shrink-0"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <TabsContent value="all" className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="pl-8"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-background"
                    >
                      <X size={12} className="text-text-muted" />
                    </button>
                  )}
                </div>

                {isLoading || isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-primary" />
                    <span className="ml-2 text-xs text-text-muted">Loading templates...</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText size={32} className="text-text-muted/30 mb-3" />
                    <p className="text-xs text-text-muted">
                      {searchQuery ? 'No templates match your search' : 'No templates available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {filteredTemplates.map(template => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          isExpanded={expandedTemplateId === template.id}
                          onToggle={toggleExpanded}
                          onCopy={handleCopy}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onEdit={handleEdit}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="category" className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const count = templates.filter(t => t.category === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                        className={cn(
                          "p-2 rounded-xl border transition-all text-left",
                          selectedCategory === cat.id
                            ? "bg-primary/10 border-primary/30 shadow-sm"
                            : "bg-background border-border hover:border-primary/20"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-1.5", cat.color)}>
                          <Icon size={14} className="text-white" />
                        </div>
                        <p className="text-[11px] font-medium text-text-primary">{cat.label}</p>
                        <p className="text-[10px] text-text-muted">{count} templates</p>
                      </button>
                    );
                  })}
                </div>

                {selectedCategory && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-text-secondary">
                        {CATEGORIES.find(c => c.id === selectedCategory)?.label} Templates
                      </p>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedCategory(null)}>
                        <X size={12} className="mr-1" />
                        Clear
                      </Button>
                    </div>
                    {filteredTemplates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Tag size={32} className="text-text-muted/30 mb-3" />
                        <p className="text-xs text-text-muted">No templates in this category</p>
                      </div>
                    ) : (
                      filteredTemplates.map(template => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          isExpanded={expandedTemplateId === template.id}
                          onToggle={toggleExpanded}
                          onCopy={handleCopy}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onEdit={handleEdit}
                        />
                      ))
                    )}
                  </div>
                )}

                {!selectedCategory && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Filter size={32} className="text-text-muted/30 mb-3" />
                    <p className="text-xs text-text-muted">Select a category to view templates</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mine" className="space-y-3">
                {myTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Edit3 size={32} className="text-text-muted/30 mb-3" />
                    <p className="text-xs text-text-muted">You haven't created any templates yet</p>
                    <p className="text-[11px] text-text-muted mt-1">Create your first template below</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myTemplates.map(template => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        isExpanded={expandedTemplateId === template.id}
                        onToggle={toggleExpanded}
                        onCopy={handleCopy}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2">
                      <Plus size={14} className="text-primary" />
                      Quick Create
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Create a new template with all required compliance fields
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <TemplateForm
                      template={null}
                      onSave={handleSave}
                      onCancel={() => {}}
                      isSaving={isSaving}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="create" className="space-y-3">
                <div className="max-w-2xl mx-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xs font-semibold flex items-center gap-2">
                        <Plus size={14} className="text-primary" />
                        Create New Template
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Fill in the details below. All templates must include an opt-out button and comply with WhatsApp policies.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TemplateForm
                        template={null}
                        onSave={handleSave}
                        onCancel={() => {}}
                        isSaving={isSaving}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;
