import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import { PanelSkeleton, Skeleton } from "../../components/loading/Skeleton";
import { useBillingQuery } from "../../hooks/useDashboardQueries";

const billingBreadcrumbs = [
  { name: "Settings", color: "text-slate-400", ref: "/settings" },
  { name: "Billing", color: "text-slate-800", ref: "/settings/billing" },
];

export default function BillingPage({ setPath: propSetPath }) {
  const context = useOutletContext() || {};
  const setPath = propSetPath || context.setPath;
  const { activeSpace, spaces, user } = useAppContext();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [actionError, setActionError] = useState("");
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";

  const spaceId = activeSpace?.id || spaces[0]?.id;
  const billingQuery = useBillingQuery(spaceId);
  const billingInfo = billingQuery.data || null;
  const loading = billingQuery.isLoading || billingQuery.isFetching;

  const hasBillingSections = Boolean(
    billingInfo &&
      (Object.keys(billingInfo.usageStats || {}).length ||
        Object.keys(billingInfo.aiUsage || {}).length ||
        Object.keys(billingInfo.currentPlan?.limits || {}).length ||
        billingInfo.currentPlan?.features?.length),
  );

  useEffect(() => {
    setPath?.(billingBreadcrumbs);
  }, [setPath]);

  const queryError = !spaceId
    ? t("billing.selectWorkspace")
    : billingQuery.isError
      ? billingQuery.error?.message || t("billing.loadFailed")
      : "";
  const error = actionError || queryError;

  const formatValue = (value) => {
    if (typeof value === "number") {
      return new Intl.NumberFormat(locale).format(value);
    }
    return String(value);
  };
  const formatLabel = (group, key) => t(`billing.${group}.${key}`, { defaultValue: humanizeKey(key) });

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6 space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-10 w-48" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-40" />
            <PanelSkeleton rows={4} />
          </section>
          <section className="rounded-[28px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
            <Skeleton className="h-4 w-20" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-3 h-7 w-16" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-6 space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-sky-500">Settings</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">Billing & Subscription</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This page only shows data exposed by the current backend billing and analytics APIs.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              billingQuery.refetch();
            }}
            disabled={loading || !spaceId}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/40"
          >
            {loading ? "Refreshing..." : "Refresh billing"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {!error && spaceId && !loading && billingInfo && !hasBillingSections ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Billing endpoints responded, but this workspace does not have plan, usage, or AI billing metadata yet.
        </div>
      ) : null}

      {billingInfo && (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-505">Current plan</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">
              {billingInfo.hasPlanData ? billingInfo.currentPlan?.name || "Unknown plan" : "Plan unavailable"}
            </h2>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Workspace: <span className="font-semibold text-slate-700 dark:text-slate-300">{activeSpace?.name || spaceId}</span>
            </p>

            <div className="mt-6">
              <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Enabled features</div>
              <div className="flex flex-wrap gap-2">
                {(billingInfo.currentPlan?.features || []).map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-sky-50 dark:bg-sky-955/40 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-400"
                  >
                    {feature}
                  </span>
                ))}
                {!billingInfo.currentPlan?.features?.length && (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {billingInfo.hasPlanData ? "No feature metadata returned." : "Plan metadata is unavailable for this workspace."}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-505">Usage</div>
            {billingInfo.usageStats?.periodDays && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Calculated over a {billingInfo.usageStats.periodDays}-day period</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(billingInfo.usageStats?.usage || {}).map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-505">{key}</div>
                  <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{String(value)}</div>
                </div>
              ))}
              {!Object.keys(billingInfo.usageStats?.usage || {}).length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                  No usage metrics were returned for this workspace.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {billingInfo && (
        <section className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-550">Plan limits</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(billingInfo.currentPlan?.limits || {})
              .filter(([key]) => key !== "features" && key !== "quotas")
              .map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-505">{key}</div>
                  <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{String(value)}</div>
                </div>
              ))}
            {Object.entries(billingInfo.currentPlan?.limits?.quotas || {}).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-505">{key} limit</div>
                <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{String(value)}</div>
              </div>
            ))}
            {!Object.keys(billingInfo.currentPlan?.limits || {}).filter((key) => key !== "features" && key !== "quotas").length && 
             !Object.keys(billingInfo.currentPlan?.limits?.quotas || {}).length && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                No plan limit metadata was returned by the backend.
              </div>
            )}
          </div>
        </section>
      )}

      {billingInfo && (
        <section className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-550">AI usage</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {Object.entries(billingInfo.aiUsage || {}).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-555">{key}</div>
                <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{String(value)}</div>
              </div>
            ))}
            {!Object.keys(billingInfo.aiUsage || {}).length && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-3 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                No AI usage metrics were returned for this workspace.
              </div>
            )}
          </div>
        </section>
      )}

      {user && (
        <p className="text-xs text-slate-400 dark:text-slate-500">Logged in as {user.email || user.name}</p>
      )}
    </div>
  );
}
