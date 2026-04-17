/**
 * Named queues for background job processing
 */
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
  AI_PROCESSING: 'ai-processing',
  REPORTS: 'reports',
  ACTIVITY_LOG: 'activity-log',
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

  // Reports
  GENERATE_REPORT: 'generate-report',

  // Activity
  LOG_ACTIVITY: 'log-activity',
} as const;