/**
 * User Store - Simple in-memory user storage
 * In production, replace this with a database (PostgreSQL, MongoDB, etc.)
 */

import { logger } from '@/lib/logger';

export interface User {
  id: string;
  phoneNumber: string;
  verificationId: string;
  createdAt: Date;
  lastLogin: Date;
  sessionCount: number;
}

// In-memory store (replace with database in production)
const userStore = new Map<string, User>();

/**
 * Create or update a user in the store
 */
export async function createOrUpdateUser(
  userId: string,
  phoneNumber: string,
  verificationId: string
): Promise<User> {
  const existingUser = userStore.get(userId);
  
  if (existingUser) {
    // Update existing user
    existingUser.lastLogin = new Date();
    existingUser.sessionCount += 1;
    existingUser.verificationId = verificationId;
    
    logger.info('User updated:', userId);
    return existingUser;
  } else {
    // Create new user
    const newUser: User = {
      id: userId,
      phoneNumber,
      verificationId,
      createdAt: new Date(),
      lastLogin: new Date(),
      sessionCount: 1,
    };
    
    userStore.set(userId, newUser);
    logger.info('New user created:', userId);
    return newUser;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const user = userStore.get(userId);
  return user || null;
}

/**
 * Get user by phone number
 */
export async function getUserByPhone(phoneNumber: string): Promise<User | null> {
  for (const user of userStore.values()) {
    if (user.phoneNumber === phoneNumber) {
      return user;
    }
  }
  return null;
}

/**
 * Delete user (for testing/cleanup)
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const deleted = userStore.delete(userId);
  if (deleted) {
    logger.info('User deleted:', userId);
  }
  return deleted;
}

/**
 * Get all users (admin function)
 */
export async function getAllUsers(): Promise<User[]> {
  return Array.from(userStore.values());
}

/**
 * Get user count
 */
export function getUserCount(): number {
  return userStore.size;
}
