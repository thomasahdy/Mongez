import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import workflowService from "../../services/api/workflowService";
import { useAppContext } from "../AppContext";

let path = [
  {
    name: "Workspace",
    color: "text-slate-400",
    ref: "/dashboard"
  },
  {
    name: "Workflows",
    color: "text-slate-800",
    ref: ""
  },
];

export default function WorkflowInstancesList() {
  const { setPath } = useOutletContext() || {};
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeSpaceId } = useAppContext();

  useEffect(() => {
    setPath?.(path);
  }, [setPath]);

  // Fetch workflow definitions in space
  const { data: definitions, isLoading: loadingDefs } = useQuery({
    queryKey: ["workflow", "definitions", activeSpaceId],
    queryFn: () => workflowService.listDefinitions(activeSpaceId),
    enabled: Boolean(activeSpaceId),
  });

  // Fetch my workflow requests
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
          <span className="text-sm text-slate-500">Loading workflows...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6" aria-label="Workflows">
          <div className="max-w-[1000px] mx-auto space-y-8">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-1">
                  <i className="fa-solid fa-route text-indigo-500" aria-hidden="true" />
                  Workflows
                </h1>
                <p className="text-[13px] text-slate-400 dark:text-slate-500">
                  Manage and monitor custom automated approval steps in this space.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/workflows/builder")}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition self-start sm:self-center shadow-[0_4px_20px_rgba(79,70,229,0.15)]"
              >
                <i className="fa-solid fa-plus" />
                Build Workflow
              </button>
            </div>

            {/* Definitions Section */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Workflow Rules</h2>
              {definitionsList.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs text-slate-400">No workflow rules defined yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {definitionsList.map((def) => (
                    <div
                      key={def.id}
                      className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">{def.name}</h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          def.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-slate-50 text-slate-400"
                        }`}>
                          {def.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {def.steps?.length || 0} sequential sign-off steps defined.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Instances Section */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Active Instances & History</h2>
              {requestsList.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs text-slate-400">No active workflows currently running.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requestsList.map((inst) => {
                    const stepsCount = inst.definition?.steps?.length || 1;
                    const stepPercentage = Math.round(((inst.currentStep ?? 0) / stepsCount) * 100);

                    // SLA status estimate
                    let slaViolated = false;
                    const context = inst.context || {};
                    if (context._approvalExpiresAt) {
                      slaViolated = new Date().getTime() > new Date(context._approvalExpiresAt).getTime();
                    }

                    return (
                      <div
                        key={inst.id}
                        className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-[0_4px_20px_rgba(15,23,42,0.02)]"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wide">
                              {inst.definition?.name || "Workflow"}
                            </span>
                            {slaViolated && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/20 dark:text-rose-400">
                                <i className="fa-solid fa-triangle-exclamation animate-pulse" />
                                SLA Overdue
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Task: {inst.entityId ? `#${inst.entityId.substring(0, 6)}` : "Workflow Request"}
                          </h3>
                          <div className="text-[11px] text-slate-400 flex items-center gap-3">
                            <span>Started by {inst.requester?.name || "Member"}</span>
                            <span>•</span>
                            <span>{new Date(inst.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="flex flex-col sm:items-end gap-1.5 sm:w-[200px]">
                          <div className="flex justify-between w-full text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Step {inst.currentStep + 1} of {stepsCount}
                            </span>
                            <span className="text-slate-400">{stepPercentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
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
