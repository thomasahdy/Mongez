import apiClient from "./apiClient";

export const getSpaceBilling = async (spaceId) => {
  const [plan, usage, aiUsage] = await Promise.allSettled([
    apiClient.get("/subscriptions/plan", { params: { spaceId } }),
    apiClient.get("/subscriptions/usage", { params: { spaceId, periodDays: 30 } }),
    apiClient.get("/analytics/ai", { params: { spaceId, period: "month" } }),
  ]);

  const planData = plan.status === "fulfilled" ? plan.value.data || {} : null;
  const usageData = usage.status === "fulfilled" ? usage.value.data || {} : {};
  const aiData = aiUsage.status === "fulfilled" ? aiUsage.value.data || {} : {};

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
};

const billingService = {
  getSpaceBilling,
};

export default billingService;
