'use client';

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('beforeinstallprompt event fired');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if we should show the prompt (not temporarily dismissed)
      const tempDismissedUntil = localStorage.getItem('pwa-install-temp-dismissed');
      const shouldShow = !tempDismissedUntil || Date.now() >= parseInt(tempDismissedUntil);
      
      console.log('Should show prompt:', shouldShow);
      
      if (shouldShow) {
        setShowInstallPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      console.log('App installed');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      // Clear any dismissal state since app is now installed
      localStorage.removeItem('pwa-install-temp-dismissed');
    };

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('App already installed');
      setIsInstalled(true);
      return;
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For development/preview: Show prompt after 2 seconds if event didn't fire
    const devTimer = setTimeout(() => {
      if (!deferredPrompt && !isInstalled) {
        console.log('DEV MODE: Showing install prompt (beforeinstallprompt did not fire)');
        const tempDismissedUntil = localStorage.getItem('pwa-install-temp-dismissed');
        const shouldShow = !tempDismissedUntil || Date.now() >= parseInt(tempDismissedUntil);
        if (shouldShow) {
          setShowInstallPrompt(true);
        }
      }
    }, 2000);

    // Set up a timer to check for temporary dismissal expiry
    const checkDismissalTimer = setInterval(() => {
      const tempDismissedUntil = localStorage.getItem('pwa-install-temp-dismissed');
      if (tempDismissedUntil && Date.now() >= parseInt(tempDismissedUntil)) {
        localStorage.removeItem('pwa-install-temp-dismissed');
        // If we have a deferred prompt and app is not installed, show the prompt again
        if (!isInstalled) {
          setShowInstallPrompt(true);
        }
      }
    }, 1000); // Check every second

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(devTimer);
      clearInterval(checkDismissalTimer);
    };
  }, [deferredPrompt, isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If no deferred prompt (dev/preview mode), show manual instructions
      console.log('No deferred prompt available - showing instructions');
      alert('To install this app:\n\n1. Open browser menu (⋮)\n2. Select "Install app" or "Add to Home screen"\n3. Tap "Install"');
      return;
    }

    console.log('Showing install prompt');
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log('User choice:', outcome);
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    } else {
      // If user dismissed the native prompt, hide temporarily but will show again on next visit
      setShowInstallPrompt(false);
      // Store a short-term dismissal (30 seconds) to avoid immediate re-showing
      localStorage.setItem('pwa-install-temp-dismissed', (Date.now() + 30000).toString());
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Only temporarily hide for 30 seconds instead of permanently
    localStorage.setItem('pwa-install-temp-dismissed', (Date.now() + 30000).toString());
  };

  // Don't show if already installed
  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  // Check if user dismissed recently (only 30 seconds temporary dismissal)
  const tempDismissedUntil = localStorage.getItem('pwa-install-temp-dismissed');
  if (tempDismissedUntil && Date.now() < parseInt(tempDismissedUntil)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm">
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="text-[#2563eb] flex-shrink-0"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Install QuipeAI</p>
          <p className="text-xs text-gray-600">
            Add to home screen for quick access
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-[#2563eb] text-white text-sm rounded-lg font-medium hover:bg-[#1d4ed8] transition-colors"
          >
            Install
          </button>
          <button 
            onClick={handleDismiss}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
