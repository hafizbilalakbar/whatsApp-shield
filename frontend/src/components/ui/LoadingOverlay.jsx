import React from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export const LoadingOverlay = ({ show = false, text = 'Loading...' }) => {
  if (!show) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[1px] animate-fade-in rounded-xl">
      <Spinner size={22} className="text-primary mb-2" />
      <p className="text-xs text-text-muted font-medium">{text}</p>
    </div>
  );
};

export const LoadingSkeleton = ({ children, loading, skeleton }) => {
  if (!loading) return children;

  return (
    <div className="relative">
      <div className="opacity-20 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 z-10">
        {skeleton}
      </div>
    </div>
  );
};
