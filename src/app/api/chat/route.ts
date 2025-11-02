import { NextRequest, NextResponse } from 'next/server';
import { getAvailableComponents, getAllComponentSchemas } from '@/rendering-engine';
import { logger } from '@/lib/logger';
import { getAuthToolDefinitions, executeAuthTool } from '@/lib/auth-tools';
import { getAuthCookie } from '@/lib/auth/cookies';
import { verifyToken } from '@/lib/auth/jwt';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  responseType?: 'text' | 'components'; // New field to specify response type
  stream?: boolean; // Enable streaming for text responses
  suggestedComponents?: string[]; // Components suggested by decision API
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

    // Check authentication status from cookie
    let isAuthenticated = false;
    let userId = '';
    try {
      const authToken = await getAuthCookie();
      if (authToken) {
        const payload = await verifyToken(authToken);
        if (payload) {
          isAuthenticated = true;
          userId = payload.userId;
          logger.debug('🔐', 'Authenticated user', { userId: payload.userId });
        }
      }
    } catch (error) {
      logger.debug('🔐', 'Auth check failed', { error });
      // Continue as unauthenticated
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

    // Dynamically load available components and their schemas
    const availableComponents = body.suggestedComponents && body.suggestedComponents.length > 0
      ? body.suggestedComponents // Use suggested components if provided
      : getAvailableComponents(); // Otherwise use all available
      
    const allSchemas = getAllComponentSchemas();
    
    // Filter schemas to only include suggested components
    const relevantSchemas: Record<string, unknown> = {};
    availableComponents.forEach(component => {
      if (allSchemas[component]) {
        relevantSchemas[component] = allSchemas[component];
      }
    });

    // Log what components are being provided to the AI
    if (body.responseType === 'components') {
      logger.debug('🎨', 'AI Component Generation', {
        requested: body.suggestedComponents || 'all',
        available: availableComponents,
        schemasProvided: Object.keys(relevantSchemas)
      });
    }
    
    // Generate dynamic examples from relevant schemas only
    const schemaExamples = Object.entries(relevantSchemas)
      .map(([name, schema]) => `${name.charAt(0).toUpperCase() + name.slice(1)} Component:\n${JSON.stringify(schema, null, 2)}`)
      .join('\n\n');

    // Determine system prompt based on response type
    const isComponentRequest = body.responseType === 'components';
    
    const systemPrompt = isComponentRequest 
      ? `You are a UI component generator. Generate VISUAL UI components with actual content.

CRITICAL: You can ONLY use these component types: ${availableComponents.join(', ')}

Rules:
- ONLY use component types from: ${availableComponents.join(', ')}
- Study the schemas below for EXACT format and available props
- Generate ACTUAL content, not placeholders
- Cards can be nested to create structured layouts

Component Schemas:
${schemaExamples}

Return ONLY valid JSON. No markdown, no explanation.`
      : `You are QuipeAI, a friendly and conversational assistant.

Available UI components in the system: ${getAvailableComponents().join(', ')}

USER AUTHENTICATION STATUS: ${isAuthenticated ? `LOGGED IN (userId: ${userId})` : 'NOT LOGGED IN (Guest)'}

CONTEXT: You are part of a dual-response system. Your text response MAY OR MAY NOT be followed by a visual component 
that displays content. Sometimes you'll provide a text answer, other times a component will follow.

IMPORTANT: Be natural, warm, and conversational. Write 1-1.5 sentences with personality.
If a visual component might follow, give a friendly introduction with context.
DO NOT list items or details if a component will show that - just be conversational and set it up.
DO NOT use emojis.

CRITICAL: You have access to tools/functions. When a user asks to sign in, login, authenticate, or create an account, 
you MUST call the request_phone_otp tool instead of asking for their phone number in text.

LOGOUT: If user asks to logout or sign out, tell them to use the settings button (⚙️ icon in the top right corner).

IMPORTANT: Only mention actions that have already completed, not what will happen next.

LOGIN ENCOURAGEMENT STRATEGY:
- If user is NOT LOGGED IN and has had 2-3+ message exchanges, occasionally (not every time) gently suggest creating an account
- Use the offer_login_choice tool to show two buttons: "Sign In" and "Continue as Guest"
- DO NOT be pushy - be casual and friendly
- If they seem engaged and satisfied with a conversation, that's a good time to suggest it
- The offer_login_choice tool will handle the UI - you just need to call it with a friendly message

Your style should feel like chatting with a friend - engaging, descriptive, and thoughtful.`;


    // Build messages with system prompt
    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...body.messages
    ];

    // Add auth tools for text responses (not component generation)
    const tools = !isComponentRequest ? getAuthToolDefinitions() : undefined;
    
    if (tools && tools.length > 0) {
      logger.debug('🔧', 'Auth Tools Available', { count: tools.length, tools: tools.map(t => t.function.name) });
    }

    // Disable streaming when tools are present (OpenRouter needs JSON response to return tool calls)
    const shouldStream = body.stream && !(tools && tools.length > 0);

    // Use Cerebras for tool calling (ultra-fast), OpenAI for regular chat
    const modelConfig = (tools && tools.length > 0) 
      ? {
          model: 'openai/gpt-oss-120b', // Cerebras: 0.31s latency, supports tool calling
          provider: {
            order: ['Cerebras'],
            allow_fallbacks: false,
          },
        }
      : {
          model: 'openai/gpt-4o-mini', // OpenAI for regular streaming chat
          provider: {
            order: ['OpenAI'],
            allow_fallbacks: false,
          },
        };

    // Call OpenRouter API from server
    const requestBody = {
      ...modelConfig,
      messages: messagesWithSystem,
      temperature: body.temperature || 0.7,
      max_tokens: body.max_tokens || 1000,
      stream: shouldStream,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    };
    
    logger.debug('📤', 'OpenRouter Request', { 
      model: requestBody.model,
      hasTools: !!requestBody.tools, 
      toolCount: requestBody.tools?.length || 0 
    });

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
      return NextResponse.json(
        { error: errorData.error?.message || `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    // FIRST: Check for non-streaming response or tool calls
    // If we have tools, we need to check the response for tool calls before streaming
    const hasTools = requestBody.tools && requestBody.tools.length > 0;
    logger.debug('🔍', 'Response handling', { hasTools, stream: body.stream });
    
    if (!body.stream || hasTools) {
      logger.debug('📥', 'Getting JSON response...');
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        logger.error('❌ Failed to parse response JSON:', jsonError);
        throw new Error(`Failed to parse OpenRouter response: ${jsonError}`);
      }
      logger.debug('✅', 'JSON received', { hasToolCalls: !!data.choices?.[0]?.message?.tool_calls });
      
      // Check if AI wants to call a tool
      if (data.choices?.[0]?.message?.tool_calls) {
        const toolCalls = data.choices[0].message.tool_calls;
        logger.info('🔧', 'AI requested tool calls', { count: toolCalls.length });
        
        // Execute the first tool call (can be extended for multiple)
        const toolCall = toolCalls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        // Execute auth tool
        const toolResult = await executeAuthTool(toolName, toolArgs);
        
        if (toolResult.success) {
          // Tool executed successfully - now get AI's natural response
          // Add tool result to conversation so AI knows what happened
          const toolResponseMessages = [
            ...messagesWithSystem,
            {
              role: 'assistant' as const,
              content: '',
              tool_calls: [toolCall]
            },
            {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({
                success: true,
                ...toolResult.metadata
              })
            }
          ];

          // Ask AI to craft a natural response based on tool result
          const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': request.headers.get('referer') || '',
              'X-Title': 'QuipeAI'
            },
            body: JSON.stringify({
              model: modelConfig.model,
              messages: toolResponseMessages,
              temperature: 0.7,
              max_tokens: 200,
              provider: modelConfig.provider,
            })
          });

          const finalData = await finalResponse.json();
          const aiResponse = finalData.choices?.[0]?.message?.content || 'Done!';

          // Return AI's natural response with components
          return NextResponse.json({
            choices: [{
              message: {
                role: 'assistant',
                content: aiResponse,
                tool_result: {
                  success: true,
                  components: toolResult.components,
                  metadata: toolResult.metadata, // Include metadata for client
                }
              }
            }]
          });
        } else {
          // Tool failed - also get AI's natural error response
          const toolResponseMessages = [
            ...messagesWithSystem,
            {
              role: 'assistant' as const,
              content: '',
              tool_calls: [toolCall]
            },
            {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({
                success: false,
                error: toolResult.error,
                ...toolResult.metadata
              })
            }
          ];

          const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': request.headers.get('referer') || '',
              'X-Title': 'QuipeAI'
            },
            body: JSON.stringify({
              model: modelConfig.model,
              messages: toolResponseMessages,
              temperature: 0.7,
              max_tokens: 200,
              provider: modelConfig.provider,
            })
          });

          const finalData = await finalResponse.json();
          const aiResponse = finalData.choices?.[0]?.message?.content || 'Something went wrong.';

          return NextResponse.json({
            choices: [{
              message: {
                role: 'assistant',
                content: aiResponse,
                tool_result: {
                  success: false,
                  components: toolResult.components || [],
                  metadata: toolResult.metadata, // Include metadata for client
                }
              }
            }]
          });
        }
      }
      
      // If no tool calls, return normal JSON response
      if (!body.stream) {
        return NextResponse.json(data);
      }
      
      // If stream was requested but tools were present, we already consumed the response
      // So we need to return the data as-is (can't stream it now)
      return NextResponse.json(data);
    }

    // Handle streaming response (only if no tools)
    if (body.stream && response.body) {
      // Create a custom stream with character-by-character delay
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Decode the chunk
              const chunk = decoder.decode(value, { stream: true });
              
              // Parse SSE format and extract characters
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    controller.enqueue(encoder.encode(line + '\n'));
                    continue;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                      // Send each character with a delay
                      for (const char of content) {
                        // Recreate SSE format with single character
                        const sseData = {
                          ...parsed,
                          choices: [{
                            ...parsed.choices[0],
                            delta: { content: char }
                          }]
                        };
                        
                        const sseLine = `data: ${JSON.stringify(sseData)}\n\n`;
                        controller.enqueue(encoder.encode(sseLine));
                        
                        // Delay between characters (30ms for readable speed)
                        await new Promise(resolve => setTimeout(resolve, 12));
                      }
                    } else {
                      // Pass through non-content chunks as-is
                      controller.enqueue(encoder.encode(line + '\n'));
                    }
                  } catch {
                    // Pass through unparseable lines
                    controller.enqueue(encoder.encode(line + '\n'));
                  }
                } else if (line) {
                  controller.enqueue(encoder.encode(line + '\n'));
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
    
    // This should never be reached as we handle all cases above
    logger.error('❌ Unexpected state reached in chat API');
    return NextResponse.json({ error: 'Unexpected state' }, { status: 500 });
    
  } catch (error) {
    logger.error('Chat API error:', error);
    console.error('💥 CHAT API ERROR DETAILS:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
