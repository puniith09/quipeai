
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { searchMemories, type SearchFilters } from '@/lib/supermemory/client';
import {
  getZoneForCoordinates,
  getNeighboringZones,
  normalizeToGridCenter,
  calculateAdaptiveGridSize,
} from '@/lib/supermemory/zone-utils';

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
    let zonesToSearch: string[] = [];

    if (userId && !location) {
      logger.debug('👤', 'Resolving zones for user', { userId });
      
      return NextResponse.json(
        { error: 'Location is required when userId is not associated with a stored location' },
        { status: 400 }
      );
    } else if (location) {
      const gridSize = calculateAdaptiveGridSize(location.lat, location.lng);
      const normalized = normalizeToGridCenter(location.lat, location.lng, gridSize);
      const currentZone = getZoneForCoordinates(location.lat, location.lng);
      
      zonesToSearch.push(currentZone);

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

    const supermemoryFilters: SearchFilters = { AND: [] };

    if (filters?.type && supermemoryFilters.AND) {
      supermemoryFilters.AND.push({
        key: 'type',
        value: filters.type,
      });
    }

    if (filters?.maxPrice !== undefined && supermemoryFilters.AND) {
      supermemoryFilters.AND.push({
        key: 'price',
        value: filters.maxPrice.toString(),
        filterType: 'numeric',
        numericOperator: '<=',
      });
    }

    if (filters?.minPrice !== undefined && supermemoryFilters.AND) {
      supermemoryFilters.AND.push({
        key: 'price',
        value: filters.minPrice.toString(),
        filterType: 'numeric',
        numericOperator: '>=',
      });
    }

    if (filters?.minRating !== undefined && supermemoryFilters.AND) {
      supermemoryFilters.AND.push({
        key: 'rating',
        value: filters.minRating.toString(),
        filterType: 'numeric',
        numericOperator: '>=',
      });
    }

    if (filters?.verified && supermemoryFilters.AND) {
      supermemoryFilters.AND.push({
        key: 'verified',
        value: 'true',
      });
    }

    console.log('🔍 Calling Supermemory API:', {
      query,
      zones: zonesToSearch,
      filters: supermemoryFilters.AND && supermemoryFilters.AND.length > 0 ? supermemoryFilters : undefined,
      limit
    });

    const results = await searchMemories(
      query,
      zonesToSearch,
      supermemoryFilters.AND && supermemoryFilters.AND.length > 0 ? supermemoryFilters : undefined,
      limit
    );

    console.log('📦 Supermemory API Response:', JSON.stringify({ 
      resultsCount: results.length,
      zones: zonesToSearch.length,
      rawResults: results
    }, null, 2));

    const transformedResults: SearchResult[] = results.map((result) => {
      const r = result as { id?: string; content?: string; metadata?: Record<string, unknown> };
      return {
        id: r.id || '',
        businessId: r.metadata?.businessId as string || '',
        name: r.metadata?.businessName as string || 'Unknown Business',
        type: r.metadata?.type as string || '',
        description: r.content || '',
        price: r.metadata?.price as number | undefined,
        rating: r.metadata?.rating as number | undefined,
        address: r.metadata?.address as string | undefined,
        phone: r.metadata?.phone as string | undefined,
        services: Array.isArray(r.metadata?.services) 
          ? r.metadata.services as string[]
          : [],
        amenities: Array.isArray(r.metadata?.amenities)
          ? r.metadata.amenities as string[]
          : [],
        verified: r.metadata?.verified as boolean || false,
        imageUrl: r.metadata?.imageUrl as string | undefined,
        matchScore: (r as { score?: number }).score || 0,
        zone: (r as { containerTags?: string[] }).containerTags?.[0] || '',
      };
    });

    let filteredResults = transformedResults;

    if (filters?.services && filters.services.length > 0) {
      filteredResults = filteredResults.filter((result) =>
        filters.services!.some((service) =>
          result.services?.some((s) => s.toLowerCase().includes(service.toLowerCase())) || false
        )
      );
    }

    return NextResponse.json({
      success: true,
      query,
      zones: zonesToSearch,
      filters,
      results: filteredResults,
      count: filteredResults.length,
      timestamp: new Date().toISOString(),
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
