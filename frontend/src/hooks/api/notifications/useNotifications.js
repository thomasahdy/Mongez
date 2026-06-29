import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from "../../../services/api/notificationService";

export function useNotifications(filters = {}) {
  return useQuery({
    queryKey: ["notifications", filters],
    queryFn: () => getNotifications(filters),
  });
}

export function useUnreadNotificationCount(spaceId = "") {
  return useQuery({
    queryKey: ["notifications", "unread-count", spaceId],
    queryFn: () => getUnreadCount(spaceId),
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, spaceId }) => markAsRead(id, spaceId),
    onSuccess: (data, variables) => {
      const spaceId = variables?.spaceId || "";
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", spaceId] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId }) => markAllAsRead(spaceId),
    onSuccess: (data, variables) => {
      const spaceId = variables?.spaceId || "";
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", spaceId] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, spaceId }) => deleteNotification(id, spaceId),
    onSuccess: (data, variables) => {
      const spaceId = variables?.spaceId || "";
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", spaceId] });
    },
  });
}
