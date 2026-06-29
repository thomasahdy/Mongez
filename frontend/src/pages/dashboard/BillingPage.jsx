import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import { PanelSkeleton, Skeleton } from "../../components/loading/Skeleton";
import { useBillingQuery } from "../../hooks/useDashboardQueries";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

function humanizeKey(key) {
  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function BillingPage() {
  const { setPath } = useOutletContext() || {};
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
    setPath?.([
      { name: t("common.workspace"), color: "text-slate-400", ref: "/dashboard" },
      { name: t("billing.breadcrumb"), color: "text-slate-800", ref: "" },
    ]);
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
    return String(value);
  };
  const formatLabel = (group, key) => t(`billing.${group}.${key}`, { defaultValue: humanizeKey(key) });

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 p-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-10 w-48" />
            <Skeleton className="mt-3 h-4 w-72" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-4 h-8 w-40" />
              <PanelSkeleton rows={4} />
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <Skeleton className="h-4 w-20" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="rounded-2xl bg-slate-50 p-4">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-3 h-7 w-16" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{t("billing.subscription")}</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">{t("billing.title")}</h1>
              <p className="mt-2 text-sm text-slate-500">
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
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("billing.refreshing") : t("billing.refresh")}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!error && spaceId && !loading && billingInfo && !hasBillingSections ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
            {t("billing.empty")}
          </div>
        ) : null}

        {billingInfo && (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{t("billing.currentPlan")}</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {billingInfo.hasPlanData ? billingInfo.currentPlan?.name || t("billing.unknownPlan") : t("billing.planUnavailable")}
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                {t("billing.workspace", { name: activeSpace?.name || spaceId })}
              </p>

              <div className="mt-6">
                <div className="mb-3 text-sm font-semibold text-slate-700">{t("billing.enabledFeatures")}</div>
                <div className="flex flex-wrap gap-2">
                  {(billingInfo.currentPlan?.features || []).map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                    >
                      {formatLabel("featureLabels", feature)}
                    </span>
                  ))}
                  {!billingInfo.currentPlan?.features?.length && (
                    <span className="text-sm text-slate-500">
                      {billingInfo.hasPlanData ? t("billing.noFeatureMetadata") : t("billing.planMetadataUnavailable")}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{t("billing.usage")}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(billingInfo.usageStats || {}).map(([key, value]) => (
                  <div key={key} className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{formatLabel("usageLabels", key)}</div>
                    <div className="mt-2 text-lg font-black text-slate-950">{formatValue(value)}</div>
                  </div>
                ))}
                {!Object.keys(billingInfo.usageStats || {}).length && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2">
                    {t("billing.noUsage")}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {billingInfo && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{t("billing.planLimits")}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(billingInfo.currentPlan?.limits || {})
                .filter(([key]) => key !== "features")
                .map(([key, value]) => (
                  <div key={key} className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{formatLabel("limitLabels", key)}</div>
                    <div className="mt-2 text-lg font-black text-slate-950">{formatValue(value)}</div>
                  </div>
                ))}
              {!Object.keys(billingInfo.currentPlan?.limits || {}).filter((key) => key !== "features").length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2 lg:col-span-4">
                  {t("billing.noLimits")}
                </div>
              )}
            </div>
          </section>
        )}

        {billingInfo && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{t("billing.aiUsage")}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Object.entries(billingInfo.aiUsage || {}).map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{formatLabel("aiUsageLabels", key)}</div>
                  <div className="mt-2 text-lg font-black text-slate-950">{formatValue(value)}</div>
                </div>
              ))}
              {!Object.keys(billingInfo.aiUsage || {}).length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-3">
                  {t("billing.noAiUsage")}
                </div>
              )}
            </div>
          </section>
        )}

        {user && (
          <p className="text-sm text-slate-500">{t("billing.loggedInAs", { value: user.email || user.name })}</p>
        )}
      </div>
    </div>
  );
}
