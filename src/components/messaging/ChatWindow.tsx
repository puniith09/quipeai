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
  
  // Store last input values for button context
  const lastInputValues = useRef<Record<string, string>>({});
  
  // Auth context
  const { login, user, isReturningUser, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  
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

      // Start chat request with streaming text response
      const textResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
          temperature: 0.7,
          max_tokens: 1000,
          responseType: 'text',
          stream: true,
        })
      });

      if (!textResponse.ok) {
        throw new Error(`API error: ${textResponse.status}`);
      }

      // Check for non-streaming tool result response
      const contentType = textResponse.headers.get('content-type');
      console.log('📡 Response Content-Type:', contentType);
      
      if (contentType?.includes('application/json')) {
        console.log('✅ JSON response detected, checking for tool result...');
        const jsonResponse = await textResponse.json();
        console.log('🔍 Full JSON Response:', jsonResponse);
        
        // Check if this is a tool call result
        if (jsonResponse.choices?.[0]?.message?.tool_result) {
          const toolResult = jsonResponse.choices[0].message.tool_result;
          const textContent = jsonResponse.choices[0].message.content || '';
          
          // Check if user just authenticated successfully
          if (toolResult.metadata?.authenticated && toolResult.metadata?.userId) {
            logger.info('🎉 User authenticated via tool result', { 
              userId: toolResult.metadata.userId 
            });
            
            // Set the authentication cookie using the token from server
            if (toolResult.metadata.token) {
              logger.info('🍪 Setting session cookie from token');
              
              fetch('/api/auth/set-session', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  token: toolResult.metadata.token,
                }),
              }).then(async (response) => {
                logger.info('🍪 Set-session response:', response.status);
                
                if (response.ok) {
                  const data = await response.json();
                  logger.info('✅ Session cookie set successfully', data);
                  
                  // Update AuthContext with user data (no phone number)
                  login({
                    id: toolResult.metadata.userId,
                    sessionCount: toolResult.metadata.sessionCount,
                  });
                  
                  // Show success toast
                  showToast(
                    <>
                      <span style={{ fontWeight: 700 }}>Welcome!</span> You&apos;re now signed in.
                    </>,
                    'success'
                  );
                } else {
                  const errorData = await response.json();
                  logger.error('❌ Failed to set session cookie:', errorData);
                }
              }).catch((error) => {
                logger.error('❌ Error setting session cookie:', error);
              });
            } else {
              // Fallback: Just update context without cookie
              login({
                id: toolResult.metadata.userId || 'unknown',
                phoneNumber: toolResult.metadata.phoneNumber,
                sessionCount: toolResult.metadata.sessionCount || 1,
                lastLogin: new Date().toISOString(),
              });
              
              // Show success toast
              showToast(
                <>
                  <span style={{ fontWeight: 700 }}>Welcome!</span> You&apos;re now signed in.
                </>,
                'success'
              );
            }
          }
          
          // Create message for animated text
          const textMessageId = `assistant-${Date.now()}`;
          const textMessage: Message = {
            id: textMessageId,
            type: 'assistant',
            content: '',
            timestamp: new Date(),
            messageType: 'text',
          };
          setMessages(prev => [...prev, textMessage]);
          
          // Simulate streaming by adding characters one by one
          let currentIndex = 0;
          const streamInterval = setInterval(() => {
            if (currentIndex < textContent.length) {
              const char = textContent[currentIndex];
              setMessages(prev => prev.map(msg =>
                msg.id === textMessageId
                  ? { ...msg, content: textContent.substring(0, currentIndex + 1) }
                  : msg
              ));
              currentIndex++;
            } else {
              clearInterval(streamInterval);
              
              // Check if there are components to add
              const hasComponents = toolResult.components && toolResult.components.length > 0;
              
              // If no components, clear loading immediately
              if (!hasComponents) {
                setIsLoading(false);
                setIsLoadingComponent(false);
                return;
              }
              
              // If there are components, switch from text loading to component loading
              setIsLoading(false);
              setIsLoadingComponent(true);
              
              // Add component message after a brief delay
              setTimeout(() => {
                console.log('🎯 Tool result components:', JSON.stringify(toolResult.components, null, 2));
                
                // Check if this is an error retry (replace previous component)
                const isErrorRetry = !toolResult.success;
                
                if (isErrorRetry) {
                  // Replace the last component message instead of adding new one
                  setMessages(prev => {
                    // Find the last component message
                    const lastComponentIndex = [...prev].reverse().findIndex(msg => msg.messageType === 'component');
                    if (lastComponentIndex !== -1) {
                      const actualIndex = prev.length - 1 - lastComponentIndex;
                      const newMessages = [...prev];
                      newMessages[actualIndex] = {
                        id: `component-${Date.now()}`,
                        type: 'assistant',
                        content: '',
                        components: toolResult.components,
                        timestamp: new Date(),
                        messageType: 'component',
                      };
                      return newMessages;
                    }
                    // If no previous component found, add new one
                    return [...prev, {
                      id: `component-${Date.now()}`,
                      type: 'assistant',
                      content: '',
                      components: toolResult.components,
                      timestamp: new Date(),
                      messageType: 'component',
                    }];
                  });
                } else {
                  // Success case - add new component
                  const componentMessage: Message = {
                    id: `component-${Date.now()}`,
                    type: 'assistant',
                    content: '',
                    components: toolResult.components,
                    timestamp: new Date(),
                    messageType: 'component',
                  };
                  setMessages(prev => [...prev, componentMessage]);
                }
                
                setIsLoadingComponent(false);
              }, 100); // Small delay to show "wait a sec..." state
            }
          }, 12); // 12ms per character (same speed as server streaming)
          
          return;
        } else {
          // Regular JSON response without tool calls - animate it too
          const content = jsonResponse.choices?.[0]?.message?.content || '';
          const textMessageId = `assistant-${Date.now()}`;
          const textMessage: Message = {
            id: textMessageId,
            type: 'assistant',
            content: '',
            timestamp: new Date(),
            messageType: 'text',
          };
          setMessages(prev => [...prev, textMessage]);
          
          // Simulate streaming
          let currentIndex = 0;
          const streamInterval = setInterval(() => {
            if (currentIndex < content.length) {
              setMessages(prev => prev.map(msg =>
                msg.id === textMessageId
                  ? { ...msg, content: content.substring(0, currentIndex + 1) }
                  : msg
              ));
              currentIndex++;
            } else {
              clearInterval(streamInterval);
              setIsLoading(false);
              setIsLoadingComponent(false);
            }
          }, 12);
          
          return;
        }
      }

      // Create message for streaming text
      const messageId = `assistant-${Date.now()}`;
      const textMessage: Message = {
        id: messageId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        messageType: 'text',
      };

      setMessages(prev => [...prev, textMessage]);

      // Stream the text response
      let fullTextContent = '';
      let isFirstChunk = true;
      
      if (textResponse.body) {
        const reader = textResponse.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              // Stream finished - ensure loading is hidden
              setIsLoading(false);
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            
            // Parse SSE format from OpenRouter
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  setIsLoading(false);
                  continue;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    // Hide "quiping..." only when we receive the first content
                    if (isFirstChunk) {
                      setIsLoading(false);
                      isFirstChunk = false;
                    }
                    
                    fullTextContent += content;
                    
                    // Update message with streaming content
                    setMessages(prev => prev.map(msg =>
                      msg.id === messageId
                        ? { ...msg, content: fullTextContent }
                        : msg
                    ));
                  }
                } catch {
                  // Skip unparseable lines
                  continue;
                }
              }
            }
          }
        } catch (streamError) {
          logger.error('Streaming error:', streamError);
          // Hide loading if there's an error
          setIsLoading(false);
        }
      }
      
      // Final safety check - ensure loading is always hidden after stream completes
      setIsLoading(false);

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
   * AI-powered button press handler - sends message on behalf of user
   */
  const handleComponentButtonPress = async (buttonLabel: string, action?: string, message?: string) => {
    try {
      // If button has a message prop, check for input context
      if (message) {
        logger.debug('🔘', 'Button Click with Message', { buttonLabel, message });
        
        // Check if there's a recent input value to include
        const inputValue = lastInputValues.current['default'] || lastInputValues.current['phone'];
        if (inputValue) {
          // Clear the stored value so it's not reused
          lastInputValues.current = {};
          
          // Just append the value naturally, like: "send me the code +919392766419"
          const combinedMessage = `${message} ${inputValue}`;
          await sendMessage(combinedMessage);
          return;
        }
        
        // No input value, send the button message as-is
        sendMessage(message);
        return;
      }
      
      // Fallback: Use AI to interpret button if no message provided
      const recentMessages = messages.slice(-4).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

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
        
        logger.debug('🔘', 'Button Click Interpreted', { buttonLabel, generated: userMessage });
        
        sendMessage(userMessage);
      } else {
        logger.warn('Button interpret API failed, using fallback');
        sendMessage(buttonLabel);
      }
    } catch (error) {
      logger.error('Error interpreting button click:', error);
      sendMessage(buttonLabel);
    }
  };

  /**
   * Handle TextInput change - store value for button context
   */
  const handleTextInputChange = (value: string, action?: string) => {
    const key = action || 'default';
    lastInputValues.current[key] = value;
    logger.debug('📝', 'TextInput Change', { key, value });
  };

  /**
   * Handle TextInput submission - send value to AI for processing
   */
  const handleTextInputSubmit = async (value: string, action?: string, submitMessage?: string) => {
    logger.debug('📝', 'TextInput Submit', { value, action, submitMessage });
    
    // Store the value for button context (use action as key, or 'default')
    const key = action || 'phone';
    lastInputValues.current[key] = value;
    
    // Construct message that includes the value
    const message = submitMessage 
      ? `${value}` // Just send the value (AI will understand from context)
      : value;
    
    await sendMessage(message);
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
                    {renderComponent(component, index, handleComponentButtonPress, handleTextInputSubmit, handleTextInputChange)}
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
