function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.tasks)) {
    return value.tasks;
  }

  return [];
}

function normalizeAssignee(task) {
  const candidate =
    task.assignee ||
    task.assignedTo ||
    task.assignees?.[0] ||
    task.createdBy ||
    null;

  if (!candidate) {
    return null;
  }

  if (typeof candidate === "string") {
    return { id: candidate, name: candidate };
  }

  return {
    id: candidate.id || candidate.userId || candidate.email || candidate.name,
    name:
      candidate.name ||
      candidate.fullName ||
      candidate.email ||
      [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") ||
      "User",
    email: candidate.email,
  };
}

function normalizeStatus(task) {
  const raw =
    task.status ||
    task.statusId ||
    task.column?.name ||
    task.columnName ||
    "TODO";

  return String(raw).trim().toUpperCase().replace(/\s+/g, "_");
}

function normalizeProgress(task) {
  const value =
    task.progress ??
    task.percentDone ??
    task.percentComplete ??
    task.completion ??
    0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function deriveStartDate(task) {
  return (
    normalizeDate(task.startDate) ||
    normalizeDate(task.createdAt) ||
    normalizeDate(task.updatedAt) ||
    normalizeDate(task.dueDate)
  );
}

function deriveEndDate(task) {
  return (
    normalizeDate(task.endDate) ||
    normalizeDate(task.dueDate) ||
    normalizeDate(task.updatedAt) ||
    normalizeDate(task.createdAt)
  );
}

export function normalizeTask(task = {}) {
  return {
    ...task,
    id: task.id || task.taskId || task.identifier || task.key,
    identifier: task.identifier || task.key || task.number || task.id,
    title: task.title || task.name || "Untitled task",
    description: task.description || task.body || task.comment || "",
    status: normalizeStatus(task),
    priority: task.priority || "MEDIUM",
    progress: normalizeProgress(task),
    dueDate: normalizeDate(task.dueDate),
    startDate: deriveStartDate(task),
    endDate: deriveEndDate(task),
    assignee: normalizeAssignee(task),
    commentsCount: Number(task.commentsCount ?? task.comments ?? 0) || 0,
    labels: Array.isArray(task.labels) ? task.labels : [],
    tags: Array.isArray(task.tags) ? task.tags : [],
  };
}

export function normalizeTaskList(payload) {
  return toArray(payload)
    .map((task) => normalizeTask(task))
    .filter((task) => Boolean(task.id));
}
