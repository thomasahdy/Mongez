import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import { PanelSkeleton, Skeleton } from "../../components/loading/Skeleton";
import { useBillingQuery } from "../../hooks/useDashboardQueries";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import SettingsSidebar from "./sections/SettingsSidebar";
import { buildSettingsPath } from "./settingsPath";

const PLAN_PREVIEWS = [
  {
    id: "free",
    tier: "FREE",
    tone: "from-emerald-500 to-sky-500",
    pros: ["Core task and board management", "Basic workspace collaboration", "Starter usage visibility"],
  },
  {
    id: "pro",
    tier: "PRO",
    tone: "from-sky-500 to-indigo-500",
    pros: ["AI-assisted planning and summaries", "Advanced reporting and risk detection", "Best fit for growing teams"],
  },
  {
    id: "enterprise",
    tier: "ENTERPRISE",
    tone: "from-violet-500 to-rose-500",
    pros: ["Expanded governance and approvals", "Higher AI, storage, and workspace limits", "Priority controls for larger organizations"],
  },
];

function BillingContent({ setPath: propSetPath }) {
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
  const emptyStateMessage = t("billing.emptyState", {
    defaultValue: "Billing endpoints responded, but this workspace does not have plan, usage, or AI billing metadata yet.",
  });

  const hasBillingSections = Boolean(
    billingInfo &&
      (Object.keys(billingInfo.usageStats || {}).length ||
        Object.keys(billingInfo.aiUsage || {}).length ||
        Object.keys(billingInfo.currentPlan?.limits || {}).length ||
        billingInfo.currentPlan?.features?.length),
  );

  useEffect(() => {
    setPath?.(buildSettingsPath(t, t("billing.title"), "/settings/billing"));
  }, [setPath, t]);

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
    if (typeof value === "boolean") {
      return value ? t("common.yes", { defaultValue: "Yes" }) : t("common.no", { defaultValue: "No" });
    }
    return String(value);
  };
  const formatLabel = (group, key) => t(`billing.${group}.${key}`, { defaultValue: key });
  const formatPlanName = (plan) => {
    const rawPlanName = plan?.name || plan?.id || "";
    return t(`billing.planNames.${rawPlanName}`, {
      defaultValue: rawPlanName || t("billing.unknownPlan"),
    });
  };

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
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm motion-safe:animate-[slideUp_0.32s_ease_both]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-sky-500">{t("billing.settings")}</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">{t("billing.titleExtended")}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t("billing.description")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setActionError("");
              billingQuery.refetch();
            }}
            disabled={loading || !spaceId}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/40"
          >
            {loading ? t("billing.refreshing") : t("billing.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 motion-safe:animate-[slideUp_0.28s_ease_both]">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {PLAN_PREVIEWS.map((plan, index) => (
          <div
            key={plan.id}
            className="group relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-500/40 motion-safe:animate-[slideUp_0.34s_ease_both]"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${plan.tone}`} />
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-50">
                {t(`billing.planPreview.${plan.id}.name`, { defaultValue: plan.tier })}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {t("billing.planPreview.plan", { defaultValue: "Plan" })}
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {plan.pros.map((pro, proIndex) => (
                <li key={pro} className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  <i className="fa-solid fa-check mt-1 text-xs text-emerald-500" aria-hidden="true" />
                  <span>{t(`billing.planPreview.${plan.id}.pros.${proIndex}`, { defaultValue: pro })}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {!error && spaceId && !loading && billingInfo && !hasBillingSections ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          {emptyStateMessage}
        </div>
      ) : null}

      {billingInfo && (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-505">{t("billing.currentPlan")}</div>
            <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">
              {billingInfo.hasPlanData ? formatPlanName(billingInfo.currentPlan) : t("billing.planUnavailable")}
            </h2>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t("billing.workspace", { name: activeSpace?.name || spaceId })}
              </span>
            </p>

            <div className="mt-6">
              <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{t("billing.enabledFeatures")}</div>
              <div className="flex flex-wrap gap-2">
                {(billingInfo.currentPlan?.features || []).map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-sky-50 dark:bg-sky-955/40 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-400"
                  >
                    {t(`billing.featureLabels.${feature}`, { defaultValue: feature })}
                  </span>
                ))}
                {!billingInfo.currentPlan?.features?.length && (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {billingInfo.hasPlanData ? t("billing.noFeatureMetadata") : t("billing.planMetadataUnavailable")}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-505">{t("billing.usage")}</div>
            {billingInfo.usageStats?.periodDays && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("billing.periodDays", { count: billingInfo.usageStats.periodDays })}</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(billingInfo.usageStats?.usage || {}).map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-505">{formatLabel("usageLabels", key)}</div>
                  <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{formatValue(value)}</div>
                </div>
              ))}
              {!Object.keys(billingInfo.usageStats?.usage || {}).length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                  {t("billing.noUsage")}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {billingInfo && (
        <section className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-550">{t("billing.planLimits")}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(billingInfo.currentPlan?.limits || {})
              .filter(([key]) => key !== "features" && key !== "quotas" && key !== "maxSpaces")
              .map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-550">{formatLabel("limitLabels", key)}</div>
                  <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{formatValue(value)}</div>
                </div>
              ))}
            {Object.entries(billingInfo.currentPlan?.limits?.quotas || {}).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-505">
                  {t("billing.limitSuffix", { label: formatLabel("limitLabels", key) })}
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{formatValue(value)}</div>
              </div>
            ))}
            {!Object.keys(billingInfo.currentPlan?.limits || {}).filter((key) => key !== "features" && key !== "quotas" && key !== "maxSpaces").length &&
              !Object.keys(billingInfo.currentPlan?.limits?.quotas || {}).length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                  {t("billing.noLimits")}
                </div>
              )}
          </div>
        </section>
      )}

      {billingInfo && (
        <section className="rounded-[24px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-550">{t("billing.aiUsage")}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {Object.entries(billingInfo.aiUsage || {}).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-555">{formatLabel("aiUsageLabels", key)}</div>
                <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{formatValue(value)}</div>
              </div>
            ))}
            {!Object.keys(billingInfo.aiUsage || {}).length && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-3 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                {t("billing.noAiUsage")}
              </div>
            )}
          </div>
        </section>
      )}

      {user && (
        <p className={`text-xs text-slate-400 dark:text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
          {t("billing.loggedInAs", { value: user.email || user.name })}
        </p>
      )}
    </div>
  );
}

export default function SettingsBillingPage({ setPath }) {
  const { dir } = useLocaleDirection();
  const { t } = useTranslation();

  return (
    <div className="settings-layout" dir={dir}>
      <SettingsSidebar activeId="billing" />
      <main className="settings-content-area" style={{ padding: 0 }} aria-label={t("billing.aria")}>
        <BillingContent setPath={setPath} />
      </main>
    </div>
  );
}
