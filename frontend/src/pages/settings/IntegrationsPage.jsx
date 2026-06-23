import { useEffect, useMemo, useRef, useState } from "react";
import SettingsSidebar from "./sections/SettingsSidebar";
import { useAppContext } from "../AppContext";
import {
  useDisconnectGoogleDriveMutation,
  useGoogleDriveConnectAction,
  useGoogleCalendarConnectMutation,
  useGoogleCalendarSyncMutation,
  useIntegrationStatusesQuery,
} from "../../hooks/useSettingsQueries";

const SUPPORTED_PROVIDERS = [
  {
    id: "google-drive",
    name: "Google Drive",
    category: "File Storage",
    icon: "fa-brands fa-google-drive",
    color: "from-emerald-400 to-sky-500",
    description: "Attach Drive files to tasks and keep linked documents available from Mongez.",
    backend: "drive",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Calendar",
    icon: "fa-regular fa-calendar-check",
    color: "from-blue-500 to-cyan-400",
    description: "Authorize Google Calendar for the active workspace and trigger a manual sync when needed.",
    backend: "calendar",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    icon: "fa-brands fa-whatsapp",
    color: "from-green-400 to-emerald-600",
    description: "See whether WhatsApp messaging is configured for the active workspace.",
    backend: "whatsapp",
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "Messaging",
    icon: "fa-brands fa-telegram",
    color: "from-sky-400 to-blue-600",
    description: "See whether the Telegram bot is configured for the active workspace.",
    backend: "telegram",
  },
];

const FILTERS = ["All Apps", ...new Set(SUPPORTED_PROVIDERS.map((provider) => provider.category))];

const integrationPath = [
  { name: "Settings", color: "text-slate-400", ref: "/settings" },
  { name: "Integrations", color: "text-slate-800", ref: "/settings/integrations" },
];

function getStatus(provider, statuses, activeSpaceId) {
  if (provider.backend === "drive") {
    return statuses.googleDriveConnected
      ? { label: "Connected", tone: "green", detail: "Drive authorization is active for the signed-in user." }
      : { label: "Not connected", tone: "slate", detail: "Authorize Google Drive to attach files from tasks." };
  }

  if (provider.backend === "calendar") {
    return activeSpaceId
      ? { label: "Authorization required", tone: "blue", detail: "Open the Google authorization flow in a separate window, then return here to run a manual sync." }
      : { label: "Select a space", tone: "amber", detail: "Choose a workspace before starting Google Calendar authorization." };
  }

  if (provider.backend === "whatsapp") {
    if (!activeSpaceId) {
      return { label: "Select a space", tone: "amber", detail: "Workspace-scoped messaging needs an active space." };
    }

    if (!statuses.whatsapp) {
      return { label: "Status unavailable", tone: "slate", detail: "The workspace status endpoint did not return WhatsApp details." };
    }

    if (statuses.whatsapp.configured) {
      return {
        label: statuses.whatsapp.isActive ? "Configured" : "Inactive",
        tone: statuses.whatsapp.isActive ? "green" : "amber",
        detail: statuses.whatsapp.displayName || "Workspace account found.",
      };
    }

    return { label: "Not configured", tone: "slate", detail: "No WhatsApp workspace account is configured yet." };
  }

  if (provider.backend === "telegram") {
    if (!activeSpaceId) {
      return { label: "Select a space", tone: "amber", detail: "Workspace-scoped messaging needs an active space." };
    }

    if (!statuses.telegram) {
      return { label: "Status unavailable", tone: "slate", detail: "The workspace status endpoint did not return Telegram details." };
    }

    if (statuses.telegram.configured) {
      return {
        label: statuses.telegram.isActive ? "Configured" : "Inactive",
        tone: statuses.telegram.isActive ? "green" : "amber",
        detail: statuses.telegram.botUsername ? `Bot ${statuses.telegram.botUsername}` : "Workspace bot found.",
      };
    }

    return { label: "Not configured", tone: "slate", detail: "No Telegram workspace bot is configured yet." };
  }

  return { label: "Unknown", tone: "slate", detail: "" };
}

function StatusBadge({ status }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    blue: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    slate: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[status.tone] || tones.slate}`}>
      {status.label}
    </span>
  );
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">{value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
    </div>
  );
}

function ProviderAction({
  provider,
  statuses,
  activeSpaceId,
  busyAction,
  onDriveConnect,
  onDriveDisconnect,
  onCalendarConnect,
  onCalendarSync,
}) {
  const busy = busyAction === provider.id;

  if (provider.backend === "drive") {
    return statuses.googleDriveConnected ? (
      <button
        type="button"
        onClick={onDriveDisconnect}
        disabled={busy}
        className="rounded-2xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
      >
        {busy ? "Disconnecting..." : "Disconnect"}
      </button>
    ) : (
      <button
        type="button"
        onClick={onDriveConnect}
        className="rounded-2xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
      >
        Connect
      </button>
    );
  }

  if (provider.backend === "calendar") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCalendarConnect}
          disabled={!activeSpaceId || busy}
          className="rounded-2xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700"
        >
          {busy ? "Opening..." : "Authorize"}
        </button>
        <button
          type="button"
          onClick={onCalendarSync}
          disabled={!activeSpaceId || busy}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Manual sync
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled
      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400 opacity-70 dark:border-slate-700"
    >
      Status only
    </button>
  );
}

export default function IntegrationsPage({ setPath }) {
  const { activeSpace, activeSpaceId } = useAppContext();
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Apps");
  const [busyAction, setBusyAction] = useState("");
  const popupWatcherRef = useRef(null);
  const statusesQuery = useIntegrationStatusesQuery(activeSpaceId);
  const disconnectDriveMutation = useDisconnectGoogleDriveMutation(activeSpaceId);
  const connectGoogleDrive = useGoogleDriveConnectAction();
  const connectCalendarMutation = useGoogleCalendarConnectMutation();
  const syncCalendarMutation = useGoogleCalendarSyncMutation(activeSpaceId);
  const statuses = statusesQuery.data || {
    googleDriveConnected: false,
    whatsapp: null,
    telegram: null,
  };
  const loading = statusesQuery.isLoading || statusesQuery.isFetching;

  useEffect(() => {
    setPath?.(integrationPath);
  }, [setPath]);

  useEffect(() => {
    return () => {
      if (popupWatcherRef.current) {
        window.clearInterval(popupWatcherRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (statusesQuery.isError) {
      setError(statusesQuery.error?.message || "Unable to load integration statuses.");
    }
  }, [statusesQuery.error?.message, statusesQuery.isError]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const authError = params.get("error");

    if (connected === "google") {
      setSuccessMessage("Google Drive connected successfully.");
      params.delete("connected");
      const nextQuery = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
      statusesQuery.refetch();
    }

    if (authError) {
      setError(authError);
      params.delete("error");
      const nextQuery = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
    }
  }, [statusesQuery.refetch]);

  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return SUPPORTED_PROVIDERS.filter((provider) => {
      const matchesFilter = filter === "All Apps" || provider.category === filter;
      const matchesSearch = !query || `${provider.name} ${provider.category} ${provider.description}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search]);

  const connectedCount = useMemo(() => {
    return SUPPORTED_PROVIDERS.reduce((count, provider) => {
      const status = getStatus(provider, statuses, activeSpaceId);
      return status.tone === "green" ? count + 1 : count;
    }, 0);
  }, [activeSpaceId, statuses]);

  const configuredMessagingCount = useMemo(() => {
    return ["whatsapp", "telegram"].reduce((count, providerId) => {
      const provider = SUPPORTED_PROVIDERS.find((item) => item.id === providerId);
      const status = provider ? getStatus(provider, statuses, activeSpaceId) : null;
      return status?.tone === "green" ? count + 1 : count;
    }, 0);
  }, [activeSpaceId, statuses]);

  const handleDriveConnect = () => {
    connectGoogleDrive();
  };

  const handleDriveDisconnect = async () => {
    setBusyAction("google-drive");
    setError("");
    setSuccessMessage("");

    try {
      await disconnectDriveMutation.mutateAsync();
      setSuccessMessage("Google Drive disconnected.");
    } catch (requestError) {
      setError(requestError.message || "Unable to disconnect Google Drive.");
    } finally {
      setBusyAction("");
    }
  };

  const handleCalendarConnect = async () => {
    if (!activeSpaceId) {
      return;
    }

    setBusyAction("google-calendar");
    setError("");
    setSuccessMessage("");

    try {
      const result = await connectCalendarMutation.mutateAsync(activeSpaceId);
      if (!result?.url) {
        throw new Error("Google Calendar did not return an authorization URL.");
      }

      const popup = window.open(result.url, "mongez-google-calendar", "popup=yes,width=640,height=760");

      if (!popup) {
        window.location.href = result.url;
        return;
      }

      setSuccessMessage("Google Calendar authorization opened in a separate window.");

      popupWatcherRef.current = window.setInterval(() => {
        if (!popup.closed) {
          return;
        }

        window.clearInterval(popupWatcherRef.current);
        popupWatcherRef.current = null;
        setBusyAction("");
        setSuccessMessage("Google Calendar authorization window closed. Run a manual sync to confirm the connection.");
      }, 600);
      return;
    } catch (requestError) {
      setError(requestError.message || "Unable to start Google Calendar connection.");
    } finally {
      setBusyAction("");
    }
  };

  const handleCalendarSync = async () => {
    if (!activeSpaceId) {
      return;
    }

    setBusyAction("google-calendar");
    setError("");
    setSuccessMessage("");

    try {
      await syncCalendarMutation.mutateAsync();
      setSuccessMessage("Google Calendar sync request sent.");
    } catch (requestError) {
      setError(requestError.message || "Unable to sync Google Calendar.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <SettingsSidebar activeId="integrations" />

      <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50" aria-label="Integration settings">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-sky-500">Settings</p>
              <h1 className="text-2xl font-black tracking-tight">App Integrations</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Only integrations with existing frontend/backend contracts are shown here. No roadmap or dummy providers are mixed into this page.
              </p>
              {activeSpace ? (
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  Active workspace: <span className="text-slate-600 dark:text-slate-300">{activeSpace.name}</span>
                </p>
              ) : (
                <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                  Select a workspace to check messaging integrations or authorize Google Calendar.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                statusesQuery.refetch();
              }}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-600 disabled:cursor-wait disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/40"
            >
              <i className={`fa-solid fa-rotate ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh status
            </button>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Supported"
              value={SUPPORTED_PROVIDERS.length}
              hint="Integrations with current contracts"
            />
            <SummaryCard
              label="Connected"
              value={connectedCount}
              hint="Providers reporting an active connection"
            />
            <SummaryCard
              label="Messaging Ready"
              value={configuredMessagingCount}
              hint="Workspace messaging channels configured"
            />
          </div>

          <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full lg:max-w-sm">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search supported apps..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      filter === item
                        ? "border-sky-400 bg-sky-500 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {visibleProviders.map((provider) => {
              const status = getStatus(provider, statuses, activeSpaceId);

              return (
                <article
                  key={provider.id}
                  className="group flex min-h-[250px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-500/30"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${provider.color} text-xl text-white shadow-lg shadow-slate-900/10`}>
                      <i className={provider.icon} aria-hidden="true" />
                    </div>
                    <StatusBadge status={loading ? { label: "Loading", tone: "slate" } : status} />
                  </div>

                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h2 className="text-base font-black">{provider.name}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {provider.category}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{provider.description}</p>
                    <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-300">{loading ? "Refreshing provider details..." : status.detail}</p>
                    {provider.backend === "whatsapp" && statuses.whatsapp?.displayName ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">Account: {statuses.whatsapp.displayName}</p>
                    ) : null}
                    {provider.backend === "telegram" && statuses.telegram?.botUsername ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">Bot: {statuses.telegram.botUsername}</p>
                    ) : null}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <ProviderAction
                      provider={provider}
                      statuses={statuses}
                      activeSpaceId={activeSpaceId}
                      busyAction={busyAction}
                      onDriveConnect={handleDriveConnect}
                      onDriveDisconnect={handleDriveDisconnect}
                      onCalendarConnect={handleCalendarConnect}
                      onCalendarSync={handleCalendarSync}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          {!visibleProviders.length ? (
            <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              No supported integrations match your search.
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
