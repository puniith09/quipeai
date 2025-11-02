/**
 * Authentication Tool Handlers
 * 
 * Executes authentication tool calls and generates UI components using AI
 */

import { ComponentNode } from '@/rendering-engine/types';
import { logger } from '@/lib/logger';

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
    const response = await fetch('http://localhost:3000/api/generate-components', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        requiredComponents,
        searchSupermemory: false,
        contextData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Component generation failed: ${response.status}`);
    }

    const data = await response.json();
    return data.components || [];
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
    // Call the send-otp API
    const response = await fetch('http://localhost:3000/api/auth/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber: args.phoneNumber }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Phone number invalid - regenerate phone input with error
      const components = await generateComponents(
        `Create a phone number input form showing an error.
        
Error message: ${data.error || 'Invalid phone number format'}

Requirements:
- Show the error in a user-friendly way
- Include a textinput for phone number and a submit button
- Button should have a natural message prop
- Remind user to include country code (+1, +44, etc.)`,
        ['textinput', 'button', 'card', 'text']
      );

      return {
        success: false,
        message: '', // AI will craft error message
        components,
        metadata: { error: data.error }
      };
    }

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
    // Call the verify-otp API (expects 'code' not 'otp')
    const response = await fetch('http://localhost:3000/api/auth/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: args.phoneNumber,
        code: args.otpCode,  // API expects 'code' not 'otp'
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // OTP invalid - regenerate OTP input with error
      const components = await generateComponents(
        `Create an OTP code input form showing an error.
        
Error: ${data.error || 'Invalid verification code'}

Requirements:
- Show the error message
- Textinput for 6-digit code
- Button to verify again (natural message prop)
- Let user try again`,
        ['textinput', 'button', 'card', 'text'],
        { phoneNumber: args.phoneNumber }
      );

      return {
        success: false,
        message: '', // AI will craft error response naturally
        components,
        metadata: { error: data.error }
      };
    }

    // Success! User is now authenticated
    // Return the token for client-side cookie setting (no phone number)
    return {
      success: true,
      message: '', // AI will generate its own response
      components: [], // No more components needed
      metadata: {
        authenticated: true,
        token: data.token, // JWT token for client to set cookie
        userId: data.user?.id,
        sessionCount: data.user?.sessionCount,
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
