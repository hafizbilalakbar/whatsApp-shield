import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Archive, Pin, Star, X, Phone, User, Loader2, Trash2, Shield, Download, Check, MessageSquare, CheckSquare, Square, ListChecks } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useMessageAgent } from '../MessageAgentPage';
import { ContactAvatar } from './ContactAvatar';
import { SkeletonChatList } from '../../components/ui/SkeletonChat';

const NewContactDialog = ({ isOpen, onClose, onAdd }) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!phone.trim()) return;
    setIsAdding(true);
    await onAdd({
      phone: phone.startsWith('+') ? phone : `+${phone}`,
      name: name.trim() || null,
      country: country.trim() || 'Unknown',
    });    setIsAdding(false);
    setPhone('');
    setName('');
    setCountry('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setPhone('');
    setName('');
    setCountry('');
    setIsAdding(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xs dialog-panel rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-3 dialog-header">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-bold text-text-primary">Add New Contact</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-background transition-colors">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">Start a new conversation manually</p>
        </div>
        
        <div className="p-3 space-y-2">
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">Phone Number *</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="pl-9 h-9 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5 block">Contact Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="pl-9 h-9 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5 block">Country</label>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="United States"
              className="h-9 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>
        
        <div className="p-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button 
            size="sm" 
            onClick={handleAdd} 
            disabled={!phone.trim() || isAdding}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {isAdding ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Plus size={14} className="mr-1.5" />}
            Add Contact
          </Button>
        </div>
      </div>
    </div>
  );
};

const ShieldImportDialog = ({ isOpen, onClose }) => {
  const [shieldContacts, setShieldContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterRegistration, setFilterRegistration] = useState('registered');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [slots, setSlots] = useState([]);
  const [countries, setCountries] = useState([]);
  const [limit, setLimit] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadShieldContacts();
    }
  }, [isOpen]);

  // Reset all transient state every time the dialog opens so a previous
  // import's result/selection can never block or stale a fresh open.
  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setImportResult(null);
    setShowDeleteConfirm(false);
    setDeleteMode(null);
    setDeleting(false);
    setImporting(false);
  }, [isOpen]);

  const loadShieldContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCountry) params.set('country', filterCountry);
      if (filterRegistration !== 'all') params.set('registration', filterRegistration);
      if (filterCampaign) params.set('campaignId', filterCampaign);
      const res = await fetch(`/api/message-agent/shield-contacts?${params}`);
      const data = await res.json();
      if (data.success) {
        setShieldContacts(data.contacts || []);
        setSlots(data.slots || []);
        setCountries(data.countries || []);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) loadShieldContacts();
  }, [filterCountry, filterRegistration, filterCampaign]);

  const displayedContacts = limit > 0 ? shieldContacts.slice(0, limit) : shieldContacts;

  // Only registered, valid-format WhatsApp numbers may be imported.
  const isImportable = (c) => c?.exists === true && c?.isValidFormat !== false && !c?.error;
  const importableCount = displayedContacts.filter(isImportable).length;

  const toggleSelect = (phone) => {
    const contact = displayedContacts.find(c => c.phone === phone);
    if (contact && !isImportable(contact)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === importableCount && importableCount > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayedContacts.filter(isImportable).map(c => c.phone)));
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    const allContacts = shieldContacts.filter(c => selected.has(c.phone));
    const contactsToImport = limit > 0 ? allContacts.slice(0, Math.min(limit, 1000)) : allContacts;
    try {
      const res = await fetch('/api/message-agent/import-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contactsToImport, mode: 'manual' })
      });
      const data = await res.json();
      if (data.success) {
        setImportResult({ added: data.added, skipped: data.skipped });
      }
    } catch {
      // silently fail
    }
    setImporting(false);
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const phones = Array.from(selected);
      await fetch('/api/message-agent/shield-contacts/delete-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones })
      });
      setSelected(new Set());
      setShowDeleteConfirm(false);
      setDeleteMode(null);
      loadShieldContacts();
    } catch {
      // silently fail
    }
    setDeleting(false);
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await fetch('/api/message-agent/shield-contacts/delete-all', { method: 'POST' });
      setSelected(new Set());
      setShowDeleteConfirm(false);
      setDeleteMode(null);
      loadShieldContacts();
    } catch {
      // silently fail
    }
    setDeleting(false);
  };

  const confirmDelete = (mode) => {
    setDeleteMode(mode);
    setShowDeleteConfirm(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl dialog-panel rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="p-3 dialog-header flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              Import from WhatsApp Shield
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">Select detected numbers to import as contacts</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-background">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        {importResult ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-success" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Import Complete</h3>
            <p className="text-sm text-text-secondary mb-4">
              {importResult.added} contacts imported, {importResult.skipped} already existed
            </p>
            <Button onClick={() => { setImportResult(null); setSelected(new Set()); onClose(); }}>
              Done
            </Button>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap shrink-0 bg-background/50">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-text-muted">Country</label>
                <select
                  value={filterCountry}
                  onChange={e => setFilterCountry(e.target.value)}
                  className="h-8 text-xs select-field rounded-lg px-2"
                >
                  <option value="">All Countries</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-text-muted">Status</label>
                <select
                  value={filterRegistration}
                  onChange={e => setFilterRegistration(e.target.value)}
                  className="h-8 text-xs select-field rounded-lg px-2"
                >
                  <option value="all">All</option>
                  <option value="registered">Registered Only</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-text-muted">Campaign</label>
                <select
                  value={filterCampaign}
                  onChange={e => setFilterCampaign(e.target.value)}
                  className="h-8 text-xs select-field rounded-lg px-2 max-w-[160px]"
                >
                  <option value="">All Campaigns</option>
                  {slots.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.date ? new Date(s.date).toLocaleDateString() : 'Unknown'} ({s.registered}/{s.totalChecked})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-text-muted">Show</label>
                <select
                  value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                  className="h-8 text-xs select-field rounded-lg px-2"
                >
                  <option value={0}>All ({shieldContacts.length})</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
              </div>
            </div>

            <div className="px-3 py-1.5 border-b border-border flex items-center justify-between shrink-0">
              <span className="text-xs text-text-muted">
                {displayedContacts.length} contacts {limit > 0 && shieldContacts.length > limit ? `(showing ${limit} of ${shieldContacts.length})` : ''}
              </span>
              {displayedContacts.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  {selected.size === importableCount && importableCount > 0 ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 size={24} className="animate-spin text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">Loading contacts...</p>
                </div>
              ) : displayedContacts.length === 0 ? (
                <div className="p-8 text-center">
                  <Shield size={32} className="text-text-muted/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-secondary mb-2">No Contacts Found</p>
                  <p className="text-xs text-text-muted">Run a number validation campaign to detect WhatsApp numbers</p>
                </div>
              ) : (
                displayedContacts.map((contact) => {
                  const importable = isImportable(contact);
                  return (
                  <label
                    key={contact.phone}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 transition-colors border-b border-border/50",
                      importable ? "hover:bg-background cursor-pointer" : "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(contact.phone)}
                      onChange={() => toggleSelect(contact.phone)}
                      disabled={!importable}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary disabled:opacity-40"
                    />
                    <ContactAvatar contact={contact} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{contact.name}</p>
                      <p className="text-xs text-text-muted">{contact.phone}</p>
                    </div>
                    {importable ? (
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 shrink-0">
                        WhatsApp
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20 shrink-0">
                        Not Registered
                      </Badge>
                    )}
                  </label>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">{selected.size} selected</span>
                {selected.size > 0 && (
                  <button
                    onClick={() => confirmDelete('selected')}
                    className="text-xs text-error hover:text-error/80 font-medium"
                  >
                    Delete Selected
                  </button>
                )}
                {shieldContacts.length > 0 && (
                  <button
                    onClick={() => confirmDelete('all')}
                    className="text-xs text-error/70 hover:text-error font-medium"
                  >
                    Delete All
                  </button>
                )}
              </div>
              <Button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {importing ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Download size={14} className="mr-1.5" />}
                Import {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            </div>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl p-6">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={20} className="text-error" />
              </div>
              <h3 className="text-base font-semibold text-text-primary text-center mb-2">
                {deleteMode === 'all' ? 'Delete All Contacts?' : `Delete ${selected.size} Selected?`}
              </h3>
              <p className="text-sm text-text-secondary text-center mb-6">
                {deleteMode === 'all'
                  ? 'This will permanently remove all imported contacts. This action cannot be undone.'
                  : `This will permanently remove ${selected.size} selected contact(s). This action cannot be undone.`
                }
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteMode(null); }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-error hover:bg-error/90 text-white"
                  onClick={deleteMode === 'all' ? handleDeleteAll : handleDeleteSelected}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Trash2 size={14} className="mr-1.5" />}
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ContextMenu = ({ isOpen, onClose, conversation, onAction, position }) => {
  const menuRef = useRef(null);
  
  useEffect(() => {
    if (isOpen && menuRef.current && position) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      let x = position.x;
      let y = position.y;
      
      if (x + rect.width > vw - 10) x = vw - rect.width - 10;
      if (y + rect.height > vh - 10) y = vh - rect.height - 10;
      if (x < 10) x = 10;
      if (y < 10) y = 10;
      
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
    }
  }, [isOpen, position]);

  if (!isOpen || !conversation) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div 
        ref={menuRef}
        className="absolute z-50 w-56 dialog-panel rounded-xl shadow-2xl overflow-hidden py-1"
        style={{ top: position?.y || '50%', left: position?.x || '50%' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => { onAction('pin', !conversation.pinned); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-background transition-colors"
        >
          <Pin size={13} className={conversation.pinned ? "text-warning" : "text-text-muted"} />
          {conversation.pinned ? 'Unpin Chat' : 'Pin Chat'}
        </button>
        <button
          onClick={() => { onAction('star', !conversation.starred); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-background transition-colors"
        >
          <Star size={13} className={conversation.starred ? "text-warning" : "text-text-muted"} />
          {conversation.starred ? 'Unstar' : 'Star Chat'}
        </button>
        <button
          onClick={() => { onAction('archive', !conversation.archived); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-background transition-colors"
        >
          <Archive size={13} className="text-text-muted" />
          {conversation.archived ? 'Unarchive' : 'Archive Chat'}
        </button>
        <div className="border-t border-border my-1" />
        <button
          onClick={() => { onAction('delete'); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-error hover:bg-error/10 transition-colors"
        >
          <Trash2 size={13} />
          Delete Chat
        </button>
      </div>
    </div>
  );
};

const ChatSidebar = () => {
  const { 
    conversations, activeConversation, setActiveConversation, 
    searchQuery, setSearchQuery, conversationMode, setConversationMode, 
    filteredConversations, isLoading, createConversation, deleteConversation,
    updateConversation, loadConversations, setConversations
  } = useMessageAgent();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showShieldImport, setShowShieldImport] = useState(false);
  const [contextMenu, setContextMenu] = useState({ show: false, conversation: null, position: { x: 0, y: 0 } });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === filteredConversations.length && filteredConversations.length > 0
        ? new Set()
        : new Set(filteredConversations.map(c => c.id))
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const selected = conversations.filter(c => selectedIds.has(c.id));
      const phones = selected.map(c => c.contact?.phone).filter(Boolean);
      if (phones.length > 0) {
        await fetch('/api/message-agent/contacts/delete-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones })
        });
      }
      setConversations(prev => prev.filter(c => !selectedIds.has(c.id)));
      if (activeConversation && selectedIds.has(activeConversation.id)) {
        setActiveConversation(null);
      }
      exitSelectMode();
      setShowBulkDelete(false);
    } catch (err) {
      console.error('Error bulk deleting conversations:', err);
    }
    setBulkDeleting(false);
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'ai': return 'bg-success/10 text-success border-success/20';
      case 'manual': return 'bg-info/10 text-info border-info/20';
      case 'pinned': return 'bg-warning/10 text-warning border-warning/20';
      case 'starred': return 'bg-warning/10 text-warning border-warning/20';
      case 'archived': return 'bg-background text-text-muted border-border';
      default: return 'bg-background text-text-muted border-border';
    }
  };

  const getModeLabel = (mode) => {
    switch (mode) {
      case 'ai': return 'AI';
      case 'manual': return 'Manual';
      case 'pinned': return 'Pinned';
      case 'starred': return 'Starred';
      case 'archived': return 'Archived';
      default: return 'All';
    }
  };

  const modeCounts = useMemo(() => {
    const all = conversations.filter(c => !c.archived);
    return {
      all: all.length,
      ai: all.filter(c => c.mode === 'ai').length,
      manual: all.filter(c => c.mode === 'manual').length,
      pinned: all.filter(c => c.pinned).length,
      starred: all.filter(c => c.starred).length,
      archived: conversations.filter(c => c.archived).length,
    };
  }, [conversations]);

  const handleNewContact = async (contactData) => {
    const conv = await createConversation(
      contactData.phone, 
      'manual', 
      { name: contactData.name, country: contactData.country, source: 'manual' }
    );
    if (conv) {
      setTimeout(async () => {
        await loadConversations();
      }, 200);
    }
  };

  const handleContextMenuAction = async (action, value) => {
    const conv = contextMenu.conversation;
    if (!conv) return;

    switch (action) {
      case 'pin':
        await updateConversation(conv.id, { pinned: value });
        break;
      case 'star':
        await updateConversation(conv.id, { starred: value });
        break;
      case 'archive':
        await updateConversation(conv.id, { archived: value });
        if (activeConversation?.id === conv.id) {
          setActiveConversation(null);
        }
        break;
      case 'delete':
        await deleteConversation(conv.id);
        break;
    }
  };

  const handleSelectConversation = async (conv) => {
    setActiveConversation(conv);
    if (conv.unread > 0) {
      await updateConversation(conv.id, { unread: 0 });
    }
  };

  const handleQuickDelete = async (e, conv) => {
    e.stopPropagation();
    await deleteConversation(conv.id);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getLastMessagePreview = (conv) => {
    if (!conv.lastMessage) return 'No messages yet';
    const text = typeof conv.lastMessage.text === 'string' ? conv.lastMessage.text : '';
    if (conv.lastMessage.from === 'ai') return `\u{1F916} ${text}`;
    if (conv.lastMessage.from === 'me') return `You: ${text}`;
    return text;
  };

  return (
    <div className="msg-sidebar border-r border-[#374151] bg-[#0f1419] flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header — "Chats" + actions */}
      <div className="msg-sidebar-header">
        <h2 className="text-[20px] font-bold text-[#e5e7eb] leading-none">Chats</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            title={selectMode ? 'Exit selection mode' : 'Select multiple chats'}
            className="msg-icon-btn"
          >
            {selectMode ? <CheckSquare size={20} className="text-[#25d366]" /> : <ListChecks size={20} />}
          </button>
          <button
            onClick={() => setShowShieldImport(true)}
            title="Import from WhatsApp Shield"
            className="msg-icon-btn"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => setShowNewContact(true)}
            title="Add new contact"
            className="msg-icon-btn"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
      
      {/* Search bar */}
      <div className="msg-sidebar-search">
        <div className="relative">
          <Search size={16} className={cn("absolute left-3 top-1/2 -translate-y-1/2 transition-colors", isSearchFocused ? "text-[#25d366]" : "text-[#6b7280]")} />
          <input
            placeholder="Search or start a new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="msg-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#e5e7eb]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="msg-filter-tabs">
        {['all', 'ai', 'manual', 'pinned', 'starred', 'archived'].map(mode => (
          <button
            key={mode}
            onClick={() => setConversationMode(mode)}
            className={cn("msg-filter-tab", conversationMode === mode && "active")}
          >
            {getModeLabel(mode)}
            <span className="msg-filter-badge">{modeCounts[mode] || 0}</span>
          </button>
        ))}
      </div>

      {/* Selection Toolbar */}
      {selectMode && (
        <div className="px-2.5 py-1 border-b border-border bg-background/60 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-medium text-text-secondary">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-[11px] font-medium text-primary hover:text-primary/80"
            >
              {selectedIds.size === filteredConversations.length && filteredConversations.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={exitSelectMode}
              className="text-[11px] text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || bulkDeleting}
              className="text-[11px] font-medium text-error hover:text-error/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {bulkDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              {bulkDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="msg-conv-list">
        {isLoading && conversations.length === 0 ? (
          <SkeletonChatList count={7} />
        ) : (
          <AnimatePresence>
            {filteredConversations.map((conv) => (
              <motion.div
                key={conv.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => selectMode ? toggleSelect(conv.id) : handleSelectConversation(conv)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!selectMode) setContextMenu({ show: true, conversation: conv, position: { x: e.clientX, y: e.clientY } });
                }}
                className={cn(
                  "msg-conv-item group border-b border-[#2d3748] last:border-b-0",
                  selectMode
                    ? selectedIds.has(conv.id) ? "bg-primary/10" : "hover:bg-background"
                    : activeConversation?.id === conv.id
                      ? "active"
                      : "hover:bg-[#1f2937]"
                )}
              >
                {selectMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(conv.id); }}
                    className="shrink-0"
                    title="Select chat"
                  >
                    {selectedIds.has(conv.id)
                      ? <CheckSquare size={16} className="text-primary" />
                      : <Square size={16} className="text-text-muted" />}
                  </button>
                )}

                <ContactAvatar contact={conv.contact} status={conv.status} size="sm" />

                <div className="flex-1 min-w-0 h-full flex flex-col justify-center gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <h3 className={cn(
                        "text-[13px] truncate leading-tight text-[#e5e7eb]",
                        conv.unread > 0 ? "font-semibold" : "font-medium"
                      )}>
                        {conv.contact.name}
                      </h3>
                      {conv.pinned && <Pin size={9} className="text-warning shrink-0" />}
                      {conv.starred && <Star size={9} className="text-warning fill-warning shrink-0" />}
                      {conv.mode === 'ai' && <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-[10px] text-[#6b7280] leading-none">
                        {formatTime(conv.lastMessage?.timestamp)}
                      </span>
                      {conv.unread > 0 && (
                        <span className="min-w-[18px] h-[18px] rounded-full bg-[#25d366] text-[#0f1419] text-[10px] font-semibold flex items-center justify-center px-1 leading-none">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <p className={cn(
                      "text-[11px] truncate flex-1 min-w-0 leading-tight text-[#9ca3af]"
                    )}>
                      {getLastMessagePreview(conv)}
                    </p>
                    {!selectMode && (
                      <button
                        onClick={(e) => handleQuickDelete(e, conv)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-opacity shrink-0"
                        title="Delete chat"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        
        {filteredConversations.length === 0 && !isLoading && (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mx-auto mb-3">
              <MessageSquare size={20} className="text-text-muted" />
            </div>
            <p className="text-text-secondary text-sm font-medium mb-1">No conversations yet</p>
            <p className="text-text-muted text-xs mb-4 max-w-[220px] mx-auto">Import contacts from WhatsApp Shield or add a contact to start messaging.</p>
            <div className="flex flex-col gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => setShowNewContact(true)} className="h-8 text-xs gap-1.5">
                <Plus size={13} />
                Add Contact
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowShieldImport(true)} className="h-8 text-xs gap-1.5 text-primary border-primary/20">
                <Download size={13} />
                Import from Shield
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.show}
        onClose={() => setContextMenu({ show: false, conversation: null, position: { x: 0, y: 0 } })}
        conversation={contextMenu.conversation}
        position={contextMenu.position}
        onAction={handleContextMenuAction}
      />

      {/* New Contact Dialog */}
      <NewContactDialog
        isOpen={showNewContact}
        onClose={() => setShowNewContact(false)}
        onAdd={handleNewContact}      />

      {/* Shield Import Dialog */}
      <ShieldImportDialog
        isOpen={showShieldImport}
        onClose={() => {
          setShowShieldImport(false);
          loadConversations();
        }}
      />

      {/* Bulk Delete Confirmation */}
      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkDelete(false)}>
          <div
            className="dialog-panel w-full max-w-sm rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Delete {selectedIds.size} chat{selectedIds.size !== 1 ? 's' : ''}?</h3>
            </div>
            <div className="p-4">
              <p className="text-xs text-text-secondary leading-relaxed">
                This will permanently remove the selected conversations and their linked contacts. This action cannot be undone.
              </p>
            </div>
            <div className="p-3 border-t border-border flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowBulkDelete(false)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-error hover:bg-error/90 text-white"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Trash2 size={14} className="mr-1.5" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { ChatSidebar };
