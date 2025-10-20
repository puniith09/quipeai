'use client';

import React, { useState, useRef, useEffect } from 'react';
import { renderComponent, type ComponentNode } from '@/rendering-engine';

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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ChatWindowProps {
  // Props can be added here in future
}

export const ChatWindow = React.forwardRef<ChatWindowRef, ChatWindowProps>((_, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingComponent, setIsLoadingComponent] = useState(false);
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

      // ====== PARALLEL: Start Both Requests Together ======
      // 1. Component decision + generation (background, non-blocking)
      const componentWorkflow = (async () => {
        try {
          // Step 1: Get decision
          const decisionResponse = await fetch('/api/component-decision', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: messageContent.trim(),
              conversationHistory: conversationHistory.slice(-6)
            }),
          });

          if (!decisionResponse.ok) return null;

          const decision = await decisionResponse.json();
          console.log('🎯 Component Decision:', decision);

          if (!decision.needsComponent) return null;

          // Step 2: Generate component (if needed) - Don't show loading yet
          const componentResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: conversationHistory,
              temperature: 0.7,
              max_tokens: 1500,
              responseType: 'components',
              suggestedComponents: decision.suggestedComponents || [],
            })
          });

          if (!componentResponse.ok) return null;

          const componentData = await componentResponse.json();
          const componentsJSON = componentData.choices?.[0]?.message?.content;

          console.log('📦 Component Response:', componentData);
          console.log('📄 Components JSON:', componentsJSON);

          const parsedComponents = JSON.parse(componentsJSON);
          console.log('✅ Parsed Components:', parsedComponents);

          return {
            components: Array.isArray(parsedComponents) ? parsedComponents : [parsedComponents]
          };
        } catch (error) {
          console.error('Component workflow error:', error);
          return null;
        }
      })();

      // 2. Text response (streaming) - starts immediately in parallel
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

      // Hide "quiping..." as soon as we start streaming
      setIsLoading(false);

      // Stream the text response
      let fullTextContent = '';
      
      if (textResponse.body) {
        const reader = textResponse.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            
            // Parse SSE format from OpenRouter
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
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
          console.error('Streaming error:', streamError);
        }
      }

      // ====== STEP 2: Check if Component is Ready ======
      // Use Promise.race to check if component is ready without waiting
      const checkReady = Promise.race([
        componentWorkflow.then(() => true),
        Promise.resolve(false)
      ]);
      
      const isReady = await checkReady;
      
      // If component decision said yes but not ready yet, show loading
      if (!isReady) {
        setIsLoadingComponent(true);
      }
      
      // Now wait for component to finish
      const componentResult = await componentWorkflow;
      
      // Hide loading
      setIsLoadingComponent(false);
      
      if (componentResult && componentResult.components) {
        // ====== STEP 3: Render Component ======
        const componentMessage: Message = {
          id: `component-${Date.now()}`,
          type: 'assistant',
          content: '',
          components: componentResult.components,
          timestamp: new Date(),
          messageType: 'component',
        };

        setMessages(prev => [...prev, componentMessage]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
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

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading, isLoadingComponent]);

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
        
        console.log('🔘 Button Click:', { buttonLabel, generated: userMessage });
        
        // Send the AI-generated natural message
        sendMessage(userMessage);
      } else {
        // Fallback if API fails
        console.error('Button interpret API failed, using fallback');
        sendMessage(buttonLabel);
      }
    } catch (error) {
      console.error('Error interpreting button click:', error);
      // Fallback to button label
      sendMessage(buttonLabel);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
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
                    {renderComponent(component, index, handleComponentButtonPress)}
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
    </div>
  );
});

ChatWindow.displayName = 'ChatWindow';
