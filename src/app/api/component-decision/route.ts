import { NextRequest, NextResponse } from 'next/server';
import { getAvailableComponents } from '@/rendering-engine';

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
}

/**
 * Component Decision API
 * Uses AI to determine if visual components are needed and which ones
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

    const body: DecisionRequest = await request.json();
    
    if (!body.prompt || typeof body.prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: prompt is required' },
        { status: 400 }
      );
    }

    // Get available components dynamically
    const availableComponents = getAvailableComponents();

    // Build context from recent conversation
    const conversationHistory = body.conversationHistory || [];
    const recentMessages = conversationHistory
      .slice(-4)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Create AI prompt for decision
    const systemPrompt = `Should this request include visual components?

Available: ${availableComponents.join(', ')}

Return JSON:
{
  "needsComponent": true/false,
  "reason": "brief explanation",
  "suggestedComponents": ["component1", "component2"]
}

Use needsComponent: true for anything that can be visualized (lists, items, options, data).
Use needsComponent: false ONLY for pure greetings or clarifying questions.
When true, suggest appropriate components from: ${availableComponents.join(', ')}
When false, suggestedComponents must be []`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(recentMessages ? [{ role: 'user', content: `Recent context:\n${recentMessages}\n\nCurrent request: ${body.prompt}` }] : [
        { role: 'user', content: `Current request: ${body.prompt}` }
      ])
    ];

    // Call OpenRouter API
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

    // Parse AI response
    let decision: DecisionResponse;
    try {
      // Remove markdown code blocks if present
      const jsonStr = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
      decision = JSON.parse(jsonStr);
      
      // Validate and ensure suggestedComponents is an array
      if (!Array.isArray(decision.suggestedComponents)) {
        decision.suggestedComponents = [];
      }
      
      // Filter to only include available components
      decision.suggestedComponents = decision.suggestedComponents.filter(
        comp => availableComponents.includes(comp)
      );
      
    } catch (parseError) {
      console.error('Failed to parse AI decision:', aiResponse, parseError);
      // Fallback to simple text response
      decision = {
        needsComponent: false,
        reason: 'Parse error - defaulting to text response',
        suggestedComponents: []
      };
    }

    console.log('🎯 Component Decision:', decision);

    return NextResponse.json(decision);
    
  } catch (error) {
    console.error('Component decision error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
