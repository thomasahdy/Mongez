import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import ViewTabs from '../home/viewtabs/ViewTabs';
import Toolbar from '../home/toolbar/Toolbar';
import { useAppContext } from '../AppContext';
import { useTimelineQuery } from '../../hooks/useDashboardQueries';
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const CELL_WIDTH = {
  days: 40,
  weeks: 88,
  months: 112,
};

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date) {
  const next = startOfDay(date);
  next.setDate(1);
  return next;
}

function addPeriod(date, scale, amount) {
  const next = new Date(date);

  if (scale === 'days') {
    next.setDate(next.getDate() + amount);
    return next;
  }

  if (scale === 'weeks') {
    next.setDate(next.getDate() + amount * 7);
    return next;
  }

  next.setMonth(next.getMonth() + amount);
  return next;
}

function getPeriodStart(date, scale) {
  if (scale === 'weeks') {
    return startOfWeek(date);
  }

  if (scale === 'months') {
    return startOfMonth(date);
  }

  return startOfDay(date);
}

function buildTimelineDates(scale) {
  const today = new Date();
  const base = getPeriodStart(today, scale);
  const totalCells = scale === 'days' ? 30 : 12;
  const startOffset = scale === 'days' ? -7 : -2;

  return Array.from({ length: totalCells }, (_, index) => addPeriod(base, scale, startOffset + index));
}

function formatHeaderPrimary(date, scale, locale) {
  if (scale === 'months') {
    return date.toLocaleDateString(locale, { month: 'short' });
  }

  if (scale === 'weeks') {
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }

  return String(date.getDate());
}

function formatHeaderSecondary(date, scale, locale) {
  if (scale === 'months') {
    return String(date.getFullYear());
  }

  return date.toLocaleDateString(locale, { weekday: 'narrow' });
}

function getPeriodValue(date, scale) {
  return getPeriodStart(date, scale).getTime();
}

function getTaskDate(task, key) {
  if (key === 'startDate') {
    return task.startDate || task.createdAt || task.dueDate || task.updatedAt;
  }

  return task.endDate || task.dueDate || task.updatedAt || task.startDate || task.createdAt;
}

function getTaskBarStyle(task, dates, scale, isRTL) {
  const rawStart = getTaskDate(task, 'startDate') || task.dueDate;
  const rawEnd = getTaskDate(task, 'endDate') || task.dueDate || rawStart;

  if (!rawStart || !rawEnd) {
    return { display: 'none' };
  }

  try {
    const axis = dates.map((date) => getPeriodValue(date, scale));
    const startDate = new Date(rawStart);
    const endDate = new Date(rawEnd);
    const normalizedStart = startDate <= endDate ? startDate : endDate;
    const normalizedEnd = endDate >= startDate ? endDate : startDate;
    const startValue = getPeriodValue(normalizedStart, scale);
    const endValue = getPeriodValue(normalizedEnd, scale);
    const firstValue = axis[0];
    const lastValue = axis[axis.length - 1];

    if (endValue < firstValue || startValue > lastValue) {
      return { display: 'none' };
    }

    let startIndex = 0;
    let endIndex = axis.length - 1;

    for (let index = 0; index < axis.length; index += 1) {
      if (axis[index] >= startValue) {
        startIndex = index;
        break;
      }
    }

    for (let index = axis.length - 1; index >= 0; index -= 1) {
      if (axis[index] <= endValue) {
        endIndex = index;
        break;
      }
    }

    if (startValue <= firstValue) {
      startIndex = 0;
    }

    if (endValue >= lastValue) {
      endIndex = axis.length - 1;
    }

    if (endIndex < startIndex) {
      return { display: 'none' };
    }

    const cellWidth = CELL_WIDTH[scale];
    return {
      [isRTL ? "right" : "left"]: `${startIndex * cellWidth}px`,
      width: `${Math.max(cellWidth, (endIndex - startIndex + 1) * cellWidth)}px`,
    };
  } catch {
    return { display: 'none' };
  }
}

function getStatusColor(status) {
  const colors = {
    TODO: '#ef4444',
    IN_PROGRESS: '#00a8e8',
    WAITING: '#ea580c',
    DONE: '#10b981',
  };
  return colors[String(status || '').toUpperCase()] || '#00a8e8';
}

export default function TimelineView() {
  const { boardId } = useParams();
  const { setPath, activeBoard } = useOutletContext() || {};
  const { activeSpace, spaces } = useAppContext();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [scale, setScale] = useState('days');
  const boardIdValue = boardId || activeBoard?.id;
  const spaceId = activeSpace?.id || spaces[0]?.id;
  const locale = i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';

  const dates = useMemo(() => buildTimelineDates(scale), [scale]);
  const timelineQuery = useTimelineQuery({
    boardId: boardIdValue,
    spaceId,
    startDate: dates[0]?.toISOString(),
    endDate: dates[dates.length - 1]?.toISOString(),
  });
  const tasks = useMemo(() => timelineQuery.data?.tasks || [], [timelineQuery.data?.tasks]);
  const calendarEvents = useMemo(() => timelineQuery.data?.calendarEvents || [], [timelineQuery.data?.calendarEvents]);
  const loading = timelineQuery.isLoading || timelineQuery.isFetching;
  const tasksWithoutTimeline = useMemo(
    () => tasks.filter((task) => !getTaskDate(task, 'startDate') && !getTaskDate(task, 'endDate') && !task.dueDate).length,
    [tasks],
  );
  const rangeLabel = useMemo(() => {
    if (!dates.length) {
      return '';
    }

    const start = dates[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const end = dates[dates.length - 1].toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  }, [dates, locale]);

  const groupedTasks = useMemo(() => {
    const grouped = {
      TODO: [],
      IN_PROGRESS: [],
      WAITING: [],
      DONE: [],
    };

    tasks.forEach((task) => {
      const status = String(task.status || task.statusId || 'TODO').toUpperCase();
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped.TODO.push(task);
      }
    });

    return grouped;
  }, [tasks]);
  const formatStatusLabel = (status) => t(`timeline.statuses.${String(status || 'TODO').toUpperCase()}`);

  const eventCountsByPeriod = useMemo(
    () =>
      calendarEvents.reduce((accumulator, event) => {
        const rawDate =
          event.startDate || event.start || event.date || event.startsAt || event.startAt || event.createdAt;

        if (!rawDate) {
          return accumulator;
        }

        const key = String(getPeriodValue(new Date(rawDate), scale));
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {}),
    [calendarEvents, scale],
  );

  useEffect(() => {
    if (!boardId && activeBoard?.id) {
      navigate(`/board/${activeBoard.id}/timeline`, { replace: true });
    }
  }, [boardId, activeBoard?.id, navigate]);

  useEffect(() => {
    setPath?.([
      { name: t('common.workspace'), color: 'text-slate-400', ref: '/dashboard' },
      { name: activeBoard?.name || t('timeline.title'), color: 'text-slate-800', ref: '' },
    ]);
  }, [setPath, activeBoard?.name, t]);

  const error = !boardIdValue
    ? null
    : timelineQuery.isError
      ? timelineQuery.error?.message || t('timeline.loadFailed')
      : null;

  const isToday = (date) => startOfDay(date).getTime() === startOfDay(new Date()).getTime();
  const isWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;
  const chartWidth = dates.length * CELL_WIDTH[scale];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
      <ViewTabs />
      <Toolbar />

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="flex h-full flex-col overflow-hidden">
        <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t('timeline.title')}</h2>
            <p className="text-xs text-slate-500">
              {t('timeline.subtitle', { board: activeBoard?.name || t('timeline.title') })}
            </p>
          </div>
          <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
              {rangeLabel}
            </span>
            {['days', 'weeks', 'months'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScale(option)}
                className={`rounded px-3 py-1 text-xs font-semibold transition-all ${
                  scale === option
                    ? 'bg-sky-500 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                  {t(`timeline.scales.${option}`)}
                </button>
              ))}
            <button
              type="button"
              onClick={() => timelineQuery.refetch()}
              disabled={loading || !boardIdValue}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('timeline.refreshing') : t('timeline.refresh')}
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
              {t('timeline.syncedEvents', { count: calendarEvents.length })}
            </span>
          </div>
        </div>
        {tasksWithoutTimeline > 0 ? (
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-amber-600">
            {tasksWithoutTimeline === 1
              ? t('timeline.tasksMissingDates', { count: tasksWithoutTimeline })
              : t('timeline.tasksMissingDatesPlural', { count: tasksWithoutTimeline })}
          </div>
        ) : null}

        <div className={`flex flex-1 overflow-hidden ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`w-64 overflow-y-auto bg-white ${isRTL ? "border-l border-slate-200" : "border-r border-slate-200"}`}>
            <div className="sticky top-0 border-b border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
              {t('timeline.tasks')} <span className="text-xs font-normal text-slate-400">({tasks.length})</span>
            </div>
            <div className="divide-y divide-slate-100">
              {Object.entries(groupedTasks).map(([status, statusTasks]) =>
                statusTasks.length > 0 ? (
                  <div key={status}>
                    <div className={`flex items-center gap-2 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(status) }} />
                      {formatStatusLabel(status)}
                    </div>
                    {statusTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex cursor-pointer items-center gap-2 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-sky-50 ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                      >
                        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: getStatusColor(status) }} />
                        <span className="flex-1 truncate text-xs font-medium text-slate-700">
                          {task.title || task.name || t('timeline.defaults.untitled')}
                        </span>
                        {task.assignee && (
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-xs font-bold text-white">
                            {(typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || task.assigneeId)
                              ?.substring(0, 2)
                              .toUpperCase() || t('timeline.defaults.selectedAssignee')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null,
              )}
              {tasks.length === 0 && !loading && (
                <div className="p-4 text-center text-xs text-slate-500">{t('timeline.noTasks')}</div>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="sticky top-0 z-10 overflow-x-auto border-b border-slate-200 bg-slate-50">
              <div className="flex" style={{ width: `${chartWidth}px` }}>
                {dates.map((date, index) => {
                  const todayClass = scale === 'days' && isToday(date)
                    ? `bg-sky-100 ${isRTL ? "border-l-2" : "border-r-2"} border-sky-500`
                    : '';
                  const weekendClass = scale === 'days' && isWeekend(date) ? 'bg-slate-100' : '';
                  const eventCount = eventCountsByPeriod[String(getPeriodValue(date, scale))] || 0;

                  return (
                    <div
                      key={index}
                      className={`flex-shrink-0 py-2 text-center text-xs ${todayClass} ${weekendClass} ${isRTL ? "border-l border-slate-200" : "border-r border-slate-200"}`}
                      style={{ width: `${CELL_WIDTH[scale]}px` }}
                    >
                      <div className="font-bold text-slate-700">{formatHeaderPrimary(date, scale, locale)}</div>
                      <div className="text-xs text-slate-400">
                        {scale === 'weeks'
                          ? t('timeline.weekLabel', { value: Math.ceil(date.getDate() / 7) })
                          : formatHeaderSecondary(date, scale, locale)}
                      </div>
                      {eventCount > 0 && (
                        <div className="mt-1 text-[10px] font-semibold text-indigo-500">{t('timeline.eventCount', { count: eventCount })}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-auto relative">
              {tasks.length > 0 ? (
                <div style={{ width: `${chartWidth}px` }}>
                  {tasks.map((task) => (
                    <div key={task.id} className="relative flex h-10 border-b border-slate-100">
                      {dates.map((date, index) => {
                        const weekendClass = scale === 'days' && isWeekend(date) ? 'bg-slate-50' : 'bg-white';
                        return (
                          <div
                            key={index}
                            className={`flex-shrink-0 ${weekendClass} ${isRTL ? "border-l border-slate-200" : "border-r border-slate-200"}`}
                            style={{ width: `${CELL_WIDTH[scale]}px` }}
                          />
                        );
                      })}

                      <div
                        className="absolute top-2 z-20 flex h-6 items-center rounded bg-gradient-to-r from-sky-500 to-sky-600 px-2 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 cursor-pointer"
                        style={getTaskBarStyle(task, dates, scale, isRTL)}
                        title={task.title || task.name || 'Task'}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                      >
                        <span className="truncate text-xs">{task.title || task.name || t('timeline.defaults.task')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-400">{loading ? t('timeline.loading') : t('timeline.noTasksDisplay')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
