import { useCallback } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { ReferencePage } from '../reference/ReferencePage';
import { useAppContext } from '../AppContext';
import {
  useTaskCommentMutation,
  useTaskDeleteMutation,
  useTaskDetailsQuery,
  useTaskUpdateMutation,
  useTaskUploadMutation,
} from '../../hooks/useTaskDetailsQueries';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.subtasks)) return payload.subtasks;
  if (Array.isArray(payload?.relations)) return payload.relations;
  if (Array.isArray(payload?.comments)) return payload.comments;
  if (Array.isArray(payload?.attachments)) return payload.attachments;
  if (Array.isArray(payload?.watchers)) return payload.watchers;
  if (Array.isArray(payload?.timeLogs)) return payload.timeLogs;
  return [];
}

function label(value) {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.name || value.email || value.fullName || 'User';
}

function initials(value) {
  return String(label(value))
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
}

function avatar(value, background = '#00a8e8') {
  const name = encodeURIComponent(label(value));
  return `<img src="https://ui-avatars.com/api/?name=${name}&background=${background.replace('#', '')}&color=fff" style="width:22px;height:22px;border-radius:50%;"> ${label(value)}`;
}

function statusClass(status) {
  const normalized = String(status || 'TODO').toUpperCase();
  if (normalized.includes('PROGRESS')) return 'status-in-progress';
  if (normalized.includes('DONE')) return 'status-done';
  if (normalized.includes('WAIT')) return 'status-waiting';
  return 'status-todo';
}

function priorityClass(priority) {
  const normalized = String(priority || '').toUpperCase();
  if (normalized.includes('URGENT')) return 'priority-urgent-chip';
  if (normalized.includes('HIGH')) return 'priority-high';
  if (normalized.includes('MEDIUM')) return 'priority-normal-chip';
  return '';
}

function renderPageNotice(root, className, message) {
  const container = root.querySelector('.task-detail-container');
  if (!container) return;
  container.querySelector('[data-task-page-note]')?.remove();
  const note = document.createElement('div');
  note.setAttribute('data-task-page-note', 'true');
  note.className = className;
  note.textContent = message;
  container.prepend(note);
}

function setText(root, selector, text) {
  const node = root.querySelector(selector);
  if (node) node.textContent = text || '—';
}

function hydrateTask(root, task) {
  if (!task) return;
  setText(root, '.task-id-badge', `# ${task.id || task.key || task.number || 'Task'}`);
  setText(root, '.task-title', task.title || task.name || 'Untitled task');
  setText(root, '.task-description', '');
  const description = root.querySelector('.task-description');
  if (description) {
    const descriptionText = task.description || task.body || 'No description provided.';
    descriptionText.split(/\n{2,}/).forEach((paragraph) => {
      const p = document.createElement('p');
      p.textContent = paragraph.trim();
      description.appendChild(p);
    });
  }

  const statusNode = root.querySelector('.attr-value.status-badge');
  if (statusNode) {
    statusNode.className = `attr-value status-badge ${statusClass(task.status)}`;
    statusNode.innerHTML = `<i class="fa-solid fa-circle-half-stroke"></i> ${task.status || 'To Do'}`;
  }

  const assigneeNode = root.querySelector('.attr-group:nth-of-type(2) .attr-value');
  if (assigneeNode) assigneeNode.innerHTML = avatar(task.assignee || task.assignees?.[0] || task.createdBy, '#00a8e8');

  const dueNode = root.querySelector('.attr-group:nth-of-type(3) .attr-value');
  if (dueNode) dueNode.innerHTML = `<i class="fa-regular fa-calendar" style="color:var(--text-tertiary);"></i> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}`;

  const priorityNode = root.querySelector('.attr-group:nth-of-type(4) .attr-value');
  if (priorityNode) {
    priorityNode.className = `attr-value ${priorityClass(task.priority)}`;
    priorityNode.innerHTML = `<i class="fa-solid fa-flag"></i> ${task.priority || 'Normal'}`;
  }

  const progressNode = root.querySelector('.custom-field-value');
  if (progressNode) progressNode.textContent = `${task.progress ?? task.percentDone ?? task.percentComplete ?? 0}%`;
  const progressFill = root.querySelector('.progress-mini-fill');
  if (progressFill) progressFill.style.width = `${task.progress ?? task.percentDone ?? task.percentComplete ?? 0}%`;
}

function hydrateSubtasks(root, subtasks) {
  const list = root.querySelector('.subtask-list');
  if (!list) return;
  const items = asArray(subtasks);
  list.innerHTML = items.length ? items.map((item, index) => `
    <label class="subtask-item">
      <input type="checkbox" class="checkbox" ${item.completed || item.done ? 'checked' : ''}>
      <span class="subtask-title">${item.title || item.name || `Subtask ${index + 1}`}</span>
      <div class="subtask-meta">
        <span class="subtask-due">${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</span>
        ${item.assignee ? avatar(item.assignee, '#10b981') : '<div style="width:22px;height:22px;border-radius:50%;background:var(--bg-hover);color:var(--text-tertiary);display:flex;align-items:center;justify-content:center;font-size:10px;"><i class="fa-regular fa-user"></i></div>'}
      </div>
    </label>
  `).join('') : '<div class="text-sm text-slate-500">No subtasks returned.</div>';
}

function hydrateRelations(root, relations) {
  const list = root.querySelector('.linked-tasks');
  if (!list) return;
  const items = asArray(relations);
  list.innerHTML = items.length ? items.map((item) => `
    <div class="linked-task-item">
      <span class="link-type blocked-by">${item.type || item.relationType || 'Related'}</span>
      <span class="linked-task-id">${item.relatedTaskId || item.taskId || item.id || 'Task'}</span>
      <span class="linked-task-name">${item.title || item.name || 'Linked task'}</span>
      <span class="linked-task-status lts-progress">${item.status || 'Linked'}</span>
    </div>
  `).join('') : '<div class="text-sm text-slate-500">No linked tasks returned.</div>';
}

function hydrateComments(root, comments) {
  const feed = root.querySelector('.activity-feed');
  if (!feed) return;
  const items = asArray(comments);
  feed.innerHTML = items.length ? items.map((item) => {
    const author = item.author || item.user || item.createdBy;
    return `
      <div class="feed-item">
        ${author ? `<div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;margin-right:12px;">${initials(author)}</div>` : ''}
        <div class="feed-content">
          <div class="feed-header"><span class="feed-author">${label(author)}</span><span class="feed-time">${item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now'}</span></div>
          <div class="feed-body">${item.body || item.text || item.content || 'No comment text.'}</div>
          <div class="feed-reactions"><div class="reaction-btn add-reaction">+ <i class="fa-regular fa-face-smile"></i></div></div>
        </div>
      </div>
    `;
  }).join('') : '<div class="text-sm text-slate-500">No comments returned.</div>';
}

function hydrateAttachments(root, attachments) {
  const moduleBody = root.querySelector('.sidebar-module:nth-of-type(5)');
  if (!moduleBody) return;
  const items = asArray(attachments);
  moduleBody.innerHTML = `
    <div class="sidebar-heading">Attachments (${items.length}) <span class="add-btn"><i class="fa-solid fa-paperclip"></i></span></div>
    ${items.length ? items.map((item) => `
      <div class="attachment-item">
        <div class="file-icon file-doc"><i class="fa-solid fa-file"></i></div>
        <div class="file-details"><div class="file-name">${item.name || item.fileName || 'Attachment'}</div><div class="file-meta">${item.size ? `${item.size} • ` : ''}${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Uploaded'}</div></div>
      </div>
    `).join('') : '<div class="text-sm text-slate-500">No attachments returned.</div>'}
  `;
}

function hydrateWatchers(root, watchers) {
  const moduleBody = root.querySelector('.sidebar-module:nth-of-type(4)');
  if (!moduleBody) return;
  const items = asArray(watchers);
  moduleBody.innerHTML = `
    <div class="sidebar-heading">Watchers (${items.length}) <span class="add-btn"><i class="fa-solid fa-plus"></i></span></div>
    <div class="watcher-list">
      ${items.length ? items.map((item) => `<div class="watcher-chip">${avatar(item, '#6366f1')}</div>`).join('') : '<div class="text-sm text-slate-500">No watchers returned.</div>'}
    </div>
  `;
}

function hydrateTime(root, logs, summary) {
  const display = root.querySelector('.time-display');
  const estimate = root.querySelector('.time-estimate');
  const fill = root.querySelector('.time-bar-fill');
  const totalMinutes = logs?.reduce((total, item) => total + (Number(item.durationMinutes) || 0), 0) ?? 0;
  const totalSeconds = summary?.totalSeconds ?? totalMinutes * 60;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (display) display.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (estimate) estimate.textContent = summary?.estimatedSeconds ? `of ${Math.round(summary.estimatedSeconds / 3600)}h estimated` : 'of estimated time';
  if (fill) fill.style.width = summary?.percent ? `${summary.percent}%` : '0%';
}

function buildActionBar(spaceMembers) {
  const assigneeOptions = [
    '<option value="">Unassigned</option>',
    ...spaceMembers.map((member) => {
      const memberId = member.id || member.userId || member.email || '';
      const memberName = member.name || member.fullName || member.email || 'Member';
      return `<option value="${memberId}">${memberName}</option>`;
    }),
  ].join('');

  return `
    <div class="mongez-live-task-controls" style="margin:0 24px 20px;border:1px solid var(--border);background:white;border-radius:18px;padding:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:end;">
      <div style="min-width:160px;display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-tertiary);">Status</label>
        <select data-task-control="status" style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:white;color:var(--text-primary);">
          <option value="TODO">TODO</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="WAITING">WAITING</option>
          <option value="DONE">DONE</option>
        </select>
      </div>
      <div style="min-width:160px;display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-tertiary);">Priority</label>
        <select data-task-control="priority" style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:white;color:var(--text-primary);">
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
      </div>
      <div style="min-width:220px;display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-tertiary);">Assignee</label>
        <select data-task-control="assignee" disabled style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:#f8fafc;color:var(--text-secondary);cursor:not-allowed;">
          ${assigneeOptions}
        </select>
      </div>
      <button type="button" data-task-action="rename" style="border:none;border-radius:999px;background:#0ea5e9;color:white;padding:11px 16px;font-weight:600;cursor:pointer;">Rename</button>
      <button type="button" data-task-action="upload" style="border:1px solid var(--border);border-radius:999px;background:white;color:var(--text-primary);padding:11px 16px;font-weight:600;cursor:pointer;">Upload File</button>
      <button type="button" data-task-action="delete" style="border:none;border-radius:999px;background:#ef4444;color:white;padding:11px 16px;font-weight:600;cursor:pointer;">Delete Task</button>
      <input type="file" data-task-action="file-input" style="display:none;" />
      <div data-task-action="feedback" style="width:100%;font-size:12px;color:var(--text-secondary);"></div>
    </div>
  `;
}

function syncActionBar(root, task) {
  const statusSelect = root.querySelector('[data-task-control="status"]');
  const prioritySelect = root.querySelector('[data-task-control="priority"]');
  const assigneeSelect = root.querySelector('[data-task-control="assignee"]');

  if (statusSelect) {
    statusSelect.value = String(task.status || 'TODO').toUpperCase();
  }

  if (prioritySelect) {
    prioritySelect.value = String(task.priority || 'MEDIUM').toUpperCase();
  }

  if (assigneeSelect) {
    assigneeSelect.value = task.assignee?.id || task.assigneeId || '';
  }
}

function TaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { setPath } = useOutletContext() || {};
  const { spaceMembers } = useAppContext();
  const taskDetailsQuery = useTaskDetailsQuery(taskId);
  const updateTaskMutation = useTaskUpdateMutation(taskId);
  const commentMutation = useTaskCommentMutation(taskId);
  const uploadMutation = useTaskUploadMutation(taskId);
  const deleteTaskMutation = useTaskDeleteMutation(taskId);

  const loadTaskDetails = useCallback(async (root) => {
    if (!taskId) return;

    if (taskDetailsQuery.isError) {
      renderPageNotice(root, 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700', taskDetailsQuery.error?.message || 'Unable to load task details.');
      return;
    }

    if (!taskDetailsQuery.data) {
      renderPageNotice(root, 'rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600', 'Loading task details...');
      return;
    }

    try {
      root.querySelector('[data-task-page-note]')?.remove();
      let task = taskDetailsQuery.data.task;
      let comments = asArray(taskDetailsQuery.data.comments);
      let files = asArray(taskDetailsQuery.data.files);
      let timeLogs = asArray(taskDetailsQuery.data.timeLogs);
      let risk = taskDetailsQuery.data.risk;

      setPath?.([
        { name: 'Workspace', color: 'text-slate-400', ref: '/dashboard' },
        { name: task.title || task.name || 'Task Details', color: 'text-slate-800', ref: '' },
      ]);

      const container = root.querySelector('.task-detail-container');
      if (container && !container.querySelector('.mongez-live-task-controls')) {
        container.insertAdjacentHTML('afterbegin', buildActionBar(spaceMembers));
      }

      const renderFiles = (nextFiles) => {
        hydrateAttachments(root, nextFiles);
        const fileNodes = root.querySelectorAll('.attachment-item');
        nextFiles.forEach((file, index) => {
          const node = fileNodes[index]?.querySelector('.file-name');
          const url = file?.url || file?.downloadUrl || file?.fileUrl;
          if (node && url) {
            node.innerHTML = `<a href="${url}" target="_blank" rel="noreferrer" style="color:var(--primary);text-decoration:none;">${file.name || file.fileName || 'Attachment'}</a>`;
          }
        });
      };

      const renderTask = () => {
        hydrateTask(root, task);
        hydrateSubtasks(root, task.subtasks || task.checklist || []);
        hydrateRelations(root, task.relations || []);
        hydrateWatchers(root, task.watchers || task.assignees || []);
        hydrateTime(root, timeLogs, { totalSeconds: timeLogs?.reduce((t, l) => t + (Number(l.durationMinutes) || 0) * 60, 0) });
        renderFiles(files);
        syncActionBar(root, task);
      };

      renderTask();
      hydrateComments(root, comments);

      const feedbackNode = root.querySelector('[data-task-action="feedback"]');
      const setFeedback = (message, tone = 'neutral') => {
        if (!feedbackNode) return;
        feedbackNode.textContent = message;
        feedbackNode.style.color =
          tone === 'error'
            ? '#dc2626'
            : tone === 'success'
              ? '#059669'
              : 'var(--text-secondary)';
      };

      const applyTaskUpdate = async (updates) => {
        task = await updateTaskMutation.mutateAsync(updates);
        const refreshed = await taskDetailsQuery.refetch();
        comments = asArray(refreshed.data?.comments || comments);
        files = asArray(refreshed.data?.files || files);
        timeLogs = asArray(refreshed.data?.timeLogs || timeLogs);
        risk = refreshed.data?.risk ?? risk;
        renderTask();
        hydrateComments(root, comments);
        setPath?.([
          { name: 'Workspace', color: 'text-slate-400', ref: '/dashboard' },
          { name: task.title || task.name || 'Task Details', color: 'text-slate-800', ref: '' },
        ]);
      };

      const commentButton = root.querySelector('.comment-actions button[style*="background:var(--primary)"]');
      const commentInput = root.querySelector('.comment-textarea');
      if (commentButton && commentInput) {
        commentButton.onclick = async () => {
          if (!commentInput.value.trim()) return;
          try {
            await commentMutation.mutateAsync({ content: commentInput.value.trim() });
            const refreshed = await taskDetailsQuery.refetch();
            comments = asArray(refreshed.data?.comments || comments);
            hydrateComments(root, comments);
            commentInput.value = '';
            setFeedback('Comment saved.', 'success');
          } catch (commentError) {
            setFeedback(commentError.message || 'Unable to save this comment.', 'error');
          }
        };
      }

      if (risk) {
        root.querySelector('[data-task-risk-note]')?.remove();
        const insightNote = document.createElement('p');
        insightNote.setAttribute('data-task-risk-note', 'true');
        insightNote.className = 'text-sm text-slate-500';
        insightNote.textContent = typeof risk === 'string' ? risk : (risk.summary || risk.report || 'AI risk analysis loaded for this task.');
        root.querySelector('.task-description')?.appendChild(insightNote);
      }

      const renameTask = async () => {
        const currentTitle = root.querySelector('.task-title').textContent || '';
        const nextTitle = window.prompt('Update task title', currentTitle);
        const trimmedTitle = nextTitle?.trim();

        if (!trimmedTitle) {
          setFeedback('Task title cannot be empty.', 'error');
          return;
        }

        if (trimmedTitle !== currentTitle) {
          await applyTaskUpdate({ title: trimmedTitle });
          setFeedback('Task title updated.', 'success');
        }
      };

      const titleNode = root.querySelector('.task-title');
      if (titleNode) {
        titleNode.ondblclick = () => {
          void renameTask();
        };
      }

      const renameButton = root.querySelector('[data-task-action="rename"]');
      if (renameButton) {
        renameButton.onclick = () => {
          void renameTask();
        };
      }

      const statusSelect = root.querySelector('[data-task-control="status"]');
      if (statusSelect) {
        statusSelect.onchange = async (event) => {
          try {
            await applyTaskUpdate({ status: event.target.value });
            setFeedback('Task status updated.', 'success');
          } catch (error) {
            setFeedback(error.message || 'Unable to update task status.', 'error');
          }
        };
      }

      const prioritySelect = root.querySelector('[data-task-control="priority"]');
      if (prioritySelect) {
        prioritySelect.onchange = async (event) => {
          try {
            await applyTaskUpdate({ priority: event.target.value });
            setFeedback('Task priority updated.', 'success');
          } catch (error) {
            setFeedback(error.message || 'Unable to update task priority.', 'error');
          }
        };
      }

      const assigneeSelect = root.querySelector('[data-task-control="assignee"]');
      if (assigneeSelect) {
        assigneeSelect.onchange = () => {
          setFeedback('Assignee changes are not exposed by the current backend task API.', 'error');
        };
      }

      const fileInput = root.querySelector('[data-task-action="file-input"]');
      const uploadButton = root.querySelector('[data-task-action="upload"]');
      if (uploadButton && fileInput) {
        uploadButton.onclick = () => fileInput.click();
        fileInput.onchange = async (event) => {
          const [file] = event.target.files || [];
          if (!file) return;

          if (file.size > MAX_ATTACHMENT_BYTES) {
            setFeedback('Attachments must be 10 MB or smaller.', 'error');
            event.target.value = '';
            return;
          }

          try {
            setFeedback(`Uploading ${file.name}...`);
            await uploadMutation.mutateAsync(file);
            const refreshed = await taskDetailsQuery.refetch();
            files = asArray(refreshed.data?.files || files);
            renderFiles(files);
            setFeedback('Attachment uploaded.', 'success');
          } catch (error) {
            setFeedback(error.message || 'Unable to upload attachment.', 'error');
          } finally {
            event.target.value = '';
          }
        };
      }

      const deleteButton = root.querySelector('[data-task-action="delete"]');
      if (deleteButton) {
        deleteButton.onclick = async () => {
          if (!window.confirm('Delete this task? This action cannot be undone.')) return;

          try {
            await deleteTaskMutation.mutateAsync();
            navigate(task.boardId ? `/board/${task.boardId}/table` : '/dashboard', { replace: true });
          } catch (error) {
            setFeedback(error.message || 'Unable to delete task.', 'error');
          }
        };
      }

      root.querySelectorAll('a[href="settings"]').forEach((link) => {
        link.setAttribute('href', '/settings');
      });
      root.querySelectorAll('a[href="inbox"]').forEach((link) => {
        link.setAttribute('href', '/inbox');
      });
      root.querySelectorAll('a[href="list-view"], a[data-task-board-link]').forEach((link) => {
        link.setAttribute('href', task.boardId ? `/board/${task.boardId}/list` : '/dashboard');
      });
      root.querySelectorAll('a[href="#"]').forEach((link) => {
        link.removeAttribute('href');
        link.setAttribute('role', 'text');
        link.style.cursor = 'default';
      });
    } catch (error) {
      renderPageNotice(root, 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700', error.message || 'Unable to load task details.');
    }
  }, [
    commentMutation,
    deleteTaskMutation,
    navigate,
    setPath,
    spaceMembers,
    taskDetailsQuery,
    taskId,
    updateTaskMutation,
    uploadMutation,
  ]);

  return <ReferencePage html={html} page="task-detail" onReady={loadTaskDetails} />;
}



const html = `

    <div class="app-container">

        <!-- ═══════════════ SIDEBAR ═══════════════ -->
        <aside class="sidebar"></aside>

        <!-- ═══════════════ MAIN CONTENT ═══════════════ -->
        <main class="main-content" style="padding: 0;">

            <!-- Top Header -->
            <header class="top-header">
                <div class="breadcrumb">
                    <span>Upper Egypt Edu</span><i class="fa-solid fa-chevron-right"></i>
                    <span>List View</span><i class="fa-solid fa-chevron-right"></i>
                    <span class="active">EDU-420</span>
                </div>

                <div class="unified-search-bar" id="unifiedSearch">
                    <div class="unified-search-wrapper">
                        <i class="fa-solid fa-magnifying-glass unified-search-icon"></i>
                        <i class="fa-solid fa-wand-magic-sparkles unified-ai-icon"></i>
                        <input type="text" class="unified-search-input" placeholder='Search or ask AI...'>
                        <span class="kbd-shortcut">⌘K</span>
                    </div>
                </div>

                <div style="display:flex;gap:10px;align-items:center">
                    <div class="header-actions">
                        <button class="action-btn"><i class="fa-solid fa-thumbs-up"></i><span>Like</span></button>
                        <button class="action-btn"><i class="fa-solid fa-share-nodes"></i><span>Share</span></button>
                        <button class="action-btn"><i class="fa-solid fa-robot"></i><span>AI Agents</span><span
                                class="badge-new">New</span></button>
                    </div>
                    <div class="toolbar-divider"></div>
                    <a href="/inbox" style="position:relative"><i class="fa-regular fa-bell bell-icon"
                            style="font-size:17px;color:var(--text-secondary);cursor:pointer"></i><span
                            class="notification-dot"></span></a>
                    <a href="/settings" class="avatar"
                        style="background:var(--primary);width:30px;height:30px;font-weight:600;text-decoration:none;font-size:11px">TA</a>
                    <button class="toolbar-btn" title="More"><i class="fa-solid fa-ellipsis"></i></button>
                </div>
            </header>

            <div class="task-detail-container">
                <!-- ═══ LEFT: Main Content ═══ -->
                <div class="task-main-content">
                    <div class="task-breadcrumbs">
                        <a href="/dashboard" data-task-board-link><i class="fa-solid fa-table-list"></i> Curriculum Board</a>
                        / <span>Sprint 4</span>
                        / <span>Design</span>
                    </div>

                    <div class="task-id-badge"><i class="fa-solid fa-hashtag"></i> EDU-420</div>

                    <h1 class="task-title">Design new landing page for student enrollment flow</h1>

                    <!-- Tags -->
                    <div class="task-tags">
                        <span class="tag tag-design"><i class="fa-solid fa-palette" style="margin-right:3px;"></i>
                            Design</span>
                        <span class="tag tag-frontend">Frontend</span>
                        <span class="tag tag-ux">UX Research</span>
                        <span class="tag tag-sprint">Sprint 4</span>
                    </div>

                    <!-- Task Attributes -->
                    <div class="task-attributes-row">
                        <div class="attr-group">
                            <span class="attr-label">Status</span>
                            <span class="attr-value status-badge status-in-progress"><i
                                    class="fa-solid fa-circle-half-stroke"></i> In Progress</span>
                        </div>
                        <div class="attr-group">
                            <span class="attr-label">Assignee</span>
                            <span class="attr-value">
                                <img src="https://ui-avatars.com/api/?name=Thomas+User&background=00a8e8&color=fff"
                                    style="width:20px; height:20px; border-radius:50%;"> Thomas User
                            </span>
                        </div>
                        <div class="attr-group">
                            <span class="attr-label">Due Date</span>
                            <span class="attr-value"><i class="fa-regular fa-calendar"
                                    style="color:var(--text-tertiary);"></i> Oct 24, 2026</span>
                        </div>
                        <div class="attr-group">
                            <span class="attr-label">Priority</span>
                            <span class="attr-value priority-high"><i class="fa-solid fa-flag"></i> High</span>
                        </div>
                        <div class="attr-group">
                            <span class="attr-label">Story Points</span>
                            <span class="attr-value"><i class="fa-solid fa-fire" style="color:var(--warning);"></i>
                                8</span>
                        </div>
                        <div class="attr-group">
                            <span class="attr-label">Sprint</span>
                            <span class="attr-value"><i class="fa-solid fa-bolt" style="color:var(--accent);"></i>
                                Sprint 4</span>
                        </div>
                    </div>

                    <!-- ─── Description ─── -->
                    <div class="section-heading">Description</div>

                    <div class="editor-toolbar">
                        <button class="editor-btn active"><i class="fa-solid fa-bold"></i></button>
                        <button class="editor-btn"><i class="fa-solid fa-italic"></i></button>
                        <button class="editor-btn"><i class="fa-solid fa-strikethrough"></i></button>
                        <button class="editor-btn"><i class="fa-solid fa-link"></i></button>
                        <div style="width: 1px; margin: 4px; background: var(--border);"></div>
                        <button class="editor-btn"><i class="fa-solid fa-list-ul"></i></button>
                        <button class="editor-btn"><i class="fa-solid fa-list-ol"></i></button>
                        <button class="editor-btn"><i class="fa-solid fa-code"></i></button>
                        <button class="editor-btn"><i class="fa-solid fa-image"></i></button>
                        <button class="editor-btn"><i class="fa-solid fa-table"></i></button>
                        <div style="width: 1px; margin: 4px; background: var(--border);"></div>
                        <button class="editor-btn"><i class="fa-solid fa-at"></i></button>
                    </div>
                    <div class="task-description">
                        <p>We need to revamp the student enrollment flow landing page to increase our conversion rates
                            for the Upper Egypt sector. The current bounce rate is around <strong>65% on mobile
                                devices</strong>.</p>
                        <p><span class="mention">@Sarah Miller</span> completed the initial competitive analysis and the
                            findings are documented in the attached PDF. Key takeaway: top competitors are pushing
                            <strong>video testimonials on the first viewport</strong>.</p>
                        <p><strong>Key Requirements:</strong></p>
                        <ul>
                            <li>Mobile-first design approach — target ≤3s paint time</li>
                            <li>Include the new testimonial video (link in attachments)</li>
                            <li>A/B test the primary CTA button color (Blue vs Green)</li>
                            <li>Reduce the form fields from 8 down to 4 essential ones</li>
                            <li>Integrate with <span class="mention">@Careers API</span> for auto-fill school data</li>
                        </ul>
                        <p><strong>Acceptance Criteria:</strong></p>
                        <ul>
                            <li>Mobile conversion rate improves by ≥15%</li>
                            <li>Page fully loads in under 2 seconds on 3G</li>
                            <li>Accessibility audit passes WCAG 2.1 AA standards</li>
                        </ul>
                        <p>Please refer to the attached Figma file for the brand guidelines. <span
                                class="mention">@Marcus Reed</span> will handle the backend API integration once we
                            finalize the form wireframes.</p>
                    </div>

                    <!-- ─── Subtasks ─── -->
                    <div class="section-heading">
                        <span><i class="fa-solid fa-list-check"
                                style="margin-right:6px; color:var(--primary-dark);"></i> Subtasks (2/5)</span>
                        <button class="toolbar-btn" style="background:var(--bg-hover);"><i
                                class="fa-solid fa-plus"></i></button>
                    </div>
                    <div class="subtask-list">
                        <label class="subtask-item">
                            <input type="checkbox" class="checkbox" checked>
                            <span class="subtask-title">Review competitor enrollment pages</span>
                            <div class="subtask-meta">
                                <span class="subtask-due">Oct 14</span>
                                <img src="https://ui-avatars.com/api/?name=Sarah+Miller&background=10b981&color=fff"
                                    style="width:22px; height:22px; border-radius:50%;">
                            </div>
                        </label>
                        <label class="subtask-item">
                            <input type="checkbox" class="checkbox" checked>
                            <span class="subtask-title">Synthesize competitive analysis into brief</span>
                            <div class="subtask-meta">
                                <span class="subtask-due">Oct 16</span>
                                <img src="https://ui-avatars.com/api/?name=Sarah+Miller&background=10b981&color=fff"
                                    style="width:22px; height:22px; border-radius:50%;">
                            </div>
                        </label>
                        <label class="subtask-item">
                            <input type="checkbox" class="checkbox">
                            <span class="subtask-title">Draft initial mobile wireframes (low-fi)</span>
                            <div class="subtask-meta">
                                <span class="subtask-priority priority-urgent-chip">Urgent</span>
                                <span class="subtask-due" style="color:var(--danger);">Oct 21 ⚠</span>
                                <img src="https://ui-avatars.com/api/?name=Thomas+User&background=00a8e8&color=fff"
                                    style="width:22px; height:22px; border-radius:50%;">
                            </div>
                        </label>
                        <label class="subtask-item">
                            <input type="checkbox" class="checkbox">
                            <span class="subtask-title">Setup A/B testing variations in landing page builder</span>
                            <div class="subtask-meta">
                                <span class="subtask-priority priority-normal-chip">Normal</span>
                                <span class="subtask-due">Oct 23</span>
                                <div
                                    style="width:22px; height:22px; border-radius:50%; background:var(--bg-hover); color:var(--text-tertiary); display:flex; align-items:center; justify-content:center; font-size:10px;">
                                    <i class="fa-regular fa-user"></i></div>
                            </div>
                        </label>
                        <label class="subtask-item">
                            <input type="checkbox" class="checkbox">
                            <span class="subtask-title">Conduct WCAG 2.1 AA accessibility audit</span>
                            <div class="subtask-meta">
                                <span class="subtask-due">Oct 24</span>
                                <img src="https://ui-avatars.com/api/?name=Emma+Davis&background=f59e0b&color=fff"
                                    style="width:22px; height:22px; border-radius:50%;">
                            </div>
                        </label>
                    </div>

                    <!-- ─── Linked Tasks / Dependencies ─── -->
                    <div class="section-heading">
                        <span><i class="fa-solid fa-link" style="margin-right:6px; color:var(--accent);"></i> Linked
                            Tasks (3)</span>
                        <button class="toolbar-btn" style="background:var(--bg-hover);"><i
                                class="fa-solid fa-plus"></i></button>
                    </div>
                    <div class="linked-tasks">
                        <div class="linked-task-item">
                            <span class="link-type blocked-by">Blocked by</span>
                            <span class="linked-task-id">EDU-418</span>
                            <span class="linked-task-name">Finalize brand color palette for Upper Egypt sector</span>
                            <span class="linked-task-status lts-progress">In Progress</span>
                        </div>
                        <div class="linked-task-item">
                            <span class="link-type blocks">Blocks</span>
                            <span class="linked-task-id">EDU-425</span>
                            <span class="linked-task-name">Backend API: Student enrollment form handler</span>
                            <span class="linked-task-status lts-todo">To Do</span>
                        </div>
                        <div class="linked-task-item">
                            <span class="link-type related">Related</span>
                            <span class="linked-task-id">EDU-412</span>
                            <span class="linked-task-name">Update testimonial video for new campaign</span>
                            <span class="linked-task-status lts-done">Done</span>
                        </div>
                    </div>

                    <!-- ─── Activity / Comments ─── -->
                    <div class="section-heading" style="margin-bottom: 0;">Activity</div>

                    <div class="activity-tabs">
                        <div class="activity-tab active">All<span class="tab-count">12</span></div>
                        <div class="activity-tab">Comments<span class="tab-count">5</span></div>
                        <div class="activity-tab">History<span class="tab-count">7</span></div>
                    </div>

                    <!-- New Comment Input -->
                    <div class="comment-box">
                        <img src="https://ui-avatars.com/api/?name=Thomas+User&background=00a8e8&color=fff"
                            class="comment-avatar">
                        <div class="comment-input-area">
                            <textarea class="comment-textarea"
                                placeholder="Add a comment... Use @ to mention someone or / for commands"></textarea>
                            <div class="comment-actions">
                                <div class="comment-toolbar-btns">
                                    <button title="Mention"><i class="fa-solid fa-at"></i></button>
                                    <button title="Emoji"><i class="fa-regular fa-face-smile"></i></button>
                                    <button title="Attach file"><i class="fa-solid fa-paperclip"></i></button>
                                    <button title="Code block"><i class="fa-solid fa-code"></i></button>
                                    <button title="Screenshot"><i class="fa-solid fa-camera"></i></button>
                                </div>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <select
                                        style="border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:11px;background:white;color:var(--text-secondary);cursor:pointer;">
                                        <option>Public</option>
                                        <option>Internal note</option>
                                    </select>
                                    <button
                                        style="padding:6px 16px;border-radius:var(--radius);background:var(--primary);color:white;border:none;font-size:12px;font-weight:600;cursor:pointer;">Comment</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Feed Items -->
                    <div class="activity-feed">

                        <!-- Comment 1 with replies (chained thread) -->
                        <div class="feed-item">
                            <img src="https://ui-avatars.com/api/?name=Sarah+Miller&background=10b981&color=fff"
                                class="feed-avatar">
                            <div class="feed-content">
                                <div class="feed-header">
                                    <span class="feed-author">Sarah Miller</span>
                                    <span class="feed-time">Yesterday at 4:30 PM</span>
                                </div>
                                <div class="feed-body">
                                    I've attached the competitor analysis PDF. They are all heavily pushing video
                                    testimonials on the first viewport. <span class="mention">@Thomas User</span> can
                                    you check the Figma file I linked? I think we should go with the two-column layout
                                    on desktop and a single scroll on mobile.
                                </div>
                                <div class="feed-reactions">
                                    <div class="reaction-btn active">👍 <span class="reaction-count">3</span></div>
                                    <div class="reaction-btn">🔥 <span class="reaction-count">1</span></div>
                                    <div class="reaction-btn add-reaction">+ <i class="fa-regular fa-face-smile"></i>
                                    </div>
                                </div>

                                <!-- Threaded replies -->
                                <div class="feed-replies">
                                    <div class="reply-item">
                                        <img src="https://ui-avatars.com/api/?name=Thomas+User&background=00a8e8&color=fff"
                                            class="reply-avatar">
                                        <div class="reply-content">
                                            <div class="reply-header">
                                                <span class="reply-author">Thomas User</span>
                                                <span class="reply-time">Yesterday at 5:15 PM</span>
                                            </div>
                                            <div class="reply-body">Agreed on the two-column approach. I'll start the
                                                wireframes tomorrow. <span class="mention">@Marcus Reed</span> can you
                                                check if we have the API endpoint ready for school auto-fill?</div>
                                        </div>
                                    </div>
                                    <div class="reply-item">
                                        <img src="https://ui-avatars.com/api/?name=Marcus+Reed&background=e74c3c&color=fff"
                                            class="reply-avatar">
                                        <div class="reply-content">
                                            <div class="reply-header">
                                                <span class="reply-author">Marcus Reed</span>
                                                <span class="reply-time">Yesterday at 6:02 PM</span>
                                            </div>
                                            <div class="reply-body">The endpoint is live at <code
                                                    style="background:var(--bg-hover);padding:2px 6px;border-radius:4px;font-size:12px;">/api/v2/schools/autocomplete</code>.
                                                I'll share the Postman collection in Slack. Should be ready for
                                                integration once you finalize the form fields.</div>
                                        </div>
                                    </div>
                                    <!-- Inline reply -->
                                    <div class="reply-input-row">
                                        <img src="https://ui-avatars.com/api/?name=Thomas+User&background=00a8e8&color=fff"
                                            style="width:24px; height:24px; border-radius:50%;">
                                        <input type="text" class="reply-input" placeholder="Reply to this thread...">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- System event: Status change -->
                        <div class="system-event">
                            <div class="system-icon"><i class="fa-solid fa-arrow-right"></i></div>
                            <div class="system-text">
                                <strong>Thomas User</strong> changed the status from <strong>To Do</strong> to
                                <strong>In Progress</strong>
                                <span class="system-time">2 days ago</span>
                            </div>
                        </div>

                        <!-- System event: Assignee change -->
                        <div class="system-event">
                            <div class="system-icon"><i class="fa-solid fa-user-pen"></i></div>
                            <div class="system-text">
                                <strong>Sarah Miller</strong> assigned this task to <strong>Thomas User</strong>
                                <span class="system-time">3 days ago</span>
                            </div>
                        </div>

                        <!-- Comment 2 with mention -->
                        <div class="feed-item">
                            <img src="https://ui-avatars.com/api/?name=Emma+Davis&background=f59e0b&color=fff"
                                class="feed-avatar">
                            <div class="feed-content">
                                <div class="feed-header">
                                    <span class="feed-author">Emma Davis</span>
                                    <span class="feed-time">3 days ago at 11:20 AM</span>
                                </div>
                                <div class="feed-body">
                                    Just a heads up — I'll be handling the accessibility audit once the design is
                                    finalized. <span class="mention">@Thomas User</span> please make sure to use
                                    semantic HTML and proper ARIA labels from the start, it'll save us a lot of rework
                                    later. Also <span class="mention">@Sarah Miller</span> can you share the color
                                    contrast ratios from the brand guidelines?
                                </div>
                                <div class="feed-reactions">
                                    <div class="reaction-btn">✅ <span class="reaction-count">2</span></div>
                                    <div class="reaction-btn add-reaction">+ <i class="fa-regular fa-face-smile"></i>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- System event: Priority change -->
                        <div class="system-event">
                            <div class="system-icon"><i class="fa-solid fa-flag"></i></div>
                            <div class="system-text">
                                <strong>Sarah Miller</strong> changed the priority from <strong>Normal</strong> to
                                <strong style="color:var(--danger);">High</strong>
                                <span class="system-time">4 days ago</span>
                            </div>
                        </div>

                        <!-- System event: Due date set -->
                        <div class="system-event">
                            <div class="system-icon"><i class="fa-regular fa-calendar"></i></div>
                            <div class="system-text">
                                <strong>Sarah Miller</strong> set the due date to <strong>Oct 24, 2026</strong>
                                <span class="system-time">5 days ago</span>
                            </div>
                        </div>

                        <!-- System event: Task created -->
                        <div class="system-event">
                            <div class="system-icon"><i class="fa-solid fa-plus"></i></div>
                            <div class="system-text">
                                <strong>Sarah Miller</strong> created this task
                                <span class="system-time">Oct 10, 2026</span>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- ═══ RIGHT SIDEBAR ═══ -->
                <div class="task-sidebar-right">

                    <!-- Time Tracking -->
                    <div class="sidebar-module">
                        <div class="sidebar-heading">Time Tracking <span class="add-btn"><i
                                    class="fa-solid fa-gear"></i></span></div>
                        <div class="time-tracker">
                            <div class="time-display">04:35:20</div>
                            <div class="time-estimate">of 12h estimated</div>
                            <div class="time-bar">
                                <div class="time-bar-fill" style="width:38%;"></div>
                            </div>
                            <div class="time-actions">
                                <div class="time-btn active-timer"><i class="fa-solid fa-pause"></i> Pause</div>
                                <div class="time-btn"><i class="fa-solid fa-stop"></i> Stop</div>
                                <div class="time-btn"><i class="fa-solid fa-clock-rotate-left"></i> Log</div>
                            </div>
                        </div>
                    </div>

                    <div class="sidebar-divider"></div>

                    <!-- Dates -->
                    <div class="sidebar-module">
                        <div class="sidebar-heading">Details</div>
                        <div class="sidebar-row">
                            <span class="sidebar-label">Created</span>
                            <span class="sidebar-value">Oct 10, 2026</span>
                        </div>
                        <div class="sidebar-row">
                            <span class="sidebar-label">Updated</span>
                            <span class="sidebar-value">Yesterday</span>
                        </div>
                        <div class="sidebar-row">
                            <span class="sidebar-label">Start date</span>
                            <span class="sidebar-value">Oct 12, 2026</span>
                        </div>
                        <div class="sidebar-row">
                            <span class="sidebar-label">Department</span>
                            <span class="sidebar-value"><i class="fa-solid fa-building"
                                    style="color:var(--text-tertiary);font-size:11px;"></i> Design Team</span>
                        </div>
                        <div class="sidebar-row">
                            <span class="sidebar-label">Reviewer</span>
                            <span class="sidebar-value"><img
                                    src="https://ui-avatars.com/api/?name=Sarah+Miller&background=10b981&color=fff"
                                    style="width:18px;height:18px;border-radius:50%;"> Sarah Miller</span>
                        </div>
                    </div>

                    <div class="sidebar-divider"></div>

                    <!-- Custom Fields -->
                    <div class="sidebar-module">
                        <div class="sidebar-heading">Custom Fields <span class="add-btn"><i
                                    class="fa-solid fa-plus"></i></span></div>
                        <div class="custom-field">
                            <div class="custom-field-label">Design Completion</div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div class="custom-field-value">35%</div>
                            </div>
                            <div class="progress-mini">
                                <div class="progress-mini-fill" style="width:35%; background:var(--primary);"></div>
                            </div>
                        </div>
                        <div class="custom-field">
                            <div class="custom-field-label">Client Approved</div>
                            <div class="custom-field-value" style="color:var(--warning);"><i
                                    class="fa-solid fa-clock"></i> Pending Review</div>
                        </div>
                        <div class="custom-field">
                            <div class="custom-field-label">Target Audience</div>
                            <div class="custom-field-value">Upper Egypt — Ages 16-22</div>
                        </div>
                    </div>

                    <div class="sidebar-divider"></div>

                    <!-- Watchers -->
                    <div class="sidebar-module">
                        <div class="sidebar-heading">Watchers (4) <span class="add-btn"><i
                                    class="fa-solid fa-plus"></i></span></div>
                        <div class="watcher-list">
                            <div class="watcher-chip"><img
                                    src="https://ui-avatars.com/api/?name=Thomas+User&background=00a8e8&color=fff">
                                Thomas</div>
                            <div class="watcher-chip"><img
                                    src="https://ui-avatars.com/api/?name=Sarah+Miller&background=10b981&color=fff">
                                Sarah</div>
                            <div class="watcher-chip"><img
                                    src="https://ui-avatars.com/api/?name=Marcus+Reed&background=e74c3c&color=fff">
                                Marcus</div>
                            <div class="watcher-chip"><img
                                    src="https://ui-avatars.com/api/?name=Emma+Davis&background=f59e0b&color=fff"> Emma
                            </div>
                        </div>
                    </div>

                    <div class="sidebar-divider"></div>

                    <!-- Attachments -->
                    <div class="sidebar-module">
                        <div class="sidebar-heading">Attachments (4) <span class="add-btn"><i
                                    class="fa-solid fa-paperclip"></i></span></div>

                        <div class="attachment-item">
                            <div class="file-icon file-pdf"><i class="fa-solid fa-file-pdf"></i></div>
                            <div class="file-details">
                                <div class="file-name">Competitor_Analysis.pdf</div>
                                <div class="file-meta">Sarah • 2.4 MB • Oct 14</div>
                            </div>
                        </div>

                        <div class="attachment-item">
                            <div class="file-icon file-figma"><i class="fa-brands fa-figma"></i></div>
                            <div class="file-details">
                                <div class="file-name">Brand_Guidelines_2026</div>
                                <div class="file-meta">Figma Link • Embedded</div>
                            </div>
                        </div>

                        <div class="attachment-item">
                            <div class="file-icon file-img"><i class="fa-solid fa-image"></i></div>
                            <div class="file-details">
                                <div class="file-name">wireframe_v1_mobile.png</div>
                                <div class="file-meta">Thomas • 890 KB • Oct 18</div>
                            </div>
                        </div>

                        <div class="attachment-item">
                            <div class="file-icon file-doc"><i class="fa-solid fa-file-word"></i></div>
                            <div class="file-details">
                                <div class="file-name">Form_Fields_Spec.docx</div>
                                <div class="file-meta">Marcus • 156 KB • Oct 15</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </main>
    </div>

    <!-- Inject the Universal Sidebar Script -->
    

`;

export default TaskDetailsPage;

