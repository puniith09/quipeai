'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/header';
import { Suggestions } from '@/components/suggestions';
import { Messaging } from '@/components/messaging';

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

  const handleSettingsClick = useCallback(() => {
    // TODO: Implement settings functionality
  }, []);

  const handleSearchClick = useCallback(() => {
    // TODO: Implement search functionality
  }, []);

  const handleSendMessage = useCallback((message: string) => {
    // Send message through the ChatWindow
    chatWindowRef.current?.sendMessage(message);
    
    // Auto-expand on first message
    if (!hasMessages) {
      setHasMessages(true);
      setIsExpanded(true);
    }
  }, [hasMessages]);

  const handleChatScroll = useCallback(() => {
    if (chatScrollRef.current) {
      const { scrollTop } = chatScrollRef.current;
      setIsAtTop(scrollTop <= 5); // Consider at top if within 5px
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
    setIsDragging(true);
    setCurrentTranslate(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
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
  }, [isDragging, dragStartY, hasMessages, isAtTop, isExpanded]);

  const handleTouchEnd = useCallback(() => {
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
  }, [currentTranslate]);

  return (
    <div 
      className="flex flex-col bg-white overflow-hidden relative" 
      style={{ 
        height: viewportHeight,
        touchAction: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header Section */}
      <Header onSettingsClick={handleSettingsClick} />

      {/* Suggestions Section */}
      <Suggestions announcementMessage="Indian Railways extends Covid guidelines, doing thermal screening of passengers" />

      {/* Messaging Section */}
      <Messaging
        isExpanded={isExpanded}
        isDragging={isDragging}
        currentTranslate={currentTranslate}
        hasMessages={hasMessages}
        isAtTop={isAtTop}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onChatScroll={handleChatScroll}
        onSendMessage={handleSendMessage}
        onSearchClick={handleSearchClick}
        chatScrollRef={chatScrollRef}
        chatWindowRef={chatWindowRef}
      />
    </div>
  );
}
