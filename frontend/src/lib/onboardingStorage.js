import {
  readStorageJson,
  readStorageValue,
  removeStorageValue,
  writeStorageJson,
  writeStorageValue,
} from "../utils/browserStorage";

export const ONBOARDING_STORAGE_KEY = "pendingOnboarding";
export const ONBOARDING_SESSION_KEY = "pendingOnboardingSession";
export const POST_ONBOARDING_WALKTHROUGH_KEY = "mongez.postOnboardingWalkthrough";

export function readPendingOnboardingDraft() {
  const pending = readStorageJson(ONBOARDING_STORAGE_KEY, null);

  if (!pending) {
    return null;
  }

  return {
    orgName: pending?.organization?.name || "",
    industry: pending?.organization?.industry || "NGO",
    size: pending?.organization?.size || "MEDIUM",
    country: pending?.organization?.country ? String(pending.organization.country).toUpperCase() : "EG",
    selectedTemplate: pending?.template || "project-board",
    invites:
      Array.isArray(pending?.invites) && pending.invites.length > 0
        ? pending.invites.map((invite) => ({
            email: invite.email || "",
            role: String(invite.role || "MEMBER").toUpperCase(),
          }))
        : [{ email: "", role: "MEMBER" }],
  };
}

export function persistPendingOnboardingDraft(payload) {
  return writeStorageJson(ONBOARDING_STORAGE_KEY, payload);
}

export function clearPendingOnboardingDraft() {
  return removeStorageValue(ONBOARDING_STORAGE_KEY);
}

export function hasPendingOnboardingDraft() {
  return Boolean(readStorageValue(ONBOARDING_STORAGE_KEY, ""));
}

export function markOnboardingSessionActive() {
  if (typeof window === "undefined") {
    return false;
  }

  return writeStorageValue(ONBOARDING_SESSION_KEY, "true", window.sessionStorage);
}

export function clearOnboardingSession() {
  if (typeof window === "undefined") {
    return false;
  }

  return removeStorageValue(ONBOARDING_SESSION_KEY, window.sessionStorage);
}

export function hasActiveOnboardingSession() {
  if (typeof window === "undefined") {
    return false;
  }

  return readStorageValue(ONBOARDING_SESSION_KEY, "", window.sessionStorage) === "true";
}

export function shouldContinueInitialOnboarding() {
  return hasPendingOnboardingDraft() && hasActiveOnboardingSession();
}

export function markPostOnboardingWalkthroughPending() {
  return writeStorageValue(POST_ONBOARDING_WALKTHROUGH_KEY, "pending");
}

export function completePostOnboardingWalkthrough() {
  return writeStorageValue(POST_ONBOARDING_WALKTHROUGH_KEY, "done");
}

export function shouldShowPostOnboardingWalkthrough() {
  return readStorageValue(POST_ONBOARDING_WALKTHROUGH_KEY, "") === "pending";
}
