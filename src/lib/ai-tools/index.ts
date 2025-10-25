/**
 * AI Tool Definitions
 * 
 * Tools that the AI can call to interact with Supermemory and other services.
 * These enable the AI to save user information, search across users, etc.
 */

import { addMemory, searchMemories } from '@/lib/supermemory/client';
import { getUserContainerTag } from '@/lib/supermemory/user-context';
import { getZoneForCoordinates } from '@/lib/supermemory/zone-utils';
import { logger } from '@/lib/logger';

/**
 * Tool function type
 */
export type ToolFunction = (
  args: Record<string, unknown>,
  userId: string
) => Promise<unknown>;

/**
 * Save information to user's memory
 * 
 * AI calls this to persist anything the user shares - business info, preferences, etc.
 */
export async function saveToMemory(
  args: Record<string, unknown>,
  userId: string
): Promise<{ success: boolean; memoryId: string }> {
  try {
    const { content, metadata = {}, location } = args as {
      content: string;
      metadata?: Record<string, string | number | boolean | string[]>;
      location?: { lat: number; lng: number };
    };

    // Get user container tag
    const userTag = getUserContainerTag(userId);
    const containerTags = [userTag];

    // Ensure metadata is a proper object
    const metadataObj = typeof metadata === 'object' ? metadata as Record<string, string | number | boolean | string[]> : {};

    // If location provided, add zone tag
    if (location?.lat && location?.lng) {
      const zoneTag = getZoneForCoordinates(location.lat, location.lng);
      containerTags.push(zoneTag);
      
      logger.info('📍 Zone tag calculated', {
        location,
        zoneTag,
        containerTags
      });
      
      // Add location to metadata
      metadataObj.lat = location.lat;
      metadataObj.lng = location.lng;
    }

    // Add timestamp
    metadataObj.savedAt = new Date().toISOString();

    // Save to Supermemory
    const result = await addMemory(
      content,
      containerTags,
      metadataObj
    );

    logger.info('💾 AI saved to memory', {
      userId,
      memoryId: result.id,
      containerTags,
      metadata,
    });

    return {
      success: true,
      memoryId: result.id,
    };
  } catch (error) {
    logger.error('Failed to save to memory', error);
    throw error;
  }
}

/**
 * Search for businesses near a location
 * 
 * AI calls this to find businesses when user asks for recommendations
 */
export async function searchBusinesses(
  args: Record<string, unknown>,
  userId: string
): Promise<{ success: boolean; results: unknown[]; count: number }> {
  try {
    const { query, location, businessType, limit = 10 } = args as {
      query: string;
      location: { lat: number; lng: number };
      businessType?: string;
      limit?: number;
    };

    if (!location?.lat || !location?.lng) {
      throw new Error('Location is required for search');
    }

    // Calculate zone for the location
    const zoneTag = getZoneForCoordinates(location.lat, location.lng);
    
    logger.info('🔍 AI searching businesses', {
      query,
      location,
      businessType,
      zoneTag
    });

    // Build filters
    const filters: { AND: Array<{ key: string; value: string; filterType?: 'numeric' | 'array_contains'; numericOperator?: '=' | '<=' | '>=' | '<' | '>'; negate?: boolean }> } = { AND: [] };
    
    if (businessType) {
      filters.AND.push({
        key: 'businessType',
        value: businessType,
      });
    }

    // Search in Supermemory
    const results = await searchMemories(
      query,
      [zoneTag],
      filters.AND.length > 0 ? filters : undefined,
      limit as number
    );

    logger.info('✅ Search completed', {
      count: results.length,
      zone: zoneTag
    });

    return {
      success: true,
      results: results.map(r => ({
        id: r.id,
        name: r.metadata?.businessName,
        type: r.metadata?.businessType,
        description: r.content,
        services: r.metadata?.services,
        price: r.metadata?.priceMin || r.metadata?.price,
        phone: r.metadata?.phone,
        address: r.metadata?.address,
        rating: r.metadata?.rating,
        score: r.score,
      })),
      count: results.length,
    };
  } catch (error) {
    logger.error('Failed to search businesses', error);
    throw error;
  }
}

/**
 * Generate UI components from data
 * 
 * AI calls this to create visual components for displaying search results
 */
export async function generateComponents(
  args: Record<string, unknown>,
  userId: string
): Promise<{ success: boolean; components: unknown[] }> {
  try {
    const { data, componentType = 'card' } = args as {
      data: unknown[];
      componentType?: string;
    };

    logger.info('🎨 AI generating components', {
      dataCount: Array.isArray(data) ? data.length : 0,
      componentType
    });

    // This is a placeholder - in the actual implementation,
    // this would call the component generation API
    // For now, we return a success flag and let the chat API handle it
    
    return {
      success: true,
      components: [], // Will be generated by chat API
    };
  } catch (error) {
    logger.error('Failed to generate components', error);
    throw error;
  }
}

/**
 * Tool registry - maps tool names to functions
 */
export const AI_TOOLS: Record<string, ToolFunction> = {
  saveToMemory,
  searchBusinesses,
  generateComponents,
};

/**
 * Get tool definitions for OpenRouter API
 * 
 * Returns the JSON schema that tells the AI what tools are available
 */
export function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'saveToMemory',
        description: 'Save information shared by the user to their persistent memory. Use this whenever the user shares personal information like business details, preferences, or any data they want remembered. The information will be tagged with location if provided, making it discoverable by other users searching in that area.',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The information to save. Should be descriptive and include all relevant details the user shared. For businesses, include name, type, services, hours, etc.',
            },
            metadata: {
              type: 'object',
              description: 'Structured metadata for filtering. For businesses, include: businessType (e.g., "salon", "restaurant"), businessName, services (array), priceRange (min/max), hours, contact info, etc.',
              properties: {
                businessType: {
                  type: 'string',
                  description: 'Type of business (e.g., "salon", "restaurant", "cafe")',
                },
                businessName: {
                  type: 'string',
                  description: 'Name of the business',
                },
                services: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of services offered',
                },
                priceMin: {
                  type: 'number',
                  description: 'Minimum price',
                },
                priceMax: {
                  type: 'number',
                  description: 'Maximum price',
                },
                hours: {
                  type: 'string',
                  description: 'Business hours',
                },
                phone: {
                  type: 'string',
                  description: 'Contact phone number',
                },
              },
            },
            location: {
              type: 'object',
              description: 'Geographic location (required for businesses to be discoverable)',
              properties: {
                lat: {
                  type: 'number',
                  description: 'Latitude',
                },
                lng: {
                  type: 'number',
                  description: 'Longitude',
                },
              },
              required: ['lat', 'lng'],
            },
          },
          required: ['content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'searchBusinesses',
        description: 'Search for businesses near a specific location. Use this when the user asks to find businesses, services, or places nearby. Returns actual business data from the knowledge graph.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query describing what to look for (e.g., "salon", "haircut", "restaurant with pasta")',
            },
            location: {
              type: 'object',
              description: 'User location for proximity search',
              properties: {
                lat: {
                  type: 'number',
                  description: 'Latitude',
                },
                lng: {
                  type: 'number',
                  description: 'Longitude',
                },
              },
              required: ['lat', 'lng'],
            },
            businessType: {
              type: 'string',
              description: 'Type of business to filter (e.g., "salon", "restaurant", "cafe")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
            },
          },
          required: ['query', 'location'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generateComponents',
        description: 'Generate UI components to display search results or data visually. Call this after searching to create visual cards/lists for the user. This triggers the component generation system.',
        parameters: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                description: 'Individual data item to visualize'
              },
              description: 'The data to visualize (e.g., search results from searchBusinesses)',
            },
            componentType: {
              type: 'string',
              description: 'Type of component to generate (e.g., "card", "list")',
            },
          },
          required: ['data'],
        },
      },
    },
  ];
}

/**
 * Execute a tool call
 * 
 * @param toolName - Name of the tool to execute
 * @param args - Arguments for the tool
 * @param userId - User ID for context
 * @returns Tool execution result
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const tool = AI_TOOLS[toolName];
  
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return await tool(args, userId);
}
