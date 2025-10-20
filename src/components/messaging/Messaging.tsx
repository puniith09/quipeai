'use client';

import React from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatWindow } from './ChatWindow';
import { MessageInput } from './MessageInput';

interface MessagingProps {
  isExpanded: boolean;
  isDragging: boolean;
  currentTranslate: number;
  hasMessages: boolean;
  isAtTop: boolean;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onChatScroll: () => void;
  onSendMessage: (message: string) => void;
  onSearchClick: () => void;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  chatWindowRef: React.MutableRefObject<{ sendMessage: (message: string) => void } | null>;
}

export const Messaging: React.FC<MessagingProps> = ({
  isExpanded,
  isDragging,
  currentTranslate,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onChatScroll,
  onSendMessage,
  onSearchClick,
  chatScrollRef,
  chatWindowRef,
}) => {
  return (
    <>
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
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Chat Header - Drag Handle */}
        <ChatHeader onSearchClick={onSearchClick} />

        {/* Messages Container - Takes remaining space */}
        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto"
          onScroll={onChatScroll}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <ChatWindow ref={chatWindowRef} scrollContainerRef={chatScrollRef} />
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
          onSendMessage={onSendMessage}
          placeholder="residency"
        />
      </div>
    </>
  );
};
