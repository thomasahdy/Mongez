import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/apiClient";
import { inviteSpaceMember } from "../lib/pageApi";

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
    queryFn: async () => {
      const data = await apiRequest("/onboarding/templates");
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useOnboardingSetupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organization, template, invites }) => {
      const createdSpace = await apiRequest("/onboarding/setup", {
        method: "POST",
        body: {
          name: organization.name.trim(),
          description: [
            organization.industry ? `Industry: ${organization.industry}` : "",
            organization.size ? `Team size: ${organization.size}` : "",
            organization.country ? `Country: ${organization.country}` : "",
          ]
            .filter(Boolean)
            .join(" | "),
          prefix: buildSpacePrefix(organization.name),
          templateId: template,
        },
      });

      const createdSpaceId = createdSpace?.id || "";

      if (!createdSpaceId) {
        throw new Error("Workspace setup completed, but no space ID was returned.");
      }

      for (const invite of invites) {
        await inviteSpaceMember(createdSpaceId, invite);
      }

      return createdSpace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });
}
