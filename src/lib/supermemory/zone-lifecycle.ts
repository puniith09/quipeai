/**
 * Zone Lifecycle Management
 * 
 * Handles lazy loading, expiry, and lifecycle operations for spatiotemporal zones.
 * Implements the ephemeral zone strategy with 6-hour windows.
 */

import { logger } from '@/lib/logger';
import { bulkDeleteByTags } from './client';
import {
  getZoneContainerTag,
  parseZoneContainerTag,
  isZoneExpired,
  getNextHourWindow,
  getCurrentHourWindow,
  type GridSize,
} from './zone-utils';

/**
 * Zone information interface
 */
export interface ZoneInfo {
  tag: string;
  lat: number;
  lng: number;
  gridSize: GridSize;
  date: string;
  hourWindow: number;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * In-memory cache of active zones
 * In production, this would be Redis or a distributed cache
 */
const activeZonesCache = new Map<string, ZoneInfo>();

/**
 * Get or create a zone (lazy loading)
 * 
 * Checks if a zone exists in the cache. If not, creates a new zone record.
 * This implements the "lazy loading" pattern - zones are only created when
 * a user arrives, not pre-computed.
 * 
 * @param lat - Normalized latitude
 * @param lng - Normalized longitude
 * @param gridSize - Grid size
 * @param date - Optional date (defaults to now)
 * @returns Zone information
 */
export function getOrCreateZone(
  lat: number,
  lng: number,
  gridSize: GridSize,
  date?: Date
): ZoneInfo {
  const targetDate = date || new Date();
  const hourWindow = getCurrentHourWindow(targetDate);
  const tag = getZoneContainerTag(lat, lng, gridSize, targetDate, hourWindow);

  // Check cache first
  if (activeZonesCache.has(tag)) {
    const cached = activeZonesCache.get(tag)!;
    logger.info('Zone found in cache', { tag });
    return cached;
  }

  // Create new zone
  const dateStr = targetDate.toISOString().split('T')[0];
  
  // Calculate expiry time (end of hour window)
  const expiresAt = new Date(targetDate);
  expiresAt.setUTCHours(hourWindow + 6, 0, 0, 0);
  if (expiresAt <= targetDate) {
    // If window end is in the past, use next day's window
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);
  }

  const zoneInfo: ZoneInfo = {
    tag,
    lat,
    lng,
    gridSize,
    date: dateStr,
    hourWindow,
    createdAt: targetDate,
    expiresAt,
  };

  // Add to cache
  activeZonesCache.set(tag, zoneInfo);

  logger.info('Zone created (lazy load)', {
    tag,
    lat,
    lng,
    gridSize,
    hourWindow,
    expiresAt: expiresAt.toISOString(),
  });

  return zoneInfo;
}

/**
 * Prepare next hour window (cold start prevention)
 * 
 * Creates zone records for the next hour window approximately 1 hour before
 * the current window expires. This prevents cold starts when windows roll over.
 * 
 * @param zones - Current active zones
 * @returns Array of newly created next-window zones
 */
export function prepareNextWindow(zones: ZoneInfo[]): ZoneInfo[] {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const nextWindowZones: ZoneInfo[] = [];

  for (const zone of zones) {
    // Check if zone expires within the next hour
    if (zone.expiresAt <= oneHourFromNow) {
      const nextWindow = getNextHourWindow(zone.expiresAt);
      
      // Create next window zone
      const nextZoneDate = new Date(zone.expiresAt);
      const nextZone = getOrCreateZone(
        zone.lat,
        zone.lng,
        zone.gridSize,
        nextZoneDate
      );

      nextWindowZones.push(nextZone);

      logger.info('Prepared next window zone', {
        currentZone: zone.tag,
        nextZone: nextZone.tag,
        expiresIn: Math.round((zone.expiresAt.getTime() - now.getTime()) / 1000 / 60),
      });
    }
  }

  return nextWindowZones;
}

/**
 * Find expired zones
 * 
 * Scans the active zones cache and returns zones that have expired.
 * 
 * @param currentDate - Optional current date (defaults to now)
 * @returns Array of expired zone info
 */
export function findExpiredZones(currentDate?: Date): ZoneInfo[] {
  const now = currentDate || new Date();
  const expired: ZoneInfo[] = [];

  for (const [tag, zoneInfo] of activeZonesCache.entries()) {
    if (isZoneExpired(tag, now)) {
      expired.push(zoneInfo);
    }
  }

  logger.info('Found expired zones', {
    count: expired.length,
    zones: expired.map((z) => z.tag),
  });

  return expired;
}

/**
 * Delete expired zones
 * 
 * Removes expired zones from Supermemory and clears them from cache.
 * This is the core cleanup function that runs on a schedule (Vercel Cron).
 * 
 * @param currentDate - Optional current date (defaults to now)
 * @returns Cleanup result
 */
export async function deleteExpiredZones(currentDate?: Date): Promise<{
  success: boolean;
  deletedCount: number;
  deletedZones: string[];
  errors: string[];
}> {
  const expired = findExpiredZones(currentDate);
  const deletedZones: string[] = [];
  const errors: string[] = [];
  let totalDeleted = 0;

  logger.info('Starting expired zone deletion', { expiredCount: expired.length });

  for (const zone of expired) {
    try {
      // Delete from Supermemory
      const result = await bulkDeleteByTags([zone.tag]);

      if (result.success) {
        deletedZones.push(zone.tag);
        totalDeleted += result.deletedCount;

        // Remove from cache
        activeZonesCache.delete(zone.tag);

        logger.info('Expired zone deleted', {
          zone: zone.tag,
          deletedCount: result.deletedCount,
        });
      } else {
        errors.push(`Failed to delete ${zone.tag}`);
        logger.error('Failed to delete zone', { zone: zone.tag });
      }
    } catch (error) {
      errors.push(`Error deleting ${zone.tag}: ${error}`);
      logger.error('Error during zone deletion', { zone: zone.tag, error });
    }
  }

  const success = errors.length === 0;

  logger.info('Expired zone deletion completed', {
    success,
    deletedCount: totalDeleted,
    deletedZones: deletedZones.length,
    errors: errors.length,
  });

  return {
    success,
    deletedCount: totalDeleted,
    deletedZones,
    errors,
  };
}

/**
 * Soft merge zone to aggregate (future feature)
 * 
 * When a zone expires, optionally merge its high-value insights into
 * a longer-lived aggregate container (e.g., neighborhood_hyderabad_banjara_hills).
 * 
 * This is a placeholder for Phase 2 feature.
 * 
 * @param zoneTag - Zone to merge
 * @param aggregateTag - Target aggregate container
 * @returns Success status
 */
export async function softMergeToAggregate(
  zoneTag: string,
  aggregateTag: string
): Promise<boolean> {
  // TODO: Implement in Phase 2
  // 1. Query top-rated businesses from expiring zone
  // 2. Copy high-value memories to aggregate container
  // 3. Add aggregate tag to existing memories
  
  logger.info('Soft merge to aggregate (not implemented)', {
    zoneTag,
    aggregateTag,
  });

  return true;
}

/**
 * Get active zones count
 * 
 * @returns Number of active zones in cache
 */
export function getActiveZonesCount(): number {
  return activeZonesCache.size;
}

/**
 * Get all active zones
 * 
 * @returns Array of all active zone info
 */
export function getAllActiveZones(): ZoneInfo[] {
  return Array.from(activeZonesCache.values());
}

/**
 * Clear zone cache (for testing)
 * 
 * @returns Number of zones cleared
 */
export function clearZoneCache(): number {
  const count = activeZonesCache.size;
  activeZonesCache.clear();
  logger.info('Zone cache cleared', { count });
  return count;
}

/**
 * Get zone info from cache
 * 
 * @param tag - Zone container tag
 * @returns Zone info or undefined
 */
export function getZoneFromCache(tag: string): ZoneInfo | undefined {
  return activeZonesCache.get(tag);
}

/**
 * Remove zone from cache
 * 
 * @param tag - Zone container tag
 * @returns True if removed
 */
export function removeZoneFromCache(tag: string): boolean {
  const removed = activeZonesCache.delete(tag);
  if (removed) {
    logger.info('Zone removed from cache', { tag });
  }
  return removed;
}

/**
 * Cleanup job scheduler
 * 
 * Main function to be called by Vercel Cron or other scheduler.
 * Runs the full cleanup cycle: find expired, delete, prepare next window.
 * 
 * @returns Cleanup report
 */
export async function runCleanupCycle(): Promise<{
  timestamp: string;
  deletedZones: number;
  preparedZones: number;
  activeZones: number;
  success: boolean;
  errors: string[];
}> {
  logger.info('Starting cleanup cycle');

  const now = new Date();

  // Step 1: Delete expired zones
  const deleteResult = await deleteExpiredZones(now);

  // Step 2: Prepare next window for active zones
  const activeZones = getAllActiveZones();
  const preparedZones = prepareNextWindow(activeZones);

  // Step 3: Generate report
  const report = {
    timestamp: now.toISOString(),
    deletedZones: deleteResult.deletedCount,
    preparedZones: preparedZones.length,
    activeZones: getActiveZonesCount(),
    success: deleteResult.success,
    errors: deleteResult.errors,
  };

  logger.info('Cleanup cycle completed', report);

  return report;
}
