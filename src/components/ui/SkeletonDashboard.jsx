import React from 'react';
import { SkeletonStatCard } from './SkeletonCard';
import { SkeletonTable } from './SkeletonTable';

export const SkeletonDashboard = () => (
  <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-5 w-36 rounded bg-border/50 animate-pulse" />
        <div className="h-3 w-56 rounded bg-border/50 animate-pulse" />
      </div>
      <div className="h-8 w-24 rounded-lg bg-border/50 animate-pulse" />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>

    <div className="space-y-3">
      <div className="h-4 w-32 rounded bg-border/50 animate-pulse" />
      <SkeletonTable rows={5} cols={4} />
    </div>
  </div>
);

export const SkeletonAnalytics = () => (
  <div className="space-y-6 p-6">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <div className="w-8 h-8 rounded-lg bg-border/50 animate-pulse" />
          <div className="h-3 w-20 rounded bg-border/50 animate-pulse" />
          <div className="h-7 w-12 rounded bg-border/50 animate-pulse" />
        </div>
      ))}
    </div>
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="h-4 w-28 rounded bg-border/50 animate-pulse mb-4" />
      <div className="h-48 rounded-lg bg-border/40 animate-pulse" />
    </div>
  </div>
);
