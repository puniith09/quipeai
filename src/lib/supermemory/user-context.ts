
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
  metadata?: Record<string, unknown>;
}

export function getUserContainerTag(userId: string): string {
  return `user_${userId}`;
}

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

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userTag = getUserContainerTag(userId);

  try {
    const results = await searchMemories(
      'User Profile',
      [userTag],
      {
        AND: [{ key: 'type', value: 'user_profile', filterType: 'array_contains' as const }],
      },
      1
    );

    if (results.length === 0) {
      logger.info('User profile not found', { userId });
      return null;
    }

    const result = results[0] as { metadata?: Record<string, unknown> };
    const metadata = (result.metadata || {}) as Record<string, unknown>;
    
    const profile: UserProfile = {
      userId,
      preferences: {
        favoriteCategories: (metadata.favoriteCategories as string[]) || [],
        priceRange: (metadata.priceRange as { min: number; max: number }) || { min: 0, max: 10000 },
        dietaryRestrictions: metadata.dietaryRestrictions as string[] | undefined,
        interests: (metadata.interests as string[]) || [],
      },
      interactions: {
        totalSearches: (metadata.totalSearches as number) || 0,
        totalBookings: (metadata.totalBookings as number) || 0,
        lastActive: (metadata.lastActive as string) || new Date().toISOString(),
      },
      learningData: {
        frequentSearchTerms: (metadata.frequentSearchTerms as string[]) || [],
        preferredBusinessTypes: (metadata.preferredBusinessTypes as string[]) || [],
        avgSpending: (metadata.avgSpending as number) || 0,
      },
    };

    if (metadata.homeZone) {
      profile.homeZone = metadata.homeZone as {
        lat: number;
        lng: number;
        gridSize: GridSize;
        tag: string;
      };
    }

    logger.info('User profile retrieved', { userId });

    return profile;
  } catch (error) {
    logger.error('Failed to get user profile', { userId, error });
    return null;
  }
}

export async function updateUserContext(
  userId: string,
  interaction: UserInteraction
): Promise<boolean> {
  const userTag = getUserContainerTag(userId);

  try {
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


    return true;
  } catch (error) {
    logger.error('Failed to update user context', { userId, error });
    return false;
  }
}

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

export async function resolveUserZone(
  userId: string,
  currentLat: number,
  currentLng: number
): Promise<string[]> {
  const profile = await getUserProfile(userId);
  const currentZone = getZoneForCoordinates(currentLat, currentLng);
  const zones: string[] = [currentZone];

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


  logger.info('Resolved user zones', {
    userId,
    location: { lat: currentLat, lng: currentLng },
    zones,
  });

  return zones;
}

export async function getUserInteractionHistory(
  userId: string,
  limit: number = 50
): Promise<unknown[]> {
  const userTag = getUserContainerTag(userId);

  try {
    const results = await searchMemories(
      'interaction',
      [userTag],
      {
        AND: [{ key: 'type', value: 'user_interaction', filterType: 'array_contains' as const }],
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
      .map((r) => (r as { metadata?: Record<string, unknown> }).metadata?.businessId)
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
