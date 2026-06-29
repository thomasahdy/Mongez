import { readStorageJson, writeStorageJson, removeStorageValue } from "../utils/browserStorage";

const AI_LAUNCH_DRAFT_KEY = "mongez.ai.launchDraft";
const AI_NUDGE_STATE_KEY = "mongez.ai.nudgeState";

export function queueAiLaunchDraft(payload) {
  const prompt = String(payload?.prompt || "").trim();

  if (!prompt) {
    return false;
  }

  return writeStorageJson(AI_LAUNCH_DRAFT_KEY, {
    prompt,
    source: payload?.source || "quick-launch",
    createdAt: new Date().toISOString(),
  });
}

export function consumeAiLaunchDraft() {
  const draft = readStorageJson(AI_LAUNCH_DRAFT_KEY, null);

  if (draft) {
    removeStorageValue(AI_LAUNCH_DRAFT_KEY);
  }

  return draft;
}

export function shouldShowAiNudge() {
  const state = readStorageJson(AI_NUDGE_STATE_KEY, null);

  if (!state) {
    return true;
  }

  if (state.dismissed) {
    return false;
  }

  if (state.snoozeUntil) {
    const snoozeUntil = Date.parse(state.snoozeUntil);
    if (Number.isFinite(snoozeUntil) && snoozeUntil > Date.now()) {
      return false;
    }
  }

  return true;
}

export function dismissAiNudge() {
  return writeStorageJson(AI_NUDGE_STATE_KEY, {
    dismissed: true,
    snoozeUntil: "",
    updatedAt: new Date().toISOString(),
  });
}

export function snoozeAiNudgeUntilTomorrow() {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);

  return writeStorageJson(AI_NUDGE_STATE_KEY, {
    dismissed: false,
    snoozeUntil: tomorrow.toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
