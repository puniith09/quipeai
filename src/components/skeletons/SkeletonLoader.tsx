'use client';

import React from 'react';

interface SkeletonLoaderProps {
  type: 'carousel' | 'list' | 'card' | 'text';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  type, 
  count = 1 
}) => {
  switch (type) {
    case 'carousel':
      return <CarouselSkeleton count={count} />;
    case 'list':
      return <ListSkeleton count={count} />;
    case 'card':
      return <CardSkeleton count={count} />;
    case 'text':
    default:
      return <TextSkeleton count={count} />;
  }
};

const CarouselSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex gap-3 overflow-hidden py-2">
    {Array.from({ length: count }).map((_, i) => (
      <div 
        key={i}
        className="min-w-[280px] h-[380px] rounded-2xl bg-gray-800 animate-pulse"
      >
        {/* Image skeleton */}
        <div className="h-[250px] bg-gray-700 rounded-t-2xl" />
        
        {/* Content skeleton */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <div className="h-6 bg-gray-700 rounded w-3/4" />
          {/* Subtitle */}
          <div className="h-4 bg-gray-700 rounded w-1/2" />
          {/* Description lines */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-700 rounded w-5/6" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ListSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div 
        key={i}
        className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 animate-pulse"
      >
        {/* Icon/Avatar */}
        <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0" />
        
        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-700 rounded w-1/2" />
        </div>
        
        {/* Action indicator */}
        <div className="w-6 h-6 rounded bg-gray-700 flex-shrink-0" />
      </div>
    ))}
  </div>
);

const CardSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div 
        key={i}
        className="rounded-xl bg-gray-800 p-4 animate-pulse"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-700 rounded w-1/3" />
          <div className="w-8 h-8 rounded-full bg-gray-700" />
        </div>
        
        {/* Content */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-700 rounded w-5/6" />
          <div className="h-4 bg-gray-700 rounded w-4/6" />
        </div>
        
        {/* Footer */}
        <div className="flex gap-2 mt-4">
          <div className="h-9 bg-gray-700 rounded-lg w-24" />
          <div className="h-9 bg-gray-700 rounded-lg w-32" />
        </div>
      </div>
    ))}
  </div>
);

const TextSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div 
        key={i}
        className="h-4 bg-gray-800 rounded animate-pulse"
        style={{ width: `${Math.random() * 30 + 70}%` }}
      />
    ))}
  </div>
);
