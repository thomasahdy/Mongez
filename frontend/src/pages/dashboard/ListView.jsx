import { useState, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import ViewTabs from '../home/viewtabs/ViewTabs';
import Toolbar from '../home/toolbar/Toolbar';
import * as appApi from '../../lib/appApi';
import { normalizeTaskList } from '../../lib/taskMappers';

export default function ListView() {
  const { boardId } = useParams();
  const { activeBoard } = useOutletContext() || {};
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupBy, setGroupBy] = useState('status');
  const [groupedTasks, setGroupedTasks] = useState({});

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const boardIdValue = boardId || activeBoard?.id;
        
        if (!boardIdValue) {
          setTasks([]);
          setGroupedTasks({});
          setLoading(false);
          return;
        }
        
        const data = await appApi.getTasksByBoard(boardIdValue);
        const tasksList = normalizeTaskList(data);
        setTasks(tasksList);
        groupTasks(tasksList, 'status');
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

  const groupTasks = (taskList, groupByKey) => {
    const grouped = {};
    
    taskList.forEach(task => {
      let key;
      
      if (groupByKey === 'status') {
        key = task.status?.toUpperCase() || task.statusId?.toUpperCase() || 'TODO';
      } else if (groupByKey === 'assignee') {
        key = typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || 'Unassigned';
      } else if (groupByKey === 'priority') {
        key = task.priority || 'Normal';
      } else {
        key = 'All Tasks';
      }
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(task);
    });
    
    setGroupedTasks(grouped);
  };

  const handleGroupBy = (newGroupBy) => {
    setGroupBy(newGroupBy);
    groupTasks(tasks, newGroupBy);
  };

  const getStatusColor = (status) => {
    const colors = {
      'TODO': { dot: '#ef4444', badge: 'bg-red-100 text-red-700' },
      'IN_PROGRESS': { dot: '#00a8e8', badge: 'bg-blue-100 text-blue-700' },
      'WAITING': { dot: '#ea580c', badge: 'bg-orange-100 text-orange-700' },
      'DONE': { dot: '#10b981', badge: 'bg-green-100 text-green-700' }
    };
    const statusUpper = status?.toUpperCase() || 'TODO';
    return colors[statusUpper] || colors['TODO'];
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'HIGH': { badge: 'bg-red-100 text-red-700' },
      'MEDIUM': { badge: 'bg-yellow-100 text-yellow-700' },
      'LOW': { badge: 'bg-slate-100 text-slate-700' }
    };
    const priorityUpper = priority?.toUpperCase() || 'MEDIUM';
    return colors[priorityUpper] || colors['MEDIUM'];
  };

  const getGroupColor = (groupKey) => {
    if (groupBy === 'status') {
      return getStatusColor(groupKey).dot;
    } else if (groupBy === 'priority') {
      const colorMap = { 'HIGH': '#ef4444', 'MEDIUM': '#f59e0b', 'LOW': '#94a3b8' };
      return colorMap[groupKey] || '#94a3b8';
    }
    return '#94a3b8';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <ViewTabs />
      <Toolbar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Group By Controls */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">Group by:</label>
          <select
            value={groupBy}
            onChange={(e) => handleGroupBy(e.target.value)}
            className="px-3 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="status">Status</option>
            <option value="assignee">Assignee</option>
            <option value="priority">Priority</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Tasks List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Loading tasks...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500">Error: {error}</p>
            </div>
          ) : (
            <div className="space-y-0">
              {Object.entries(groupedTasks).map(([groupKey, groupTasks]) => (
                <div key={groupKey} className="bg-white border-b border-slate-200">
                  {/* Group Header */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 sticky top-0 z-10">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getGroupColor(groupKey) }}
                    />
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      {groupKey}
                    </span>
                    <span className="text-xs text-slate-500 ml-auto">
                      ({groupTasks.length} {groupTasks.length === 1 ? 'task' : 'tasks'})
                    </span>
                  </div>

                  {/* Group Tasks */}
                  <div className="divide-y divide-slate-100">
                    {groupTasks.map(task => (
                      <div
                        key={task.id}
                        className="px-4 py-3 hover:bg-sky-50 transition-colors cursor-pointer border-l-4 border-l-transparent hover:border-l-sky-500"
                      >
                        <div className="flex items-start gap-3">
                          {/* Status Indicator */}
                          <div
                            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: getStatusColor(task.status || task.statusId).dot }}
                          />

                          {/* Task Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-slate-900 truncate">
                                {task.title || task.name || 'Untitled'}
                              </h4>
                              {task.priority && (
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(task.priority).badge}`}>
                                  {task.priority}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(task.status || task.statusId).badge}`}>
                                {(task.status || task.statusId)?.toUpperCase() || 'TODO'}
                              </span>
                            </div>

                            {/* Description */}
                            {(task.description || task.comment) && (
                              <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                                {task.description || task.comment}
                              </p>
                            )}

                            {/* Meta Info */}
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <i className="fas fa-calendar-alt" style={{fontSize: '10px'}}></i>
                                  {new Date(task.dueDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              )}
                              {task.progress !== undefined && (
                                <span className="flex items-center gap-1">
                                  <i className="fas fa-chart-pie" style={{fontSize: '10px'}}></i>
                                  {task.progress}%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Assignee Avatar */}
                          {task.assignee && (
                            <div
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold"
                              title={typeof task.assignee === 'string' ? task.assignee : task.assignee?.name}
                            >
                              {(typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || '')
                                .substring(0, 2)
                                .toUpperCase() || 'A'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {tasks.length === 0 && !loading && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">No tasks found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
