export interface AuthTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

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

export const checkAuthStatusTool: AuthTool = {
  name: 'check_auth_status',
  description: 'Check if the user is currently authenticated. Returns user information if logged in.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const logoutUserTool: AuthTool = {
  name: 'logout_user',
  description: 'Log out the current user. Use when user explicitly asks to sign out, logout, or end their session.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const authTools: AuthTool[] = [
  requestPhoneOTPTool,
  offerLoginChoiceTool,
  sendOTPToPhoneTool,
  verifyOTPCodeTool,
];

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
