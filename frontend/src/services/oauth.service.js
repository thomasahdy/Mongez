/**
 * OAuth Callback Handler
 * Handles OAuth success/error states from URL query parameters
 */
export const handleOAuthCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  const error = params.get('error');

  if (auth === 'success') {
    // OAuth was successful
    return {
      success: true,
      message: 'Successfully logged in with OAuth',
    };
  }

  if (auth === 'error' && error) {
    // OAuth failed
    return {
      success: false,
      error: decodeURIComponent(error),
      message: 'OAuth authentication failed',
    };
  }

  // No auth state in URL
  return {
    success: false,
    error: 'No authentication state found',
    message: 'OAuth callback state not found',
  };
};

/**
 * Redirect to OAuth login
 */
export const loginWithOAuth = (provider: 'google') => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  window.location.href = `${baseUrl}/api/v1/auth/${provider}`;
};