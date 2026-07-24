import React, { useState, useEffect } from 'react';
import { X, Cpu, Plus, Trash2, Check, AlertCircle, Loader2, Key, ArrowUp, ArrowDown, Power, PowerOff, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { useMessageAgent } from '../MessageAgentPage';

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: 'GPT-4o, GPT-4o Mini', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', models: 'Claude 3.5 Sonnet, Claude 3 Haiku', placeholder: 'sk-ant-...' },
  { id: 'groq', name: 'Groq', models: 'Llama 3.1 70B, Mixtral 8x7B', placeholder: 'gsk_...' },
  { id: 'together', name: 'Together AI', models: 'Llama 3, Mixtral, Gemma', placeholder: '...' },
  { id: 'mistral', name: 'Mistral AI', models: 'Mistral Large, Mistral Small', placeholder: '...' },
  { id: 'deepseek', name: 'DeepSeek', models: 'DeepSeek Chat, DeepSeek Coder', placeholder: 'sk-' },
  { id: 'openrouter', name: 'OpenRouter', models: '100+ models (GPT, Claude, Llama)', placeholder: 'sk-or-' },
];

const ProviderCard = ({ provider, existingProvider, onToggle, onDelete, onPriorityChange, isFirst, isLast }) => {
  const [showKey, setShowKey] = useState(false);
  const providerInfo = AI_PROVIDERS.find(p => p.id === provider.provider) || {};

  return (
    <div className={cn(
      "p-3 rounded-xl border transition-all",
      existingProvider?.enabled 
        ? "bg-background border-success/30" 
        : "bg-background border-border opacity-60"
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center",
            existingProvider?.enabled ? "bg-success/10" : "bg-surface border border-border"
          )}>
            <Cpu size={14} className={existingProvider?.enabled ? "text-success" : "text-text-muted"} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text-primary">{provider.name || providerInfo.name}</h3>
            <p className="text-[11px] text-text-muted">{providerInfo.models || 'Custom Provider'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={existingProvider?.enabled ? 'success' : 'outline'} className="text-[10px]">
            {existingProvider?.enabled ? 'Active' : 'Inactive'}
          </Badge>
          <Switch 
            checked={existingProvider?.enabled || false} 
            onCheckedChange={() => onToggle(provider.id)} 
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5 block">API Key</label>
          <div className="relative">
            <Key size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              type={showKey ? 'text' : 'password'}
              value={existingProvider?.apiKey || ''}
              readOnly
              className="pl-8 pr-8 h-7 text-[11px] font-mono"
              placeholder="No key configured"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted">Priority:</span>
            <span className="text-[11px] font-medium text-text-primary">#{existingProvider?.priority || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPriorityChange(provider.id, 'up')}
              disabled={isFirst}
              className="p-0.5 rounded hover:bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUp size={10} />
            </button>
            <button
              onClick={() => onPriorityChange(provider.id, 'down')}
              disabled={isLast}
              className="p-0.5 rounded hover:bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowDown size={10} />
            </button>
            <button
              onClick={() => onDelete(provider.id)}
              className="p-0.5 rounded hover:bg-error/10 text-text-muted hover:text-error ml-0.5"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddProviderDialog = ({ isOpen, onClose, onAdd, existingCount }) => {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setIsAdding(true);
    await onAdd({
      provider: selectedProvider,
      apiKey: apiKey.trim(),
      name: name.trim() || AI_PROVIDERS.find(p => p.id === selectedProvider)?.name || 'Custom',
      priority: existingCount,
    });
    setIsAdding(false);
    setSelectedProvider('');
    setApiKey('');
    setName('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-bold">Add AI Provider</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
          <p className="text-[11px] text-text-secondary mt-1">
            {3 - existingCount} of 3 provider slots available
          </p>
        </div>
        
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">Provider *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {AI_PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={cn(
                    "p-2 rounded-xl border text-left transition-all",
                    selectedProvider === p.id 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30" 
                      : "border-border bg-background hover:border-primary/30"
                  )}
                >
                  <p className="text-xs font-medium">{p.name}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{p.models}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">Display Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional custom name"
            />
          </div>
          
          <div>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5 block">API Key *</label>
            <div className="relative">
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={AI_PROVIDERS.find(p => p.id === selectedProvider)?.placeholder || 'Enter API key'}
                className="pl-9 font-mono"
                type="password"
              />
            </div>
            <p className="text-[10px] text-text-muted mt-1">Keys are stored locally and encrypted</p>
          </div>
        </div>
        
        <div className="p-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button 
            size="sm" 
            onClick={handleAdd} 
            disabled={!selectedProvider || !apiKey.trim() || isAdding}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {isAdding ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
            Add Provider
          </Button>
        </div>
      </div>
    </div>
  );
};

const AiProviderSettings = ({ isOpen, onClose }) => {
  const { aiProviders, loadAiProviders } = useMessageAgent();
  const [providers, setProviders] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAiProviders();
    }
  }, [isOpen, loadAiProviders]);

  useEffect(() => {
    setProviders(aiProviders || []);
  }, [aiProviders]);

  const handleAddProvider = async (data) => {
    try {
      const res = await fetch('/api/message-agent/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        loadAiProviders();
      }
    } catch (err) {
      console.error('Error adding provider:', err);
    }
  };

  const handleToggleProvider = async (id) => {
    const provider = providers.find(p => p.id === id);
    if (!provider) return;
    
    try {
      await fetch(`/api/message-agent/ai-providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !provider.enabled })
      });
      loadAiProviders();
    } catch (err) {
      console.error('Error toggling provider:', err);
    }
  };

  const handleDeleteProvider = async (id) => {
    try {
      await fetch(`/api/message-agent/ai-providers/${id}`, { method: 'DELETE' });
      loadAiProviders();
    } catch (err) {
      console.error('Error deleting provider:', err);
    }
  };

  const handlePriorityChange = async (id, direction) => {
    const sorted = [...providers].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const idx = sorted.findIndex(p => p.id === id);
    
    if (direction === 'up' && idx > 0) {
      const temp = sorted[idx].priority;
      sorted[idx].priority = sorted[idx - 1].priority;
      sorted[idx - 1].priority = temp;
    } else if (direction === 'down' && idx < sorted.length - 1) {
      const temp = sorted[idx].priority;
      sorted[idx].priority = sorted[idx + 1].priority;
      sorted[idx + 1].priority = temp;
    }

    for (const p of sorted) {
      await fetch(`/api/message-agent/ai-providers/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: p.priority })
      });
    }
    loadAiProviders();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sortedProviders = [...providers].sort((a, b) => (a.priority || 0) - (b.priority || 0));

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-success/10 flex items-center justify-center">
                  <Cpu size={16} className="text-success" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-text-primary">AI Provider Settings</h2>
                  <p className="text-xs text-text-secondary">Configure up to 3 AI providers with automatic fallback</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
                <X size={16} className="text-text-muted" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Provider Status Summary */}
            <div className="flex items-center gap-2 mb-4 p-2.5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", providers.some(p => p.enabled) ? 'bg-success animate-pulse' : 'bg-error')} />
                <span className="text-[11px] font-medium">
                  {providers.filter(p => p.enabled).length} of {providers.length} providers active
                </span>
              </div>
              <span className="text-[11px] text-text-muted">•</span>
              <span className="text-[11px] text-text-muted">
                {providers.length}/3 slots used
              </span>
            </div>

            {/* Providers List */}
            <div className="space-y-2">
              {sortedProviders.map((provider, idx) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  existingProvider={provider}
                  onToggle={handleToggleProvider}
                  onDelete={handleDeleteProvider}
                  onPriorityChange={handlePriorityChange}
                  isFirst={idx === 0}
                  isLast={idx === sortedProviders.length - 1}
                />
              ))}

              {providers.length < 3 && (
                <button
                  onClick={() => setShowAddDialog(true)}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-text-muted hover:text-primary"
                >
                  <Plus size={16} />
                  <span className="text-xs font-medium">Add AI Provider</span>
                </button>
              )}
            </div>

            {/* How it works */}
            <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <h4 className="text-xs font-semibold text-primary mb-1.5">How AI Fallback Works</h4>
              <ul className="text-[11px] text-text-secondary space-y-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">1.</span>
                  Messages are sent to the highest priority (lowest number) active provider first
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">2.</span>
                  If the primary provider fails, the system automatically tries the next provider
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">3.</span>
                  Conversation context is preserved across provider switches
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">4.</span>
                  If all providers fail, a fallback response is generated automatically
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <AddProviderDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddProvider}
        existingCount={providers.length}
      />
    </>
  );
};

export { AiProviderSettings };
