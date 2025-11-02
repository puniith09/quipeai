
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

const activeZonesCache = new Map<string, ZoneInfo>();

export function getOrCreateZone(
  lat: number,
  lng: number,
  gridSize: GridSize,
  date?: Date
): ZoneInfo {
  const targetDate = date || new Date();
  const hourWindow = getCurrentHourWindow(targetDate);
  const tag = getZoneContainerTag(lat, lng, gridSize, targetDate, hourWindow);

  if (activeZonesCache.has(tag)) {
    const cached = activeZonesCache.get(tag)!;
    logger.info('Zone found in cache', { tag });
    return cached;
  }

  const dateStr = targetDate.toISOString().split('T')[0];
  
  const expiresAt = new Date(targetDate);
  expiresAt.setUTCHours(hourWindow + 6, 0, 0, 0);
  if (expiresAt <= targetDate) {
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

export function prepareNextWindow(zones: ZoneInfo[]): ZoneInfo[] {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const nextWindowZones: ZoneInfo[] = [];

  for (const zone of zones) {
    if (zone.expiresAt <= oneHourFromNow) {
      const nextWindow = getNextHourWindow(zone.expiresAt);
      
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
      const result = await bulkDeleteByTags([zone.tag]);

      if (result.success) {
        deletedZones.push(zone.tag);
        totalDeleted += result.deletedCount;

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

export async function softMergeToAggregate(
  zoneTag: string,
  aggregateTag: string
): Promise<boolean> {
  
  logger.info('Soft merge to aggregate (not implemented)', {
    zoneTag,
    aggregateTag,
  });

  return true;
}

export function getActiveZonesCount(): number {
  return activeZonesCache.size;
}

export function getAllActiveZones(): ZoneInfo[] {
  return Array.from(activeZonesCache.values());
}

export function clearZoneCache(): number {
  const count = activeZonesCache.size;
  activeZonesCache.clear();
  logger.info('Zone cache cleared', { count });
  return count;
}

export function getZoneFromCache(tag: string): ZoneInfo | undefined {
  return activeZonesCache.get(tag);
}

export function removeZoneFromCache(tag: string): boolean {
  const removed = activeZonesCache.delete(tag);
  if (removed) {
    logger.info('Zone removed from cache', { tag });
  }
  return removed;
}

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

  const deleteResult = await deleteExpiredZones(now);

  const activeZones = getAllActiveZones();
  const preparedZones = prepareNextWindow(activeZones);

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
