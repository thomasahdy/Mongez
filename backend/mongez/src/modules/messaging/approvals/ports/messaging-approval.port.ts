/**
 * MessagingApprovalPort — Port interface for approval push notifications.
 *
 * This port decouples the WorkflowEngine from the messaging implementation,
 * allowing the approval notification to be pushed through multiple channels
 * (WhatsApp, Telegram, Email) without creating circular dependencies.
 *
 * The port supports:
 * - Multi-channel approval push (WhatsApp + Telegram)
 * - Expiration time for approvals
 * - Deep link URLs for "Open in Mongez" functionality
 * - Language-aware rendering
 */

export const MESSAGING_APPROVAL_PORT = 'MESSAGING_APPROVAL_PORT';

/**
 * Request payload for sending an approval notification to a user.
 */
export interface MessagingApprovalRequest {
  /** Space ID (tenant) */
  spaceId: string;
  /** User ID of the approver */
  userId: string;
  /** WorkflowInstance ID */
  instanceId: string;
  /** Approval title (localized) */
  title: string;
  /** Optional approval body/details (localized) */
  body?: string;
  /** When this approval expires (no longer actionable) */
  expiresAt?: Date;
  /** Deep link URL to open the approval in the web app */
  deepLinkUrl?: string;
}

/**
 * Port interface for approval notification delivery.
 *
 * Implementations must:
 * - Resolve the user's messaging contacts (WhatsApp, Telegram)
 * - Render localized approval messages with interactive buttons
 * - Handle delivery failures gracefully (swallow errors)
 * - Respect user's isVerified status for WhatsApp
 */
export interface MessagingApprovalPort {
  /**
   * Send an approval request to a user via all available channels.
   *
   * @param req - Approval request payload
   * @throws Never — errors are logged and swallowed to avoid blocking workflows
   */
  sendApprovalRequestToUser(req: MessagingApprovalRequest): Promise<void>;
}
