import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import workflowService from "../../services/api/workflowService";
import { useAppContext } from "../AppContext";

let path = [
  {
    name: "Workspace",
    color: "text-slate-400",
    ref: "/dashboard"
  },
  {
    name: "Workflow Builder",
    color: "text-slate-800",
    ref: ""
  },
];

export default function WorkflowBuilder() {
  const { setPath } = useOutletContext() || {};
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeSpaceId, spaceMembers } = useAppContext();

  useEffect(() => {
    setPath?.(path);
  }, [setPath]);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("MANUAL");
  const [steps, setSteps] = useState([
    { name: "Initial Approval", approverType: "USER", approverIds: [], timeoutHours: 24 }
  ]);
  const [feedback, setFeedback] = useState("");

  const createDefinitionMutation = useMutation({
    mutationFn: (data) => workflowService.createDefinition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", "definitions", activeSpaceId] });
      setFeedback("Workflow definition created successfully!");
      setTimeout(() => navigate("/workflows"), 2000);
    },
  });

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      { name: `Step ${prev.length + 1}`, approverType: "USER", approverIds: [], timeoutHours: 24 }
    ]);
  };

  const handleRemoveStep = (index) => {
    if (steps.length === 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepChange = (index, field, value) => {
    setSteps((prev) => {
      const next = [...prev];
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback("Please specify a workflow name.");
      return;
    }
    if (steps.some((step) => !step.name.trim() || step.approverIds.length === 0)) {
      setFeedback("Each step must have a name and at least one approver.");
      return;
    }

    try {
      // Map steps to match backend expected schema
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
    } catch (err) {
      console.error(err);
      setFeedback("Failed to save workflow definition.");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6" aria-label="Workflow Builder">
          <div className="max-w-[800px] mx-auto">
            <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-1">
              <i className="fa-solid fa-route text-indigo-500" aria-hidden="true" />
              Workflow Builder
            </h1>
            <p className="text-[13px] text-slate-400 dark:text-slate-500 mb-6">
              Design custom sequential rules for task and document approval sign-offs.
            </p>

            {feedback && (
              <div className="mb-4 rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-xs text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900">
                {feedback}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* General Config Card */}
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-4">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">General Information</h2>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Workflow Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Creative Review, Procurement Approval"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Trigger Type</label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="MANUAL">Manual Trigger</option>
                    <option value="AI_PROPOSED">AI Proposed Trigger</option>
                    <option value="SCHEDULED">Scheduled Trigger</option>
                  </select>
                </div>
              </div>

              {/* Steps List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Approval Steps Sequence</h2>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                  >
                    <i className="fa-solid fa-plus" />
                    Add Step
                  </button>
                </div>

                <div className="space-y-4">
                  {steps.map((step, stepIdx) => (
                    <div
                      key={stepIdx}
                      className="relative rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-4"
                    >
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(stepIdx)}
                          className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition"
                          title="Remove Step"
                        >
                          <i className="fa-regular fa-trash-can text-sm" />
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                          {stepIdx + 1}
                        </span>
                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Approval Step Configuration</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Step Name</label>
                          <input
                            type="text"
                            value={step.name}
                            onChange={(e) => handleStepChange(stepIdx, "name", e.target.value)}
                            placeholder="e.g. Design review sign-off"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">SLA Timeout (Hours)</label>
                          <input
                            type="number"
                            value={step.timeoutHours}
                            onChange={(e) => handleStepChange(stepIdx, "timeoutHours", e.target.value)}
                            placeholder="24"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      {/* Select Approvers */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Select Reviewers</label>
                        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto border border-slate-100 rounded-xl p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
                          {spaceMembers.map((member) => {
                            const userId = member.user?.id || member.id;
                            const userName = member.user?.name || member.name || "Member";
                            const userAvatar = member.user?.avatarUrl || member.avatarUrl;
                            const isSelected = step.approverIds.includes(userId);
                            return (
                              <button
                                type="button"
                                key={userId}
                                onClick={() => handleToggleApprover(stepIdx, userId)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition ${
                                  isSelected
                                    ? "bg-indigo-605 text-white border-indigo-600"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-350 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800"
                                }`}
                              >
                                {userAvatar && (
                                  <img
                                    src={userAvatar}
                                    alt={userName}
                                    className="h-4.5 w-4.5 rounded-full object-cover"
                                  />
                                )}
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
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDefinitionMutation.isPending}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {createDefinitionMutation.isPending ? "Saving..." : "Create Workflow"}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
