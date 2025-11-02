import { NextRequest, NextResponse } from 'next/server';
import { deleteAuthCookieInResponse } from '@/lib/auth/cookies';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/logout
 * Clears the authentication cookie
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('User logging out');
    
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
    
    // Delete the HttpOnly cookie
    deleteAuthCookieInResponse(response);
    
    return response;
    
  } catch (error) {
    logger.error('Error during logout:', error);
    
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
