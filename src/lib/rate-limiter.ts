import { logger } from '@/lib/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private cache = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  check(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.cache.get(identifier);

    if (!entry || now >= entry.resetAt) {
      this.cache.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    if (entry.count < maxRequests) {
      entry.count++;
      return true;
    }

    logger.warn(`Rate limit exceeded for: ${identifier}`);
    return false;
  }

  getRemaining(identifier: string, maxRequests: number): number {
    const entry = this.cache.get(identifier);
    if (!entry || Date.now() >= entry.resetAt) {
      return maxRequests;
    }
    return Math.max(0, maxRequests - entry.count);
  }

  getResetTime(identifier: string): number {
    const entry = this.cache.get(identifier);
    if (!entry) return 0;
    
    const now = Date.now();
    if (now >= entry.resetAt) return 0;
    
    return Math.ceil((entry.resetAt - now) / 1000);
  }

  reset(identifier: string): void {
    this.cache.delete(identifier);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.resetAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  getSize(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const rateLimiter = new RateLimiter();

export const RATE_LIMITS = {
  OTP_SEND: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
    message: 'Too many OTP requests. Please try again in {time}.',
  },
  
  OTP_VERIFY: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Too many verification attempts. Please try again in {time}.',
  },
  
  API_GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    message: 'Too many requests. Please slow down.',
  },
} as const;

export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}
