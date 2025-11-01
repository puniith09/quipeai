import { NextRequest, NextResponse } from 'next/server';
import { getAvailableComponents, getAllComponentSchemas } from '@/rendering-engine';
import { logger } from '@/lib/logger';
import { getToolDefinitions, executeTool } from '@/lib/ai-tools';
import { verifyToken } from '@/lib/auth/jwt';
import { conversationalPrompt, uiCardGeneratorPrompt } from '@/prompts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  location?: { lat: number; lng: number }; // User's current location for tool calls
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from server-side environment variable (not exposed to client)
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    // Get user ID from auth token (optional - some requests don't need auth)
    let userId: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = await verifyToken(token);
        userId = payload?.userId;
      } catch {
        // Ignore auth errors for non-authenticated requests
      }
    }

    // Parse request body
    const body: ChatRequest = await request.json();
    
    // Validate request
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    // System prompt for conversational AI with tool calling
    const isAuthenticated = !!userId;
    const systemPrompt = conversationalPrompt(getAvailableComponents(), body.location, isAuthenticated);

    // Build messages with system prompt
    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...body.messages
    ];

    // Get tool definitions for AI tool calling
    const tools = getToolDefinitions();

    // Prepare request body
    const requestBody = {
      model: 'openai/gpt-4o-mini', // Using gpt-4o-mini for all requests (cost-effective)
      messages: messagesWithSystem,
      temperature: body.temperature || 0.7,
      max_tokens: body.max_tokens || 1000,
      tools, // Tool calling support
      tool_choice: "auto", // Let AI decide when to use tools
      provider: {
        order: ['openai'], // Explicitly route to OpenAI provider for tool support
      },
    };

    // Log request for debugging
    logger.debug('📤', 'OpenRouter Request', {
      model: requestBody.model,
      hasTools: !!tools,
      toolCount: tools?.length || 0,
      provider: requestBody.provider,
      toolChoice: requestBody.tool_choice,
      messagesCount: messagesWithSystem.length,
      lastUserMessage: messagesWithSystem[messagesWithSystem.length - 1]?.content?.substring(0, 100)
    });

    // Call OpenRouter API from server
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': request.headers.get('referer') || '',
        'X-Title': 'QuipeAI'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('❌', 'OpenRouter Error', {
        status: response.status,
        error: errorData,
        metadata: errorData?.error?.metadata,
        fullError: JSON.stringify(errorData, null, 2)
      });
      return NextResponse.json(
        { error: errorData.error?.message || `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    // Get initial response to check for tool calls
    const data = await response.json();
    
    logger.debug('📥', 'AI Response Data', {
      hasToolCalls: !!data.choices?.[0]?.message?.tool_calls,
      toolCallsCount: data.choices?.[0]?.message?.tool_calls?.length || 0,
      messageContent: data.choices?.[0]?.message?.content?.substring(0, 100),
      finishReason: data.choices?.[0]?.finish_reason,
      fullMessage: JSON.stringify(data.choices?.[0]?.message, null, 2)
    });
    
    // Check if AI wants to call a tool
    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    
    if (toolCalls && toolCalls.length > 0) {
      // For unauthenticated users, use a default test user ID
      const effectiveUserId = userId || 'test_user_' + Date.now();
      
      if (!userId) {
        logger.warn('⚠️  Tool call without authentication - using temporary user ID:', effectiveUserId);
      }
      
      // Execute all tool calls
      const toolResults = [];
      let searchResults: unknown[] | null = null;
      let suggestedComponents: string[] | null = null;
      let generatedComponentData: any[] | null = null;
      
      for (const toolCall of toolCalls) {
        try {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          logger.info('🔧 AI calling tool', { 
            functionName, 
            args: functionArgs,
            suggestedComponents: functionArgs.suggestedComponents 
          });
          
          const result = await executeTool(functionName, functionArgs, effectiveUserId);
          
          // Store search results and suggested components for component generation
          if (functionName === 'searchBusinesses' && result && typeof result === 'object' && 'results' in result) {
            searchResults = (result as { results: unknown[]; suggestedComponents?: string[] }).results;
            suggestedComponents = (result as { results: unknown[]; suggestedComponents?: string[] }).suggestedComponents || null;
            
            logger.info('📊 Search results received', {
              count: searchResults.length,
              suggestedComponents
            });
          }
          
          // Store generated component data from login-related tools
          if ((functionName === 'generateComponents' || functionName === 'showPhoneInput' || functionName === 'showOTPInput' || functionName === 'sendOTP') && result && typeof result === 'object' && 'components' in result) {
            generatedComponentData = (result as { components: any[]; suggestedComponents?: string[] }).components;
            suggestedComponents = (result as { components: any[]; suggestedComponents?: string[] }).suggestedComponents || null;
            
            logger.info('🎨 Generated components received', {
              functionName,
              count: generatedComponentData.length,
              suggestedComponents
            });
          }
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify(result),
          });
          
          logger.info('✅ Tool executed', { functionName, result });
        } catch (error) {
          logger.error('Tool execution error:', error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify({ error: 'Tool execution failed' }),
          });
        }
      }
      
      // Call AI again with tool results - THIS TIME WITH STREAMING
      const followUpMessages = [
        ...messagesWithSystem,
        data.choices[0].message, // AI's message with tool calls
        ...toolResults, // Tool execution results
      ];
      
      const followUpResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': request.headers.get('referer') || '',
          'X-Title': 'QuipeAI'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: followUpMessages,
          temperature: body.temperature || 0.7,
          max_tokens: body.max_tokens || 1000,
          stream: true, // ENABLE STREAMING for the text response
        })
      });
      
      if (!followUpResponse.ok) {
        const errorData = await followUpResponse.json().catch(() => ({}));
        return NextResponse.json(
          { error: errorData.error?.message || `OpenRouter API error: ${followUpResponse.status}` },
          { status: followUpResponse.status }
        );
      }

      // Stream the follow-up response with tool results
      if (followUpResponse.body) {
        const reader = followUpResponse.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        // 🚀 PARALLEL OPTIMIZATION: Start component generation immediately if we have search results OR generated components
        // This runs in parallel with text streaming, reducing total wait time
        let componentGenerationPromise: Promise<{ type: 'components'; data: any[] } | null> | null = null;
        
        if (generatedComponentData && generatedComponentData.length > 0) {
          logger.info('🎨 Using pre-generated component data', {
            count: generatedComponentData.length,
            suggestedComponents
          });
          
          // Use the components directly from generateComponents tool
          componentGenerationPromise = Promise.resolve({
            type: 'components' as const,
            data: generatedComponentData
          });
        } else if (searchResults && searchResults.length > 0) {
          logger.info('🚀 Starting parallel component generation for search results', { 
            count: searchResults.length,
            suggestedComponents 
          });
          
          // Start component generation without awaiting
          componentGenerationPromise = (async () => {
            try {
              // Generate components with OpenRouter Cerebras GPT OSS model
              const openrouterKey = apiKey;
              
              // Get schemas - filter to suggested components if provided
              const allSchemas = getAllComponentSchemas();
              const componentsToUse = suggestedComponents || getAvailableComponents();
              
              // Filter schemas to only include suggested components
              const relevantSchemas: Record<string, unknown> = {};
              componentsToUse.forEach(component => {
                if (allSchemas[component]) {
                  relevantSchemas[component] = allSchemas[component];
                }
              });
              
              const schemaExamples = Object.entries(relevantSchemas)
                .map(([name, schema]) => `${name.charAt(0).toUpperCase() + name.slice(1)} Component:\n${JSON.stringify(schema, null, 2)}`)
                .join('\n\n');
              
              logger.debug('📋', 'Using schemas for components', { 
                suggested: suggestedComponents,
                using: componentsToUse,
                schemasCount: Object.keys(relevantSchemas).length,
                provider: 'openrouter-cerebras'
              });
              
              const componentMessages = [
                {
                  role: 'system' as const,
                  content: uiCardGeneratorPrompt(componentsToUse, schemaExamples)
                },
                {
                  role: 'user' as const,
                  content: `Generate UI components to display these businesses:\n${JSON.stringify(searchResults)}`
                }
              ];
              
              const componentResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openrouterKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': request.headers.get('referer') || '',
                  'X-Title': 'QuipeAI'
                },
                body: JSON.stringify({
                  model: 'openai/gpt-oss-120b',
                  messages: componentMessages,
                  temperature: 0.3,
                  max_tokens: 4000,
                  provider: {
                    order: ['Cerebras'],
                    allow_fallbacks: false
                  }
                })
              });
              
              if (componentResponse.ok) {
                const componentData = await componentResponse.json();
                let componentsJSON = componentData.choices?.[0]?.message?.content;
                
                if (componentsJSON.includes('```')) {
                  componentsJSON = componentsJSON
                    .replace(/```json\n?/g, '')
                    .replace(/```\n?/g, '')
                    .trim();
                }
                
                try {
                  let components = JSON.parse(componentsJSON);
                  if (!Array.isArray(components)) {
                    components = [components];
                  }
                  
                  logger.info('✅ Parallel component generation completed', { count: components.length });
                  return { type: 'components' as const, data: components };
                } catch (parseError) {
                  logger.error('Failed to parse components', parseError);
                  return null;
                }
              } else {
                logger.error('Component generation failed', { status: componentResponse.status });
                return null;
              }
            } catch (componentError) {
              logger.error('Component generation error', componentError);
              return null;
            }
          })();
        }

        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  // After streaming text is done, wait for component generation to complete
                  if (componentGenerationPromise) {
                    logger.info('⏳ Waiting for parallel component generation to complete...');
                    const componentResult = await componentGenerationPromise;
                    
                    if (componentResult) {
                      // Send components as custom event
                      const componentsEvent = `data: ${JSON.stringify(componentResult)}\n\n`;
                      controller.enqueue(encoder.encode(componentsEvent));
                    }
                  }
                  
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                      const parsed = JSON.parse(data);
                      const delta = parsed.choices?.[0]?.delta?.content;
                      
                      if (delta) {
                        // Send each character with a delay for smooth streaming
                        for (const char of delta) {
                          const sseData = {
                            ...parsed,
                            choices: [{
                              ...parsed.choices[0],
                              delta: { content: char }
                            }]
                          };
                          
                          const sseLine = `data: ${JSON.stringify(sseData)}\n\n`;
                          controller.enqueue(encoder.encode(sseLine));
                          
                          // 30ms delay between characters for smooth reading speed
                          await new Promise(resolve => setTimeout(resolve, 30));
                        }
                      } else {
                        // Pass through non-content chunks as-is
                        controller.enqueue(encoder.encode(line + '\n'));
                      }
                    } catch {
                      // Pass through unparseable lines
                      controller.enqueue(encoder.encode(line + '\n'));
                    }
                  }
                }
              }
              
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          }
        });

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
      
      // Fallback if no stream body (shouldn't happen)
      const followUpData = await followUpResponse.json();
      
      // Generate components if search results exist
      if (searchResults && searchResults.length > 0) {
        logger.info('🎨 Generating components for search results', { 
          count: searchResults.length,
          suggestedComponents,
          provider: 'openrouter-cerebras'
        });
        
        try {
          // Generate components with OpenRouter Cerebras GPT OSS model
          const openrouterKey = apiKey;
          
          // Get schemas - filter to suggested components if provided
          const allSchemas = getAllComponentSchemas();
          const componentsToUse = suggestedComponents || getAvailableComponents();
          
          // Filter schemas to only include suggested components
          const relevantSchemas: Record<string, unknown> = {};
          componentsToUse.forEach(component => {
            if (allSchemas[component]) {
              relevantSchemas[component] = allSchemas[component];
            }
          });
          
          const schemaExamples = Object.entries(relevantSchemas)
            .map(([name, schema]) => `${name.charAt(0).toUpperCase() + name.slice(1)} Component:\n${JSON.stringify(schema, null, 2)}`)
            .join('\n\n');
          
          const componentMessages = [
            {
              role: 'system' as const,
              content: uiCardGeneratorPrompt(componentsToUse, schemaExamples)
            },
            {
              role: 'user' as const,
              content: `Generate UI components to display these businesses:\n${JSON.stringify(searchResults)}`
            }
          ];
          
          const componentResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': request.headers.get('referer') || '',
              'X-Title': 'QuipeAI'
            },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: componentMessages,
              temperature: 0.3,
              max_tokens: 4000,
              provider: {
                order: ['Cerebras'],
                allow_fallbacks: false
              }
            })
          });
          
          if (componentResponse.ok) {
            const componentData = await componentResponse.json();
            let componentsJSON = componentData.choices?.[0]?.message?.content;
            
            // Strip markdown code blocks if present
            if (componentsJSON.includes('```')) {
              componentsJSON = componentsJSON
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            }
            
            try {
              let components = JSON.parse(componentsJSON);
              if (!Array.isArray(components)) {
                components = [components];
              }
              
              // Add components to the response
              return NextResponse.json({
                ...followUpData,
                components,
              });
            } catch (parseError) {
              logger.error('Failed to parse components', parseError);
            }
          }
        } catch (componentError) {
          logger.error('Component generation error', componentError);
        }
      }
      
      return NextResponse.json(followUpData);
    }
    
    // NO TOOL CALLS - Stream the normal conversation response
    // Check if response has no tool calls - stream it directly
    if (!data.choices?.[0]?.message?.tool_calls) {
      logger.debug('💬', 'Normal conversation - streaming response');
      
      // Make a new streaming request with the same messages
      const streamResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': request.headers.get('referer') || '',
          'X-Title': 'QuipeAI'
        },
        body: JSON.stringify({
          ...requestBody,
          stream: true, // Enable streaming for normal conversations
        })
      });
      
      if (!streamResponse.ok) {
        const errorData = await streamResponse.json().catch(() => ({}));
        return NextResponse.json(
          { error: errorData.error?.message || `OpenRouter API error: ${streamResponse.status}` },
          { status: streamResponse.status }
        );
      }
      
      // Stream the response with smooth character-by-character delay
      if (streamResponse.body) {
        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                      const parsed = JSON.parse(data);
                      const delta = parsed.choices?.[0]?.delta?.content;

                      if (delta) {
                        // Send each character with a delay for smooth streaming
                        for (const char of delta) {
                          const sseData = {
                            ...parsed,
                            choices: [{
                              ...parsed.choices[0],
                              delta: { content: char }
                            }]
                          };
                          
                          const sseLine = `data: ${JSON.stringify(sseData)}\n\n`;
                          controller.enqueue(encoder.encode(sseLine));
                          
                          // 30ms delay between characters for smooth reading speed
                          await new Promise(resolve => setTimeout(resolve, 20));
                        }
                      } else {
                        // Pass through non-content chunks as-is
                        controller.enqueue(encoder.encode(line + '\n'));
                      }
                    } catch {
                      // Pass through unparseable lines
                      controller.enqueue(encoder.encode(line + '\n'));
                    }
                  }
                }
              }

              controller.close();
            } catch (error) {
              controller.error(error);
            }
          }
        });

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
    }
    
    // Fallback: Return the non-streaming response
    return NextResponse.json(data);
    
  } catch (error) {
    logger.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
