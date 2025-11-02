
import Supermemory from 'supermemory';
import { logger } from '@/lib/logger';

const SUPERMEMORY_API_KEY = process.env.SUPERMEMORY_API_KEY;

if (!SUPERMEMORY_API_KEY) {
  throw new Error('Missing SUPERMEMORY_API_KEY in environment variables');
}

export const supermemory = new Supermemory({
  apiKey: SUPERMEMORY_API_KEY,
});

export interface MemoryMetadata {
  [key: string]: string | number | boolean | string[];
}

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

export async function searchMemories(
  query: string,
  containerTags?: string[],
  filters?: SearchFilters,
  limit: number = 10
): Promise<unknown[]> {
  try {
    logger.info('Searching memories', { query, containerTags, limit });

    const result = await supermemory.search.documents({
      q: query,
      containerTags: containerTags || [],
      filters: filters as unknown as Parameters<typeof supermemory.search.documents>[0]['filters'],
      limit,
    });

    logger.info('Search completed', { resultsCount: result.results?.length || 0 });

    return result.results || [];
  } catch (error) {
    logger.error('Search failed', error);
    throw error;
  }
}

export async function listMemories(
  containerTags?: string[],
  filters?: SearchFilters,
  page: number = 1,
  limit: number = 100
): Promise<{
  memories: unknown[];
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
      filters: filters as never,
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

export async function bulkDeleteByTags(
  containerTags: string[]
): Promise<{
  success: boolean;
  deletedCount: number;
  containerTags: string[];
}> {
  try {
    logger.info('Bulk deleting by tags', { containerTags });

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

export async function getMemory(memoryId: string): Promise<unknown> {
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
