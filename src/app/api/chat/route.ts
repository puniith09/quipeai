import { NextRequest, NextResponse } from 'next/server';
import { getAvailableComponents, getAllComponentSchemas } from '@/rendering-engine';
import { logger } from '@/lib/logger';
import { getToolDefinitions, executeTool } from '@/lib/ai-tools';
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

RENDERING CONTEXT: Components render on a BLACK background (#000000). Choose colors accordingly:
- Use light/bright colors for text (white, light gray, cyan, etc.)
- Avoid dark colors that won't show on black
- Default text should be light if no color specified

CRITICAL: You can ONLY use these component types: ${availableComponents.join(', ')}

AUTHENTICATION FLOWS:
- For sign-in/login requests: Generate a textinput component with action="send_otp"
- TextInput props for phone: type="tel", label="Enter Phone Number", placeholder="+1234567890", action="send_otp", submitLabel="Send Code"
- The system will automatically handle OTP sending and verification
- DO NOT generate OTP input - system handles it automatically after phone submission

Rules:
- ONLY use component types from: ${availableComponents.join(', ')}
- Study the schemas below for EXACT format and available props
- Generate ACTUAL content, not placeholders
- Cards can be nested to create structured layouts
- Remember: BLACK background - use visible colors

Component Schemas:
${schemaExamples}

Return ONLY valid JSON. No markdown, no explanation.`
      : `You are QuipeAI, a friendly and conversational assistant.

Available UI components in the system: ${getAvailableComponents().join(', ')}

CONTEXT: You are part of a dual-response system. Your text response MAY OR MAY NOT be followed by a visual component 
that displays content. Sometimes you'll provide a text answer, other times a component will follow.

IMPORTANT: Be natural, warm, and conversational. Write 1-1.5 sentences with personality.
If a visual component might follow, give a friendly introduction with context.
DO NOT list items or details if a component will show that - just be conversational and set it up.
DO NOT use emojis.

Your style should feel like chatting with a friend - engaging, descriptive, and thoughtful.

TOOLS: You have access to tools for saving information. Use the 'saveToMemory' tool whenever the user shares information about themselves, their business, preferences, or anything they want remembered for future conversations or to be discoverable by other users.`;


    // Build messages with system prompt
    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...body.messages
    ];

    // Get tool definitions (only for non-component requests)
    const tools = isComponentRequest ? undefined : getToolDefinitions();

    // Call OpenRouter API from server
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': request.headers.get('referer') || '',
        'X-Title': 'QuipeAI'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini', // Using gpt-4o-mini for all requests (cost-effective)
        messages: messagesWithSystem,
        temperature: body.temperature || 0.7,
        max_tokens: body.max_tokens || 1000,
        stream: body.stream,
        tools, // Tool calling support
        ...(tools && {
          provider: {
            order: ['openai'], // Explicitly route to OpenAI provider for tool support
          }
        }),
        ...(isComponentRequest && {
          provider: {
            order: ['azure'], // Use Azure provider for JSON component generation
          }
        }),
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    // Handle streaming response
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

    // Handle non-streaming response
    const data = await response.json();
    
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
      
      for (const toolCall of toolCalls) {
        try {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          logger.info('🔧 AI calling tool', { functionName, args: functionArgs });
          
          const result = await executeTool(functionName, functionArgs, effectiveUserId);
          
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
      
      // Call AI again with tool results to get final response
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
        })
      });
      
      if (!followUpResponse.ok) {
        const errorData = await followUpResponse.json().catch(() => ({}));
        return NextResponse.json(
          { error: errorData.error?.message || `OpenRouter API error: ${followUpResponse.status}` },
          { status: followUpResponse.status }
        );
      }
      
      const followUpData = await followUpResponse.json();
      return NextResponse.json(followUpData);
    }
    
    // Return the response
    return NextResponse.json(data);
    
  } catch (error) {
    logger.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
