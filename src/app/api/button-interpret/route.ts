import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ButtonInterpretRequest {
  buttonLabel: string;
  action?: string;
  recentMessages?: Message[];
}

/**
 * Button Interpret API
 * Uses AI to convert button clicks into natural user messages
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    const body: ButtonInterpretRequest = await request.json();
    
    if (!body.buttonLabel) {
      return NextResponse.json(
        { error: 'Invalid request: buttonLabel is required' },
        { status: 400 }
      );
    }

    // Build context from recent messages
    const recentContext = body.recentMessages && body.recentMessages.length > 0
      ? body.recentMessages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n')
      : '';

    // Create AI prompt for generating natural user message
    const systemPrompt = `You are a helpful assistant that converts UI button clicks into natural, conversational user messages.

When a user clicks a button in a chat interface, generate a SHORT, natural message (3-8 words) that represents what the user wants to say.

Rules:
- Maximum 3-8 words
- Sound natural and conversational
- Consider the conversation context if provided
- Interpret the button's intent, don't just repeat the exact text
- Use lowercase unless it's a proper noun
- No quotes, minimal punctuation

Return ONLY the message text, nothing else.`;

    const userPrompt = recentContext
      ? `Conversation context:\n${recentContext}\n\nUser clicked button: "${body.buttonLabel}"${body.action ? `\nButton action: "${body.action}"` : ''}\n\nGenerate a natural user message:`
      : `User clicked button: "${body.buttonLabel}"${body.action ? `\nButton action: "${body.action}"` : ''}\n\nGenerate a natural user message:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 30,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content?.trim() || body.buttonLabel;

    logger.debug('🔘', 'Button Interpret', {
      button: body.buttonLabel,
      generated: aiMessage
    });

    return NextResponse.json({ message: aiMessage });
    
  } catch (error) {
    logger.error('Button interpret error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
