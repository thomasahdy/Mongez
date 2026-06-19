/**
 * Named queues for background job processing
 */
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
  AI_PROCESSING: 'ai-processing',
  REPORTS: 'reports',
  ACTIVITY_LOG: 'activity-log',
  WORKSPACE_EXPORT: 'workspace-export',
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
} as const;

export const JOB_NAMES = {
  // Notifications
  SEND_NOTIFICATION: 'send-notification',
  SEND_EMAIL: 'send-email',
  BULK_NOTIFY: 'bulk-notify',

  // AI
  ANALYZE_TASK: 'analyze-task',
  DETECT_DELAYS: 'detect-delays',
  SUGGEST_ACTIONS: 'suggest-actions',
  AI_EVAL_SHADOW: 'ai-eval-shadow',         // Async quality evaluation (10% sample)
  AI_INDEX_DOCUMENT: 'ai-index-document',   // RAG incremental indexing
  AI_RISK_SCAN: 'ai-risk-scan',             // Scheduled risk scan

  // Reports
  GENERATE_REPORT: 'generate-report',

  // Activity
  LOG_ACTIVITY: 'log-activity',

  // Messaging channels
  SEND_WHATSAPP: 'send-whatsapp',
  SEND_TELEGRAM: 'send-telegram',
} as const;