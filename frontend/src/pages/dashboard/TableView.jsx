import { useState, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import ViewTabs from '../home/viewtabs/ViewTabs';
import Toolbar from '../home/toolbar/Toolbar';
import { createBoardTask, getBoard, getBoardTasks } from '../../lib/pageApi';
import { normalizeTaskList } from '../../lib/taskMappers';

export default function TableView() {
  const { boardId } = useParams();
  const { activeBoard } = useOutletContext() || {};
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const boardIdValue = boardId || activeBoard?.id;
        
        if (!boardIdValue) {
          setTasks([]);
          setLoading(false);
          return;
        }
        
        const [boardData, data] = await Promise.all([
          getBoard(boardIdValue),
          getBoardTasks(boardIdValue),
        ]);
        setBoard(boardData);
        const tasksList = normalizeTaskList(data);
        setTasks(tasksList);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching tasks:', err);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [boardId, activeBoard?.id]);

  const sortedTasks = [...tasks].sort((a, b) => {
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';
    
    if (typeof aValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return sortConfig.direction === 'asc'
      ? aValue - bValue
      : bValue - aValue;
  });

  const paginatedTasks = sortedTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const createTask = async () => {
    const boardIdValue = boardId || activeBoard?.id;
    if (!boardIdValue || !newTaskTitle.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const boardContext = board || await getBoard(boardIdValue);
      const created = await createBoardTask(boardContext, { title: newTaskTitle.trim() });
      setTasks((items) => [created, ...items]);
      setNewTaskTitle('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.ceil(tasks.length / itemsPerPage);

  const getStatusBadge = (status) => {
    const statusMap = {
      'TODO': { bg: 'bg-red-100', text: 'text-red-700' },
      'IN_PROGRESS': { bg: 'bg-blue-100', text: 'text-blue-700' },
      'WAITING': { bg: 'bg-orange-100', text: 'text-orange-700' },
      'DONE': { bg: 'bg-green-100', text: 'text-green-700' }
    };
    const statusUpper = status?.toUpperCase() || 'TODO';
    const config = statusMap[statusUpper] || statusMap['TODO'];
    
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${config.bg} ${config.text}`}>
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

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) {
      return <span className="text-slate-300 ml-1">⇅</span>;
    }
    return <span className="text-sky-600 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <ViewTabs />
      <Toolbar />

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Table tasks</h2>
            <p className="text-xs text-slate-500">Connected to GET/POST /api/v1/boards/:boardId/tasks</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createTask();
              }}
              placeholder="New task title"
              className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={createTask}
              disabled={creating || !newTaskTitle.trim()}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500">Loading tasks...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-500">Error: {error}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse bg-white">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 border-r border-slate-200 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('title')}>
                      Task <SortIcon column="title" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 border-r border-slate-200 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('status')}>
                      Status <SortIcon column="status" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 border-r border-slate-200 w-24">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 border-r border-slate-200 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('dueDate')}>
                      Due Date <SortIcon column="dueDate" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 border-r border-slate-200 w-12">
                      Assignee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-blue-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 border-r border-slate-200 max-w-xs truncate">
                        {task.title || task.name || 'Untitled'}
                      </td>
                      <td className="px-4 py-3 text-sm border-r border-slate-200">
                        {getStatusBadge(task.status || task.statusId)}
                      </td>
                      <td className="px-4 py-3 border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getProgressColor(task.progress || 0)}`}
                              style={{ width: `${task.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 whitespace-nowrap w-8">
                            {task.progress || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : '—'}
                      </td>
                      <td className="px-4 py-3 border-r border-slate-200">
                        {task.assignee && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-white text-xs flex items-center justify-center font-bold"
                               title={typeof task.assignee === 'string' ? task.assignee : task.assignee?.name}>
                            {(typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || '')
                              .substring(0, 2)
                              .toUpperCase() || 'A'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 truncate">
                        {task.description || task.comment || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tasks.length === 0 && !loading && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">No tasks found</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, tasks.length)} of {tasks.length} tasks
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-2 py-1 text-xs border rounded transition-all ${
                        currentPage === page
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
