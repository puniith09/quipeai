import { NextRequest, NextResponse } from 'next/server';
import Prelude from '@prelude.so/sdk';
import { logger } from '@/lib/logger';
import { rateLimiter, RATE_LIMITS, formatTimeRemaining } from '@/lib/rate-limiter';

interface SendOTPRequest {
  phoneNumber: string;
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

    const body: SendOTPRequest = await request.json();
    
    if (!body.phoneNumber || typeof body.phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: phoneNumber is required' },
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

    const rateLimitKey = `otp:send:${phoneNumber}`;
    const isAllowed = rateLimiter.check(
      rateLimitKey,
      RATE_LIMITS.OTP_SEND.maxRequests,
      RATE_LIMITS.OTP_SEND.windowMs
    );

    if (!isAllowed) {
      const resetTime = rateLimiter.getResetTime(rateLimitKey);
      const message = RATE_LIMITS.OTP_SEND.message.replace(
        '{time}',
        formatTimeRemaining(resetTime)
      );
      
      logger.warn(`Rate limit exceeded for phone: ${phoneNumber}`);
      
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

    logger.info('Sending OTP to:', phoneNumber);

    const verification = await client.verification.create({
      target: {
        type: 'phone_number',
        value: phoneNumber,
      },
    });

    logger.info('OTP sent successfully:', verification.id);

    return NextResponse.json({
      success: true,
      verificationId: verification.id,
      status: verification.status,
      method: verification.method,
      message: `Verification code sent to ${phoneNumber}`,
    });

  } catch (error) {
    logger.error('Error sending OTP:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Failed to send OTP. Please try again.' 
      },
      { status: 500 }
    );
  }
}
