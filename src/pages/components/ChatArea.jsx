import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronLeft, Send, Bot, Smile, Paperclip, 
  Reply, Forward, Trash2, Star, Copy, CheckCheck, Clock, 
  AlertCircle, ArrowDown, X, Image, FileText, Camera,
  Search, MessageSquare, Sparkles, Lightbulb, Loader2, ShieldBan
} from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useMessageAgent } from '../MessageAgentPage';
import { ContactAvatar } from './ContactAvatar';

const MessageBubble = ({ message, isLast, onAction }) => {
  const [showActions, setShowActions] = useState(false);
  const isMe = message.from === 'me';
  const isAI = message.from === 'ai';
  const isSystem = message.from === 'system';
  const isDeleted = message.deleted;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-3 py-1 rounded-lg msg-system text-[12px] shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex group", isMe ? "justify-end" : "justify-start")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={cn("relative max-w-[75%] lg:max-w-[60%]")}>
        {showActions && !isDeleted && (
          <div className={cn(
            "absolute top-0 z-10 flex items-center gap-0.5 p-1 rounded-lg msg-action-menu",
            isMe ? "right-full mr-2" : "left-full ml-2"
          )}>
            <button onClick={() => onAction('reply', message)} className="msg-action-btn" title="Reply">
              <Reply size={12} />
            </button>
            <button onClick={() => onAction('forward', message)} className="msg-action-btn" title="Forward">
              <Forward size={12} />
            </button>
            <button onClick={() => onAction('copy', message)} className="msg-action-btn" title="Copy">
              <Copy size={12} />
            </button>
            <button
              onClick={() => onAction('star', message)}
              className={cn("msg-action-btn", message.starred && "text-warning")}
              title="Star"
            >
              <Star size={12} className={message.starred ? "fill-current" : ""} />
            </button>
            {isMe && (
              <button onClick={() => onAction('delete', message)} className="msg-action-btn hover:!text-error" title="Delete">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}

        <div
          className={cn(
            "rounded-lg px-3 py-2 shadow-sm",
            isMe
              ? "msg-bubble-sent"
              : isAI
              ? "msg-bubble-ai"
              : isDeleted
              ? "msg-bubble-deleted"
              : "msg-bubble-received"
          )}
        >
          {isAI && !isDeleted && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
                <Bot size={11} className="text-success" />
              </div>
              <span className="text-[11px] font-medium text-success">AI Assistant</span>
            </div>
          )}
          
          {isDeleted ? (
            <p className="text-xs italic">You deleted this message</p>
          ) : message.complianceBlocked ? (
            <p className="text-xs italic text-error">Blocked — {message.waError || 'Contact cannot be messaged'}</p>
          ) : (
            <>
              {message.replyTo && (
                <div className={cn(
                  "text-xs p-2 rounded-lg mb-2 border-l-2",
                  isMe ? "bg-primary/10 border-primary/40" : "bg-background border-primary/30"
                )}>
                  <p className="font-medium text-[10px] opacity-70 mb-0.5">{message.replyTo.from === 'me' ? 'You' : 'Them'}</p>
                  <p className="truncate opacity-80">{message.replyTo.text}</p>
                </div>
              )}
              
              {message.attachment && (
                <div className={cn(
                  "flex items-center gap-2 p-2 rounded-lg mb-2",
                  isMe ? "bg-primary/10" : "bg-background"
                )}>
                  <Paperclip size={14} className="text-text-muted" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{message.attachment.name}</p>
                    <p className="text-[10px] opacity-60">{message.attachment.size ? `${(message.attachment.size / 1024).toFixed(1)} KB` : 'File'}</p>
                  </div>
                </div>
              )}
              
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
            </>
          )}
          
          <div className="flex items-center justify-end gap-1.5 mt-1 text-text-muted">
            <span className="text-[11px]">
              {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
            {isMe && !isDeleted && (
              <span className="flex items-center">
                {message.status === 'sending' && <Clock size={11} className="animate-spin text-text-muted" />}
                {message.status === 'sent' && <CheckCheck size={11} className="text-text-muted" />}
                {message.status === 'delivered' && <CheckCheck size={11} className="text-info" />}
                {message.status === 'read' && <CheckCheck size={11} className="text-info" />}
                {message.status === 'failed' && <AlertCircle size={11} className="text-error" />}
                {message.status === 'blocked' && <AlertCircle size={11} className="text-error" />}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TypingIndicator = ({ isAI }) => (
  <div className="flex justify-start">
    <div className={cn(
      "rounded-2xl rounded-bl-md px-4 py-3",
      isAI ? "msg-bubble-ai" : "msg-bubble-received"
    )}>
      <div className="flex items-center gap-2">
        {isAI && <Bot size={12} className="text-success" />}
        <div className="flex items-center gap-1">
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isAI ? "bg-success" : "bg-text-muted")} />
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isAI ? "bg-success" : "bg-text-muted")} style={{ animationDelay: '0.2s' }} />
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isAI ? "bg-success" : "bg-text-muted")} style={{ animationDelay: '0.4s' }} />
        </div>
        <span className={cn("text-xs", isAI ? "text-success" : "text-text-muted")}>
          {isAI ? 'AI is thinking...' : 'Typing...'}
        </span>
      </div>
    </div>
  </div>
);

const ForwardDialog = ({ isOpen, onClose, onForward, conversations }) => {
  const [search, setSearch] = useState('');
  
  if (!isOpen) return null;
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [onClose]);
  
  const filtered = conversations.filter(c => 
    c.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact?.phone?.includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md dialog-panel rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 dialog-header">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-text-primary">Forward to...</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-background">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => { onForward(conv); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-background transition-colors text-left"
            >
              <ContactAvatar contact={conv.contact} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{conv.contact.name}</p>
                <p className="text-[11px] text-text-muted">{conv.contact.phone}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-text-muted text-sm py-8">No contacts found</p>
          )}
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmDialog = ({ isOpen, onClose, onDeleteForMe, onDeleteForEveryone }) => {
  if (!isOpen) return null;
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xs dialog-panel rounded-2xl shadow-2xl overflow-hidden p-5">
        <h3 className="font-semibold text-sm text-text-primary mb-1.5">Delete message?</h3>
        <p className="text-xs text-text-secondary mb-3">This message will be deleted for you.</p>
        <div className="flex flex-col gap-1.5">
          <button onClick={onDeleteForMe} className="w-full px-4 py-2 rounded-xl bg-error text-white text-xs font-medium hover:bg-error/90 transition-colors">
            Delete for me
          </button>
          <button onClick={onDeleteForEveryone} className="w-full px-4 py-2 rounded-xl bg-error/90 text-white text-xs font-medium hover:bg-error transition-colors">
            Delete for everyone
          </button>
          <button onClick={onClose} className="w-full px-4 py-2 rounded-xl bg-background text-text-secondary text-xs font-medium hover:bg-surface transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatArea = ({ onBackToList, onToggleContactPanel }) => {
  const { 
    activeConversation, setConversations, setActiveConversation, conversations,
    sendMessage: apiSendMessage, generateAiResponse, updateConversation, deleteMessage: apiDeleteMessage,
    unblockContact: apiUnblockContact
  } = useMessageAgent();
  const [newMessage, setNewMessage] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [searchInChat, setSearchInChat] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [complianceStatus, setComplianceStatus] = useState({ allowed: true, isBlocked: false, isSuppressed: false });
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiRef = useRef(null);
  const attachRef = useRef(null);

  const messages = activeConversation?.messages || [];

  const filteredMessages = useMemo(() => {
    if (!searchInChat.trim()) return messages;
    const q = searchInChat.toLowerCase();
    return messages.filter(m => m.text?.toLowerCase().includes(q));
  }, [messages, searchInChat]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  }, [newMessage]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (attachRef.current && !attachRef.current.contains(e.target)) {
        setShowAttachMenu(false);
      }
    };
    if (showEmojiPicker || showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker, showAttachMenu]);

  useEffect(() => {
    setReplyTo(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    setSearchInChat('');
    setShowSearch(false);
    setDeleteTarget(null);
    setAiSuggestions([]);
    setComplianceStatus({ allowed: true, isBlocked: false, isSuppressed: false });
  }, [activeConversation?.id]);

  useEffect(() => {
    if (activeConversation?.id) {
      setComplianceStatus(prev => ({ ...prev, checking: true }));
      fetch(`/api/message-agent/compliance/check/${activeConversation.id}`)
        .then(r => r.json())
        .then(data => {
          setComplianceStatus({
            allowed: data.allowed !== false,
            isBlocked: data.isBlocked === true,
            isSuppressed: data.isSuppressed === true,
            reason: data.reason || null,
            checking: false
          });
        })
        .catch(() => setComplianceStatus(prev => ({ ...prev, allowed: true, checking: false })));
    }
  }, [activeConversation?.id]);

  const fetchAiSuggestions = useCallback(async () => {
    if (!activeConversation || loadingSuggestions) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/message-agent/templates/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationState: {
            stage: activeConversation.journey || 'contacted',
            lastMessage: messages[messages.length - 1]?.text || '',
            messageCount: messages.length,
            sentiment: messages[messages.length - 1]?.from === 'them' ? 'positive' : 'neutral',
            isReturningCustomer: messages.length > 5
          }
        })
      });
      const data = await res.json();
      if (data.success && data.recommended) {
        const suggestions = Array.isArray(data.recommended) ? data.recommended : [data.recommended];
        setAiSuggestions(suggestions.slice(0, 3));
      }
    } catch (err) {
      // silently fail
    }
    setLoadingSuggestions(false);
  }, [activeConversation, messages, loadingSuggestions]);

  useEffect(() => {
    if (activeConversation && messages.length > 0) {
      const timer = setTimeout(fetchAiSuggestions, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeConversation?.id, messages.length]);

  useEffect(() => {
    const handleStatusUpdate = (event) => {
      const data = event.detail;
      if (data?.action === 'message_status' && activeConversation) {
        const contactPhone = activeConversation.contact?.phone?.replace(/\D/g, '');
        if (data.phone === contactPhone) {
          setConversations(prev => prev.map(conv => {
            if (conv.id === activeConversation.id) {
              const updatedMessages = (conv.messages || []).map(m => 
                m.id === data.messageId ? { ...m, status: data.status } : m
              );
              return { ...conv, messages: updatedMessages };
            }
            return conv;
          }));
        }
      }
    };
    window.addEventListener('messageAgent-update', handleStatusUpdate);
    return () => window.removeEventListener('messageAgent-update', handleStatusUpdate);
  }, [activeConversation, setConversations]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeConversation) return;
    
    const messageText = newMessage.trim();
    setNewMessage('');
    setReplyTo(null);

    const tempId = `temp_${Date.now()}`;
    const tempMessage = {
      id: tempId,
      text: messageText,
      from: 'me',
      timestamp: new Date().toISOString(),
      status: 'sending',
      replyTo: replyTo ? { text: replyTo.text, from: replyTo.from } : null,
    };

    setConversations(prev => prev.map(conv => {
      if (conv.id === activeConversation.id) {
        const updatedMessages = [...(conv.messages || []), tempMessage];
        return { ...conv, messages: updatedMessages, lastMessage: tempMessage };
      }
      return conv;
    }));

    const savedMessage = await apiSendMessage(
      activeConversation.id,
      activeConversation.contact?.phone,
      messageText,
      'user',
      activeConversation.mode
    );

    if (savedMessage) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeConversation.id) {
          const updatedMessages = (conv.messages || []).map(m => 
            m.id === tempId ? { ...savedMessage, from: 'me', status: savedMessage.status === 'failed' ? 'failed' : 'sent' } : m
          );
          return { ...conv, messages: updatedMessages, lastMessage: savedMessage };
        }
        return conv;
      }));

      if (activeConversation.mode === 'ai') {
        setIsAITyping(true);
        
        const aiResponseData = await generateAiResponse(
          messageText,
          messages.slice(-10),
          activeConversation.contact
        );

        const delay = 1500 + Math.random() * 2000;
        await new Promise(r => setTimeout(r, delay));
        setIsAITyping(false);

        if (aiResponseData?.response) {
          const aiMessage = {
            id: `ai_${Date.now()}`,
            text: aiResponseData.response,
            from: 'ai',
            timestamp: new Date().toISOString(),
            status: 'delivered',
            provider: aiResponseData.provider,
            confidence: aiResponseData.confidence,
          };

          await apiSendMessage(
            activeConversation.id,
            activeConversation.contact?.phone,
            aiResponseData.response,
            'ai',
            'ai'
          );

          setConversations(prev => prev.map(conv => {
            if (conv.id === activeConversation.id) {
              const updatedMessages = [...(conv.messages || []), aiMessage];
              return { ...conv, messages: updatedMessages, lastMessage: aiMessage };
            }
            return conv;
          }));
        }
      }
    } else {
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeConversation.id) {
          const updatedMessages = (conv.messages || []).map(m => 
            m.id === tempId ? { ...m, status: 'failed' } : m
          );
          return { ...conv, messages: updatedMessages };
        }
        return conv;
      }));
    }
  };

  const handleRetryMessage = async (message) => {
    if (!activeConversation) return;
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeConversation.id) {
        const updatedMessages = (conv.messages || []).map(m => 
          m.id === message.id ? { ...m, status: 'sending' } : m
        );
        return { ...conv, messages: updatedMessages };
      }
      return conv;
    }));

    const savedMessage = await apiSendMessage(
      activeConversation.id,
      activeConversation.contact?.phone,
      message.text,
      'user',
      activeConversation.mode
    );

    if (savedMessage) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeConversation.id) {
          const updatedMessages = (conv.messages || []).map(m => 
            m.id === message.id ? { ...savedMessage, from: 'me', status: 'sent' } : m
          );
          return { ...conv, messages: updatedMessages, lastMessage: savedMessage };
        }
        return conv;
      }));
    } else {
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeConversation.id) {
          const updatedMessages = (conv.messages || []).map(m => 
            m.id === message.id ? { ...m, status: 'failed' } : m
          );
          return { ...conv, messages: updatedMessages };
        }
        return conv;
      }));
    }
  };

  const handleMessageAction = async (action, message) => {
    switch (action) {
      case 'reply':
        setReplyTo(message);
        textareaRef.current?.focus();
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(message.text);
        } catch {
          const textarea = document.createElement('textarea');
          textarea.value = message.text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        break;
      case 'star':
        setConversations(prev => prev.map(conv => {
          if (conv.id === activeConversation.id) {
            const updatedMessages = (conv.messages || []).map(m => 
              m.id === message.id ? { ...m, starred: !m.starred } : m
            );
            return { ...conv, messages: updatedMessages };
          }
          return conv;
        }));
        break;
      case 'delete':
        setDeleteTarget(message);
        break;
      case 'forward':
        setForwardMessage(message);
        break;
      case 'retry':
        handleRetryMessage(message);
        break;
    }
  };

  const handleDeleteForMe = async () => {
    if (!deleteTarget || !activeConversation) return;
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeConversation.id) {
        const updatedMessages = (conv.messages || []).filter(m => m.id !== deleteTarget.id);
        return { 
          ...conv, 
          messages: updatedMessages,
          lastMessage: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : conv.lastMessage
        };
      }
      return conv;
    }));
    setDeleteTarget(null);
  };

  const handleDeleteForEveryone = async () => {
    if (!deleteTarget || !activeConversation) return;
    const phone = activeConversation.contact?.phone;
    try {
      await fetch('/api/message-agent/message/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: deleteTarget.id, phone, deleteForEveryone: true })
      });
    } catch {
      // silently fail
    }
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeConversation.id) {
        const updatedMessages = (conv.messages || []).filter(m => m.id !== deleteTarget.id);
        return { 
          ...conv, 
          messages: updatedMessages,
          lastMessage: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : conv.lastMessage
        };
      }
      return conv;
    }));
    setDeleteTarget(null);
  };

  const handleForwardToContact = async (targetConv) => {
    if (!forwardMessage || !targetConv) return;
    const tempId = `fwd_${Date.now()}`;
    const fwdMessage = {
      id: tempId,
      text: `\u21AA Forwarded: ${forwardMessage.text}`,
      from: 'me',
      timestamp: new Date().toISOString(),
      status: 'sending',
    };
    setConversations(prev => prev.map(conv => {
      if (conv.id === targetConv.id) {
        const updatedMessages = [...(conv.messages || []), fwdMessage];
        return { ...conv, messages: updatedMessages, lastMessage: fwdMessage };
      }
      return conv;
    }));
    const savedMessage = await apiSendMessage(targetConv.id, targetConv.contact?.phone, `\u21AA Forwarded: ${forwardMessage.text}`, 'user', targetConv.mode);
    if (savedMessage) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === targetConv.id) {
          const updatedMessages = (conv.messages || []).map(m => 
            m.id === tempId ? { ...savedMessage, from: 'me', status: 'sent' } : m
          );
          return { ...conv, messages: updatedMessages, lastMessage: savedMessage };
        }
        return conv;
      }));
    }
    setForwardMessage(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!activeConversation) {
    return null;
  }

  const EMOJI_CATEGORIES = [
    { label: 'Smileys', emojis: ['\u{1F600}','\u{1F602}','\u{1F60A}','\u{1F60D}','\u{1F970}','\u{1F60E}','\u{1F929}','\u{1F607}','\u{1F917}','\u{1F914}','\u{1F634}','\u{1F973}','\u{1F60F}','\u{1F62D}','\u{1F644}','\u{1F624}','\u{1F91E}','\u{1F4AA}','\u{1F44D}','\u{1F44E}'] },
    { label: 'Hearts', emojis: ['\u2764\uFE0F','\u{1F9E1}','\u{1F49B}','\u{1F49A}','\u{1F499}','\u{1F49C}','\u{1F5A4}','\u{1F90D}','\u{1F495}','\u{1F496}','\u{1F497}','\u{1F49D}','\u{1F498}','\u{1F49E}','\u{1F493}','\u{1F494}'] },
    { label: 'Objects', emojis: ['\u{1F389}','\u{1F38A}','\u{1F382}','\u{1F381}','\u{1F3C6}','\u2B50','\u2728','\u{1F525}','\u{1F4AF}','\u{1F64C}','\u{1F44F}','\u{1F91D}','\u{1F64F}','\u{1F4AC}','\u{1F4F1}','\u{1F4BB}'] },
    { label: 'Hands', emojis: ['\u{1F44B}','\u270B','\u{1F90A}','\u{1F590}\uFE0F','\u{1F44C}','\u270C\uFE0F','\u{1F91E}','\u{1FA70}','\u{1F91F}','\u{1F918}','\u{1F919}','\u{1F448}','\u{1F449}','\u{1F446}','\u{1F447}','\u261D\uFE0F'] },
  ];

  const ATTACH_OPTIONS = [
    { icon: Image, label: 'Photo', accept: 'image/*' },
    { icon: Camera, label: 'Camera', accept: 'image/*', capture: 'environment' },
    { icon: FileText, label: 'Document', accept: '.pdf,.doc,.docx,.txt,.csv' },
  ];

  const handleFileAttach = (accept) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileMessage = {
          id: `file_${Date.now()}`,
          text: `\u{1F4CE} ${file.name}`,
          from: 'me',
          timestamp: new Date().toISOString(),
          status: 'sending',
          attachment: { name: file.name, size: file.size, type: file.type },
        };
        apiSendMessage(activeConversation.id, activeConversation.contact?.phone, `\u{1F4CE} ${file.name}`, 'user', activeConversation.mode).then(saved => {
          setConversations(prev => prev.map(conv => {
            if (conv.id === activeConversation.id) {
              const updatedMessages = (conv.messages || []).map(m =>
                m.id === fileMessage.id ? { ...saved, from: 'me', status: 'sent' } : m
              );
              return { ...conv, messages: updatedMessages, lastMessage: saved };
            }
            return conv;
          }));
        });
      }
    };
    input.click();
    setShowAttachMenu(false);
  };

  const insertEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col chat-bg">
      {/* Chat Header */}
      <div className="h-14 chat-header flex items-center justify-between px-3 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToList}
            className="md:hidden p-2 -ml-2 text-text-muted hover:text-primary transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          
          <ContactAvatar contact={activeConversation.contact} status={activeConversation.status} size="md" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate text-text-primary">{activeConversation.contact.name}</h3>
              {activeConversation.mode === 'ai' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-success/10 text-success border-success/20 shrink-0">
                  AI
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <div className={cn("w-2 h-2 rounded-full shrink-0", 
                activeConversation.status === 'online' ? 'bg-success' :
                activeConversation.status === 'ai_typing' ? 'bg-success animate-pulse' :
                activeConversation.status === 'typing' ? 'bg-warning' : 'bg-text-muted'
              )} />
              <span className="truncate">
                {activeConversation.status === 'online' ? 'Online' :
                 activeConversation.status === 'ai_typing' ? 'AI thinking...' :
                 activeConversation.status === 'typing' ? 'Typing...' :
                 activeConversation.contact?.phone || 'Offline'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "p-2 rounded-lg transition-all",
              showSearch ? "text-primary bg-primary/10" : "text-text-muted hover:text-primary hover:bg-primary/10"
            )}
            title="Search in chat"
          >
            <Search size={16} />
          </button>
          <button
            onClick={async () => {
              const newMode = activeConversation.mode === 'ai' ? 'manual' : 'ai';
              await updateConversation(activeConversation.id, { mode: newMode });
            }}
            className={cn(
              "p-2 rounded-lg text-xs font-medium transition-all",
              activeConversation.mode === 'ai' 
                ? "text-success hover:bg-success/10"
                : "text-text-muted hover:text-primary hover:bg-primary/10"
            )}
            title={activeConversation.mode === 'ai' ? 'AI Mode Active' : 'Switch to AI Mode'}
          >
            <Bot size={16} />
          </button>
          <button
            onClick={fetchAiSuggestions}
            className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
            title="Get AI suggestions"
          >
            <Lightbulb size={16} />
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleContactPanel}>
            <MessageSquare size={16} />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-3 py-2 chat-search-bar flex items-center gap-2">
          <Search size={14} className="text-text-muted shrink-0" />
          <Input
            placeholder="Search in conversation..."
            value={searchInChat}
            onChange={(e) => setSearchInChat(e.target.value)}
            className="h-8 text-xs flex-1"
            autoFocus
          />
          {searchInChat && (
            <span className="text-[11px] text-text-muted shrink-0">
              {filteredMessages.filter(m => m.text?.toLowerCase().includes(searchInChat.toLowerCase())).length} found
            </span>
          )}
          <button onClick={() => { setSearchInChat(''); setShowSearch(false); }} className="text-text-muted hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Compliance Warning Banner */}
      {complianceStatus.checking && (
        <div className="px-4 py-2 flex items-center gap-2 bg-warning/10 border-b border-warning/20">
          <Loader2 size={14} className="animate-spin text-warning" />
          <span className="text-xs text-warning">Checking compliance...</span>
        </div>
      )}
      {!complianceStatus.allowed && !complianceStatus.checking && (
        <div className="px-4 py-2.5 flex items-center gap-2.5 bg-error/10 border-b border-error/20">
          <ShieldBan size={16} className="text-error shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-error">
              {complianceStatus.isBlocked ? 'Contact Blocked' : 'Opted Out'}
            </p>
            <p className="text-[11px] text-error/80 truncate">
              {complianceStatus.reason || (complianceStatus.isBlocked ? 'This contact has been blocked.' : 'This contact has opted out from receiving messages.')}
            </p>
          </div>
          {complianceStatus.isBlocked && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-error hover:bg-error/10"
              onClick={async () => {
                await apiUnblockContact(activeConversation.id);
                setComplianceStatus({ allowed: true, isBlocked: false, isSuppressed: false, checking: false });
              }}
            >
              Unblock
            </Button>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative"
      >
        <div className="flex justify-center my-2">
          <div className="px-3 py-1 rounded-lg msg-system text-[12px] font-medium shadow-sm">
            {messages.length > 0 ? new Date(messages[0].timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today'}
          </div>
        </div>

        {(searchInChat ? filteredMessages : messages).map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLast={idx === (searchInChat ? filteredMessages : messages).length - 1}
            onAction={handleMessageAction}
          />
        ))}
        
        {(searchInChat ? filteredMessages : messages).filter(m => m.status === 'failed').map(msg => (
          <div key={`retry_${msg.id}`} className="flex justify-center">
            <button
              onClick={() => handleRetryMessage(msg)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs hover:bg-error/20 transition-colors"
            >
              <AlertCircle size={12} />
              Failed to send. Tap to retry.
            </button>
          </div>
        ))}
        
        {isAITyping && <TypingIndicator isAI />}
        
        <div ref={messagesEndRef} />

        {showScrollDown && (
          <button
            onClick={() => scrollToBottom()}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 p-2 rounded-full bg-surface border border-border shadow-lg text-text-muted hover:text-primary transition-colors z-10"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border chat-input-area flex items-center gap-3">
          <div className="flex-1 min-w-0 border-l-4 border-primary pl-3">
            <p className="text-xs font-medium text-primary">{replyTo.from === 'me' ? 'You' : replyTo.from === 'ai' ? 'AI' : 'Them'}</p>
            <p className="text-xs text-text-muted truncate">{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
      )}

      {/* AI Smart Reply Suggestions */}
      {(aiSuggestions.length > 0 || loadingSuggestions) && (
        <div className="px-4 py-2 border-t border-border bg-surface/50">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={12} className="text-primary" />
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Smart Suggestions</span>
            {loadingSuggestions && <Loader2 size={10} className="animate-spin text-primary" />}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {aiSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setNewMessage(s.content || s.text || s)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-text-primary hover:bg-primary/10 transition-colors text-left max-w-[200px] truncate"
              >
                {s.content || s.text || s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-3 chat-input-area relative">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div ref={emojiRef} className="absolute bottom-full left-0 right-0 mb-2 dialog-panel rounded-xl shadow-2xl p-3 z-20 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Emoji</span>
              <button onClick={() => setShowEmojiPicker(false)} className="text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            </div>
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.label} className="mb-3">
                <p className="text-[10px] text-text-muted font-medium mb-1.5">{cat.label}</p>
                <div className="flex flex-wrap gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Attach Menu */}
        {showAttachMenu && (
          <div ref={attachRef} className="absolute bottom-full left-0 mb-2 dialog-panel rounded-xl shadow-2xl py-2 z-20 w-48">
            {ATTACH_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.label}
                  onClick={() => handleFileAttach(opt.accept)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-background transition-colors"
                >
                  <Icon size={16} className="text-primary" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 shrink-0 text-text-muted hover:text-primary"
              onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }}
            >
              <Paperclip size={18} />
            </Button>
          </div>
          
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={!complianceStatus.allowed ? 'Cannot send messages to this contact' : 'Type a message'}
              disabled={!complianceStatus.allowed}
              className="w-full min-h-[40px] max-h-32 px-4 py-2.5 rounded-xl input-field resize-none text-sm disabled:opacity-50"
              rows={1}
            />
          </div>

          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 shrink-0 text-text-muted hover:text-primary"
              onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }}
            >
              <Smile size={18} />
            </Button>
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className={cn(
              "h-9 w-9 shrink-0 rounded-full transition-all",
              newMessage.trim() ? "bg-primary hover:bg-primary/90 text-white" : "bg-border text-text-muted"
            )}
          >
            <Send size={16} />
          </Button>
        </div>
        
        {activeConversation.mode === 'ai' && (
          <div className="flex items-center justify-center mt-2">
            <Badge variant="outline" className="text-[10px] bg-success/5 text-success border-success/20">
              <Bot size={10} className="mr-1" />
              AI Mode active — AI responds automatically
            </Badge>
          </div>
        )}
      </div>

      {/* Forward Dialog */}
      <ForwardDialog
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        onForward={handleForwardToContact}
        conversations={conversations}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
      />
    </div>
  );
};

export { ChatArea };
