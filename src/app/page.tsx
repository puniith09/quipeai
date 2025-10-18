'use client';

import React, { useRef, useState, useEffect } from 'react';
import { QuipeTextLogo } from '@/components/icons/QuipeTextLogo';
import { SettingsButton } from '@/components/icons/SettingsButton';
import { SearchButton } from '@/components/icons/SearchButton';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MessageInput } from '@/components/chat/MessageInput';
import { Carousel } from '@/components/Carousel';
import { AnnouncementTicker } from '@/components/AnnouncementTicker';

export default function Home() {
  const chatWindowRef = useRef<{ sendMessage: (message: string) => void } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentTranslate, setCurrentTranslate] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [viewportHeight, setViewportHeight] = useState('100vh');

  // Set actual viewport height for mobile browsers
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${vh}px`);
      setViewportHeight(`${vh}px`);
    };

    setVH();
    
    // Update on resize but not on scroll (which changes innerHeight on mobile)
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setVH, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  const handleSettingsClick = () => {
    // TODO: Implement settings functionality
  };

  const handleSearchClick = () => {
    // TODO: Implement search functionality
  };

  const handleSendMessage = (message: string) => {
    // Send message through the ChatWindow
    chatWindowRef.current?.sendMessage(message);
    
    // Auto-expand on first message
    if (!hasMessages) {
      setHasMessages(true);
      setIsExpanded(true);
    }
  };

  const handleChatScroll = () => {
    if (chatScrollRef.current) {
      const { scrollTop } = chatScrollRef.current;
      setIsAtTop(scrollTop <= 5); // Consider at top if within 5px
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
    setIsDragging(true);
    setCurrentTranslate(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY; // Positive when dragging down, negative when dragging up
    
    // Calculate max drag distance (200px = distance between collapsed and expanded)
    const maxDrag = 200;
    
    // Check if we should allow header swipe
    const shouldAllowSwipe = !hasMessages || (isAtTop && diff > 0) || (!isExpanded && diff < 0);
    
    if (!shouldAllowSwipe) return;
    
    // When expanded: allow dragging down (positive diff)
    // When collapsed: allow dragging up (negative diff)
    if (isExpanded && diff > 0 && diff <= maxDrag) {
      setCurrentTranslate(diff);
      e.preventDefault(); // Prevent scroll when swiping header
    } else if (!isExpanded && diff < 0 && diff >= -maxDrag) {
      setCurrentTranslate(diff);
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // If dragged more than 50px, toggle state
    if (Math.abs(currentTranslate) > 50) {
      if (currentTranslate < 0) {
        setIsExpanded(true); // Dragged up
      } else {
        setIsExpanded(false); // Dragged down
      }
    }
    setCurrentTranslate(0);
  };

  return (
    <div 
      className="flex flex-col bg-white overflow-hidden relative" 
      style={{ 
        height: viewportHeight,
        touchAction: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-2 pb-0 bg-white flex-shrink-0" style={{ touchAction: 'none', paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
        <QuipeTextLogo size={26} />
        <button 
          onClick={handleSettingsClick}
          className="p-2 hover:opacity-70 transition-opacity"
          aria-label="Settings"
        >
          <SettingsButton size={20} />
        </button>
      </header>

      {/* Carousel Section */}
      <div className="flex-shrink-0" style={{ touchAction: 'pan-x' }}>
        <Carousel />
      </div>

      {/* Announcement Ticker */}
      <div className="flex-shrink-0" style={{ touchAction: 'none' }}>
        <AnnouncementTicker message="Indian Railways extends Covid guidelines, doing thermal screening of passengers" />
      </div>

      {/* Chat Section - Swipeable */}
      <main 
        className="absolute bottom-0 left-0 right-0 bg-black rounded-t-[24px] flex flex-col"
        style={{ 
          height: 'calc(100% - 50px)',
          transform: isDragging 
            ? `translateY(${isExpanded ? currentTranslate : (200 - Math.abs(currentTranslate))}px)`
            : `translateY(${isExpanded ? 0 : 200}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          touchAction: 'pan-y'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Chat Header - Drag Handle */}
        <div className="relative px-5 py-2 bg-[#313131] rounded-t-[24px] cursor-grab active:cursor-grabbing">
          {/* Centered drag bar */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-600 rounded-full" />
          
          {/* Header content */}
          <div className="flex items-center justify-between pt-2">
            <h1 className="text-white text-lg font-bold">Chat</h1>
            <div className="flex gap-3">
              <button 
                onClick={handleSearchClick}
                className="p-2 hover:opacity-70 transition-opacity"
                aria-label="Search"
              >
                <SearchButton size={20} color="white" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages Container - Takes remaining space */}
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleChatScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <ChatWindow ref={chatWindowRef} />
        </div>
      </main>

      {/* Message Input Container - Fixed at bottom with safe area */}
      <div 
        className="absolute left-0 right-0 z-50"
        style={{
          bottom: 'calc(-0 * env(safe-area-inset-bottom, 0px))',
        }}
      >
        <MessageInput 
          onSendMessage={handleSendMessage}
          placeholder="residency"
        />
      </div>
    </div>
  );
}
