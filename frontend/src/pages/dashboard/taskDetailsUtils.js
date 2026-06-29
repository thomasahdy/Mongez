import { formatTranslatedStatusLabel } from "./taskStatusUtils";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function getInitials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

export function getMemberId(member) {
  return member?.user?.id || member?.id || member?.userId || member?.email || "";
}

export function getMemberName(member) {
  return member?.user?.name || member?.name || member?.user?.fullName || member?.fullName || member?.email || "Member";
}

export function humanizeToken(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function timeAgo(dateString, t, locale) {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return t("taskDetails.defaults.justNow");

  const relativeFormatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relativeFormatter.format(-minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeFormatter.format(-hours, "hour");

  const days = Math.floor(hours / 24);
  if (days < 7) return relativeFormatter.format(-days, "day");

  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function getRiskSeverity(risk) {
  if (!risk) return "info";

  const text = (typeof risk === "string" ? risk : risk.summary || risk.report || "").toLowerCase();

  if (text.includes("critical") || text.includes("high risk") || text.includes("danger") || text.includes("block")) {
    return "critical";
  }

  if (text.includes("medium") || text.includes("warning") || text.includes("caution") || text.includes("attention")) {
    return "medium";
  }

  return "info";
}

export const STATUSES = [
  { value: "BACKLOG", label: "Backlog", color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-800", icon: "fa-solid fa-inbox" },
  { value: "TODO", label: "To Do", color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-800", icon: "fa-regular fa-circle" },
  { value: "IN_PROGRESS", label: "In Progress", color: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-950/20 text-sky-605 dark:text-sky-405 border-sky-100 dark:border-sky-900/40", icon: "fa-solid fa-circle-half-stroke" },
  { value: "IN_REVIEW", label: "In Review", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-955/20 text-purple-605 dark:text-purple-405 border-purple-100 dark:border-purple-900/40", icon: "fa-regular fa-eye" },
  { value: "BLOCKED", label: "Blocked", color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-955/20 text-rose-605 dark:text-rose-405 border-rose-100 dark:border-rose-900/40", icon: "fa-solid fa-circle-minus" },
  { value: "DONE", label: "Done", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-605 dark:text-emerald-405 border-emerald-100 dark:border-emerald-900/40", icon: "fa-regular fa-circle-check" },
  { value: "CANCELLED", label: "Cancelled", color: "text-slate-400", bg: "bg-slate-100 dark:bg-slate-900", border: "border-slate-200 dark:border-slate-800", icon: "fa-solid fa-ban" },
];

export const PRIORITIES = [
  { value: "NONE", label: "None", color: "text-slate-400", icon: "fa-regular fa-flag" },
  { value: "LOW", label: "Low", color: "text-slate-500", icon: "fa-solid fa-flag" },
  { value: "MEDIUM", label: "Medium", color: "text-sky-500", icon: "fa-solid fa-flag" },
  { value: "HIGH", label: "High", color: "text-amber-500", icon: "fa-solid fa-flag" },
  { value: "URGENT", label: "Urgent", color: "text-rose-500", icon: "fa-solid fa-flag" },
];

export function getLocalizedStatusLabel(status, t) {
  return formatTranslatedStatusLabel(t, "taskDetails.statuses", status, humanizeToken(status || "TODO"));
}

export function getLocalizedPriorityLabel(priority, t) {
  return t(`taskDetails.priorities.${String(priority || "NONE").toUpperCase()}`, {
    defaultValue: humanizeToken(priority || "NONE"),
  });
}

export function getStatusBadgeClass(status) {
  const normalizedStatus = String(status || "TODO").toUpperCase();

  if (normalizedStatus.includes("PROGRESS")) return "bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/40";
  if (normalizedStatus.includes("DONE")) return "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40";
  if (normalizedStatus.includes("BLOCKED")) return "bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/40";
  if (normalizedStatus.includes("REVIEW")) return "bg-purple-50 dark:bg-purple-955/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/40";

  return "bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800";
}

export function getPriorityClass(priority) {
  const normalizedPriority = String(priority || "").toUpperCase();

  if (normalizedPriority === "URGENT") return "text-rose-500 font-bold";
  if (normalizedPriority === "HIGH") return "text-amber-500 font-bold";
  if (normalizedPriority === "MEDIUM") return "text-sky-500 font-semibold";
  if (normalizedPriority === "LOW") return "text-slate-500 font-medium";

  return "text-slate-400";
}
