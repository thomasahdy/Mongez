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
} from '../../hooks/useTaskDetailsQueries';
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
  MAX_ATTACHMENT_BYTES,
  PRIORITIES,
  STATUSES,
  timeAgo,
} from "./taskDetailsUtils";

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

  // Custom Mutations
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => tasksService.deleteComment(taskId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    }
  });

  // Space ID helper
  const spaceId = task?.board?.department?.spaceId;

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

  // Dropdown States
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);

  // Time logging Popover
  const [timeLogOpen, setTimeLogOpen] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [logNote, setLogNote] = useState('');

  // Comment Box Expansion
  const [isCommentFocused, setIsCommentFocused] = useState(false);

  const fileInputRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

  const { sendTypingStatus, typingUsers } = useSocket();
  const typingTimeoutRef = useRef(null);
  const taskTypingUsers = typingUsers[taskId] || [];

  const handleCommentTextChange = (text) => {
    setCommentText(text);
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
  const timeLogs = taskDetailsQuery.data?.timeLogs || [];
  const risk = taskDetailsQuery.data?.risk;

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
      // applyTaskUpdate already reports a user-facing error.
    }
  };

  // Description Save Handler
  const handleSaveDesc = async () => {
    try {
      await applyTaskUpdate({ description: editedDesc });
      setIsEditingDesc(false);
      setFeedback(t("taskDetails.feedback.descriptionUpdated"), 'success');
    } catch {
      // applyTaskUpdate already reports a user-facing error.
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
      navigate(task.boardId ? `/board/${task.boardId}/table` : '/dashboard', { replace: true });
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
      // applyTaskUpdate already reports a user-facing error.
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

  // Filter members list based on query
  const filteredMembers = spaceMembers.filter(m => 
    getMemberName(m).toLowerCase().includes(assigneeSearch.toLowerCase())
  );

  // Parse risk severity color
  const riskSeverity = getRiskSeverity(risk);
  const getRiskCardStyles = () => {
    if (riskSeverity === 'critical') {
      return 'bg-rose-50/70 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 border border-rose-100 dark:border-rose-900/40';
    }
    if (riskSeverity === 'medium') {
      return 'bg-amber-50/70 dark:bg-amber-955/20 text-amber-600 dark:text-amber-455 border border-amber-100 dark:border-amber-900/40';
    }
    return 'bg-slate-50/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
  };

  const getRiskIconColor = () => {
    if (riskSeverity === 'critical') return 'text-rose-500';
    if (riskSeverity === 'medium') return 'text-amber-500';
    return 'text-slate-400';
  };

  // Generate unified Activity Timeline (dynamic creation events + comments)
  const timelineEvents = [];
  if (task.createdAt) {
    timelineEvents.push({
      id: 'creation-event',
      isSystem: true,
      authorName: task.assignee?.name || t("taskDetails.defaults.owner"),
      text: t("taskDetails.template.createdTask"),
      createdAt: task.createdAt
    });
  }
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
  // Sort oldest to newest for a natural timeline
  timelineEvents.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Subtask progress calculations
  const completedSubtasksCount = task.subtasks?.filter(sub => sub.status === 'DONE').length || 0;
  const totalSubtasksCount = task.subtasks?.length || 0;
  const subtasksProgressPercent = totalSubtasksCount > 0 ? Math.round((completedSubtasksCount / totalSubtasksCount) * 100) : 0;

  return (
    <div
      className={`w-full min-h-screen bg-slate-50/50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 flex flex-col font-sans`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      
      {/* ═══ TOP HEADER / BREADCRUMB BAR ═══ */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className={`flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium ${isRTL ? "flex-row-reverse" : ""}`}>
          <span className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-md font-semibold text-[11px] border border-slate-200/50 dark:border-slate-700/50">
            {task.identifier || task.id}
          </span>
          <i className={`fa-solid ${isRTL ? "fa-chevron-left" : "fa-chevron-right"} text-[9px] text-slate-400`}></i>
          <span className="hover:text-primary dark:hover:text-primary-light transition-colors cursor-pointer">{task.board?.name || t("taskDetails.defaults.boardFallback")}</span>
          <i className={`fa-solid ${isRTL ? "fa-chevron-left" : "fa-chevron-right"} text-[9px] text-slate-400`}></i>
          <span className="text-slate-700 dark:text-slate-350">{task.type || t("taskDetails.defaults.task")}</span>
        </div>

        {/* Action Dropdown Menu */}
        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setActionsOpen(!actionsOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer shadow-sm"
            title={t("taskDetails.template.moreActions")}
          >
            <i className="fa-solid fa-ellipsis text-sm"></i>
          </button>

          {actionsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)}></div>
              <div className={`absolute mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-enter ${isRTL ? "left-0" : "right-0"}`}>
                <button
                  onClick={() => { setActionsOpen(false); void handleDuplicateTask(); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-755 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                >
                  <i className="fa-regular fa-copy w-4 text-slate-400 dark:text-slate-500"></i>
                  <span>{t("taskDetails.template.duplicateTask")}</span>
                </button>
                <button
                  onClick={() => { setActionsOpen(false); void handleArchiveTask(); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-755 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                >
                  <i className="fa-solid fa-box-archive w-4 text-slate-400 dark:text-slate-500"></i>
                  <span>{t("taskDetails.template.archiveTask")}</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                <button
                  onClick={() => { setActionsOpen(false); void handleDeleteTask(); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-955/30 transition-colors ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
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
        <div className="px-6 py-1 shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
          <div className={`mt-2 rounded-xl border px-3 py-2.5 text-xs font-semibold flex items-center justify-between shadow-sm animate-enter ${
            feedback.tone === 'error'
              ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-450 border-rose-100 dark:border-rose-900/30'
              : 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-605 dark:text-emerald-450 border-emerald-100 dark:border-emerald-900/30'
          }`}>
            <span className="flex items-center gap-2">
              <i className={feedback.tone === 'error' ? "fa-solid fa-circle-exclamation" : "fa-solid fa-circle-check"}></i>
              {feedback.message}
            </span>
            <button onClick={() => setFeedbackState({ message: '', tone: 'neutral' })} className="text-[10px] opacity-60 hover:opacity-100 cursor-pointer">
              <i className="fa-solid fa-x"></i>
            </button>
          </div>
        </div>
      )}

      {/* ═══ TWO-COLUMN SPLIT CONTAINER ═══ */}
      <div className={`flex-1 overflow-hidden flex flex-col ${isRTL ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
        
        {/* ═══ LEFT PANEL (65%): Main Content, Title, Description, Checklist, Discussion ═══ */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 min-w-0">
          
          {/* Title Area */}
          <div className="space-y-1">
            {isEditingTitle ? (
              <div className="flex gap-2 items-center w-full">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-2xl font-bold px-3 py-1.5 border-2 border-primary rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex-1 outline-none shadow-sm focus:ring-0"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                />
                <button
                  onClick={() => void handleSaveTitle()}
                  className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  {t("taskDetails.template.save")}
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
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
                className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 cursor-pointer hover:text-primary dark:hover:text-primary-light transition-colors flex items-center gap-3 group leading-snug"
              >
                <span>{task.title}</span>
                <i className="fa-solid fa-pen text-[11px] text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1"></i>
              </h1>
            )}
          </div>

          {/* AI Risk Guard Banner (Glassmorphic Accent Callout) */}
          {risk && (
            <div className={`text-xs leading-relaxed p-4 rounded-2xl flex items-start gap-3.5 shadow-sm border animate-enter ${getRiskCardStyles()}`}>
              <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-900/60 flex items-center justify-center shrink-0 border border-slate-200/40 dark:border-slate-800/40 shadow-sm">
                <i className={`fa-solid fa-robot text-sm ${getRiskIconColor()}`}></i>
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("taskDetails.notices.riskLoaded")}</div>
                <p className="font-semibold text-slate-705 dark:text-slate-300">
                  {typeof risk === 'string' ? risk : (risk.summary || risk.report || t("taskDetails.notices.riskFallback"))}
                </p>
              </div>
            </div>
          )}

          {/* Quick Attributes Row (Horizontal Card Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            
            {/* Status Field */}
            <div className="space-y-1 relative">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("taskDetails.actionBar.status")}</span>
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full justify-between shadow-sm cursor-pointer ${isRTL ? "text-right" : "text-left"} ${currentStatusObj.bg} ${currentStatusObj.border}`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <i className={`${currentStatusObj.icon} ${currentStatusObj.color} text-[11px]`}></i>
                  <span className="text-slate-700 dark:text-slate-300 truncate">{getLocalizedStatusLabel(currentStatusObj.value, t)}</span>
                </span>
                <i className="fa-solid fa-chevron-down text-[8px] opacity-60"></i>
              </button>

              {statusOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)}></div>
                  <div className={`absolute top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-enter ${isRTL ? "right-0" : "left-0"}`}>
                    {STATUSES.map(s => (
                      <button
                        key={s.value}
                        onClick={async () => {
                          setStatusOpen(false);
                          try {
                            await applyTaskUpdate({ status: s.value });
                            setFeedback(t("taskDetails.feedback.statusUpdated"), 'success');
                          } catch {
                            // applyTaskUpdate already reports a user-facing error.
                          }
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${isRTL ? "text-right" : "text-left"} ${
                          task.status === s.value ? 'bg-primary-dim text-primary' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <i className={`${s.icon} ${s.color} text-[10px]`}></i>
                          <span>{getLocalizedStatusLabel(s.value, t)}</span>
                        </span>
                        {task.status === s.value && <i className="fa-solid fa-check text-[10px] text-primary"></i>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Priority Field */}
            <div className="space-y-1 relative">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("taskDetails.actionBar.priority")}</span>
              <button
                onClick={() => setPriorityOpen(!priorityOpen)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full justify-between shadow-sm cursor-pointer ${isRTL ? "text-right" : "text-left"} ${getPriorityClass(task.priority)}`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <i className={`${currentPriorityObj.icon} ${currentPriorityObj.color}`}></i>
                  <span className="truncate">{getLocalizedPriorityLabel(currentPriorityObj.value, t)}</span>
                </span>
                <i className="fa-solid fa-chevron-down text-[8px] opacity-60"></i>
              </button>

              {priorityOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPriorityOpen(false)}></div>
                  <div className={`absolute top-full mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-enter ${isRTL ? "right-0" : "left-0"}`}>
                    {PRIORITIES.map(p => (
                      <button
                        key={p.value}
                        onClick={async () => {
                          setPriorityOpen(false);
                          try {
                            await applyTaskUpdate({ priority: p.value });
                            setFeedback(t("taskDetails.feedback.priorityUpdated"), 'success');
                          } catch {
                            // applyTaskUpdate already reports a user-facing error.
                          }
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer ${isRTL ? "text-right" : "text-left"} ${
                          task.priority === p.value ? 'bg-primary-dim text-primary' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <i className={`${p.icon} ${p.color} text-[10px]`}></i>
                          <span>{getLocalizedPriorityLabel(p.value, t)}</span>
                        </span>
                        {task.priority === p.value && <i className="fa-solid fa-check text-[10px] text-primary"></i>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Assignee Field */}
            <div className="space-y-1 relative">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("taskDetails.actionBar.assignee")}</span>
              <button
                onClick={() => setAssigneeOpen(!assigneeOpen)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full justify-between shadow-sm cursor-pointer ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
              >
                <span className={`flex items-center gap-2 truncate ${isRTL ? "flex-row-reverse" : ""}`}>
                  {task.assignee ? (
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee.name)}&background=00a8e8&color=fff`}
                      alt={task.assignee.name}
                      className="w-4 h-4 rounded-full shrink-0"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] text-slate-400 shrink-0">
                      <i className="fa-regular fa-user"></i>
                    </div>
                  )}
                  <span className="text-slate-750 dark:text-slate-250 truncate">
                    {task.assignee ? task.assignee.name : t("taskDetails.defaults.unassigned")}
                  </span>
                </span>
                <i className="fa-solid fa-chevron-down text-[8px] opacity-60"></i>
              </button>

              {assigneeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setAssigneeOpen(false); setAssigneeSearch(''); }}></div>
                  <div className={`absolute top-full mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-202 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2 flex flex-col gap-1.5 animate-enter ${isRTL ? "right-0" : "left-0"}`}>
                    <input
                      type="text"
                      placeholder={t("taskDetails.template.memberSearchPlaceholder")}
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className={`px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none ${isRTL ? "text-right" : "text-left"}`}
                    />
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      <button
                        onClick={async () => {
                          setAssigneeOpen(false);
                          setAssigneeSearch('');
                          try {
                            await applyTaskUpdate({ assigneeIds: [] });
                            setFeedback(t("taskDetails.feedback.assigneeCleared"), 'success');
                          } catch {
                            // applyTaskUpdate already reports a user-facing error.
                          }
                        }}
                        className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-505 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                      >
                        <i className="fa-solid fa-user-slash text-[10px] w-4 text-center"></i>
                        <span>{t("taskDetails.template.unassign")}</span>
                      </button>

                      {filteredMembers.map(m => {
                        const id = getMemberId(m);
                        const name = getMemberName(m);
                        return (
                          <button
                            key={id}
                            onClick={async () => {
                              setAssigneeOpen(false);
                              setAssigneeSearch('');
                              try {
                                await applyTaskUpdate({ assigneeIds: [id] });
                                setFeedback(t("taskDetails.feedback.assigneeUpdated"), 'success');
                              } catch {
                                // applyTaskUpdate already reports a user-facing error.
                              }
                            }}
                            className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 cursor-pointer ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                          >
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a8e8&color=fff`} className="w-4 h-4 rounded-full shrink-0" alt="avatar" />
                            <span className="truncate flex-1">{name}</span>
                            {task.assignee?.id === id && <i className="fa-solid fa-check text-[10px] text-primary"></i>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Due Date Field */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("taskDetails.template.dueDate")}</span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold w-full shadow-sm">
                <i className="fa-regular fa-calendar text-slate-400 shrink-0"></i>
                <input
                  type="date"
                  value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    try {
                      await applyTaskUpdate({ dueDate: val ? new Date(val).toISOString() : null });
                      setFeedback(t("taskDetails.feedback.dueDateUpdated"), 'success');
                    } catch {
                      // applyTaskUpdate already reports a user-facing error.
                    }
                  }}
                  className={`bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer outline-none p-0 focus:ring-0 w-full ${isRTL ? "text-right" : "text-left"}`}
                />
              </div>
            </div>

          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 dark:border-slate-900">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider">{t("taskDetails.template.description")}</span>
              {!isEditingDesc && (
                <button
                  onClick={() => {
                    setEditedDesc(task.description || '');
                    setIsEditingDesc(true);
                  }}
                  className="text-xs text-primary hover:text-primary-dark font-bold hover:underline cursor-pointer"
                >
                  <i className={`fa-regular fa-pen-to-square ${isRTL ? "ml-1" : "mr-1"}`}></i>{t("taskDetails.template.edit")}
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div className="space-y-2.5 animate-enter">
                <textarea
                  value={editedDesc}
                  onChange={(e) => setEditedDesc(e.target.value)}
                  className="w-full p-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-xs outline-none min-h-[120px] focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
                  placeholder={t("taskDetails.template.descriptionPlaceholder")}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSaveDesc()}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors"
                  >
                    {t("taskDetails.template.saveChanges")}
                  </button>
                  <button
                    onClick={() => setIsEditingDesc(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-550 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {t("taskDetails.template.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className={`text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 font-sans ${isRTL ? "pl-2 text-right" : "pr-2 text-left"}`}>
                {task.description ? (
                  task.description.split(/\n{2,}/).map((p, idx) => (
                    <p key={idx} className="whitespace-pre-wrap">{p.trim()}</p>
                  ))
                ) : (
                  <p className="text-slate-400 italic">{t("taskDetails.notices.noDescriptionDetailed")}</p>
                )}
              </div>
            )}
          </div>

          {/* Checklist Subtasks Block */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            
            {/* Checklist Header & Status */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-list-check text-primary text-xs"></i>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("taskDetails.template.checklistTitle")}</span>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700/30">
                  {completedSubtasksCount} / {totalSubtasksCount}
                </span>
              </div>
              
              {!isAddingSubtask && (
                <button
                  onClick={() => setIsAddingSubtask(true)}
                  className="text-xs text-primary hover:text-primary-dark font-bold cursor-pointer hover:underline"
                >
                  <i className={`fa-solid fa-plus ${isRTL ? "ml-1" : "mr-1"}`}></i>{t("taskDetails.template.addSubtask")}
                </button>
              )}
            </div>

            {/* Checklist Completion Progress bar */}
              {totalSubtasksCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                    <span>{t("taskDetails.template.taskProgress")}</span>
                    <span>{subtasksProgressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${subtasksProgressPercent}%` }}
                  ></div>
                </div>
              </div>
            )}

              {/* Checklist Items list */}
              <div className="space-y-1">
                {isAddingSubtask && (
                  <form onSubmit={handleAddSubtask} className={`flex gap-2 py-1.5 animate-enter ${isRTL ? "flex-row-reverse" : ""}`}>
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder={t("taskDetails.template.subtaskPlaceholder")}
                      className={`text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none flex-1 focus:border-primary focus:ring-1 focus:ring-primary transition-all ${isRTL ? "text-right" : "text-left"}`}
                      autoFocus
                    />
                  <button type="submit" className="px-3.5 py-1 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-sm">{t("taskDetails.template.add")}</button>
                  <button type="button" onClick={() => setIsAddingSubtask(false)} className="px-3.5 py-1 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">{t("taskDetails.template.cancel")}</button>
                </form>
              )}

              {task.subtasks && task.subtasks.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {task.subtasks.map((sub, i) => {
                    const isDone = sub.status === 'DONE';
                    return (
                      <div
                        key={sub.id}
                        onClick={() => void handleToggleSubtask(sub.id, sub.status)}
                        className={`flex items-center justify-between py-2.5 px-1 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 rounded-xl transition-colors cursor-pointer group text-xs ${isRTL ? "flex-row-reverse text-right" : ""}`}
                      >
                        <div className={`flex items-center gap-3 min-w-0 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <div className="shrink-0 flex items-center justify-center">
                            {isDone ? (
                              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] transition-all">
                                <i className="fa-solid fa-check"></i>
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 group-hover:border-primary transition-all"></div>
                            )}
                          </div>
                          <span className={`font-medium truncate ${isDone ? 'text-slate-400 line-through dark:text-slate-550' : 'text-slate-700 dark:text-slate-250'}`}>
                            {sub.title || `${t("taskDetails.template.subtasks")} ${i + 1}`}
                          </span>
                        </div>
                        {sub.dueDate && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/20 dark:border-slate-700/10 font-medium">
                            <i className={`fa-regular fa-calendar-minus opacity-70 ${isRTL ? "ml-1" : "mr-1"}`}></i>
                            {new Date(sub.dueDate).toLocaleDateString(locale, {month: 'short', day: 'numeric'})}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !isAddingSubtask && (
                  <div className="text-center py-5 text-slate-400 italic">
                    {t("taskDetails.notices.noSubtasksConfigured")}
                  </div>
                )
              )}
            </div>

          </div>

          {/* ═══ ACTIVITY TIMELINE / COMMENTS (Main column bottom) ═══ */}
          <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-900">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("taskDetails.template.activityDiscussion")}</span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                {t("taskDetails.template.commentsCount", { count: comments.length })}
              </span>
            </div>

            {/* Polished Expandable Comment Box */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 bg-white dark:bg-slate-900 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 dark:focus-within:ring-primary/10 focus-within:border-primary transition-all">
              <textarea
                value={commentText}
                onChange={(e) => handleCommentTextChange(e.target.value)}
                onFocus={() => setIsCommentFocused(true)}
                className={`w-full bg-transparent border-none text-xs outline-none resize-none placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 leading-relaxed focus:ring-0 ${
                  isCommentFocused ? 'min-h-[72px]' : 'min-h-[32px]'
                }`}
                placeholder={t("taskDetails.template.commentEditorPlaceholder")}
              />
              
              {taskTypingUsers.length > 0 && (
                <div className="text-[10px] text-slate-400 italic px-1 py-0.5 mt-1 animate-pulse">
                  {taskTypingUsers.map((u) => u.name).join(", ")}{" "}
                  {t("taskDetails.template.typing", { count: taskTypingUsers.length })}
                </div>
              )}
              
              {isCommentFocused && (
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-2 animate-enter shrink-0">
                  <div className="flex gap-1.5 text-slate-400 dark:text-slate-500 text-xs">
                    <button type="button" className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 rounded-md transition-colors" title={t("taskDetails.template.mention")}><i className="fa-solid fa-at"></i></button>
                    <button type="button" className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 rounded-md transition-colors" title={t("taskDetails.template.emoji")}><i className="fa-regular fa-face-smile"></i></button>
                    <button type="button" className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 rounded-md transition-colors" title={t("taskDetails.template.bold")}><i className="fa-solid fa-bold"></i></button>
                    <button type="button" className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 rounded-md transition-colors" title={t("taskDetails.template.codeBlock")}><i className="fa-solid fa-code"></i></button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setCommentText(''); setIsCommentFocused(false); }}
                      className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-[11px] font-bold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {t("taskDetails.template.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-lg disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                    >
                      {t("taskDetails.template.postComment")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Unified Chronological Activity Feed */}
            <div className={`relative space-y-4 before:absolute before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200 dark:before:bg-slate-800 before:rounded ${isRTL ? "pr-4 before:right-2" : "pl-4 before:left-2"}`}>
              {timelineEvents.map((event) => {
                if (event.isSystem) {
                  return (
                    <div key={event.id} className={`relative flex items-center gap-2.5 text-[11px] text-slate-400 font-semibold py-1 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                      {/* Timeline marker */}
                      <div className={`absolute w-2 h-2 rounded-full border border-white dark:border-slate-900 bg-slate-300 dark:bg-slate-600 shadow-sm ${isRTL ? "-right-[17.5px]" : "-left-[17.5px]"}`}></div>
                      <span>
                        <span className="text-slate-500 dark:text-slate-300 font-bold">{event.authorName}</span> {event.text}
                      </span>
                      <span className="text-[10px] font-normal text-slate-400/80">{timeAgo(event.createdAt, t, locale)}</span>
                    </div>
                  );
                }

                // Standard message comment card
                const isOwnComment = currentUser && (event.rawComment.userId === currentUser.id || event.rawComment.author?.id === currentUser.id);

                return (
                  <div key={event.id} className={`relative flex gap-3 text-xs group ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                    {/* Timeline marker */}
                    <div className={`absolute top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-primary shadow-sm shrink-0 z-10 ${isRTL ? "-right-[18.5px]" : "-left-[18.5px]"}`}></div>
                    
                    {/* Comment card wrapper */}
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[9px] shrink-0 select-none shadow-sm">
                      {getInitials(event.authorName)}
                    </div>
                    <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-shadow">
                      <div className={`flex justify-between items-baseline mb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{event.authorName}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{timeAgo(event.createdAt, t, locale)}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-305 leading-relaxed font-normal whitespace-pre-wrap">
                        {event.rawComment.body || event.rawComment.text || event.rawComment.content}
                      </p>
                      
                      <div className="flex gap-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/40">
                        <button className="hover:text-primary transition-colors cursor-pointer">{t("taskDetails.template.reply")}</button>
                        <span>•</span>
                        {isOwnComment && (
                          <button
                            onClick={() => void handleDeleteComment(event.id)}
                            className="text-rose-500/80 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            {t("taskDetails.template.delete")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {timelineEvents.length === 1 && comments.length === 0 && (
                <div className={`text-xs text-slate-400 italic py-1 ${isRTL ? "pr-2 text-right" : "pl-2 text-left"}`}>
                  {t("taskDetails.notices.noCommentsYet")}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ═══ RIGHT PANEL (35%): Sidebar widgets (Time tracker, Linked tasks, Watchers, Attachments) ═══ */}
        <div className={`w-full lg:w-80 xl:w-96 border-t lg:border-t-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-7 overflow-y-auto space-y-6 shrink-0 ${isRTL ? "lg:border-r" : "lg:border-l"}`}>
          
          {/* Time Tracking Widget */}
          <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-805 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-regular fa-clock text-slate-400"></i>
                {t("taskDetails.template.timeLogged")}
              </span>
              <button
                onClick={() => setTimeLogOpen(!timeLogOpen)}
                className="text-xs text-primary hover:text-primary-dark font-bold hover:underline cursor-pointer"
              >
                <i className={`fa-solid fa-plus-minus ${isRTL ? "ml-1" : "mr-1"}`}></i>{t("taskDetails.template.logHours")}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{totalHours}h</span>
                <span className="text-xs text-slate-400">{t("taskDetails.template.estimatedTime", { hours: estimatedHours })}</span>
              </div>
              
              {estimatedHours > 0 && (
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      timePercent >= 100 ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${timePercent}%` }}
                  ></div>
                </div>
              )}
            </div>

            {/* Time logging popover dropdown form */}
            {timeLogOpen && (
              <form onSubmit={handleLogTime} className="mt-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-xl space-y-3 shadow-md animate-enter">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t("taskDetails.template.hours")}</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder={t("taskDetails.template.hoursPlaceholder")}
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-primary"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t("taskDetails.template.notes")}</label>
                  <input
                    type="text"
                    placeholder={t("taskDetails.template.workDescriptionPlaceholder")}
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-955 text-slate-850 dark:text-slate-200 outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setTimeLogOpen(false)}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t("taskDetails.template.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    {t("taskDetails.template.logTime")}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sign-offs & Workflows Widget */}
          <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
            <span className="font-bold text-slate-705 dark:text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <i className="fa-solid fa-stamp text-slate-400"></i>
              {t("taskDetails.template.signOffsAndWorkflows")}
            </span>

            {/* Task-level Approvals */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>{t("taskDetails.template.taskApprovals")}</span>
                {spaceMembers.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        requestApprovalMutation.mutate(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="bg-transparent border-none text-primary font-bold hover:underline cursor-pointer outline-none max-w-[120px] text-[10px]"
                  >
                    <option value="">{t("taskDetails.template.requestSignOff")}</option>
                    {spaceMembers.map((member) => {
                      const id = member.user?.id || member.id;
                      const name = member.user?.name || member.name || t("taskDetails.defaults.member");
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                {taskApprovalsQuery.data && taskApprovalsQuery.data.length > 0 ? (
                  taskApprovalsQuery.data.map((app) => {
                    const reviewerName = app.reviewer?.name || t("taskDetails.template.reviewerFallback");
                    const isReviewer = currentUser && app.reviewerId === currentUser.id;
                    return (
                      <div key={app.id} className="flex flex-col gap-1.5 p-2 bg-slate-50/60 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/40 rounded-xl text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-700 dark:text-slate-350">{reviewerName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            app.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            app.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                            'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            {app.status}
                          </span>
                        </div>
                        {isReviewer && app.status === 'PENDING' && (
                          <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-850">
                            <button
                              onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, status: 'APPROVED' })}
                              className="flex-1 text-[10px] font-bold text-emerald-605 hover:text-emerald-700 transition"
                            >
                              {t("aiAssistant.labels.actions.approve", { defaultValue: "Approve" })}
                            </button>
                            <button
                              onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, status: 'REJECTED' })}
                              className="flex-1 text-[10px] font-bold text-rose-605 hover:text-rose-700 transition"
                            >
                              {t("aiAssistant.labels.actions.reject", { defaultValue: "Reject" })}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-slate-400 italic">{t("taskDetails.notices.noCustomSignOffs")}</div>
                )}
              </div>
            </div>

            {/* Workflow definitions to start */}
            <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>{t("taskDetails.template.activeWorkflows")}</span>
                {workflowDefsQuery.data && workflowDefsQuery.data.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        startWorkflowMutation.mutate(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="bg-transparent border-none text-primary font-bold hover:underline cursor-pointer outline-none max-w-[120px] text-[10px]"
                  >
                    <option value="">{t("taskDetails.template.startWorkflow")}</option>
                    {workflowDefsQuery.data
                      .filter((def) => def.isActive)
                      .map((def) => (
                        <option key={def.id} value={def.id}>
                          {def.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {taskWorkflows.length > 0 ? (
                <div className="space-y-1.5">
                  {taskWorkflows.map((inst) => (
                    <div key={inst.id} className="p-2 bg-slate-50/60 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/40 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700 dark:text-slate-355">{inst.definition?.name || t("taskDetails.defaults.workflow")}</span>
                        <span className="text-[9px] font-bold text-indigo-605 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                          {inst.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t("taskDetails.template.currentStep", { step: inst.currentStep + 1 })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic">{t("taskDetails.template.noActiveWorkflows")}</div>
              )}
            </div>
          </div>

          {/* Linked Tasks Card */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">{t("taskDetails.template.linkedTasks")}</span>
            
            {task.dependencies && task.dependencies.length > 0 ? (
              <div className="space-y-1.5">
                {task.dependencies.map((dep) => (
                  <div
                    key={dep.id}
                    className={`flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/40 rounded-xl text-xs hover:border-slate-350 dark:hover:text-slate-700 transition-colors ${isRTL ? "flex-row-reverse text-right" : ""}`}
                  >
                    <div className={`flex items-center gap-2 min-w-0 flex-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className="text-[9px] font-extrabold tracking-wider bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-455 px-1.5 py-0.5 rounded border border-rose-100/60 dark:border-rose-900/30 uppercase shrink-0">
                        {dep.type || t("taskDetails.template.requires")}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {dep.dependsOn?.identifier || t("taskDetails.defaults.task")}
                      </span>
                      <span className={`text-slate-800 dark:text-slate-250 truncate ${isRTL ? "pl-1" : "pr-1"}`}>
                        {dep.dependsOn?.title || t("taskDetails.template.blockingRequirements")}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${getStatusBadgeClass(dep.dependsOn?.status)}`}>
                      {getLocalizedStatusLabel(dep.dependsOn?.status || "TODO", t)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">{t("taskDetails.notices.noRelationsConfigured")}</div>
            )}
          </div>

          {/* Watchers Card */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">{t("taskDetails.template.watchers")}</span>
            <div className="flex flex-wrap gap-1.5">
              {task.watchers && task.watchers.length > 0 ? (
                task.watchers.map((w, idx) => {
                  const name = getMemberName(w.user);
                  return (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-600 dark:text-slate-350 shadow-sm"
                      title={name}
                    >
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`}
                        alt="avatar"
                        className="w-4.5 h-4.5 rounded-full shrink-0"
                      />
                      <span className="truncate max-w-[80px]">{name}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 italic">{t("taskDetails.notices.noWatchers")}</div>
              )}
            </div>
          </div>

          {/* Attachments Card */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center pb-1">
              <span className="text-[10px] font-bold text-slate-405 dark:text-slate-505 uppercase tracking-wider block">{t("taskDetails.template.attachments")}</span>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary hover:text-primary-dark font-bold hover:underline cursor-pointer"
              >
                <i className={`fa-solid fa-arrow-up-from-bracket ${isRTL ? "ml-1" : "mr-1"}`}></i>{t("taskDetails.actionBar.uploadFile")}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            </div>

            {files.length > 0 ? (
              <div className="space-y-1.5">
                {files.map((file) => {
                  const ext = String(file.name || '').split('.').pop()?.toLowerCase();
                  const downloadUrl = file.url || file.downloadUrl || `${import.meta.env.VITE_API_URL || '/api/v1'}/files/${file.id}/download`;
                  
                  // Deduce icon based on extension
                  let fileIcon = "fa-regular fa-file text-slate-400";
                  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                    fileIcon = "fa-regular fa-file-image text-emerald-500";
                  } else if (ext === 'pdf') {
                    fileIcon = "fa-regular fa-file-pdf text-rose-500";
                  } else if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
                    fileIcon = "fa-regular fa-file-zipper text-amber-500";
                  } else if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'go'].includes(ext)) {
                    fileIcon = "fa-regular fa-file-code text-indigo-500";
                  } else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
                    fileIcon = "fa-regular fa-file-lines text-sky-500";
                  }

                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/40 rounded-xl text-xs hover:border-slate-350 dark:hover:text-slate-700 transition-colors group/file"
                    >
                      <div className={`flex items-center gap-2 truncate ${isRTL ? "pl-2 flex-row-reverse text-right" : "pr-2"}`}>
                        <i className={`fa-solid ${fileIcon} text-sm shrink-0`}></i>
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-750 dark:text-slate-300 hover:text-primary dark:hover:text-primary-light font-semibold truncate block hover:underline"
                        >
                          {file.name || t("taskDetails.defaults.attachment")}
                        </a>
                      </div>
                      <button
                        onClick={() => void handleDeleteFile(file.id)}
                        className="text-slate-400 hover:text-rose-550 opacity-0 group-hover/file:opacity-100 hover:scale-105 shrink-0 transition-all p-0.5 rounded cursor-pointer"
                        title={t("taskDetails.template.deleteAttachment")}
                      >
                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">{t("taskDetails.notices.noAttachments")}</div>
            )}
          </div>

        </div>

      </div>

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
