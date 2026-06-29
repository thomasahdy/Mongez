import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SettingsSidebar from "./sections/SettingsSidebar";
import { useAppContext } from "../AppContext";
import {
  useDisconnectGoogleDriveMutation,
  useGoogleDriveConnectAction,
  useGoogleCalendarConnectMutation,
  useGoogleCalendarSyncMutation,
  useIntegrationStatusesQuery,
} from "../../hooks/useSettingsQueries";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const SUPPORTED_PROVIDERS = [
  {
    id: "google-drive",
    key: "drive",
    icon: "fa-brands fa-google-drive",
    color: "from-emerald-400 to-sky-500",
    backend: "drive",
  },
  {
    id: "google-calendar",
    key: "calendar",
    icon: "fa-regular fa-calendar-check",
    color: "from-blue-500 to-cyan-400",
    backend: "calendar",
  },
  {
    id: "whatsapp",
    key: "whatsapp",
    icon: "fa-brands fa-whatsapp",
    color: "from-green-400 to-emerald-600",
    backend: "whatsapp",
  },
  {
    id: "telegram",
    key: "telegram",
    icon: "fa-brands fa-telegram",
    color: "from-sky-400 to-blue-600",
    backend: "telegram",
  },
];

const integrationPath = [
  { name: "Settings", color: "text-slate-400", ref: "/settings" },
  { name: "Integrations", color: "text-slate-800", ref: "/settings/integrations" },
];

function consumeIntegrationQueryState() {
  try {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const authError = params.get("error") || "";

    if (connected || authError) {
      params.delete("connected");
      params.delete("error");
      const nextQuery = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
    }

    return {
      connectedGoogle: connected === "google",
      authError,
    };
  } catch {
    return {
      connectedGoogle: false,
      authError: "",
    };
  }
}

function getStatus(provider, statuses, activeSpaceId, t) {
  if (provider.backend === "drive") {
    return statuses.googleDriveConnected
      ? { label: t("integrations.providers.drive.connected"), tone: "green", detail: t("integrations.providers.drive.connectedDetail") }
      : { label: t("integrations.providers.drive.notConnected"), tone: "slate", detail: t("integrations.providers.drive.notConnectedDetail") };
  }

  if (provider.backend === "calendar") {
    return activeSpaceId
      ? { label: t("integrations.providers.calendar.authRequired"), tone: "blue", detail: t("integrations.providers.calendar.authRequiredDetail") }
      : { label: t("integrations.providers.selectSpace"), tone: "amber", detail: t("integrations.providers.calendar.selectSpaceDetail") };
  }

  if (provider.backend === "whatsapp") {
    if (!activeSpaceId) {
      return { label: t("integrations.providers.selectSpace"), tone: "amber", detail: t("integrations.providers.whatsapp.workspaceDetail") };
    }

    if (!statuses.whatsapp) {
      return { label: t("integrations.providers.whatsapp.statusUnavailable"), tone: "slate", detail: t("integrations.providers.whatsapp.statusUnavailableDetail") };
    }

    if (statuses.whatsapp.configured) {
      return {
        label: statuses.whatsapp.isActive ? t("integrations.providers.whatsapp.configured") : t("integrations.providers.whatsapp.inactive"),
        tone: statuses.whatsapp.isActive ? "green" : "amber",
        detail: statuses.whatsapp.displayName || t("common.selected"),
      };
    }

    return { label: t("integrations.providers.whatsapp.notConfigured"), tone: "slate", detail: t("integrations.providers.whatsapp.notConfiguredDetail") };
  }

  if (provider.backend === "telegram") {
    if (!activeSpaceId) {
      return { label: t("integrations.providers.selectSpace"), tone: "amber", detail: t("integrations.providers.telegram.workspaceDetail") };
    }

    if (!statuses.telegram) {
      return { label: t("integrations.providers.telegram.statusUnavailable"), tone: "slate", detail: t("integrations.providers.telegram.statusUnavailableDetail") };
    }

    if (statuses.telegram.configured) {
      return {
        label: statuses.telegram.isActive ? t("integrations.providers.telegram.configured") : t("integrations.providers.telegram.inactive"),
        tone: statuses.telegram.isActive ? "green" : "amber",
        detail: statuses.telegram.botUsername ? t("integrations.providers.telegram.bot", { value: statuses.telegram.botUsername }) : t("common.selected"),
      };
    }

    return { label: t("integrations.providers.telegram.notConfigured"), tone: "slate", detail: t("integrations.providers.telegram.notConfiguredDetail") };
  }

  return { label: t("common.unknown"), tone: "slate", detail: "" };
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
  const { t } = useTranslation();
  const busy = busyAction === provider.id;

  if (provider.backend === "drive") {
    return statuses.googleDriveConnected ? (
      <button
        type="button"
        onClick={onDriveDisconnect}
        disabled={busy}
        className="rounded-2xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
      >
        {busy ? t("integrations.buttons.disconnecting") : t("integrations.buttons.disconnect")}
      </button>
    ) : (
      <button
        type="button"
        onClick={onDriveConnect}
        className="rounded-2xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
      >
        {t("integrations.buttons.connect")}
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
          {busy ? t("integrations.buttons.opening") : t("integrations.buttons.authorize")}
        </button>
        <button
          type="button"
          onClick={onCalendarSync}
          disabled={!activeSpaceId || busy}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t("integrations.buttons.manualSync")}
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
      {t("integrations.buttons.statusOnly")}
    </button>
  );
}

export default function IntegrationsPage({ setPath }) {
  const { activeSpace, activeSpaceId } = useAppContext();
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const initialQueryState = useMemo(() => consumeIntegrationQueryState(), []);
  const [error, setError] = useState(() => initialQueryState.authError);
  const [successMessage, setSuccessMessage] = useState(() => (initialQueryState.connectedGoogle ? t("integrations.success.driveConnected") : ""));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("allApps");
  const [busyAction, setBusyAction] = useState("");
  const popupWatcherRef = useRef(null);
  const statusesQuery = useIntegrationStatusesQuery(activeSpaceId);
  const disconnectDriveMutation = useDisconnectGoogleDriveMutation(activeSpaceId);
  const connectGoogleDrive = useGoogleDriveConnectAction();
  const connectCalendarMutation = useGoogleCalendarConnectMutation();
  const syncCalendarMutation = useGoogleCalendarSyncMutation(activeSpaceId);
  const statuses = useMemo(
    () => statusesQuery.data || {
      googleDriveConnected: false,
      whatsapp: null,
      telegram: null,
    },
    [statusesQuery.data],
  );
  const loading = statusesQuery.isLoading || statusesQuery.isFetching;
  const filters = useMemo(
    () => [
      { key: "allApps", label: t("integrations.filters.allApps") },
      { key: "fileStorage", label: t("integrations.filters.fileStorage") },
      { key: "calendar", label: t("integrations.filters.calendar") },
      { key: "messaging", label: t("integrations.filters.messaging") },
    ],
    [t],
  );
  const providerMeta = useMemo(
    () => ({
      drive: {
        name: t("integrations.providers.drive.name"),
        category: t("integrations.providers.drive.category"),
        description: t("integrations.providers.drive.description"),
        filterKey: "fileStorage",
      },
      calendar: {
        name: t("integrations.providers.calendar.name"),
        category: t("integrations.providers.calendar.category"),
        description: t("integrations.providers.calendar.description"),
        filterKey: "calendar",
      },
      whatsapp: {
        name: t("integrations.providers.whatsapp.name"),
        category: t("integrations.providers.whatsapp.category"),
        description: t("integrations.providers.whatsapp.description"),
        filterKey: "messaging",
      },
      telegram: {
        name: t("integrations.providers.telegram.name"),
        category: t("integrations.providers.telegram.category"),
        description: t("integrations.providers.telegram.description"),
        filterKey: "messaging",
      },
    }),
    [t],
  );

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
    if (initialQueryState.connectedGoogle) {
      void statusesQuery.refetch();
    }
  }, [initialQueryState.connectedGoogle, statusesQuery]);

  const queryError = statusesQuery.isError ? statusesQuery.error?.message || t("integrations.errors.loadFailed") : "";
  const displayError = error || queryError;

  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return SUPPORTED_PROVIDERS.filter((provider) => {
      const meta = providerMeta[provider.key];
      const matchesFilter = filter === "allApps" || meta.filterKey === filter;
      const matchesSearch = !query || `${meta.name} ${meta.category} ${meta.description}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, providerMeta, search]);

  const connectedCount = useMemo(() => {
    return SUPPORTED_PROVIDERS.reduce((count, provider) => {
      const status = getStatus(provider, statuses, activeSpaceId, t);
      return status.tone === "green" ? count + 1 : count;
    }, 0);
  }, [activeSpaceId, statuses, t]);

  const configuredMessagingCount = useMemo(() => {
    return ["whatsapp", "telegram"].reduce((count, providerId) => {
      const provider = SUPPORTED_PROVIDERS.find((item) => item.id === providerId);
      const status = provider ? getStatus(provider, statuses, activeSpaceId, t) : null;
      return status?.tone === "green" ? count + 1 : count;
    }, 0);
  }, [activeSpaceId, statuses, t]);

  const handleDriveConnect = () => {
    connectGoogleDrive();
  };

  const handleDriveDisconnect = async () => {
    setBusyAction("google-drive");
    setError("");
    setSuccessMessage("");

    try {
      await disconnectDriveMutation.mutateAsync();
      setSuccessMessage(t("integrations.success.driveDisconnected"));
    } catch (requestError) {
      setError(requestError.message || t("integrations.errors.driveDisconnectFailed"));
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
        throw new Error(t("integrations.errors.calendarUrlMissing"));
      }

      const popup = window.open(result.url, "mongez-google-calendar", "popup=yes,width=640,height=760");

      if (!popup) {
        window.location.href = result.url;
        return;
      }

      setSuccessMessage(t("integrations.success.calendarWindowOpened"));

      popupWatcherRef.current = window.setInterval(() => {
        if (!popup.closed) {
          return;
        }

        window.clearInterval(popupWatcherRef.current);
        popupWatcherRef.current = null;
        setBusyAction("");
        setSuccessMessage(t("integrations.success.calendarWindowClosed"));
      }, 600);
      return;
    } catch (requestError) {
      setError(requestError.message || t("integrations.errors.calendarConnectFailed"));
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
      setSuccessMessage(t("integrations.success.calendarSyncRequested"));
    } catch (requestError) {
      setError(requestError.message || t("integrations.errors.calendarSyncFailed"));
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <SettingsSidebar activeId="integrations" />

      <main
        className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
        aria-label={t("integrations.title")}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className={`mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-sky-500">{t("integrations.eyebrow")}</p>
              <h1 className="text-2xl font-black tracking-tight">{t("integrations.title")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                {t("integrations.description")}
              </p>
              {activeSpace ? (
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  {t("integrations.activeWorkspace", { name: activeSpace.name })}
                </p>
              ) : (
                <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                  {t("integrations.selectWorkspace")}
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
              {t("integrations.refreshStatus")}
            </button>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <SummaryCard
              label={t("integrations.summary.supported")}
              value={SUPPORTED_PROVIDERS.length}
              hint={t("integrations.summary.supportedHint")}
            />
            <SummaryCard
              label={t("integrations.summary.connected")}
              value={connectedCount}
              hint={t("integrations.summary.connectedHint")}
            />
            <SummaryCard
              label={t("integrations.summary.messagingReady")}
              value={configuredMessagingCount}
              hint={t("integrations.summary.messagingReadyHint")}
            />
          </div>

          <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
              <label className="relative block w-full lg:max-w-sm">
                <i className={`fa-solid fa-magnifying-glass absolute top-1/2 -translate-y-1/2 text-sm text-slate-400 ${isRTL ? "right-3" : "left-3"}`} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("integrations.searchPlaceholder")}
                  className={`w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900 ${
                    isRTL ? "pr-9 pl-3 text-right" : "pl-9 pr-3 text-left"
                  }`}
                />
              </label>

              <div className={`flex flex-wrap gap-2 ${isRTL ? "justify-end" : ""}`}>
                {filters.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      filter === item.key
                        ? "border-sky-400 bg-sky-500 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {displayError ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {displayError}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {visibleProviders.map((provider) => {
              const status = getStatus(provider, statuses, activeSpaceId, t);
              const meta = providerMeta[provider.key];

              return (
                <article
                  key={provider.id}
                  className="group flex min-h-[250px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-500/30"
                >
                  <div className={`mb-4 flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${provider.color} text-xl text-white shadow-lg shadow-slate-900/10`}>
                      <i className={provider.icon} aria-hidden="true" />
                    </div>
                    <StatusBadge status={loading ? { label: t("integrations.loading"), tone: "slate" } : status} />
                  </div>

                  <div className="flex-1">
                    <div className={`mb-2 flex items-center gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                      <h2 className="text-base font-black">{meta.name}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {meta.category}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{meta.description}</p>
                    <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-300">{loading ? t("integrations.providerDetailLoading") : status.detail}</p>
                    {provider.backend === "whatsapp" && statuses.whatsapp?.displayName ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">{t("integrations.providers.whatsapp.account", { value: statuses.whatsapp.displayName })}</p>
                    ) : null}
                    {provider.backend === "telegram" && statuses.telegram?.botUsername ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">{t("integrations.providers.telegram.bot", { value: statuses.telegram.botUsername })}</p>
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
              {t("integrations.noMatches")}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
