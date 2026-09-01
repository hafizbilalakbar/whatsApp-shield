import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Archive, Pin, Star, X, Phone, User, Loader2, Trash2, Shield, Download, Check, MessageSquare, CheckSquare, Square, ListChecks, ChevronDown, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Button } from '../../components/ui/Button';
import { useMessageAgent } from '../MessageAgentPage';
import { ContactAvatar } from './ContactAvatar';
import { SkeletonChatList } from '../../components/ui/SkeletonChat';

const CONTACT_ROW_HEIGHT = 56;

const NewContactDialog = memo(({ isOpen, onClose, onAdd }) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const phoneInputRef = useRef(null);

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
    setError('');
    setSuccess(false);
    const t = setTimeout(() => phoneInputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen]);

  const validatePhone = useCallback((val) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length < 7) return 'Phone number must be at least 7 digits';
    if (digits.length > 15) return 'Phone number is too long';
    return '';
  }, []);

  const handleAdd = async () => {
    const trimmed = phone.trim();
    if (!trimmed) { setError('Phone number is required'); return; }
    const validationErr = validatePhone(trimmed);
    if (validationErr) { setError(validationErr); return; }
    setError('');
    setIsAdding(true);
    try {
      await onAdd({
        phone: trimmed.startsWith('+') ? trimmed : `+${trimmed}`,
        name: name.trim() || null,
        country: country.trim() || 'Unknown',
      });
      setSuccess(true);
      setTimeout(() => { onClose(); }, 800);
    } catch (err) {
      setError('Failed to add contact. Please try again.');
    }
    setIsAdding(false);
  };

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm dialog-panel rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="dialog-header px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--ma-accent)]/10 flex items-center justify-center">
                <Plus size={16} className="text-[var(--ma-accent)]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ma-list-title)' }}>Add New Contact</h2>
                <p className="text-[11px]" style={{ color: 'var(--ma-muted-text)' }}>Start a new conversation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ color: 'var(--ma-muted-text)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ma-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 text-center"
          >
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
              <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--ma-list-title)' }}>Contact Added</p>
          </motion.div>
        ) : (
          <>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--ma-muted-text)' }}>
                  Phone Number <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ma-muted-text)' }} />
                  <input
                    ref={phoneInputRef}
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); if (error) setError(''); }}
                    placeholder="+1 234 567 8900"
                    className="w-full h-9 text-xs rounded-lg pl-8 pr-3 outline-none transition-colors"
                    style={{
                      backgroundColor: 'var(--ma-bg-elevated)',
                      border: `1px solid ${error ? 'var(--error)' : 'var(--ma-input-border)'}`,
                      color: 'var(--ma-input-text)',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--ma-accent)'}
                    onBlur={(e) => e.target.style.borderColor = error ? 'var(--error)' : 'var(--ma-input-border)'}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                </div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] mt-1 flex items-center gap-1"
                    style={{ color: 'var(--error)' }}
                  >
                    <AlertCircle size={11} /> {error}
                  </motion.p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--ma-muted-text)' }}>
                  Contact Name
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ma-muted-text)' }} />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full h-9 text-xs rounded-lg pl-8 pr-3 outline-none transition-colors"
                    style={{
                      backgroundColor: 'var(--ma-bg-elevated)',
                      border: '1px solid var(--ma-input-border)',
                      color: 'var(--ma-input-text)',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--ma-accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--ma-input-border)'}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--ma-muted-text)' }}>
                  Country
                </label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United States"
                  className="w-full h-9 text-xs rounded-lg px-3 outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--ma-bg-elevated)',
                    border: '1px solid var(--ma-input-border)',
                    color: 'var(--ma-input-text)',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--ma-accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--ma-input-border)'}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--ma-line-slim)' }}>
              <button
                onClick={onClose}
                className="h-8 px-3 rounded-lg text-xs font-medium transition-colors"
                style={{ color: 'var(--ma-muted-text)', border: '1px solid var(--ma-input-border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ma-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!phone.trim() || isAdding}
                className="h-8 px-4 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--ma-accent)' }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--ma-accent-hover)'; }}
                onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--ma-accent)'; }}
              >
                {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {isAdding ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  );
});

const ShieldImportDialog = memo(({ isOpen, onClose }) => {
  const { loadConversations, setConversations } = useMessageAgent();
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
  const [initialLoaded, setInitialLoaded] = useState(false);
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setImportResult(null);
    setShowDeleteConfirm(false);
    setDeleteMode(null);
    setDeleting(false);
    setImporting(false);
    setInitialLoaded(false);
  }, [isOpen]);

  const loadShieldContacts = useCallback(async (overrideCountry, overrideRegistration, overrideCampaign) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const fetchId = ++fetchIdRef.current;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (overrideCountry !== undefined ? overrideCountry : filterCountry) params.set('country', overrideCountry !== undefined ? overrideCountry : filterCountry);
      const reg = overrideRegistration !== undefined ? overrideRegistration : filterRegistration;
      if (reg && reg !== 'all') params.set('registration', reg);
      if (overrideCampaign !== undefined ? overrideCampaign : filterCampaign) params.set('campaignId', overrideCampaign !== undefined ? overrideCampaign : filterCampaign);
      const res = await fetch(`/api/message-agent/shield-contacts?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (data.success && fetchId === fetchIdRef.current) {
        setShieldContacts(data.contacts || []);
        setSlots(data.slots || []);
        setCountries(data.countries || []);
        setInitialLoaded(true);
      }
    } catch (err) {
      if (err.name !== 'AbortError') { /* silently fail */ }
    }
    if (fetchId === fetchIdRef.current) setLoading(false);
  }, [filterCountry, filterRegistration, filterCampaign]);

  useEffect(() => {
    if (!isOpen) return;
    loadShieldContacts();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !initialLoaded) return;
    loadShieldContacts();
  }, [filterCountry, filterRegistration, filterCampaign]);

  const displayedContacts = useMemo(() => {
    return limit > 0 ? shieldContacts.slice(0, limit) : shieldContacts;
  }, [shieldContacts, limit]);

  const isImportable = useCallback((c) => c?.exists === true && c?.isValidFormat !== false && !c?.error, []);

  const importableCount = useMemo(() => displayedContacts.filter(isImportable).length, [displayedContacts, isImportable]);

  const toggleSelect = useCallback((phone) => {
    const contact = displayedContacts.find(c => c.phone === phone);
    if (contact && !isImportable(contact)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }, [displayedContacts, isImportable]);

  const toggleSelectAll = useCallback(() => {
    setSelected(prev => {
      if (prev.size === importableCount && importableCount > 0) return new Set();
      return new Set(displayedContacts.filter(isImportable).map(c => c.phone));
    });
  }, [displayedContacts, importableCount, isImportable]);

  const handleImport = useCallback(async () => {
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
        const skippedPhones = new Set(
          (data.skipped || []).map(p => String(p).replace(/\D/g, ''))
        );
        const newlyImported = contactsToImport.filter(c => {
          const digits = String(c.phone || c.number || '').replace(/\D/g, '');
          return digits && (skippedPhones.size === 0 || !skippedPhones.has(digits));
        });
        setSelected(new Set());
        await loadConversations();
        setConversations(prev => {
          const existingByPhone = new Set();
          prev.forEach(conv => {
            const digits = String(conv.contact?.phone || '').replace(/\D/g, '');
            if (digits) existingByPhone.add(digits);
          });
          const missing = newlyImported
            .filter(c => {
              const digits = String(c.phone || c.number || '').replace(/\D/g, '');
              return digits && !existingByPhone.has(digits);
            })
            .map(c => {
              const digits = String(c.phone || c.number || '').replace(/\D/g, '');
              const e164 = (c.phone || c.number || '').startsWith('+')
                ? (c.phone || c.number)
                : `+${digits}`;
              return {
                id: `contact_${digits}_${Date.now()}`,
                contact: {
                  name: c.name || e164,
                  phone: e164,
                  country: c.country || c.detectedCountry || 'Unknown',
                  avatar: c.avatar || null,
                  about: c.about || '',
                  exists: c.exists !== false,
                  isVerified: c.isVerified || false,
                  isBusiness: c.isBusiness || false,
                },
                lastMessage: null,
                unread: 0,
                mode: 'manual',
                pinned: false,
                archived: false,
                starred: false,
                tags: [],
                notes: '',
                notesList: [],
                journey: 'new_lead',
                aiObjective: 'lead_qualification',
                crm: null,
                messages: [],
                status: 'offline',
                createdAt: new Date().toISOString(),
                source: 'whatsapp_shield',
              };
            });
          if (missing.length === 0) return prev;
          return [...missing, ...prev];
        });
        try { await loadShieldContacts(); } catch { /* non-fatal */ }
        window.dispatchEvent(new CustomEvent('ws-toast', {
          detail: { message: `${data.added} contact${data.added === 1 ? '' : 's'} imported${data.skipped ? `. ${data.skipped} skipped` : ''}`, type: 'success' }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('ws-toast', {
          detail: { message: data.error || 'Failed to import contacts.', type: 'error' }
        }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent('ws-toast', {
        detail: { message: 'Import failed. Check connection and try again.', type: 'error' }
      }));
    }
    setImporting(false);
  }, [selected, shieldContacts, limit, loadConversations, setConversations, loadShieldContacts]);

  const handleDeleteSelected = useCallback(async () => {
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
    } catch { /* silently fail */ }
    setDeleting(false);
  }, [selected, loadShieldContacts]);

  const handleDeleteAll = useCallback(async () => {
    setDeleting(true);
    try {
      await fetch('/api/message-agent/shield-contacts/delete-all', { method: 'POST' });
      setSelected(new Set());
      setShowDeleteConfirm(false);
      setDeleteMode(null);
      loadShieldContacts();
    } catch { /* silently fail */ }
    setDeleting(false);
  }, [loadShieldContacts]);

  const confirmDelete = useCallback((mode) => {
    setDeleteMode(mode);
    setShowDeleteConfirm(true);
  }, []);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg sm:max-w-xl dialog-panel rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'min(85vh, 640px)' }}
      >
        {/* Header */}
        <div className="dialog-header px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--ma-accent) 12%, transparent)' }}>
              <Shield size={16} style={{ color: 'var(--ma-accent)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--ma-list-title)' }}>Import from WhatsApp Shield</h2>
              <p className="text-[11px]" style={{ color: 'var(--ma-muted-text)' }}>Select detected numbers to import</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--ma-muted-text)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ma-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={14} />
          </button>
        </div>

        {importResult ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 text-center"
          >
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
              <Check size={24} style={{ color: 'var(--success)' }} />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--ma-list-title)' }}>Import Complete</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--ma-muted-text)' }}>
              {importResult.added} contacts imported, {importResult.skipped} already existed
            </p>
            <button
              onClick={() => { setImportResult(null); setSelected(new Set()); onClose(); }}
              className="h-9 px-6 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--ma-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--ma-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--ma-accent)'}
            >
              Done
            </button>
          </motion.div>
        ) : (
          <>
            {/* Filters */}
            <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap shrink-0" style={{ borderColor: 'var(--ma-line-slim)', backgroundColor: 'color-mix(in srgb, var(--ma-bg-panel) 80%, transparent)' }}>
              <FilterSelect
                label="Country"
                value={filterCountry}
                onChange={(v) => { setFilterCountry(v); }}
                options={[{ value: '', label: 'All Countries' }, ...countries.map(c => ({ value: c, label: c }))]}
              />
              <FilterSelect
                label="Status"
                value={filterRegistration}
                onChange={(v) => setFilterRegistration(v)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'registered', label: 'Registered' },
                ]}
              />
              <FilterSelect
                label="Campaign"
                value={filterCampaign}
                onChange={(v) => setFilterCampaign(v)}
                options={[
                  { value: '', label: 'All Campaigns' },
                  ...slots.map(s => ({
                    value: s.id,
                    label: `${s.date ? new Date(s.date).toLocaleDateString() : 'Unknown'} (${s.registered}/${s.totalChecked})`
                  }))
                ]}
                className="max-w-[140px] sm:max-w-[160px]"
              />
              <FilterSelect
                label="Show"
                value={String(limit)}
                onChange={(v) => setLimit(Number(v))}
                options={[
                  { value: '0', label: `All (${shieldContacts.length})` },
                  { value: '100', label: '100' },
                  { value: '500', label: '500' },
                  { value: '1000', label: '1000' },
                ]}
              />
            </div>

            {/* Info bar */}
            <div className="px-3 py-1.5 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--ma-line-slim)' }}>
              <span className="text-[11px]" style={{ color: 'var(--ma-muted-text)' }}>
                {displayedContacts.length} contacts{limit > 0 && shieldContacts.length > limit ? ` (showing ${limit} of ${shieldContacts.length})` : ''}
              </span>
              {displayedContacts.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-[11px] font-medium transition-colors"
                  style={{ color: 'var(--ma-accent)' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {selected.size === importableCount && importableCount > 0 ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {/* Contact list */}
            <div ref={listRef} className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--ma-scroll-thumb) transparent' }}>
              {loading && !initialLoaded ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'color-mix(in srgb, var(--ma-accent) 20%, transparent)' }} />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: 'var(--ma-accent)' }} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--ma-muted-text)' }}>Loading contacts...</p>
                </div>
              ) : displayedContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--ma-muted-text) 8%, transparent)' }}>
                    <Shield size={20} style={{ color: 'var(--ma-muted-text)', opacity: 0.5 }} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: 'var(--ma-muted-text)' }}>No Contacts Found</p>
                  <p className="text-[11px] max-w-[200px] text-center" style={{ color: 'var(--ma-muted-text)', opacity: 0.7 }}>
                    Run a validation campaign to detect WhatsApp numbers
                  </p>
                </div>
              ) : (
                <div>
                  {displayedContacts.map((contact) => (
                    <ContactRow
                      key={contact.phone}
                      contact={contact}
                      selected={selected.has(contact.phone)}
                      importable={isImportable(contact)}
                      onToggle={toggleSelect}
                    />
                  ))}
                </div>
              )}
              {loading && initialLoaded && (
                <div className="px-3 py-2 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--ma-accent) 20%, transparent)', borderTopColor: 'var(--ma-accent)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--ma-muted-text)' }}>Refreshing...</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2.5 border-t flex items-center justify-between shrink-0" style={{ borderColor: 'var(--ma-line-slim)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[11px] font-medium" style={{ color: 'var(--ma-list-title)' }}>
                  {selected.size} selected
                </span>
                {selected.size > 0 && (
                  <button
                    onClick={() => confirmDelete('selected')}
                    className="text-[11px] font-medium transition-colors"
                    style={{ color: 'var(--error)' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Delete Selected
                  </button>
                )}
                {shieldContacts.length > 0 && (
                  <button
                    onClick={() => confirmDelete('all')}
                    className="text-[11px] font-medium transition-colors hidden sm:block"
                    style={{ color: 'color-mix(in srgb, var(--error) 60%, transparent)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'color-mix(in srgb, var(--error) 60%, transparent)'}
                  >
                    Delete All
                  </button>
                )}
              </div>
              <button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="h-8 px-4 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--ma-accent)' }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--ma-accent-hover)'; }}
                onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--ma-accent)'; }}
              >
                {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {importing ? 'Importing...' : `Import${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </div>
          </>
        )}

        {/* Delete Confirmation */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-xs mx-4 dialog-panel rounded-xl shadow-2xl p-5"
              >
                <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--error) 12%, transparent)' }}>
                  <Trash2 size={18} style={{ color: 'var(--error)' }} />
                </div>
                <h3 className="text-sm font-semibold text-center mb-1" style={{ color: 'var(--ma-list-title)' }}>
                  {deleteMode === 'all' ? 'Delete All Contacts?' : `Delete ${selected.size} Selected?`}
                </h3>
                <p className="text-[11px] text-center mb-4" style={{ color: 'var(--ma-muted-text)' }}>
                  {deleteMode === 'all'
                    ? 'Permanently remove all imported contacts. This cannot be undone.'
                    : `Permanently remove ${selected.size} selected contact(s). This cannot be undone.`
                  }
                </p>
                <div className="flex gap-2">
                  <button
                    className="flex-1 h-8 rounded-lg text-xs font-medium transition-colors"
                    style={{ color: 'var(--ma-muted-text)', border: '1px solid var(--ma-input-border)' }}
                    onClick={() => { setShowDeleteConfirm(false); setDeleteMode(null); }}
                    disabled={deleting}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ma-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 h-8 rounded-lg text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-colors"
                    style={{ backgroundColor: 'var(--error)' }}
                    onClick={deleteMode === 'all' ? handleDeleteAll : handleDeleteSelected}
                    disabled={deleting}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
});

const FilterSelect = memo(({ label, value, onChange, options, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selectedOption = options.find(o => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={`relative flex items-center gap-1.5 ${className}`} ref={ref}>
      <span className="text-[10px] font-medium hidden sm:inline" style={{ color: 'var(--ma-muted-text)' }}>{label}</span>
      <button
        onClick={() => setOpen(!open)}
        className="h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors max-w-[160px] truncate"
        style={{
          backgroundColor: 'var(--ma-bg-elevated)',
          border: `1px solid ${open ? 'var(--ma-accent)' : 'var(--ma-input-border)'}`,
          color: 'var(--ma-input-text)',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ma-accent) 40%, var(--ma-input-border))'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = 'var(--ma-input-border)'; }}
      >
        <span className="truncate">{selectedOption?.label || options[0]?.label}</span>
        <ChevronDown size={10} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--ma-muted-text)' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 min-w-[140px] max-h-[200px] overflow-y-auto rounded-lg shadow-xl z-50 py-1"
            style={{
              backgroundColor: 'var(--ma-bg-elevated)',
              border: '1px solid var(--ma-line)',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--ma-scroll-thumb) transparent',
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors"
                style={{
                  color: String(value) === String(opt.value) ? 'var(--ma-accent)' : 'var(--ma-input-text)',
                  backgroundColor: String(value) === String(opt.value) ? 'color-mix(in srgb, var(--ma-accent) 8%, transparent)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (String(value) !== String(opt.value)) e.currentTarget.style.backgroundColor = 'var(--ma-hover)'; }}
                onMouseLeave={(e) => { if (String(value) !== String(opt.value)) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span className="truncate">{opt.label}</span>
                {String(value) === String(opt.value) && <Check size={10} style={{ color: 'var(--ma-accent)' }} className="shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const ContactRow = memo(({ contact, selected, importable, onToggle }) => {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 px-3 transition-colors border-b cursor-pointer",
        importable ? "" : "opacity-50 cursor-not-allowed"
      )}
      style={{
        borderColor: 'color-mix(in srgb, var(--ma-line-slim) 50%, transparent)',
        backgroundColor: selected ? 'color-mix(in srgb, var(--ma-accent) 8%, transparent)' : 'transparent',
        minHeight: `${CONTACT_ROW_HEIGHT}px`,
      }}
      onMouseEnter={(e) => { if (importable && !selected) e.currentTarget.style.backgroundColor = 'var(--ma-hover)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => importable && onToggle(contact.phone)}
        disabled={!importable}
        className="w-3.5 h-3.5 rounded shrink-0 accent-[var(--ma-accent)]"
        style={{ accentColor: 'var(--ma-accent)' }}
      />
      <ContactAvatar contact={contact} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ma-list-title)' }}>{contact.name}</p>
        <p className="text-[11px]" style={{ color: 'var(--ma-muted-text)' }}>{contact.phone}</p>
      </div>
      {importable ? (
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)',
            color: 'var(--success)',
            border: `1px solid color-mix(in srgb, var(--success) 20%, transparent)`,
          }}
        >
          WhatsApp
        </span>
      ) : (
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
            color: 'var(--warning)',
            border: `1px solid color-mix(in srgb, var(--warning) 20%, transparent)`,
          }}
        >
          Not Registered
        </span>
      )}
    </label>
  );
});

const ContextMenu = memo(({ isOpen, onClose, conversation, onAction, position }) => {
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
      <motion.div
        ref={menuRef}
        className="absolute z-50 w-48 dialog-panel rounded-xl shadow-2xl overflow-hidden py-1"
        style={{ top: position?.y || '50%', left: position?.x || '50%' }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.12 }}
      >
        <button
          onClick={() => { onAction('pin', !conversation.pinned); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors"
          style={{ color: 'var(--ma-list-title)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ma-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Pin size={12} style={{ color: conversation.pinned ? 'var(--warning)' : 'var(--ma-muted-text)' }} />
          {conversation.pinned ? 'Unpin Chat' : 'Pin Chat'}
        </button>
        <button
          onClick={() => { onAction('star', !conversation.starred); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors"
          style={{ color: 'var(--ma-list-title)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ma-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Star size={12} style={{ color: conversation.starred ? 'var(--warning)' : 'var(--ma-muted-text)' }} />
          {conversation.starred ? 'Unstar' : 'Star Chat'}
        </button>
        <button
          onClick={() => { onAction('archive', !conversation.archived); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors"
          style={{ color: 'var(--ma-list-title)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ma-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Archive size={12} style={{ color: 'var(--ma-muted-text)' }} />
          {conversation.archived ? 'Unarchive' : 'Archive Chat'}
        </button>
        <div className="my-1" style={{ borderTop: '1px solid var(--ma-line-slim)' }} />
        <button
          onClick={() => { onAction('delete'); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors"
          style={{ color: 'var(--error)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 8%, transparent)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 size={12} />
          Delete Chat
        </button>
      </motion.div>
    </div>
  );
});

const ConversationRow = memo(({ conv, selected, isActive, selectMode, formatTime, getLastMessagePreview, onClick, onContextMenu, onQuickDelete, onToggleSelect }) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectMode ? onToggleSelect(conv.id) : onClick(conv)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectMode ? onToggleSelect(conv.id) : onClick(conv); } }}
      onContextMenu={(e) => { e.preventDefault(); if (!selectMode) onContextMenu(conv, e); }}
      className={cn(
        "msg-conv-item group border-b border-[rgba(255,255,255,0.05)] last:border-b-0",
        selectMode
          ? selected ? "bg-[#00A884]/10" : "hover:bg-[#202C33]"
          : isActive
            ? "active"
            : "hover:bg-[#202C33]"
      )}
    >
      {selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(conv.id); }}
          className="shrink-0"
          title="Select chat"
        >
          {selected
            ? <CheckSquare size={16} className="text-[#00A884]" />
            : <Square size={16} className="text-[#8696A0]" />}
        </button>
      )}

      <ContactAvatar contact={conv.contact} status={conv.status} size="sm" />

      <div className="flex-1 min-w-0 h-full flex flex-col justify-center gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className={cn(
              "text-[13px] truncate leading-tight text-[#E9EDEF]",
              conv.unread > 0 ? "font-semibold" : "font-medium"
            )}>
              {conv.contact.name}
            </h3>
            {conv.pinned && <Pin size={9} className="text-[#F5BB45] shrink-0" />}
            {conv.starred && <Star size={9} className="text-[#F5BB45] fill-[#F5BB45] shrink-0" />}
            {conv.mode === 'ai' && <div className="w-1.5 h-1.5 rounded-full bg-[#00A884] shrink-0" />}
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span className="text-[10px] text-[#8696A0] leading-none">
              {formatTime(conv.lastMessage?.timestamp)}
            </span>
            {conv.unread > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-[#00A884] text-[#111B21] text-[10px] font-semibold flex items-center justify-center px-1 leading-none">
                {conv.unread}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <p className="text-[11px] truncate flex-1 min-w-0 leading-tight text-[#8696A0]">
            {getLastMessagePreview(conv)}
          </p>
          {!selectMode && (
            <button
              onClick={(e) => onQuickDelete(e, conv)}
              className="opacity-0 group-hover:opacity-100 text-[#8696A0] hover:text-error transition-opacity shrink-0"
              title="Delete chat"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

const ChatSidebar = () => {
  const {
    conversations, activeConversation, setActiveConversation,
    searchQuery, setSearchQuery, conversationMode, setConversationMode,
    filteredConversations, isLoading, hasLoadedOnce, loadError, createConversation, deleteConversation,
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

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === filteredConversations.length && filteredConversations.length > 0
        ? new Set()
        : new Set(filteredConversations.map(c => c.id))
    );
  }, [filteredConversations]);

  const handleBulkDelete = useCallback(async () => {
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
  }, [selectedIds, conversations, activeConversation, setConversations, setActiveConversation, exitSelectMode]);

  const handleNewContact = useCallback(async (contactData) => {
    const conv = await createConversation(
      contactData.phone,
      'manual',
      { name: contactData.name, country: contactData.country, source: 'manual' }
    );
    if (conv) {
      await loadConversations();
    }
  }, [createConversation, loadConversations]);

  const handleContextMenuAction = useCallback(async (action, value) => {
    const conv = contextMenu.conversation;
    if (!conv) return;
    switch (action) {
      case 'pin': await updateConversation(conv.id, { pinned: value }); break;
      case 'star': await updateConversation(conv.id, { starred: value }); break;
      case 'archive':
        await updateConversation(conv.id, { archived: value });
        if (activeConversation?.id === conv.id) setActiveConversation(null);
        break;
      case 'delete': await deleteConversation(conv.id); break;
    }
  }, [contextMenu.conversation, updateConversation, deleteConversation, activeConversation, setActiveConversation]);

  const handleSelectConversation = useCallback((conv) => {
    setActiveConversation(conv);
    if (conv.unread > 0) updateConversation(conv.id, { unread: 0 });
  }, [setActiveConversation, updateConversation]);

  const handleQuickDelete = useCallback(async (e, conv) => {
    e.stopPropagation();
    await deleteConversation(conv.id);
  }, [deleteConversation]);

  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  const getLastMessagePreview = useCallback((conv) => {
    if (!conv.lastMessage) return 'No messages yet';
    const text = typeof conv.lastMessage.text === 'string' ? conv.lastMessage.text : '';
    if (conv.lastMessage.from === 'ai') return `\u{1F916} ${text}`;
    if (conv.lastMessage.from === 'me') return `You: ${text}`;
    return text;
  }, []);

  // Skeleton only while the chat/contact data is genuinely still being fetched
  // for the first time. Once the loader has completed — even with 0 chats — we
  // never render fake rows again: background refreshes, imports and deletes
  // keep `hasLoadedOnce` true, so the real (possibly empty) state stays put.
  const showSkeleton = isLoading && !hasLoadedOnce;
  // Genuinely no conversations at all (not a filter/search miss).
  const showEmpty = !isLoading && hasLoadedOnce && conversations.length === 0;
  // Data exists but the current search/filter matches nothing.
  const showFilteredEmpty = !isLoading && hasLoadedOnce && conversations.length > 0 && filteredConversations.length === 0;
  // First-time fetch failed and we still have nothing to show — offer a retry
  // instead of an eternal skeleton or a misleading 'no conversations' panel.
  const showLoadError = !isLoading && !hasLoadedOnce && !!loadError;

  return (
    <div className="msg-sidebar border-r border-[var(--ma-line)] bg-[var(--ma-bg-panel)] flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="msg-sidebar-header">
        <h2 className="text-[20px] font-bold text-[#E9EDEF] leading-none">Chats</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            title={selectMode ? 'Exit selection mode' : 'Select multiple chats'}
            className="msg-icon-btn"
          >
            {selectMode ? <CheckSquare size={20} className="text-[#00A884]" /> : <ListChecks size={20} />}
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
          <Search size={16} className={cn("absolute left-3 top-1/2 -translate-y-1/2 transition-colors", isSearchFocused ? "text-[#00A884]" : "text-[#8696A0]")} />
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696A0] hover:text-[#E9EDEF]"
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
            {mode === 'ai' ? 'AI' : mode.charAt(0).toUpperCase() + mode.slice(1)}
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
        {showSkeleton ? (
          <SkeletonChatList count={7} />
        ) : (
          <>
            {filteredConversations.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                selected={selectedIds.has(conv.id)}
                isActive={activeConversation?.id === conv.id}
                selectMode={selectMode}
                formatTime={formatTime}
                getLastMessagePreview={getLastMessagePreview}
                onClick={handleSelectConversation}
                onContextMenu={(c, e) => setContextMenu({ show: true, conversation: c, position: { x: e.clientX, y: e.clientY } })}
                onQuickDelete={handleQuickDelete}
                onToggleSelect={toggleSelect}
              />
            ))}
          </>
        )}

        {showEmpty && (
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

        {showFilteredEmpty && (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--ma-bg-elevated)] flex items-center justify-center mx-auto mb-3">
              <Search size={20} style={{ color: 'var(--ma-muted-text)' }} />
            </div>
            <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--ma-list-title)' }}>
              No {conversationMode === 'all' ? 'matching chats' : `${conversationMode} chats`}
            </p>
            <p className="text-[11px] mb-4 max-w-[220px] mx-auto" style={{ color: 'var(--ma-muted-text)' }}>
              {searchQuery
                ? `No results for "${searchQuery}" in ${conversationMode === 'all' ? 'all chats' : conversationMode}. Try a different search or clear the filters.`
                : 'There are no chats in this filter right now.'}
            </p>
            {(searchQuery || conversationMode !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearchQuery(''); setConversationMode('all'); }}
                className="h-8 text-xs gap-1.5"
              >
                <X size={13} />
                Clear filters
              </Button>
            )}
          </div>
        )}

        {showLoadError && (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={20} className="text-error" />
            </div>
            <p className="text-text-secondary text-sm font-medium mb-1">Couldn't load chats</p>
            <p className="text-text-muted text-xs mb-4 max-w-[220px] mx-auto">Check your connection and try again.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadConversations()}
              className="h-8 text-xs gap-1.5"
            >
              <Loader2 size={13} />
              Retry
            </Button>
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
      <AnimatePresence>
        {showNewContact && (
          <NewContactDialog
            isOpen={showNewContact}
            onClose={() => setShowNewContact(false)}
            onAdd={handleNewContact}
          />
        )}
      </AnimatePresence>

      {/* Shield Import Dialog */}
      <AnimatePresence>
        {showShieldImport && (
          <ShieldImportDialog
            isOpen={showShieldImport}
            onClose={() => {
              setShowShieldImport(false);
              loadConversations();
            }}
          />
        )}
      </AnimatePresence>

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
