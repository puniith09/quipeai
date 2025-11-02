
import { logger } from '@/lib/logger';

export type GridSize = '500m' | '1km' | '2km' | '5km';

const GRID_SIZE_METERS: Record<GridSize, number> = {
  '500m': 500,
  '1km': 1000,
  '2km': 2000,
  '5km': 5000,
};

const GRID_SIZE_DEGREES: Record<GridSize, number> = {
  '500m': 0.0045, // ~500m
  '1km': 0.009,   // ~1km
  '2km': 0.018,   // ~2km
  '5km': 0.045,   // ~5km
};

export const HOUR_WINDOW_DURATION = 6;

export function calculateAdaptiveGridSize(
  lat: number,
  lng: number,
  density?: number
): GridSize {
  if (density !== undefined) {
    if (density > 100) return '500m'; // High density
    if (density > 50) return '1km';   // Medium-high density
    if (density > 20) return '2km';   // Medium density
    return '5km';                     // Low density
  }

  logger.info('Using default 1km grid size', { lat, lng });
  return '1km';
}

export function normalizeToGridCenter(
  lat: number,
  lng: number,
  gridSize: GridSize
): { lat: number; lng: number } {
  const gridDegrees = GRID_SIZE_DEGREES[gridSize];

  const normalizedLat = Math.floor(lat / gridDegrees) * gridDegrees + gridDegrees / 2;
  const normalizedLng = Math.floor(lng / gridDegrees) * gridDegrees + gridDegrees / 2;

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

export function getNextHourWindow(date: Date = new Date()): number {
  const currentWindow = getCurrentHourWindow(date);
  const nextWindow = (currentWindow + HOUR_WINDOW_DURATION) % 24;
  
  return nextWindow;
}

export function getZoneContainerTag(
  lat: number,
  lng: number,
  gridSize: GridSize,
  date?: Date,
  hourWindow?: number
): string {
  const targetDate = date || new Date();
  const window = hourWindow !== undefined ? hourWindow : getCurrentHourWindow(targetDate);
  
  const dateStr = targetDate.toISOString().split('T')[0];
  
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

export function isZoneExpired(tag: string, currentDate: Date = new Date()): boolean {
  const parsed = parseZoneContainerTag(tag);
  
  if (!parsed) {
    logger.warn('Cannot check expiry for invalid tag', { tag });
    return false;
  }

  const zoneDate = new Date(parsed.date);
  const zoneEndHour = parsed.hourWindow + HOUR_WINDOW_DURATION;
  
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

export function getNeighboringZones(
  lat: number,
  lng: number,
  gridSize: GridSize,
  date?: Date
): string[] {
  const gridDegrees = GRID_SIZE_DEGREES[gridSize];
  const zones: string[] = [];

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
