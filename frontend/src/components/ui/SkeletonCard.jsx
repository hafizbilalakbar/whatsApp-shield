import React from 'react';
import { cn } from './cn';

export const SkeletonCard = ({ className, icon = true, lines = 2 }) => (
  <div className={cn("rounded-xl border border-border bg-surface p-5", className)}>
    <div className="flex items-start gap-4">
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-border/50 animate-pulse shrink-0" />
      )}
      <div className="flex-1 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-border/50 animate-pulse"
            style={{ width: i === lines - 1 ? '60%' : '85%' }}
          />
        ))}
      </div>
    </div>
  </div>
);

export const SkeletonStatCard = () => (
  <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
    <div className="w-8 h-8 rounded-lg bg-border/50 animate-pulse" />
    <div className="space-y-2">
      <div className="h-3 w-24 rounded bg-border/50 animate-pulse" />
      <div className="h-6 w-16 rounded bg-border/50 animate-pulse" />
    </div>
    <div className="h-2 w-32 rounded bg-border/50 animate-pulse" />
  </div>
);
