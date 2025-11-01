'use client';

import React, { useState, useRef, useEffect } from 'react';
import { renderComponent, type ComponentNode } from '@/rendering-engine';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  components?: ComponentNode[]; // JSON components to render
  timestamp: Date;
  messageType?: 'text' | 'component'; // Message type for rendering
}

interface ChatWindowRef {
  sendMessage: (message: string) => void;
}

interface ChatWindowProps {
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const ChatWindow = React.forwardRef<ChatWindowRef, ChatWindowProps>(({ scrollContainerRef: externalScrollRef }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingComponent, setIsLoadingComponent] = useState(false);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  
  // Auth context
  const { login, user, isReturningUser, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  
  // OTP state management
  const [otpState, setOtpState] = useState<{
    stage: 'idle' | 'awaiting_phone' | 'awaiting_otp';
    phoneNumber?: string;
  }>({ stage: 'idle' });
  
  // Use external ref if provided, otherwise use internal ref
  const scrollContainerRef = externalScrollRef || internalScrollRef;

  // Show welcome back toast for returning users
  useEffect(() => {
    if (!authLoading && isReturningUser && user) {
      showToast(`Welcome back, ${user.phoneNumber}!`, 'success');
    }
  }, [authLoading, isReturningUser, user, showToast]);

  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    // Reset user scrolling state when sending a message - force scroll to bottom
    setIsUserScrolling(false);

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Scroll to bottom immediately when user sends a message
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }

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

      // Get user location for AI tools (searchBusinesses will use this)
      const userLocation = { lat: 17.433, lng: 78.449 }; // Default: Same zone as seeded businesses

      // ====== SIMPLIFIED: Single API call - AI handles everything via tool calling ======
      // The AI will automatically:
      // 1. Detect search intent ("find a salon")
      // 2. Call searchBusinesses tool with location
      // 3. Get real business data from Supermemory
      // 4. Auto-generate UI components
      // 5. Return text response + components in one response
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
          temperature: 0.7,
          max_tokens: 1000,
          location: userLocation, // Passed to AI for searchBusinesses tool
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Handle streaming response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        // Create assistant message for streaming text
        const assistantMessageId = `assistant-${Date.now()}`;
        const assistantMessage: Message = {
          id: assistantMessageId,
          type: 'assistant',
          content: '',
          timestamp: new Date(),
          messageType: 'text',
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false); // Show message immediately with empty content
        
        let accumulatedText = '';
        let receivedComponents: ComponentNode[] | null = null;
        
        try {
          while (reader) {
            const { done, value } = await reader.read();
            
            // Process chunk even if done is true (to catch final components)
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              
              console.log('📦 Stream chunk lines:', lines.length, 'done:', done);
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    console.log('✅ Stream completed');
                    continue;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    
                    // Handle custom events (components)
                    if (parsed.type === 'components') {
                      console.log('🎯 DETECTED COMPONENT EVENT:', parsed);
                      receivedComponents = parsed.data;
                      continue;
                    }
                    
                    // Handle standard OpenRouter streaming format
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      accumulatedText += delta;
                      
                      // Update message with accumulated text
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId 
                          ? { ...msg, content: accumulatedText }
                          : msg
                      ));
                    }
                  } catch (parseError) {
                    // Ignore parse errors for malformed chunks
                  }
                }
              }
            }
            
            if (done) break;
          }
          
          // After streaming is done, add components if they were received
          if (receivedComponents && receivedComponents.length > 0) {
            console.log('✨ COMPONENTS RECEIVED:', receivedComponents);
            logger.debug('✨', 'Received components from stream', receivedComponents);
            
            const componentMessage: Message = {
              id: `component-${Date.now()}`,
              type: 'assistant',
              content: '',
              components: receivedComponents,
              timestamp: new Date(),
              messageType: 'component',
            };
            
            console.log('✨ ADDING COMPONENT MESSAGE:', componentMessage);
            setMessages(prev => [...prev, componentMessage]);
          } else {
            console.log('❌ NO COMPONENTS RECEIVED:', receivedComponents);
          }
        } catch (streamError) {
          logger.error('Stream reading error:', streamError);
        }
      } else {
        // Fallback to non-streaming response
        const data = await response.json();
        
        logger.debug('🤖', 'AI Response', data);
        
        // Extract text response
        const assistantContent = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
        
        // Extract auto-generated components (if AI called searchBusinesses + generateComponents)
        const components = data.components;

        // Hide loading indicator
        setIsLoading(false);

        // Add text response message
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          type: 'assistant',
          content: assistantContent,
          timestamp: new Date(),
          messageType: 'text',
        };

        setMessages(prev => [...prev, assistantMessage]);

        // If components were auto-generated, add them as a separate message
        if (components && components.length > 0) {
          logger.debug('✨', 'Auto-generated components', components);
          
          const componentMessage: Message = {
            id: `component-${Date.now()}`,
            type: 'assistant',
            content: '',
            components: components,
            timestamp: new Date(),
            messageType: 'component',
          };

          setMessages(prev => [...prev, componentMessage]);
        }
      }

    } catch (error) {
      logger.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: error instanceof Error 
          ? `Error: ${error.message}` 
          : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        messageType: 'text',
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      setIsLoadingComponent(false);
    }
  };

  // Expose sendMessage method via ref
  React.useImperativeHandle(ref, () => ({
    sendMessage,
  }));

  // Track if user has manually scrolled up
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect manual scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
      
      // If user scrolled up, mark as manual scrolling and keep it that way
      if (!isAtBottom) {
        setIsUserScrolling(true);
        
        // Clear any existing timeout to prevent auto-reset
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = null;
        }
      } else {
        // User scrolled back to bottom - resume auto-scroll
        setIsUserScrolling(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollContainerRef]);

  // Auto scroll to bottom when messages change (only if user isn't scrolling)
  useEffect(() => {
    if (scrollContainerRef.current && !isUserScrolling) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading, isLoadingComponent, isUserScrolling, scrollContainerRef]);

  // Additional scroll effect that runs more frequently during updates
  useEffect(() => {
    // Only run interval during active streaming or loading
    if (!isLoading && !isLoadingComponent) {
      return;
    }

    const scrollToBottom = () => {
      if (scrollContainerRef.current && !isUserScrolling) {
        // Smooth scroll during streaming
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    };

    // Set up interval to keep scrolling during streaming with smooth behavior
    const intervalId = setInterval(scrollToBottom, 300);

    return () => clearInterval(intervalId);
  }, [messages.length, isUserScrolling, isLoading, isLoadingComponent, scrollContainerRef]); // Only run when actively loading

  /**
   * AI-powered button press handler - generates natural user message
   */
  const handleComponentButtonPress = async (buttonLabel: string, action?: string) => {
    try {
      // Get recent conversation context (last 2 exchanges = 4 messages)
      const recentMessages = messages.slice(-4).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Call AI to generate a natural user message
      const response = await fetch('/api/button-interpret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buttonLabel,
          action,
          recentMessages
        })
      });

      if (response.ok) {
        const data = await response.json();
        const userMessage = data.message || buttonLabel;
        
        logger.debug('🔘', 'Button Click', { buttonLabel, generated: userMessage });
        
        // Send the AI-generated natural message
        sendMessage(userMessage);
      } else {
        // Fallback if API fails
        logger.warn('Button interpret API failed, using fallback');
        sendMessage(buttonLabel);
      }
    } catch (error) {
      logger.error('Error interpreting button click:', error);
      // Fallback to button label
      sendMessage(buttonLabel);
    }
  };

  /**
   * Handle TextInput submission for OTP flows
   */
  const handleTextInputSubmit = async (value: string, action?: string) => {
    logger.debug('📝', 'TextInput Submit', { value, action });
    
    // For ALL text input submissions, send as a chat message
    // The AI will handle phone numbers, OTP codes, and any other inputs
    if (value.trim()) {
      // Send as a regular chat message - AI will handle it
      sendMessage(value);
    }
  };

  return (
    <div className="px-4 md:px-6 py-4 pb-24">
      {messages.map((message) => (
        <React.Fragment key={message.id}>
            {/* Text message in bubble - only if message has text content */}
            {message.content && (
              <div 
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
            )}
            
            {/* Components rendered OUTSIDE bubble - directly in chat */}
            {message.components && message.components.length > 0 && (
              <div className="my-3 space-y-2">
                {message.components.map((component, index) => (
                  <div key={index}>
                    {renderComponent(component, index, handleComponentButtonPress, handleTextInputSubmit)}
                  </div>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Loading state - text generation */}
        {isLoading && (
          <div className="my-1 flex justify-start">
            <div className="max-w-[85%] md:max-w-[500px] px-4 py-3 rounded-2xl my-0.5 bg-[#2a2a2a] rounded-bl-[4px]">
              <div className="text-gray-400 text-sm italic">
                quiping...
              </div>
            </div>
          </div>
        )}

        {/* Loading state - component generation */}
        {isLoadingComponent && (
          <div className="my-1 flex justify-start">
            <div className="max-w-[85%] md:max-w-[500px] px-4 py-3 rounded-2xl my-0.5 bg-[#2a2a2a] rounded-bl-[4px]">
              <div className="text-gray-400 text-sm italic">
                wait a sec...
              </div>
            </div>
          </div>
        )}
      </div>
  );
});

ChatWindow.displayName = 'ChatWindow';
