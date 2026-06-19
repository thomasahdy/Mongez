import { IsObject, IsOptional } from 'class-validator';

/**
 * Per-type channel preferences. Matches the JSON `preferences` column on
 * `NotificationPreference`.
 *
 * Example:
 * {
 *   "TASK_ASSIGNED": { inApp: true, email: true, push: false, digest: false, muted: false },
 *   "COMMENT_MENTION": { inApp: true, email: false }
 * }
 */
export class UpdateNotificationPreferencesDto {
  @IsObject()
  preferences!: Record<string, Record<string, boolean>>;

  @IsOptional()
  @IsObject()
  quietHours?: Record<string, unknown> | null;
}