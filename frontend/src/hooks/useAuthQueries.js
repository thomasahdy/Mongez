import { useMutation, useQuery } from "@tanstack/react-query";
import authService from "../services/api/authService";

export function useAuthSessionQuery({ bypassAuth = false } = {}) {
  return useQuery({
    queryKey: ["auth", "session", bypassAuth],
    queryFn: async () => {
      if (bypassAuth) {
        return {
          isAuthenticated: true,
          profile: null,
        };
      }

      try {
        const profile = await authService.getProfile();
        return {
          isAuthenticated: true,
          profile,
        };
      } catch {
        return {
          isAuthenticated: false,
          profile: null,
        };
      }
    },
    staleTime: 60 * 1000,
  });
}

export function useResetTokenVerificationQuery(token) {
  return useQuery({
    queryKey: ["auth", "reset-token", token],
    queryFn: () => authService.verifyResetToken(token),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (email) => authService.forgotPassword(email),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: ({ token, password, confirmPassword }) =>
      authService.resetPassword(token, password, confirmPassword),
  });
}

export function useVerifyEmailTokenQuery(token) {
  return useQuery({
    queryKey: ["auth", "verify-email-token", token],
    queryFn: async () => {
      const [verifyResult, profileResult] = await Promise.allSettled([
        authService.verifyEmail(token),
        authService.getProfile(),
      ]);

      if (verifyResult.status !== "fulfilled") {
        throw verifyResult.reason;
      }

      return {
        verified: true,
        isOAuthUser: false,
        isAuthenticated: profileResult.status === "fulfilled",
        message: verifyResult.value?.message || "Email verified successfully.",
      };
    },
    enabled: Boolean(token),
    retry: false,
  });
}

export function useVerificationStatusQuery(enabled = true) {
  return useQuery({
    queryKey: ["auth", "verification-status"],
    queryFn: async () => {
      const [status, profile] = await Promise.all([
        authService.getVerificationStatus(),
        authService.getProfile(),
      ]);

      return {
        verified: Boolean(status.isVerified),
        isOAuthUser: Boolean(status.isOAuthUser),
        isAuthenticated: Boolean(profile),
        message: status.isVerified
          ? "Your email is already verified."
          : status.isOAuthUser
            ? "This account signs in with OAuth and does not require manual email verification."
            : "Open the verification link from your inbox, then come back here if you need another email.",
      };
    },
    enabled,
    retry: false,
  });
}

export function useSendVerificationEmailMutation() {
  return useMutation({
    mutationFn: () => authService.sendVerificationEmail(),
  });
}
