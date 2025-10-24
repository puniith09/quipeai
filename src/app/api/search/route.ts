/**
 * Search API Endpoint
 * 
 * Integrates Supermemory spatiotemporal discovery with QuipeAI chat.
 * Searches for businesses in the user's current zone with semantic matching.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { searchMemories } from '@/lib/supermemory/client';
import {
  getZoneForCoordinates,
  getNeighboringZones,
  normalizeToGridCenter,
  calculateAdaptiveGridSize,
  type GridSize,
} from '@/lib/supermemory/zone-utils';
import { resolveUserZone } from '@/lib/supermemory/user-context';

/**
 * Search request interface
 */
interface SearchRequest {
  query: string;
  location?: {
    lat: number;
    lng: number;
  };
  userId?: string;
  filters?: {
    type?: string;
    maxPrice?: number;
    minPrice?: number;
    minRating?: number;
    services?: string[];
    verified?: boolean;
  };
  limit?: number;
  includeNeighbors?: boolean; // Search neighboring zones too
}

/**
 * Search result interface
 */
interface SearchResult {
  id: string;
  businessId: string;
  name: string;
  type: string;
  description: string;
  price?: number;
  rating?: number;
  address?: string;
  phone?: string;
  services?: string[];
  amenities?: string[];
  verified?: boolean;
  imageUrl?: string;
  distance?: number; // Distance from user (if location provided)
  matchScore: number;
  zone: string;
}

/**
 * Search API endpoint
 * 
 * GET /api/search?q=salon&lat=17.4326&lng=78.4487&type=salon&maxPrice=600
 * POST /api/search with JSON body
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const query = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const maxPrice = searchParams.get('maxPrice');
    const minPrice = searchParams.get('minPrice');
    const minRating = searchParams.get('minRating');
    const limit = searchParams.get('limit');
    const includeNeighbors = searchParams.get('includeNeighbors') === 'true';

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const searchRequest: SearchRequest = {
      query,
      location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
      userId: userId || undefined,
      filters: {
        type: type || undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        minRating: minRating ? parseFloat(minRating) : undefined,
      },
      limit: limit ? parseInt(limit, 10) : 10,
      includeNeighbors,
    };

    return await handleSearch(searchRequest);
  } catch (error) {
    logger.error('Search GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();

    if (!body.query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    return await handleSearch(body);
  } catch (error) {
    logger.error('Search POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle search logic
 */
async function handleSearch(searchRequest: SearchRequest): Promise<NextResponse> {
  const {
    query,
    location,
    userId,
    filters,
    limit = 10,
    includeNeighbors = false,
  } = searchRequest;

  console.log('🚀 SEARCH API CALLED', { query, location, userId, filters, limit });
  logger.info('Search request', { query, location, userId, filters, limit });

  try {
    // Step 1: Determine zones to search
    let zonesToSearch: string[] = [];

    if (userId && !location) {
      // Use user context to resolve zones
      logger.debug('👤', 'Resolving zones for user', { userId });
      
      // For now, if no location provided, return error
      // In production, you'd fetch user's last known location or home zone
      return NextResponse.json(
        { error: 'Location is required when userId is not associated with a stored location' },
        { status: 400 }
      );
    } else if (location) {
      // Calculate zone from location
      const gridSize = calculateAdaptiveGridSize(location.lat, location.lng);
      const normalized = normalizeToGridCenter(location.lat, location.lng, gridSize);
      const currentZone = getZoneForCoordinates(location.lat, location.lng);
      
      zonesToSearch.push(currentZone);

      // Include neighboring zones if requested (for boundary searches)
      if (includeNeighbors) {
        const neighbors = getNeighboringZones(normalized.lat, normalized.lng, gridSize);
        zonesToSearch = neighbors; // This includes center + 8 neighbors
      }

      logger.debug('🗺️', 'Calculated zones', { 
        location, 
        gridSize, 
        zones: zonesToSearch.length 
      });
    } else {
      return NextResponse.json(
        { error: 'Either location or userId with stored location is required' },
        { status: 400 }
      );
    }

    // Step 2: Build Supermemory filters
    const supermemoryFilters: any = { AND: [] };

    if (filters?.type) {
      supermemoryFilters.AND.push({
        key: 'type',
        value: filters.type,
      });
    }

    if (filters?.maxPrice !== undefined) {
      supermemoryFilters.AND.push({
        key: 'price',
        value: filters.maxPrice.toString(),
        filterType: 'numeric',
        numericOperator: '<=',
      });
    }

    if (filters?.minPrice !== undefined) {
      supermemoryFilters.AND.push({
        key: 'price',
        value: filters.minPrice.toString(),
        filterType: 'numeric',
        numericOperator: '>=',
      });
    }

    if (filters?.minRating !== undefined) {
      supermemoryFilters.AND.push({
        key: 'rating',
        value: filters.minRating.toString(),
        filterType: 'numeric',
        numericOperator: '>=',
      });
    }

    if (filters?.verified) {
      supermemoryFilters.AND.push({
        key: 'verified',
        value: 'true',
      });
    }

    // Step 3: Search in Supermemory
    console.log('🔍 Calling Supermemory API:', {
      query,
      zones: zonesToSearch,
      filters: supermemoryFilters.AND.length > 0 ? supermemoryFilters : undefined,
      limit
    });

    const results = await searchMemories(
      query,
      zonesToSearch,
      supermemoryFilters.AND.length > 0 ? supermemoryFilters : undefined,
      limit
    );

    console.log('📦 Supermemory API Response:', JSON.stringify({ 
      resultsCount: results.length,
      zones: zonesToSearch.length,
      rawResults: results // Full response from Supermemory
    }, null, 2));

    // Step 4: Transform results
    const transformedResults: SearchResult[] = results.map((result) => ({
      id: result.id || '',
      businessId: result.metadata?.businessId as string || '',
      name: result.metadata?.businessName as string || 'Unknown Business',
      type: result.metadata?.type as string || '',
      description: result.content || '',
      price: result.metadata?.price as number | undefined,
      rating: result.metadata?.rating as number | undefined,
      address: result.metadata?.address as string | undefined,
      phone: result.metadata?.phone as string | undefined,
      services: Array.isArray(result.metadata?.services) 
        ? result.metadata.services as string[]
        : [],
      amenities: Array.isArray(result.metadata?.amenities)
        ? result.metadata.amenities as string[]
        : [],
      verified: result.metadata?.verified as boolean || false,
      imageUrl: result.metadata?.imageUrl as string | undefined,
      matchScore: result.score || 0,
      zone: result.containerTags?.[0] || '',
    }));

    // Step 5: Apply post-processing filters (services, etc.)
    let filteredResults = transformedResults;

    if (filters?.services && filters.services.length > 0) {
      filteredResults = filteredResults.filter((result) =>
        filters.services!.some((service) =>
          result.services?.some((s) => s.toLowerCase().includes(service.toLowerCase())) || false
        )
      );
    }

    // Step 6: Return results
    return NextResponse.json({
      success: true,
      query,
      zones: zonesToSearch,
      filters,
      results: filteredResults,
      count: filteredResults.length,
      timestamp: new Date().toISOString(),
      // Debug: Include raw Supermemory response
      debug: {
        supermemoryRawResults: results,
        supermemoryResultsCount: results.length,
      }
    });

  } catch (error) {
    logger.error('Search handler error:', error);
    return NextResponse.json(
      { 
        error: 'Search failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
