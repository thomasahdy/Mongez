import { useEffect, useMemo, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import {
  getDashboardActivity,
  getDashboardPriorityBreakdown,
  getDashboardStats,
  getDashboardTaskCompletion,
  getDashboardTeamLoad,
} from '../../lib/pageApi';

const statCards = [
  { key: 'totalTasks', label: 'Total tasks', icon: 'fa-list-check', fallback: 0 },
  { key: 'completedTasks', label: 'Completed', icon: 'fa-circle-check', fallback: 0 },
  { key: 'overdueTasks', label: 'Overdue', icon: 'fa-triangle-exclamation', fallback: 0 },
  { key: 'activeMembers', label: 'Active members', icon: 'fa-users', fallback: 0 },
];

function toNumber(value, fallback = 0) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return fallback;
}

function normalizeStats(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (Array.isArray(payload)) return Object.assign({}, ...payload);
  if (Array.isArray(payload?.data)) return Object.assign({}, ...payload.data);
  return payload.data || payload;
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.members)) return payload.members;
  if (Array.isArray(payload?.breakdown)) return payload.breakdown;
  return [];
}

function DashboardStatCard({ stat, loading }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-2xl bg-sky-50 px-3 py-2 text-sky-600">
          <i className={`fa-solid ${stat.icon}`} />
        </span>
        {loading && <span className="h-2 w-16 animate-pulse rounded-full bg-slate-200" />}
      </div>
      <div className="text-3xl font-black tracking-[-0.04em] text-slate-950">
        {loading ? '—' : stat.value}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-500">{stat.label}</div>
    </div>
  );
}

function DashboardPage() {
  const { setPath } = useOutletContext() || {};
  const { activeSpace, spaces } = useAppContext();
  const spaceId = activeSpace?.id || spaces[0]?.id;
  const [stats, setStats] = useState({});
  const [activity, setActivity] = useState([]);
  const [completion, setCompletion] = useState([]);
  const [priority, setPriority] = useState([]);
  const [teamLoad, setTeamLoad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setPath?.([
      { name: 'Workspace', color: 'text-slate-400', ref: '/spaces' },
      { name: 'Dashboard', color: 'text-slate-800', ref: '' },
    ]);
  }, [setPath]);

  const loadDashboard = useCallback(async () => {
    if (!spaceId) {
      setLoading(false);
      setError('Select a workspace to load dashboard analytics.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [statsData, activityData, completionData, priorityData, teamLoadData] = await Promise.all([
        getDashboardStats(spaceId),
        getDashboardActivity(spaceId),
        getDashboardTaskCompletion(spaceId),
        getDashboardPriorityBreakdown(spaceId),
        getDashboardTeamLoad(spaceId),
      ]);
      setStats(normalizeStats(statsData));
      setActivity(normalizeList(activityData));
      setCompletion(normalizeList(completionData));
      setPriority(normalizeList(priorityData));
      setTeamLoad(normalizeList(teamLoadData));
    } catch (err) {
      setError(err.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const cards = useMemo(() => statCards.map((item) => ({
    ...item,
    value: toNumber(stats[item.key] ?? stats[item.label?.toLowerCase?.()] ?? item.fallback),
  })), [stats]);

  const maxLoad = Math.max(...teamLoad.map((item) => toNumber(item.load ?? item.tasks ?? item.count)), 1);

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col justify-between gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Workspace overview</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Live workspace metrics from analytics and space stats APIs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadDashboard} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
              <i className="fa-solid fa-rotate mr-2" /> Refresh
            </button>
            <button type="button" className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white">
              <i className="fa-solid fa-download mr-2" /> Export
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <DashboardStatCard key={card.key} stat={card} loading={loading} />)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Task completion</p>
                <h2 className="text-lg font-black text-slate-950">Progress by status</h2>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600">
                {completion.length || priority.length || teamLoad.length ? 'API' : 'No data'}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : completion.length || priority.length ? (
              <div className="space-y-4">
                {[...completion, ...priority].slice(0, 6).map((item, index) => {
                  const label = item.label || item.status || item.priority || item.name || `Item ${index + 1}`;
                  const value = toNumber(item.value ?? item.count ?? item.tasks ?? item.percentage);
                  const max = Math.max(...[...completion, ...priority].map((entry) => toNumber(entry.value ?? entry.count ?? entry.tasks ?? entry.percentage)), 1);
                  return (
                    <div key={`${label}-${index}`} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{label}</span>
                        <span className="text-slate-500">{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No task completion data returned yet.
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Team load</p>
              <h2 className="text-lg font-black text-slate-950">Capacity</h2>
            </div>

            {teamLoad.length ? (
              <div className="space-y-4">
                {teamLoad.slice(0, 6).map((member) => {
                  const name = member.name || member.user?.name || member.email || 'Unnamed member';
                  const load = toNumber(member.load ?? member.tasks ?? member.count);
                  return (
                    <div key={name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{name}</span>
                        <span className="text-slate-500">{load}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (load / maxLoad) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No team load data returned yet.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Activity</p>
                <h2 className="text-lg font-black text-slate-950">Recent events</h2>
              </div>
            </div>
            <div className="space-y-4">
              {activity.length ? activity.slice(0, 6).map((item, index) => (
                <div key={`${item.id || index}`} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sky-600 shadow-sm">
                    <i className="fa-solid fa-bolt" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.title || item.message || item.action || 'Workspace activity'}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description || item.createdAt || 'Just now'}</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No activity returned yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Endpoints</p>
              <h2 className="text-lg font-black text-slate-950">Connected API</h2>
            </div>
            <div className="space-y-3 text-sm">
              {[
                'GET /api/v1/analytics/overview',
                'GET /api/v1/analytics/tasks',
                'GET /api/v1/analytics/team',
                'GET /api/v1/spaces/:id/stats',
                'GET /api/v1/approvals/pending',
              ].map((endpoint) => (
                <div key={endpoint} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-600">
                  {endpoint}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
