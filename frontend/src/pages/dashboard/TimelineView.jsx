import { useState, useEffect } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import ViewTabs from '../home/viewtabs/ViewTabs';
import Toolbar from '../home/toolbar/Toolbar';
import { fetchCalendarEvents } from '../../lib/calendarApi';
import { getBoardTasks } from '../../lib/pageApi';
import { normalizeTaskList } from '../../lib/taskMappers';
import { useAppContext } from '../AppContext';

export default function TimelineView() {
  const { boardId } = useParams();
  const { setPath, activeBoard } = useOutletContext() || {};
  const { activeSpace, spaces } = useAppContext();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState('days');
  const [groupedTasks, setGroupedTasks] = useState({});
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    if (!boardId && activeBoard?.id) {
      navigate(`/board/${activeBoard.id}/timeline`, { replace: true });
      return;
    }
  }, [boardId, activeBoard?.id, navigate]);

  useEffect(() => {
    setPath?.([
      { name: 'Workspace', color: 'text-slate-400', ref: '/spaces' },
      { name: 'Timeline', color: 'text-slate-800', ref: '' },
    ]);
  }, [setPath]);

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
        
        const data = await getBoardTasks(boardIdValue);
        const tasksList = normalizeTaskList(data);
        const range = getDateRange();
        const spaceId = activeSpace?.id || spaces[0]?.id;
        const calendarData = spaceId
          ? await fetchCalendarEvents({
              spaceId,
              startDate: range[0].toISOString(),
              endDate: range[range.length - 1].toISOString(),
              sources: ['tasks', 'events'],
            }).catch(() => [])
          : [];
        setCalendarEvents(Array.isArray(calendarData) ? calendarData : calendarData?.items || []);
        setTasks(tasksList);
        groupTasksByStatus(tasksList);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching tasks:', err);
        setTasks([]);
        setGroupedTasks({});
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [boardId, activeBoard?.id, activeSpace?.id, spaces]);

  const groupTasksByStatus = (taskList) => {
    const grouped = {
      'TODO': [],
      'IN_PROGRESS': [],
      'WAITING': [],
      'DONE': []
    };
    
    taskList.forEach(task => {
      const status = task.status?.toUpperCase() || task.statusId?.toUpperCase() || 'TODO';
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped['TODO'].push(task);
      }
    });
    
    setGroupedTasks(grouped);
  };

  const getDateRange = () => {
    const today = new Date();
    const dates = [];
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i - 7);
      dates.push(date);
    }
    return dates;
  };

  const getTaskBarStyle = (task) => {
    if (!task.startDate || !task.endDate) return { display: 'none' };
    
    try {
      const dates = getDateRange();
      const startDate = new Date(task.startDate);
      const endDate = new Date(task.endDate);
      
      const startIndex = dates.findIndex(d => 
        d.toDateString() === startDate.toDateString()
      );
      const endIndex = dates.findIndex(d => 
        d.toDateString() === endDate.toDateString()
      );
      
      if (startIndex === -1 || endIndex === -1) return { display: 'none' };
      
      const leftOffset = (startIndex * 40) + 40;
      const width = ((endIndex - startIndex + 1) * 40);
      
      return {
        left: `${leftOffset}px`,
        width: `${width}px`
      };
    } catch {
      return { display: 'none' };
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'TODO': '#ef4444',
      'IN_PROGRESS': '#00a8e8',
      'WAITING': '#ea580c',
      'DONE': '#10b981'
    };
    return colors[status?.toUpperCase()] || '#00a8e8';
  };

  const dates = getDateRange();
  const isToday = (date) => date.toDateString() === new Date().toDateString();
  const isWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <ViewTabs/>
      <Toolbar/>
      
      {error && (
        <div className="px-5 py-2 text-sm text-red-500 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      <div className="flex h-full flex-col overflow-hidden">
        {/* Scale Buttons */}
        <div className="flex gap-2 border-b border-slate-200 bg-white px-4 py-2">
          <button
            onClick={() => setScale('days')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
              scale === 'days'
                ? 'bg-sky-500 text-white'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Days
          </button>
          <button
            onClick={() => setScale('weeks')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
              scale === 'weeks'
                ? 'bg-sky-500 text-white'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Weeks
          </button>
          <button
            onClick={() => setScale('months')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
              scale === 'months'
                ? 'bg-sky-500 text-white'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Months
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Task Panel */}
          <div className="w-64 border-r border-slate-200 overflow-y-auto bg-white">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Tasks <span className="text-xs text-slate-400 font-normal">({tasks.length})</span>
            </div>
            <div className="divide-y divide-slate-100">
              {Object.entries(groupedTasks).map(([status, statusTasks]) => (
                statusTasks.length > 0 && (
                  <div key={status}>
                    <div className="px-4 py-2 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: getStatusColor(status) }}
                      ></span>
                      {status.replace('_', ' ')}
                    </div>
                    {statusTasks.map(task => (
                      <div
                        key={task.id}
                        className="px-4 py-3 hover:bg-sky-50 cursor-pointer transition-colors border-b border-slate-100 flex items-center gap-2"
                      >
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: getStatusColor(status) }}
                        />
                        <span className="text-xs font-medium text-slate-700 flex-1 truncate">
                          {task.title || task.name || 'Untitled'}
                        </span>
                        {task.assignee && (
                          <div 
                            className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold"
                          >
                            {(typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || task.assigneeId)
                              ?.substring(0, 2)
                              .toUpperCase() || 'A'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ))}
              {tasks.length === 0 && !loading && (
                <div className="p-4 text-center text-slate-500 text-xs">No tasks found</div>
              )}
            </div>
          </div>

          {/* Chart Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Date Header */}
            <div className="flex bg-slate-50 border-b border-slate-200 overflow-x-auto sticky top-0 z-10">
              {dates.map((date, i) => {
                const todayClass = isToday(date) ? 'bg-sky-100 border-r-2 border-sky-500' : '';
                const weekendClass = isWeekend(date) ? 'bg-slate-100' : '';
                
                return (
                  <div
                    key={i}
                    className={`w-10 flex-shrink-0 text-center py-2 border-r border-slate-200 text-xs ${todayClass} ${weekendClass}`}
                  >
                    <div className="font-bold text-slate-700">{date.getDate()}</div>
                    <div className="text-slate-400 text-xs">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()].substring(0, 1)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Task Rows */}
            <div className="flex-1 overflow-auto relative">
              {tasks.length > 0 ? (
                tasks.map(task => (
                  <div
                    key={task.id}
                    className="flex h-10 border-b border-slate-100 relative group"
                  >
                    {dates.map((date, i) => {
                      const weekendClass = isWeekend(date) ? 'bg-slate-50' : 'bg-white';
                      return (
                        <div
                          key={i}
                          className={`w-10 flex-shrink-0 border-r border-slate-200 ${weekendClass}`}
                        />
                      );
                    })}
                    
                    {/* Task Bar */}
                    <div
                      className="absolute top-2 h-6 rounded bg-gradient-to-r from-sky-500 to-sky-600 text-white text-xs font-semibold flex items-center px-2 shadow-sm hover:shadow-md transition-all hover:opacity-90 z-20"
                      style={getTaskBarStyle(task)}
                      title={task.title || task.name || 'Task'}
                    >
                      <span className="truncate text-xs">{task.title || task.name || 'Task'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400 text-sm">{loading ? 'Loading tasks...' : 'No tasks to display'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
