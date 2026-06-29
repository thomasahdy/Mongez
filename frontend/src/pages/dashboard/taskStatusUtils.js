export const DEFAULT_TASK_STATUS = "TODO";
export const TIMELINE_STATUS_ORDER = ["TODO", "IN_PROGRESS", "WAITING", "DONE"];

export function normalizeTaskStatus(status) {
  return String(status || DEFAULT_TASK_STATUS).toUpperCase();
}

export function formatTranslatedStatusLabel(t, keyPrefix, status, fallbackValue) {
  const normalizedStatus = normalizeTaskStatus(status);

  return t(`${keyPrefix}.${normalizedStatus}`, fallbackValue ? { defaultValue: fallbackValue } : undefined);
}

export function getTableStatusClasses(status) {
  const statusMap = {
    TODO: { bg: "bg-red-100", text: "text-red-700" },
    IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-700" },
    WAITING: { bg: "bg-orange-100", text: "text-orange-700" },
    DONE: { bg: "bg-green-100", text: "text-green-700" },
  };

  return statusMap[normalizeTaskStatus(status)] || statusMap[DEFAULT_TASK_STATUS];
}

export function getTimelineStatusColor(status) {
  const colors = {
    TODO: "#ef4444",
    IN_PROGRESS: "#00a8e8",
    WAITING: "#ea580c",
    DONE: "#10b981",
  };

  return colors[normalizeTaskStatus(status)] || colors.IN_PROGRESS;
}
