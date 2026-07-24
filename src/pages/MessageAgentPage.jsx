import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Settings, Loader2, BarChart3, Building2, Cpu, Menu, X as XIcon, Bell, Lock, Palette, Activity, Kanban, FileText, MessageCircle } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketProvider';

import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../components/ui/cn';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatArea } from './components/ChatArea';
import { ContactPanel } from './components/ContactPanel';
import { SafetySettings } from './components/SafetySettings';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AiProviderSettings } from './components/AiProviderSettings';
import { BusinessProfileSettings } from './components/BusinessProfileSettings';
import AccountHealthDashboard from './components/AccountHealthDashboard';
import ConversationIntelligence from './components/ConversationIntelligence';
import TemplateManager from './components/TemplateManager';
import CrmPipeline from './components/CrmPipeline';


const defaultSafetySettings = {
  antiBan: {
    enabled: true,
    messageDelay: { min: 2, max: 5 },
    typingSimulation: true,
    typingDuration: { min: 1, max: 3 },
    messageHumanization: true,
    randomEmojis: false,
    duplicateMessageFilter: true,
  },
  rateLimiting: {
    enabled: true,
    maxPerMinute: 5,
    maxPerHour: 30,
    maxPerDay: 200,
    cooldownAfterBurst: { messages: 10, pauseMinutes: 5 },
  },
  sessionSafety: {
    businessHoursOnly: false,
    businessHours: { start: '09:00', end: '18:00' },
    randomOnlineStatus: true,
    cooldownBetweenChats: { min: 30, max: 120 },
    maxConcurrentChats: 5,
  },
  messageSafety: {
    lengthVariation: true,
    emojiRandomization: true,
    greetingVariation: true,
    smartReplyDelay: true,
    avoidRepetition: true,
    contentFiltering: true,
  },
  monitoring: {
    alertsEnabled: true,
    banRiskThreshold: 70,
    autoPauseOnRisk: true,
    dailyReportEmail: false,
    logAllMessages: true,
  },
};

const MessageAgentContext = createContext();

export const useMessageAgent = () => {
  const context = useContext(MessageAgentContext);
  if (!context) {
    throw new Error('useMessageAgent must be used within MessageAgentProvider');
  }
  return context;
};

export const MessageAgentProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationMode, setConversationMode] = useState('all');
  const [aiProviders, setAiProviders] = useState([]);
  const [businessProfile, setBusinessProfile] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [safetySettings, setSafetySettings] = useState(() => {
    try {
      const saved = localStorage.getItem('whatsapp_shield_safety_settings');
      return saved ? JSON.parse(saved) : defaultSafetySettings;
    } catch {
      return defaultSafetySettings;
    }
  });

  // Derive activeConversation from conversations array + activeConversationId
  // This ensures it's ALWAYS in sync with the latest data
  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find(c => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const setActiveConversation = useCallback((convOrFn) => {
    if (convOrFn === null) {
      setActiveConversationId(null);
    } else if (convOrFn?.id) {
      setActiveConversationId(convOrFn.id);
    }
  }, []);

  // Load conversations from API
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/message-agent/conversations');
      const data = await res.json();
      if (data.success && data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/message-agent/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  }, []);

  // Load AI providers
  const loadAiProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/message-agent/ai-providers');
      const data = await res.json();
      if (data.success) {
        setAiProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Error loading AI providers:', err);
    }
  }, []);

  // Load business profile
  const loadBusinessProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/message-agent/business-profile');
      const data = await res.json();
      if (data.success) {
        setBusinessProfile(data.profile || {});
      }
    } catch (err) {
      console.error('Error loading business profile:', err);
    }
  }, []);

  // Create or get conversation
  const createConversation = useCallback(async (phone, mode = 'manual', contactInfo = {}) => {
    try {
      const res = await fetch('/api/message-agent/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, mode, contactInfo })
      });
      const data = await res.json();
      if (data.success) {
        await loadConversations();
        return data.conversation;
      }
      return null;
    } catch (err) {
      console.error('Error creating conversation:', err);
      return null;
    }
  }, [loadConversations]);

  // Send message via API
  const sendMessage = useCallback(async (contactId, phone, message, from = 'user', mode = 'manual') => {
    try {
      const res = await fetch('/api/message-agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, phone, message, from, mode })
      });
      const data = await res.json();
      if (res.status === 403 && data.message) {
        data.message.status = 'blocked';
        data.message.complianceBlocked = true;
        return data.message;
      }
      if (data.message) {
        if (data.waError) {
          data.message.status = 'failed';
          data.message.waError = data.waError;
        }
        return data.message;
      }
      return null;
    } catch (err) {
      console.error('Error sending message:', err);
      return null;
    }
  }, []);

  // Update conversation
  const updateConversation = useCallback(async (id, updates) => {
    try {
      const res = await fetch(`/api/message-agent/conversation/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating conversation:', err);
      return false;
    }
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/message-agent/conversation/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting conversation:', err);
      return false;
    }
  }, [activeConversationId]);

  // Delete message
  const deleteMessage = useCallback(async (messageId, phone, deleteForEveryone = false) => {
    try {
      const res = await fetch('/api/message-agent/message/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, phone, deleteForEveryone })
      });
      const data = await res.json();
      return data.success;
    } catch (err) {
      console.error('Error deleting message:', err);
      return false;
    }
  }, []);

  // Compliance check
  const checkCompliance = useCallback(async (contactId) => {
    if (!contactId) return { allowed: true };
    try {
      const res = await fetch(`/api/message-agent/compliance/check/${contactId}`);
      const data = await res.json();
      return data;
    } catch {
      return { allowed: true };
    }
  }, []);

  // Block/unblock contact
  const blockContact = useCallback(async (contactId, reason) => {
    try {
      const res = await fetch('/api/message-agent/compliance/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, reason })
      });
      const data = await res.json();
      if (data.success) await loadConversations();
      return data.success;
    } catch { return false; }
  }, [loadConversations]);

  const unblockContact = useCallback(async (contactId) => {
    try {
      const res = await fetch('/api/message-agent/compliance/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId })
      });
      const data = await res.json();
      if (data.success) await loadConversations();
      return data.success;
    } catch { return false; }
  }, [loadConversations]);

  // Generate AI response
  const generateAiResponse = useCallback(async (message, conversationHistory, contact) => {
    try {
      const res = await fetch('/api/message-agent/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationHistory, contact, businessProfile })
      });
      const data = await res.json();
      if (data.success) {
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error generating AI response:', err);
      return null;
    }
  }, [businessProfile]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => 
        conv?.contact?.name?.toLowerCase().includes(q) ||
        conv?.contact?.phone?.includes(searchQuery) ||
        conv?.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    
    if (conversationMode !== 'all') {
      if (conversationMode === 'pinned') {
        filtered = filtered.filter(conv => conv.pinned);
      } else if (conversationMode === 'starred') {
        filtered = filtered.filter(conv => conv.starred);
      } else if (conversationMode === 'archived') {
        filtered = filtered.filter(conv => conv.archived);
      } else {
        filtered = filtered.filter(conv => conv.mode === conversationMode && !conv.archived);
      }
    } else {
      filtered = filtered.filter(conv => !conv.archived);
    }
    
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const tsA = a?.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const tsB = b?.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return tsB - tsA;
    });
  }, [conversations, searchQuery, conversationMode]);

  const value = {
    conversations,
    setConversations,
    activeConversation,
    activeConversationId,
    setActiveConversation,
    searchQuery,
    setSearchQuery,
    conversationMode,
    setConversationMode,
    aiProviders,
    setAiProviders,
    businessProfile,
    setBusinessProfile,
    isLoading,
    setIsLoading,
    filteredConversations,
    safetySettings,
    setSafetySettings,
    analytics,
    loadConversations,
    loadAnalytics,
    loadAiProviders,
    loadBusinessProfile,
    createConversation,
    sendMessage,
    updateConversation,
    deleteConversation,
    deleteMessage,
    generateAiResponse,
    checkCompliance,
    blockContact,
    unblockContact,
  };

  return (
    <MessageAgentContext.Provider value={value}>
      {children}
    </MessageAgentContext.Provider>
  );
};

const ConnectionRequiredScreen = ({ onOpenShield }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
          <Shield size={36} className="text-primary" />
        </div>
        <h2 className="text-xl font-display font-bold text-text-primary mb-2">
          WhatsApp Connection Required
        </h2>
        <p className="text-text-secondary text-sm mb-6 leading-relaxed">
          Message Agent requires an active WhatsApp Shield connection before you can send or receive messages.
        </p>
        <Button onClick={onOpenShield} size="default" className="gap-2">
          <Shield size={16} />
          Open WhatsApp Shield
        </Button>
        <p className="text-text-muted text-xs mt-4">
          Connect your WhatsApp session from the Shield dashboard, then return here.
        </p>
      </div>
    </div>
  );
};

const MessageAgentPage = () => {
  const ws = useWebSocket();
  const isAuthenticated = ws?.isAuthenticated;
  const status = ws?.status;
  const sessionUser = ws?.sessionUser;
  const logout = ws?.logout;
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex-1 min-h-0 bg-background flex flex-col overflow-hidden">
      <MessageAgentProvider>
        <MessageAgentPageInner
          isAuthenticated={isAuthenticated}
          status={status}
          sessionUser={sessionUser}
          logout={logout}
          navigate={navigate}
          location={location}
        />
      </MessageAgentProvider>
    </div>
  );
};


const MessageAgentPageInner = ({ isAuthenticated, status, sessionUser, logout, navigate, location }) => {

  const { 
    activeConversation, setActiveConversation, safetySettings, loadConversations,
    loadAnalytics, loadAiProviders, loadBusinessProfile, createConversation, conversations,
    setConversations
  } = useMessageAgent();
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const [showSafetySettings, setShowSafetySettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [showHealthDashboard, setShowHealthDashboard] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCrmPipeline, setShowCrmPipeline] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(() => {
    try { return localStorage.getItem('msgAgent_contactPanel') !== 'false'; } catch { return true; }
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('msgAgent_sidebarOpen') !== 'false'; } catch { return true; }
  });
  const handleBackToShield = () => navigate('/dashboard');

  useEffect(() => {
    localStorage.setItem('msgAgent_contactPanel', showContactPanel);
  }, [showContactPanel]);

  useEffect(() => {
    localStorage.setItem('msgAgent_sidebarOpen', sidebarOpen);
  }, [sidebarOpen]);

  // Auto-close sidebar on small screens when conversation opens
  useEffect(() => {
    if (window.innerWidth < 768 && activeConversation) {
      setSidebarOpen(false);
    }
  }, [activeConversation]);

  // Load data on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadAnalytics();
      loadAiProviders();
      loadBusinessProfile();
    }
  }, [isAuthenticated, loadConversations, loadAnalytics, loadAiProviders, loadBusinessProfile]);

  // Handle contact transfer from WhatsApp Shield
  useEffect(() => {
    const state = location?.state;
    if (state?.selectedContact && isAuthenticated) {
      const contact = state.selectedContact;
      createConversation(contact.phone, 'manual', {
        name: contact.name,
        phone: contact.phone,
        country: contact.country,
        avatar: contact.avatar,
        about: contact.about,
        exists: contact.exists,
        source: 'whatsapp_shield'
      }).then(conv => {
        if (conv) {
          setTimeout(() => {
            loadConversations().then(() => {
              const freshConv = conversationsRef.current.find(c => 
                c.contact?.phone?.replace(/\D/g, '') === contact.phone?.replace(/\D/g, '')
              );
              if (freshConv) setActiveConversation(freshConv);
            });
          }, 300);
        }
      });
      window.history.replaceState({}, document.title);
    }

    if (state?.batchContacts && isAuthenticated) {
      state.batchContacts.forEach(contact => {
        createConversation(contact.phone, 'manual', {
          name: contact.name,
          phone: contact.phone,
          country: contact.country,
          avatar: contact.avatar,
          about: contact.about,
          exists: contact.exists,
          source: 'whatsapp_shield'
        });
      });
      setTimeout(() => loadConversations(), 500);
      window.history.replaceState({}, document.title);
    }
  }, [location?.state, isAuthenticated, createConversation, loadConversations, setActiveConversation]);

  // Handle openMessageAgent custom event from Step5Reports
  useEffect(() => {
    const handleOpenMessageAgent = (event) => {
      const { phone, contact } = event.detail || {};
      if (phone && isAuthenticated) {
        createConversation(phone, 'manual', {
          name: contact?.name || `+${phone.replace(/\D/g, '')}`,
          phone,
          country: contact?.country || 'Unknown',
          avatar: contact?.avatar || null,
          about: contact?.about || '',
          exists: contact?.exists || false,
          source: 'whatsapp_shield'
        }).then(() => {
          setTimeout(() => {
            loadConversations().then(() => {
              const freshConv = conversationsRef.current.find(c => 
                c.contact?.phone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
              );
              if (freshConv) setActiveConversation(freshConv);
            });
          }, 300);
        });
      }
    };

    window.addEventListener('openMessageAgent', handleOpenMessageAgent);
    return () => window.removeEventListener('openMessageAgent', handleOpenMessageAgent);
  }, [isAuthenticated, createConversation, loadConversations, setActiveConversation]);

  // Listen for real-time Message Agent updates
  useEffect(() => {
    const handleUpdate = (event) => {
      const data = event.detail;
      if (data?.action === 'new_message' || data?.action === 'contact_updated' || data?.action === 'message_status') {
        loadConversations();
      }
    };
    window.addEventListener('messageAgent-update', handleUpdate);
    return () => window.removeEventListener('messageAgent-update', handleUpdate);
  }, [loadConversations]);

  // Profile menu event listeners
  useEffect(() => {
    const openSafety = () => setShowSafetySettings(true);
    const openAi = () => setShowAiSettings(true);
    const openBiz = () => setShowBusinessProfile(true);
    const openHealth = () => setShowHealthDashboard(true);
    const openTemplates = () => setShowTemplates(true);
    const openCrm = () => setShowCrmPipeline(true);
    window.addEventListener('open-safety-settings', openSafety);
    window.addEventListener('open-ai-settings', openAi);
    window.addEventListener('open-business-profile', openBiz);
    window.addEventListener('open-health-dashboard', openHealth);
    window.addEventListener('open-templates', openTemplates);
    window.addEventListener('open-crm-pipeline', openCrm);
    return () => {
      window.removeEventListener('open-safety-settings', openSafety);
      window.removeEventListener('open-ai-settings', openAi);
      window.removeEventListener('open-business-profile', openBiz);
      window.removeEventListener('open-health-dashboard', openHealth);
      window.removeEventListener('open-templates', openTemplates);
      window.removeEventListener('open-crm-pipeline', openCrm);
    };
  }, []);

  return (
    <>
      <SafetySettings isOpen={showSafetySettings} onClose={() => setShowSafetySettings(false)} />
      <AnalyticsDashboard isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} />
      <AiProviderSettings isOpen={showAiSettings} onClose={() => setShowAiSettings(false)} />
      <BusinessProfileSettings isOpen={showBusinessProfile} onClose={() => setShowBusinessProfile(false)} />
      <AccountHealthDashboard isOpen={showHealthDashboard} onClose={() => setShowHealthDashboard(false)} />
      <ConversationIntelligence isOpen={showIntelligence} onClose={() => setShowIntelligence(false)} conversationId={activeConversation?.id} />
      <TemplateManager isOpen={showTemplates} onClose={() => setShowTemplates(false)} />
      <CrmPipeline isOpen={showCrmPipeline} onClose={() => setShowCrmPipeline(false)} onSelectContact={(id) => { const conv = conversations.find(c => c.id === id); if (conv) setActiveConversation(conv); setShowCrmPipeline(false); }} />
      
      {/* Secondary Toolbar — product-specific tools (not a primary header) */}
      <div className="h-12 border-b border-border bg-surface/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {conversations.length > 0 && (
            <Badge variant="outline" className="text-[10px] whitespace-nowrap">{conversations.length} chats</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Badge variant={isAuthenticated ? "success" : "outline"} className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", isAuthenticated ? "bg-success" : "bg-text-muted")} />
            {isAuthenticated ? 'Connected' : 'Disconnected'}
          </Badge>
          
          {isAuthenticated && safetySettings?.antiBan?.enabled && (
            <Badge variant="success" className="hidden xl:flex items-center gap-1 text-[10px] px-2 py-0.5">
              <Shield size={10} />
              Anti-Ban
            </Badge>
          )}
          
          <div className="flex items-center">
            <button onClick={() => setShowAnalytics(true)} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-background flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="Analytics">
              <BarChart3 size={13} className="sm:size-[14]" />
            </button>
            <button onClick={() => setShowHealthDashboard(true)} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-background flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="Health">
              <Activity size={13} className="sm:size-[14]" />
            </button>
            <button onClick={() => setShowCrmPipeline(true)} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-background flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="CRM">
              <Kanban size={13} className="sm:size-[14]" />
            </button>
            <button onClick={() => setShowTemplates(true)} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-background flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="Templates">
              <FileText size={13} className="sm:size-[14]" />
            </button>
            <button onClick={() => setShowAiSettings(true)} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-background flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="AI">
              <Cpu size={13} className="sm:size-[14]" />
            </button>
            <button onClick={() => setShowBusinessProfile(true)} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-background flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="Business">
              <Building2 size={13} className="sm:size-[14]" />
            </button>
            <button onClick={() => setShowSafetySettings(true)} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-background flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="Safety">
              <Settings size={13} className="sm:size-[14]" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isAuthenticated ? (
        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {/* Sidebar overlay on mobile */}
          {sidebarOpen && !activeConversation && (
            <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <div className={cn(
            "flex-shrink-0 transition-all duration-200 z-40",
            sidebarOpen && !activeConversation ? "w-full md:w-80" : "hidden md:block md:w-80"
          )}>
            <ChatSidebar />
          </div>

          {/* Mobile sidebar toggle when conversation is active */}
          {activeConversation && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                "absolute top-2 left-2 z-30 md:hidden h-8 w-8 rounded-full bg-surface border border-border flex items-center justify-center shadow-md transition-transform",
                sidebarOpen && "opacity-0 pointer-events-none"
              )}
            >
              <Menu size={16} className="text-text-primary" />
            </button>
          )}

          {/* Mobile sidebar overlay when toggled from chat */}
          {sidebarOpen && activeConversation && (
            <>
              <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
              <div className="fixed left-0 top-0 bottom-0 w-80 z-40 md:hidden shadow-2xl bg-surface">
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <span className="text-sm font-semibold text-text-primary">Chats</span>
                  <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-background">
                    <XIcon size={16} className="text-text-secondary" />
                  </button>
                </div>
                <ChatSidebar />
              </div>
            </>
          )}

          {/* Chat Area / Empty State */}
          <div className="flex-1 min-w-0 flex flex-col relative">
            <AnimatePresence mode="wait">
              {activeConversation ? (
                <motion.div
                  key={activeConversation.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute inset-0 flex flex-col"
                >
                  <ChatArea 
                    onBackToList={() => { setActiveConversation(null); setSidebarOpen(true); }}
                    onToggleContactPanel={() => setShowContactPanel(!showContactPanel)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex items-center justify-center p-4 sm:p-8"
                >
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-4 sm:mb-6">
                      <MessageCircle size={24} className="sm:size-[32] text-primary" />
                    </div>
                    <h2 className="text-lg sm:text-2xl font-display font-bold text-text-primary mb-2 sm:mb-3">Welcome to Message Agent</h2>
                    <p className="text-xs sm:text-sm text-text-secondary mb-4 sm:mb-6">
                      Select a conversation from the sidebar or start a new one to begin communicating with your contacts.
                    </p>
                    <div className="text-[10px] sm:text-xs text-text-muted space-y-1">
                      <p>Connected as: {sessionUser?.name || sessionUser?.number || 'Unknown'}</p>
                      <p className="hidden sm:block">All conversations are end-to-end encrypted</p>
                      <p className="hidden sm:block">AI mode available for automated responses</p>
                      <p className="flex items-center justify-center gap-1 text-success">
                        <Shield size={10} className="sm:size-[12]" />
                        Anti-ban protection active
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-4 sm:mt-6">
                      <Button variant="outline" size="sm" onClick={() => setShowAnalytics(true)}>
                        <BarChart3 size={14} className="mr-1.5" />
                        Analytics
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAiSettings(true)}>
                        <Cpu size={14} className="mr-1.5" />
                        AI Settings
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Contact Panel — slide in on mobile */}
          {activeConversation && showContactPanel && (
            <div className={cn(
              "w-80 border-l border-border bg-surface",
              "hidden md:block"
            )}>
              <ContactPanel />
            </div>
          )}
          {activeConversation && showContactPanel && (
            <div className="fixed inset-y-0 right-0 w-80 max-w-[85vw] z-50 md:hidden shadow-2xl">
              <ContactPanel onClose={() => setShowContactPanel(false)} />
            </div>
          )}
        </div>
      ) : (
        <ConnectionRequiredScreen onOpenShield={handleBackToShield} />
      )}
    </>
  );
};

export default MessageAgentPage;
