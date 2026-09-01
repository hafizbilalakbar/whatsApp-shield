import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Bot, Phone } from 'lucide-react';
import { useBodyScrollLock } from './useBodyScrollLock';
import { resolveAvatarSrc } from './ContactAvatar';
import { ProfilePhotoViewer } from './ProfilePhotoViewer';
import { useMessageAgent } from '../MessageAgentPage';
import { ContactPanelBody } from './ContactPanel';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = String(name).replace(/[+]/g, '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).slice(-2).toUpperCase();
};

const ProfileOverlay = ({ conversation, isOpen, onClose }) => {
  useBodyScrollLock(!!isOpen);
  const [viewPhoto, setViewPhoto] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Close the photo viewer first, then the overlay itself.
      if (viewPhoto) { setViewPhoto(false); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, viewPhoto]);

  if (!conversation || !isOpen) return null;
  const contact = conversation?.contact;

  return createPortal(
    <div className="msg-profile-overlay-backdrop mp-fade-in" onClick={onClose}>
      <div className="msg-profile-overlay mp-zoom-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-2.5 border-b shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--ma-line-slim)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--ma-accent) 12%, transparent)' }}>
              <User size={14} style={{ color: 'var(--ma-accent)' }} />
            </div>
            <span className="mp-section-title truncate">Profile</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--ma-muted-text)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ma-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title="Close"
            aria-label="Close profile"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="mp-body-scroll flex-1">
          {/* Identity block */}
          <div className="pt-5 pb-4 px-4 text-center shrink-0">
            <div className="flex justify-center">
              <ContactAvatarPhoto contact={contact} onClick={() => setViewPhoto(true)} />
            </div>
            <h2 className="mp-profile-name mt-3 truncate">{contact?.name || 'Unknown'}</h2>
            <p className="mp-phone-muted mt-1 truncate">+{String(contact?.phone || '').replace(/^\+/, '')}</p>
            {contact?.country && (
              <p className="mp-label mt-1.5 truncate">{contact.country}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-4 pb-4 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <ModeButton conversation={conversation} mode="manual" />
              <ModeButton conversation={conversation} mode="ai" />
            </div>
          </div>

          {/* Shared contact panel body (tabs + sections) */}
          <ContactPanelBody conversation={conversation} onPhotoClick={() => setViewPhoto(true)} />
        </div>
      </div>
      {viewPhoto && <ProfilePhotoViewer contact={contact} isOpen={viewPhoto} onClose={() => setViewPhoto(false)} />}
    </div>,
    document.body
  );
};

const ContactAvatarPhoto = ({ contact, onClick }) => {
  // Renders the photo if available, else initials. Shared by the overlay header.
  const src = resolveAvatarSrc(contact);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src && !failed) {
    return <img src={src} alt={contact?.name || 'avatar'} className="mp-contact-photo-lg" onClick={onClick} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  }
  return (
    <div className="mp-avatar-initials-lg" onClick={onClick} role="button" aria-label="View large photo">
      {getInitials(contact?.name)}
    </div>
  );
};

const ModeButton = ({ conversation, mode }) => {
  const { updateConversation } = useMessageAgent();
  const active = conversation.mode === mode;
  return (
    <button
      onClick={() => updateConversation(conversation.id, { mode })}
      className="h-9 flex-1 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer border"
      style={
        active
          ? { backgroundColor: 'var(--ma-accent)', color: '#fff', borderColor: 'var(--ma-accent)' }
          : { backgroundColor: 'transparent', color: 'var(--ma-muted-text)', borderColor: 'var(--ma-line-slim)' }
      }
    >
      {mode === 'ai' ? <Bot size={12} /> : <Phone size={12} />}
      {mode === 'ai' ? 'AI Auto-Reply' : 'Manual'}
    </button>
  );
};

export { ProfileOverlay };