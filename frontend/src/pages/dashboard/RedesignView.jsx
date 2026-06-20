import { useState, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import ViewTabs from './viewtabs/ViewTabs';
import Toolbar from './toolbar/Toolbar';
import * as appApi from '../../lib/appApi';

export default function RedesignView() {
  const { boardId } = useParams();
  const { activeBoard } = useOutletContext() || {};
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupedTasks, setGroupedTasks] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

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
        const tasksList = Array.isArray(data) ? data : data.tasks || data.data || [];
        setTasks(tasksList);
        groupTasksByStatus(tasksList);
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

  const groupTasksByStatus = (taskList) => {
    const grouped = {
      'TO DO': [],
      'IN PROGRESS': [],
      'WAITING': [],
      'DONE': []
    };
    
    taskList.forEach(task => {
      let status = task.status?.toUpperCase() || task.statusId?.toUpperCase() || 'TODO';
      
      if (status === 'TODO') status = 'TO DO';
      if (status === 'IN_PROGRESS') status = 'IN PROGRESS';
      
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped['TO DO'].push(task);
      }
    });
    
    const expandedState = {};
    Object.keys(grouped).forEach(group => {
      expandedState[group] = true;
    });
    setExpandedGroups(expandedState);
    setGroupedTasks(grouped);
  };

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const getStatusIcon = (status) => {
    const icons = {
      'TO DO': 'fa-regular fa-circle',
      'IN PROGRESS': 'fa-solid fa-spinner',
      'WAITING': 'fa-solid fa-pause',
      'DONE': 'fa-solid fa-check-circle'
    };
    return icons[status] || 'fa-regular fa-circle';
  };

  const getStatusColor = (status) => {
    const colors = {
      'TO DO': { dot: '#ef4444', badge: 'bg-red-100 text-red-700' },
      'IN PROGRESS': { dot: '#00a8e8', badge: 'bg-blue-100 text-blue-700' },
      'WAITING': { dot: '#ea580c', badge: 'bg-orange-100 text-orange-700' },
      'DONE': { dot: '#10b981', badge: 'bg-green-100 text-green-700' }
    };
    return colors[status] || colors['TO DO'];
  };

  const getProgressColor = (progress) => {
    if (progress >= 75) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <ViewTabs />
      <Toolbar />

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
            {Object.entries(groupedTasks).map(([status, statusTasks]) => (
              <div key={status} className="bg-white border-b border-slate-200 first:border-t">
                {/* Status Header */}
                <div
                  className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 z-10"
                  onClick={() => toggleGroup(status)}
                >
                  <i
                    className={`${getStatusIcon(status)} text-sm`}
                    style={{ color: getStatusColor(status).dot }}
                  />
                  <span className="text-sm font-bold text-slate-700 uppercase tracking-wide flex-1">
                    {status}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-semibold">
                    {statusTasks.length}
                  </span>
                  <i
                    className={`fas fa-chevron-down text-xs transition-transform ${
                      expandedGroups[status] ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* Task List */}
                {expandedGroups[status] && (
                  <div className="divide-y divide-slate-100">
                    {statusTasks.map(task => (
                      <div
                        key={task.id}
                        className="px-4 py-4 hover:bg-sky-50 transition-colors cursor-pointer border-l-4 border-l-transparent hover:border-l-sky-500"
                      >
                        {/* Task Header */}
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-900 flex-1 line-clamp-2">
                            {task.title || task.name || 'Untitled Task'}
                          </h4>
                          {task.priority && (
                            <span className={`px-2 py-1 rounded text-xs font-bold ml-2 flex-shrink-0 ${
                              task.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                              task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {task.priority}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {(task.description || task.comment) && (
                          <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                            {task.description || task.comment}
                          </p>
                        )}

                        {/* Progress Bar */}
                        {task.progress !== undefined && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500 font-medium">Progress</span>
                              <span className="text-xs font-bold text-slate-700">{task.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getProgressColor(task.progress)}`}
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Meta Info */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                          {task.dueDate && (
                            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded">
                              <i className="far fa-calendar" style={{fontSize: '10px'}}></i>
                              {new Date(task.dueDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          )}
                          {task.comments !== undefined && (
                            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded">
                              <i className="far fa-comment" style={{fontSize: '10px'}}></i>
                              {task.comments}
                            </span>
                          )}
                        </div>

                        {/* Footer: Assignee & Tags */}
                        <div className="flex items-center justify-between">
                          {task.assignee && (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold"
                                title={typeof task.assignee === 'string' ? task.assignee : task.assignee?.name}
                              >
                                {(typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || '')
                                  .substring(0, 2)
                                  .toUpperCase() || 'A'}
                              </div>
                              <span className="text-xs text-slate-600">
                                {typeof task.assignee === 'string' ? task.assignee : task.assignee?.name}
                              </span>
                            </div>
                          )}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex gap-1">
                              {task.tags.slice(0, 2).map((tag, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                  {tag}
                                </span>
                              ))}
                              {task.tags.length > 2 && (
                                <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                                  +{task.tags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
  );
}

  const groupTasksByStatus = (taskList) => {
    const grouped = {
      'TO DO': [],
      'IN PROGRESS': [],
      'WAITING': [],
      'DONE': []
    };
    
    taskList.forEach(task => {
      let status = task.status?.toUpperCase() || task.statusId?.toUpperCase() || 'TODO';
      
      // Map to grouped status keys
      if (status === 'TODO') status = 'TO DO';
      if (status === 'IN_PROGRESS') status = 'IN PROGRESS';
      
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped['TO DO'].push(task);
      }
    });
    
    // Initialize all groups as expanded
    const expandedState = {};
    Object.keys(grouped).forEach(group => {
      expandedState[group] = true;
    });
    setExpandedGroups(expandedState);
    setGroupedTasks(grouped);
  };

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const getStatusIcon = (status) => {
    const icons = {
      'TO DO': 'fa-regular fa-circle',
      'IN PROGRESS': 'fa-solid fa-spinner',
      'WAITING': 'fa-solid fa-pause',
      'DONE': 'fa-solid fa-check-circle'
    };
    return icons[status] || 'fa-regular fa-circle';
  };

  const getStatusColor = (status) => {
    const colors = {
      'TO DO': { dot: '#ef4444', badge: 'bg-red-100 text-red-700' },
      'IN PROGRESS': { dot: '#00a8e8', badge: 'bg-blue-100 text-blue-700' },
      'WAITING': { dot: '#ea580c', badge: 'bg-orange-100 text-orange-700' },
      'DONE': { dot: '#10b981', badge: 'bg-green-100 text-green-700' }
    };
    return colors[status] || colors['TO DO'];
  };

  const getProgressColor = (progress) => {
    if (progress >= 75) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <ViewTabs />
      <Toolbar />

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
            {Object.entries(groupedTasks).map(([status, statusTasks]) => (
              <div key={status} className="bg-white border-b border-slate-200 first:border-t">
                {/* Status Header */}
                <div
                  className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors sticky top-0 z-10"
                  onClick={() => toggleGroup(status)}
                >
                  <i
                    className={`${getStatusIcon(status)} text-sm`}
                    style={{ color: getStatusColor(status).dot }}
                  />
                  <span className="text-sm font-bold text-slate-700 uppercase tracking-wide flex-1">
                    {status}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-semibold">
                    {statusTasks.length}
                  </span>
                  <i
                    className={`fas fa-chevron-down text-xs transition-transform ${
                      expandedGroups[status] ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* Task List */}
                {expandedGroups[status] && (
                  <div className="divide-y divide-slate-100">
                    {statusTasks.map(task => (
                      <div
                        key={task.id}
                        className="px-4 py-4 hover:bg-sky-50 transition-colors cursor-pointer border-l-4 border-l-transparent hover:border-l-sky-500"
                      >
                        {/* Task Header */}
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-900 flex-1 line-clamp-2">
                            {task.title || task.name || 'Untitled Task'}
                          </h4>
                          {task.priority && (
                            <span className={`px-2 py-1 rounded text-xs font-bold ml-2 flex-shrink-0 ${
                              task.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                              task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {task.priority}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {(task.description || task.comment) && (
                          <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                            {task.description || task.comment}
                          </p>
                        )}

                        {/* Progress Bar */}
                        {task.progress !== undefined && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500 font-medium">Progress</span>
                              <span className="text-xs font-bold text-slate-700">{task.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getProgressColor(task.progress)}`}
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Meta Info */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                          {task.dueDate && (
                            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded">
                              <i className="far fa-calendar" style={{fontSize: '10px'}}></i>
                              {new Date(task.dueDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          )}
                          {task.comments !== undefined && (
                            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded">
                              <i className="far fa-comment" style={{fontSize: '10px'}}></i>
                              {task.comments}
                            </span>
                          )}
                        </div>

                        {/* Footer: Assignee & Tags */}
                        <div className="flex items-center justify-between">
                          {task.assignee && (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold"
                                title={typeof task.assignee === 'string' ? task.assignee : task.assignee?.name}
                              >
                                {(typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || '')
                                  .substring(0, 2)
                                  .toUpperCase() || 'A'}
                              </div>
                              <span className="text-xs text-slate-600">
                                {typeof task.assignee === 'string' ? task.assignee : task.assignee?.name}
                              </span>
                            </div>
                          )}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex gap-1">
                              {task.tags.slice(0, 2).map((tag, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                  {tag}
                                </span>
                              ))}
                              {task.tags.length > 2 && (
                                <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                                  +{task.tags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
  );
