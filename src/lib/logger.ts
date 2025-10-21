/**
 * Development Logger Utility
 * 
 * Automatically logs to console in development but stays silent in production.
 * Use this instead of console.log throughout the app.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.log('Debug info');
 *   logger.info('Info message');
 *   logger.warn('Warning');
 *   logger.error('Error'); // Always shows (even in prod)
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Standard log - only in development
   */
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info log - only in development
   */
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Warning log - only in development
   */
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Error log - ALWAYS shows (even in production)
   * Use for actual errors that need to be caught
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Debug log with emoji prefix - only in development
   */
  debug: (emoji: string, label: string, data?: unknown) => {
    if (isDevelopment) {
      if (data !== undefined) {
        console.log(`${emoji} ${label}:`, data);
      } else {
        console.log(`${emoji} ${label}`);
      }
    }
  },

  /**
   * Group logs together - only in development
   */
  group: (label: string, callback: () => void) => {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  },

  /**
   * Table view for objects/arrays - only in development
   */
  table: (data: unknown) => {
    if (isDevelopment) {
      console.table(data);
    }
  },
};
