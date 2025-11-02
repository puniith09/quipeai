import { SignJWT, jwtVerify } from 'jose';
import { logger } from '@/lib/logger';

const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
  return new TextEncoder().encode(secret);
};

export interface UserPayload {
  userId: string;
  verificationId: string;
  iat?: number;
  exp?: number;
}

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

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const secret = getJWTSecret();
    
    const { payload } = await jwtVerify(token, secret);
    
    if (
      typeof payload.userId === 'string' &&
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

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

export function generateUserId(phoneNumber: string): string {
  return `user_${Buffer.from(phoneNumber).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;
}
