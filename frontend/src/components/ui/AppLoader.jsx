import React, { useState, useEffect } from 'react';
import { Shield, MessageCircle } from 'lucide-react';
import { cn } from './cn';

export const AppLoader = ({ onFinish }) => {
  const [phase, setPhase] = useState('entering');

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPhase('visible');
    });
    const showTimer = setTimeout(() => {
      setPhase('exiting');
    }, 200);
    const exitTimer = setTimeout(() => {
      onFinish?.();
    }, 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
    };
  }, [onFinish]);

  return (
    <div className={cn(
      "fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background transition-all duration-200 ease-out",
      phase === 'entering' && 'opacity-0',
      phase === 'visible' && 'opacity-100',
      phase === 'exiting' && 'opacity-0 scale-[1.02]'
    )}>
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-lg">
            <Shield size={32} className="text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center animate-pulse shadow-sm">
            <MessageCircle size={12} className="text-white" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">WhatsApp</span>
            <span className="text-sm font-bold text-primary">Shield</span>
          </div>
          <p className="text-[11px] text-text-muted font-medium">Loading...</p>
        </div>
      </div>
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};
