import { NextRequest, NextResponse } from 'next/server';
import { getAllComponentSchemas } from '@/rendering-engine';
import { logger } from '@/lib/logger';

interface GenerateComponentsRequest {
  prompt: string; // What to generate (e.g., "Create a phone number input form for authentication")
  requiredComponents: string[]; // Which components to use (e.g., ['textinput', 'button'])
  searchSupermemory?: boolean; // Whether to search Supermemory first
  searchQuery?: string; // Search query if searchSupermemory is true
  searchType?: string; // Business type for search (salon, restaurant, etc.)
  contextData?: Record<string, unknown>; // Additional context data to include
}

/**
 * Generic Component Generation API
 * 
 * Generates UI components based on prompt and available components.
 * Can optionally search Supermemory first and include results in generation.
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

    const body: GenerateComponentsRequest = await request.json();
    
    // Validate request
    if (!body.prompt || typeof body.prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: prompt is required' },
        { status: 400 }
      );
    }

    if (!body.requiredComponents || !Array.isArray(body.requiredComponents) || body.requiredComponents.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: requiredComponents array is required' },
        { status: 400 }
      );
    }

    logger.info('🎨', 'Generate Components Request', {
      prompt: body.prompt.substring(0, 100),
      components: body.requiredComponents,
      searchSupermemory: body.searchSupermemory || false,
    });

    // Step 1: Optional Supermemory search
    let searchResults = null;
    if (body.searchSupermemory && body.searchQuery) {
      try {
        const searchParams = new URLSearchParams({
          query: body.searchQuery,
        });
        
        if (body.searchType) {
          searchParams.append('type', body.searchType);
        }

        const searchResponse = await fetch(
          `${request.nextUrl.origin}/api/search?${searchParams}`,
          {
            headers: {
              'Cookie': request.headers.get('Cookie') || '',
            },
          }
        );
        
        if (searchResponse.ok) {
          searchResults = await searchResponse.json();
          logger.debug('🔍', 'Supermemory Search Results', { 
            count: searchResults.count,
            hasResults: !!searchResults.results 
          });
        }
      } catch (error) {
        logger.error('Supermemory search failed:', error);
        // Continue without search results
      }
    }

    // Step 2: Get component schemas for the required components
    const allSchemas = getAllComponentSchemas();
    const relevantSchemas: Record<string, unknown> = {};
    
    body.requiredComponents.forEach(componentName => {
      if (allSchemas[componentName]) {
        relevantSchemas[componentName] = allSchemas[componentName];
      } else {
        logger.warn(`Component "${componentName}" not found in registry`);
      }
    });

    if (Object.keys(relevantSchemas).length === 0) {
      return NextResponse.json(
        { error: 'No valid components found in requiredComponents' },
        { status: 400 }
      );
    }

    // Generate schema examples
    const schemaExamples = Object.entries(relevantSchemas)
      .map(([name, schema]) => `${name.charAt(0).toUpperCase() + name.slice(1)} Component:\n${JSON.stringify(schema, null, 2)}`)
      .join('\n\n');

    logger.debug('📋', 'Available Schemas', { 
      components: Object.keys(relevantSchemas),
      schemaCount: Object.keys(relevantSchemas).length 
    });

    // Step 3: Build AI prompt
    const systemPrompt = `You are a UI component generator. Generate VISUAL UI components with actual content.

CRITICAL: You can ONLY use these component types: ${body.requiredComponents.join(', ')}

Rules:
- ONLY use component types from: ${body.requiredComponents.join(', ')}
- Study the schemas below for EXACT format and available props
- Generate ACTUAL content, not placeholders
- Cards can be nested to create structured layouts

Component Schemas:
${schemaExamples}

${searchResults ? `SEARCH RESULTS DATA:\n${JSON.stringify(searchResults.results, null, 2)}\n\n` : ''}
${body.contextData ? `CONTEXT DATA:\n${JSON.stringify(body.contextData, null, 2)}\n\n` : ''}

Return ONLY valid JSON. No markdown, no explanation.`;

    const userPrompt = body.prompt;

    // Step 4: Call OpenRouter API with Cerebras GPT-OSS-120b for ultra-fast generation
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': request.headers.get('referer') || '',
        'X-Title': 'QuipeAI - Component Generator'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', // Cerebras: 0.31s latency, 3,134 tokens/s
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        provider: {
          order: ['Cerebras'],
          allow_fallbacks: false,
        },
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('OpenRouter API error:', errorData);
      return NextResponse.json(
        { error: errorData.error?.message || `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const componentsJSON = data.choices?.[0]?.message?.content;

    if (!componentsJSON) {
      return NextResponse.json(
        { error: 'No components generated' },
        { status: 500 }
      );
    }

    // Step 5: Parse and validate components
    try {
      const parsedComponents = JSON.parse(componentsJSON);
      let components = Array.isArray(parsedComponents) ? parsedComponents : [parsedComponents];
      
      // Validate and filter out invalid components
      const validTypes = body.requiredComponents;
      components = components.filter(comp => {
        if (!comp || !comp.type) {
          logger.warn('⚠️ Filtered out component with no type:', comp);
          return false;
        }
        if (!validTypes.includes(comp.type)) {
          logger.warn(`⚠️ Filtered out invalid component type: "${comp.type}"`, { validTypes });
          return false;
        }
        return true;
      });
      
      if (components.length === 0) {
        logger.error('No valid components after filtering');
        return NextResponse.json(
          { error: 'No valid components generated', raw: componentsJSON },
          { status: 500 }
        );
      }
      
      logger.info('✅', 'Components Generated', { 
        count: components.length,
        types: components.map(c => c.type) 
      });

      return NextResponse.json({
        success: true,
        components,
        searchResults: searchResults || undefined,
      });
    } catch (parseError) {
      logger.error('Failed to parse components JSON:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse generated components', raw: componentsJSON },
        { status: 500 }
      );
    }
    
  } catch (error) {
    logger.error('Generate Components API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
