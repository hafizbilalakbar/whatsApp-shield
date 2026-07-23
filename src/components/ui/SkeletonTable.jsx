import React from 'react';
import { cn } from './cn';

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="rounded-xl border border-border bg-surface overflow-hidden">
    <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols }).map((_, ci) => (
        <div key={`h-${ci}`} className="p-3 border-b border-border">
          <div className="h-3 w-3/4 rounded bg-border/50 animate-pulse" />
        </div>
      ))}
    </div>
    {Array.from({ length: rows }).map((_, ri) => (
      <div key={`r-${ri}`} className="grid gap-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, ci) => (
          <div key={`c-${ri}-${ci}`} className="p-3 border-b border-border/50">
            <div className={cn(
              "h-3 rounded bg-border/40 animate-pulse",
              ci === 0 ? 'w-4/5' : ci === cols - 1 ? 'w-1/3' : 'w-1/2'
            )} />
          </div>
        ))}
      </div>
    ))}
  </div>
);
