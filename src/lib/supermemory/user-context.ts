/**
 * User Context Management
 * 
 * Manages persistent user preferences, learning, and context across sessions.
 * Each user has a permanent container tag that never expires.
 */

import { logger } from '@/lib/logger';
import {
  addMemory,
  searchMemories,
  listMemories,
  updateMemory,
  type MemoryMetadata,
} from './client';
import {
  getZoneForCoordinates,
  isWithinZone,
  normalizeToGridCenter,
  calculateAdaptiveGridSize,
  type GridSize,
} from './zone-utils';

/**
 * User profile interface
 */
export interface UserProfile {
  userId: string;
  homeZone?: {
    lat: number;
    lng: number;
    gridSize: GridSize;
    tag: string;
  };
  preferences: {
    favoriteCategories: string[];
    priceRange: { min: number; max: number };
    dietaryRestrictions?: string[];
    interests: string[];
  };
  interactions: {
    totalSearches: number;
    totalBookings: number;
    lastActive: string;
  };
  learningData: {
    frequentSearchTerms: string[];
    preferredBusinessTypes: string[];
    avgSpending: number;
  };
}

/**
 * Interaction type for tracking user activity
 */
export interface UserInteraction {
  type: 'search' | 'view' | 'booking' | 'favorite' | 'review';
  businessId?: string;
  businessType?: string;
  searchQuery?: string;
  timestamp: Date;
  location?: {
    lat: number;
    lng: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Get user container tag
 * 
 * @param userId - User ID
 * @returns Container tag for user
 */
export function getUserContainerTag(userId: string): string {
  return `user_${userId}`;
}

/**
 * Initialize user context
 * 
 * Creates the initial user profile memory when a user first signs up.
 * 
 * @param userId - User ID
 * @param initialData - Optional initial profile data
 * @returns User profile memory ID
 */
export async function initializeUserContext(
  userId: string,
  initialData?: Partial<UserProfile>
): Promise<{ id: string; profile: UserProfile }> {
  const userTag = getUserContainerTag(userId);

  const defaultProfile: UserProfile = {
    userId,
    preferences: {
      favoriteCategories: [],
      priceRange: { min: 0, max: 10000 },
      interests: [],
    },
    interactions: {
      totalSearches: 0,
      totalBookings: 0,
      lastActive: new Date().toISOString(),
    },
    learningData: {
      frequentSearchTerms: [],
      preferredBusinessTypes: [],
      avgSpending: 0,
    },
    ...initialData,
  };

  const content = `User Profile for ${userId}\nPreferences: ${JSON.stringify(defaultProfile.preferences, null, 2)}`;

  const result = await addMemory(
    content,
    [userTag],
    {
      type: 'user_profile',
      userId,
      favoriteCategories: defaultProfile.preferences.favoriteCategories,
      priceRange: JSON.stringify(defaultProfile.preferences.priceRange),
      interests: defaultProfile.preferences.interests,
      totalSearches: defaultProfile.interactions.totalSearches,
      totalBookings: defaultProfile.interactions.totalBookings,
    },
    `user_profile_${userId}`
  );

  logger.info('User context initialized', { userId, memoryId: result.id });

  return {
    id: result.id,
    profile: defaultProfile,
  };
}

/**
 * Get user profile
 * 
 * Retrieves the user's profile from Supermemory.
 * 
 * @param userId - User ID
 * @returns User profile or null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userTag = getUserContainerTag(userId);

  try {
    const results = await searchMemories(
      'User Profile',
      [userTag],
      {
        AND: [{ key: 'type', value: 'user_profile', filterType: 'array_contains' }],
      },
      1
    );

    if (results.length === 0) {
      logger.info('User profile not found', { userId });
      return null;
    }

    // Parse profile from metadata
    const result = results[0];
    const profile: UserProfile = {
      userId,
      preferences: {
        favoriteCategories: result.metadata?.favoriteCategories || [],
        priceRange: result.metadata?.priceRange || { min: 0, max: 10000 },
        dietaryRestrictions: result.metadata?.dietaryRestrictions,
        interests: result.metadata?.interests || [],
      },
      interactions: {
        totalSearches: result.metadata?.totalSearches || 0,
        totalBookings: result.metadata?.totalBookings || 0,
        lastActive: result.metadata?.lastActive || new Date().toISOString(),
      },
      learningData: {
        frequentSearchTerms: result.metadata?.frequentSearchTerms || [],
        preferredBusinessTypes: result.metadata?.preferredBusinessTypes || [],
        avgSpending: result.metadata?.avgSpending || 0,
      },
    };

    if (result.metadata?.homeZone) {
      profile.homeZone = result.metadata.homeZone;
    }

    logger.info('User profile retrieved', { userId });

    return profile;
  } catch (error) {
    logger.error('Failed to get user profile', { userId, error });
    return null;
  }
}

/**
 * Update user context
 * 
 * Records a user interaction and updates the user's learning profile.
 * 
 * @param userId - User ID
 * @param interaction - User interaction data
 * @returns Success status
 */
export async function updateUserContext(
  userId: string,
  interaction: UserInteraction
): Promise<boolean> {
  const userTag = getUserContainerTag(userId);

  try {
    // Create interaction memory
    const content = `${interaction.type}: ${interaction.searchQuery || interaction.businessType || 'activity'} at ${interaction.timestamp.toISOString()}`;

    const metadata: MemoryMetadata = {
      type: 'user_interaction',
      userId,
      interactionType: interaction.type,
      timestamp: interaction.timestamp.toISOString(),
    };

    if (interaction.businessId) metadata.businessId = interaction.businessId;
    if (interaction.businessType) metadata.businessType = interaction.businessType;
    if (interaction.searchQuery) metadata.searchQuery = interaction.searchQuery;
    if (interaction.location) {
      metadata.location = JSON.stringify(interaction.location);
    }

    await addMemory(content, [userTag], metadata);

    logger.info('User interaction recorded', {
      userId,
      type: interaction.type,
      businessId: interaction.businessId,
    });

    // TODO: Update user profile with learning data (implement in Phase 2)
    // - Increment counters
    // - Update frequent searches
    // - Adjust preferences

    return true;
  } catch (error) {
    logger.error('Failed to update user context', { userId, error });
    return false;
  }
}

/**
 * Set user home zone
 * 
 * Stores the user's home location for personalized zone resolution.
 * 
 * @param userId - User ID
 * @param lat - Home latitude
 * @param lng - Home longitude
 * @returns Success status
 */
export async function setUserHomeZone(
  userId: string,
  lat: number,
  lng: number
): Promise<boolean> {
  try {
    const gridSize = calculateAdaptiveGridSize(lat, lng);
    const normalized = normalizeToGridCenter(lat, lng, gridSize);
    const zoneTag = getZoneForCoordinates(lat, lng);

    const profile = await getUserProfile(userId);

    if (!profile) {
      logger.warn('Cannot set home zone: user profile not found', { userId });
      return false;
    }

    // Update profile with home zone
    const userTag = getUserContainerTag(userId);
    const content = `User Profile for ${userId}\nHome Zone: ${zoneTag}\nPreferences: ${JSON.stringify(profile.preferences, null, 2)}`;

    await addMemory(
      content,
      [userTag],
      {
        type: 'user_profile',
        userId,
        homeZone: JSON.stringify({
          lat: normalized.lat,
          lng: normalized.lng,
          gridSize,
          tag: zoneTag,
        }),
        favoriteCategories: profile.preferences.favoriteCategories,
        priceRange: JSON.stringify(profile.preferences.priceRange),
        interests: profile.preferences.interests,
      },
      `user_profile_${userId}` // Same customId for idempotent update
    );

    logger.info('User home zone set', {
      userId,
      homeZone: zoneTag,
      lat: normalized.lat,
      lng: normalized.lng,
    });

    return true;
  } catch (error) {
    logger.error('Failed to set user home zone', { userId, error });
    return false;
  }
}

/**
 * Resolve user zone (boundary handling)
 * 
 * Determines which zone a user should search in, handling edge cases:
 * - User near zone boundary: search in multiple zones
 * - User at home: use home zone preferences
 * - New user: use current location zone
 * 
 * @param userId - User ID
 * @param currentLat - Current latitude
 * @param currentLng - Current longitude
 * @returns Array of zone tags to search
 */
export async function resolveUserZone(
  userId: string,
  currentLat: number,
  currentLng: number
): Promise<string[]> {
  const profile = await getUserProfile(userId);
  const currentZone = getZoneForCoordinates(currentLat, currentLng);
  const zones: string[] = [currentZone];

  // If user has home zone and is near home, include home zone
  if (profile?.homeZone) {
    const isNearHome = isWithinZone(
      currentLat,
      currentLng,
      profile.homeZone.lat,
      profile.homeZone.lng,
      profile.homeZone.gridSize
    );

    if (isNearHome && profile.homeZone.tag !== currentZone) {
      zones.push(profile.homeZone.tag);
    }
  }

  // TODO: Add neighboring zones if user is near boundary (Phase 2)

  logger.info('Resolved user zones', {
    userId,
    location: { lat: currentLat, lng: currentLng },
    zones,
  });

  return zones;
}

/**
 * Get user interaction history
 * 
 * Retrieves recent user interactions for personalization.
 * 
 * @param userId - User ID
 * @param limit - Max interactions to return
 * @returns Array of interaction memories
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserInteractionHistory(
  userId: string,
  limit: number = 50
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const userTag = getUserContainerTag(userId);

  try {
    const results = await searchMemories(
      'interaction',
      [userTag],
      {
        AND: [{ key: 'type', value: 'user_interaction', filterType: 'array_contains' }],
      },
      limit
    );

    logger.info('User interaction history retrieved', {
      userId,
      count: results.length,
    });

    return results;
  } catch (error) {
    logger.error('Failed to get user interaction history', { userId, error });
    return [];
  }
}

/**
 * Get user favorites
 * 
 * Retrieves businesses the user has favorited.
 * 
 * @param userId - User ID
 * @returns Array of favorite business IDs
 */
export async function getUserFavorites(userId: string): Promise<string[]> {
  const userTag = getUserContainerTag(userId);

  try {
    const results = await searchMemories(
      'favorite',
      [userTag],
      {
        AND: [
          { key: 'type', value: 'user_interaction', filterType: 'array_contains' },
          { key: 'interactionType', value: 'favorite', filterType: 'array_contains' },
        ],
      },
      100
    );

    const favorites = results
      .map((r) => r.metadata?.businessId)
      .filter((id): id is string => !!id);

    logger.info('User favorites retrieved', {
      userId,
      count: favorites.length,
    });

    return favorites;
  } catch (error) {
    logger.error('Failed to get user favorites', { userId, error });
    return [];
  }
}
