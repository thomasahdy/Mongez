import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { useAppContext } from '../AppContext';
import { useSocket } from '../../context/SocketContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Simple UI Helper for initials
function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
}

function getMemberId(member) {
  return member?.user?.id || member?.id || member?.userId || member?.email || '';
}

function getMemberName(member) {
  return member?.user?.name || member?.name || member?.user?.fullName || member?.fullName || member?.email || 'Member';
}

// Relative time calculation
function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Risk Severity Categorizer
function getRiskSeverity(risk) {
  if (!risk) return 'info';
  const text = (typeof risk === 'string' ? risk : risk.summary || risk.report || '').toLowerCase();
  if (text.includes('critical') || text.includes('high risk') || text.includes('danger') || text.includes('block')) {
    return 'critical';
  }
  if (text.includes('medium') || text.includes('warning') || text.includes('caution') || text.includes('attention')) {
    return 'medium';
  }
  return 'info';
}

const STATUSES = [
  { value: 'BACKLOG', label: 'Backlog', color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/40', border: 'border-slate-200 dark:border-slate-800', icon: 'fa-solid fa-inbox' },
  { value: 'TODO', label: 'To Do', color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/40', border: 'border-slate-200 dark:border-slate-800', icon: 'fa-regular fa-circle' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-950/20 text-sky-605 dark:text-sky-405 border-sky-100 dark:border-sky-900/40', icon: 'fa-solid fa-circle-half-stroke' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-955/20 text-purple-605 dark:text-purple-405 border-purple-100 dark:border-purple-900/40', icon: 'fa-regular fa-eye' },
  { value: 'BLOCKED', label: 'Blocked', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-955/20 text-rose-605 dark:text-rose-405 border-rose-100 dark:border-rose-900/40', icon: 'fa-solid fa-circle-minus' },
  { value: 'DONE', label: 'Done', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-605 dark:text-emerald-405 border-emerald-100 dark:border-emerald-900/40', icon: 'fa-regular fa-circle-check' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-900', border: 'border-slate-200 dark:border-slate-800', icon: 'fa-solid fa-ban' }
];

const PRIORITIES = [
  { value: 'NONE', label: 'None', color: 'text-slate-400', icon: 'fa-regular fa-flag' },
  { value: 'LOW', label: 'Low', color: 'text-slate-500', icon: 'fa-solid fa-flag' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-sky-500', icon: 'fa-solid fa-flag' },
  { value: 'HIGH', label: 'High', color: 'text-amber-500', icon: 'fa-solid fa-flag' },
  { value: 'URGENT', label: 'Urgent', color: 'text-rose-500', icon: 'fa-solid fa-flag' }
];

function getStatusBadgeClass(status) {
  const s = String(status || 'TODO').toUpperCase();
  if (s.includes('PROGRESS')) return 'bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/40';
  if (s.includes('DONE')) return 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40';
  if (s.includes('BLOCKED')) return 'bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/40';
  if (s.includes('REVIEW')) return 'bg-purple-50 dark:bg-purple-955/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/40';
  return 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800';
}

function getPriorityClass(priority) {
  const p = String(priority || '').toUpperCase();
  if (p === 'URGENT') return 'text-rose-500 font-bold';
  if (p === 'HIGH') return 'text-amber-500 font-bold';
  if (p === 'MEDIUM') return 'text-sky-500 font-semibold';
  if (p === 'LOW') return 'text-slate-500 font-medium';
  return 'text-slate-400';
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error in TaskDetailsPage:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto mt-12">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-955 p-6 text-center space-y-4 shadow-sm">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-200">Something went wrong rendering task details</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-xl hover:bg-sky-600 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function TaskDetailsPage() {
  const { taskId } = useParams();
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
      setFeedbackState({ message: "Approval request sent.", tone: "success" });
    },
  });

  const resolveApprovalMutation = useMutation({
    mutationFn: ({ approvalId, status }) => approvalsService.resolve(approvalId, { status }),
    onSuccess: () => {
      taskApprovalsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      setFeedbackState({ message: "Approval decision submitted.", tone: "success" });
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
      setFeedbackState({ message: "Workflow started successfully.", tone: "success" });
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
      setFeedback('Task duplicated successfully.', 'success');
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
        { name: 'Workspace', color: 'text-slate-400', ref: '/dashboard' },
        { name: taskTitle || 'Task Details', color: 'text-slate-800 dark:text-slate-200', ref: '' },
      ]);
    }
  }, [taskTitle, setPath]);

  // Set timeout helper for feedback messages
  const setFeedback = useCallback((message, tone = 'neutral') => {
    setFeedbackState({ message, tone });
    if (tone === 'success' || tone === 'neutral') {
      setTimeout(() => {
        setFeedbackState((prev) => prev.message === message ? { message: '', tone: 'neutral' } : prev);
      }, 4000);
    }
  }, []);

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
          <h3 className="text-md font-bold text-slate-800 dark:text-slate-100">Unable to load task details</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{taskDetailsQuery.error?.message || 'The task may have been deleted.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Go Back to Dashboard
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
  const remainingMinutes = Math.round(totalMinutes % 60);
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
      setFeedback(error.message || 'Failed to update task properties.', 'error');
      throw error;
    }
  };

  // Title Save Handler
  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) {
      setFeedback('Task title cannot be empty.', 'error');
      return;
    }
    if (editedTitle.trim() === task.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await applyTaskUpdate({ title: editedTitle.trim() });
      setIsEditingTitle(false);
      setFeedback('Title updated.', 'success');
    } catch (err) {}
  };

  // Description Save Handler
  const handleSaveDesc = async () => {
    try {
      await applyTaskUpdate({ description: editedDesc });
      setIsEditingDesc(false);
      setFeedback('Description updated.', 'success');
    } catch (err) {}
  };

  // Subtask Toggle Handler
  const handleToggleSubtask = async (subtaskId, currentStatus) => {
    const nextStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
    try {
      await tasksService.updateTask(subtaskId, { status: nextStatus });
      await taskDetailsQuery.refetch();
    } catch (error) {
      setFeedback('Failed to update subtask.', 'error');
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
      setFeedback('Subtask created.', 'success');
    } catch (error) {
      setFeedback('Failed to create subtask.', 'error');
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
      setFeedback('Comment added.', 'success');
    } catch (error) {
      setFeedback('Failed to save comment.', 'error');
    }
  };

  // Delete Comment Handler
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await deleteCommentMutation.mutateAsync(commentId);
      setFeedback('Comment deleted.', 'success');
    } catch (error) {
      setFeedback('Failed to delete comment.', 'error');
    }
  };

  // Delete File Attachment Handler
  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Delete this attachment permanently?')) return;
    try {
      await deleteFileMutation.mutateAsync(fileId);
      setFeedback('Attachment deleted.', 'success');
    } catch (error) {
      setFeedback('Failed to delete attachment.', 'error');
    }
  };

  // Upload File Attachment Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFeedback('Attachments must be 10 MB or smaller.', 'error');
      return;
    }
    try {
      setFeedback(`Uploading ${file.name}...`);
      await uploadMutation.mutateAsync(file);
      setFeedback('Attachment uploaded.', 'success');
    } catch (error) {
      setFeedback(error.message || 'Failed to upload file.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete Task Handler
  const handleDeleteTask = async () => {
    if (!window.confirm('Delete this task? This action cannot be undone.')) return;
    try {
      await deleteTaskMutation.mutateAsync();
      navigate(task.boardId ? `/board/${task.boardId}/table` : '/dashboard', { replace: true });
    } catch (error) {
      setFeedback(error.message || 'Unable to delete task.', 'error');
    }
  };

  // Duplicate Task Actions
  const handleDuplicateTask = async () => {
    try {
      setFeedback('Duplicating task...');
      await duplicateTaskMutation.mutateAsync({
        title: `${task.title} (Copy)`,
        description: task.description || '',
        boardId: task.boardId,
        columnId: task.columnId,
        spaceId: task.board?.department?.spaceId,
        estimatedHours: task.estimatedHours || undefined,
        priority: task.priority || 'NONE'
      });
    } catch (err) {
      setFeedback('Failed to duplicate task.', 'error');
    }
  };

  // Archive Task Action
  const handleArchiveTask = async () => {
    try {
      await applyTaskUpdate({ status: 'CANCELLED' });
      setFeedback('Task archived (status marked as Cancelled).', 'success');
    } catch (err) {}
  };

  // Log hours handler
  const handleLogTime = async (e) => {
    e.preventDefault();
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0) {
      setFeedback('Please enter a valid amount of hours.', 'error');
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
      setFeedback('Work hours logged.', 'success');
    } catch (err) {
      setFeedback(err.message || 'Failed to log hours.', 'error');
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
      authorName: task.assignee?.name || 'Owner',
      text: 'created task',
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
    <div className="w-full min-h-screen bg-slate-50/50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      
      {/* ═══ TOP HEADER / BREADCRUMB BAR ═══ */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-md font-semibold text-[11px] border border-slate-200/50 dark:border-slate-700/50">
            {task.identifier || task.id}
          </span>
          <i className="fa-solid fa-chevron-right text-[9px] text-slate-400"></i>
          <span className="hover:text-primary dark:hover:text-primary-light transition-colors cursor-pointer">{task.board?.name || 'Sprint'}</span>
          <i className="fa-solid fa-chevron-right text-[9px] text-slate-400"></i>
          <span className="text-slate-700 dark:text-slate-350">{task.type || 'Task'}</span>
        </div>

        {/* Action Dropdown Menu */}
        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setActionsOpen(!actionsOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer shadow-sm"
            title="More Actions"
          >
            <i className="fa-solid fa-ellipsis text-sm"></i>
          </button>

          {actionsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)}></div>
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-enter">
                <button
                  onClick={() => { setActionsOpen(false); void handleDuplicateTask(); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold text-slate-755 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <i className="fa-regular fa-copy w-4 text-slate-400 dark:text-slate-500"></i>
                  <span>Duplicate Task</span>
                </button>
                <button
                  onClick={() => { setActionsOpen(false); void handleArchiveTask(); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold text-slate-755 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <i className="fa-solid fa-box-archive w-4 text-slate-400 dark:text-slate-500"></i>
                  <span>Archive Task</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                <button
                  onClick={() => { setActionsOpen(false); void handleDeleteTask(); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold text-rose-600 dark:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-955/30 transition-colors"
                >
                  <i className="fa-solid fa-trash w-4 text-rose-500"></i>
                  <span>Delete Task</span>
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
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        
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
                  Save
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                >
                  Cancel
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
                <div className="font-bold text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">AI Risk Scanning</div>
                <p className="font-semibold text-slate-705 dark:text-slate-300">
                  {typeof risk === 'string' ? risk : (risk.summary || risk.report || 'Anomalies flagged in task configuration.')}
                </p>
              </div>
            </div>
          )}

          {/* Quick Attributes Row (Horizontal Card Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            
            {/* Status Field */}
            <div className="space-y-1 relative">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Status</span>
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full text-left justify-between shadow-sm cursor-pointer ${currentStatusObj.bg} ${currentStatusObj.border}`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <i className={`${currentStatusObj.icon} ${currentStatusObj.color} text-[11px]`}></i>
                  <span className="text-slate-700 dark:text-slate-300 truncate">{currentStatusObj.label}</span>
                </span>
                <i className="fa-solid fa-chevron-down text-[8px] opacity-60"></i>
              </button>

              {statusOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)}></div>
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-enter">
                    {STATUSES.map(s => (
                      <button
                        key={s.value}
                        onClick={async () => {
                          setStatusOpen(false);
                          try {
                            await applyTaskUpdate({ status: s.value });
                            setFeedback('Status updated.', 'success');
                          } catch (err) {}
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                          task.status === s.value ? 'bg-primary-dim text-primary' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <i className={`${s.icon} ${s.color} text-[10px]`}></i>
                          <span>{s.label}</span>
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
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Priority</span>
              <button
                onClick={() => setPriorityOpen(!priorityOpen)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full text-left justify-between shadow-sm cursor-pointer ${getPriorityClass(task.priority)}`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <i className={`${currentPriorityObj.icon} ${currentPriorityObj.color}`}></i>
                  <span className="truncate">{currentPriorityObj.label}</span>
                </span>
                <i className="fa-solid fa-chevron-down text-[8px] opacity-60"></i>
              </button>

              {priorityOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPriorityOpen(false)}></div>
                  <div className="absolute top-full left-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-enter">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.value}
                        onClick={async () => {
                          setPriorityOpen(false);
                          try {
                            await applyTaskUpdate({ priority: p.value });
                            setFeedback('Priority updated.', 'success');
                          } catch (err) {}
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer ${
                          task.priority === p.value ? 'bg-primary-dim text-primary' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <i className={`${p.icon} ${p.color} text-[10px]`}></i>
                          <span>{p.label}</span>
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
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Assignee</span>
              <button
                onClick={() => setAssigneeOpen(!assigneeOpen)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full text-left justify-between shadow-sm cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
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
                    {task.assignee ? task.assignee.name : 'Unassigned'}
                  </span>
                </span>
                <i className="fa-solid fa-chevron-down text-[8px] opacity-60"></i>
              </button>

              {assigneeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setAssigneeOpen(false); setAssigneeSearch(''); }}></div>
                  <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-202 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2 flex flex-col gap-1.5 animate-enter">
                    <input
                      type="text"
                      placeholder="Search member..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      <button
                        onClick={async () => {
                          setAssigneeOpen(false);
                          setAssigneeSearch('');
                          try {
                            await applyTaskUpdate({ assigneeIds: [] });
                            setFeedback('Assignee cleared.', 'success');
                          } catch (err) {}
                        }}
                        className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-505 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-user-slash text-[10px] w-4 text-center"></i>
                        <span>Unassign</span>
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
                                setFeedback('Assignee updated.', 'success');
                              } catch (err) {}
                            }}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 cursor-pointer"
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
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Due Date</span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold w-full shadow-sm">
                <i className="fa-regular fa-calendar text-slate-400 shrink-0"></i>
                <input
                  type="date"
                  value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    try {
                      await applyTaskUpdate({ dueDate: val ? new Date(val).toISOString() : null });
                      setFeedback('Due date updated.', 'success');
                    } catch (err) {}
                  }}
                  className="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer outline-none p-0 focus:ring-0 w-full"
                />
              </div>
            </div>

          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 dark:border-slate-900">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Description</span>
              {!isEditingDesc && (
                <button
                  onClick={() => {
                    setEditedDesc(task.description || '');
                    setIsEditingDesc(true);
                  }}
                  className="text-xs text-primary hover:text-primary-dark font-bold hover:underline cursor-pointer"
                >
                  <i className="fa-regular fa-pen-to-square mr-1"></i>Edit
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div className="space-y-2.5 animate-enter">
                <textarea
                  value={editedDesc}
                  onChange={(e) => setEditedDesc(e.target.value)}
                  className="w-full p-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-xs outline-none min-h-[120px] focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
                  placeholder="Describe this task details... Markdown is supported"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSaveDesc()}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditingDesc(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-550 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 pr-2 font-sans">
                {task.description ? (
                  task.description.split(/\n{2,}/).map((p, idx) => (
                    <p key={idx} className="whitespace-pre-wrap">{p.trim()}</p>
                  ))
                ) : (
                  <p className="text-slate-400 italic">No description provided. Click edit to add content.</p>
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
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Subtask Checklist</span>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700/30">
                  {completedSubtasksCount} / {totalSubtasksCount}
                </span>
              </div>
              
              {!isAddingSubtask && (
                <button
                  onClick={() => setIsAddingSubtask(true)}
                  className="text-xs text-primary hover:text-primary-dark font-bold cursor-pointer hover:underline"
                >
                  <i className="fa-solid fa-plus mr-1"></i>Add Subtask
                </button>
              )}
            </div>

            {/* Checklist Completion Progress bar */}
            {totalSubtasksCount > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                  <span>Task progress</span>
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
                <form onSubmit={handleAddSubtask} className="flex gap-2 py-1.5 animate-enter">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="E.g., Complete UI integration review..."
                    className="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none flex-1 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    autoFocus
                  />
                  <button type="submit" className="px-3.5 py-1 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-sm">Add</button>
                  <button type="button" onClick={() => setIsAddingSubtask(false)} className="px-3.5 py-1 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">Cancel</button>
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
                        className="flex items-center justify-between py-2.5 px-1 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 rounded-xl transition-colors cursor-pointer group text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
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
                            {sub.title || `Subtask ${i + 1}`}
                          </span>
                        </div>
                        {sub.dueDate && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/20 dark:border-slate-700/10 font-medium">
                            <i className="fa-regular fa-calendar-minus mr-1 opacity-70"></i>
                            {new Date(sub.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !isAddingSubtask && (
                  <div className="text-center py-5 text-slate-400 italic">
                    No subtasks configured. Add items to track checklists.
                  </div>
                )
              )}
            </div>

          </div>

          {/* ═══ ACTIVITY TIMELINE / COMMENTS (Main column bottom) ═══ */}
          <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-900">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Activity & Discussion</span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                {comments.length} comment{comments.length !== 1 ? 's' : ''}
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
                placeholder="Write a comment... Markdown supported (@mention members)"
              />
              
              {taskTypingUsers.length > 0 && (
                <div className="text-[10px] text-slate-400 italic px-1 py-0.5 mt-1 animate-pulse">
                  {taskTypingUsers.map((u) => u.name).join(", ")}{" "}
                  {taskTypingUsers.length === 1 ? "is" : "are"} typing...
                </div>
              )}
              
              {isCommentFocused && (
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-2 animate-enter shrink-0">
                  <div className="flex gap-1.5 text-slate-400 dark:text-slate-500 text-xs">
                    <button type="button" className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 rounded-md transition-colors" title="Mention"><i className="fa-solid fa-at"></i></button>
                    <button type="button" className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 rounded-md transition-colors" title="Emoji"><i className="fa-regular fa-face-smile"></i></button>
                    <button type="button" className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 rounded-md transition-colors" title="Bold"><i className="fa-solid fa-bold"></i></button>
                    <button type="button" className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 rounded-md transition-colors" title="Code Block"><i className="fa-solid fa-code"></i></button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setCommentText(''); setIsCommentFocused(false); }}
                      className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-[11px] font-bold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-lg disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                    >
                      Post Comment
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Unified Chronological Activity Feed */}
            <div className="relative pl-4 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200 dark:before:bg-slate-800 before:rounded">
              {timelineEvents.map((event) => {
                if (event.isSystem) {
                  return (
                    <div key={event.id} className="relative flex items-center gap-2.5 text-[11px] text-slate-400 font-semibold py-1">
                      {/* Timeline marker */}
                      <div className="absolute -left-[17.5px] w-2 h-2 rounded-full border border-white dark:border-slate-900 bg-slate-300 dark:bg-slate-600 shadow-sm"></div>
                      <span>
                        <span className="text-slate-500 dark:text-slate-300 font-bold">{event.authorName}</span> {event.text}
                      </span>
                      <span className="text-[10px] font-normal text-slate-400/80">{timeAgo(event.createdAt)}</span>
                    </div>
                  );
                }

                // Standard message comment card
                const isOwnComment = currentUser && (event.rawComment.userId === currentUser.id || event.rawComment.author?.id === currentUser.id);

                return (
                  <div key={event.id} className="relative flex gap-3 text-xs group">
                    {/* Timeline marker */}
                    <div className="absolute -left-[18.5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-primary shadow-sm shrink-0 z-10"></div>
                    
                    {/* Comment card wrapper */}
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[9px] shrink-0 select-none shadow-sm">
                      {getInitials(event.authorName)}
                    </div>
                    <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{event.authorName}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{timeAgo(event.createdAt)}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-305 leading-relaxed font-normal whitespace-pre-wrap">
                        {event.rawComment.body || event.rawComment.text || event.rawComment.content}
                      </p>
                      
                      <div className="flex gap-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/40">
                        <button className="hover:text-primary transition-colors cursor-pointer">Reply</button>
                        <span>•</span>
                        {isOwnComment && (
                          <button
                            onClick={() => void handleDeleteComment(event.id)}
                            className="text-rose-500/80 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {timelineEvents.length === 1 && comments.length === 0 && (
                <div className="text-xs text-slate-400 italic pl-2 py-1">
                  No comments yet. Start the conversation...
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ═══ RIGHT PANEL (35%): Sidebar widgets (Time tracker, Linked tasks, Watchers, Attachments) ═══ */}
        <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-7 overflow-y-auto space-y-6 shrink-0">
          
          {/* Time Tracking Widget */}
          <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-805 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-regular fa-clock text-slate-400"></i>
                Time logged
              </span>
              <button
                onClick={() => setTimeLogOpen(!timeLogOpen)}
                className="text-xs text-primary hover:text-primary-dark font-bold hover:underline cursor-pointer"
              >
                <i className="fa-solid fa-plus-minus mr-1"></i>Log hours
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{totalHours}h</span>
                <span className="text-xs text-slate-400">of {estimatedHours}h estimate</span>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 2.5"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-primary"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Notes</label>
                  <input
                    type="text"
                    placeholder="Work description..."
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    Log Time
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sign-offs & Workflows Widget */}
          <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
            <span className="font-bold text-slate-705 dark:text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <i className="fa-solid fa-stamp text-slate-400"></i>
              Sign-offs & Workflows
            </span>

            {/* Task-level Approvals */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Task Approvals</span>
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
                    <option value="">+ Request sign-off</option>
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

              <div className="space-y-1.5">
                {taskApprovalsQuery.data && taskApprovalsQuery.data.length > 0 ? (
                  taskApprovalsQuery.data.map((app) => {
                    const reviewerName = app.reviewer?.name || "Reviewer";
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
                              Approve
                            </button>
                            <button
                              onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, status: 'REJECTED' })}
                              className="flex-1 text-[10px] font-bold text-rose-605 hover:text-rose-700 transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-slate-400 italic">No custom sign-off requested.</div>
                )}
              </div>
            </div>

            {/* Workflow definitions to start */}
            <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Active Workflows</span>
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
                    <option value="">+ Start workflow</option>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-355">{inst.definition?.name || "Workflow"}</span>
                        <span className="text-[9px] font-bold text-indigo-605 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                          {inst.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Current Step: {inst.currentStep + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic">No active workflow running.</div>
              )}
            </div>
          </div>

          {/* Linked Tasks Card */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">Linked Tasks</span>
            
            {task.dependencies && task.dependencies.length > 0 ? (
              <div className="space-y-1.5">
                {task.dependencies.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/40 rounded-xl text-xs hover:border-slate-350 dark:hover:text-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[9px] font-extrabold tracking-wider bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-455 px-1.5 py-0.5 rounded border border-rose-100/60 dark:border-rose-900/30 uppercase shrink-0">
                        {dep.type || 'Requires'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {dep.dependsOn?.identifier || 'Task'}
                      </span>
                      <span className="text-slate-800 dark:text-slate-250 truncate pr-1">
                        {dep.dependsOn?.title || 'Blocking requirements'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${getStatusBadgeClass(dep.dependsOn?.status)}`}>
                      {dep.dependsOn?.status || 'TODO'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">No relations configured.</div>
            )}
          </div>

          {/* Watchers Card */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">Watchers</span>
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
                <div className="text-xs text-slate-400 italic">No watchers.</div>
              )}
            </div>
          </div>

          {/* Attachments Card */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center pb-1">
              <span className="text-[10px] font-bold text-slate-405 dark:text-slate-505 uppercase tracking-wider block">Attachments</span>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary hover:text-primary-dark font-bold hover:underline cursor-pointer"
              >
                <i className="fa-solid fa-arrow-up-from-bracket mr-1"></i>Add File
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
                      <div className="flex items-center gap-2 truncate pr-2">
                        <i className={`fa-solid ${fileIcon} text-sm shrink-0`}></i>
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-750 dark:text-slate-300 hover:text-primary dark:hover:text-primary-light font-semibold truncate block hover:underline"
                        >
                          {file.name || 'Attachment'}
                        </a>
                      </div>
                      <button
                        onClick={() => void handleDeleteFile(file.id)}
                        className="text-slate-400 hover:text-rose-550 opacity-0 group-hover/file:opacity-100 hover:scale-105 shrink-0 transition-all p-0.5 rounded cursor-pointer"
                        title="Delete attachment"
                      >
                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">No attachments.</div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}

export default function TaskDetailsPageWithBoundary() {
  return (
    <ErrorBoundary>
      <TaskDetailsPage />
    </ErrorBoundary>
  );
}
