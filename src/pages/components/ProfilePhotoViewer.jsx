import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBodyScrollLock } from './useBodyScrollLock';
import { resolveAvatarSrc } from './ContactAvatar';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = String(name).replace(/[+]/g, '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).slice(-2).toUpperCase();
};

// WhatsApp-style profile-picture lightbox. Renders ONLY the photo (or a graceful
// fallback) on a subtle backdrop — no phone, country, tabs or any other panel
// content. Fully controlled: the parent decides when it mounts via `isOpen`.
const ProfilePhotoViewer = ({ contact, isOpen, onClose }) => {
  const mounted = !!isOpen && !!contact;
  useBodyScrollLock(mounted);

  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = resolveAvatarSrc(contact);

  useEffect(() => {
    if (!mounted) return;
    setLoaded(false);
    setFailed(false);
  }, [mounted, src]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  const showImage = !!src && !failed;

  return createPortal(
    <div className="msg-photo-viewer-backdrop mp-fade-in" onClick={onClose}>
      <div className="msg-photo-viewer mp-zoom-in" onClick={(e) => e.stopPropagation()}>
        {showImage ? (
          <>
            {!loaded && <div className="msg-photo-viewer-loader" aria-hidden="true" />}
            <img
              src={src}
              alt={contact.name || 'Profile photo'}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              onClick={onClose}
              style={{ opacity: loaded ? 1 : 0 }}
            />
          </>
        ) : (
          <div className="msg-photo-viewer-fallback">
            <div className="mp-avatar-initials-lg">{getInitials(contact.name)}</div>
            <p>{failed ? 'Unable to load profile photo.' : 'No profile photo available.'}</p>
          </div>
        )}
        <button
          onClick={onClose}
          className="msg-photo-viewer-close"
          title="Close"
          aria-label="Close profile photo"
        >
          <X size={16} />
        </button>
      </div>
      <span className="sr-only">Close photo viewer</span>
    </div>,
    document.body
  );
};

export { ProfilePhotoViewer };