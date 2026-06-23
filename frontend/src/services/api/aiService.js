import { API_BASE_URL, getCsrfToken } from "./apiClient";
import apiClient from "./apiClient";
import { extractTextFromPayload } from "../../utils/extractTextFromPayload";

export const sendAiChat = async (body) => {
  const response = await apiClient.post("/ai/chat", body);
  return response.data;
};

export const streamAiChat = async ({ onToken, signal, ...body }) => {
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
      const line = chunk.split("\n").find((entry) => entry.startsWith("data:"));
      if (!line) {
        return;
      }

      const token = line.slice(5).trimStart();
      fullText += token;
      onToken?.(token);
    });
  }

  return { text: fullText, traceId };
};

export const analyzeRisk = async (body) => {
  const response = await apiClient.post("/ai/risk/analyze", body);
  return response.data;
};

export const generateAiReport = async (body) => {
  const response = await apiClient.post("/ai/report/generate", body);
  return response.data;
};

export const fetchPendingAiActions = async (spaceId) => {
  const response = await apiClient.get("/ai/actions/pending", { params: { spaceId } });
  return response.data;
};

export const fetchAiContext = async (params = {}) => {
  const response = await apiClient.get("/ai/context", { params });
  return response.data;
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
  fetchPendingAiActions,
  fetchAiContext,
  approveAiAction,
  rejectAiAction,
  submitAiFeedback,
};

export default aiService;
