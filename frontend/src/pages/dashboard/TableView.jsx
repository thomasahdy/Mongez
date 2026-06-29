import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import ViewTabs from '../home/viewtabs/ViewTabs';
import Toolbar from '../home/toolbar/Toolbar';
import { useBoardTableQuery, useCreateBoardTaskMutation } from '../../hooks/useDashboardQueries';
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

function renderSortIcon(sortConfig, column, isRTL) {
  if (sortConfig.key !== column) {
    return <i className={`fa-solid fa-sort ${isRTL ? "mr-1" : "ml-1"} text-slate-300`} aria-hidden="true" />;
  }

  return (
    <i
      className={`${isRTL ? "mr-1" : "ml-1"} text-sky-600 ${
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
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const itemsPerPage = 10;
  const locale = i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';
  const boardIdValue = boardId || activeBoard?.id;
  const filters = useMemo(
    () => ({
      page: currentPage,
      limit: itemsPerPage,
      ...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
      ...(statusFilter ? { status: [statusFilter] } : {}),
    }),
    [currentPage, deferredSearch, statusFilter],
  );
  const tableQuery = useBoardTableQuery(boardIdValue, filters);
  const createTaskMutation = useCreateBoardTaskMutation();
  const board = tableQuery.data?.board || null;
  const tasks = tableQuery.data?.items || [];
  const totalItems = tableQuery.data?.total || 0;
  const loading = tableQuery.isLoading || tableQuery.isFetching;
  const error = tableQuery.error?.message || null;
  const creating = createTaskMutation.isPending;
  const formatStatusLabel = (status) => {
    const normalized = String(status || "TODO").toUpperCase();
    return t(`tableView.statuses.${normalized}`);
  };

  useEffect(() => {
    setPath?.([
      { name: t('common.workspace'), color: 'text-slate-400', ref: '/dashboard' },
      { name: board?.name || activeBoard?.name || t('tableView.title'), color: 'text-slate-800', ref: '' },
    ]);
  }, [setPath, board?.name, activeBoard?.name, t]);

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
      setCreateError(t('tableView.createError'));
      return;
    }

    try {
      setCreateError('');
      setCreateSuccess('');
      const boardContext = board;
      if (!boardContext) {
        throw new Error(t('tableView.boardLoading'));
      }

      await createTaskMutation.mutateAsync({
        board: boardContext,
        taskData: { title: newTaskTitle.trim() },
      });
      await tableQuery.refetch();
      setCurrentPage(1);
      setNewTaskTitle('');
      setCreateSuccess(t('tableView.createSuccess'));
    } catch (createError) {
      setCreateError(createError.message || t('tableView.createFailed'));
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
        {formatStatusLabel(statusUpper)}
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
    <div className="flex h-full flex-col overflow-hidden bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
      <ViewTabs />
      <Toolbar />

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${isRTL ? "md:flex-row-reverse" : ""}`}>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t('tableView.title')}</h2>
            <p className="text-xs text-slate-500">
              {t('tableView.connected', { board: board?.name || activeBoard?.name || t('tableView.title') })}
            </p>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <button
              type="button"
              onClick={() => {
                setCreateError('');
                setCreateSuccess('');
                void tableQuery.refetch();
              }}
              disabled={loading || !boardIdValue}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('tableView.refreshing') : t('tableView.refresh')}
            </button>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('tableView.searchPlaceholder')}
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
              <option value="">{t('tableView.allStatuses')}</option>
              <option value="TODO">{formatStatusLabel("TODO")}</option>
              <option value="IN_PROGRESS">{formatStatusLabel("IN_PROGRESS")}</option>
              <option value="WAITING">{formatStatusLabel("WAITING")}</option>
              <option value="DONE">{formatStatusLabel("DONE")}</option>
            </select>
            <input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void createTask();
                }
              }}
              placeholder={t('tableView.newTaskPlaceholder')}
              className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => void createTask()}
              disabled={creating || !newTaskTitle.trim() || !boardIdValue}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? t('tableView.creating') : t('tableView.createTask')}
            </button>
          </div>
        </div>
        {createError ? <p className="mt-3 text-xs font-medium text-rose-600">{createError}</p> : null}
        {createSuccess ? <p className="mt-3 text-xs font-medium text-emerald-600">{createSuccess}</p> : null}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-slate-500">{t('tableView.loading')}</p>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-red-500">{t('tableView.errorPrefix', { message: error })}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse bg-white">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th
                      className={`cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 ${isRTL ? "border-l border-slate-200 text-right" : "border-r border-slate-200 text-left"}`}
                      onClick={() => handleSort('title')}
                    >
                      {t('tableView.headers.task')} {renderSortIcon(sortConfig, 'title', isRTL)}
                    </th>
                    <th
                      className={`cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 ${isRTL ? "border-l border-slate-200 text-right" : "border-r border-slate-200 text-left"}`}
                      onClick={() => handleSort('status')}
                    >
                      {t('tableView.headers.status')} {renderSortIcon(sortConfig, 'status', isRTL)}
                    </th>
                    <th className={`w-24 px-4 py-3 text-center text-xs font-semibold text-slate-600 ${isRTL ? "border-l border-slate-200" : "border-r border-slate-200"}`}>
                      {t('tableView.headers.progress')}
                    </th>
                    <th
                      className={`cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 ${isRTL ? "border-l border-slate-200 text-right" : "border-r border-slate-200 text-left"}`}
                      onClick={() => handleSort('dueDate')}
                    >
                      {t('tableView.headers.dueDate')} {renderSortIcon(sortConfig, 'dueDate', isRTL)}
                    </th>
                    <th className={`w-12 px-4 py-3 text-center text-xs font-semibold text-slate-600 ${isRTL ? "border-l border-slate-200" : "border-r border-slate-200"}`}>
                      {t('tableView.headers.assignee')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-slate-600 ${isRTL ? "text-right" : "text-left"}`}>
                      {t('tableView.headers.description')}
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
                      <td className={`max-w-xs truncate px-4 py-3 text-sm font-medium text-slate-900 ${isRTL ? "border-l border-slate-200 text-right" : "border-r border-slate-200 text-left"}`}>
                        {task.title || task.name || t('tableView.defaults.untitled')}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isRTL ? "border-l border-slate-200 text-right" : "border-r border-slate-200 text-left"}`}>
                        {getStatusBadge(task.status || task.statusId)}
                      </td>
                      <td className={`px-4 py-3 ${isRTL ? "border-l border-slate-200" : "border-r border-slate-200"}`}>
                        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
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
                      <td className={`whitespace-nowrap px-4 py-3 text-sm text-slate-600 ${isRTL ? "border-l border-slate-200 text-right" : "border-r border-slate-200 text-left"}`}>
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString(locale, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : t('tableView.defaults.notSet')}
                      </td>
                      <td className={`px-4 py-3 ${isRTL ? "border-l border-slate-200" : "border-r border-slate-200"}`}>
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
                      <td className={`truncate px-4 py-3 text-sm text-slate-600 ${isRTL ? "text-right" : "text-left"}`}>
                        {task.description || task.comment || t('tableView.defaults.noDescription')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {tasks.length === 0 && !loading && (
                <div className="flex h-full items-center justify-center">
                  <p className="text-slate-400">
                    {search || statusFilter ? t('tableView.defaults.noTasksFiltered') : t('tableView.defaults.noTasks')}
                  </p>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className={`flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className="text-xs text-slate-600">
                  {t('tableView.pagination.showing', {
                    from: (safeCurrentPage - 1) * itemsPerPage + 1,
                    to: Math.min((safeCurrentPage - 1) * itemsPerPage + paginatedTasks.length, totalItems || paginatedTasks.length),
                    total: totalItems || paginatedTasks.length,
                  })}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                    disabled={safeCurrentPage === 1}
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('tableView.pagination.previous')}
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
                    {t('tableView.pagination.next')}
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
