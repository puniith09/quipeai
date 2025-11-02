/**
 * JWT Authentication Utilities
 * Handles token generation and verification using jose library
 */

import { SignJWT, jwtVerify } from 'jose';
import { logger } from '@/lib/logger';

// Get JWT secret from environment (server-side only)
const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
  return new TextEncoder().encode(secret);
};

export interface UserPayload {
  userId: string;
  phoneNumber: string;
  verificationId: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for authenticated user
 * @param payload User data to encode in token
 * @param expiresIn Token expiration time (default: 7 days)
 */
export async function generateToken(
  payload: Omit<UserPayload, 'iat' | 'exp'>,
  expiresIn: string = '7d'
): Promise<string> {
  try {
    const secret = getJWTSecret();
    
    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secret);

    logger.info('JWT token generated for user:', payload.userId);
    return token;
  } catch (error) {
    logger.error('Error generating JWT token:', error);
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * Verify and decode a JWT token
 * @param token JWT token string
 * @returns Decoded user payload or null if invalid
 */
export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const secret = getJWTSecret();
    
    const { payload } = await jwtVerify(token, secret);
    
    // Validate required fields exist
    if (
      typeof payload.userId === 'string' &&
      typeof payload.phoneNumber === 'string' &&
      typeof payload.verificationId === 'string'
    ) {
      return payload as unknown as UserPayload;
    }
    
    return null;
  } catch (error) {
    logger.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader Authorization header value
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  // Support both "Bearer <token>" and direct token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

/**
 * Generate a unique user ID from phone number
 * @param phoneNumber Phone number in international format
 */
export function generateUserId(phoneNumber: string): string {
  // Create a consistent user ID from phone number
  // In production, you might want to use a database-generated ID
  return `user_${Buffer.from(phoneNumber).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;
}
