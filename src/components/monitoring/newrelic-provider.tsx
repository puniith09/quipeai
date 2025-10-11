'use client';

import { useEffect } from 'react';
import { initializeNewRelic, NewRelic } from '@/lib/monitoring/newrelic';

// Track processed performance entries to avoid duplicates
const processedEntries = new Set<string>();

export function NewRelicProvider() {
  useEffect(() => {
    // Initialize New Relic monitoring
    initializeNewRelic();
    
    // Record app launch event (increment counters for first event)
    NewRelic.recordAppEvent('app_launched', {
      platform: 'web',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      timestamp: Date.now()
    }, true); // Increment counters for app launch

    // Track visibility changes
    const handleVisibilityChange = () => {
      NewRelic.recordAppEvent('visibility_changed', {
        isVisible: document.visibilityState === 'visible',
        visibilityState: document.visibilityState,
        timestamp: Date.now()
      });
    };

    // Track page unload for session tracking
    const handleBeforeUnload = () => {
      NewRelic.recordAppEvent('app_closing', {
        timestamp: Date.now(),
        sessionDuration: Date.now() - parseInt(sessionStorage.getItem('app_start_time') || '0')
      });
    };

    // Track network status changes
    const handleOnline = () => {
      NewRelic.recordAppEvent('connection_restored', {
        timestamp: Date.now(),
        navigator_online: navigator.onLine
      });
    };

    const handleOffline = () => {
      NewRelic.recordAppEvent('connection_lost', {
        timestamp: Date.now(),
        navigator_online: navigator.onLine
      });
    };

    // Store app start time for session duration tracking
    sessionStorage.setItem('app_start_time', Date.now().toString());

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Performance monitoring with deduplication
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Create unique key for each performance entry
        const entryKey = `${entry.entryType}-${entry.name}-${Math.round(entry.startTime)}`;
        
        // Skip if already processed
        if (processedEntries.has(entryKey)) {
          return;
        }
        processedEntries.add(entryKey);
        
        if (entry.entryType === 'navigation') {
          NewRelic.recordAppEvent('page_load_time', {
            metricValue: entry.duration,
            metric_type: 'navigation',
            page_url: window.location.href
          }, true); // Increment counters for page load
        } else if (entry.entryType === 'largest-contentful-paint') {
          NewRelic.recordAppEvent('largest_contentful_paint', {
            metricValue: entry.startTime,
            metric_type: 'lcp',
            page_url: window.location.href
          });
        } else if (entry.entryType === 'first-input') {
          // First Input Delay tracking with proper type checking
          const fidEntry = entry as any; // PerformanceEventTiming
          if (fidEntry.processingStart) {
            NewRelic.recordAppEvent('first_input_delay', {
              metricValue: fidEntry.processingStart - entry.startTime,
              inputType: fidEntry.name || 'unknown',
              timestamp: entry.startTime
            });
          }
        }
      });
    });

    // Observe different performance metrics
    try {
      observer.observe({ entryTypes: ['navigation', 'largest-contentful-paint', 'first-input'] });
    } catch (e) {
      // Some browsers might not support all entry types
      console.warn('Performance Observer not fully supported:', e);
    }

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      observer.disconnect();
    };
  }, []);

  return null;
}
