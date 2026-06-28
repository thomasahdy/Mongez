import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import NotifIconBadge from "../../components/Inbox/NotifIconBadge";
import NotificationItem from "../../components/Inbox/NotificationItem";
import BulkActionBar from "./sections/BulkActionBar";
import EmptyInbox from "./EmptyInbox";
import InboxFilterTabs from "./sections/InboxFilterTabs";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
} from "../../hooks/api/notifications/useNotifications";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

export default function InboxPage({ setPath }) {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const { data: notificationsData, isLoading, isError, error } = useNotifications({ limit: 100 });
  const markReadMutation = useMarkNotificationAsRead();
  const deleteNotificationMutation = useDeleteNotification();

  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    setPath?.([
      {
        name: t("common.workspace"),
        color: "text-slate-400",
        ref: "",
      },
      {
        name: t("inboxPage.breadcrumb"),
        color: "text-slate-800",
        ref: "",
      },
    ]);
  }, [setPath, t]);

  const mapBackendNotification = useCallback((n) => {
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
      unread: n.status !== "READ",
      iconBg: cfg.bg,
      iconColor: cfg.color,
      icon: cfg.icon,
      title: n.title,
      description: n.body,
      time: timeLabel,
      project: n.spaceId ? t("inboxPage.workspaceNotification") : t("inboxPage.systemNotification"),
      actions,
    };
  }, [t]);

  const mappedNotifications = useMemo(() => {
    return (notificationsData?.items || notificationsData?.data || []).map(mapBackendNotification);
  }, [notificationsData, mapBackendNotification]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return mappedNotifications;
    if (activeFilter === "mentions") return mappedNotifications.filter(n => n.icon === "fa-at");
    if (activeFilter === "assigned") return mappedNotifications.filter(n => n.icon === "fa-user-plus");
    if (activeFilter === "comments") return mappedNotifications.filter(n => n.icon.includes("comment") || n.icon === "fa-at");
    if (activeFilter === "updates") return mappedNotifications.filter(n => n.icon === "fa-clock" || n.icon === "fa-check-circle");
    return mappedNotifications;
  }, [mappedNotifications, activeFilter]);

  const filterTabs = useMemo(() => {
    return [
      { id: "all", label: t("inboxPage.filters.all"), count: mappedNotifications.length },
      { id: "mentions", label: t("inboxPage.filters.mentions"), count: mappedNotifications.filter(n => n.icon === "fa-at").length },
      { id: "assigned", label: t("inboxPage.filters.assigned"), count: mappedNotifications.filter(n => n.icon === "fa-user-plus").length },
      { id: "comments", label: t("inboxPage.filters.comments"), count: mappedNotifications.filter(n => n.icon.includes("comment") || n.icon === "fa-at").length },
      { id: "updates", label: t("inboxPage.filters.updates"), count: mappedNotifications.filter(n => n.icon === "fa-clock" || n.icon === "fa-check-circle").length },
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
        Array.from(selectedIds).map(id => markReadMutation.mutateAsync({ id }))
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to mark notifications read in bulk:", err);
    }
  }, [selectedIds, markReadMutation]);

  const handleBulkArchive = useCallback(async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => deleteNotificationMutation.mutateAsync({ id }))
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to archive notifications in bulk:", err);
    }
  }, [selectedIds, deleteNotificationMutation]);

  const handleAction = useCallback(async (notifId, actionId) => {
    if (actionId === "archive" || actionId === "dismiss") {
      try {
        await deleteNotificationMutation.mutateAsync({ id: notifId });
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
        await markReadMutation.mutateAsync({ id: notifId });
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    } else {
      console.info(`Action "${actionId}" on notification "${notifId}"`);
    }
  }, [markReadMutation, deleteNotificationMutation]);

  const handleItemClick = useCallback(async (notifId) => {
    const notif = mappedNotifications.find(n => n.id === notifId);
    if (notif?.unread) {
      try {
        await markReadMutation.mutateAsync({ id: notifId });
      } catch (err) {
        console.error("Failed to mark notification read on click:", err);
      }
    }
  }, [mappedNotifications, markReadMutation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2">
          <svg className="h-8 w-8 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-500">{t("inboxPage.loading")}</span>
        </div>
      </div>
    );
  }

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
          <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-4">
            <i className="fa-solid fa-inbox text-sky-500" aria-hidden="true" />
            {t("inboxPage.title")}
          </h1>

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

          {filteredNotifications.length === 0 ? (
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
