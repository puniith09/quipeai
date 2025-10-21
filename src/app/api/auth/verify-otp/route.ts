import { NextRequest, NextResponse } from 'next/server';
import Prelude from '@prelude.so/sdk';
import { logger } from '@/lib/logger';

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
      // Here you can:
      // 1. Create a session/JWT token
      // 2. Store user in database
      // 3. Set authentication cookies
      
      return NextResponse.json({
        success: true,
        verified: true,
        verificationId: check.id,
        message: 'Phone number verified successfully!',
        // You can add user token/session here
        // token: 'generated-jwt-token'
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
