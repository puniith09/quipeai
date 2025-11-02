'use client';

import { useEffect } from 'react';
import { initializeNewRelic, NewRelic } from '@/lib/monitoring/newrelic';

const processedEntries = new Set<string>();

export function NewRelicProvider() {
  useEffect(() => {
    initializeNewRelic();
    
    NewRelic.recordAppEvent('app_launched', {
      platform: 'web',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      timestamp: Date.now()
    }, true); // Increment counters for app launch

    const handleVisibilityChange = () => {
      NewRelic.recordAppEvent('visibility_changed', {
        isVisible: document.visibilityState === 'visible',
        visibilityState: document.visibilityState,
        timestamp: Date.now()
      });
    };

    const handleBeforeUnload = () => {
      NewRelic.recordAppEvent('app_closing', {
        timestamp: Date.now(),
        sessionDuration: Date.now() - parseInt(sessionStorage.getItem('app_start_time') || '0')
      });
    };

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

    sessionStorage.setItem('app_start_time', Date.now().toString());

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const entryKey = `${entry.entryType}-${entry.name}-${Math.round(entry.startTime)}`;
        
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
          const fidEntry = entry as PerformanceEntry & { processingStart?: number; name?: string };
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

    try {
      observer.observe({ entryTypes: ['navigation', 'largest-contentful-paint', 'first-input'] });
    } catch (e) {
      console.warn('Performance Observer not fully supported:', e);
    }

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
