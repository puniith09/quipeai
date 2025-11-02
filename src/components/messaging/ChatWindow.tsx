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
  
  const lastInputValues = useRef<Record<string, string>>({});
  
  const { login, user, isReturningUser, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  
  const scrollContainerRef = externalScrollRef || internalScrollRef;

  useEffect(() => {
    if (!authLoading && isReturningUser && user) {
      showToast(`Welcome back, ${user.phoneNumber}!`, 'success');
    }
  }, [authLoading, isReturningUser, user, showToast]);

  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    setIsUserScrolling(false);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      conversationHistory.push({
        role: 'user',
        content: messageContent.trim()
      });

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

      const contentType = textResponse.headers.get('content-type');
      console.log('📡 Response Content-Type:', contentType);
      
      if (contentType?.includes('application/json')) {
        console.log('✅ JSON response detected, checking for tool result...');
        const jsonResponse = await textResponse.json();
        console.log('🔍 Full JSON Response:', jsonResponse);
        
        if (jsonResponse.choices?.[0]?.message?.tool_result) {
          const toolResult = jsonResponse.choices[0].message.tool_result;
          const textContent = jsonResponse.choices[0].message.content || '';
          
          if (toolResult.metadata?.authenticated && toolResult.metadata?.userId) {
            logger.info('🎉 User authenticated via tool result', { 
              userId: toolResult.metadata.userId 
            });
            
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
                  
                  login({
                    id: toolResult.metadata.userId,
                    sessionCount: toolResult.metadata.sessionCount,
                  });
                  
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
              login({
                id: toolResult.metadata.userId || 'unknown',
                phoneNumber: toolResult.metadata.phoneNumber,
                sessionCount: toolResult.metadata.sessionCount || 1,
                lastLogin: new Date().toISOString(),
              });
              
              showToast(
                <>
                  <span style={{ fontWeight: 700 }}>Welcome!</span> You&apos;re now signed in.
                </>,
                'success'
              );
            }
          }
          
          const textMessageId = `assistant-${Date.now()}`;
          const textMessage: Message = {
            id: textMessageId,
            type: 'assistant',
            content: '',
            timestamp: new Date(),
            messageType: 'text',
          };
          setMessages(prev => [...prev, textMessage]);
          
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
              
              const hasComponents = toolResult.components && toolResult.components.length > 0;
              
              if (!hasComponents) {
                setIsLoading(false);
                setIsLoadingComponent(false);
                return;
              }
              
              setIsLoading(false);
              setIsLoadingComponent(true);
              
              setTimeout(() => {
                console.log('🎯 Tool result components:', JSON.stringify(toolResult.components, null, 2));
                
                const isErrorRetry = !toolResult.success;
                
                if (isErrorRetry) {
                  setMessages(prev => {
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

      const messageId = `assistant-${Date.now()}`;
      const textMessage: Message = {
        id: messageId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        messageType: 'text',
      };

      setMessages(prev => [...prev, textMessage]);

      let fullTextContent = '';
      let isFirstChunk = true;
      
      if (textResponse.body) {
        const reader = textResponse.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              setIsLoading(false);
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            
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
                    if (isFirstChunk) {
                      setIsLoading(false);
                      isFirstChunk = false;
                    }
                    
                    fullTextContent += content;
                    
                    setMessages(prev => prev.map(msg =>
                      msg.id === messageId
                        ? { ...msg, content: fullTextContent }
                        : msg
                    ));
                  }
                } catch {
                  continue;
                }
              }
            }
          }
        } catch (streamError) {
          logger.error('Streaming error:', streamError);
          setIsLoading(false);
        }
      }
      
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

  React.useImperativeHandle(ref, () => ({
    sendMessage,
  }));

  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
      
      if (!isAtBottom) {
        setIsUserScrolling(true);
        
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = null;
        }
      } else {
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

  useEffect(() => {
    if (scrollContainerRef.current && !isUserScrolling) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading, isLoadingComponent, isUserScrolling, scrollContainerRef]);

  useEffect(() => {
    if (!isLoading && !isLoadingComponent) {
      return;
    }

    const scrollToBottom = () => {
      if (scrollContainerRef.current && !isUserScrolling) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    };

    const intervalId = setInterval(scrollToBottom, 300);

    return () => clearInterval(intervalId);
  }, [messages.length, isUserScrolling, isLoading, isLoadingComponent, scrollContainerRef]); // Only run when actively loading

  const handleComponentButtonPress = async (buttonLabel: string, action?: string, message?: string) => {
    try {
      if (message) {
        logger.debug('🔘', 'Button Click with Message', { buttonLabel, message });
        
        const inputValue = lastInputValues.current['default'] || lastInputValues.current['phone'];
        if (inputValue) {
          lastInputValues.current = {};
          
          const combinedMessage = `${message} ${inputValue}`;
          await sendMessage(combinedMessage);
          return;
        }
        
        sendMessage(message);
        return;
      }
      
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

  const handleTextInputChange = (value: string, action?: string) => {
    const key = action || 'default';
    lastInputValues.current[key] = value;
    logger.debug('📝', 'TextInput Change', { key, value });
  };

  const handleTextInputSubmit = async (value: string, action?: string, submitMessage?: string) => {
    logger.debug('📝', 'TextInput Submit', { value, action, submitMessage });
    
    const key = action || 'phone';
    lastInputValues.current[key] = value;
    
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
