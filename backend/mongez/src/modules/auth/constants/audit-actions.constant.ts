/**
 * Audit log action types
 * Using const enum for better type safety and smaller bundle size
 */
export const enum AuditAction {
  // User Registration
  USER_REGISTERED = 'USER_REGISTERED',
  USER_REGISTERED_OAUTH = 'USER_REGISTERED_OAUTH',

  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAIL = 'LOGIN_FAIL',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',

  // Password Management
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE',

  // Email Verification
  EMAIL_VERIFICATION_SENT = 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',

  // OAuth
  OAUTH_LOGIN = 'OAUTH_LOGIN',
  OAUTH_LINK = 'OAUTH_LINK',
  OAUTH_UNLINK = 'OAUTH_UNLINK',

  // Onboarding
  ONBOARDING_STARTED = 'ONBOARDING_STARTED',
  ONBOARDING_COMPLETED = 'ONBOARDING_COMPLETED',

  // Session Management
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  ALL_SESSIONS_REVOKED = 'ALL_SESSIONS_REVOKED',

  // Account Management
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_REACTIVATED = 'ACCOUNT_REACTIVATED',

  // Profile Updates
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  AVATAR_UPDATED = 'AVATAR_UPDATED',

  // Security
  SECURITY_SETTINGS_UPDATED = 'SECURITY_SETTINGS_UPDATED',
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
}

/**
 * Helper function to get audit action label for display
 */
export const getAuditActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    [AuditAction.USER_REGISTERED]: 'User Registration',
    [AuditAction.USER_REGISTERED_OAUTH]: 'OAuth Registration',
    [AuditAction.LOGIN_SUCCESS]: 'Successful Login',
    [AuditAction.LOGIN_FAIL]: 'Failed Login Attempt',
    [AuditAction.LOGOUT]: 'Logout',
    [AuditAction.TOKEN_REFRESH]: 'Token Refresh',
    [AuditAction.PASSWORD_CHANGE]: 'Password Changed',
    [AuditAction.PASSWORD_RESET_REQUEST]: 'Password Reset Requested',
    [AuditAction.PASSWORD_RESET_COMPLETE]: 'Password Reset Completed',
    [AuditAction.EMAIL_VERIFICATION_SENT]: 'Verification Email Sent',
    [AuditAction.EMAIL_VERIFIED]: 'Email Verified',
    [AuditAction.OAUTH_LOGIN]: 'OAuth Login',
    [AuditAction.OAUTH_LINK]: 'OAuth Account Linked',
    [AuditAction.OAUTH_UNLINK]: 'OAuth Account Unlinked',
    [AuditAction.ONBOARDING_STARTED]: 'Onboarding Started',
    [AuditAction.ONBOARDING_COMPLETED]: 'Onboarding Completed',
    [AuditAction.SESSION_CREATED]: 'Session Created',
    [AuditAction.SESSION_REVOKED]: 'Session Revoked',
    [AuditAction.ALL_SESSIONS_REVOKED]: 'All Sessions Revoked',
    [AuditAction.ACCOUNT_LOCKED]: 'Account Locked',
    [AuditAction.ACCOUNT_UNLOCKED]: 'Account Unlocked',
    [AuditAction.ACCOUNT_SUSPENDED]: 'Account Suspended',
    [AuditAction.ACCOUNT_REACTIVATED]: 'Account Reactivated',
    [AuditAction.PROFILE_UPDATED]: 'Profile Updated',
    [AuditAction.AVATAR_UPDATED]: 'Avatar Updated',
    [AuditAction.SECURITY_SETTINGS_UPDATED]: 'Security Settings Updated',
    [AuditAction.TWO_FACTOR_ENABLED]: 'Two-Factor Auth Enabled',
    [AuditAction.TWO_FACTOR_DISABLED]: 'Two-Factor Auth Disabled',
  };

  return labels[action] || action;
};

/**
 * Audit log categories for filtering
 */
export const enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  REGISTRATION = 'REGISTRATION',
  PASSWORD = 'PASSWORD',
  EMAIL = 'EMAIL',
  OAUTH = 'OAUTH',
  ONBOARDING = 'ONBOARDING',
  SESSION = 'SESSION',
  ACCOUNT = 'ACCOUNT',
  PROFILE = 'PROFILE',
  SECURITY = 'SECURITY',
}

/**
 * Get category for an audit action
 */
export const getAuditCategory = (action: string): AuditCategory => {
  const categoryMap: Record<string, AuditCategory> = {
    [AuditAction.LOGIN_SUCCESS]: AuditCategory.AUTHENTICATION,
    [AuditAction.LOGIN_FAIL]: AuditCategory.AUTHENTICATION,
    [AuditAction.LOGOUT]: AuditCategory.AUTHENTICATION,
    [AuditAction.TOKEN_REFRESH]: AuditCategory.AUTHENTICATION,

    [AuditAction.USER_REGISTERED]: AuditCategory.REGISTRATION,
    [AuditAction.USER_REGISTERED_OAUTH]: AuditCategory.REGISTRATION,

    [AuditAction.PASSWORD_CHANGE]: AuditCategory.PASSWORD,
    [AuditAction.PASSWORD_RESET_REQUEST]: AuditCategory.PASSWORD,
    [AuditAction.PASSWORD_RESET_COMPLETE]: AuditCategory.PASSWORD,

    [AuditAction.EMAIL_VERIFICATION_SENT]: AuditCategory.EMAIL,
    [AuditAction.EMAIL_VERIFIED]: AuditCategory.EMAIL,

    [AuditAction.OAUTH_LOGIN]: AuditCategory.OAUTH,
    [AuditAction.OAUTH_LINK]: AuditCategory.OAUTH,
    [AuditAction.OAUTH_UNLINK]: AuditCategory.OAUTH,

    [AuditAction.ONBOARDING_STARTED]: AuditCategory.ONBOARDING,
    [AuditAction.ONBOARDING_COMPLETED]: AuditCategory.ONBOARDING,

    [AuditAction.SESSION_CREATED]: AuditCategory.SESSION,
    [AuditAction.SESSION_REVOKED]: AuditCategory.SESSION,
    [AuditAction.ALL_SESSIONS_REVOKED]: AuditCategory.SESSION,

    [AuditAction.ACCOUNT_LOCKED]: AuditCategory.ACCOUNT,
    [AuditAction.ACCOUNT_UNLOCKED]: AuditCategory.ACCOUNT,
    [AuditAction.ACCOUNT_SUSPENDED]: AuditCategory.ACCOUNT,
    [AuditAction.ACCOUNT_REACTIVATED]: AuditCategory.ACCOUNT,

    [AuditAction.PROFILE_UPDATED]: AuditCategory.PROFILE,
    [AuditAction.AVATAR_UPDATED]: AuditCategory.PROFILE,

    [AuditAction.SECURITY_SETTINGS_UPDATED]: AuditCategory.SECURITY,
    [AuditAction.TWO_FACTOR_ENABLED]: AuditCategory.SECURITY,
    [AuditAction.TWO_FACTOR_DISABLED]: AuditCategory.SECURITY,
  };

  return categoryMap[action] || AuditCategory.AUTHENTICATION;
};