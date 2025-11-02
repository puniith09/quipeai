import { NextRequest, NextResponse } from 'next/server';
import { getAvailableComponents } from '@/rendering-engine';
import { logger } from '@/lib/logger';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DecisionRequest {
  prompt: string;
  conversationHistory?: Message[];
}

interface DecisionResponse {
  needsComponent: boolean;
  reason: string;
  suggestedComponents: string[];
  searchQuery?: string; // Extracted/refined search terms
  businessType?: string; // Extracted business category (salon, restaurant, gym, etc)
  locationContext?: string; // If user mentions specific area
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    const body: DecisionRequest = await request.json();
    
    if (!body.prompt || typeof body.prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: prompt is required' },
        { status: 400 }
      );
    }

    const availableComponents = getAvailableComponents();

    const conversationHistory = body.conversationHistory || [];
    const recentMessages = conversationHistory
      .slice(-4)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are a smart assistant that analyzes user requests and extracts structured information.

Available components: ${availableComponents.join(', ')}

Your task:
1. Decide if visual components are needed
2. Extract search intent and business type from the message
3. Identify location context if mentioned

Return JSON:
{
  "needsComponent": true/false,
  "reason": "brief explanation",
  "suggestedComponents": ["component1", "component2"],
  "searchQuery": "refined search terms (e.g., 'haircut salon')",
  "businessType": "category (salon, restaurant, gym, hotel, spa, clinic, etc)",
  "locationContext": "specific area if mentioned (e.g., 'Banjara Hills', 'Kondapur')"
}

Examples:
- "i want a hair cut" → searchQuery: "haircut salon", businessType: "salon"
- "find me a restaurant" → searchQuery: "restaurant", businessType: "restaurant"
- "i need a gym in kondapur" → searchQuery: "gym", businessType: "gym", locationContext: "kondapur"
- "hello" → needsComponent: false, no searchQuery/businessType

SPECIAL: For authentication/sign-in/login requests, use "textinput" for phone number entry.

Use needsComponent: true for:
- Authentication requests (sign in, login, verify) → use "textinput"
- Anything that can be visualized (lists, items, options, data)

Use needsComponent: false ONLY for pure greetings or clarifying questions.
When true, suggest appropriate components from: ${availableComponents.join(', ')}
When false, suggestedComponents must be []

IMPORTANT: Always extract searchQuery and businessType when user asks to find/search for services!`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(recentMessages ? [{ role: 'user', content: `Recent context:\n${recentMessages}\n\nCurrent request: ${body.prompt}` }] : [
        { role: 'user', content: `Current request: ${body.prompt}` }
      ])
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': request.headers.get('referer') || '',
        'X-Title': 'QuipeAI'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
        temperature: 0.3, // Lower temperature for more consistent decisions
        max_tokens: 150,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    let decision: DecisionResponse;
    try {
      const jsonStr = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
      decision = JSON.parse(jsonStr);
      
      if (!Array.isArray(decision.suggestedComponents)) {
        decision.suggestedComponents = [];
      }
      
      decision.suggestedComponents = decision.suggestedComponents.filter(
        comp => availableComponents.includes(comp)
      );
      
      } catch (parseError) {
        logger.error('Failed to parse AI decision:', aiResponse, parseError);
      decision = {
        needsComponent: false,
        reason: 'Parse error - defaulting to text response',
        suggestedComponents: []
      };
    }

    logger.debug('🎯', 'Component Decision', decision);

    return NextResponse.json(decision);
    
  } catch (error) {
    logger.error('Component decision error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
