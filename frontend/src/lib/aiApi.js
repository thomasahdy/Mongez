import { apiRequest, API_BASE_URL, getCsrfToken } from "./apiClient";

export function extractTextFromPayload(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload?.response === "string") {
    return payload.response;
  }

  if (typeof payload?.report === "string") {
    return payload.report;
  }

  if (typeof payload?.summary === "string") {
    return payload.summary;
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  if (typeof payload?.text === "string") {
    return payload.text;
  }

  if (typeof payload?.data?.response === "string") {
    return payload.data.response;
  }

  if (typeof payload?.data?.report === "string") {
    return payload.data.report;
  }

  if (typeof payload?.data?.summary === "string") {
    return payload.data.summary;
  }

  return "";
}

export async function sendAiChat(body) {
  return apiRequest("/ai/chat", {
    method: "POST",
    body,
  });
}

export async function streamAiChat({ onToken, signal, ...body }) {
  const csrfToken = await getCsrfToken();
  const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    const error = new Error(text || "The streaming request failed.");
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const traceId = response.headers.get("X-Trace-Id") || "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    chunks.forEach((chunk) => {
      const line = chunk
        .split("\n")
        .find((entry) => entry.startsWith("data:"));

      if (!line) {
        return;
      }

      const token = line.slice(5).trimStart();

      if (token.startsWith("{") && token.includes('"error"')) {
        try {
          const parsed = JSON.parse(token);
          if (parsed?.error) {
            const error = new Error(parsed.error);
            error.traceId = traceId;
            throw error;
          }
        } catch (parseError) {
          if (parseError instanceof Error) {
            throw parseError;
          }
        }
      }

      fullText += token;
      onToken?.(token);
    });
  }

  return { text: fullText, traceId };
}

export async function analyzeRisk(body) {
  return apiRequest("/ai/risk/analyze", {
    method: "POST",
    body,
  });
}

export async function generateAiReport(body) {
  return apiRequest("/ai/report/generate", {
    method: "POST",
    body,
  });
}

export async function fetchPendingAiActions(spaceId) {
  return apiRequest("/ai/actions/pending", {
    params: { spaceId },
  });
}

export async function fetchAiContext(params = {}) {
  return apiRequest("/ai/context", {
    params,
  });
}

export async function approveAiAction(id, reviewNote = "Approved in frontend review") {
  return apiRequest(`/ai/actions/${id}/approve`, {
    method: "POST",
    body: { reviewNote },
  });
}

export async function rejectAiAction(id, reviewNote = "Rejected in frontend review") {
  return apiRequest(`/ai/actions/${id}/reject`, {
    method: "POST",
    body: { reviewNote },
  });
}

export async function submitAiFeedback(traceId, rating, note = "") {
  return apiRequest("/ai/feedback", {
    method: "POST",
    body: { traceId, rating, note },
  });
}
