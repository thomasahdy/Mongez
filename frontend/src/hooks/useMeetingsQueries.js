import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import meetingsService from "../services/api/meetingsService";

export function useMeetingsQuery(spaceId) {
  return useQuery({
    queryKey: ["meetings", spaceId],
    queryFn: () => meetingsService.listMeetings(spaceId),
    enabled: Boolean(spaceId),
  });
}

export function useMeetingUploadMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title, file }) => meetingsService.uploadMeeting(spaceId, title, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings", spaceId] });
    },
  });
}

export function useProposedTaskApproveMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, boardId, columnId }) =>
      meetingsService.approveProposedTask(id, spaceId, boardId, columnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings", spaceId] });
    },
  });
}

export function useProposedTaskRejectMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => meetingsService.rejectProposedTask(id, spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings", spaceId] });
    },
  });
}
