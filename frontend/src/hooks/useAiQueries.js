import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import aiService from "../services/api/aiService";

export function useAiFeedQuery(spaceId) {
  return useQuery({
    queryKey: ["ai", "feed", spaceId],
    queryFn: () => aiService.fetchPendingAiActions(spaceId),
    enabled: Boolean(spaceId),
  });
}

export function useAiDashboardQuery(spaceId) {
  return useQuery({
    queryKey: ["ai", "dashboard", spaceId],
    queryFn: () => aiService.fetchAiDashboard(spaceId),
    enabled: Boolean(spaceId),
    refetchInterval: 30000, // refresh every 30 seconds to keep feed alive
  });
}

export function useAiContextQuery({ spaceId, boardId, taskId }) {
  return useQuery({
    queryKey: ["ai", "context", spaceId || "", boardId || "", taskId || ""],
    queryFn: () =>
      aiService.fetchAiContext({
        spaceId: spaceId || undefined,
        boardId: boardId || undefined,
        taskId: taskId || undefined,
      }),
    enabled: Boolean(spaceId || boardId || taskId),
  });
}

export function useAiChatMutation() {
  return useMutation({
    mutationFn: (payload) => aiService.sendAiChat(payload),
  });
}

export function useAiStreamingMutation() {
  return useMutation({
    mutationFn: (payload) => aiService.streamAiChat(payload),
  });
}

export function useAiRiskMutation() {
  return useMutation({
    mutationFn: (payload) => aiService.analyzeRisk(payload),
  });
}

export function useAiReportMutation() {
  return useMutation({
    mutationFn: (payload) => aiService.generateAiReport(payload),
  });
}

export function useAiFeedbackMutation() {
  return useMutation({
    mutationFn: ({ traceId, rating }) => aiService.submitAiFeedback(traceId, rating),
  });
}

export function useAiActionReviewMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ actionId, decision }) =>
      decision === "approve" ? aiService.approveAiAction(actionId) : aiService.rejectAiAction(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "feed", spaceId] });
    },
  });
}
