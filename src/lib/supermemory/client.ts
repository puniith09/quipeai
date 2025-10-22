/**
 * Supermemory Client
 * 
 * Core client for QuipeAI's spatiotemporal knowledge graph.
 * Handles all interactions with Supermemory API using the official SDK.
 */

import Supermemory from 'supermemory';
import { logger } from '@/lib/logger';

const SUPERMEMORY_API_KEY = process.env.SUPERMEMORY_API_KEY;

if (!SUPERMEMORY_API_KEY) {
  throw new Error('Missing SUPERMEMORY_API_KEY in environment variables');
}

// Initialize Supermemory client
export const supermemory = new Supermemory({
  apiKey: SUPERMEMORY_API_KEY,
});

/**
 * Memory metadata interface
 */
export interface MemoryMetadata {
  [key: string]: string | number | boolean | string[];
}

/**
 * Search filter interface
 */
export interface SearchFilters {
  AND?: Array<{
    key: string;
    value: string;
    filterType?: 'numeric' | 'array_contains';
    numericOperator?: '<=' | '>=' | '<' | '>' | '=';
    negate?: boolean;
  }>;
  OR?: Array<{
    key: string;
    value: string;
    filterType?: 'numeric' | 'array_contains';
    numericOperator?: '<=' | '>=' | '<' | '>' | '=';
    negate?: boolean;
  }>;
}

/**
 * Add a memory to Supermemory
 * 
 * @param content - Text content to store
 * @param containerTags - Tags to group memories (zones, user IDs, business IDs)
 * @param metadata - Additional searchable metadata
 * @param customId - Optional custom ID for idempotent operations
 * @returns Memory ID and status
 */
export async function addMemory(
  content: string,
  containerTags: string[],
  metadata?: MemoryMetadata,
  customId?: string
): Promise<{ id: string; status: string }> {
  try {
    logger.info('Adding memory to Supermemory', { 
      containerTags, 
      contentLength: content.length,
      customId
    });

    const result = await supermemory.memories.add({
      content,
      containerTags, // SDK supports containerTags array
      metadata: metadata || {},
      customId,
    });

    logger.info('Memory added successfully', { 
      memoryId: result.id, 
      status: result.status 
    });

    return {
      id: result.id,
      status: result.status,
    };
  } catch (error) {
    logger.error('Failed to add memory', error);
    throw error;
  }
}

/**
 * Search memories with filters
 * 
 * @param query - Search query
 * @param containerTags - Filter by container tags
 * @param filters - Additional metadata filters
 * @param limit - Max results (default: 10)
 * @returns Search results
 */
export async function searchMemories(
  query: string,
  containerTags?: string[],
  filters?: SearchFilters,
  limit: number = 10
): Promise<any[]> {
  try {
    logger.info('Searching memories', { query, containerTags, limit });

    const result = await supermemory.search.documents({
      q: query,
      containerTags: containerTags || [],
      filters: filters as any, // SDK expects Or | And type
      limit,
    });

    logger.info('Search completed', { resultsCount: result.results?.length || 0 });

    return result.results || [];
  } catch (error) {
    logger.error('Search failed', error);
    throw error;
  }
}

/**
 * List memories with pagination
 * 
 * @param containerTags - Filter by container tags
 * @param filters - Additional metadata filters
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 100)
 * @returns Paginated memories
 */
export async function listMemories(
  containerTags?: string[],
  filters?: SearchFilters,
  page: number = 1,
  limit: number = 100
): Promise<{
  memories: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
  };
}> {
  try {
    logger.info('Listing memories', { containerTags, page, limit });

    const result = await supermemory.memories.list({
      containerTags: containerTags || [],
      filters: filters as any, // SDK expects Or | And type
      page,
      limit,
    });

    logger.info('List completed', { 
      memoriesCount: result.memories?.length || 0,
      totalItems: result.pagination?.totalItems || 0
    });

    return {
      memories: result.memories || [],
      pagination: result.pagination || {
        currentPage: page,
        totalPages: 0,
        totalItems: 0,
        limit,
      },
    };
  } catch (error) {
    logger.error('List memories failed', error);
    throw error;
  }
}

/**
 * Delete a single memory by ID
 * 
 * @param memoryId - Memory ID to delete
 * @returns Success status
 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    logger.info('Deleting memory', { memoryId });

    await supermemory.memories.delete(memoryId);

    logger.info('Memory deleted successfully', { memoryId });

    return true;
  } catch (error) {
    logger.error('Delete memory failed', error);
    return false;
  }
}

/**
 * Bulk delete memories by container tags
 * 
 * Note: SDK doesn't have bulkDelete method yet, using direct API call
 * 
 * @param containerTags - Container tags to delete
 * @returns Deletion result
 */
export async function bulkDeleteByTags(
  containerTags: string[]
): Promise<{
  success: boolean;
  deletedCount: number;
  containerTags: string[];
}> {
  try {
    logger.info('Bulk deleting by tags', { containerTags });

    // Use direct API call since SDK doesn't have bulkDelete yet
    const response = await fetch('https://api.supermemory.ai/v3/documents/bulk', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SUPERMEMORY_API_KEY!,
      },
      body: JSON.stringify({ containerTags }),
    });

    const result = await response.json();

    logger.info('Bulk delete completed', { 
      deletedCount: result.deletedCount,
      success: result.success 
    });

    return {
      success: result.success || false,
      deletedCount: result.deletedCount || 0,
      containerTags,
    };
  } catch (error) {
    logger.error('Bulk delete failed', error);
    return {
      success: false,
      deletedCount: 0,
      containerTags,
    };
  }
}

/**
 * Update a memory by ID
 * 
 * @param memoryId - Memory ID to update
 * @param content - New content
 * @param metadata - New metadata
 * @returns Update result
 */
export async function updateMemory(
  memoryId: string,
  content?: string,
  metadata?: MemoryMetadata
): Promise<{ id: string; status: string }> {
  try {
    logger.info('Updating memory', { memoryId });

    const result = await supermemory.memories.update(memoryId, {
      content,
      metadata,
    });

    logger.info('Memory updated successfully', { memoryId, status: result.status });

    return {
      id: result.id,
      status: result.status,
    };
  } catch (error) {
    logger.error('Update memory failed', error);
    throw error;
  }
}

/**
 * Get a single memory by ID
 * 
 * @param memoryId - Memory ID
 * @returns Memory details
 */
export async function getMemory(memoryId: string): Promise<any> {
  try {
    logger.info('Getting memory', { memoryId });

    const result = await supermemory.memories.get(memoryId);

    logger.info('Memory retrieved successfully', { memoryId });

    return result;
  } catch (error) {
    logger.error('Get memory failed', error);
    throw error;
  }
}

const client = {
  addMemory,
  searchMemories,
  listMemories,
  deleteMemory,
  bulkDeleteByTags,
  updateMemory,
  getMemory,
};

export default client;
