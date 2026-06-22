/**
 * Centralized authentication service
 * Handles all auth-related API calls
 */
const API_BASE_URL = '/api/v1';
let csrfTokenPromise = null;

const ensureCsrfToken = async () => {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_BASE_URL}/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include',
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to initialize security token');
        }

        return data.data?.csrfToken || '';
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return csrfTokenPromise;
};

const buildSecureHeaders = async (headers = {}) => {
  const csrfToken = await ensureCsrfToken();

  return {
    ...headers,
    'X-CSRF-Token': csrfToken,
  };
};

class AuthService {
  /**
   * Register a new user
   */
  async register(email, password, name) {
    const headers = await buildSecureHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Registration failed');
    }

    return data.data;
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    const headers = await buildSecureHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Login failed');
    }

    return data.data;
  }

  /**
   * Logout the user
   */
  async logout() {
    try {
      const headers = await buildSecureHeaders();
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch (error) {
      // Continue with redirect even if logout call fails
      console.error('Logout error:', error);
    }
  }

  /**
   * Get current user profile
   */
  async getProfile() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to fetch profile');
    }

    return data.data;
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(organization, template, invites) {
    const headers = await buildSecureHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch(`${API_BASE_URL}/auth/complete-onboarding`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ organization, template, invites }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to complete onboarding');
    }

    return data.data || data;
  }

  /**
   * Get OAuth login URL
   */
  getGoogleAuthUrl() {
    return `${API_BASE_URL}/auth/google`;
  }

  /**
   * Request password reset
   */
  async forgotPassword(email) {
    const headers = await buildSecureHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send password reset email');
    }

    return data;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, password, confirmPassword) {
    const headers = await buildSecureHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ token, password, confirmPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to reset password');
    }

    return data;
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail() {
    const headers = await buildSecureHeaders();

    const response = await fetch(`${API_BASE_URL}/auth/send-verification`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send verification email');
    }

    return data;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token) {
    const headers = await buildSecureHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify email');
    }

    return data;
  }

  /**
   * Get email verification status
   */
  async getVerificationStatus() {
    const response = await fetch(`${API_BASE_URL}/auth/verification-status`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get verification status');
    }

    return data.data || data;
  }

  async verifyResetToken(token) {
    const headers = await buildSecureHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch(`${API_BASE_URL}/auth/verify-reset-token`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify reset token');
    }

    return data.data || data;
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
