import { NextRequest, NextResponse } from 'next/server';
import Prelude from '@prelude.so/sdk';
import { logger } from '@/lib/logger';

interface SendOTPRequest {
  phoneNumber: string;
}

/**
 * Send OTP API
 * Sends a verification code to the provided phone number
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

    const body: SendOTPRequest = await request.json();
    
    // Validate phone number
    if (!body.phoneNumber || typeof body.phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: phoneNumber is required' },
        { status: 400 }
      );
    }

    // Ensure phone number starts with +
    const phoneNumber = body.phoneNumber.trim();
    if (!phoneNumber.startsWith('+')) {
      // If no country code, assume it might need one (you can customize this)
      return NextResponse.json(
        { error: 'Phone number must include country code (e.g., +1234567890)' },
        { status: 400 }
      );
    }

    // Initialize Prelude client
    const client = new Prelude({
      apiToken: apiKey,
    });

    logger.info('Sending OTP to:', phoneNumber);

    // Send verification code
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
