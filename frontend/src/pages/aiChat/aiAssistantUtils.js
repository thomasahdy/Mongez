import { extractTextFromPayload } from "../../utils/extractTextFromPayload";

export const STORAGE_KEYS = {
  context: "mongez.ai.context",
  sessions: "mongez.ai.sessions",
};

export const MAX_COMPOSER_LENGTH = 4000;

export function buildQuickPrompts(t) {
  return t("aiAssistant.quickPrompts", { returnObjects: true }).map((item, index) => ({
    ...item,
    icon: [
      "fa-triangle-exclamation",
      "fa-shield-halved",
      "fa-users",
      "fa-arrow-up-right-dots",
      "fa-file-invoice",
      "fa-eye",
    ][index],
    accentClassName: [
      "text-rose-500 bg-rose-50 dark:bg-rose-950/20",
      "text-amber-500 bg-amber-50 dark:bg-amber-950/20",
      "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20",
      "text-sky-500 bg-sky-50 dark:bg-sky-950/20",
      "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
      "text-purple-500 bg-purple-50 dark:bg-purple-950/20",
    ][index],
  }));
}

export function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function truncateText(text, maxLength = 72) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

export function extractTraceId(payload) {
  return payload?.traceId || payload?.data?.traceId || payload?.meta?.traceId || payload?.result?.traceId || "";
}

export function formatApiResult(payload) {
  const extractedText = extractTextFromPayload(payload);
  if (extractedText) {
    return extractedText;
  }

  return JSON.stringify(payload, null, 2);
}

export function createSessionSnapshot({ sessionId, messages, context, t }) {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.kind === "text");

  return {
    id: sessionId,
    title: truncateText(firstUserMessage?.text || t("aiAssistant.untitledConversation")),
    createdAt: new Date().toISOString(),
    messages,
    context,
  };
}

export function getUserFriendlyErrorMessage(error, t) {
  if (!error) {
    return t("aiAssistant.errors.workspaceUnavailable");
  }

  const rawMsg = (typeof error === "string" ? error : error.message || error.toString() || "").toLowerCase();
  if (rawMsg.includes("429") || rawMsg.includes("rate") || rawMsg.includes("too many") || rawMsg.includes("busy")) {
    return t("aiAssistant.errors.busy");
  }
  if (rawMsg.includes("error code:") || rawMsg.includes("{'status'") || rawMsg.includes("status error") || rawMsg.includes("status: 429")) {
    return t("aiAssistant.errors.workspaceUnavailable");
  }

  if (typeof error === "string") {
    return error;
  }

  const status = error.status || error.response?.status;
  const message = error.message || "";
  const isNetworkOrTimeout =
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("fetch") ||
    error.code === "ECONNABORTED";

  if (isNetworkOrTimeout || status === 500 || status === 502 || status === 503 || status === 504) {
    return t("aiAssistant.errors.workspaceUnavailable");
  }

  switch (status) {
    case 400:
      return t("aiAssistant.errors.invalidRequest");
    case 401:
      return t("aiAssistant.errors.sessionExpired");
    case 403:
      return message || t("aiAssistant.errors.accessDenied");
    case 404:
      return t("aiAssistant.errors.resourceNotFound");
    case 429:
      return t("aiAssistant.errors.rateLimit");
    default:
      return message || t("aiAssistant.errors.workspaceUnavailable");
  }
}
