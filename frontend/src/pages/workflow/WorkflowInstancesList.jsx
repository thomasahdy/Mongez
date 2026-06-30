import { useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import workflowService from "../../services/api/workflowService";
import { useAppContext } from "../AppContext";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

export default function WorkflowInstancesList() {
  const { t } = useTranslation();
  const { locale, isRTL } = useLocaleDirection();
  const { setPath } = useOutletContext() || {};
  const navigate = useNavigate();
  const { activeSpaceId } = useAppContext();

  useEffect(() => {
    setPath?.([
      {
        name: t("common.workspace"),
        color: "text-slate-400",
        ref: "/dashboard",
      },
      {
        name: t("Workflows"),
        color: "text-slate-800",
        ref: "",
      },
    ]);
  }, [setPath, t]);

  const { data: definitions, isLoading: loadingDefs } = useQuery({
    queryKey: ["workflow", "definitions", activeSpaceId],
    queryFn: () => workflowService.listDefinitions(activeSpaceId),
    enabled: Boolean(activeSpaceId),
  });

  const { data: myRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ["workflow", "requests", activeSpaceId],
    queryFn: () => workflowService.getMyRequests(activeSpaceId),
    enabled: Boolean(activeSpaceId),
  });

  const definitionsList = definitions || [];
  const requestsList = myRequests?.data || myRequests?.items || myRequests || [];
  const isLoading = loadingDefs || loadingRequests;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2">
          <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-500">{t("workflowPage.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans dark:bg-slate-900">
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6" aria-label={t("workflowPage.listAria")}>
          <div className="mx-auto max-w-[1000px] space-y-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="mb-1 flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100">
                  <i className="fa-solid fa-route text-indigo-500" aria-hidden="true" />
                  {t("workflowPage.listTitle")}
                </h1>
                <p className="text-[13px] text-slate-400 dark:text-slate-500">
                  {t("workflowPage.listDescription")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/workflows/builder")}
                className="self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_20px_rgba(79,70,229,0.15)] transition hover:bg-indigo-700 sm:self-center"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <i className="fa-solid fa-plus" />
                  {t("workflowPage.buildWorkflow")}
                </span>
              </button>
            </div>

            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("workflowPage.rulesTitle")}</h2>
              {definitionsList.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs text-slate-400">{t("workflowPage.rulesEmpty")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {definitionsList.map((definition) => (
                    <div
                      key={definition.id}
                      className="space-y-2 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">{definition.name}</h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            definition.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-slate-50 text-slate-400"
                          }`}
                        >
                          {definition.isActive ? t("workflowPage.active") : t("workflowPage.inactive")}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {t("workflowPage.rulesCount", { count: definition.steps?.length || 0 })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("workflowPage.instancesTitle")}</h2>
              {requestsList.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs text-slate-400">{t("workflowPage.instancesEmpty")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requestsList.map((instance) => {
                    const stepsCount = instance.definition?.steps?.length || 1;
                    const stepPercentage = Math.round(((instance.currentStep ?? 0) / stepsCount) * 100);
                    const startedBy = instance.requester?.name || t("members.labels.memberFallback");
                    let slaViolated = false;
                    const context = instance.context || {};

                    if (context._approvalExpiresAt) {
                      slaViolated = new Date().getTime() > new Date(context._approvalExpiresAt).getTime();
                    }

                    return (
                      <div
                        key={instance.id}
                        className="flex flex-col justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center"
                      >
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">
                              {instance.definition?.name || t("workflowPage.workflowFallback")}
                            </span>
                            {slaViolated ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/20 dark:text-rose-400">
                                <i className="fa-solid fa-triangle-exclamation animate-pulse" />
                                {t("workflowPage.slaOverdue")}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {t("workflowPage.taskLabel", {
                              value: instance.entityId ? `#${instance.entityId.substring(0, 6)}` : t("workflowPage.workflowRequest"),
                            })}
                          </h3>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span>{t("workflowPage.startedBy", { name: startedBy })}</span>
                            <span>•</span>
                            <span>{new Date(instance.createdAt).toLocaleDateString(locale)}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 sm:w-[200px] sm:items-end">
                          <div className="flex w-full justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {t("workflowPage.stepOf", { current: (instance.currentStep ?? 0) + 1, total: stepsCount })}
                            </span>
                            <span className="text-slate-400">{stepPercentage}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-1.5 rounded-full bg-indigo-500 transition-all duration-300 ${isRTL ? "ml-auto" : ""}`}
                              style={{ width: `${stepPercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
