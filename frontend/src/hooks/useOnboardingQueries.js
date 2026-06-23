import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import authService from "../services/api/authService";

function buildSpacePrefix(name) {
  const normalized = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (normalized.length >= 3) {
    return normalized.slice(0, 3);
  }

  return (normalized || "ORG").padEnd(3, "X").slice(0, 3);
}

export function useOnboardingTemplatesQuery() {
  return useQuery({
    queryKey: ["onboarding", "templates"],
    queryFn: async () => [],
    staleTime: Infinity,
  });
}

export function useOnboardingSetupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organization, template, invites }) => {
      return authService.completeOnboarding(
        {
          name: organization.name.trim(),
          industry: organization.industry,
          size: organization.size,
          country: organization.country,
          prefix: buildSpacePrefix(organization.name),
        },
        template,
        invites,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
}
