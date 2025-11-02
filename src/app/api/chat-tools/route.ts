import { NextRequest } from 'next/server';
import { streamText, CoreMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { addMemory } from '@/lib/supermemory/client';
import { getZoneForCoordinates } from '@/lib/supermemory/zone-utils';
import { logger } from '@/lib/logger';


interface ChatRequest {
  messages: CoreMessage[];
  userId?: string;
  location?: { lat: number; lng: number };
}

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid request: messages array is required' }), {
        status: 400,
      });
    }

    const userId = body.userId || 'anonymous';
    const userLocation = body.location;

    const systemMessage: CoreMessage = {
      role: 'system',
      content: `You are QuipeAI, a conversational assistant that helps users discover local businesses and services.

IMPORTANT: You have access to tools that let you:
1. Remember important information (business details, user preferences, facts)
2. Search for businesses nearby

USE YOUR JUDGMENT to decide when information is worth remembering:
- Business details (name, type, location, services, prices)
- User preferences (likes, dislikes, habits)
- Important facts about the user
- Anything that would be useful for future conversations

DO NOT remember:
- Casual small talk
- General questions
- Temporary information

When you remember something, extract structured data like:
- Business: name, type, address, services, price range, contact
- User preference: category, specific likes/dislikes
- Fact: clear, factual information

Be natural and conversational. Don't announce when you're using tools unless relevant.`
    };

    const messages = [systemMessage, ...body.messages];

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages,
      tools: {
        addMemory: {
          description: `Remember important information for this user. Call this when user shares business info, preferences, or important facts. Extract structured data.`,
          inputSchema: z.object({
            content: z.string().describe('Natural language description of what to remember'),
            metadata: z.object({
              type: z.enum(['business', 'preference', 'fact', 'interaction']).describe('Type of information'),
              businessName: z.string().optional().describe('Business name if this is business info'),
              businessType: z.string().optional().describe('Type: salon, restaurant, gym, etc'),
              address: z.string().optional().describe('Physical address'),
              services: z.array(z.string()).optional().describe('Services offered'),
              priceRange: z.string().optional().describe('Price range: budget/moderate/premium'),
              contact: z.string().optional().describe('Phone or contact info'),
              coordinates: z.object({
                lat: z.number(),
                lng: z.number()
              }).optional().describe('Location coordinates'),
              tags: z.array(z.string()).optional().describe('Relevant tags'),
            }),
          }),
          execute: async ({ content, metadata }) => {
            try {
              logger.debug('🧠', 'AI Adding Memory', { userId, content, metadata });

              const tags: string[] = [`user_${userId}`];

              if (metadata.type === 'business' && metadata.coordinates) {
                const zone = getZoneForCoordinates(
                  metadata.coordinates.lat,
                  metadata.coordinates.lng
                );
                tags.push(zone);
                
                if (metadata.businessName) {
                  const businessId = metadata.businessName.toLowerCase().replace(/\s+/g, '_');
                  tags.push(`business_${businessId}`);
                }
              }

              if (metadata.tags) {
                tags.push(...metadata.tags);
              }

              const result = await addMemory(
                content,
                tags,
                {
                  userId,
                  timestamp: new Date().toISOString(),
                  ...metadata,
                },
                `memory_${userId}_${Date.now()}`
              );

              logger.info('✅', 'Memory Added', { id: result.id, tags });

              return {
                success: true,
                memoryId: result.id,
                message: 'Information saved successfully',
              };
            } catch (error) {
              logger.error('❌', 'Failed to add memory', error);
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          },
        },

        searchBusinesses: {
          description: 'Search for local businesses when user asks to find/discover services nearby.',
          inputSchema: z.object({
            query: z.string().describe('Search query (e.g., "salon", "restaurant with pasta")'),
            type: z.string().optional().describe('Business type filter'),
            maxPrice: z.number().optional().describe('Maximum price'),
            minRating: z.number().optional().describe('Minimum rating'),
          }),
          execute: async ({ query, type, maxPrice, minRating }) => {
            try {
              if (!userLocation) {
                return {
                  success: false,
                  error: 'Location required. Please share your location.',
                };
              }

              logger.debug('🔍', 'AI Searching', { query, type, location: userLocation });

              const searchParams = new URLSearchParams({
                q: query,
                lat: userLocation.lat.toString(),
                lng: userLocation.lng.toString(),
              });

              if (type) searchParams.append('type', type);
              if (maxPrice) searchParams.append('maxPrice', maxPrice.toString());
              if (minRating) searchParams.append('minRating', minRating.toString());

              const response = await fetch(
                `${request.nextUrl.origin}/api/search?${searchParams}`
              );

              if (!response.ok) {
                throw new Error('Search failed');
              }

              const data = await response.json();

              logger.info('✅', 'Search Results', { count: data.count });

              return {
                success: true,
                results: data.results,
                count: data.count,
              };
            } catch (error) {
              logger.error('❌', 'Search failed', error);
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          },
        },
      },
    });

    return result.toTextStreamResponse();

  } catch (error) {
    logger.error('❌', 'Chat tools error', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    });
  }
}
