import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { useAppContext } from "../AppContext";
import { PanelSkeleton, Skeleton } from "../../components/loading/Skeleton";
import { useBillingQuery } from "../../hooks/useDashboardQueries";

export default function BillingPage() {
  const { setPath } = useOutletContext() || {};
  const { activeSpace, spaces, user } = useAppContext();
  const [error, setError] = useState("");

  const spaceId = activeSpace?.id || spaces[0]?.id;
  const billingQuery = useBillingQuery(spaceId);
  const billingInfo = billingQuery.data || null;
  const loading = billingQuery.isLoading || billingQuery.isFetching;

  useEffect(() => {
    setPath?.([
      { name: "Workspace", color: "text-slate-400", ref: "/dashboard" },
      { name: "Billing", color: "text-slate-800", ref: "" },
    ]);
  }, [setPath]);

  useEffect(() => {
    if (!spaceId) {
      setError("Select a workspace to view billing details.");
      return;
    }

    if (billingQuery.isError) {
      setError(billingQuery.error?.message || "Unable to load billing details.");
      return;
    }

    setError("");
  }, [billingQuery.error?.message, billingQuery.isError, spaceId]);

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
    <div className="h-full overflow-y-auto bg-slate-50 p-5">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Subscription</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">Billing</h1>
          <p className="mt-2 text-sm text-slate-500">
            This page only shows data exposed by the current backend billing and analytics APIs.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {billingInfo && (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current plan</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {billingInfo.hasPlanData ? billingInfo.currentPlan?.name || "Unknown plan" : "Plan unavailable"}
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                Workspace: {activeSpace?.name || spaceId}
              </p>

              <div className="mt-6">
                <div className="mb-3 text-sm font-semibold text-slate-700">Enabled features</div>
                <div className="flex flex-wrap gap-2">
                  {(billingInfo.currentPlan?.features || []).map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                    >
                      {feature}
                    </span>
                  ))}
                  {!billingInfo.currentPlan?.features?.length && (
                    <span className="text-sm text-slate-500">
                      {billingInfo.hasPlanData ? "No feature metadata returned." : "Plan metadata is unavailable for this workspace."}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Usage</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(billingInfo.usageStats || {}).map(([key, value]) => (
                  <div key={key} className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{key}</div>
                    <div className="mt-2 text-lg font-black text-slate-950">{String(value)}</div>
                  </div>
                ))}
                {!Object.keys(billingInfo.usageStats || {}).length && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2">
                    No usage metrics were returned for this workspace.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {billingInfo && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Plan limits</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(billingInfo.currentPlan?.limits || {})
                .filter(([key]) => key !== "features")
                .map(([key, value]) => (
                  <div key={key} className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{key}</div>
                    <div className="mt-2 text-lg font-black text-slate-950">{String(value)}</div>
                  </div>
                ))}
              {!Object.keys(billingInfo.currentPlan?.limits || {}).filter((key) => key !== "features").length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-2 lg:col-span-4">
                  No plan limit metadata was returned by the backend.
                </div>
              )}
            </div>
          </section>
        )}

        {billingInfo && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">AI usage</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Object.entries(billingInfo.aiUsage || {}).map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{key}</div>
                  <div className="mt-2 text-lg font-black text-slate-950">{String(value)}</div>
                </div>
              ))}
              {!Object.keys(billingInfo.aiUsage || {}).length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 sm:col-span-3">
                  No AI usage metrics were returned for this workspace.
                </div>
              )}
            </div>
          </section>
        )}

        {user && (
          <p className="text-sm text-slate-500">Logged in as {user.email || user.name}</p>
        )}
      </div>
    </div>
  );
}
