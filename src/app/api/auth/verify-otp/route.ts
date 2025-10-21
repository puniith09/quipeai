import { NextRequest, NextResponse } from 'next/server';
import Prelude from '@prelude.so/sdk';
import { logger } from '@/lib/logger';
import { generateToken, generateUserId } from '@/lib/auth/jwt';
import { createOrUpdateUser } from '@/lib/auth/user-store';

interface VerifyOTPRequest {
  phoneNumber: string;
  code: string;
}

/**
 * Verify OTP API
 * Verifies the OTP code for the provided phone number
 */
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
    
    // Validate inputs
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

    // Ensure phone number starts with +
    const phoneNumber = body.phoneNumber.trim();
    if (!phoneNumber.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must include country code (e.g., +1234567890)' },
        { status: 400 }
      );
    }

    // Initialize Prelude client
    const client = new Prelude({
      apiToken: apiKey,
    });

    logger.info('Verifying OTP for:', phoneNumber);

    // Verify the code
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
      
      // 1. Generate user ID from phone number
      const userId = generateUserId(phoneNumber);
      
      // 2. Create or update user in store
      const user = await createOrUpdateUser(userId, phoneNumber, verificationId);
      
      // 3. Generate JWT token
      const token = await generateToken({
        userId: user.id,
        phoneNumber: user.phoneNumber,
        verificationId: verificationId,
      });
      
      logger.info('User authenticated successfully:', {
        userId: user.id,
        sessionCount: user.sessionCount,
      });
      
      return NextResponse.json({
        success: true,
        verified: true,
        verificationId: verificationId,
        message: 'Phone number verified successfully!',
        token,
        user: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          sessionCount: user.sessionCount,
          lastLogin: user.lastLogin.toISOString(),
        },
      });
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
