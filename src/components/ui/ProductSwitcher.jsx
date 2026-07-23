import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, MessageCircle } from 'lucide-react';
import { cn } from './cn';

export const ProductSwitcher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const isAgent = path === '/message-agent';
  const isShield = !isAgent && path !== '/';

  const switchTo = (product) => {
    if (product === 'shield') navigate('/dashboard');
    else navigate('/message-agent');
  };

  return (
    <div className="relative flex items-center bg-surface/60 border border-border/70 rounded-lg p-0.5 shadow-sm">
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 w-1/2 rounded-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0",
          isShield
            ? "left-0.5 bg-primary/10 border border-primary/20"
            : "left-[calc(50%-2px)] bg-[#25D366]/10 border border-[#25D366]/20"
        )}
      />
      <button
        onClick={() => switchTo('shield')}
        disabled={isShield}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 w-[82px] sm:w-[90px] py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all duration-200",
          isShield
            ? "text-primary cursor-default"
            : "text-text-muted hover:text-text-secondary cursor-pointer"
        )}
      >
        <Shield size={13} className={cn(isShield && "text-primary")} />
        <span>Shield</span>
      </button>
      <button
        onClick={() => switchTo('agent')}
        disabled={isAgent}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 w-[82px] sm:w-[90px] py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all duration-200",
          isAgent
            ? "text-[#25D366] cursor-default"
            : "text-text-muted hover:text-text-secondary cursor-pointer"
        )}
      >
        <MessageCircle size={13} className={cn(isAgent && "text-[#25D366]")} />
        <span>Agent</span>
      </button>
    </div>
  );
};
