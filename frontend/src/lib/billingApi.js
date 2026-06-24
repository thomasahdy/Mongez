import { apiRequest } from "./apiClient";

export async function getBillingPlans() {
  return [];
}

export async function getSpaceBilling(spaceId) {
  const [plan, usage, aiUsage] = await Promise.allSettled([
    apiRequest("/subscriptions/plan", {
      params: { spaceId },
      unwrap: false,
    }),
    apiRequest("/subscriptions/usage", {
      params: { spaceId, periodDays: 30 },
      unwrap: false,
    }),
    apiRequest("/analytics/ai", {
      params: { spaceId, period: "month" },
      unwrap: false,
    }),
  ]);

  const planData =
    plan.status === "fulfilled" ? (plan.value?.data || plan.value || {}) : null;
  const usageData =
    usage.status === "fulfilled" ? (usage.value?.data || usage.value || {}) : {};
  const aiData =
    aiUsage.status === "fulfilled" ? (aiUsage.value?.data || aiUsage.value || {}) : {};

  return {
    currentPlan: {
      id: planData?.tier || "",
      name: planData?.tier || "",
      limits: planData?.limits || {},
      features: Array.isArray(planData?.limits?.features) ? planData.limits.features : [],
    },
    usageStats: usageData,
    aiUsage: aiData,
    hasPlanData: Boolean(planData),
  };
}

export async function upgradePlan() {
  throw new Error("Plan upgrades are not available in the current backend API.");
}
