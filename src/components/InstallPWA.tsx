'use client';

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPWAProps {
  inline?: boolean;
}

export const InstallPWA: React.FC<InstallPWAProps> = ({ inline = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if app is already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isInstalled) {
      setShowInstallButton(false);
      return;
    }

    // For iOS Safari, show button if not installed
    if (isIOSDevice) {
      setShowInstallButton(true);
      return;
    }

    // Listen for the beforeinstallprompt event (Android/Desktop Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the install button
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // For iOS, show instructions modal
    if (isIOS) {
      setShowIOSPrompt(true);
      return;
    }

    // For Android/Desktop Chrome
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt so it can only be used once
    setDeferredPrompt(null);
  };

  if (!showInstallButton) return null;

  return (
    <>
      {inline ? (
        // Inline button for header
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 bg-[#2563eb] text-white text-sm rounded-lg font-medium hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5"
          aria-label="Download App"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Install
        </button>
      ) : (
        // Fixed position button
        <button
          onClick={handleInstallClick}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-[#2563eb] text-white rounded-lg font-medium shadow-lg hover:bg-[#1d4ed8] transition-colors flex items-center gap-2"
          aria-label="Download App"
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download App
        </button>
      )}

      {/* iOS Install Instructions Modal */}
      {showIOSPrompt && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-end justify-center"
          onClick={() => setShowIOSPrompt(false)}
        >
          <div 
            className="bg-white rounded-t-3xl p-6 w-full max-w-md mb-0 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Install QuipeAI</h3>
              <button
                onClick={() => setShowIOSPrompt(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                To install this app on your iPhone:
              </p>
              
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-2xl">1️⃣</span>
                <div>
                  <p className="font-medium text-gray-900">Tap the Share button</p>
                  <p className="text-sm text-gray-600">
                    Look for the <svg className="inline w-4 h-4 mx-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                    </svg> icon at the bottom of the screen
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-2xl">2️⃣</span>
                <div>
                  <p className="font-medium text-gray-900">Select "Add to Home Screen"</p>
                  <p className="text-sm text-gray-600">Scroll down and tap this option</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-2xl">3️⃣</span>
                <div>
                  <p className="font-medium text-gray-900">Tap "Add"</p>
                  <p className="text-sm text-gray-600">Confirm by tapping "Add" in the top right</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowIOSPrompt(false)}
              className="w-full mt-6 bg-[#2563eb] text-white py-3 rounded-lg font-medium hover:bg-[#1d4ed8] transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
