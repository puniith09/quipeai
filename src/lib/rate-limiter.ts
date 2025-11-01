/**
 * Simple in-memory rate limiter
 * Tracks request counts per identifier (phone number, IP, etc.)
 * Automatically cleans up expired entries
 */

import { logger } from '@/lib/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number; // Timestamp when the limit resets
}

class RateLimiter {
  private cache = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request should be allowed
   * @param identifier - Unique identifier (e.g., phone number, IP address)
   * @param maxRequests - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if allowed, false if rate limited
   */
  check(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.cache.get(identifier);

    // No previous requests or window expired
    if (!entry || now >= entry.resetAt) {
      this.cache.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    // Within rate limit
    if (entry.count < maxRequests) {
      entry.count++;
      return true;
    }

    // Rate limited
    logger.warn(`Rate limit exceeded for: ${identifier}`);
    return false;
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemaining(identifier: string, maxRequests: number): number {
    const entry = this.cache.get(identifier);
    if (!entry || Date.now() >= entry.resetAt) {
      return maxRequests;
    }
    return Math.max(0, maxRequests - entry.count);
  }

  /**
   * Get time until rate limit resets (in seconds)
   */
  getResetTime(identifier: string): number {
    const entry = this.cache.get(identifier);
    if (!entry) return 0;
    
    const now = Date.now();
    if (now >= entry.resetAt) return 0;
    
    return Math.ceil((entry.resetAt - now) / 1000);
  }

  /**
   * Manually reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.cache.delete(identifier);
  }

  /**
   * Clean up expired entries
   */
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

  /**
   * Get current cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Stop cleanup interval (for cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Rate limit configurations
export const RATE_LIMITS = {
  // OTP sending: 3 requests per phone per hour
  OTP_SEND: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many OTP requests. Please try again in {time}.',
  },
  
  // OTP verification: 5 attempts per phone per 15 minutes
  OTP_VERIFY: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many verification attempts. Please try again in {time}.',
  },
  
  // General API: 100 requests per IP per minute
  API_GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests. Please slow down.',
  },
} as const;

/**
 * Format time remaining for user-friendly message
 */
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
