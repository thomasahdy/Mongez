import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { useTranslation } from "react-i18next";
import { useAppContext } from '../AppContext';
import { useSocket } from '../../context/SocketContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ErrorBoundary from "../../components/ErrorBoundary";
import tasksService from '../../services/api/tasksService';
import approvalsService from '../../services/api/approvalsService';
import workflowService from '../../services/api/workflowService';
import {
  useTaskCommentMutation,
  useTaskDeleteMutation,
  useTaskDetailsQuery,
  useTaskUpdateMutation,
  useTaskUploadMutation,
  useTaskAttachDriveFileMutation,
  useTaskDeleteDriveFileMutation,
} from '../../hooks/useTaskDetailsQueries';
import { useIntegrationStatusesQuery } from '../../hooks/useSettingsQueries';
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import {
  getInitials,
  getLocalizedPriorityLabel,
  getLocalizedStatusLabel,
  getMemberId,
  getMemberName,
  getPriorityClass,
  getRiskSeverity,
  getStatusBadgeClass,
  groupTimelineEventsByDate,
  MAX_ATTACHMENT_BYTES,
  PRIORITIES,
  STATUSES,
  timeAgo,
} from "./taskDetailsUtils";
import { resolveAvatarUrl } from "../../utils/avatarUrl";

function TaskDetailsPage() {
  const { taskId } = useParams();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";
  const navigate = useNavigate();
  const { setPath } = useOutletContext() || {};
  const { spaceMembers, user: currentUser } = useAppContext();
  const queryClient = useQueryClient();

  // Queries & Mutations
  const taskDetailsQuery = useTaskDetailsQuery(taskId);
  const task = taskDetailsQuery.data?.task;
  
  const updateTaskMutation = useTaskUpdateMutation(taskId);
  const commentMutation = useTaskCommentMutation(taskId);
  const uploadMutation = useTaskUploadMutation(taskId);
  const deleteTaskMutation = useTaskDeleteMutation(taskId);
  const attachDriveFileMutation = useTaskAttachDriveFileMutation(taskId);
  const deleteDriveFileMutation = useTaskDeleteDriveFileMutation(taskId);

  // Custom Mutations
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => tasksService.deleteComment(taskId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    }
  });

  // Space ID helper & Google Drive connection status
  const spaceId = task?.board?.department?.spaceId;
  const statusesQuery = useIntegrationStatusesQuery(spaceId);
  const googleDriveConnected = statusesQuery.data?.googleDriveConnected;

  // States for Google Drive selector modal
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [driveSearch, setDriveSearch] = useState("");

  const driveFilesQuery = useQuery({
    queryKey: ["google-drive", "files", driveSearch],
    queryFn: () => tasksService.listGoogleDriveFiles(driveSearch),
    enabled: Boolean(isDrivePickerOpen && googleDriveConnected),
  });

  // Fetch task approvals
  const taskApprovalsQuery = useQuery({
    queryKey: ["task", "approvals", taskId],
    queryFn: () => approvalsService.listForTask(taskId),
    enabled: !!taskId,
  });

  // Fetch workflow definitions
  const workflowDefsQuery = useQuery({
    queryKey: ["workflow", "definitions", spaceId],
    queryFn: () => workflowService.listDefinitions(spaceId),
    enabled: !!spaceId,
  });

  // Fetch my workflow requests in space
  const spaceWorkflowsQuery = useQuery({
    queryKey: ["workflow", "requests", spaceId],
    queryFn: () => workflowService.getMyRequests(spaceId),
    enabled: !!spaceId,
  });

  const requestApprovalMutation = useMutation({
    mutationFn: (reviewerId) => approvalsService.requestApproval(taskId, { reviewerId }),
    onSuccess: () => {
      taskApprovalsQuery.refetch();
      setFeedbackState({ message: t("taskDetails.feedback.approvalRequested"), tone: "success" });
    },
  });

  const resolveApprovalMutation = useMutation({
    mutationFn: ({ approvalId, status }) => approvalsService.resolve(approvalId, { status }),
    onSuccess: () => {
      taskApprovalsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      setFeedbackState({ message: t("taskDetails.feedback.approvalSubmitted"), tone: "success" });
    },
  });

  const startWorkflowMutation = useMutation({
    mutationFn: (definitionId) => workflowService.startWorkflow({
      definitionId,
      spaceId,
      entityType: "TASK",
      entityId: taskId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
      queryClient.invalidateQueries({ queryKey: ["workflow", "requests", spaceId] });
      setFeedbackState({ message: t("taskDetails.feedback.workflowStarted"), tone: "success" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId) => tasksService.deleteTaskFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    }
  });

  const logTimeMutation = useMutation({
    mutationFn: (data) => tasksService.logTime(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    }
  });

  const duplicateTaskMutation = useMutation({
    mutationFn: (data) => tasksService.createTask(data),
    onSuccess: (newTask) => {
      setFeedback(t("taskDetails.feedback.duplicateSuccess"), 'success');
      if (newTask?.id) {
        navigate(`/tasks/${newTask.id}`);
      } else {
        queryClient.invalidateQueries({ queryKey: ["board"] });
      }
    }
  });

  // Local UI State
  const [feedback, setFeedbackState] = useState({ message: '', tone: 'neutral' });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [commentText, setCommentText] = useState('');

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const commentInputRef = useRef(null);

  // Dropdown States
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [workflowDropdownOpen, setWorkflowDropdownOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  // Time logging Popover
  const [timeLogOpen, setTimeLogOpen] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [logNote, setLogNote] = useState('');

  // Comment Box Focus
  const [isCommentFocused, setIsCommentFocused] = useState(false);

  const fileInputRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

  const { sendTypingStatus, typingUsers } = useSocket();
  const typingTimeoutRef = useRef(null);
  const taskTypingUsers = typingUsers[taskId] || [];

  const handleCommentTextChange = (text) => {
    setCommentText(text);

    // Detect @ mention
    const textarea = commentInputRef.current;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = text.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        // Check if @ is at word boundary (not part of email)
        const beforeAt = textBeforeCursor.charAt(lastAtIndex - 1);
        if (lastAtIndex === 0 || /\s/.test(beforeAt)) {
          const mentionQuery = textBeforeCursor.substring(lastAtIndex + 1);
          setMentionSearch(mentionQuery);
          setMentionOpen(true);
          setMentionIndex(0);
        } else {
          setMentionOpen(false);
        }
      } else {
        setMentionOpen(false);
      }
    }

    if (sendTypingStatus) {
      sendTypingStatus(taskId, true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(taskId, false);
      }, 2000);
    }
  };

  const insertMention = (member) => {
    const textarea = commentInputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = commentText.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const beforeMention = commentText.substring(0, lastAtIndex);
      const afterMention = commentText.substring(cursorPos);
      const name = getMemberName(member);
      const newText = `${beforeMention}@${name} ${afterMention}`;

      setCommentText(newText);

      // Move cursor after the mention
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = lastAtIndex + name.length + 2; // +2 for '@' and space
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }

    setMentionOpen(false);
    setMentionSearch('');
  };

  const handleCommentKeyDown = (e) => {
    if (!mentionOpen || filteredMentionMembers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentionMembers.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredMentionMembers[mentionIndex]) {
          insertMention(filteredMentionMembers[mentionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setMentionOpen(false);
        setMentionSearch('');
        setMentionIndex(0);
        break;
    }
  };

  // Filter members for mentions
  const filteredMentionMembers = spaceMembers.filter(m => {
    const name = getMemberName(m).toLowerCase();
    const search = mentionSearch.toLowerCase();
    return name.includes(search);
  });

  // Sync breadcrumbs path
  const taskTitle = task?.title || task?.name;
  useEffect(() => {
    if (taskTitle) {
      setPath?.([
        { name: t("common.workspace"), color: 'text-slate-400', ref: '/dashboard' },
        { name: taskTitle || t("taskDetails.breadcrumb"), color: 'text-slate-800 dark:text-slate-200', ref: '' },
      ]);
    }
  }, [taskTitle, setPath, t]);

  // Set timeout helper for feedback messages
  const setFeedback = useCallback((message, tone = 'neutral') => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }

    setFeedbackState({ message, tone });
    if (tone === 'success' || tone === 'neutral') {
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackState((prev) => prev.message === message ? { message: '', tone: 'neutral' } : prev);
        feedbackTimeoutRef.current = null;
      }, 4000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      sendTypingStatus?.(taskId, false);
    };
  }, [sendTypingStatus, taskId]);

  if (taskDetailsQuery.isLoading) {
    return (
      <div className="max-w-[1600px] mx-auto w-full px-4 md:px-8 xl:px-12 py-6 animate-pulse space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (taskDetailsQuery.isError || !task) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-955 p-6 text-center space-y-4">
          <div className="text-rose-500 dark:text-rose-400 text-3xl">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 className="text-md font-bold text-slate-800 dark:text-slate-100">{t("taskDetails.notices.loadFailed")}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{taskDetailsQuery.error?.message || t("taskDetails.notices.missingTask")}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            {t("taskDetails.notices.backToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  const comments = taskDetailsQuery.data?.comments || [];
  const files = taskDetailsQuery.data?.files || [];
  const driveFiles = taskDetailsQuery.data?.driveFiles || [];
  const timeLogs = taskDetailsQuery.data?.timeLogs || [];
  const risk = taskDetailsQuery.data?.risk;
  const activities = taskDetailsQuery.data?.activities || [];

  const spaceWorkflows = spaceWorkflowsQuery.data?.data || spaceWorkflowsQuery.data?.items || spaceWorkflowsQuery.data || [];
  const taskWorkflows = spaceWorkflows.filter((w) => w.entityType === "TASK" && w.entityId === taskId);

  // Calculate Time Tracking details
  const totalMinutes = timeLogs.reduce((total, item) => total + (Number(item.durationMinutes) || Number(item.hours) * 60 || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const estimatedHours = task.estimatedHours || 0;
  const timePercent = estimatedHours > 0 ? Math.min(100, Math.round((totalMinutes / (estimatedHours * 60)) * 100)) : 0;

  // Find active option details
  const currentStatusObj = STATUSES.find(s => s.value === task.status) || STATUSES[0];
  const currentPriorityObj = PRIORITIES.find(p => p.value === task.priority) || PRIORITIES[0];

  // Mutation Wrapper
  const applyTaskUpdate = async (updates) => {
    try {
      await updateTaskMutation.mutateAsync(updates);
    } catch (error) {
      setFeedback(error.message || t("taskDetails.feedback.updateFailed"), 'error');
      throw error;
    }
  };

  // Title Save Handler
  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) {
      setFeedback(t("taskDetails.feedback.titleEmpty"), 'error');
      return;
    }
    if (editedTitle.trim() === task.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await applyTaskUpdate({ title: editedTitle.trim() });
      setIsEditingTitle(false);
      setFeedback(t("taskDetails.feedback.titleUpdated"), 'success');
    } catch {
      // handled
    }
  };

  // Description Save Handler
  const handleSaveDesc = async () => {
    try {
      await applyTaskUpdate({ description: editedDesc });
      setIsEditingDesc(false);
      setFeedback(t("taskDetails.feedback.descriptionUpdated"), 'success');
    } catch {
      // handled
    }
  };

  // Subtask Toggle Handler
  const handleToggleSubtask = async (subtaskId, currentStatus) => {
    const nextStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
    try {
      await tasksService.updateTask(subtaskId, { status: nextStatus });
      await taskDetailsQuery.refetch();
    } catch {
      setFeedback(t("taskDetails.feedback.subtaskUpdateFailed"), 'error');
    }
  };

  // Create Subtask Handler
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    try {
      await tasksService.createTask({
        title: newSubtaskTitle.trim(),
        parentId: task.id,
        boardId: task.boardId,
        columnId: task.columnId,
        spaceId: task.board?.department?.spaceId,
      });
      setNewSubtaskTitle('');
      setIsAddingSubtask(false);
      await taskDetailsQuery.refetch();
      setFeedback(t("taskDetails.feedback.subtaskCreated"), 'success');
    } catch {
      setFeedback(t("taskDetails.feedback.subtaskCreateFailed"), 'error');
    }
  };

  // Post Comment Handler
  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      if (sendTypingStatus) {
        sendTypingStatus(taskId, false);
      }
      await commentMutation.mutateAsync({ content: commentText.trim() });
      setCommentText('');
      setIsCommentFocused(false);
      setFeedback(t("taskDetails.feedback.commentAdded"), 'success');
    } catch {
      setFeedback(t("taskDetails.feedback.commentFailed"), 'error');
    }
  };

  // Delete Comment Handler
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm(t("taskDetails.prompts.deleteCommentConfirm"))) return;
    try {
      await deleteCommentMutation.mutateAsync(commentId);
      setFeedback(t("taskDetails.feedback.commentDeleted"), 'success');
    } catch {
      setFeedback(t("taskDetails.feedback.commentDeleteFailed"), 'error');
    }
  };

  // Delete File Attachment Handler
  const handleDeleteFile = async (fileId) => {
    if (!window.confirm(t("taskDetails.prompts.deleteAttachmentConfirm"))) return;
    try {
      await deleteFileMutation.mutateAsync(fileId);
      setFeedback(t("taskDetails.feedback.attachmentDeleted"), 'success');
    } catch {
      setFeedback(t("taskDetails.feedback.attachmentDeleteFailed"), 'error');
    }
  };

  // Delete Google Drive File Attachment Handler
  const handleDeleteDriveFile = async (id) => {
    if (!window.confirm(t("taskDetails.prompts.deleteAttachmentConfirm"))) return;
    try {
      await deleteDriveFileMutation.mutateAsync(id);
      setFeedback(t("taskDetails.feedback.attachmentDeleted"), 'success');
    } catch {
      setFeedback(t("taskDetails.feedback.attachmentDeleteFailed"), 'error');
    }
  };

  // Upload File Attachment Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFeedback(t("taskDetails.feedback.uploadTooLarge"), 'error');
      return;
    }
    try {
      setFeedback(t("taskDetails.feedback.uploading", { name: file.name }));
      await uploadMutation.mutateAsync(file);
      setFeedback(t("taskDetails.feedback.uploadSuccess"), 'success');
    } catch (error) {
      setFeedback(error.message || t("taskDetails.feedback.uploadFailed"), 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete Task Handler
  const handleDeleteTask = async () => {
    if (!window.confirm(t("taskDetails.prompts.deleteTaskConfirm"))) return;
    try {
      await deleteTaskMutation.mutateAsync();
      navigate(task.boardId ? `/board/${task.boardId}/kanban` : '/dashboard', { replace: true });
    } catch (error) {
      setFeedback(error.message || t("taskDetails.feedback.deleteFailed"), 'error');
    }
  };

  // Duplicate Task Actions
  const handleDuplicateTask = async () => {
    try {
      setFeedback(t("taskDetails.feedback.duplicating"));
      await duplicateTaskMutation.mutateAsync({
        title: `${task.title} (Copy)`,
        description: task.description || '',
        boardId: task.boardId,
        columnId: task.columnId,
        spaceId: task.board?.department?.spaceId,
        estimatedHours: task.estimatedHours || undefined,
        priority: task.priority || 'NONE'
      });
    } catch {
      setFeedback(t("taskDetails.feedback.duplicateFailed"), 'error');
    }
  };

  // Archive Task Action
  const handleArchiveTask = async () => {
    try {
      await applyTaskUpdate({ status: 'CANCELLED' });
      setFeedback(t("taskDetails.feedback.taskArchived"), 'success');
    } catch {
      // handled
    }
  };

  // Log hours handler
  const handleLogTime = async (e) => {
    e.preventDefault();
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0) {
      setFeedback(t("taskDetails.feedback.invalidHours"), 'error');
      return;
    }
    try {
      await logTimeMutation.mutateAsync({
        hours,
        note: logNote || undefined
      });
      setLogHours('');
      setLogNote('');
      setTimeLogOpen(false);
      setFeedback(t("taskDetails.feedback.timeLogged"), 'success');
    } catch (err) {
      setFeedback(err.message || t("taskDetails.feedback.timeLogFailed"), 'error');
    }
  };

  // Actionable AI recommendation handlers
  const handleExtendDeadline = async () => {
    let baseDate = task.dueDate ? new Date(task.dueDate) : new Date();
    baseDate.setDate(baseDate.getDate() + 2);
    try {
      await applyTaskUpdate({ dueDate: baseDate.toISOString() });
      setFeedback("Deadline extended by 2 days", "success");
    } catch (err) {
      setFeedback("Failed to extend deadline", "error");
    }
  };

  const handleCreateChecklist = async () => {
    try {
      const items = ["Review VM configurations", "Upload docker templates", "Verify student guides"];
      for (const item of items) {
        await tasksService.createTask({
          title: item,
          parentId: task.id,
          boardId: task.boardId,
          columnId: task.columnId,
          spaceId: task.board?.department?.spaceId,
        });
      }
      await taskDetailsQuery.refetch();
      setFeedback("Standard checklist created successfully", "success");
    } catch (err) {
      setFeedback("Failed to create checklist", "error");
    }
  };

  const handleAssignBackupTA = async () => {
    const assignedIds = (task.assignees || []).map(a => a.user?.id || a.id);
    const backup = spaceMembers.find(m => {
      const id = m.user?.id || m.id;
      const name = m.user?.name || m.name || "";
      const isTA = name.toLowerCase().includes("ta") || name.toLowerCase().includes("assistant") || m.user?.email?.toLowerCase().includes("ta");
      return isTA && !assignedIds.includes(id);
    }) || spaceMembers.find(m => {
      const id = m.user?.id || m.id;
      return !assignedIds.includes(id);
    });

    if (!backup) {
      setFeedback("No backup TA or member available in the space", "error");
      return;
    }

    const backupId = backup.user?.id || backup.id;
    const nextAssigneeIds = [...assignedIds, backupId];
    try {
      await applyTaskUpdate({ assigneeIds: nextAssigneeIds });
      setFeedback(`Backup TA (${backup.user?.name || backup.name}) assigned successfully`, "success");
    } catch (err) {
      setFeedback("Failed to assign backup TA", "error");
    }
  };

  // Filter members list based on query
  const filteredMembers = spaceMembers.filter(m => 
    getMemberName(m).toLowerCase().includes(assigneeSearch.toLowerCase())
  );

  // Parse risk severity color
  const riskSeverity = getRiskSeverity(risk);
  const getRiskCardStyles = () => {
    if (riskSeverity === 'critical') {
      return 'bg-rose-50/60 dark:bg-rose-955/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30';
    }
    if (riskSeverity === 'medium') {
      return 'bg-amber-50/60 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30';
    }
    return 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border border-slate-205 dark:border-slate-800';
  };

  const getRiskIconColor = () => {
    if (riskSeverity === 'critical') return 'text-rose-500';
    if (riskSeverity === 'medium') return 'text-amber-500';
    return 'text-slate-400';
  };

  // Generate unified Activity Timeline (dynamic creation events + comments + system logs)
  const timelineEvents = [];
  
  // 1. Add creation event
  if (task.createdAt) {
    timelineEvents.push({
      id: 'creation-event',
      isSystem: true,
      authorName: task.assignee?.name || t("taskDetails.defaults.owner"),
      text: t("taskDetails.template.createdTask"),
      createdAt: task.createdAt
    });
  }

  // 2. Add comments
  comments.forEach(c => {
    const author = c.author || c.user || c.createdBy;
    timelineEvents.push({
      id: c.id,
      isSystem: false,
      authorName: getMemberName(author),
      rawComment: c,
      createdAt: c.createdAt
    });
  });

  // 3. Add system activities
  activities.forEach(act => {
    if (act.type === 'comment.created') return; // avoid duplicate comments in timeline

    let text = '';
    const data = act.data || {};
    if (act.type === 'task.created') {
      text = 'created the task';
    } else if (act.type === 'task.moved') {
      text = 'moved task';
    } else if (act.type === 'task.archived') {
      text = 'archived the task';
    } else if (act.type === 'task.updated') {
      const changes = data.changes || {};
      const changeKeys = Object.keys(changes);
      if (changeKeys.length > 0) {
        text = `updated ${changeKeys.map(k => {
          let val = changes[k];
          if (k === 'assigneeIds') return 'assignees';
          if (k === 'dueDate') return 'due date';
          if (k === 'startDate') return 'start date';
          return k;
        }).join(', ')}`;
      } else {
        text = 'updated task properties';
      }
    } else {
      text = `performed action: ${act.type}`;
    }

    timelineEvents.push({
      id: act.id,
      isSystem: true,
      authorName: act.user?.name || 'Member',
      avatarUrl: act.user?.avatarUrl,
      text,
      createdAt: act.createdAt
    });
  });

  // Sort newest-to-oldest for modern PM feed hierarchy
  timelineEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Group timeline events by date for GitHub-style display
  const groupedTimelineEvents = groupTimelineEventsByDate(timelineEvents, locale);

  // Subtask progress calculations
  const completedSubtasksCount = task.subtasks?.filter(sub => sub.status === 'DONE').length || 0;
  const totalSubtasksCount = task.subtasks?.length || 0;
  const subtasksProgressPercent = totalSubtasksCount > 0 ? Math.round((completedSubtasksCount / totalSubtasksCount) * 100) : 0;

  // Visual overall progress bar value
  const getTaskProgress = () => {
    if (totalSubtasksCount > 0) return subtasksProgressPercent;
    if (task.status === 'DONE') return 100;
    if (task.status === 'IN_PROGRESS' || task.status === 'REVIEW') return 50;
    return 0;
  };
  const overallProgress = getTaskProgress();

  return (
    <div
      className="w-full min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ═══ TOP HEADER / BREADCRUMB BAR ═══ */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-850 shrink-0">
        <div className={`flex items-center gap-3 text-xs text-slate-550 dark:text-slate-400 font-medium ${isRTL ? "flex-row-reverse" : ""}`}>
          <button
            onClick={() => navigate(task.boardId ? `/board/${task.boardId}/kanban` : '/dashboard')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
          >
            <i className={`fa-solid ${isRTL ? "fa-arrow-right" : "fa-arrow-left"}`}></i>
            <span>Back to Board</span>
          </button>
          <span className="text-slate-300">|</span>
          <span className="font-mono bg-slate-50 dark:bg-slate-900 text-slate-655 dark:text-slate-350 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-slate-205 dark:border-slate-800">
            {task.identifier || task.id}
          </span>
          <i className={`fa-solid ${isRTL ? "fa-chevron-left" : "fa-chevron-right"} text-[9px] text-slate-400`}></i>
          <span className="hover:text-primary dark:hover:text-primary-light transition-colors cursor-pointer">{task.board?.name || t("taskDetails.defaults.boardFallback")}</span>
          <i className={`fa-solid ${isRTL ? "fa-chevron-left" : "fa-chevron-right"} text-[9px] text-slate-400`}></i>
          <span className="text-slate-700 dark:text-slate-450">{task.type || t("taskDetails.defaults.task")}</span>
        </div>

        {/* Action Dropdown Menu */}
        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setActionsOpen(!actionsOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-800 transition-colors cursor-pointer"
            title={t("taskDetails.template.moreActions")}
          >
            <i className="fa-solid fa-ellipsis text-sm"></i>
          </button>

          {actionsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)}></div>
              <div className={`absolute mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-enter ${isRTL ? "left-0" : "right-0"}`}>
                <button
                  onClick={() => { setActionsOpen(false); void handleDuplicateTask(); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                >
                  <i className="fa-regular fa-copy w-4 text-slate-400"></i>
                  <span>{t("taskDetails.template.duplicateTask")}</span>
                </button>
                <button
                  onClick={() => { setActionsOpen(false); void handleArchiveTask(); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                >
                  <i className="fa-solid fa-box-archive w-4 text-slate-400"></i>
                  <span>{t("taskDetails.template.archiveTask")}</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                <button
                  onClick={() => { setActionsOpen(false); void handleDeleteTask(); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-955/35 transition-colors ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                >
                  <i className="fa-solid fa-trash w-4 text-rose-500"></i>
                  <span>{t("taskDetails.actionBar.deleteTask")}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback.message && (
        <div className="px-6 py-1 shrink-0 bg-slate-50/50 dark:bg-slate-900/10">
          <div className={`mt-2 rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-between shadow-xs animate-enter ${
            feedback.tone === 'error'
              ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
              : 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
          }`}>
            <span className="flex items-center gap-2">
              <i className={feedback.tone === 'error' ? "fa-solid fa-circle-exclamation text-rose-500" : "fa-solid fa-circle-check text-emerald-500"}></i>
              {feedback.message}
            </span>
            <button onClick={() => setFeedbackState({ message: '', tone: 'neutral' })} className="text-[10px] opacity-60 hover:opacity-100 cursor-pointer">
              <i className="fa-solid fa-x"></i>
            </button>
          </div>
        </div>
      )}

      {/* ═══ TWO-COLUMN SPLIT CONTAINER ═══ */}
      <div className={`flex-1 overflow-hidden flex flex-col lg:flex-row ${isRTL ? "lg:flex-row-reverse" : ""}`}>
        
        {/* ═══ LEFT PANEL (72% width): Title, Status, Progress, Description, Checklist, Attachments, Timeline ═══ */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:pr-12 space-y-8 min-w-0 global-scrollbar">
          
          {/* Title Area (Dominates) */}
          <div className="space-y-2">
            {isEditingTitle ? (
              <div className="flex gap-2 items-center w-full">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-xl md:text-2xl font-extrabold px-3 py-1 bg-transparent border-0 border-b border-indigo-500 text-slate-900 dark:text-slate-105 flex-1 outline-none focus:ring-0"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                />
                <button
                  onClick={() => void handleSaveTitle()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {t("taskDetails.template.save")}
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="px-3.5 py-1.5 border border-slate-205 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  {t("taskDetails.template.cancel")}
                </button>
              </div>
            ) : (
              <h1
                onClick={() => {
                  setEditedTitle(task.title);
                  setIsEditingTitle(true);
                }}
                className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-3 group leading-snug"
              >
                <span>{task.title}</span>
                <i className="fa-solid fa-pen text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1"></i>
              </h1>
            )}

            {/* Borderless Metadata Quick Badges Sub-header */}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
              {/* Task Type Chip with Emoji */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium">
                {task.type === 'Bug' && '🐞'}
                {task.type === 'Feature' && '✨'}
                {task.type === 'Milestone' && '🎯'}
                {task.type === 'Research' && '📚'}
                {task.type === 'Experiment' && '🧪'}
                {(!task.type || task.type === 'Task') && '📋'}
                {task.type || 'Task'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <i className={`${currentStatusObj.icon} ${currentStatusObj.color}`}></i>
                {getLocalizedStatusLabel(currentStatusObj.value, t)}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <i className={`${currentPriorityObj.icon} ${currentPriorityObj.color}`}></i>
                {getLocalizedPriorityLabel(currentPriorityObj.value, t)}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                {(task.assignments || task.assignees || []).length > 0 ? (
                  <div className="flex -space-x-1.5">
                    {(task.assignments || task.assignees || []).slice(0, 3).map((assignment, idx) => {
                      const assignee = assignment.user || assignment;
                      const name = assignee?.name || 'User';
                      const avatarUrl = resolveAvatarUrl(assignee?.avatarUrl);
                      return (
                        <img
                          key={idx}
                          src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`}
                          alt={name}
                          title={name}
                          className="w-4 h-4 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
                        />
                      );
                    })}
                    {(task.assignments || task.assignees || []).length > 3 && (
                      <span className="text-[9px] font-semibold text-slate-500 ml-1">
                        +{(task.assignments || task.assignees || []).length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="flex items-center gap-1">
                    <i className="fa-regular fa-user text-[10px]"></i>
                    <span>Unassigned</span>
                  </span>
                )}
              </span>
              {task.dueDate && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5 text-indigo-500 font-bold">
                    <i className="fa-regular fa-calendar-check text-[10px]"></i>
                    Due {new Date(task.dueDate).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </>
              )}
            </div>

            {/* Task Progress Visualization with Context */}
            <div className="pt-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Task Progress</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{overallProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {totalSubtasksCount > 0
                  ? `${completedSubtasksCount}/${totalSubtasksCount} subtasks complete`
                  : overallProgress === 100
                    ? 'Task completed'
                    : overallProgress === 50
                      ? 'Task in progress'
                      : 'Task not started'}
              </p>
            </div>

            {/* Quick Actions Row with enhanced animations */}
            <div className="flex flex-wrap gap-2 pt-3">
              <button
                onClick={() => {
                  setIsCommentFocused(true);
                  setTimeout(() => commentInputRef.current?.focus(), 100);
                  document.getElementById("activity-section")?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-[11px] font-bold rounded-xl text-slate-700 dark:text-slate-300 transition-all cursor-pointer hover:scale-105 active:scale-95 duration-200"
              >
                <i className="fa-regular fa-comment text-indigo-500"></i>
                Comment
              </button>
              <button
                onClick={() => setAssigneeOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/20 text-[11px] font-bold rounded-xl text-slate-700 dark:text-slate-300 transition-all cursor-pointer hover:scale-105 active:scale-95 duration-200"
              >
                <i className="fa-regular fa-user text-sky-500"></i>
                Assign
              </button>
              <button
                onClick={() => setStatusOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-[11px] font-bold rounded-xl text-slate-700 dark:text-slate-300 transition-all cursor-pointer hover:scale-105 active:scale-95 duration-200"
              >
                <i className="fa-regular fa-circle-check text-emerald-500"></i>
                Change Status
              </button>
              <button
                onClick={() => navigate('/ai')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 text-[11px] font-bold rounded-xl text-slate-700 dark:text-slate-300 transition-all cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 duration-200"
              >
                <i className="fa-solid fa-robot text-purple-500 animate-pulse"></i>
                Ask AI
              </button>
            </div>
          </div>

          {/* Sticky Section Tabs */}
          <div className="sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-30 flex gap-5 border-b border-slate-100 dark:border-slate-850 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 select-none">
            <a href="#overview-section" className="hover:text-indigo-650 transition-colors py-1.5 border-b-2 border-transparent hover:border-indigo-500">Overview</a>
            <a href="#subtasks-section" className="hover:text-indigo-650 transition-colors py-1.5 border-b-2 border-transparent hover:border-indigo-500">Subtasks ({totalSubtasksCount})</a>
            <a href="#attachments-section" className="hover:text-indigo-650 transition-colors py-1.5 border-b-2 border-transparent hover:border-indigo-500">Attachments ({files.length + driveFiles.length})</a>
            <a href="#activity-section" className="hover:text-indigo-650 transition-colors py-1.5 border-b-2 border-transparent hover:border-indigo-500">Timeline & Activity</a>
          </div>

          {/* 1. Overview / Notion-like Description Section - NO BORDERS, whitespace based */}
          <div id="overview-section" className="space-y-4 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{t("taskDetails.template.description")}</span>
              {!isEditingDesc && (
                <button
                  onClick={() => {
                    setEditedDesc(task.description || '');
                    setIsEditingDesc(true);
                  }}
                  className="text-[11px] text-indigo-500 hover:underline font-bold cursor-pointer flex items-center gap-1"
                >
                  <i className="fa-regular fa-pen-to-square"></i>
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div className="space-y-2.5 animate-enter">
                <textarea
                  value={editedDesc}
                  onChange={(e) => setEditedDesc(e.target.value)}
                  className="w-full p-0 border-0 border-b border-slate-200 dark:border-slate-800 bg-transparent text-xs outline-none min-h-[120px] focus:ring-0 focus:border-indigo-500 transition-all resize-y text-slate-800 dark:text-slate-105 placeholder-slate-400 font-sans"
                  placeholder="Configure virtual environments and Docker templates..."
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => void handleSaveDesc()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditingDesc(false)}
                    className="px-3.5 py-1.5 border border-slate-205 dark:border-slate-800 text-slate-550 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => {
                  setEditedDesc(task.description || '');
                  setIsEditingDesc(true);
                }}
                className={`text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/30 p-2 rounded-xl transition-all ${isRTL ? "text-right" : "text-left"}`}
              >
                {task.description ? (
                  task.description.split(/\n{2,}/).map((p, idx) => (
                    <p key={idx} className="whitespace-pre-wrap mb-2.5 last:mb-0">{p.trim()}</p>
                  ))
                ) : (
                  <p className="text-slate-400 italic">No description provided. Click to add one...</p>
                )}
              </div>
            )}
          </div>

          {/* 2. Subtasks Checklist Section - NO BORDERS, whitespace based */}
          <div id="subtasks-section" className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{t("taskDetails.template.checklistTitle")}</span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {completedSubtasksCount}/{totalSubtasksCount}
                </span>
              </div>

              {!isAddingSubtask && (
                <button
                  onClick={() => setIsAddingSubtask(true)}
                  className="text-[11px] text-indigo-500 hover:underline font-bold cursor-pointer flex items-center gap-1"
                >
                  <i className="fa-solid fa-plus text-[9px]"></i>
                  <span>Add Subtask</span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              {isAddingSubtask && (
                <form onSubmit={handleAddSubtask} className={`flex gap-2 py-1 animate-enter ${isRTL ? "flex-row-reverse" : ""}`}>
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Subtask checklist item..."
                    className={`text-xs bg-transparent border-0 border-b border-slate-200 dark:border-slate-800 outline-none flex-1 focus:ring-0 focus:border-indigo-400 transition-all ${isRTL ? "text-right" : "text-left"}`}
                    autoFocus
                  />
                  <button type="submit" className="px-3.5 py-1 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-xl cursor-pointer transition-colors shadow-xs">Add</button>
                  <button type="button" onClick={() => setIsAddingSubtask(false)} className="px-3.5 py-1 border border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">Cancel</button>
                </form>
              )}

              {task.subtasks && task.subtasks.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-900/50">
                  {task.subtasks.map((sub, i) => {
                    const isDone = sub.status === 'DONE';
                    return (
                      <div
                        key={sub.id}
                        onClick={() => void handleToggleSubtask(sub.id, sub.status)}
                        className={`flex items-center justify-between py-2 px-1 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 rounded-xl transition-colors cursor-pointer group text-xs ${isRTL ? "flex-row-reverse text-right" : ""}`}
                      >
                        <div className={`flex items-center gap-3 min-w-0 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <div className="shrink-0 flex items-center justify-center">
                            {isDone ? (
                              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] transition-all">
                                <i className="fa-solid fa-check"></i>
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-900 group-hover:border-indigo-500 transition-all"></div>
                            )}
                          </div>
                          <span className={`font-semibold truncate ${isDone ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                            {sub.title || `${t("taskDetails.template.subtasks")} ${i + 1}`}
                          </span>
                        </div>
                        {sub.dueDate && (
                          <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-205 dark:border-slate-800 font-semibold shrink-0">
                            {new Date(sub.dueDate).toLocaleDateString(locale, {month: 'short', day: 'numeric'})}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !isAddingSubtask && (
                  <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No subtasks yet.</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Break this task into smaller steps.</p>
                    <button
                      onClick={() => setIsAddingSubtask(true)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      + Create first subtask
                    </button>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 3. Attachments Gallery Section - NO BORDERS, whitespace based */}
          <div id="attachments-section" className="space-y-4 pt-6">
            <div className="flex justify-between items-center relative">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{t("taskDetails.template.attachments")}</span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {files.length + driveFiles.length}
                </span>
              </div>
              
              <div className="relative">
                <button
                  onClick={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
                  className="text-[11px] text-indigo-505 hover:underline font-bold cursor-pointer flex items-center gap-1"
                >
                  <span>Attach File</span>
                  <i className="fa-solid fa-chevron-down text-[8px]"></i>
                </button>

                {isUploadMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsUploadMenuOpen(false)} />
                    <div className={`absolute ${isRTL ? "left-0" : "right-0"} mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1.5 z-20 text-xs`}>
                      <button
                        onClick={() => {
                          setIsUploadMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2.5 cursor-pointer dark:text-slate-205 font-medium"
                      >
                        <i className="fa-solid fa-arrow-up-from-bracket text-slate-400"></i>
                        <span>Upload from computer</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsUploadMenuOpen(false);
                          setIsDrivePickerOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-855 flex items-center gap-2.5 cursor-pointer dark:text-slate-205 font-medium"
                      >
                        <i className="fa-brands fa-google-drive text-emerald-500"></i>
                        <span>Select from Google Drive</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            </div>

            {(() => {
              const allAttachments = [
                ...files.map(f => ({ ...f, isDrive: false, name: f.name || f.fileName })),
                ...driveFiles.map(d => ({ ...d, isDrive: true, name: d.fileName, downloadUrl: d.driveLink }))
              ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

              if (allAttachments.length > 0) {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {allAttachments.map((file) => {
                      const ext = String(file.name || '').split('.').pop()?.toLowerCase();
                      const downloadUrl = file.downloadUrl || `${import.meta.env.VITE_API_URL || '/api/v1'}/files/${file.id}/download`;
                      
                      let fileIcon = "fa-regular fa-file text-slate-400";
                      let cardBorder = "border-slate-100 dark:border-slate-850";
                      let iconBg = "bg-slate-50 dark:bg-slate-900";
                      
                      if (file.isDrive) {
                         fileIcon = "fa-brands fa-google-drive text-emerald-500 font-extrabold";
                         cardBorder = "border-emerald-100/50 dark:border-emerald-950/20";
                         iconBg = "bg-emerald-50/40 dark:bg-emerald-950/10";
                      } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                        fileIcon = "fa-regular fa-file-image text-indigo-500";
                        iconBg = "bg-indigo-50/40 dark:bg-indigo-950/10";
                      } else if (ext === 'pdf') {
                        fileIcon = "fa-regular fa-file-pdf text-rose-500";
                        iconBg = "bg-rose-50/40 dark:bg-rose-955/10";
                      } else if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
                        fileIcon = "fa-regular fa-file-zipper text-amber-500";
                        iconBg = "bg-amber-55/30 dark:bg-amber-955/10";
                      } else if (['doc', 'docx', 'txt'].includes(ext)) {
                        fileIcon = "fa-regular fa-file-lines text-sky-500";
                        iconBg = "bg-sky-50/40 dark:bg-sky-950/10";
                      }

                      return (
                        <div
                          key={`${file.isDrive ? 'drive' : 'local'}-${file.id}`}
                          className={`flex items-center gap-3 p-3 bg-white dark:bg-slate-900/50 border ${cardBorder} rounded-2xl hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all group/file`}
                        >
                          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                            <i className={`fa-solid ${fileIcon} text-lg`}></i>
                          </div>

                          <div className="flex-1 min-w-0">
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 truncate block hover:underline"
                            >
                              {file.name || t("taskDetails.defaults.attachment")}
                            </a>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                {file.size ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : file.isDrive ? "Google Drive" : "Local File"}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {timeAgo(file.createdAt, t, locale)}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (file.isDrive) {
                                void handleDeleteDriveFile(file.id);
                              } else {
                                void handleDeleteFile(file.id);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-500 transition-all p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-955/20 shrink-0 cursor-pointer opacity-0 group-hover/file:opacity-100"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              } else {
                return (
                  <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No attachments yet.</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Add files, documents, or images to this task.</p>
                  </div>
                );
              }
            })()}
          </div>

          {/* 4. Chronological Feed Timeline & Comments Section - NO BORDERS, whitespace based */}
          <div id="activity-section" className="space-y-6 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Timeline & Discussion</span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                {timelineEvents.length} items
              </span>
            </div>

            {/* Notion-style Comment input */}
            <div className="relative border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 bg-slate-50/50 dark:bg-slate-950/20 shadow-xs focus-within:ring-1 focus-within:ring-indigo-400 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
              <textarea
                ref={commentInputRef}
                value={commentText}
                onChange={(e) => handleCommentTextChange(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                onFocus={() => setIsCommentFocused(true)}
                className={`w-full bg-transparent border-none text-xs outline-none resize-none placeholder-slate-400 dark:placeholder-slate-505 transition-all duration-200 leading-relaxed focus:ring-0 ${
                  isCommentFocused ? 'min-h-[64px]' : 'min-h-[28px]'
                }`}
                placeholder="Reply or post an update..."
              />

              {/* Mention Dropdown */}
              {mentionOpen && filteredMentionMembers.length > 0 && (
                <div className={`absolute z-20 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto ${isRTL ? 'left-0' : 'right-0'}`}>
                  {filteredMentionMembers.map((member, idx) => {
                    const memberName = getMemberName(member);
                    const memberAvatar = member.user?.avatarUrl || member.avatarUrl;
                    const memberId = member.user?.id || member.id;
                    return (
                      <div
                        key={memberId}
                        onClick={() => insertMention(member)}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                          idx === mentionIndex
                            ? 'bg-indigo-50 dark:bg-indigo-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-850'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                          {memberAvatar ? (
                            <img src={resolveAvatarUrl(memberAvatar)} alt={memberName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">{getInitials(memberName)}</span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{memberName}</span>
                      </div>
                    );
                  })}
                  {filteredMentionMembers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400 italic">No members found</div>
                  )}
                </div>
              )}

              {taskTypingUsers.length > 0 && (
                <div className="text-[10px] text-slate-400 italic px-1 py-0.5 mt-1 animate-pulse">
                  {taskTypingUsers.map((u) => u.name).join(", ")} is typing...
                </div>
              )}
              
              {isCommentFocused && (
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-2 mt-2 animate-enter shrink-0">
                  <div className="flex gap-1 text-slate-400 text-xs">
                    <button type="button" className="w-5.5 h-5.5 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-855 hover:text-slate-700 dark:hover:text-slate-350 rounded-md transition-colors" title="Mention"><i className="fa-solid fa-at text-[10px]"></i></button>
                    <button type="button" className="w-5.5 h-5.5 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-855 hover:text-slate-700 dark:hover:text-slate-350 rounded-md transition-colors" title="Emoji"><i className="fa-regular fa-face-smile text-[10px]"></i></button>
                    <button type="button" className="w-5.5 h-5.5 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-855 hover:text-slate-700 dark:hover:text-slate-350 rounded-md transition-colors" title="Bold"><i className="fa-solid fa-bold text-[10px]"></i></button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setCommentText(''); setIsCommentFocused(false); }}
                      className="px-2.5 py-1 border border-slate-205 dark:border-slate-800 text-[10px] font-bold rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      className="px-3 py-1 bg-indigo-655 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                    >
                      Comment
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* GitHub-Style Timeline Feed Container with Date Headers */}
            <div className="space-y-8">
              {groupedTimelineEvents.map((group, groupIdx) => (
                <div key={group.dateKey} className="space-y-4">
                  {/* Date Header */}
                  <div className="flex items-baseline gap-3 sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm py-2 z-10">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{group.dateLabel}</h3>
                    {groupIdx === 0 && (
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{group.timeString}</span>
                    )}
                  </div>

                  {/* Events for this date */}
                  <div className={`relative space-y-4 before:absolute before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100 dark:before:bg-slate-800 before:rounded ${isRTL ? "pr-3 before:right-1.5" : "pl-3 before:left-1.5"}`}>
                    {group.events.map((event) => {
                      if (event.isSystem) {
                        return (
                          <div key={event.id} className={`relative flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                            <div className={`absolute w-1.5 h-1.5 rounded-full border border-white dark:border-slate-950 bg-slate-300 dark:bg-slate-600 shadow-xs ${isRTL ? "-right-[15.5px]" : "-left-[15.5px]"}`}></div>
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">{event.authorName}</span>
                            <span>{event.text}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">{event.timeString}</span>
                          </div>
                        );
                      }

                      const isOwnComment = currentUser && (event.rawComment.userId === currentUser.id || event.rawComment.author?.id === currentUser.id);

                      return (
                        <div key={event.id} className={`relative flex gap-3 text-xs group ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                          <div className={`absolute top-2 w-2 h-2 rounded-full border border-white dark:border-slate-950 bg-indigo-500 shadow-xs shrink-0 z-10 ${isRTL ? "-right-[15.5px]" : "-left-[15.5px]"}`}></div>

                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 select-none shadow-sm mt-0.5">
                            {getInitials(event.authorName)}
                          </div>

                          <div className="flex-1 min-w-0 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl p-3 hover:bg-slate-100/70 dark:hover:bg-slate-900/40 transition-colors">
                            <div className={`flex justify-between items-baseline mb-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{event.authorName}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{event.timeString}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap text-[11.5px]">
                              {event.rawComment.body || event.rawComment.text || event.rawComment.content}
                            </p>

                            <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-2.5">
                              <button className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-1">
                                <i className="fa-regular fa-comment text-[9px]"></i> Reply
                              </button>
                              <span>•</span>
                              {isOwnComment && (
                                <>
                                  <button
                                    onClick={() => void handleDeleteComment(event.id)}
                                    className="text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                  <span>•</span>
                                </>
                              )}
                              {/* Emoji Reactions */}
                              <div className="flex gap-1.5">
                                <button className="hover:scale-105 transition-transform bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600">👍 3</button>
                                <button className="hover:scale-105 transition-transform bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-500">❤️ 1</button>
                                <button className="hover:scale-105 transition-transform text-slate-400 hover:text-slate-500 px-1">+</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {groupedTimelineEvents.length === 0 && (
                <div className="text-center py-8 px-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No activity yet.</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Be the first to add a comment or update this task.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ═══ RIGHT PANEL (28% width): Grouped sections with MINIMAL borders ═══ */}
        <div className={`w-full lg:w-[28%] xl:w-[30%] border-t lg:border-t-0 border-slate-100 dark:border-slate-850 bg-transparent p-6 overflow-y-auto space-y-8 shrink-0 ${isRTL ? "lg:border-r" : "lg:border-l"} global-scrollbar`}>

          {/* Group 1: People - NO BORDER */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">People</h4>
            
            {/* Assignee Selection - Multi-select support */}
            <div className="space-y-2 relative">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Assignees</span>

              {/* Show current assignees as avatar stack */}
              <div className="flex items-center gap-2 flex-wrap">
                {(task.assignments || task.assignees || []).length > 0 ? (
                  <div className="flex -space-x-2">
                    {(task.assignments || task.assignees || []).slice(0, 5).map((assignment, idx) => {
                      const assignee = assignment.user || assignment;
                      const name = assignee?.name || 'User';
                      const avatarUrl = resolveAvatarUrl(assignee?.avatarUrl);
                      return (
                        <div
                          key={idx}
                          className="relative group"
                          title={name}
                        >
                          <img
                            src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`}
                            alt={name}
                            className="w-7 h-7 rounded-full object-cover ring-2 ring-white dark:ring-slate-900 hover:scale-110 transition-transform cursor-pointer"
                            onClick={async () => {
                              // Remove this assignee
                              const currentIds = (task.assignments || task.assignees || []).map(a => (a.user?.id || a.id));
                              const newIds = currentIds.filter(id => id !== (assignee?.id));
                              try {
                                await applyTaskUpdate({ assigneeIds: newIds });
                                setFeedback("Assignee removed", 'success');
                              } catch {
                                // handled
                              }
                            }}
                          />
                          <button
                            onClick={async () => {
                              const currentIds = (task.assignments || task.assignees || []).map(a => (a.user?.id || a.id));
                              const newIds = currentIds.filter(id => id !== (assignee?.id));
                              try {
                                await applyTaskUpdate({ assigneeIds: newIds });
                                setFeedback("Assignee removed", 'success');
                              } catch {
                                // handled
                              }
                            }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-[8px] flex items-center justify-center hover:bg-rose-600"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Unassigned</span>
                )}

                <button
                  onClick={() => setAssigneeOpen(!assigneeOpen)}
                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  title="Add assignee"
                >
                  <i className="fa-solid fa-plus text-xs"></i>
                </button>
              </div>

              {assigneeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setAssigneeOpen(false); setAssigneeSearch(''); }}></div>
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Assignees</span>
                      <button
                        onClick={async () => {
                          setAssigneeOpen(false);
                          try {
                            await applyTaskUpdate({ assigneeIds: [] });
                            setFeedback("All assignees removed", 'success');
                          } catch {
                            // handled
                          }
                        }}
                        className="text-[10px] text-rose-500 hover:text-rose-600 font-semibold"
                      >
                        Clear All
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className="px-2.5 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-0.5 global-scrollbar">
                      {filteredMembers.map(m => {
                        const id = getMemberId(m);
                        const name = getMemberName(m);
                        const avatarUrl = resolveAvatarUrl(m.user?.avatarUrl || m.avatarUrl);
                        const currentIds = (task.assignments || task.assignees || []).map(a => a.user?.id || a.id);
                        const isSelected = currentIds.includes(id);

                        return (
                          <button
                            key={id}
                            onClick={async () => {
                              // Toggle assignee
                              const newIds = isSelected
                                ? currentIds.filter(mid => mid !== id)
                                : [...currentIds, id];

                              try {
                                await applyTaskUpdate({ assigneeIds: newIds });
                                setFeedback(isSelected ? "Assignee removed" : "Assignee added", 'success');
                                // Keep dropdown open for multi-selection
                              } catch {
                                // handled
                              }
                            }}
                            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350'
                            }`}
                          >
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-indigo-500 border-indigo-500 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }">
                              {isSelected && <i className="fa-solid fa-check text-[8px]"></i>}
                            </div>
                            <img src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`} className="w-5 h-5 rounded-full shrink-0 object-cover" alt="avatar" />
                            <span className="truncate flex-1">{name}</span>
                          </button>
                        );
                      })}
                      {filteredMembers.length === 0 && (
                        <div className="text-xs text-slate-400 italic text-center py-3">No members found</div>
                      )}
                    </div>
                    <div className="flex justify-end pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => setAssigneeOpen(false)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-semibold transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Watchers */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-455 dark:text-slate-400 block">Watchers</span>
              <div className="flex flex-wrap gap-1">
                {task.watchers && task.watchers.length > 0 ? (
                  task.watchers.map((w, idx) => {
                    const name = getMemberName(w.user);
                    const avatarUrl = resolveAvatarUrl(w.user?.avatarUrl || w.avatarUrl);
                    return (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 px-2 py-0.5 rounded-xl text-[10px] font-semibold text-slate-650 dark:text-slate-350 shadow-xs"
                        title={name}
                      >
                        <img
                          src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`}
                          alt="avatar"
                          className="w-4 h-4 rounded-full shrink-0 object-cover"
                        />
                        <span className="truncate max-w-[80px]">{name}</span>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">Nobody is following this task.</span>
                )}
              </div>
            </div>

          </div>

          {/* Group 2: Schedule - NO BORDER */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Schedule</h4>
            
            {/* Start Date */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Start Date</span>
              <input
                type="date"
                value={task.startDate ? task.startDate.split('T')[0] : ''}
                onChange={async (e) => {
                  const val = e.target.value;
                  try {
                    await applyTaskUpdate({ startDate: val ? new Date(val).toISOString() : null });
                    setFeedback("Start date updated successfully", 'success');
                  } catch {
                    // handled
                  }
                }}
                className="bg-transparent border-0 text-xs font-bold text-slate-700 dark:text-slate-250 cursor-pointer outline-none p-0 focus:ring-0 text-right w-28"
              />
            </div>

            {/* Due Date */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Due Date</span>
              <input
                type="date"
                value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                onChange={async (e) => {
                  const val = e.target.value;
                  try {
                    await applyTaskUpdate({ dueDate: val ? new Date(val).toISOString() : null });
                    setFeedback(t("taskDetails.feedback.dueDateUpdated"), 'success');
                  } catch {
                    // handled
                  }
                }}
                className="bg-transparent border-0 text-xs font-bold text-indigo-505 cursor-pointer outline-none p-0 focus:ring-0 text-right w-28"
              />
            </div>

            {/* Estimated Hours */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Estimated Hours</span>
              <input
                type="number"
                value={estimatedHours}
                onChange={async (e) => {
                  const val = parseInt(e.target.value, 10);
                  try {
                    await applyTaskUpdate({ estimatedHours: isNaN(val) ? 0 : val });
                    setFeedback("Estimated hours updated", 'success');
                  } catch {
                    // handled
                  }
                }}
                className="bg-transparent border-0 text-xs font-bold text-slate-700 dark:text-slate-250 outline-none p-0 focus:ring-0 text-right w-16"
              />
            </div>

            {/* Logged Hours */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Logged Hours</span>
              <button
                onClick={() => setTimeLogOpen(!timeLogOpen)}
                className="text-xs font-bold text-indigo-550 hover:underline cursor-pointer"
              >
                {totalHours}h (Log Time)
              </button>
            </div>

            {/* Time logging Popover inline overlay form */}
            {timeLogOpen && (
              <form onSubmit={handleLogTime} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl space-y-2.5 animate-enter">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hours</span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 1.5"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-205 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Notes</span>
                  <input
                    type="text"
                    placeholder="VM configurations..."
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-205 dark:border-slate-805 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setTimeLogOpen(false)}
                    className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-655"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer shadow-xs"
                  >
                    Log Time
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Group 3: Relations - NO BORDER */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Relations</h4>
            
            {/* Parent Task Link */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Parent Task</span>
              <span className="font-mono text-[10px] font-bold text-indigo-500 truncate max-w-[150px]">
                {task.parentId ? (
                  <button onClick={() => navigate(`/tasks/${task.parentId}`)} className="hover:underline">
                    {task.parent?.identifier || task.parentId}
                  </button>
                ) : (
                  <span className="text-slate-400 font-normal">None</span>
                )}
              </span>
            </div>

            {/* Linked Tasks / Dependencies */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-455 block">Dependencies</span>
              {task.dependencies && task.dependencies.length > 0 ? (
                <div className="space-y-1">
                  {task.dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      onClick={() => navigate(`/tasks/${dep.dependsOn?.id}`)}
                      className={`flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 rounded-xl text-xs hover:border-slate-350 cursor-pointer ${isRTL ? "flex-row-reverse text-right" : ""}`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[9px] font-extrabold tracking-wider bg-rose-50 text-rose-650 px-1 rounded uppercase">
                          {dep.type || "Requires"}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 truncate">{dep.dependsOn?.identifier}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadgeClass(dep.dependsOn?.status)}`}>
                        {getLocalizedStatusLabel(dep.dependsOn?.status || "TODO", t)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">No dependencies.</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Link tasks that must be completed before this one starts.</p>
                </div>
              )}
            </div>
          </div>

          {/* Group 4: Workflow - NO BORDER */}
          <div className="space-y-4 relative">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Workflow</h4>
            
            {/* Approvals */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase">
                <span>Task Sign-Offs</span>
                {spaceMembers.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        requestApprovalMutation.mutate(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="bg-transparent border-none text-indigo-500 font-extrabold hover:underline cursor-pointer outline-none text-[9px]"
                  >
                    <option value="">+ Request</option>
                    {spaceMembers.map((member) => {
                      const id = member.user?.id || member.id;
                      const name = member.user?.name || member.name || "Member";
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {taskApprovalsQuery.data && taskApprovalsQuery.data.length > 0 ? (
                <div className="space-y-1">
                  {taskApprovalsQuery.data.map((app) => {
                    const reviewerName = app.reviewer?.name || "Reviewer";
                    const isReviewer = currentUser && app.reviewerId === currentUser.id;
                    return (
                      <div key={app.id} className="p-2 bg-slate-50/50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-350 block">{reviewerName}</span>
                          {isReviewer && app.status === 'PENDING' && (
                            <div className="flex gap-2.5 pt-1.5">
                              <button
                                onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, status: 'APPROVED' })}
                                className="text-[9px] font-extrabold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, status: 'REJECTED' })}
                                className="text-[9px] font-extrabold text-rose-605 hover:text-rose-700 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          app.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/60' :
                          app.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border border-rose-100/60' :
                          'bg-amber-50 text-amber-600 border border-amber-100/60'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 italic">No approvals requested.</span>
              )}
            </div>

            {/* Workflow Definitions - Triggerable Workflows */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase">
                <span>Workflows</span>
                {workflowDefsQuery.data && workflowDefsQuery.data.length > 0 && (
                  <button
                    onClick={() => setWorkflowDropdownOpen(!workflowDropdownOpen)}
                    className="text-indigo-500 font-extrabold hover:underline cursor-pointer text-[9px]"
                  >
                    {workflowDropdownOpen ? '−' : '+'}
                  </button>
                )}
              </div>

              {/* Active workflow instances for this task */}
              {taskWorkflows.length > 0 && (
                <div className="space-y-1">
                  {taskWorkflows.map((wf) => (
                    <div key={wf.id} className="p-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400">{wf.definition?.name || 'Workflow'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          wf.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          wf.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                          wf.status === 'IN_PROGRESS' ? 'bg-sky-100 text-sky-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {wf.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Step {wf.currentStep + 1} of {wf.definition?.steps?.length || '?'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Workflow dropdown to trigger new workflows */}
              {workflowDropdownOpen && workflowDefsQuery.data && workflowDefsQuery.data.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setWorkflowDropdownOpen(false)}></div>
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Start Workflow</div>
                    <div className="max-h-48 overflow-y-auto space-y-1 global-scrollbar">
                      {workflowDefsQuery.data
                        .filter(def => def.isActive && def.triggerType === 'MANUAL')
                        .map(def => (
                          <button
                            key={def.id}
                            onClick={async () => {
                              try {
                                await startWorkflowMutation.mutateAsync(def.id);
                                setWorkflowDropdownOpen(false);
                              } catch {
                                // handled
                              }
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/20 group"
                            disabled={startWorkflowMutation.isPending}
                          >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                              <i className="fa-solid fa-diagram-project text-white text-xs"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">{def.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {def.steps?.length || 0} steps · Manual trigger
                              </div>
                            </div>
                            <i className="fa-solid fa-play text-[10px] text-indigo-500 group-hover:scale-110 transition-transform"></i>
                          </button>
                        ))}
                      {workflowDefsQuery.data.filter(d => d.isActive && d.triggerType === 'MANUAL').length === 0 && (
                        <div className="text-xs text-slate-400 italic text-center py-3">No manual workflows available</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {taskWorkflows.length === 0 && !workflowDropdownOpen && (
                <span className="text-[10px] text-slate-400 italic">No workflows running.</span>
              )}
            </div>

            {/* 🤖 AI Workspace Copilot - Redesigned */}
            <div className={`p-5 rounded-2xl border ${getRiskCardStyles()} shadow-sm`}>
              {/* Header with Robot Icon */}
              <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${riskSeverity === 'critical' ? 'bg-rose-100 dark:bg-rose-950/30' : riskSeverity === 'medium' ? 'bg-amber-100 dark:bg-amber-950/30' : 'bg-indigo-100 dark:bg-indigo-950/30'}`}>
                  <i className={`fa-solid fa-robot text-sm ${riskSeverity === 'critical' ? 'text-rose-600 dark:text-rose-400' : riskSeverity === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}></i>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">🤖 AI Workspace Copilot</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Task Intelligence & Recommendations</p>
                </div>
              </div>

              {/* Task Health Status */}
              <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Task Health</span>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    riskSeverity === 'critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' :
                    riskSeverity === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  }`}>
                    {riskSeverity === 'critical' ? '⚠️ Needs Attention' : riskSeverity === 'medium' ? '⚡ Review Recommended' : '✨ Healthy'}
                  </div>
                </div>

                {/* Key Insights */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <i className="fa-regular fa-calendar text-slate-400 w-4"></i>
                    <span>Due {task.dueDate ? timeAgo(task.dueDate, t, locale) : 'No due date set'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <i className="fa-solid fa-link text-slate-400 w-4"></i>
                    <span>{(task.dependencies?.length || 0)} blocked dependencies</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <i className="fa-solid fa-scale-balanced text-slate-400 w-4"></i>
                    <span>Workload balanced</span>
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Insights</h4>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {typeof risk === 'string' ? risk : (risk?.summary || risk?.report || "Task is on track. No critical risks detected.")}
                </p>
              </div>

              {/* Actionable Recommendations */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Recommendations</h4>
                <div className="space-y-2">
                  <button
                    onClick={handleCreateChecklist}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-left group"
                  >
                    <i className="fa-solid fa-list-check text-indigo-500 group-hover:scale-110 transition-transform"></i>
                    <span>Generate setup checklist</span>
                    <i className="fa-solid fa-chevron-right text-[8px] text-slate-400 ml-auto"></i>
                  </button>
                  <button
                    onClick={handleExtendDeadline}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-left group"
                  >
                    <i className="fa-regular fa-clock text-sky-500 group-hover:scale-110 transition-transform"></i>
                    <span>Extend deadline by 2 days</span>
                    <i className="fa-solid fa-chevron-right text-[8px] text-slate-400 ml-auto"></i>
                  </button>
                  <button
                    onClick={handleAssignBackupTA}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-left group"
                  >
                    <i className="fa-regular fa-user text-purple-500 group-hover:scale-110 transition-transform"></i>
                    <span>Assign backup member</span>
                    <i className="fa-solid fa-chevron-right text-[8px] text-slate-400 ml-auto"></i>
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Google Drive Picker Modal */}
      {isDrivePickerOpen && (
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-98 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <i className="fa-brands fa-google-drive text-emerald-500 text-sm"></i>
                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Select Google Drive File</h3>
              </div>
              <button
                onClick={() => {
                  setIsDrivePickerOpen(false);
                  setDriveSearch("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4 global-scrollbar">
              {!googleDriveConnected ? (
                <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-955/25 border border-dashed border-slate-200 dark:border-slate-805 rounded-2xl space-y-4">
                  <i className="fa-brands fa-google-drive text-slate-350 dark:text-slate-700 text-4xl block animate-bounce" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Google Drive not connected</p>
                    <p className="text-[11px] text-slate-400">Connect your Google account in Settings to attach files.</p>
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = `${import.meta.env.VITE_API_URL || '/api/v1'}/integrations/google/auth`;
                    }}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <i className="fa-brands fa-google"></i>
                    Connect Google Drive
                  </button>
                </div>
              ) : (
                <>
                  {/* Search bar */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search your Google Drive..."
                      value={driveSearch}
                      onChange={(e) => setDriveSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 pl-9 text-xs dark:text-slate-200 focus:outline-none transition-colors font-semibold"
                    />
                    <i className="fa-solid fa-magnifying-glass text-slate-400 absolute left-3 top-3 text-[10px]"></i>
                  </div>

                  {/* Redesigned grid-based file gallery list */}
                  <div className="grid grid-cols-1 gap-2.5 max-h-[40vh] overflow-y-auto pr-1 global-scrollbar">
                    {driveFilesQuery.isLoading ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <i className="fa-solid fa-spinner fa-spin text-slate-400 text-xl"></i>
                        <span className="text-xs text-slate-400 font-semibold">Loading Google Drive files...</span>
                      </div>
                    ) : driveFilesQuery.error ? (
                      <div className="text-xs text-rose-500 text-center py-6">
                        Failed to fetch files from Google Drive. Please reconnect your account.
                      </div>
                    ) : driveFilesQuery.data && driveFilesQuery.data.length > 0 ? (
                      driveFilesQuery.data.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-slate-955/10 border border-slate-100 dark:border-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl hover:shadow-xs transition-all group"
                        >
                          <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                            {file.iconLink ? (
                              <img src={file.iconLink} alt="file-type" className="w-4 h-4 shrink-0 object-contain" />
                            ) : (
                              <i className="fa-solid fa-file text-slate-400 shrink-0 text-sm"></i>
                            )}
                            <span className="text-xs font-bold text-slate-755 dark:text-slate-200 truncate">{file.name}</span>
                          </div>
                          
                          <button
                            onClick={async () => {
                              try {
                                setFeedback(`Attaching Google Drive file: ${file.name}...`);
                                await attachDriveFileMutation.mutateAsync(file.id);
                                setFeedback("Google Drive file attached successfully", "success");
                                setIsDrivePickerOpen(false);
                                setDriveSearch("");
                              } catch (err) {
                                setFeedback(err.message || "Failed to attach file", "error");
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-3 rounded-xl shadow-xs transition-all shrink-0 cursor-pointer duration-200"
                          >
                            Attach
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 italic text-center py-8">
                        No files found matching your search.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function TaskDetailsPageWithBoundary() {
  const { t } = useTranslation();

  return (
    <ErrorBoundary fallbackMessage={t("taskDetails.notices.renderFailed")}>
      <TaskDetailsPage />
    </ErrorBoundary>
  );
}
