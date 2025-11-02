/**
 * Authentication Tool Definitions
 * 
 * Defines tools that the AI can call for authentication flows.
 * These replace hardcoded authentication prompts.
 */

export interface AuthTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Tool: Request Phone Number for OTP
 * AI calls this when user wants to sign in/login/authenticate
 */
export const requestPhoneOTPTool: AuthTool = {
  name: 'request_phone_otp',
  description: 'Request phone number from user to send OTP for authentication. Use this when user wants to sign in, login, create account, or authenticate.',
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Brief reason why authentication is needed (e.g., "to access your account", "to continue")',
      },
    },
    required: ['reason'],
  },
};

/**
 * Tool: Offer Login with Choice
 * AI calls this to offer login as an option with two buttons (Yes/No)
 */
export const offerLoginChoiceTool: AuthTool = {
  name: 'offer_login_choice',
  description: 'Offer the user a choice to sign in with two buttons (Sign In / Continue as Guest). Use this when gently encouraging login after a conversation.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Friendly message explaining benefits of signing in',
      },
    },
    required: ['message'],
  },
};

/**
 * Tool: Send OTP to Phone
 * AI calls this after user provides phone number. Validates and sends OTP.
 */
export const sendOTPToPhoneTool: AuthTool = {
  name: 'send_otp_to_phone',
  description: 'Send OTP code to the provided phone number. Call this after user has entered their phone number. Validates format and triggers SMS.',
  parameters: {
    type: 'object',
    properties: {
      phoneNumber: {
        type: 'string',
        description: 'Phone number in international format (e.g., +1234567890)',
      },
    },
    required: ['phoneNumber'],
  },
};

/**
 * Tool: Verify OTP Code
 * AI calls this after user provides OTP code. Validates and completes authentication.
 */
export const verifyOTPCodeTool: AuthTool = {
  name: 'verify_otp_code',
  description: 'Verify the OTP code entered by user. Call this after user provides the 6-digit code they received via SMS.',
  parameters: {
    type: 'object',
    properties: {
      phoneNumber: {
        type: 'string',
        description: 'Phone number that received the OTP',
      },
      otpCode: {
        type: 'string',
        description: 'The 6-digit OTP code entered by user',
      },
    },
    required: ['phoneNumber', 'otpCode'],
  },
};

/**
 * Tool: Check Authentication Status
 * AI can check if user is already authenticated
 */
export const checkAuthStatusTool: AuthTool = {
  name: 'check_auth_status',
  description: 'Check if the user is currently authenticated. Returns user information if logged in.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * Tool: Logout User
 * AI calls this when user wants to sign out
 */
export const logoutUserTool: AuthTool = {
  name: 'logout_user',
  description: 'Log out the current user. Use when user explicitly asks to sign out, logout, or end their session.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * All available authentication tools
 */
export const authTools: AuthTool[] = [
  requestPhoneOTPTool,
  offerLoginChoiceTool,
  sendOTPToPhoneTool,
  verifyOTPCodeTool,
];

/**
 * Get tool definitions in OpenAI function calling format
 */
export function getAuthToolDefinitions() {
  return authTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
