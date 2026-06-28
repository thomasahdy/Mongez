import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import workflowService from "../../services/api/workflowService";
import { useAppContext } from "../AppContext";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

export default function WorkflowBuilder() {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const { setPath } = useOutletContext() || {};
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeSpaceId, spaceMembers } = useAppContext();

  useEffect(() => {
    setPath?.([
      {
        name: t("common.workspace"),
        color: "text-slate-400",
        ref: "/dashboard",
      },
      {
        name: t("workflowPage.builderTitle"),
        color: "text-slate-800",
        ref: "",
      },
    ]);
  }, [setPath, t]);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("MANUAL");
  const [steps, setSteps] = useState([
    { name: "Initial Approval", approverType: "USER", approverIds: [], timeoutHours: 24 },
  ]);
  const [feedback, setFeedback] = useState("");

  const createDefinitionMutation = useMutation({
    mutationFn: (data) => workflowService.createDefinition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", "definitions", activeSpaceId] });
      setFeedback(t("workflowPage.createSuccess"));
      setTimeout(() => navigate("/workflows"), 2000);
    },
  });

  const handleAddStep = () => {
    setSteps((current) => [
      ...current,
      { name: `Step ${current.length + 1}`, approverType: "USER", approverIds: [], timeoutHours: 24 },
    ]);
  };

  const handleRemoveStep = (index) => {
    if (steps.length === 1) return;
    setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleStepChange = (index, field, value) => {
    setSteps((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleToggleApprover = (stepIndex, userId) => {
    const currentApprovers = steps[stepIndex].approverIds;
    const nextApprovers = currentApprovers.includes(userId)
      ? currentApprovers.filter((id) => id !== userId)
      : [...currentApprovers, userId];
    handleStepChange(stepIndex, "approverIds", nextApprovers);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setFeedback(t("workflowPage.missingName"));
      return;
    }

    if (steps.some((step) => !step.name.trim() || step.approverIds.length === 0)) {
      setFeedback(t("workflowPage.invalidSteps"));
      return;
    }

    try {
      const mappedSteps = steps.map((step) => ({
        name: step.name,
        approverType: step.approverType,
        approverIds: step.approverIds,
        timeoutHours: Number(step.timeoutHours) || 24,
      }));

      await createDefinitionMutation.mutateAsync({
        spaceId: activeSpaceId,
        name,
        triggerType,
        steps: mappedSteps,
      });
    } catch (error) {
      console.error(error);
      setFeedback(t("workflowPage.createFailed"));
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans dark:bg-slate-900">
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6" aria-label={t("workflowPage.builderAria")}>
          <div className="mx-auto max-w-[800px]">
            <h1 className="mb-1 flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100">
              <i className="fa-solid fa-route text-indigo-500" aria-hidden="true" />
              {t("workflowPage.builderTitle")}
            </h1>
            <p className="mb-6 text-[13px] text-slate-400 dark:text-slate-500">
              {t("workflowPage.builderDescription")}
            </p>

            {feedback ? (
              <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/20">
                {feedback}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] dark:border-slate-800 dark:bg-slate-950">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("workflowPage.generalInformation")}</h2>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {t("workflowPage.workflowName")}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("workflowPage.workflowNamePlaceholder")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {t("workflowPage.triggerType")}
                  </label>
                  <select
                    value={triggerType}
                    onChange={(event) => setTriggerType(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="MANUAL">{t("workflowPage.triggers.manual")}</option>
                    <option value="AI_PROPOSED">{t("workflowPage.triggers.aiProposed")}</option>
                    <option value="SCHEDULED">{t("workflowPage.triggers.scheduled")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("workflowPage.stepsTitle")}</h2>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                  >
                    <i className="fa-solid fa-plus" />
                    {t("workflowPage.addStep")}
                  </button>
                </div>

                <div className="space-y-4">
                  {steps.map((step, stepIndex) => (
                    <div
                      key={stepIndex}
                      className="relative space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] dark:border-slate-800 dark:bg-slate-950"
                    >
                      {steps.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(stepIndex)}
                          className={`absolute top-4 text-slate-300 transition hover:text-rose-500 ${isRTL ? "left-4" : "right-4"}`}
                          title={t("workflowPage.removeStep")}
                        >
                          <i className="fa-regular fa-trash-can text-sm" />
                        </button>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                          {stepIndex + 1}
                        </span>
                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("workflowPage.stepConfiguration")}</h3>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {t("workflowPage.stepName")}
                          </label>
                          <input
                            type="text"
                            value={step.name}
                            onChange={(event) => handleStepChange(stepIndex, "name", event.target.value)}
                            placeholder={t("workflowPage.stepNamePlaceholder")}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {t("workflowPage.timeout")}
                          </label>
                          <input
                            type="number"
                            value={step.timeoutHours}
                            onChange={(event) => handleStepChange(stepIndex, "timeoutHours", event.target.value)}
                            placeholder="24"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {t("workflowPage.reviewers")}
                        </label>
                        <div className="flex max-h-[120px] flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                          {(spaceMembers || []).map((member) => {
                            const userId = member.user?.id || member.id;
                            const userName = member.user?.name || member.name || t("members.labels.memberFallback");
                            const userAvatar = member.user?.avatarUrl || member.avatarUrl;
                            const isSelected = step.approverIds.includes(userId);

                            return (
                              <button
                                type="button"
                                key={userId}
                                onClick={() => handleToggleApprover(stepIndex, userId)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-605 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-350 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                                }`}
                              >
                                {userAvatar ? (
                                  <img
                                    src={userAvatar}
                                    alt={userName}
                                    className="h-4.5 w-4.5 rounded-full object-cover"
                                  />
                                ) : null}
                                {userName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/workflows")}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                >
                  {t("workflowPage.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={createDefinitionMutation.isPending}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createDefinitionMutation.isPending ? t("workflowPage.saving") : t("workflowPage.createWorkflow")}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
