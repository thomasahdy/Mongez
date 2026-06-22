import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzeRisk,
  approveAiAction,
  fetchAiContext,
  fetchPendingAiActions,
  generateAiReport,
  rejectAiAction,
  sendAiChat,
  streamAiChat,
  submitAiFeedback,
} from "../lib/aiApi";

export function useAiFeedQuery(spaceId) {
  return useQuery({
    queryKey: ["ai", "feed", spaceId],
    queryFn: () => fetchPendingAiActions(spaceId),
    enabled: Boolean(spaceId),
  });
}

export function useAiContextQuery({ spaceId, boardId, taskId }) {
  return useQuery({
    queryKey: ["ai", "context", spaceId || "", boardId || "", taskId || ""],
    queryFn: () =>
      fetchAiContext({
        spaceId: spaceId || undefined,
        boardId: boardId || undefined,
        taskId: taskId || undefined,
      }),
  });
}

export function useAiChatMutation() {
  return useMutation({
    mutationFn: (payload) => sendAiChat(payload),
  });
}

export function useAiStreamingMutation() {
  return useMutation({
    mutationFn: (payload) => streamAiChat(payload),
  });
}

export function useAiRiskMutation() {
  return useMutation({
    mutationFn: (payload) => analyzeRisk(payload),
  });
}

export function useAiReportMutation() {
  return useMutation({
    mutationFn: (payload) => generateAiReport(payload),
  });
}

export function useAiFeedbackMutation() {
  return useMutation({
    mutationFn: ({ traceId, rating }) => submitAiFeedback(traceId, rating),
  });
}

export function useAiActionReviewMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ actionId, decision }) =>
      decision === "approve" ? approveAiAction(actionId) : rejectAiAction(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "feed", spaceId] });
    },
  });
}
