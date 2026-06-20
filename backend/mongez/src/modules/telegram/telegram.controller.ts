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

  @Post('webhook/:token')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Param('token') token: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (!this.service.verifySecretToken(secret)) {
      throw new UnauthorizedException('Invalid Telegram secret token');
    }

    const account = await this.service.resolveAccountByToken(token);
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
    if (spaceId === '__env__') return; // env-fallback dev bot has no space context

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
    const encrypted = this.encryption.encrypt(dto.botToken);
    const account = await this.repo.upsertAccount(spaceId, {
      botToken: encrypted,
      botUsername: dto.botUsername,
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
    const account = await this.repo.findActiveAccountBySpace(spaceId);
    const contact = await this.repo.findContact(req.user.userId, spaceId);
    return {
      configured: !!account,
      isActive: account?.isActive ?? false,
      botUsername: account?.botUsername ?? null,
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
    if (!account) {
      throw new BadRequestException(
        'Telegram bot is not configured for this space.',
      );
    }
    const base = this.config.get<string>('telegram.webhookPublicUrl') || '';
    if (!base) {
      throw new BadRequestException('TELEGRAM_WEBHOOK_PUBLIC_URL is not set.');
    }
    const url = `${base.replace(/\/$/, '')}/api/v1/telegram/webhook/${account.botToken}`;
    const secret =
      this.config.get<string>('telegram.webhookSecretToken') || undefined;
    const result = await this.service.setWebhook(account.botToken, url, secret);
    return { webhookUrl: url, ok: result.ok, raw: result.raw };
  }
}
