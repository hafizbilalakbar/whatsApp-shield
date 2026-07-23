import React from 'react';

export const SkeletonChatItem = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className="w-10 h-10 rounded-full bg-border/50 animate-pulse shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-28 rounded bg-border/50 animate-pulse" />
        <div className="h-2.5 w-10 rounded bg-border/40 animate-pulse" />
      </div>
      <div className="h-3 w-3/4 rounded bg-border/40 animate-pulse" />
    </div>
  </div>
);

export const SkeletonChatList = ({ count = 6 }) => (
  <div className="divide-y divide-border/50">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonChatItem key={i} />
    ))}
  </div>
);
