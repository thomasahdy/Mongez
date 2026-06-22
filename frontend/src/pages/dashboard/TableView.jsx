import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import ViewTabs from '../home/viewtabs/ViewTabs';
import Toolbar from '../home/toolbar/Toolbar';
import { useBoardTableQuery, useCreateBoardTaskMutation } from '../../hooks/useDashboardQueries';

function renderSortIcon(sortConfig, column) {
  if (sortConfig.key !== column) {
    return <i className="fa-solid fa-sort ml-1 text-slate-300" aria-hidden="true" />;
  }

  return (
    <i
      className={`ml-1 text-sky-600 ${
        sortConfig.direction === 'asc' ? 'fa-solid fa-arrow-up-wide-short' : 'fa-solid fa-arrow-down-wide-short'
      }`}
      aria-hidden="true"
    />
  );
}

export default function TableView() {
  const { boardId } = useParams();
  const { activeBoard, setPath } = useOutletContext() || {};
  const navigate = useNavigate();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const boardIdValue = boardId || activeBoard?.id;
  const filters = useMemo(
    () => ({
      page: currentPage,
      limit: itemsPerPage,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(statusFilter ? { status: [statusFilter] } : {}),
    }),
    [currentPage, search, statusFilter],
  );
  const tableQuery = useBoardTableQuery(boardIdValue, filters);
  const createTaskMutation = useCreateBoardTaskMutation();
  const board = tableQuery.data?.board || null;
  const tasks = tableQuery.data?.items || [];
  const totalItems = tableQuery.data?.total || 0;
  const loading = tableQuery.isLoading || tableQuery.isFetching;
  const error = tableQuery.error?.message || null;
  const creating = createTaskMutation.isPending;

  useEffect(() => {
    if (!boardId && activeBoard?.id) {
      setCurrentPage(1);
    }
  }, [activeBoard?.id, boardId]);

  useEffect(() => {
    setPath?.([
      { name: 'Workspace', color: 'text-slate-400', ref: '/dashboard' },
      { name: board?.name || activeBoard?.name || 'Table View', color: 'text-slate-800', ref: '' },
    ]);
  }, [setPath, board?.name, activeBoard?.name]);

  const sortedTasks = [...tasks].sort((a, b) => {
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';

    if (typeof aValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const totalPages = Math.max(1, Math.ceil((totalItems || tasks.length) / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTasks = sortedTasks;

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const createTask = async () => {
    if (!boardIdValue || !newTaskTitle.trim()) {
      return;
    }

    try {
      const boardContext = board;
      if (!boardContext) {
        throw new Error('Board details are still loading.');
      }

      await createTaskMutation.mutateAsync({
        board: boardContext,
        taskData: { title: newTaskTitle.trim() },
      });
      await tableQuery.refetch();
      setCurrentPage(1);
      setNewTaskTitle('');
    } catch (createError) {
      // The page already renders query errors, so we keep creation failures lightweight here.
      console.error(createError);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      TODO: { bg: 'bg-red-100', text: 'text-red-700' },
      IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700' },
      WAITING: { bg: 'bg-orange-100', text: 'text-orange-700' },
      DONE: { bg: 'bg-green-100', text: 'text-green-700' },
    };
    const statusUpper = status?.toUpperCase() || 'TODO';
    const config = statusMap[statusUpper] || statusMap.TODO;

    return (
      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
        {statusUpper}
      </span>
    );
  };

  const getProgressColor = (progress) => {
    if (progress >= 75) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <ViewTabs />
      <Toolbar />

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Table tasks</h2>
            <p className="text-xs text-slate-500">
              {board?.name || activeBoard?.name || 'Board tasks'} connected to GET/POST /api/v1/boards/:boardId/tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search tasks"
              className="min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
            >
              <option value="">All statuses</option>
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="WAITING">WAITING</option>
              <option value="DONE">DONE</option>
            </select>
            <input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void createTask();
                }
              }}
              placeholder="New task title"
              className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => void createTask()}
              disabled={creating || !newTaskTitle.trim()}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-slate-500">Loading tasks...</p>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-red-500">Error: {error}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse bg-white">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th
                      className="cursor-pointer whitespace-nowrap border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => handleSort('title')}
                    >
                      Task {renderSortIcon(sortConfig, 'title')}
                    </th>
                    <th
                      className="cursor-pointer whitespace-nowrap border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => handleSort('status')}
                    >
                      Status {renderSortIcon(sortConfig, 'status')}
                    </th>
                    <th className="w-24 border-r border-slate-200 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                      Progress
                    </th>
                    <th
                      className="cursor-pointer whitespace-nowrap border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => handleSort('dueDate')}
                    >
                      Due Date {renderSortIcon(sortConfig, 'dueDate')}
                    </th>
                    <th className="w-12 border-r border-slate-200 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                      Assignee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="cursor-pointer transition-colors hover:bg-blue-50"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <td className="max-w-xs truncate border-r border-slate-200 px-4 py-3 text-sm font-medium text-slate-900">
                        {task.title || task.name || 'Untitled'}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3 text-sm">
                        {getStatusBadge(task.status || task.statusId)}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${getProgressColor(task.progress || 0)}`}
                              style={{ width: `${task.progress || 0}%` }}
                            />
                          </div>
                          <span className="w-8 whitespace-nowrap text-xs font-semibold text-slate-600">
                            {task.progress || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-r border-slate-200 px-4 py-3 text-sm text-slate-600">
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Not set'}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-3">
                        {task.assignee && (
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-xs font-bold text-white"
                            title={typeof task.assignee === 'string' ? task.assignee : task.assignee?.name}
                          >
                            {(typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || '')
                              .substring(0, 2)
                              .toUpperCase() || 'A'}
                          </div>
                        )}
                      </td>
                      <td className="truncate px-4 py-3 text-sm text-slate-600">
                        {task.description || task.comment || 'No description'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {tasks.length === 0 && !loading && (
                <div className="flex h-full items-center justify-center">
                  <p className="text-slate-400">No tasks found</p>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
                <div className="text-xs text-slate-600">
                  Showing {(safeCurrentPage - 1) * itemsPerPage + 1} to {Math.min((safeCurrentPage - 1) * itemsPerPage + paginatedTasks.length, totalItems || paginatedTasks.length)} of {totalItems || paginatedTasks.length} tasks
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                    disabled={safeCurrentPage === 1}
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`rounded border px-2 py-1 text-xs transition-all ${
                        safeCurrentPage === page
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
