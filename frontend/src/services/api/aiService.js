import { API_BASE_URL, getCsrfToken } from "./apiClient";
import apiClient from "./apiClient";
import { extractTextFromPayload } from "../../utils/extractTextFromPayload";

export const sendAiChat = async (body) => {
  const response = await apiClient.post("/ai/chat", body);
  return response.data;
};

export const streamAiChat = async ({ onToken, onStatus, signal, ...body }) => {
  const csrfToken = await getCsrfToken();
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (netErr) {
    if (signal?.aborted) {
      throw netErr;
    }
    const err = new Error("Workspace data unavailable. I could not access live data right now.");
    err.originalError = netErr;
    throw err;
  }

  if (!response.ok || !response.body) {
    const text = await response.text();
    let errMsg = text || "The streaming request failed.";
    if (response.status === 429) {
      errMsg = "AI is temporarily busy. Please wait a moment and try again.";
    } else if (response.status >= 500 || response.status === 404) {
      errMsg = "Workspace data unavailable. I could not access live data right now.";
    } else if (response.status === 403) {
      errMsg = "Access denied. You don't have permission for this workspace.";
    }
    const error = new Error(errMsg);
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let traceId = response.headers.get("X-Trace-Id") || "";
  let citations = [];
  let confidence = 1.0;
  let warnings = [];
  let actions = [];
  let summary = "";
  let insights = [];
  let risks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    chunks.forEach((chunk) => {
      const line = chunk.split("\n").find((entry) => {
        const clean = entry.replace(/^\ufeff/, "").trim();
        return clean.startsWith("data:");
      });
      if (!line) {
        return;
      }

      const cleanLine = line.replace(/^\ufeff/, "").trim();
      const rawData = cleanLine.slice(5).trimStart();

      // Parse the JSON emitted by the Python AI service: { token, metadata, done, intent }
      try {
        const parsed = JSON.parse(rawData);

        if (parsed.error) {
          const err = new Error(parsed.error);
          err.traceId = traceId;
          throw err;
        }

        if (parsed.status) {
          onStatus?.(parsed.event ? { event: parsed.event, status: parsed.status } : parsed.status);
        }

        if (parsed.token) {
          fullText += parsed.token;
          onToken?.(parsed.token);
        }

        if (parsed.metadata) {
          if (parsed.metadata.trace_id) {
            traceId = parsed.metadata.trace_id;
          }
          if (parsed.metadata.citations) {
            citations = parsed.metadata.citations;
          }
          if (parsed.metadata.confidence !== undefined) {
            confidence = parsed.metadata.confidence;
          }
          if (parsed.metadata.warnings) {
            warnings = parsed.metadata.warnings;
          }
          if (parsed.metadata.actions) {
            actions = parsed.metadata.actions;
          }
          if (parsed.metadata.summary) {
            summary = parsed.metadata.summary;
          }
          if (parsed.metadata.insights) {
            insights = parsed.metadata.insights;
          }
          if (parsed.metadata.risks) {
            risks = parsed.metadata.risks;
          }
        }

        // "done" frame — nothing to append, stream will close naturally
      } catch (parseError) {
        if (parseError instanceof Error && parseError.traceId) {
          throw parseError;
        }
        // Non-JSON chunk — append as-is (fallback)
        fullText += rawData;
        onToken?.(rawData);
      }
    });
  }

  return { text: fullText, traceId, citations, confidence, warnings, actions, summary, insights, risks };
};

export const analyzeRisk = async (body) => {
  const response = await apiClient.post("/ai/risk/analyze", body);
  return response.data;
};

export const generateAiReport = async (body) => {
  const response = await apiClient.post("/ai/report/generate", body);
  return response.data;
};

export const fetchAiDashboard = async (spaceId) => {
  const response = await apiClient.get("/ai/dashboard", { params: { spaceId } });
  return response.data;
};

export const fetchPendingAiActions = async (spaceId) => {
  const response = await apiClient.get("/ai/actions/pending", { params: { spaceId } });
  return response.data;
};

export const fetchAiContext = async (params = {}) => {
  try {
    const response = await apiClient.get("/ai/context", { params });
    return response.data || response;
  } catch (error) {
    console.warn("Backend /ai/context endpoint not implemented yet. Using empty context fallback.", error);
    return [];
  }
};

export const approveAiAction = async (id, reviewNote = "Approved in frontend review") => {
  const response = await apiClient.post(`/ai/actions/${id}/approve`, { reviewNote });
  return response.data;
};

export const rejectAiAction = async (id, reviewNote = "Rejected in frontend review") => {
  const response = await apiClient.post(`/ai/actions/${id}/reject`, { reviewNote });
  return response.data;
};

export const submitAiFeedback = async (traceId, rating, note = "") => {
  const response = await apiClient.post("/ai/feedback", { traceId, rating, note });
  return response.data;
};

const aiService = {
  extractTextFromPayload,
  sendAiChat,
  streamAiChat,
  analyzeRisk,
  generateAiReport,
  fetchAiDashboard,
  fetchPendingAiActions,
  fetchAiContext,
  approveAiAction,
  rejectAiAction,
  submitAiFeedback,
};

export default aiService;
