import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookieInResponse } from '@/lib/auth/cookies';
import { verifyToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (!token || typeof token !== 'string') {
      logger.error('Invalid token format:', typeof token);
      return NextResponse.json(
        { error: 'Valid token string is required' },
        { status: 400 }
      );
    }
    
    logger.info('Verifying token for set-session');
    
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const response = NextResponse.json({
      success: true,
      message: 'Session cookie set successfully',
      user: {
        id: payload.userId,
      },
    });
    
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
