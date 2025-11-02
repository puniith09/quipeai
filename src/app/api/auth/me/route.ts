import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookie } from '@/lib/auth/cookies';
import { verifyToken } from '@/lib/auth/jwt';
import { getUserById } from '@/lib/auth/user-store';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/me
 * Returns the currently authenticated user from the HttpOnly cookie
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from HttpOnly cookie
    const token = await getAuthCookie();
    
    logger.info('🔐 /api/auth/me called - Token present:', !!token);
    
    if (!token) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }
    
    // Verify the token
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }
    
    // Get user from database
    const user = await getUserById(payload.userId);
    
    if (!user) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        sessionCount: user.sessionCount,
        lastLogin: user.lastLogin.toISOString(),
      },
    });
    
  } catch (error) {
    logger.error('Error checking auth status:', error);
    
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 }
    );
  }
}
