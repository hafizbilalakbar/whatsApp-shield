import React from 'react';
import { cn } from '../../components/ui/cn';

const ContactAvatar = ({ contact, status, size = 'sm' }) => {
  const sizeClasses = {
    'sm': 'w-10 h-10',
    'md': 'w-12 h-12',
  };
  
  const statusSizeClasses = {
    'sm': 'w-3 h-3 -bottom-0.5 -right-0.5',
    'md': 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-success';
      case 'ai_typing': return 'bg-success animate-pulse';
      case 'typing': return 'bg-warning animate-pulse';
      case 'away': return 'bg-warning';
      case 'busy': return 'bg-error';
      default: return 'bg-text-muted';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.replace(/[+]/g, '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(-2).toUpperCase();
  };

  return (
    <div className={cn("relative shrink-0", sizeClasses[size])}>
      {contact?.avatar ? (
        <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover border border-border" />
      ) : (
        <div className="w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
          {getInitials(contact?.name)}
        </div>
      )}
      {status && (
        <div className={cn("absolute rounded-full border-2 border-surface", statusSizeClasses[size], getStatusColor(status))} />
      )}
    </div>
  );
};

export { ContactAvatar };
