'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatWindowRef {
  sendMessage: (message: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ChatWindowProps {
  // Props can be added here in future
}

export const ChatWindow = React.forwardRef<ChatWindowRef, ChatWindowProps>((_, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Add current message
      conversationHistory.push({
        role: 'user',
        content: messageContent.trim()
      });

      // Call our Next.js API route (server-side) instead of OpenRouter directly
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
          temperature: 0.7,
          max_tokens: 1000,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content || 'No response generated';
      
      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: error instanceof Error 
          ? `Error: ${error.message}` 
          : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose sendMessage method via ref
  React.useImperativeHandle(ref, () => ({
    sendMessage,
  }));

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
      <div className="px-4 md:px-6 py-4 pb-24">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`my-1 ${
              message.type === 'user' ? 'flex justify-end' : 'flex justify-start'
            }`}
          >
            <div 
              className={`max-w-[85%] md:max-w-[500px] px-4 py-3 rounded-2xl my-0.5 ${
                message.type === 'user' 
                  ? 'bg-[#007AFF] rounded-br-[4px]' 
                  : 'bg-[#2a2a2a] rounded-bl-[4px]'
              }`}
            >
              <div className="text-white text-base">
                {message.content}
              </div>
            </div>
          </div>
        ))}

        {/* Loading state */}
        {isLoading && (
          <div className="my-1 flex justify-start">
            <div className="max-w-[85%] md:max-w-[500px] px-4 py-3 rounded-2xl my-0.5 bg-[#2a2a2a] rounded-bl-[4px]">
              <div className="text-gray-400 text-sm italic">
                quiping...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ChatWindow.displayName = 'ChatWindow';
