/**
 * Authentication Tool Handlers
 * 
 * Executes authentication tool calls and generates UI components using AI
 */

import { ComponentNode } from '@/rendering-engine/types';
import { logger } from '@/lib/logger';
import { generateComponentsWithAI } from '@/lib/component-generator';
import Prelude from '@prelude.so/sdk';
import { rateLimiter, RATE_LIMITS, formatTimeRemaining } from '@/lib/rate-limiter';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth/jwt';

export interface ToolCallResult {
  success: boolean;
  message?: string;
  components?: ComponentNode[];
  error?: string;
  metadata?: Record<string, unknown>; // Additional data for AI context
}

/**
 * Call the generic component generation API
 */
async function generateComponents(
  prompt: string,
  requiredComponents: string[],
  contextData?: Record<string, unknown>
): Promise<ComponentNode[]> {
  try {
    return await generateComponentsWithAI(prompt, requiredComponents, contextData);
  } catch (error) {
    logger.error('Failed to generate components:', error);
    return [];
  }
}


/**
 * Handle request_phone_otp tool call
 * Uses AI to generate phone input UI
 */
export async function handleRequestPhoneOTP(args: {
  reason?: string;
}): Promise<ToolCallResult> {
  logger.info('🔧 Auth Tool Called: request_phone_otp', args);

  const prompt = `Create a phone number input form for user authentication.
  
Requirements:
- A card with title "Phone Verification" and description "Enter your phone number to receive a code"
- A textinput component for phone number (placeholder: "+1234567890", type: "tel")
- A button to submit (label: "Send Code")

CRITICAL: The button MUST have a "message" prop that sounds like casual user speech.
Examples: "send me the code", "here's my number", "send it"
NOT like: "User is requesting verification code" or "I entered my phone number"

Make it clean and professional.

Context: ${args.reason || 'User wants to sign in to their account'}`;

  const components = await generateComponents(
    prompt,
    ['textinput', 'button', 'card', 'text'],
    { reason: args.reason }
  );

  return {
    success: true,
    message: '', // AI will craft the message
    components,
    metadata: {
      action: 'request_phone',
      reason: args.reason,
      // Tell AI: We're just showing the form, code will be sent AFTER user enters phone
      instruction: 'Ask user to enter their phone number. Do NOT say code has been sent yet - that happens after they submit the number.'
    }
  };
}

/**
 * Handle offer_login_choice tool call
 * Uses AI to generate two-button choice UI
 */
export async function handleOfferLoginChoice(args: {
  message?: string;
}): Promise<ToolCallResult> {
  logger.info('🔧 Auth Tool Called: offer_login_choice', args);

  const prompt = `Create a friendly login prompt with two button options.

Requirements:
- Two buttons side by side or stacked
- Button 1: 
  * label: "Sign In"
  * variant: "primary"
  * action: "trigger_login"
  * message: "I want to sign in" (CRITICAL - this is what user message will be sent)
- Button 2: 
  * label: "Continue as Guest"
  * variant: "secondary"
  * action: "continue_guest"
  * message: "I'll continue as guest" (CRITICAL - this is what user message will be sent)
- Both buttons should be full width
- Use a card to contain the buttons with proper spacing

Message to user: ${args.message || 'Would you like to sign in for a personalized experience?'}

IMPORTANT: Both buttons MUST have a "message" prop that specifies what message to send when clicked.`;

  const components = await generateComponents(
    prompt,
    ['button', 'card', 'text'],
    { message: args.message }
  );

  return {
    success: true,
    message: '', // AI will craft the message naturally
    components,
  };
}

/**
 * Handle check_auth_status tool call
/**
 * Handle send_otp_to_phone tool call
 * Validates phone number and actually sends OTP
 */
export async function handleSendOTPToPhone(args: {
  phoneNumber: string;
}): Promise<ToolCallResult> {
  logger.info('🔧 Auth Tool Called: send_otp_to_phone', { phone: args.phoneNumber });

  try {
    const apiKey = process.env.PRELUDE_API_KEY;
    
    if (!apiKey) {
      throw new Error('Prelude API key not configured');
    }

    const phoneNumber = args.phoneNumber.trim();
    
    if (!phoneNumber.startsWith('+')) {
      const components = await generateComponents(
        `Create a phone number input form showing an error.
        
Error message: Phone number must include country code (e.g., +1234567890)

Requirements:
- Show the error in a user-friendly way
- Include a textinput for phone number and a submit button
- Button should have a natural message prop`,
        ['textinput', 'button', 'card', 'text']
      );

      return {
        success: false,
        message: '',
        components,
        metadata: { error: 'Phone number must include country code' }
      };
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

      const components = await generateComponents(
        `Create an error message display.
        
Error: ${message}

Show this in a friendly way and tell the user when they can try again.`,
        ['text', 'card']
      );

      return {
        success: false,
        message: '',
        components,
        metadata: { error: message }
      };
    }

    const client = new Prelude({ apiToken: apiKey });
    const verification = await client.verification.create({
      target: {
        type: 'phone_number',
        value: phoneNumber,
      },
    });

    logger.info('OTP sent successfully:', verification.id);

    // OTP sent successfully - generate OTP input UI
    const components = await generateComponents(
      `Create an OTP code input form for verification.
      
The user will receive a 6-digit code via SMS to ${args.phoneNumber}.

Requirements:
- Card with title and instructions
- Textinput for 6-digit code (maxLength: 6)
- Button to verify (generate natural message prop)
- Mention the phone number in the instructions`,
      ['textinput', 'button', 'card', 'text'],
      { phoneNumber: args.phoneNumber }
    );

    return {
      success: true,
      message: '', // AI will craft success message
      components,
      metadata: { phoneNumber: args.phoneNumber, otpSent: true }
    };
  } catch (error) {
    logger.error('Failed to send OTP:', error);
    return {
      success: false,
      error: 'Failed to send OTP. Please try again.',
    };
  }
}

/**
 * Handle verify_otp_code tool call
 * Validates OTP code and completes authentication
 */
export async function handleVerifyOTPCode(args: {
  phoneNumber: string;
  otpCode: string;
}): Promise<ToolCallResult> {
  logger.info('🔧 Auth Tool Called: verify_otp_code', { phone: args.phoneNumber });

  try {
    const apiKey = process.env.PRELUDE_API_KEY;
    
    if (!apiKey) {
      throw new Error('Prelude API key not configured');
    }

    const phoneNumber = args.phoneNumber.trim();
    const code = args.otpCode.trim();

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

      const components = await generateComponents(
        `Create an error message display.
        
Error: ${message}

Show this in a friendly way.`,
        ['text', 'card']
      );

      return {
        success: false,
        message: '',
        components,
        metadata: { error: message }
      };
    }

    const client = new Prelude({ apiToken: apiKey });
    
    const check = await client.verification.check({
      target: {
        type: 'phone_number',
        value: phoneNumber,
      },
      code: code,
    });

    if (check.status !== 'success') {
      const components = await generateComponents(
        `Create an OTP verification error display.
        
The code entered was incorrect.

Requirements:
- Show friendly error message
- Include another textinput to try again
- Button to re-verify
- Option to resend code`,
        ['textinput', 'button', 'card', 'text']
      );

      return {
        success: false,
        message: '',
        components,
        metadata: { error: 'Incorrect verification code' }
      };
    }

    let user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { phoneNumber },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          sessionCount: { increment: 1 },
          lastLogin: new Date(),
        },
      });
    }

    const token = generateToken({
      userId: user.id,
      verificationId: check.id || '',
    });

    logger.info('User authenticated successfully:', user.id);

    // Success! User is now authenticated
    // Return the token for client-side cookie setting (no phone number)
    return {
      success: true,
      message: '',
      components: [],
      metadata: {
        authenticated: true,
        token: token,
        userId: user.id,
        sessionCount: user.sessionCount,
      }
    };
  } catch (error) {
    logger.error('Failed to verify OTP:', error);
    return {
      success: false,
      error: 'Failed to verify OTP. Please try again.',
    };
  }
}

/**
 * Execute an authentication tool call
 */
export async function executeAuthTool(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any
): Promise<ToolCallResult> {
  logger.debug('🔧', 'Executing Auth Tool', { toolName, args });

  switch (toolName) {
    case 'request_phone_otp':
      return handleRequestPhoneOTP(args);
    
    case 'offer_login_choice':
      return handleOfferLoginChoice(args);
    
    case 'send_otp_to_phone':
      return handleSendOTPToPhone(args);
    
    case 'verify_otp_code':
      return handleVerifyOTPCode(args);
    
    default:
      return {
        success: false,
        error: `Unknown auth tool: ${toolName}`,
      };
  }
}
