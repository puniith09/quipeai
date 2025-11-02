/**
 * Zone Utilities
 * 
 * Handles spatiotemporal zone calculations for QuipeAI's adaptive grid system.
 * Provides functions for grid size calculation, coordinate normalization, and
 * container tag generation.
 */

import { logger } from '@/lib/logger';

/**
 * Grid size options for adaptive granularity
 */
export type GridSize = '500m' | '1km' | '2km' | '5km';

/**
 * Grid size to meters conversion
 */
const GRID_SIZE_METERS: Record<GridSize, number> = {
  '500m': 500,
  '1km': 1000,
  '2km': 2000,
  '5km': 5000,
};

/**
 * Grid size to degrees conversion (approximate at equator)
 * 1 degree ≈ 111km
 */
const GRID_SIZE_DEGREES: Record<GridSize, number> = {
  '500m': 0.0045, // ~500m
  '1km': 0.009,   // ~1km
  '2km': 0.018,   // ~2km
  '5km': 0.045,   // ~5km
};

/**
 * Hour window duration in hours
 */
export const HOUR_WINDOW_DURATION = 6;

/**
 * Calculate adaptive grid size based on location density
 * 
 * Strategy:
 * - High density (urban centers): 500m for fine-grained local discovery
 * - Medium density (suburbs): 1km for neighborhood-level search
 * - Low density (rural): 2km-5km for broader coverage
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @param density - Optional density hint (businesses per km²)
 * @returns Grid size
 */
export function calculateAdaptiveGridSize(
  lat: number,
  lng: number,
  density?: number
): GridSize {
  // If density is provided, use it
  if (density !== undefined) {
    if (density > 100) return '500m'; // High density
    if (density > 50) return '1km';   // Medium-high density
    if (density > 20) return '2km';   // Medium density
    return '5km';                     // Low density
  }

  // Default heuristic: Use 1km for most cases
  // In production, this would query a density database or use ML
  logger.info('Using default 1km grid size', { lat, lng });
  return '1km';
}

/**
 * Normalize coordinates to grid center
 * 
 * Snaps a coordinate to the center of its grid cell.
 * This ensures consistent zone identification regardless of
 * exact user position within the cell.
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @param gridSize - Grid size
 * @returns Normalized coordinates
 */
export function normalizeToGridCenter(
  lat: number,
  lng: number,
  gridSize: GridSize
): { lat: number; lng: number } {
  const gridDegrees = GRID_SIZE_DEGREES[gridSize];

  // Snap to grid
  const normalizedLat = Math.floor(lat / gridDegrees) * gridDegrees + gridDegrees / 2;
  const normalizedLng = Math.floor(lng / gridDegrees) * gridDegrees + gridDegrees / 2;

  // Round to 3 decimal places (~111m precision)
  const roundedLat = Math.round(normalizedLat * 1000) / 1000;
  const roundedLng = Math.round(normalizedLng * 1000) / 1000;

  logger.info('Normalized coordinates to grid center', {
    original: { lat, lng },
    normalized: { lat: roundedLat, lng: roundedLng },
    gridSize,
  });

  return {
    lat: roundedLat,
    lng: roundedLng,
  };
}

/**
 * Get current hour window
 * 
 * Calculates the current 6-hour window based on UTC time.
 * Windows: 00-06, 06-12, 12-18, 18-24
 * 
 * @param date - Optional date (defaults to now)
 * @returns Hour window start (0, 6, 12, or 18)
 */
export function getCurrentHourWindow(date: Date = new Date()): number {
  const hour = date.getUTCHours();
  const windowStart = Math.floor(hour / HOUR_WINDOW_DURATION) * HOUR_WINDOW_DURATION;
  
  logger.info('Calculated hour window', {
    currentHour: hour,
    windowStart,
    windowEnd: windowStart + HOUR_WINDOW_DURATION,
  });

  return windowStart;
}

/**
 * Get next hour window
 * 
 * @param date - Optional date (defaults to now)
 * @returns Next hour window start
 */
export function getNextHourWindow(date: Date = new Date()): number {
  const currentWindow = getCurrentHourWindow(date);
  const nextWindow = (currentWindow + HOUR_WINDOW_DURATION) % 24;
  
  return nextWindow;
}

/**
 * Generate zone container tag
 * 
 * Format: zone_{lat}_{lng}_{gridSize}_{date}_{hourWindow}
 * Example: zone_17.485_78.366_1km_2025-10-23_14
 * 
 * @param lat - Latitude (should be normalized)
 * @param lng - Longitude (should be normalized)
 * @param gridSize - Grid size
 * @param date - Optional date (defaults to now)
 * @param hourWindow - Optional hour window (defaults to current)
 * @returns Container tag string
 */
export function getZoneContainerTag(
  lat: number,
  lng: number,
  gridSize: GridSize,
  date?: Date,
  hourWindow?: number
): string {
  const targetDate = date || new Date();
  const window = hourWindow !== undefined ? hourWindow : getCurrentHourWindow(targetDate);
  
  // Format date as YYYY-MM-DD
  const dateStr = targetDate.toISOString().split('T')[0];
  
  // Format: zone_{lat}_{lng}_{gridSize}_{date}_{hourWindow}
  const tag = `zone_${lat}_${lng}_${gridSize}_${dateStr}_${window}`;
  
  logger.info('Generated zone container tag', {
    lat,
    lng,
    gridSize,
    date: dateStr,
    hourWindow: window,
    tag,
  });

  return tag;
}

/**
 * Parse zone container tag
 * 
 * Extracts components from a zone container tag.
 * 
 * @param tag - Zone container tag
 * @returns Parsed components or null if invalid
 */
export function parseZoneContainerTag(tag: string): {
  lat: number;
  lng: number;
  gridSize: GridSize;
  date: string;
  hourWindow: number;
} | null {
  const match = tag.match(/^zone_(-?\d+\.?\d*)_(-?\d+\.?\d*)_(500m|1km|2km|5km)_(\d{4}-\d{2}-\d{2})_(\d+)$/);
  
  if (!match) {
    logger.warn('Invalid zone container tag format', { tag });
    return null;
  }

  return {
    lat: parseFloat(match[1]),
    lng: parseFloat(match[2]),
    gridSize: match[3] as GridSize,
    date: match[4],
    hourWindow: parseInt(match[5], 10),
  };
}

/**
 * Check if a zone is expired
 * 
 * A zone is expired if its hour window has passed.
 * 
 * @param tag - Zone container tag
 * @param currentDate - Optional current date (defaults to now)
 * @returns True if expired
 */
export function isZoneExpired(tag: string, currentDate: Date = new Date()): boolean {
  const parsed = parseZoneContainerTag(tag);
  
  if (!parsed) {
    logger.warn('Cannot check expiry for invalid tag', { tag });
    return false;
  }

  const zoneDate = new Date(parsed.date);
  const zoneEndHour = parsed.hourWindow + HOUR_WINDOW_DURATION;
  
  // Set the end time of the zone window
  zoneDate.setUTCHours(zoneEndHour, 0, 0, 0);
  
  const isExpired = currentDate >= zoneDate;
  
  logger.info('Checked zone expiry', {
    tag,
    zoneEndTime: zoneDate.toISOString(),
    currentTime: currentDate.toISOString(),
    isExpired,
  });

  return isExpired;
}

/**
 * Get zone for coordinates
 * 
 * Convenience function that combines grid calculation, normalization,
 * and tag generation.
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @param density - Optional density hint
 * @param date - Optional date (defaults to now)
 * @returns Zone container tag
 */
export function getZoneForCoordinates(
  lat: number,
  lng: number,
  density?: number,
  date?: Date
): string {
  const gridSize = calculateAdaptiveGridSize(lat, lng, density);
  const normalized = normalizeToGridCenter(lat, lng, gridSize);
  const tag = getZoneContainerTag(normalized.lat, normalized.lng, gridSize, date);
  
  return tag;
}

/**
 * Get neighboring zones
 * 
 * Returns container tags for the 8 surrounding zones plus the center zone.
 * Useful for boundary searches.
 * 
 * @param lat - Latitude (should be normalized)
 * @param lng - Longitude (should be normalized)
 * @param gridSize - Grid size
 * @param date - Optional date (defaults to now)
 * @returns Array of 9 zone container tags (center + 8 neighbors)
 */
export function getNeighboringZones(
  lat: number,
  lng: number,
  gridSize: GridSize,
  date?: Date
): string[] {
  const gridDegrees = GRID_SIZE_DEGREES[gridSize];
  const zones: string[] = [];

  // Generate tags for 3x3 grid (center + 8 neighbors)
  for (let latOffset = -1; latOffset <= 1; latOffset++) {
    for (let lngOffset = -1; lngOffset <= 1; lngOffset++) {
      const neighborLat = Math.round((lat + latOffset * gridDegrees) * 1000) / 1000;
      const neighborLng = Math.round((lng + lngOffset * gridDegrees) * 1000) / 1000;
      
      const tag = getZoneContainerTag(neighborLat, neighborLng, gridSize, date);
      zones.push(tag);
    }
  }

  logger.info('Generated neighboring zones', {
    center: { lat, lng },
    gridSize,
    zoneCount: zones.length,
  });

  return zones;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * 
 * @param lat1 - First latitude
 * @param lng1 - First longitude
 * @param lat2 - Second latitude
 * @param lng2 - Second longitude
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  return distance;
}

/**
 * Check if coordinates are within a zone's bounds
 * 
 * @param userLat - User latitude
 * @param userLng - User longitude
 * @param zoneLat - Zone center latitude
 * @param zoneLng - Zone center longitude
 * @param gridSize - Grid size
 * @returns True if within bounds
 */
export function isWithinZone(
  userLat: number,
  userLng: number,
  zoneLat: number,
  zoneLng: number,
  gridSize: GridSize
): boolean {
  const distance = calculateDistance(userLat, userLng, zoneLat, zoneLng);
  const maxDistance = GRID_SIZE_METERS[gridSize] / 2;

  return distance <= maxDistance;
}
