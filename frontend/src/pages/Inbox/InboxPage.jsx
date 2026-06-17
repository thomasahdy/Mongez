import { useState, useCallback, useMemo, useEffect } from "react";
import Button from "../../components/ui/Button";
import NotifIconBadge from "../../components/Inbox/NotifIconBadge";
import NotificationItem from "../../components/Inbox/NotificationItem";
import BulkActionBar from "./sections/BulkActionBar";
import EmptyInbox from "./EmptyInbox";
import InboxFilterTabs from "./sections/InboxFilterTabs";

// ─────────────────────────────────────────────
// NOTIFICATION DATA
// ─────────────────────────────────────────────

const INITIAL_NOTIFICATIONS = [
  {
    id: "n1",
    unread: true,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-500",
    icon: "fa-triangle-exclamation",
    title: "Funding Release Blocked — Escalation Needed",
    description: "Central Bank review has been pending for 23 days. AI suggests escalation based on 12 similar cases.",
    time: "2 hours ago",
    project: "Upper Egypt Edu",
    actions: [
      { id: "archive", icon: "fa-box-archive", title: "Archive" },
      { id: "read",    icon: "fa-check",       title: "Mark read" },
    ],
  },
  {
    id: "n2",
    unread: true,
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-500",
    icon: "fa-at",
    title: "Ahmed H. mentioned you on Curriculum Approval",
    description: '"@Thomas can you review the latest draft before submission? Ministry deadline is EOD."',
    time: "3 hours ago",
    project: "Education",
    actions: [
      { id: "reply",   icon: "fa-reply",       title: "Reply" },
      { id: "archive", icon: "fa-box-archive",  title: "Archive" },
    ],
  },
  {
    id: "n3",
    unread: true,
    iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
    iconColor: "text-indigo-500",
    icon: "fa-robot",
    title: "AI: 3 unassigned tasks approaching deadline",
    description: "Tasks in Education and Operations departments need assignees before Oct 20. Auto-assign available.",
    time: "4 hours ago",
    project: "AI Insight",
    actions: [
      { id: "auto-assign", icon: "fa-user-check", title: "Auto-assign" },
      { id: "dismiss",     icon: "fa-xmark",      title: "Dismiss" },
    ],
  },
  {
    id: "n4",
    unread: false,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-500",
    icon: "fa-check-circle",
    title: "Q3 Financial Report — Approved by CEO",
    description: "The quarterly financial report has been signed off. 2 days faster than average completion time.",
    time: "Yesterday",
    project: "Finance",
    actions: [{ id: "archive", icon: "fa-box-archive", title: "Archive" }],
  },
  {
    id: "n5",
    unread: false,
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600",
    icon: "fa-clock",
    title: "Ministry Permit — Still awaiting (8 days)",
    description: "Gov approval for rural school permits has been pending 8 days. Layla is the assigned contact.",
    time: "Yesterday",
    project: "Government",
    actions: [{ id: "follow-up", icon: "fa-bell", title: "Follow up" }],
  },
  {
    id: "n6",
    unread: false,
    iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
    iconColor: "text-yellow-700",
    icon: "fa-regular fa-comment",
    title: "Sarah M. commented on Workshop Design",
    description: '"Updated the trainer schedule for Q1. Please review the revised timeline."',
    time: "Yesterday",
    project: "Education",
    actions: [{ id: "reply", icon: "fa-reply", title: "Reply" }],
  },
  {
    id: "n7",
    unread: false,
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-500",
    icon: "fa-user-plus",
    title: "You were assigned: Onboard 3 New Field Coordinators",
    description: "Assigned by HR department. Due date: Nov 1, 2024. Priority: Medium.",
    time: "2 days ago",
    project: "HR",
    actions: [{ id: "view", icon: "fa-external-link-alt", title: "View task" }],
  },
  {
    id: "n8",
    unread: false,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-500",
    icon: "fa-thumbs-up",
    title: "UNICEF MOU — Legal review complete",
    description: "Partnership agreement has passed legal review. Ready for final signatures.",
    time: "2 days ago",
    project: "Legal",
    actions: [{ id: "archive", icon: "fa-box-archive", title: "Archive" }],
  },
  {
    id: "n9",
    unread: false,
    iconBg: "bg-slate-100 dark:bg-slate-700",
    iconColor: "text-slate-500",
    icon: "fa-chart-line",
    title: "Weekly Performance Digest",
    description:
      "Education Dept: 12 tasks completed, 89% on-time rate. Operations: 5 tasks completed, 2 blockers remaining.",
    time: "3 days ago",
    project: "Weekly Report",
    actions: [{ id: "view", icon: "fa-external-link-alt", title: "View report" }],
  },
];

const FILTER_TABS = [
  { id: "all",      label: "All",      count: 12 },
  { id: "mentions", label: "Mentions", count: 3  },
  { id: "assigned", label: "Assigned", count: null },
  { id: "comments", label: "Comments", count: null },
  { id: "updates",  label: "Updates",  count: null },
];



let path=[
  {
    name:"Al-Noor Foundation",
    color:"text-slate-400",
    ref:""
  },
  {
    name:"inbox",
    color:"text-slate-800",
    ref:""
  },
  
]

export default function InboxPage({setPath}) {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter]   = useState("all");
  const [selectedIds,  setSelectedIds]    = useState(new Set());

  // ── Selection helpers ──────────────────────
  useEffect(()=>{
    setPath(path)
  })
  const allSelected = useMemo(
    () => selectedIds.size === notifications.length && notifications.length > 0,
    [selectedIds, notifications]
  );

  const handleSelect = useCallback((id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked) => {
    setSelectedIds(checked ? new Set(notifications.map((n) => n.id)) : new Set());
  }, [notifications]);

  // ── Bulk actions ───────────────────────────
  const handleBulkMarkRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? { ...n, unread: false } : n))
    );
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleBulkArchive = useCallback(() => {
    setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  // ── Per-item actions ───────────────────────
  const handleAction = useCallback((notifId, actionId) => {
    if (actionId === "archive" || actionId === "dismiss") {
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(notifId); return next; });
    } else if (actionId === "read") {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, unread: false } : n))
      );
    } else {
      // reply / view / follow-up / auto-assign — wire to your router/modal
      console.info(`Action "${actionId}" on notification "${notifId}"`);
    }
  }, []);

  const handleItemClick = useCallback((notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, unread: false } : n))
    );
  }, []);

  return (
    <>


          {/* Scrollable inbox content */}
          <main className="flex-1 overflow-y-auto px-6 py-6" aria-label="Inbox notifications">
            <div className="max-w-[760px] mx-auto">

              {/* Page title */}
              <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-4">
                <i className="fa-solid fa-inbox text-sky-500" aria-hidden="true" />
                Inbox
              </h1>

              {/* Filter tabs */}
              <InboxFilterTabs
                tabs={FILTER_TABS}
                activeId={activeFilter}
                onChange={setActiveFilter}
              />

              {/* Bulk action bar */}
              <BulkActionBar
                total={notifications.length}
                selectedCount={selectedIds.size}
                allSelected={allSelected}
                onSelectAll={handleSelectAll}
                onMarkRead={handleBulkMarkRead}
                onArchive={handleBulkArchive}
              />

              {/* Notification list */}
              {notifications.length === 0 ? (
                <EmptyInbox />
              ) : (
                <div className="flex flex-col gap-2" role="list" aria-label="Notifications">
                  {notifications.map((notif) => (
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