import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export interface User {
  id: string;
  phoneNumber: string;
  createdAt: Date;
  lastLogin: Date;
  sessionCount: number;
}

export async function createOrUpdateUser(
  userId: string,
  phoneNumber: string,
  verificationId: string
): Promise<User> {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber },
    });
    
    if (existingUser) {
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          lastLogin: new Date(),
          sessionCount: { increment: 1 },
        },
      });
      
      logger.info('User updated:', updatedUser.id);
      return updatedUser;
    } else {
      const newUser = await prisma.user.create({
        data: {
          id: userId,
          phoneNumber,
          sessionCount: 1,
          lastLogin: new Date(),
        },
      });
      
      logger.info('New user created:', newUser.id);
      return newUser;
    }
  } catch (error) {
    logger.error('Error in createOrUpdateUser:', error);
    throw error;
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return user;
  } catch (error) {
    logger.error('Error in getUserById:', error);
    return null;
  }
}

export async function getUserByPhone(phoneNumber: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });
    return user;
  } catch (error) {
    logger.error('Error in getUserByPhone:', error);
    return null;
  }
}

export async function deleteUser(userId: string): Promise<boolean> {
  try {
    await prisma.user.delete({
      where: { id: userId },
    });
    logger.info('User deleted:', userId);
    return true;
  } catch (error) {
    logger.error('Error deleting user:', error);
    return false;
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    return await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Error getting all users:', error);
    return [];
  }
}

export async function getUserCount(): Promise<number> {
  try {
    return await prisma.user.count();
  } catch (error) {
    logger.error('Error getting user count:', error);
    return 0;
  }
}

export async function getActiveUsers(days: number = 7): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return await prisma.user.count({
      where: {
        lastLogin: {
          gte: cutoffDate,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting active users:', error);
    return 0;
  }
}
