import { getAllComponentSchemas } from '@/rendering-engine';
import { logger } from '@/lib/logger';

export interface ComponentNode {
  type: string;
  props?: Record<string, unknown>;
  children?: ComponentNode[];
}

export async function generateComponentsWithAI(
  prompt: string,
  requiredComponents: string[],
  contextData?: Record<string, unknown>
): Promise<ComponentNode[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const allSchemas = getAllComponentSchemas();
  const relevantSchemas: Record<string, unknown> = {};
  
  for (const componentType of requiredComponents) {
    const normalizedType = componentType.toLowerCase();
    if (allSchemas[normalizedType]) {
      relevantSchemas[normalizedType] = allSchemas[normalizedType];
    }
  }

  if (Object.keys(relevantSchemas).length === 0) {
    throw new Error('No valid components found in requiredComponents');
  }

  const schemaExamples = Object.entries(relevantSchemas)
    .map(([name, schema]) => `${name.charAt(0).toUpperCase() + name.slice(1)} Component:\n${JSON.stringify(schema, null, 2)}`)
    .join('\n\n');

  const systemPrompt = `You are a UI component generator. Generate VISUAL UI components with actual content.

CRITICAL: You can ONLY use these component types: ${requiredComponents.join(', ')}

Rules:
- ONLY use component types from: ${requiredComponents.join(', ')}
- Study the schemas below for EXACT format and available props
- Generate ACTUAL content, not placeholders
- Cards can be nested to create structured layouts

Component Schemas:
${schemaExamples}

${contextData ? `CONTEXT DATA:\n${JSON.stringify(contextData, null, 2)}\n\n` : ''}

Return ONLY valid JSON. No markdown, no explanation.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://quipeai.vercel.app',
      'X-Title': 'QuipeAI - Component Generator'
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
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
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const componentsJSON = data.choices?.[0]?.message?.content;

  if (!componentsJSON) {
    throw new Error('No components generated');
  }

  const parsedComponents = JSON.parse(componentsJSON);
  let components = Array.isArray(parsedComponents) ? parsedComponents : [parsedComponents];
  
  const validTypes = requiredComponents;
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
    throw new Error('No valid components generated');
  }
  
  logger.info('✅', 'Components Generated', { 
    count: components.length,
    types: components.map(c => c.type) 
  });

  return components;
}
