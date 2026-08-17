import React from 'react';

export const SkeletonChatItem = () => (
  <div className="flex items-center gap-3 px-3 py-3">
    <div className="w-10 h-10 rounded-full skeleton-shimmer shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-28 rounded skeleton-shimmer" />
        <div className="h-2.5 w-10 rounded skeleton-shimmer" />
      </div>
      <div className="h-3 w-3/4 rounded skeleton-shimmer" />
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