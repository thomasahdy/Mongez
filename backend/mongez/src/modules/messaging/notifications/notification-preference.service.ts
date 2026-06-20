import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

type Channel = 'inApp' | 'email' | 'push' | 'whatsapp' | 'telegram';

interface ChannelPrefs {
  inApp?: boolean;
  email?: boolean;
  push?: boolean;
  whatsapp?: boolean;
  telegram?: boolean;
}

/**
 * NotificationPreferenceService — Per-user, per-event notification routing.
 *
 * This service:
 * - Resolves whether a channel is enabled for a specific event type
 * - Respects per-user NotificationPreference.settings
 * - Enforces quiet hours (suppresses non-critical events outside working hours)
 * - Provides sensible defaults when no user preference exists
 */
@Injectable()
export class NotificationPreferenceService {
  /**
   * Default channel preferences per event type.
   * These are used when the user hasn't customized their settings.
   */
  private readonly DEFAULT_PREFS: Record<string, ChannelPrefs> = {
    TASK_ASSIGNED: {
      inApp: true,
      email: true,
      push: true,
      whatsapp: true,
      telegram: true,
    },
    TASK_DUE: {
      inApp: true,
      email: true,
      push: true,
      whatsapp: true,
      telegram: true,
    },
    TASK_UPDATED: {
      inApp: true,
      email: false,
      push: true,
      whatsapp: false,
      telegram: false,
    },
    APPROVAL_REQUESTED: {
      inApp: true,
      email: true,
      push: true,
      whatsapp: true,
      telegram: true,
    },
    APPROVAL_RESOLVED: {
      inApp: true,
      email: true,
      push: true,
      whatsapp: true,
      telegram: true,
    },
    COMMENT_MENTION: {
      inApp: true,
      email: false,
      push: true,
      whatsapp: false,
      telegram: false,
    },
    FILE_UPLOADED: {
      inApp: true,
      email: false,
      push: false,
      whatsapp: false,
      telegram: false,
    },
    AI_INSIGHT: {
      inApp: true,
      email: false,
      push: false,
      whatsapp: false,
      telegram: false,
    },
    WORKFLOW_APPROVAL_REQUEST: {
      inApp: true,
      email: true,
      push: true,
      whatsapp: true,
      telegram: true,
    },
    SYSTEM: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      telegram: false,
    },
  };

  /**
   * Critical event types that bypass quiet hours.
   */
  private readonly CRITICAL_EVENTS = new Set([
    'APPROVAL_REQUESTED',
    'WORKFLOW_APPROVAL_REQUEST',
    'SYSTEM',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a channel is enabled for a given user and event type.
   *
   * @param userId User ID
   * @param eventType Notification event type (e.g. TASK_ASSIGNED)
   * @param channel Channel to check
   * @param priority Event priority (optional, defaults to NORMAL)
   * @returns true if the channel should be used for this notification
   */
  async isChannelEnabled(
    userId: string,
    eventType: string,
    channel: Channel,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL',
  ): Promise<boolean> {
    // Get user preference (if exists)
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: { preferences: true, quietHours: true },
    });

    // Resolve enabled channels from user prefs or defaults
    const userPrefs = (pref?.preferences as Record<string, ChannelPrefs> | undefined) ?? {};
    const eventPrefs = userPrefs[eventType] ?? this.DEFAULT_PREFS[eventType];
    const enabled = eventPrefs?.[channel] ?? this.DEFAULT_PREFS[eventType]?.[channel] ?? false;

    if (!enabled) return false;

    // Check quiet hours (skip for critical events and in-app channel)
    if (pref?.quietHours && channel !== 'inApp' && !this.CRITICAL_EVENTS.has(eventType) && priority !== 'CRITICAL') {
      if (this.inQuietHours(pref.quietHours as { start: string; end: string; timezone?: string })) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current time is within quiet hours.
   *
   * @param quietHours { start: "22:00", end: "07:00", timezone?: "Africa/Cairo" }
   * @returns true if currently in quiet window
   */
  private inQuietHours(quietHours: {
    start: string;
    end: string;
    timezone?: string;
  }): boolean {
    const now = new Date();
    const timezone = quietHours.timezone || 'UTC';

    // Get current time in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    const timeStr = formatter.format(now); // "HH:MM"
    const [hour, minute] = timeStr.split(':').map(Number);
    const currentMinutes = hour * 60 + minute;

    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g. 22:00 - 07:00)
    if (startMinutes > endMinutes) {
      // Overnight window: current time is >= start OR <= end
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    // Same-day window: current time is between start and end
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Get all enabled channels for a user and event type.
   *
   * @param userId User ID
   * @param eventType Notification event type
   * @param priority Event priority (optional)
   * @returns Array of enabled channel names
   */
  async getEnabledChannels(
    userId: string,
    eventType: string,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL',
  ): Promise<Channel[]> {
    const channels: Channel[] = ['inApp', 'email', 'push', 'whatsapp', 'telegram'];
    const enabled: Channel[] = [];

    for (const channel of channels) {
      if (await this.isChannelEnabled(userId, eventType, channel, priority)) {
        enabled.push(channel);
      }
    }

    return enabled;
  }
}
