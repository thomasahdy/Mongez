export type FeatureKey =
  | 'AI_CHAT'
  | 'AI_REPORTS'
  | 'AI_RISK_SCAN'
  | 'ADVANCED_ANALYTICS'
  | 'UNLIMITED_BOARDS'
  | 'CUSTOM_WORKFLOWS';

export type UsageMetric = 'AI_REQUESTS' | 'AI_TOKENS' | 'STORAGE_MB' | 'MEMBERS';

export interface PlanLimits {
  maxSpaces: number;
  maxUsers: number;
  maxBoards: number;
  aiEnabled: boolean;
  features: FeatureKey[];
  quotas: Partial<Record<UsageMetric, number>>;
}

// Hardcoded tier definitions — mirrors SubscriptionPlan rows but with feature gating
export const TIER_LIMITS: Record<string, PlanLimits> = {
  FREE: {
    maxSpaces: 1,
    maxUsers: 5,
    maxBoards: 3,
    aiEnabled: false,
    features: [],
    quotas: { AI_REQUESTS: 20, STORAGE_MB: 500, MEMBERS: 5 },
  },
  PRO: {
    maxSpaces: 10,
    maxUsers: 50,
    maxBoards: 100,
    aiEnabled: true,
    features: ['AI_CHAT', 'AI_REPORTS', 'AI_RISK_SCAN', 'ADVANCED_ANALYTICS', 'CUSTOM_WORKFLOWS'],
    quotas: { AI_REQUESTS: 200, AI_TOKENS: 500000, STORAGE_MB: 5000, MEMBERS: 50 },
  },
  ENTERPRISE: {
    maxSpaces: 9999,
    maxUsers: 9999,
    maxBoards: 9999,
    aiEnabled: true,
    features: [
      'AI_CHAT',
      'AI_REPORTS',
      'AI_RISK_SCAN',
      'ADVANCED_ANALYTICS',
      'UNLIMITED_BOARDS',
      'CUSTOM_WORKFLOWS',
    ],
    quotas: { AI_REQUESTS: 1000, AI_TOKENS: 5000000, STORAGE_MB: 50000, MEMBERS: 9999 },
  },
};
