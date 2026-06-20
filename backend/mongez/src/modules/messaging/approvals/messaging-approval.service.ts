import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { WorkflowService } from '../../workflow/workflow.service';
import { WhatsAppRepository } from '../../whatsapp/repositories/whatsapp.repository';
import { TelegramRepository } from '../../telegram/repositories/telegram.repository';
import {
  QUEUE_NAMES,
  JOB_NAMES,
} from '../../../infrastructure/queue/queue.constants';
import {
  MessagingLang,
  msg,
  encodeApprovalCallback,
  normalizeLang,
} from '../templates/messaging-i18n';
import {
  MessagingApprovalPort,
  MessagingApprovalRequest,
  MESSAGING_APPROVAL_PORT,
} from './ports/messaging-approval.port';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ApprovalDelegationService } from './approval-delegation.service';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';
export type MessagingChannelKind = 'WHATSAPP' | 'TELEGRAM';

export interface ApprovalResolveResult {
  ok: boolean;
  reply: string;
}

/**
 * Orchestrates approval interactions across WhatsApp and Telegram:
 *  - resolve():   invoked from inbound button / command to APPROVE/REJECT a
 *                 running WorkflowInstance via the WorkflowEngine.
 *  - build*():    render the channel-specific interactive payloads (Telegram
 *                 inline keyboard, WhatsApp quick-reply buttons).
 *  - sendApprovalRequestToUser(): proactively push an interactive approval
 *                 message via the MessagingApprovalPort interface.
 *
 * This service implements the MessagingApprovalPort to decouple the workflow
 * engine from messaging implementation details.
 */
@Injectable()
export class MessagingApprovalService implements MessagingApprovalPort {
  private readonly logger = new Logger(MessagingApprovalService.name);

  constructor(
    @Inject(forwardRef(() => WorkflowService)) private readonly workflow: WorkflowService,
    @InjectQueue(QUEUE_NAMES.WHATSAPP) private readonly whatsappQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TELEGRAM) private readonly telegramQueue: Queue,
    private readonly config: ConfigService,
    private readonly whatsappRepo: WhatsAppRepository,
    private readonly telegramRepo: TelegramRepository,
    private readonly prisma: PrismaService,
    private readonly delegation: ApprovalDelegationService,
  ) {}

  async resolve(
    instanceId: string,
    userId: string,
    decision: ApprovalDecision,
    lang: MessagingLang,
  ): Promise<ApprovalResolveResult> {
    try {
      // Check if approval has expired
      const instance = await this.prisma.workflowInstance.findUnique({
        where: { id: instanceId },
        select: { context: true, status: true },
      });

      if (!instance) {
        return { ok: false, reply: msg('APPROVAL_NOT_FOUND', lang, instanceId) };
      }

      // Check expiration
      const expiryStr = (instance.context as any)?._approvalExpiresAt as string | undefined;
      if (expiryStr) {
        const expiryDate = new Date(expiryStr);
        if (expiryDate < new Date()) {
          return { ok: false, reply: msg('APPROVAL_EXPIRED', lang) };
        }
      }

      // Proceed with decision
      await this.workflow.submitDecision(instanceId, userId, decision);
      return {
        ok: true,
        reply: msg(
          decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          lang,
          instanceId,
        ),
      };
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof ForbiddenException ||
        err instanceof BadRequestException
      ) {
        return {
          ok: false,
          reply: msg('APPROVAL_NOT_FOUND', lang, instanceId),
        };
      }
      this.logger.error(
        `Failed to resolve approval ${instanceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { ok: false, reply: msg('APPROVAL_NOT_FOUND', lang, instanceId) };
    }
  }

  /** Telegram inline keyboard payload for an approval request. */
  buildTelegramInlineKeyboard(
    instanceId: string,
    lang: MessagingLang,
    deepLinkUrl?: string,
  ) {
    const buttons = [
      {
        text: msg('APPROVAL_BUTTON_APPROVE', lang),
        callback_data: encodeApprovalCallback('approve', instanceId),
      },
      {
        text: msg('APPROVAL_BUTTON_REJECT', lang),
        callback_data: encodeApprovalCallback('reject', instanceId),
      },
    ];

    // Add "Open" button if deep link is provided
    if (deepLinkUrl) {
      return {
        inline_keyboard: [
          buttons,
          [
            {
              text: msg('APPROVAL_BUTTON_OPEN', lang),
              url: deepLinkUrl,
            },
          ],
        ],
      };
    }

    return {
      inline_keyboard: [buttons],
    };
  }

  /** WhatsApp quick-reply buttons payload for an approval request. */
  buildWhatsappButtons(instanceId: string, lang: MessagingLang) {
    return [
      {
        id: encodeApprovalCallback('approve', instanceId),
        title: msg('APPROVAL_BUTTON_APPROVE', lang),
      },
      {
        id: encodeApprovalCallback('reject', instanceId),
        title: msg('APPROVAL_BUTTON_REJECT', lang),
      },
    ];
  }

  /**
   * Build a deep link URL for opening an approval in the web app.
   * Format: {APP_URL}/a/approval/{instanceId}
   */
  private buildDeepLink(instanceId: string): string {
    const appUrl = this.config.get<string>('app.url') || 'https://app.mongez.com';
    return `${appUrl}/a/approval/${instanceId}`;
  }

  /**
   * Proactively push an interactive approval request to a user. Telegram gets
   * an inline keyboard (no template friction); WhatsApp gets a quick-reply
   * button message (requires a pre-approved template in production).
   */
  async sendApprovalRequest(
    channel: MessagingChannelKind,
    req: MessagingApprovalRequest,
    lang: MessagingLang,
    deepLinkUrl?: string,
  ) {
    const prompt = msg('APPROVAL_PROMPT', lang, req.title, req.body || '');

    // Add deep link to prompt for WhatsApp (no URL button support)
    const whatsappPrompt = deepLinkUrl
      ? `${prompt}\n\n${msg('APPROVAL_OPEN_LINK', lang, deepLinkUrl)}`
      : prompt;

    if (channel === 'TELEGRAM') {
      await this.telegramQueue.add(
        JOB_NAMES.SEND_TELEGRAM,
        {
          spaceId: req.spaceId,
          userId: req.userId,
          text: prompt,
          replyMarkup: this.buildTelegramInlineKeyboard(req.instanceId, lang, deepLinkUrl),
          approvalId: req.instanceId,
        },
        {
          jobId: `tg:approval:${req.instanceId}:${req.userId}`,
          removeOnComplete: true,
        },
      );
      return;
    }

    await this.whatsappQueue.add(
      JOB_NAMES.SEND_WHATSAPP,
      {
        spaceId: req.spaceId,
        toPhone: null, // resolved by the processor via the contact lookup
        userId: req.userId,
        interactive: {
          bodyText: whatsappPrompt,
          buttons: this.buildWhatsappButtons(req.instanceId, lang),
        },
        approvalId: req.instanceId,
      },
      {
        jobId: `wa:approval:${req.instanceId}:${req.userId}`,
        removeOnComplete: true,
      },
    );
  }

  /**
   * Port implementation: Send approval request to a user via all available channels.
   * This method is called by the WorkflowService when a step needs reviewer approval.
   *
   * The method:
   * 1. Resolves the user's language preference
   * 2. Builds the deep link URL
   * 3. Finds active contacts for both channels
   * 4. Sends to Telegram (if opted in)
   * 5. Sends to WhatsApp (if opted in AND verified)
   *
   * Errors are swallowed to avoid blocking the workflow.
   */
  async sendApprovalRequestToUser(req: MessagingApprovalRequest): Promise<void> {
    try {
      // Check for active delegation — redirect approval if delegated
      const effective = await this.delegation.resolveEffectiveReviewer(
        req.userId,
        req.spaceId,
      );

      const targetUserId = effective.userId;

      const pref = await this.prisma.userPreference.findUnique({
        where: { userId: targetUserId },
        select: { language: true },
      });
      const lang: MessagingLang = normalizeLang(pref?.language);

      const deepLinkUrl = req.deepLinkUrl ?? this.buildDeepLink(req.instanceId);

      // If delegated, enhance the title to show delegation context
      const effectiveReq = { ...req, userId: targetUserId, deepLinkUrl };
      if (effective.isDelegated) {
        const originalUser = await this.prisma.user.findUnique({
          where: { id: effective.originalUserId },
          select: { name: true },
        });
        const delegationNote = lang === 'ar'
          ? `\n📌 نيابة عن: ${originalUser?.name || 'مستخدم'}`
          : `\n📌 On behalf of: ${originalUser?.name || 'User'}`;
        effectiveReq.body = (effectiveReq.body || '') + delegationNote;

        this.logger.log(
          `Approval ${req.instanceId} delegated: ${req.userId} → ${targetUserId}`,
        );
      }

      // Send to Telegram if contact exists and opted in
      const tgContact = await this.telegramRepo.findContact(targetUserId, req.spaceId);
      if (tgContact?.optedIn) {
        await this.sendApprovalRequest('TELEGRAM', effectiveReq, lang, deepLinkUrl);
      }

      // Send to WhatsApp if contact exists, opted in, AND verified
      const waContact = await this.whatsappRepo.findContact(targetUserId, req.spaceId);
      if (waContact?.optedIn && waContact?.isVerified) {
        await this.sendApprovalRequest('WHATSAPP', effectiveReq, lang, deepLinkUrl);
      }
    } catch (err) {
      this.logger.error(
        `Approval push failed for user ${req.userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Intentionally swallowed — workflow continues via IN_APP notification
    }
  }
}

