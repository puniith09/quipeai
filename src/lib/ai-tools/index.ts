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
import { getAvailableComponents } from '@/rendering-engine';

// OTP verification state (in-memory for now)
const otpStore: Map<string, { code: string; expiresAt: number; verificationId: string }> = new Map();

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
): Promise<{ results: unknown[]; count: number; suggestedComponents?: string[] }> {
  try {
    const { query, location, businessType, limit = 10, suggestedComponents } = args as {
      query: string;
      location: { lat: number; lng: number };
      businessType?: string;
      limit?: number;
      suggestedComponents?: string[];
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
      zone: zoneTag,
      suggestedComponents
    });

    return {
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
      ...(suggestedComponents && { suggestedComponents }),
    };
  } catch (error) {
    logger.error('Failed to search businesses', error);
    throw error;
  }
}

/**
 * Send OTP to user's phone number
 * 
 * AI calls this to initiate the login process
 */
export async function sendOTP(
  args: Record<string, unknown>,
  _userId: string
): Promise<{ 
  success: boolean; 
  message: string; 
  phoneNumber: string; 
  nextStep: string;
  components?: any[]; 
  suggestedComponents?: string[] 
}> {
  try {
    const { phoneNumber } = args as { phoneNumber: string };

    logger.info('📱 Sending OTP', { phoneNumber });

    // Call the actual send-otp API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Return OTP input component for the user to enter verification code
      return {
        success: true,
        message: `Verification code sent to ${phoneNumber}`,
        phoneNumber,
        nextStep: 'User needs to enter the OTP code they received',
        components: [
          {
            type: 'textinput',
            props: {
              label: 'Enter Verification Code',
              placeholder: '123456',
              type: 'text',
              action: 'verify_otp',
              submitLabel: 'Verify'
            }
          }
        ],
        suggestedComponents: ['textinput']
      };
    } else {
      throw new Error(data.error || 'Failed to send OTP');
    }
  } catch (error) {
    logger.error('Error sending OTP:', error);
    throw error;
  }
}

/**
 * Verify OTP code
 * 
 * AI calls this to complete the login process
 */
export async function verifyOTP(
  args: Record<string, unknown>,
  _userId: string
): Promise<{ success: boolean; message: string; authenticated: boolean }> {
  try {
    const { phoneNumber, code } = args as { phoneNumber: string; code: string };

    logger.info('🔐 Verifying OTP', { phoneNumber, code: '***' });

    // Call the actual verify-otp API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, code }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return {
        success: true,
        message: 'Phone number verified successfully! You are now logged in.',
        authenticated: true,
      };
    } else {
      throw new Error(data.error || 'Invalid verification code');
    }
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    throw error;
  }
}

/**
 * Request login - indicates user wants to authenticate
 * 
 * AI calls this when user expresses intent to login
 */
export async function requestLogin(
  args: Record<string, unknown>,
  _userId: string
): Promise<{ 
  message: string;
  nextStep: string;
  components: any[]; 
  suggestedComponents: string[] 
}> {
  logger.info('� User requesting login');
  
  return {
    message: 'Please provide your phone number with country code to continue',
    nextStep: 'User needs to provide their phone number',
    components: [
      {
        type: 'textinput',
        props: {
          label: 'Enter Phone Number',
          placeholder: '+919876543210',
          type: 'tel',
          action: 'send_otp',
          submitLabel: 'Send Code'
        }
      }
    ],
    suggestedComponents: ['textinput']
  };
}

/**
 * Tool registry - maps tool names to functions
 */
export const AI_TOOLS: Record<string, (args: Record<string, unknown>, userId: string) => Promise<unknown>> = {
  saveToMemory,
  searchBusinesses,
  requestLogin,
  sendOTP,
  verifyOTP,
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
        description: `Search for businesses near a specific location. Use this when the user asks to find businesses, services, or places nearby. Returns actual business data from the knowledge graph.
        
IMPORTANT: When calling this tool, you MUST specify which UI components to generate for displaying results.
Available components: ${getAvailableComponents().join(', ')}
- Use 'card' for displaying individual business information
- Use 'text' for simple text content
- Use 'list' for showing multiple items
- Combine components as needed (e.g., ["card", "text"] for business cards with text details)`,
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
            suggestedComponents: {
              type: 'array',
              items: { type: 'string' },
              description: `Array of component types to use for displaying results. Choose from: ${getAvailableComponents().join(', ')}. For business search results, typically use ["card", "text"].`,
            },
          },
          required: ['query', 'location', 'suggestedComponents'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'sendOTP',
        description: 'Send a one-time password (OTP) verification code to a phone number to begin the login process. Call this when the user wants to login and provides their phone number.',
        parameters: {
          type: 'object',
          properties: {
            phoneNumber: {
              type: 'string',
              description: 'The phone number to send the OTP to (with country code, e.g., "+919392766419")',
            },
          },
          required: ['phoneNumber'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'verifyOTP',
        description: 'Verify the OTP code entered by the user to complete the login process. Call this after the user receives and enters the verification code.',
        parameters: {
          type: 'object',
          properties: {
            phoneNumber: {
              type: 'string',
              description: 'The phone number that received the OTP',
            },
            code: {
              type: 'string',
              description: 'The verification code entered by the user',
            },
          },
          required: ['phoneNumber', 'code'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'showPhoneInput',
        description: 'Show a phone number input field for login. Call this when user wants to log in and needs to provide their phone number.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'showOTPInput',
        description: 'Show an OTP verification code input field. Call this after sending OTP to let user enter the verification code.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
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
