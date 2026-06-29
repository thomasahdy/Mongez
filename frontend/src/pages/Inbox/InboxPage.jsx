import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import Button from "../../components/ui/Button";
import NotifIconBadge from "../../components/Inbox/NotifIconBadge";
import NotificationItem from "../../components/Inbox/NotificationItem";
import BulkActionBar from "./sections/BulkActionBar";
import EmptyInbox from "./EmptyInbox";
import InboxFilterTabs from "./sections/InboxFilterTabs";
import { useAppContext } from "../../pages/AppContext";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
} from "../../hooks/api/notifications/useNotifications";

const mapBackendNotification = (n) => {
  const typeConfigs = {
    TASK_ASSIGNED: { icon: "fa-user-plus", color: "text-sky-500", bg: "bg-sky-100 dark:bg-sky-900/30" },
    TASK_DUE: { icon: "fa-clock", color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30" },
    TASK_UPDATED: { icon: "fa-clock", color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
    COMMENT_MENTION: { icon: "fa-at", color: "text-sky-500", bg: "bg-sky-100 dark:bg-sky-900/30" },
    APPROVAL_REQUESTED: { icon: "fa-triangle-exclamation", color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30" },
    APPROVAL_RESOLVED: { icon: "fa-check-circle", color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    FILE_UPLOADED: { icon: "fa-arrow-up-from-bracket", color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
    AI_INSIGHT: { icon: "fa-robot", color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
    SYSTEM: { icon: "fa-triangle-exclamation", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
    WORKFLOW_APPROVAL_REQUEST: { icon: "fa-stamp", color: "text-rose-500", bg: "bg-rose-100 dark:bg-rose-900/30" },
    DIGEST: { icon: "fa-envelope-open-text", color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  };

    const cfg = typeConfigs[n.type] || { icon: "fa-bell", color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-700" };

    let timeLabel = t("inboxPage.justNow");
    if (n.createdAt) {
      const diff = Date.now() - new Date(n.createdAt).getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        timeLabel = days === 1 ? t("inboxPage.yesterday") : t("inboxPage.daysAgo", { count: days });
      } else if (hours > 0) {
        timeLabel = hours === 1 ? t("inboxPage.hourAgo") : t("inboxPage.hoursAgo", { count: hours });
      } else if (minutes > 0) {
        timeLabel = minutes === 1 ? t("inboxPage.minuteAgo") : t("inboxPage.minutesAgo", { count: minutes });
      }
    }

    const actions = [];
    if (n.status !== "READ") {
      actions.push({ id: "read", icon: "fa-check", title: t("inboxPage.markRead") });
    }
    actions.push({ id: "archive", icon: "fa-box-archive", title: t("inboxPage.archive") });

  return {
    id: n.id,
    type: n.type,
    unread: n.status !== 'READ',
    iconBg: cfg.bg,
    iconColor: cfg.color,
    icon: cfg.icon,
    title: n.title,
    description: n.body,
    time: timeLabel,
    createdAt: n.createdAt,
    project: n.spaceId ? "Workspace Notification" : "System Notification",
    actions,
    // Keep entity reference for navigation
    entityType: n.entityType || null,
    entityId: n.entityId || null,
    spaceId: n.spaceId || null,
  };
};

/**
 * Resolves the in-app route to navigate to when a notification is clicked.
 * Supports task, workflow, space, and approval entity types.
 */
const resolveNotificationUrl = (notif) => {
  const { type, entityType, entityId, spaceId } = notif;
  const et = (entityType || '').toLowerCase();

  // Task-related notifications → task detail page
  if (
    et === 'task' ||
    type === 'TASK_ASSIGNED' ||
    type === 'TASK_DUE' ||
    type === 'TASK_UPDATED' ||
    type === 'COMMENT_MENTION' ||
    type === 'FILE_UPLOADED'
  ) {
    if (entityId) return `/tasks/${entityId}`;
  }

  // Workflow / approval notifications → approvals page
  if (
    et === 'workflow' ||
    type === 'APPROVAL_REQUESTED' ||
    type === 'APPROVAL_RESOLVED' ||
    type === 'WORKFLOW_APPROVAL_REQUEST' ||
    type === 'WORKFLOW_APPROVED' ||
    type === 'WORKFLOW_REJECTED' ||
    type === 'WORKFLOW_TIMED_OUT'
  ) {
    return `/approvals`;
  }

  // Space notifications → spaces page
  if (et === 'space') {
    return `/spaces`;
  }

  // AI insight notifications → AI assistant
  if (type === 'AI_INSIGHT') {
    return `/ai-assistant`;
  }

  // Fallback: stay on inbox
  return null;
};

let path = [
  {
    name: "Al-Noor Foundation",
    color: "text-slate-400",
    ref: ""
  },
  {
    name: "Inbox",
    color: "text-slate-800",
    ref: ""
  },
];

export default function InboxPage({ setPath }) {
  const { activeSpace } = useAppContext();
  const spaceId = activeSpace?.id || "";
  const navigate = useNavigate();

  const { data: notificationsData, isLoading, isError, error } = useNotifications({ limit: 100, spaceId });
  const markReadMutation = useMarkNotificationAsRead();
  const deleteNotificationMutation = useDeleteNotification();
  const markAllReadMutation = useMarkAllNotificationsAsRead();

  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    setPath?.(path);
  }, [setPath]);

  const mappedNotifications = useMemo(() => {
    return (notificationsData?.items || notificationsData?.data || []).map(mapBackendNotification);
  }, [notificationsData, mapBackendNotification]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return mappedNotifications;
    if (activeFilter === "mentions") return mappedNotifications.filter(n => n.type === "COMMENT_MENTION");
    if (activeFilter === "assigned") return mappedNotifications.filter(n => n.type === "TASK_ASSIGNED");
    if (activeFilter === "comments") return mappedNotifications.filter(n => n.type === "COMMENT_MENTION");
    if (activeFilter === "updates") return mappedNotifications.filter(n => n.type === "TASK_UPDATED" || n.type === "APPROVAL_RESOLVED");
    return mappedNotifications;
  }, [mappedNotifications, activeFilter]);

  const filterTabs = useMemo(() => {
    return [
      { id: "all", label: "All", count: mappedNotifications.length },
      { id: "mentions", label: "Mentions", count: mappedNotifications.filter(n => n.type === "COMMENT_MENTION").length },
      { id: "assigned", label: "Assigned", count: mappedNotifications.filter(n => n.type === "TASK_ASSIGNED").length },
      { id: "comments", label: "Comments", count: mappedNotifications.filter(n => n.type === "COMMENT_MENTION").length },
      { id: "updates", label: "Updates", count: mappedNotifications.filter(n => n.type === "TASK_UPDATED" || n.type === "APPROVAL_RESOLVED").length },
    ];
  }, [mappedNotifications, t]);

  const allSelected = useMemo(
    () => selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0,
    [selectedIds, filteredNotifications]
  );

  const handleSelect = useCallback((id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked) => {
    setSelectedIds(checked ? new Set(filteredNotifications.map((n) => n.id)) : new Set());
  }, [filteredNotifications]);

  const handleBulkMarkRead = useCallback(async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => markReadMutation.mutateAsync({ id, spaceId }))
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to mark notifications read in bulk:", err);
    }
  }, [selectedIds, markReadMutation, spaceId]);

  const handleBulkArchive = useCallback(async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => deleteNotificationMutation.mutateAsync({ id, spaceId }))
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to archive notifications in bulk:", err);
    }
  }, [selectedIds, deleteNotificationMutation, spaceId]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllReadMutation.mutateAsync({ spaceId });
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    }
  }, [spaceId, markAllReadMutation]);

  const handleAction = useCallback(async (notifId, actionId) => {
    if (actionId === "archive" || actionId === "dismiss") {
      try {
        await deleteNotificationMutation.mutateAsync({ id: notifId, spaceId });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(notifId);
          return next;
        });
      } catch (err) {
        console.error("Failed to delete notification:", err);
      }
    } else if (actionId === "read") {
      try {
        await markReadMutation.mutateAsync({ id: notifId, spaceId });
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    } else {
      console.info(`Action "${actionId}" on notification "${notifId}"`);
    }
  }, [markReadMutation, deleteNotificationMutation, spaceId]);

  const handleItemClick = useCallback(async (notifId) => {
    const notif = mappedNotifications.find(n => n.id === notifId);
    if (!notif) return;

    // Mark as read (fire-and-forget — don't block navigation)
    if (notif.unread) {
      markReadMutation.mutate({ id: notifId, spaceId });
    }

    // Navigate to the relevant entity
    const url = resolveNotificationUrl(notif);
    if (url) {
      navigate(url);
    }
  }, [mappedNotifications, markReadMutation, spaceId, navigate]);

  const renderSkeletons = () => (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading notifications">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-slate-100 bg-white animate-pulse">
          <div className="w-4 h-4 rounded bg-slate-200" />
          <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="h-3.5 w-3/4 rounded bg-slate-200" />
            <div className="h-2 w-1/5 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 max-w-md">
          <h3 className="font-bold text-lg mb-2">{t("inboxPage.failedTitle")}</h3>
          <p className="text-sm">{error?.message || t("inboxPage.unavailable")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className={`flex-1 overflow-y-auto px-6 py-6 ${isRTL ? "text-right" : "text-left"}`} aria-label={t("inboxPage.aria")} dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[760px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100">
              <i className="fa-solid fa-inbox text-sky-500" aria-hidden="true" />
              Inbox
            </h1>
            {mappedNotifications.some(n => n.unread) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-sky-500 hover:text-sky-600 font-medium text-xs flex items-center gap-1.5"
              >
                <i className="fa-solid fa-check-double" />
                Mark all as read
              </Button>
            )}
          </div>

          <InboxFilterTabs
            tabs={filterTabs}
            activeId={activeFilter}
            onChange={setActiveFilter}
          />

          <BulkActionBar
            total={filteredNotifications.length}
            selectedCount={selectedIds.size}
            allSelected={allSelected}
            onSelectAll={handleSelectAll}
            onMarkRead={handleBulkMarkRead}
            onArchive={handleBulkArchive}
          />

          {isLoading ? (
            renderSkeletons()
          ) : filteredNotifications.length === 0 ? (
            <EmptyInbox />
          ) : (
            <div className="flex flex-col gap-2" role="list" aria-label={t("inboxPage.notificationsAria")}>
              {filteredNotifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  selected={selectedIds.has(notif.id)}
                  onSelect={(checked) => handleSelect(notif.id, checked)}
                  onAction={handleAction}
                  onClick={() => handleItemClick(notif.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
