import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  SpaceMemberGuard,
  SpaceRoles,
} from '../spaces/guards/space-member.guard';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './services/telegram.service';
import { TelegramRepository } from './repositories/telegram.repository';
import { EncryptionService } from '../../shared/services/encryption.service';
import { MessagingCommandExecutor } from '../messaging/commands/messaging-command-executor.service';
import { SetupTelegramDto } from './dto/setup-telegram.dto';
import { RegisterTelegramContactDto } from './dto/register-telegram-contact.dto';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly service: TelegramService,
    private readonly repo: TelegramRepository,
    private readonly encryption: EncryptionService,
    private readonly executor: MessagingCommandExecutor,
    private readonly config: ConfigService,
  ) {}

  // ── Telegram webhook: inbound updates ──────────────────────────

  @Post('webhook/:pathId')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Param('pathId') pathId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (!this.service.verifySecretToken(secret)) {
      throw new UnauthorizedException('Invalid Telegram secret token');
    }

    const account = await this.service.resolveAccountByPathId(pathId);
    if (!account) {
      throw new UnauthorizedException('Unknown Telegram bot');
    }

    // Fire-and-forget to stay well under Telegram's retry window.
    this.processUpdate(body, account.spaceId, account.botToken).catch((err) =>
      this.logger.error(
        `Telegram update processing failed: ${err?.message || err}`,
      ),
    );

    return { status: 'ok' };
  }

  private async processUpdate(
    update: any,
    spaceId: string,
    botToken: string,
  ): Promise<void> {
    // When using the env-fallback bot (not per-space), broadcast the inbound
    // message to ALL active spaces so users can still pair their Telegram
    // account via the "Scan for My Chat" flow.
    if (spaceId === '__env__') {
      if (!update?.message?.text) return;

      const allSpaces = await this.repo.findAllActiveAccountSpaces();
      const spaceIds = allSpaces.length > 0
        ? allSpaces.map((a) => a.spaceId)
        : await this.repo.findAllSpaceIds();

      if (!spaceIds.length) return;

      const chatId = String(update.message.chat?.id);
      const username = update.message.from?.username
        ? `@${update.message.from.username}`
        : null;

      // Store message in every space so any space's admin can scan & pair it.
      // Only send the bot reply ONCE (to the first space that needs it).
      let replySent = false;
      for (const sid of spaceIds) {
        const existingContact = await this.repo.findContactByChat(chatId, sid);
        if (existingContact) continue; // already paired in this space — skip

        await this.repo.createMessage({
          spaceId: sid,
          direction: 'INBOUND',
          chatId,
          content: update.message.text,
          tgMessageId: update.message.message_id,
          status: 'READ',
          metadata: { username },
        }).catch((err) =>
          this.logger.warn(`env-broadcast store for space ${sid} failed: ${err?.message}`),
        );

        if (!replySent) {
          await this.service.sendMessage(
            botToken,
            chatId,
            '🔒 Please link your Mongez account to use this bot. Open Mongez → Settings → Notifications → Delivery Channels.',
          );
          replySent = true;
        }
      }
      return;
    }

    if (update?.callback_query) {
      await this.handleCallback(update.callback_query, spaceId, botToken);
      return;
    }

    if (update?.message?.text) {
      await this.handleMessage(update.message, spaceId, botToken);
    }
  }

  private async handleMessage(
    message: any,
    spaceId: string,
    botToken: string,
  ): Promise<void> {
    const chatId = String(message.chat?.id);
    if (!chatId) return;

    const username = message.from?.username
      ? `@${message.from.username}`
      : null;
    const contact = await this.repo.findContactByChat(chatId, spaceId);

    if (!contact) {
      await this.repo.createMessage({
        spaceId,
        direction: 'INBOUND',
        chatId,
        content: message.text,
        tgMessageId: message.message_id,
        status: 'READ',
        metadata: { username },
      });
      await this.service.sendMessage(
        botToken,
        chatId,
        '🔒 Please link your Mongez account to use this bot. Open Mongez → Settings → Telegram.',
      );
      return;
    }

    await this.repo.createMessage({
      spaceId,
      direction: 'INBOUND',
      chatId,
      content: message.text,
      tgMessageId: message.message_id,
      status: 'READ',
      metadata: { userId: contact.userId },
    });

    const { reply } = await this.executor.handleInbound({
      channel: 'TELEGRAM',
      spaceId,
      userId: contact.userId,
      text: message.text,
    });

    if (reply) await this.service.sendMessage(botToken, chatId, reply);
  }

  private async handleCallback(
    callbackQuery: any,
    spaceId: string,
    botToken: string,
  ): Promise<void> {
    const cqId = callbackQuery.id;
    const chatId = String(callbackQuery.message?.chat?.id);
    const data = callbackQuery.data;

    const contact = chatId
      ? await this.repo.findContactByChat(chatId, spaceId)
      : null;

    if (!contact) {
      await this.service.answerCallbackQuery(botToken, cqId, 'Not linked');
      return;
    }

    const result = await this.executor.handleInbound({
      channel: 'TELEGRAM',
      spaceId,
      userId: contact.userId,
      text: '',
      callbackPayload: data,
    });

    await this.service.answerCallbackQuery(
      botToken,
      cqId,
      result.callbackAnswer || result.reply,
    );
    if (result.reply && chatId) {
      await this.service.sendMessage(botToken, chatId, result.reply);
    }
  }

  // ── Admin / contact configuration (per-space) ──────────────────

  @Post('spaces/:spaceId/setup')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Register Telegram bot credentials for the space' })
  async setup(
    @Param('spaceId') spaceId: string,
    @Body() dto: SetupTelegramDto,
  ) {
    const encryptedToken = dto.botToken
      ? this.encryption.encrypt(dto.botToken)
      : undefined;
    const account = await this.repo.upsertAccount(spaceId, {
      ...(encryptedToken !== undefined ? { botToken: encryptedToken } : {}),
      ...(dto.botUsername !== undefined ? { botUsername: dto.botUsername } : {}),
      isActive: dto.isActive ?? true,
    });
    return {
      spaceId,
      botUsername: account.botUsername,
      isActive: account.isActive,
    };
  }

  @Get('spaces/:spaceId/status')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Telegram integration status for the space + current user',
  })
  async status(@Param('spaceId') spaceId: string, @Req() req: any) {
    // resolveAccount checks DB first, then falls back to env vars
    const resolved = await this.service.resolveAccount(spaceId);
    const contact = await this.repo.findContact(req.user.userId, spaceId);
    return {
      configured: !!resolved,
      isActive: !!resolved,
      botUsername: resolved?.botUsername ?? null,
      source: resolved?.source ?? null,
      contact: contact
        ? {
            chatId: contact.chatId,
            username: contact.username,
            optedIn: contact.optedIn,
            isVerified: contact.isVerified,
          }
        : null,
    };
  }

  @Get('spaces/:spaceId/unlinked-chats')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Retrieve recent inbound chats not yet linked to any user contact',
  })
  async getUnlinkedChats(@Param('spaceId') spaceId: string) {
    const chats = await this.repo.findUnlinkedInboundChats(spaceId);
    return { data: chats };
  }

  @Post('spaces/:spaceId/contact')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Register / update the current user Telegram contact',
  })
  async registerContact(
    @Param('spaceId') spaceId: string,
    @Req() req: any,
    @Body() dto: RegisterTelegramContactDto,
  ) {
    const contact = await this.repo.upsertContact(req.user.userId, spaceId, {
      chatId: dto.chatId,
      username: dto.username,
      isVerified: true,
      optedIn: true,
    });
    return { contactId: contact.id, chatId: contact.chatId };
  }

  @Post('spaces/:spaceId/contact/opt-out')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Disable Telegram notifications for the current user',
  })
  async optOut(@Param('spaceId') spaceId: string, @Req() req: any) {
    const contact = await this.repo.findContact(req.user.userId, spaceId);
    if (!contact)
      throw new BadRequestException('No Telegram contact found for this user');
    const updated = await this.repo.upsertContact(req.user.userId, spaceId, {
      chatId: contact.chatId,
      username: contact.username,
      optedIn: false,
    });
    return { optedIn: updated.optedIn };
  }

  // ── Webhook registration helper ────────────────────────────────

  @Post('spaces/:spaceId/webhook/register')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Configure the bot's Telegram webhook" })
  async registerWebhook(@Param('spaceId') spaceId: string) {
    const account = await this.service.resolveAccount(spaceId);
    if (!account || !account.webhookPathId) {
      throw new BadRequestException(
        'Telegram bot is not configured for this space.',
      );
    }
    const base = this.config.get<string>('telegram.webhookPublicUrl') || '';
    if (!base) {
      throw new BadRequestException('TELEGRAM_WEBHOOK_PUBLIC_URL is not set.');
    }
    const url = `${base.replace(/\/$/, '')}/api/v1/telegram/webhook/${account.webhookPathId}`;
    const secret =
      this.config.get<string>('telegram.webhookSecretToken') || undefined;
    const result = await this.service.setWebhook(account.botToken, url, secret);
    return { webhookUrl: url, ok: result.ok, raw: result.raw };
  }
}
