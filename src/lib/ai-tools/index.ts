/**
 * AI Tool Definitions
 * 
 * Tools that the AI can call to interact with Supermemory and other services.
 * These enable the AI to save user information, search across users, etc.
 */

import { addMemory } from '@/lib/supermemory/client';
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
 * Tool registry - maps tool names to functions
 */
export const AI_TOOLS: Record<string, ToolFunction> = {
  saveToMemory,
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
