import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookieInResponse } from '@/lib/auth/cookies';
import { verifyToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/set-session
 * Sets the authentication cookie from a provided token
 * Used after server-side authentication to set client-side cookie
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }
    
    // Verify the token is valid
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    // Create response - only return userId (no phone number)
    const response = NextResponse.json({
      success: true,
      message: 'Session cookie set successfully',
      user: {
        id: payload.userId,
      },
    });
    
    // Set the cookie in the response
    setAuthCookieInResponse(response, token);
    
    logger.info('🍪 Session cookie set successfully', { userId: payload.userId });
    
    return response;
  } catch (error) {
    logger.error('Error setting session cookie:', error);
    return NextResponse.json(
      { error: 'Failed to set session cookie' },
      { status: 500 }
    );
  }
}
