import React from 'react';
import { cn } from './cn';

export const Spinner = ({ size = 16, className }) => (
  <svg
    className={cn("animate-spin shrink-0", className)}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-20" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-100" />
  </svg>
);

export const BrandLoader = ({ size = 40, text }) => (
  <div className="flex flex-col items-center justify-center gap-4">
    <div className="relative">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-[#25D366]">
        <path d="M12 2a10 10 0 0 0-10 10c0 1.97.57 3.8 1.55 5.36L2 22l4.64-1.55A10 10 0 1 0 12 2z" fill="currentColor" className="opacity-10" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin" style={{ transformOrigin: 'center' }} />
      </svg>
    </div>
    {text && <p className="text-xs text-text-muted font-medium animate-pulse">{text}</p>}
  </div>
);
