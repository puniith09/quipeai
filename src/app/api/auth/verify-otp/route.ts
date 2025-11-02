import { NextRequest, NextResponse } from 'next/server';
import Prelude from '@prelude.so/sdk';
import { logger } from '@/lib/logger';
import { generateToken, generateUserId } from '@/lib/auth/jwt';
import { createOrUpdateUser } from '@/lib/auth/user-store';
import { setAuthCookieInResponse } from '@/lib/auth/cookies';
import { rateLimiter, RATE_LIMITS, formatTimeRemaining } from '@/lib/rate-limiter';

interface VerifyOTPRequest {
  phoneNumber: string;
  code: string;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.PRELUDE_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Prelude API key not configured' },
        { status: 500 }
      );
    }

    const body: VerifyOTPRequest = await request.json();
    
    if (!body.phoneNumber || typeof body.phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: phoneNumber is required' },
        { status: 400 }
      );
    }

    if (!body.code || typeof body.code !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: code is required' },
        { status: 400 }
      );
    }

    const phoneNumber = body.phoneNumber.trim();
    if (!phoneNumber.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must include country code (e.g., +1234567890)' },
        { status: 400 }
      );
    }

    const rateLimitKey = `otp:verify:${phoneNumber}`;
    const isAllowed = rateLimiter.check(
      rateLimitKey,
      RATE_LIMITS.OTP_VERIFY.maxRequests,
      RATE_LIMITS.OTP_VERIFY.windowMs
    );

    if (!isAllowed) {
      const resetTime = rateLimiter.getResetTime(rateLimitKey);
      const message = RATE_LIMITS.OTP_VERIFY.message.replace(
        '{time}',
        formatTimeRemaining(resetTime)
      );
      
      logger.warn(`Rate limit exceeded for phone verification: ${phoneNumber}`);
      
      return NextResponse.json(
        { 
          error: message,
          retryAfter: resetTime,
        },
        { status: 429 }
      );
    }

    const client = new Prelude({
      apiToken: apiKey,
    });

    logger.info('Verifying OTP for:', phoneNumber);

    const check = await client.verification.check({
      target: {
        type: 'phone_number',
        value: phoneNumber,
      },
      code: body.code.trim(),
    });

    logger.info('OTP verification result:', check.status);

    if (check.status === 'success') {
      const verificationId = check.id || `verify_${Date.now()}`;
      
      const userId = generateUserId(phoneNumber);
      
      const user = await createOrUpdateUser(userId, phoneNumber, verificationId);
      
      const token = await generateToken({
        userId: user.id,
        verificationId: verificationId,
      }, '30d'); // 30 days
      
      logger.info('User authenticated successfully:', {
        userId: user.id,
        sessionCount: user.sessionCount,
      });
      
      const response = NextResponse.json({
        success: true,
        verified: true,
        verificationId: verificationId,
        message: 'Phone number verified successfully!',
        token: token, // Include token for tool handler
        user: {
          id: user.id,
          sessionCount: user.sessionCount,
          lastLogin: user.lastLogin.toISOString(),
        },
      });
      
      setAuthCookieInResponse(response, token);
      
      logger.info('🍪 Setting auth cookie in response', { userId: user.id, tokenLength: token.length });
      
      return response;
    } else if (check.status === 'expired_or_not_found') {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Code expired or not found. Please request a new code.',
      }, { status: 400 });
    } else {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Invalid verification code. Please try again.',
      }, { status: 400 });
    }

  } catch (error) {
    logger.error('Error verifying OTP:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Failed to verify OTP. Please try again.' 
      },
      { status: 500 }
    );
  }
}
