/**
 * Centralized authentication service
 * Handles all auth-related API calls
 */
const API_BASE_URL = '/api/v1';

class AuthService {
  /**
   * Register a new user
   */
  async register(email, password, name) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
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
    const response = await fetch(`${API_BASE_URL}/auth/complete-onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ organization, template, invites }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to complete onboarding');
    }

    return data;
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
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_BASE_URL}/auth/send-verification`, {
      method: 'POST',
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
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    return data.data;
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;